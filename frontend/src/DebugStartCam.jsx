// --- START OF FILE App.jsx (SIMPLIFIED DEBUG) ---

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { WebGLRenderer } from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// --- Components & Assets ---
import { TerminalComponent } from "./components/TerminalComponent";
import backgroundUrl from "./assets/background.jpg";

export default function App() {
  const mountRef = useRef(null);
  const terminalElRef = useRef(null);

  // --- MUTABLE REFS (Zero Latency) ---
  // Initialized with the values from the main app
  const params = useRef({
    // Position of the TV Group
    posX: 0,
    posY: -0.18,
    posZ: 0,
    // Rotation of the TV Group (Starts at PI to face camera)
    rotX: 0,
    rotY: Math.PI,
    rotZ: 0,
  });

  // --- KEYBOARD LISTENER ('P' to Log) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "p") {
        const p = params.current;
        console.log(
          `%c[PERFECT TV TRANSFORM]`,
          "color: #00ff00; font-weight: bold; font-size: 16px;",
        );
        console.log("------------------------------------------------");
        console.log(`// Replace the 'group' transform in App.jsx with this:`);
        console.log(
          `group.position.set(${p.posX.toFixed(4)}, ${p.posY.toFixed(4)}, ${p.posZ.toFixed(4)});`,
        );
        console.log(
          `group.rotation.set(${p.rotX.toFixed(4)}, ${p.rotY.toFixed(4)}, ${p.rotZ.toFixed(4)});`,
        );
        console.log("------------------------------------------------");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- 3D SCENE SETUP ---
  useEffect(() => {
    if (!mountRef.current || !terminalElRef.current) return;

    const mount = mountRef.current;
    let raf = null;

    // Scene
    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();

    // --- FIXED CAMERA (PERFECT POSITION) ---
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.01,
      1000,
    );
    camera.position.set(0, 0.1, 0.7);
    camera.lookAt(0, 0, 0);

    const webglRenderer = new WebGLRenderer({ antialias: true, alpha: true });
    webglRenderer.setSize(window.innerWidth, window.innerHeight);
    webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    webglRenderer.toneMappingExposure = 0.85;

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(window.innerWidth, window.innerHeight);

    const webglContainer = document.createElement("div");
    webglContainer.style.position = "absolute";
    webglContainer.style.top = "0";
    webglContainer.style.left = "0";
    webglContainer.appendChild(webglRenderer.domElement);
    mount.appendChild(webglContainer);

    const cssContainer = document.createElement("div");
    cssContainer.style.position = "absolute";
    cssContainer.style.top = "0";
    cssContainer.style.left = "0";
    cssContainer.appendChild(cssRenderer.domElement);
    mount.appendChild(cssContainer);

    // Background
    new THREE.TextureLoader().load(backgroundUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      scene.background = t;
    });

    // Lights
    scene.add(new THREE.AmbientLight(0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 2.5);
    dl.position.set(5, 5, 5);
    scene.add(dl);

    // Loaders
    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setKTX2Loader(ktx2Loader);
    ktx2Loader.detectSupport(webglRenderer);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Internal alignment (Terminal to Screen Mesh) - Keeping these constant
    const finalParams = {
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotX: -0.09079,
      rotY: 0,
      rotZ: 0,
      scaleX: 0.922,
      scaleY: 0.922,
    };
    const tvScale = 1.08;

    gltfLoader.load("/crt_tv_basis.glb", async (gltf) => {
      const tv = gltf.scene;

      // --- MESH VISIBILITY LOGIC ---
      let meshIndex = 0;
      tv.traverse((c) => {
        if (c.isMesh) {
          // User requested: "indexed 1 or the second mesh to be visible"
          if (meshIndex === 1) {
            c.visible = true;
            c.material.metalness = 0.4;
            c.material.roughness = 0.6;
          } else {
            c.visible = false;
          }
          meshIndex++;
        }
      });

      let screenMesh = tv.getObjectByName("defaultMaterial_2");
      if (!screenMesh) {
        const fallback = tv.children[0]?.children?.find(
          (m) => m.isMesh && m.name.includes("defaultMaterial"),
        );
        if (fallback) screenMesh = fallback;
      }
      if (screenMesh) screenMesh.visible = false;

      // --- TV GROUP (Controlled by Sliders) ---
      const group = new THREE.Group();
      group.scale.set(tvScale, tvScale, tvScale);
      group.add(tv);
      scene.add(group);

      // Force Terminal Visible
      if (terminalElRef.current) {
        terminalElRef.current.style.visibility = "visible";
        terminalElRef.current.style.opacity = 1;
      }

      const cssObject = new CSS3DObject(terminalElRef.current);
      cssScene.add(cssObject);

      function updateTerminalTransform() {
        if (!screenMesh) return;
        const termW = 1024,
          termH = 768;

        screenMesh.updateWorldMatrix(true, false);
        const screenBox = new THREE.Box3().setFromObject(screenMesh);
        const basePosition = screenBox.getCenter(new THREE.Vector3());
        const baseQuaternion = screenMesh.getWorldQuaternion(
          new THREE.Quaternion(),
        );
        const size = screenBox.getSize(new THREE.Vector3());

        if (size.x === 0) return;

        const baseScale = new THREE.Vector3(
          (size.x / termW) * 0.995,
          (size.y / termH) * 0.995,
          1,
        );

        cssObject.position.copy(basePosition);
        cssObject.quaternion.copy(baseQuaternion);
        cssObject.scale.copy(baseScale);

        // Apply internal alignment offsets (Constant)
        cssObject.position.x += finalParams.offsetX;
        cssObject.position.y -= finalParams.offsetY;
        cssObject.translateZ(finalParams.offsetZ);
        const offsetQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(finalParams.rotX, finalParams.rotY, finalParams.rotZ),
        );
        cssObject.quaternion.multiply(offsetQuaternion);
        cssObject.scale.x *= finalParams.scaleX;
        cssObject.scale.y *= finalParams.scaleY;
      }

      function animate() {
        raf = requestAnimationFrame(animate);
        const p = params.current;

        // --- APPLY SLIDER VALUES TO GROUP ---
        group.position.set(p.posX, p.posY, p.posZ);
        group.rotation.set(p.rotX, p.rotY, p.rotZ);

        // Sync Terminal to new Group position
        updateTerminalTransform();

        webglRenderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
      }
      animate();
    });

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      webglRenderer.setSize(window.innerWidth, window.innerHeight);
      cssRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      cancelAnimationFrame(raf);
      ktx2Loader.dispose();
      window.removeEventListener("resize", onWindowResize);
      while (mount.firstChild) mount.removeChild(mount.firstChild);
    };
  }, []);

  // --- FAST SLIDER COMPONENT ---
  const FastSlider = ({ label, objKey, min, max, step = 0.001 }) => (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
      <span style={{ width: "50px", fontSize: "10px", color: "#aaa" }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={params.current[objKey]}
        onInput={(e) => {
          params.current[objKey] = parseFloat(e.target.value);
          document.getElementById(`val-${objKey}`).innerText = e.target.value;
        }}
        style={{ flex: 1, cursor: "pointer" }}
      />
      <span
        id={`val-${objKey}`}
        style={{
          width: "40px",
          textAlign: "right",
          fontSize: "10px",
          color: "#fff",
        }}
      >
        {params.current[objKey]}
      </span>
    </div>
  );

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#000",
      }}
    >
      {/* --- CONTROLS PANEL --- */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          width: "250px",
          background: "rgba(0,0,0,0.9)",
          border: "1px solid #00ff00",
          padding: "10px",
          fontFamily: "monospace",
          zIndex: 99999,
        }}
      >
        <div
          style={{
            color: "#00ff00",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "10px",
          }}
        >
          TV TRANSFORM (Press 'P' to Log)
        </div>

        <div
          style={{
            borderBottom: "1px solid #333",
            marginBottom: "5px",
            color: "#ffff00",
          }}
        >
          POSITION (Whole TV)
        </div>
        <FastSlider label="Pos X" objKey="posX" min={-1} max={1} />
        <FastSlider label="Pos Y" objKey="posY" min={-1} max={1} />
        <FastSlider label="Pos Z" objKey="posZ" min={-1} max={1} />

        <div
          style={{
            borderBottom: "1px solid #333",
            margin: "10px 0 5px 0",
            color: "#ffff00",
          }}
        >
          ROTATION (Whole TV)
        </div>
        <FastSlider label="Rot X" objKey="rotX" min={-3.14} max={3.14} />
        <FastSlider label="Rot Y" objKey="rotY" min={0} max={6.28} />
        <FastSlider label="Rot Z" objKey="rotZ" min={-3.14} max={3.14} />
      </div>

      {/* --- TERMINAL --- */}
      <div
        ref={terminalElRef}
        className="crt-effects crt-scanlines"
        style={{
          width: "1024px",
          height: "768px",
          position: "absolute",
          top: 0,
          left: 0,
          backgroundColor: "black",
          pointerEvents: "none",
        }}
      >
        <TerminalComponent onCommand={() => {}} />
      </div>
    </div>
  );
}
