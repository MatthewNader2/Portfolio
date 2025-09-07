import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { WebGLRenderer } from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import Stats from "stats.js";

// --- Project-specific Imports ---
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { TerminalComponent } from "./components/TerminalComponent";
import backgroundUrl from "./assets/background.jpg";

export default function App() {
  const mountRef = useRef(null);
  const terminalElRef = useRef(null);
  const terminalComponentRef = useRef(null);

  // --- State Management ---
  const [wasmEngine, setWasmEngine] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioDataString, setPortfolioDataString] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Booting system...");
  const [debugMode, setDebugMode] = useState(false);

  // --- Refs for our custom selection logic ---
  const isSelecting = useRef(false);
  const selectionStart = useRef(null); // { x, y }

  // --- Ref to share Three.js objects between effects ---
  const threeObjectsRef = useRef({
    camera: null,
    eventPlane: null,
    webglRenderer: null,
    cssObject: null,
  });

  // --- Load Wasm Engine and Firebase Data on Startup (Unchanged) ---
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoadingStatus("Loading command interpreter...");
        const WasmModule = await import("./wasm/engine.js");
        const engine = await WasmModule.default();
        const processCommand = engine.cwrap("process_command", "string", [
          "string",
          "string",
        ]);
        setWasmEngine({ processCommand });

        setLoadingStatus("Contacting database...");
        const collectionsToFetch = [
          "about",
          "projects",
          "skills",
          "experience",
          "education",
          "contact",
          "awards",
        ];
        const data = {};

        for (const collName of collectionsToFetch) {
          const querySnapshot = await getDocs(collection(db, collName));
          const docs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          if (docs.length === 0) {
            data[collName] = `Content for ${collName} not found.`;
          } else if (
            collName === "projects" ||
            collName === "experience" ||
            collName === "awards"
          ) {
            data[collName] = docs;
          } else {
            data[collName] = docs[0];
          }
        }

        setPortfolioData(data);
        const jsonString = JSON.stringify(data);
        setPortfolioDataString(jsonString);
      } catch (error) {
        console.error("Initialization failed:", error);
        setLoadingStatus(`Error: ${error.message}`);
      } finally {
        setIsLoading(false);
        setLoadingStatus("Ready.");
      }
    };

    initialize();
  }, []);

  // --- Command Handler (Unchanged) ---
  const handleTerminalCommand = (command) => {
    if (!wasmEngine || !portfolioDataString || !terminalComponentRef.current) {
      terminalComponentRef.current?.write("\r\nSystem not ready. Please wait.");
      terminalComponentRef.current?.prompt();
      return;
    }

    if (command.trim() === "debug mouse") {
      setDebugMode(!debugMode);
      terminalComponentRef.current.write(
        `\r\nMouse debug mode ${debugMode ? "disabled" : "enabled"}`,
      );
      terminalComponentRef.current.prompt();
      return;
    }

    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      terminalComponentRef.current.prompt();
      return;
    }
    const result = wasmEngine.processCommand(
      trimmedCommand,
      portfolioDataString,
    );
    if (result === "COMMAND_CLEAR") {
      terminalComponentRef.current.clear();
    } else {
      terminalComponentRef.current.write(result);
      terminalComponentRef.current.prompt();
    }
  };

  // --- Three.js Scene Setup (Unchanged) ---
  useEffect(() => {
    if (isLoading || !mountRef.current || !terminalElRef.current) return;

    const mount = mountRef.current;
    let raf = null;

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
    const backgroundZoom = 1.1;
    const stats = new Stats();
    stats.showPanel(0);
    mount.appendChild(stats.dom);
    stats.dom.style.position = "absolute";
    stats.dom.style.top = "10px";
    stats.dom.style.left = "10px";

    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0.1, 0.7);
    camera.lookAt(0, 0, 0);

    const webglRenderer = new WebGLRenderer({ antialias: true, alpha: true });
    webglRenderer.setSize(window.innerWidth, window.innerHeight);
    webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    webglRenderer.toneMappingExposure = 0.85;

    const webglContainer = document.createElement("div");
    webglContainer.id = "webgl-renderer";
    webglContainer.className = "render-container";
    webglContainer.appendChild(webglRenderer.domElement);
    mount.appendChild(webglContainer);

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    const cssContainer = document.createElement("div");
    cssContainer.id = "css-renderer";
    cssContainer.className = "render-container";
    cssContainer.appendChild(cssRenderer.domElement);
    mount.appendChild(cssContainer);

    new THREE.TextureLoader().load(backgroundUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      const zoomFactor = 1 / backgroundZoom;
      const offsetFactor = (1 - zoomFactor) / 2;
      t.repeat.set(zoomFactor, zoomFactor);
      t.offset.set(offsetFactor, offsetFactor);
      scene.background = t;
    });

    scene.add(new THREE.AmbientLight(0.7));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 1));

    const dl = new THREE.DirectionalLight(0xffffff, 2.5);
    dl.position.set(5, 5, 5);
    scene.add(dl);

    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setKTX2Loader(ktx2Loader);
    ktx2Loader.detectSupport(webglRenderer);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const RASTER_SCALE = 0.5;

    // Helper functions (unchanged)
    function worldToScreenXY(vWorld, camera, canvasRect) {
      const ndc = vWorld.clone().project(camera);
      const x = (ndc.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
      const y = (-ndc.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top;
      return [x, y];
    }
    function traceBoundary(imgData, w, h) {
      let start = -1;
      for (let i = 0; i < w * h; i++) {
        if (imgData[i]) {
          start = i;
          break;
        }
      }
      if (start === -1) return [];
      const idxToXY = (idx) => [idx % w, Math.floor(idx / w)];
      const xyToIdx = (x, y) => y * w + x;
      const dirs = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
      ];
      const [sx, sy] = idxToXY(start);
      let cx = sx,
        cy = sy;
      let pd = 7;
      const contour = [];
      let step = 0;
      const maxSteps = w * h * 10;
      do {
        contour.push([cx, cy]);
        let found = false;
        for (let k = 0; k < 8; k++) {
          const di = (pd + 1 + k) % 8;
          const nx = cx + dirs[di][0];
          const ny = cy + dirs[di][1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (imgData[xyToIdx(nx, ny)]) {
              cx = nx;
              cy = ny;
              pd = (di + 6) % 8;
              found = true;
              break;
            }
          }
        }
        if (!found) break;
        step++;
        if (step > maxSteps) break;
      } while (!(cx === sx && cy === sy));
      return contour;
    }
    function simplifyRDP(points, epsilon) {
      if (points.length < 3) return points.slice();
      const sqr = (a) => a * a;
      function dist2PointToSeg(px, py, [x1, y1], [x2, y2]) {
        const A = px - x1,
          B = py - y1,
          C = x2 - x1,
          D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let t = len_sq ? dot / len_sq : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = x1 + t * C,
          cy = y1 + t * D;
        return sqr(px - cx) + sqr(py - cy);
      }
      const eps2 = epsilon * epsilon;
      const result = [];
      function rdp(arr, i, j) {
        let idx = -1,
          maxd = -1;
        for (let k = i + 1; k < j; k++) {
          const d2 = dist2PointToSeg(arr[k][0], arr[k][1], arr[i], arr[j]);
          if (d2 > maxd) {
            idx = k;
            maxd = d2;
          }
        }
        if (maxd > eps2) {
          rdp(arr, i, idx);
          rdp(arr, idx, j);
        } else {
          result.push(arr[i]);
        }
      }
      rdp(points, 0, points.length - 1);
      result.push(points[points.length - 1]);
      return result;
    }
    function contourToClipPathPercent(
      contour,
      rectLeft,
      rectTop,
      rectW,
      rectH,
    ) {
      if (rectW < 1 || rectH < 1) return "polygon(0% 0%)";
      const pts = contour.map(([x, y]) => {
        const px = ((x + 0.5 - rectLeft) / rectW) * 100;
        const py = ((y + 0.5 - rectTop) / rectH) * 100;
        return `${px.toFixed(3)}% ${py.toFixed(3)}%`;
      });
      return `polygon(${pts.join(", ")})`;
    }
    function rasterizeProjectedTriangles(projectedTris, canvasW, canvasH) {
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      for (const tri of projectedTris) {
        ctx.moveTo(tri[0][0], tri[0][1]);
        ctx.lineTo(tri[1][0], tri[1][1]);
        ctx.lineTo(tri[2][0], tri[2][1]);
        ctx.closePath();
      }
      ctx.fill();
      const im = ctx.getImageData(0, 0, canvasW, canvasH);
      const data = im.data;
      const mask = new Uint8Array(canvasW * canvasH);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        mask[j] = data[i + 3] > 0 ? 1 : 0;
      }
      return { mask };
    }
    function buildClipPathFromMesh(meshToProject) {
      meshToProject.updateWorldMatrix(true, false);
      const geom = meshToProject.geometry;
      if (!geom) return null;
      const posAttr = geom.attributes.position;
      const idxAttr = geom.index;
      const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
      const canvasRect = webglRenderer.domElement.getBoundingClientRect();
      if (canvasRect.width === 0 || canvasRect.height === 0) {
        return null;
      }
      const projectedTris = [];
      for (let i = 0; i < triCount; i++) {
        let ia = idxAttr ? idxAttr.array[3 * i] : 3 * i;
        let ib = idxAttr ? idxAttr.array[3 * i + 1] : 3 * i + 1;
        let ic = idxAttr ? idxAttr.array[3 * i + 2] : 3 * i + 2;
        const a = new THREE.Vector3().fromBufferAttribute(posAttr, ia);
        const b = new THREE.Vector3().fromBufferAttribute(posAttr, ib);
        const c = new THREE.Vector3().fromBufferAttribute(posAttr, ic);
        meshToProject.localToWorld(a);
        meshToProject.localToWorld(b);
        meshToProject.localToWorld(c);
        projectedTris.push([
          worldToScreenXY(a, camera, canvasRect),
          worldToScreenXY(b, camera, canvasRect),
          worldToScreenXY(c, camera, canvasRect),
        ]);
      }
      const canvasW = Math.max(
        16,
        Math.floor(window.innerWidth * RASTER_SCALE),
      );
      const canvasH = Math.max(
        16,
        Math.floor(window.innerHeight * RASTER_SCALE),
      );
      const scaledTris = projectedTris.map((tri) =>
        tri.map(([x, y]) => [x * RASTER_SCALE, y * RASTER_SCALE]),
      );
      const { mask } = rasterizeProjectedTriangles(
        scaledTris,
        canvasW,
        canvasH,
      );
      const contourScaled = traceBoundary(mask, canvasW, canvasH);
      if (!contourScaled || contourScaled.length === 0) return null;
      const contour = contourScaled.map(([sx, sy]) => [
        sx / RASTER_SCALE,
        sy / RASTER_SCALE,
      ]);
      const simplified = simplifyRDP(contour, 2.0);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const [x, y] of simplified) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }

      const rectW = Math.max(2, maxX - minX);
      const rectH = Math.max(2, maxY - minY);

      const localPoints = simplified.map(([x, y]) => [x - minX, y - minY]);
      const clipPath = contourToClipPathPercent(
        localPoints,
        0,
        0,
        rectW,
        rectH,
      );
      return clipPath;
    }

    let resizeTimer = null;
    let rebuildClipPath = () => {};

    const onWindowResize = () => {
      if (mountRef.current) {
        const { clientWidth, clientHeight } = mountRef.current;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        webglRenderer.setSize(clientWidth, clientHeight);
        cssRenderer.setSize(clientWidth, clientHeight);
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(rebuildClipPath, 150);
      }
    };

    window.addEventListener("resize", onWindowResize);

    const eventPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        visible: false,
      }),
    );
    eventPlane.name = "eventPlaneForTerminal";
    scene.add(eventPlane);

    gltfLoader.load("/crt_tv_basis.glb", async (gltf) => {
      const tv = gltf.scene;
      tv.traverse((c) => {
        if (
          c.isMesh &&
          (c.material?.name === "TVback" || c.material?.name === "TVfront")
        ) {
          c.material.metalness = 0.4;
          c.material.roughness = 0.6;
        }
      });

      const screenMesh = tv.getObjectByName("defaultMaterial_2");
      if (!screenMesh) {
        console.warn("[app] screen mesh not found");
        scene.add(tv);
        return;
      }

      const backPanel = tv.getObjectByName("defaultMaterial");
      if (backPanel) backPanel.visible = false;
      screenMesh.visible = false;

      const group = new THREE.Group();
      group.position.set(0, -0.18, 0);
      group.rotation.y = Math.PI;
      group.scale.set(tvScale, tvScale, tvScale);
      group.add(tv);
      scene.add(group);

      requestAnimationFrame(() => {
        if (terminalElRef.current) {
          terminalElRef.current.style.opacity = 1;
        }
      });

      const cssObject = new CSS3DObject(terminalElRef.current);
      cssScene.add(cssObject);

      const clipMesh = screenMesh.clone();
      clipMesh.material = new THREE.MeshBasicMaterial({ visible: false });
      scene.add(clipMesh);

      const basePosition = new THREE.Vector3();
      const baseQuaternion = new THREE.Quaternion();
      const baseScale = new THREE.Vector3();
      const screenBox = new THREE.Box3();

      threeObjectsRef.current = {
        camera,
        eventPlane,
        webglRenderer,
        cssObject,
      };

      rebuildClipPath = () => {
        const terminalDiv = terminalElRef.current;
        if (!terminalDiv) return;
        const clipPath = buildClipPathFromMesh(clipMesh);
        if (clipPath) {
          terminalDiv.style.clipPath = clipPath;
          terminalDiv.style.webkitClipPath = clipPath;
        }
      };

      function updateTerminalTransform() {
        const termW = 1024,
          termH = 768;
        screenMesh.updateWorldMatrix(true, false);
        screenBox.setFromObject(screenMesh);
        screenBox.getCenter(basePosition);
        screenMesh.getWorldQuaternion(baseQuaternion);
        const size = screenBox.getSize(new THREE.Vector3());
        baseScale.set(size.x / termW, size.y / termH, 1);

        cssObject.position.copy(basePosition);
        cssObject.quaternion.copy(baseQuaternion);
        cssObject.scale.copy(baseScale);

        cssObject.position.x += finalParams.offsetX;
        cssObject.position.y -= finalParams.offsetY;
        cssObject.translateZ(finalParams.offsetZ);

        const offsetRotation = new THREE.Euler(
          finalParams.rotX,
          finalParams.rotY,
          finalParams.rotZ,
        );
        const offsetQuaternion = new THREE.Quaternion().setFromEuler(
          offsetRotation,
        );
        cssObject.quaternion.multiply(offsetQuaternion);

        cssObject.scale.x *= finalParams.scaleX;
        cssObject.scale.y *= finalParams.scaleY;

        clipMesh.position.copy(cssObject.position);
        clipMesh.quaternion.copy(cssObject.quaternion);
        clipMesh.scale.set(
          size.x * finalParams.scaleX,
          size.y * finalParams.scaleY,
          1,
        );

        eventPlane.position.copy(cssObject.position);
        eventPlane.quaternion.copy(cssObject.quaternion);
        eventPlane.scale.set(
          size.x * finalParams.scaleX,
          size.y * finalParams.scaleY,
          1,
        );
      }

      function animate() {
        raf = requestAnimationFrame(animate);
        stats.begin();
        updateTerminalTransform();
        webglRenderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
        stats.end();
      }

      onWindowResize();
      animate();
    });

    return () => {
      cancelAnimationFrame(raf);
      ktx2Loader.dispose();
      while (mount.firstChild) mount.removeChild(mount.firstChild);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [isLoading]);

  // --- The Final Mouse Interaction Brain ---
  const findLinkAt = (col, row) => {
    const term = terminalComponentRef.current?.getTerminal();
    if (!term) return null;
    const linkProvider = term._core.linkProvider;
    if (!linkProvider) return null;

    let foundLink = null;
    for (const linkMatcher of linkProvider._linkMatchers) {
      linkMatcher.provider.provideLinks(row + 1, (link) => {
        if (link && col >= link.range.start.x - 1 && col < link.range.end.x) {
          foundLink = link;
        }
      });
      if (foundLink) break;
    }
    return foundLink;
  };

  const handleTerminalData = (data) => {
    if (data.startsWith("\x1b[<")) {
      const match = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(data);
      if (!match) return;

      const button = parseInt(match[1], 10);
      const col = parseInt(match[2], 10) - 1;
      const row = parseInt(match[3], 10) - 1;
      const type = match[4];

      if (debugMode && (type === "M" || type === "m")) {
        console.log(
          `Mouse Report: button=${button}, col=${col}, row=${row}, type=${type}`,
        );
      }

      if (type === "M") {
        // Mouse Down or Drag
        if (button === 0) {
          // Left Button Press
          isSelecting.current = true;
          selectionStart.current = { x: col, y: row };
          terminalComponentRef.current?.select(col, row, 1, 1);
        } else if (button === 32 && isSelecting.current) {
          // Drag
          const start = selectionStart.current;
          const end = { x: col, y: row };

          const startCol = Math.min(start.x, end.x);
          const startRow = Math.min(start.y, end.y);
          const endCol = Math.max(start.x, end.x);
          const endRow = Math.max(start.y, end.y);

          const width = endCol - startCol + 1;
          const height = endRow - startRow + 1;

          terminalComponentRef.current?.select(
            startCol,
            startRow,
            width,
            height,
          );
        }
      } else if (type === "m") {
        // Mouse Up
        if (button === 0) {
          // Check if it was a click (no drag)
          if (
            isSelecting.current &&
            selectionStart.current.x === col &&
            selectionStart.current.y === row
          ) {
            const link = findLinkAt(col, row);
            if (link) {
              console.log("Link clicked:", link.text);
              window.open(link.text, "_blank");
            }
          }
          isSelecting.current = false;
          // Clear the 1x1 selection box after a click
          setTimeout(() => terminalComponentRef.current?.clearSelection(), 50);
        }
      }
    }
  };

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        touchAction: "none",
        cursor: "auto",
      }}
    >
      <div
        ref={terminalElRef}
        style={{
          width: "1024px",
          height: "768px",
          pointerEvents: "auto",
          opacity: 0,
          transition: "opacity 0.3s ease-in",
          backgroundColor: "black",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {!isLoading && wasmEngine ? (
          <TerminalComponent
            ref={terminalComponentRef}
            onCommand={handleTerminalCommand}
            onData={handleTerminalData}
          />
        ) : (
          <div
            style={{
              color: "#00ff00",
              fontFamily: "monospace",
              fontSize: "16px",
              padding: "15px",
              width: "100%",
              height: "100%",
            }}
          >
            {loadingStatus}
          </div>
        )}
      </div>
    </div>
  );
}
