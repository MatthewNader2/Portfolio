// frontend/src/components/Scene.jsx

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useThree, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import html2canvas from "html2canvas";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import backgroundUrl from "../assets/background.jpg";

// Background component
function SceneBackground({ zoom }) {
  const { scene, invalidate } = useThree();
  const texture = useLoader(THREE.TextureLoader, backgroundUrl);
  useEffect(() => {
    texture.colorSpace = "srgb";
    const zoomValue = 1 / zoom;
    texture.repeat.set(zoomValue, zoomValue);
    texture.offset.set((1 - zoomValue) / 2, (1 - zoomValue) / 2);
    scene.background = texture;
    invalidate();
    return () => {
      texture.dispose();
      scene.background = null;
    };
  }, [scene, texture, zoom, invalidate]);
  return null;
}

export default function Scene({ tvScale = 1.08, backgroundZoom = 1.1 }) {
  const { camera, gl, scene } = useThree();
  const [screenMesh, setScreenMesh] = useState(null);
  const visibleTerminalRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const continuousIntervalRef = useRef(null);
  const updateTimeoutRef = useRef(null);

  // Load GLTF and set up materials
  useEffect(() => {
    const ktx2 = new KTX2Loader().setTranscoderPath("/basis/");
    const loader = new GLTFLoader();
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
    ktx2.detectSupport(gl);

    loader.load("/crt_tv_basis.glb", (gltf) => {
      let foundScreenMesh = null;
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          if (
            child.material.name === "TVback" ||
            child.material.name === "TVfront"
          ) {
            child.material.metalness = 0.4;
            child.material.roughness = 0.6;
          }
          if (child.name === "defaultMaterial") child.visible = false;
          if (child.name === "defaultMaterial_2") foundScreenMesh = child;
        }
      });

      if (foundScreenMesh) {
        foundScreenMesh.visible = true;
        setScreenMesh(foundScreenMesh);
      }

      const tvGroup = new THREE.Group();
      tvGroup.position.set(0, -0.18, 0);
      tvGroup.rotation.y = Math.PI;
      tvGroup.scale.set(tvScale, tvScale, tvScale);
      tvGroup.add(gltf.scene);
      scene.add(tvGroup);
    });
    return () => {
      ktx2.dispose();
    };
  }, [gl, scene, tvScale]);

  // Create HIDDEN overlay DOM + xterm
  useEffect(() => {
    if (visibleTerminalRef.current) return;

    const overlay = document.createElement("div");
    overlay.id = "visible-terminal-overlay";
    // --- FIX #1: Make the source terminal invisible and non-interactive TO THE USER ---
    // It will still be visible to html2canvas and can be programmatically focused.
    overlay.style.position = "absolute"; // Use absolute instead of fixed
    overlay.style.zIndex = "-1"; // Hide it behind everything
    overlay.style.opacity = "0"; // Make it transparent
    overlay.style.pointerEvents = "auto"; // It still needs to be focusable
    // --- END FIX #1 ---
    overlay.style.overflow = "hidden";
    overlay.tabIndex = 0;
    document.body.appendChild(overlay);
    visibleTerminalRef.current = overlay;

    const term = new Terminal({
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      cursorBlink: true,
      cols: 80,
      rows: 24,
      theme: {
        background: "#000000",
        foreground: "#00ff00",
        cursor: "#00ff00",
        cursorAccent: "#000000",
        selection: "rgba(0, 255, 0, 0.3)",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(overlay);

    setTimeout(() => {
      fit.fit();
      term.writeln("╔════════════════════════════════════════╗");
      term.writeln("║     RETRO TV TERMINAL SYSTEM v1.0     ║");
      term.writeln("╚════════════════════════════════════════╝");
      term.writeln("\nSystem initialized successfully.");
      term.writeln("Click the screen to begin, then type 'help'.");
      term.write("> ");
      setTimeout(() => updateTextureFromOverlay(), 100);
    }, 10);

    termRef.current = term;
    fitRef.current = fit;

    let currentLine = "";
    const prompt = () => term.write("\r\n> ");
    term.onKey(({ key, domEvent }) => {
      // ... (Your excellent onKey logic is correct)
      if (domEvent.keyCode === 13) {
        term.writeln("");
        if (currentLine.trim().toLowerCase() === "help") {
          term.writeln("Available commands: help, clear, about, demo");
        } else if (currentLine.trim().toLowerCase() === "clear") {
          term.clear();
        } else if (currentLine.trim().toLowerCase() === "about") {
          term.writeln("Retro TV Terminal - A 3D WebGL Experience");
        } else if (currentLine.trim().toLowerCase() === "demo") {
          term.writeln("Running demo animation...");
          let chars = ["|", "/", "-", "\\"];
          let i = 0;
          const interval = setInterval(() => {
            term.write(`\r${chars[i++ % 4]} Processing...`);
            if (i > 20) {
              clearInterval(interval);
              term.writeln("\rDemo complete!    ");
              prompt();
            }
            scheduleTextureUpdate();
          }, 100);
          currentLine = "";
          return;
        } else if (currentLine.trim()) {
          term.writeln(`Unknown command: ${currentLine}`);
        }
        currentLine = "";
        prompt();
      } else if (domEvent.keyCode === 8) {
        if (currentLine.length > 0) {
          term.write("\b \b");
          currentLine = currentLine.slice(0, -1);
        }
      } else if (!domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey) {
        currentLine += key;
        term.write(key);
      }
      scheduleTextureUpdate();
    });

    const startContinuous = () => {
      if (continuousIntervalRef.current) return;
      continuousIntervalRef.current = setInterval(
        () => updateTextureFromOverlay(),
        100,
      );
    };
    const stopContinuous = () => {
      if (!continuousIntervalRef.current) return;
      clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    };
    overlay.addEventListener("focusin", startContinuous);
    overlay.addEventListener("focusout", stopContinuous);

    // --- FIX #2: Add a click listener to the 3D canvas to focus the hidden terminal ---
    const handleCanvasClick = () => {
      if (visibleTerminalRef.current) {
        visibleTerminalRef.current.focus();
      }
    };
    gl.domElement.addEventListener("click", handleCanvasClick);
    // --- END FIX #2 ---

    return () => {
      stopContinuous();
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      term.dispose();
      document.body.removeChild(overlay);
      gl.domElement.removeEventListener("click", handleCanvasClick);
    };
  }, [gl.domElement]);

  const updateTextureFromOverlay = async () => {
    if (
      !visibleTerminalRef.current ||
      !canvasRef.current ||
      !textureRef.current
    )
      return;
    try {
      await document.fonts.ready;
      const rendered = await html2canvas(visibleTerminalRef.current, {
        backgroundColor: "#000000",
        useCORS: true,
        scale: 2,
        logging: false,
      });
      const ctx = canvasRef.current.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(
        rendered,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );
      textureRef.current.needsUpdate = true;
    } catch (error) {
      console.error("html2canvas failed:", error);
    }
  };

  const scheduleTextureUpdate = () => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => updateTextureFromOverlay(), 40);
  };

  useEffect(() => {
    if (!screenMesh) return;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 768;
    canvasRef.current = c;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = "srgb";
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    textureRef.current = tex;

    const uv = screenMesh.geometry.attributes.uv;
    if (uv) {
      let uMin = 1,
        uMax = 0,
        vMin = 1,
        vMax = 0;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uMin = Math.min(uMin, u);
        uMax = Math.max(uMax, u);
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
      }
      const uRange = uMax - uMin;
      const vRange = vMax - vMin;
      tex.repeat.set(1 / uRange, 1 / vRange);
      tex.offset.set(uMin, vMin);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }

    // --- FIX #3: Increase emissiveIntensity for a more noticeable glow ---
    screenMesh.material = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0x00ff00),
      emissiveMap: tex,
      emissiveIntensity: 0.8, // Increased glow
      side: THREE.FrontSide,
    });
    // --- END FIX #3 ---

    scheduleTextureUpdate();
  }, [screenMesh]);

  useFrame(() => {
    const overlayEl = visibleTerminalRef.current;
    if (!overlayEl || !screenMesh) return;
    const pos = screenMesh.geometry.attributes.position;
    const canvasRect = gl.domElement.getBoundingClientRect();
    const projected = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      screenMesh.localToWorld(tmp);
      tmp.project(camera);
      projected.push({
        x: (tmp.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left,
        y: (-tmp.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top,
      });
    }
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const rect = {
      left: Math.min(...xs),
      top: Math.min(...ys),
      width: Math.max(2, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(2, Math.max(...ys) - Math.min(...ys)),
    };
    overlayEl.style.left = `${rect.left}px`;
    overlayEl.style.top = `${rect.top}px`;
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;
    if (fitRef.current) fitRef.current.fit();
  });

  return (
    <>
      <Suspense fallback={null}>
        <SceneBackground zoom={backgroundZoom} />
      </Suspense>
      <ambientLight intensity={0.7} />
      <hemisphereLight
        skyColor={0x87ceeb}
        groundColor={0x444444}
        intensity={1}
      />
      <directionalLight color="white" position={[5, 5, 5]} intensity={2.5} />
    </>
  );
}
