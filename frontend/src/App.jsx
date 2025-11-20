// --- START OF FILE App.jsx ---

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mouseDebug, setMouseDebug] = useState(false);

  // --- Context Menu State ---
  const [contextMenu, setContextMenu] = useState(null);

  // --- Refs for 3D objects ---
  const threeObjectsRef = useRef({
    camera: null,
    eventPlane: null,
    renderer: null,
  });

  // Corners (Restored for logic/debug)
  const cornerTlRef = useRef(null);
  const cornerTrRef = useRef(null);
  const cornerBlRef = useRef(null);
  const cornerBrRef = useRef(null);
  const screenCornersRef = useRef({
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    bl: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
  });

  // --- POINTERS ---
  const redPointerRef = useRef(null);
  const greenPointerRef = useRef(null);

  const isDraggingOnTerminal = useRef(false);
  const selectionStartRef = useRef(null);
  const hoveredLinkRef = useRef(null);

  // --- CONTEXT MENU ACTIONS ---
  const handleCopy = async () => {
    const text = terminalComponentRef.current?.getSelection();
    if (text) {
      await navigator.clipboard.writeText(text);
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) terminalComponentRef.current?.paste(text);
    } catch (err) {
      console.error("Paste failed", err);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const handleTerminalCommand = (command) => {
    if (!wasmEngine || !portfolioDataString || !terminalComponentRef.current) {
      terminalComponentRef.current?.write("\r\nSystem not ready. Please wait.");
      terminalComponentRef.current?.prompt();
      return;
    }

    if (command.trim() === "debug mouse") {
      const newDebugState = !mouseDebug;
      setMouseDebug(newDebugState);
      const status = newDebugState ? "ON" : "OFF";
      terminalComponentRef.current?.write(
        `\r\nMouse debugging is now ${status}.\r\n`,
      );
      terminalComponentRef.current?.prompt();
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

  useEffect(() => {
    if (!mountRef.current) return;

    const getTermCoords = (event) => {
      const { camera, eventPlane } = threeObjectsRef.current;
      const container = mountRef.current;
      if (!camera || !eventPlane || !container) return null;

      const { clientWidth, clientHeight } = container;

      // --- JIT Camera Correction (Fixes Shift on Resize/DevTools) ---
      const currentAspect = clientWidth / clientHeight;
      if (Math.abs(camera.aspect - currentAspect) > 0.001) {
        camera.aspect = currentAspect;
        camera.updateProjectionMatrix();
      }

      // Ensure matrix is fresh for raycasting
      eventPlane.updateMatrixWorld();

      const rect = container.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      const mouse = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();

      mouse.x = (offsetX / clientWidth) * 2 - 1;
      mouse.y = -(offsetY / clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(eventPlane);

      if (intersects.length === 0) {
        if (redPointerRef.current) redPointerRef.current.style.display = "none";
        return null;
      }

      const uv = intersects[0].uv;
      const PADDING = 50;
      const TERM_WIDTH = 1024;
      const TERM_HEIGHT = 768;

      const localX = uv.x * TERM_WIDTH;
      const localY = (1 - uv.y) * TERM_HEIGHT;

      const dims = terminalComponentRef.current?.getDimensions();
      if (!dims) return null;

      const contentWidth = TERM_WIDTH - PADDING * 2;
      const contentHeight = TERM_HEIGHT - PADDING * 2;
      const cellWidth = contentWidth / dims.cols;
      const cellHeight = contentHeight / dims.rows;

      // +0.5 Centering Fix
      let col = Math.floor((localX - PADDING) / cellWidth + 0.5);
      let row = Math.floor((localY - PADDING) / cellHeight);

      col = Math.max(0, Math.min(col, dims.cols - 1));
      row = Math.max(0, Math.min(row, dims.rows - 1));

      if (mouseDebug) {
        const char = terminalComponentRef.current?.getChar(col, row);
        console.log(`Hover: [${col}, ${row}] "${char}"`);
        if (redPointerRef.current) {
          const point = intersects[0].point.clone();
          point.project(camera);
          redPointerRef.current.style.display = "block";
          redPointerRef.current.style.left = `${(point.x * 0.5 + 0.5) * clientWidth}px`;
          redPointerRef.current.style.top = `${-(point.y * 0.5 - 0.5) * clientHeight}px`;
        }
      }

      return { col, row, dims };
    };

    const handleMouseDown = (event) => {
      if (event.isSynthetic) return;
      if (contextMenu) setContextMenu(null);
      if (event.button !== 0) return;

      if (event.detail === 2) {
        const coords = getTermCoords(event);
        if (coords) {
          terminalComponentRef.current?.selectWordAt(coords.col, coords.row);
          isDraggingOnTerminal.current = false;
          return;
        }
      }
      if (event.detail === 3) {
        const coords = getTermCoords(event);
        if (coords) {
          terminalComponentRef.current?.selectLineAt(coords.row);
          isDraggingOnTerminal.current = false;
          return;
        }
      }

      const coords = getTermCoords(event);
      if (coords) {
        isDraggingOnTerminal.current = true;
        selectionStartRef.current = { col: coords.col, row: coords.row };
        terminalComponentRef.current?.clearSelection();
      }
    };

    const handleMouseMove = (event) => {
      if (event.isSynthetic) return;
      if (contextMenu) return;

      const coords = getTermCoords(event);

      if (coords) {
        const link = terminalComponentRef.current?.getLinkAt(
          coords.col,
          coords.row,
        );

        if (link) {
          document.body.classList.add("force-pointer");
          document.body.classList.remove("force-text");
          if (redPointerRef.current) {
            redPointerRef.current.style.backgroundColor = "#00ffff";
            redPointerRef.current.style.boxShadow = "0 0 10px #00ffff";
          }
          hoveredLinkRef.current = link;
        } else {
          document.body.classList.remove("force-pointer");
          document.body.classList.add("force-text");
          if (redPointerRef.current) {
            redPointerRef.current.style.backgroundColor = "red";
            redPointerRef.current.style.boxShadow = "none";
          }
          hoveredLinkRef.current = null;
        }
      } else {
        document.body.classList.remove("force-pointer");
        document.body.classList.remove("force-text");
        if (redPointerRef.current) {
          redPointerRef.current.style.backgroundColor = "red";
          redPointerRef.current.style.boxShadow = "none";
        }
        hoveredLinkRef.current = null;
      }

      if (isDraggingOnTerminal.current && coords && selectionStartRef.current) {
        const start = selectionStartRef.current;
        const end = coords;
        const dims = coords.dims;

        let startIdx = start.row * dims.cols + start.col;
        let endIdx = end.row * dims.cols + end.col;

        if (endIdx < startIdx) {
          const temp = startIdx;
          startIdx = endIdx;
          endIdx = temp;
        }

        const length = endIdx - startIdx + 1;
        const sRow = Math.floor(startIdx / dims.cols);
        const sCol = startIdx % dims.cols;

        terminalComponentRef.current?.select(sCol, sRow, length);
      }
    };

    const handleMouseUp = (event) => {
      if (event.isSynthetic) return;

      const isClick =
        selectionStartRef.current &&
        getTermCoords(event)?.col === selectionStartRef.current.col &&
        getTermCoords(event)?.row === selectionStartRef.current.row;

      if (isClick && hoveredLinkRef.current) {
        window.open(hoveredLinkRef.current, "_blank");
      }

      isDraggingOnTerminal.current = false;
      selectionStartRef.current = null;
      if (redPointerRef.current) redPointerRef.current.style.display = "none";
    };

    const mount = mountRef.current;
    mount.addEventListener("mousedown", handleMouseDown);
    mount.addEventListener("mousemove", handleMouseMove);
    mount.addEventListener("mouseup", handleMouseUp);
    mount.addEventListener("contextmenu", handleContextMenu);

    return () => {
      mount.removeEventListener("mousedown", handleMouseDown);
      mount.removeEventListener("mousemove", handleMouseMove);
      mount.removeEventListener("mouseup", handleMouseUp);
      mount.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [mouseDebug, contextMenu]);

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

        const data = {};

        // 1. Fetch Projects, Experience, Education, Awards (Arrays)
        const arrayCollections = [
          "projects",
          "experience",
          "education",
          "awards",
        ];
        for (const collName of arrayCollections) {
          const querySnapshot = await getDocs(collection(db, collName));
          const docs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          data[collName] =
            docs.length > 0 ? docs : `Content for ${collName} not found.`;
        }

        // 2. Fetch & Format SKILLS (Fixing empty output)
        const skillsSnap = await getDocs(collection(db, "skills"));
        if (!skillsSnap.empty) {
          let skillsText = "";
          skillsSnap.docs.forEach((doc) => {
            const skillData = doc.data();
            // Check if it has a title/category and a list
            // Adjust 'category' and 'items' based on your actual DB keys
            // Fallback: iterate keys if structure is unknown
            const category = skillData.category || skillData.title || doc.id;
            const items =
              skillData.items || skillData.list || skillData.skills || [];

            if (Array.isArray(items)) {
              skillsText += `\n--- ${category} ---\n`;
              skillsText += items.map((item) => ` • ${item}`).join("\n") + "\n";
            } else {
              // Fallback for key-value pairs
              skillsText += `\n--- ${category} ---\n`;
              Object.entries(skillData).forEach(([k, v]) => {
                if (k !== "id") skillsText += ` ${k}: ${v}\n`;
              });
            }
          });
          data["skills"] = skillsText || "No skills data formatted.";
        } else {
          data["skills"] = "Skills not found.";
        }

        // 3. Fetch & Format PERSONAL INFO (About/Contact)
        const personalInfoSnap = await getDocs(collection(db, "personal_info"));
        if (!personalInfoSnap.empty) {
          const info = personalInfoSnap.docs[0].data();

          // Format 'about' as a string
          data["about"] = `NAME: ${info.name || "Matthew Nader"}\n\n${
            info.description || "Full Stack Developer."
          }`;

          // Format 'contact' as a string
          data["contact"] = [
            `Email: ${info.email || "N/A"}`,
            `Phone: ${info.phone || "N/A"}`,
            `GitHub: ${info.github || "N/A"}`,
            `LinkedIn: ${info.linkedin || "N/A"}`,
          ].join("\n");
        } else {
          // Fallback to legacy collections if personal_info missing
          data["about"] = "Personal info not found.";
          data["contact"] = "Contact info not found.";
        }

        console.log("Loaded Portfolio Data:", data);
        setPortfolioData(data);
        const jsonString = JSON.stringify(data);
        setPortfolioDataString(jsonString);
        setLoadingStatus("Ready.");
      } catch (error) {
        console.error("Initialization failed:", error);
        setLoadingStatus(`Error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

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

    // --- RESTORED HELPER FUNCTIONS ---
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
      if (canvasRect.width === 0 || canvasRect.height === 0) return null;
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
      return contourToClipPathPercent(localPoints, 0, 0, rectW, rectH);
    }

    let resizeTimer = null;
    let rebuildClipPath = () => {};

    const onWindowResize = () => {
      if (mountRef.current) {
        const { clientWidth, clientHeight } = mountRef.current;

        // --- FIX: Immediate Update for Mouse/Visual Sync ---
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        webglRenderer.setSize(clientWidth, clientHeight);
        cssRenderer.setSize(clientWidth, clientHeight);

        // Force CSS Renderer to match WebGL exactly
        cssRenderer.domElement.style.width = `${clientWidth}px`;
        cssRenderer.domElement.style.height = `${clientHeight}px`;

        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(rebuildClipPath, 150);
      }
    };
    window.addEventListener("resize", onWindowResize);

    const eventPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    eventPlane.name = "eventPlaneForTerminal";
    scene.add(eventPlane);

    gltfLoader.load("/crt_tv_basis.glb", async (gltf) => {
      const tv = gltf.scene;

      let meshIndex = 0;
      tv.traverse((c) => {
        if (c.isMesh) {
          if (meshIndex === 0 || meshIndex === 2) {
            c.visible = false;
          } else {
            c.material.metalness = 0.4;
            c.material.roughness = 0.6;
            c.visible = true;
          }
          meshIndex++;
        }
      });

      const screenMesh = tv.getObjectByName("defaultMaterial_2");
      if (!screenMesh) {
        console.warn("[app] screen mesh not found, using a fallback");
        const fallbackScreen = tv.children[0]?.children?.find(
          (m) => m.isMesh && m.name.includes("defaultMaterial"),
        );
        if (!fallbackScreen) {
          scene.add(tv);
          return;
        }
        screenMesh = fallbackScreen;
      }
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

      threeObjectsRef.current = { camera, eventPlane, renderer: webglRenderer };

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

        if (!screenMesh || !screenMesh.geometry) return;

        screenMesh.updateWorldMatrix(true, false);
        const screenBox = new THREE.Box3().setFromObject(screenMesh);
        const basePosition = screenBox.getCenter(new THREE.Vector3());
        const baseQuaternion = screenMesh.getWorldQuaternion(
          new THREE.Quaternion(),
        );
        const size = screenBox.getSize(new THREE.Vector3());

        if (size.x === 0 || size.y === 0) return;

        // --- FIX: Safety Scale to prevent "Wider than TV" ---
        // We multiply by 0.995 to ensure it sits just inside the bezel
        const baseScale = new THREE.Vector3(
          (size.x / termW) * 0.995,
          (size.y / termH) * 0.995,
          1,
        );

        cssObject.position.copy(basePosition);
        cssObject.quaternion.copy(baseQuaternion);
        cssObject.scale.copy(baseScale);
        cssObject.position.x += finalParams.offsetX;
        cssObject.position.y -= finalParams.offsetY;
        cssObject.translateZ(finalParams.offsetZ);
        const offsetQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(finalParams.rotX, finalParams.rotY, finalParams.rotZ),
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

        // Sync Event Plane for Raycasting
        eventPlane.position.copy(cssObject.position);
        eventPlane.quaternion.copy(cssObject.quaternion);
        eventPlane.scale.set(
          size.x * finalParams.scaleX,
          size.y * finalParams.scaleY,
          1,
        );
        eventPlane.updateMatrixWorld();
      }

      function updateCornerPositions() {
        if (
          cornerTlRef.current &&
          cornerTrRef.current &&
          cornerBlRef.current &&
          cornerBrRef.current
        ) {
          const tl = cornerTlRef.current.getBoundingClientRect();
          const tr = cornerTrRef.current.getBoundingClientRect();
          const bl = cornerBlRef.current.getBoundingClientRect();
          const br = cornerBrRef.current.getBoundingClientRect();
          screenCornersRef.current = {
            tl: { x: tl.left, y: tl.top },
            tr: { x: tr.left, y: tr.top },
            bl: { x: bl.left, y: bl.top },
            br: { x: br.left, y: br.top },
          };
        }
      }

      function animate() {
        raf = requestAnimationFrame(animate);
        stats.begin();
        updateTerminalTransform();
        updateCornerPositions();
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

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        touchAction: "none",
      }}
    >
      <div
        ref={redPointerRef}
        style={{
          position: "fixed",
          width: "5px",
          height: "5px",
          backgroundColor: "red",
          borderRadius: "50%",
          zIndex: 9999,
          pointerEvents: "none",
          display: "none",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        ref={greenPointerRef}
        style={{
          position: "fixed",
          width: "5px",
          height: "5px",
          backgroundColor: "green",
          borderRadius: "50%",
          zIndex: 9998,
          pointerEvents: "none",
          display: "none",
          transform: "translate(-50%, -50%)",
        }}
      />

      {contextMenu &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: "#000",
              border: "1px solid #00ff00",
              color: "#00ff00",
              fontFamily: '"Pixelmix", monospace',
              fontSize: "14px",
              zIndex: 100000,
              padding: "5px 0",
              boxShadow: "0 0 15px rgba(0, 255, 0, 0.4)",
              minWidth: "120px",
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              style={{
                padding: "8px 20px",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#003300")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              onClick={handleCopy}
            >
              Copy
            </div>
            <div
              style={{
                padding: "8px 20px",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#003300")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              onClick={handlePaste}
            >
              Paste
            </div>
          </div>,
          document.body,
        )}

      <div
        ref={terminalElRef}
        style={{
          width: "1024px",
          height: "768px",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.3s ease-in",
          backgroundColor: "black",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <div
          ref={cornerTlRef}
          style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }}
        />
        <div
          ref={cornerTrRef}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 1,
            height: 1,
          }}
        />
        <div
          ref={cornerBlRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1,
            height: 1,
          }}
        />
        <div
          ref={cornerBrRef}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 1,
            height: 1,
          }}
        />

        {!isLoading && wasmEngine ? (
          <TerminalComponent
            ref={terminalComponentRef}
            onCommand={handleTerminalCommand}
            mouseDebug={mouseDebug}
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
