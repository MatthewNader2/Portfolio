// frontend/src/App.jsx
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
import Stats from "stats.js";
import backgroundUrl from "./assets/background.jpg";

export default function App() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
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
      1000
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

    // (Helper functions remain unchanged)
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
        [-1, -1], [0, -1], [1, -1], [1, 0],
        [1, 1], [0, 1], [-1, 1], [-1, 0],
      ];
      const [sx, sy] = idxToXY(start);
      let cx = sx, cy = sy;
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
        const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let t = len_sq ? dot / len_sq : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = x1 + t * C, cy = y1 + t * D;
        return sqr(px - cx) + sqr(py - cy);
      }
      const eps2 = epsilon * epsilon;
      const result = [];
      function rdp(arr, i, j) {
        let idx = -1, maxd = -1;
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

    function contourToClipPathPercent(contour, rectLeft, rectTop, rectW, rectH) {
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
      const canvasW = Math.max(16, Math.floor(window.innerWidth * RASTER_SCALE));
      const canvasH = Math.max(16, Math.floor(window.innerHeight * RASTER_SCALE));
      const scaledTris = projectedTris.map((tri) =>
        tri.map(([x, y]) => [x * RASTER_SCALE, y * RASTER_SCALE])
      );
      const { mask } = rasterizeProjectedTriangles(scaledTris, canvasW, canvasH);
      const contourScaled = traceBoundary(mask, canvasW, canvasH);
      if (!contourScaled || contourScaled.length === 0) return null;
      const contour = contourScaled.map(([sx, sy]) => [sx / RASTER_SCALE, sy / RASTER_SCALE]);
      const simplified = simplifyRDP(contour, 2.0);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of simplified) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const rectW = Math.max(2, maxX - minX);
      const rectH = Math.max(2, maxY - minY);
      const localPoints = simplified.map(([x, y]) => [x - minX, y - minY]);
      const clipPath = contourToClipPathPercent(localPoints, 0, 0, rectW, rectH);
      return clipPath;
    }

    gltfLoader.load("/crt_tv_basis.glb", async (gltf) => {
      const tv = gltf.scene;
      tv.traverse((c) => {
        if (c.isMesh && (c.material?.name === "TVback" || c.material?.name === "TVfront")) {
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
      group.scale.set(1.08, 1.08, 1.08);
      group.add(tv);
      scene.add(group);

      const termW = 1024, termH = 768;
      const wrapper = document.createElement("div");
      wrapper.className = "terminal-wrapper";
      wrapper.style.width = `${termW}px`;
      wrapper.style.height = `${termH}px`;
      wrapper.style.pointerEvents = "auto";
      const iframe = document.createElement("iframe");
      iframe.src = "/terminal.html";
      iframe.title = "terminal";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      wrapper.appendChild(iframe);

      const cssObject = new CSS3DObject(wrapper);
      cssScene.add(cssObject);

      const clipMesh = screenMesh.clone();
      clipMesh.material = new THREE.MeshBasicMaterial({ visible: false });
      scene.add(clipMesh);

      const basePosition = new THREE.Vector3();
      const baseQuaternion = new THREE.Quaternion();
      const baseScale = new THREE.Vector3();
      const screenBox = new THREE.Box3();

      function updateTerminalTransform() {
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

        const offsetRotation = new THREE.Euler(finalParams.rotX, finalParams.rotY, finalParams.rotZ);
        const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetRotation);
        cssObject.quaternion.multiply(offsetQuaternion);

        cssObject.scale.x *= finalParams.scaleX;
        cssObject.scale.y *= finalParams.scaleY;

        clipMesh.position.copy(cssObject.position);
        clipMesh.quaternion.copy(cssObject.quaternion);
        clipMesh.scale.set(size.x * finalParams.scaleX, size.y * finalParams.scaleY, 1);
      }

      function rebuildClipPath() {
        const clipPath = buildClipPathFromMesh(clipMesh);
        if (clipPath) {
          iframe.style.clipPath = clipPath;
          iframe.style.webkitClipPath = clipPath;
        }
      }

      function animate() {
        raf = requestAnimationFrame(animate);
        stats.begin();
        updateTerminalTransform();
        webglRenderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
        stats.end();
      }

      let resizeTimer = null;
      const onWindowResize = () => {
        // --- THE FIX: SEPARATE IMMEDIATE AND DEBOUNCED ACTIONS ---

        // 1. IMMEDIATE: Update camera and renderers instantly to prevent cropping.
        const { clientWidth, clientHeight } = mount; // Use the mount ref for dimensions
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        webglRenderer.setSize(clientWidth, clientHeight);
        cssRenderer.setSize(clientWidth, clientHeight);

        // 2. DEBOUNCED: Rebuild the expensive clip-path only after resizing has stopped.
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(rebuildClipPath, 150);
      };
      window.addEventListener("resize", onWindowResize);

      // --- Final Startup Sequence ---
      // Manually run the resize handler once to ensure a perfect initial state.
      onWindowResize();
      animate();
    });

    // (Performance logger remains unchanged)
    let lastTime = performance.now();
    let frameCount = 0;
    const logInterval = setInterval(() => {
        const now = performance.now();
        const delta = now - lastTime;
        const fps = ((frameCount / delta) * 1000).toFixed(1);
        let memoryUsage = 'N/A';
        if (performance.memory) {
            memoryUsage = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB';
        }
        console.log({
            timestamp: new Date().toISOString(),
            fps: parseFloat(fps),
            memory: memoryUsage,
        });
        lastTime = now;
        frameCount = 0;
    }, 2000);

    const originalAnimate = window.requestAnimationFrame;
    window.requestAnimationFrame = (...args) => {
        frameCount++;
        return originalAnimate(...args);
    };

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(logInterval);
      ktx2Loader.dispose();
      while (mount.firstChild) mount.removeChild(mount.firstChild);
      window.removeEventListener("resize", onWindowResize);
      window.requestAnimationFrame = originalAnimate;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
}
