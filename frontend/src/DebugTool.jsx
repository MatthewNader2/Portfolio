// frontend/src/DebugTool.jsx

import React, {
  Suspense,
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  useGLTF,
  Line,
  CameraControls,
  PerspectiveCamera,
  OrthographicCamera,
} from "@react-three/drei";
import * as THREE from "three";
import { BackgroundParticles } from "./components/BackgroundParticles";

// --- CONSTANTS ---
const CAMERA_POSITION = [0.0148, 0.2411, -0.5288];
const CAMERA_TARGET = [0.0126, 0.2119, 0.0011];
const TV_MODEL_PATH = "/crt_tv.glb";

// --- DRAG CONTROLLER ---
function DragController({
  objects,
  view,
  onDragStart,
  onDrag,
  onDragEnd,
  cameraControlsRef,
}) {
  const { camera, gl, raycaster } = useThree();
  const state = useRef({
    isDragging: false,
    obj: null,
    startPos: new THREE.Vector3(),
    plane: new THREE.Plane(),
    offset: new THREE.Vector3(),
  });

  useEffect(() => {
    const onPointerDown = (e) => {
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(objects, false);
      if (hits.length) {
        e.stopPropagation();
        const hit = hits[0];
        state.current.isDragging = true;
        state.current.obj = hit.object;
        state.current.startPos.copy(hit.object.position);

        switch (view) {
          case "top":
            state.current.plane.set(
              new THREE.Vector3(0, 1, 0),
              -state.current.startPos.y,
            );
            break;
          case "side":
            state.current.plane.set(
              new THREE.Vector3(1, 0, 0),
              -state.current.startPos.x,
            );
            break;
          default:
            state.current.plane.set(
              new THREE.Vector3(0, 0, 1),
              -state.current.startPos.z,
            );
        }

        const intersect = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(state.current.plane, intersect)) {
          state.current.offset.copy(intersect).sub(state.current.startPos);
        }

        onDragStart(state.current.obj);
      }
    };
    const onPointerMove = (e) => {
      if (!state.current.isDragging) return;
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const intersect = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(state.current.plane, intersect)) {
        const pos = intersect.sub(state.current.offset);

        switch (view) {
          case "front":
            state.current.obj.position.x = pos.x;
            state.current.obj.position.y = pos.y;
            break;
          case "top":
            state.current.obj.position.x = pos.x;
            state.current.obj.position.z = pos.z;
            break;
          case "side":
            state.current.obj.position.y = pos.y;
            state.current.obj.position.z = pos.z;
            break;
          default:
            break;
        }
        onDrag(state.current.obj);
      }
    };
    const onPointerUp = () => {
      if (state.current.isDragging) {
        state.current.isDragging = false;
        onDragEnd(state.current.obj);
        state.current.obj = null;
      }
    };

    gl.domElement.addEventListener("pointerdown", onPointerDown);
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("pointerup", onPointerUp);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    objects,
    view,
    onDragStart,
    onDrag,
    onDragEnd,
    cameraControlsRef,
    camera,
    gl,
    raycaster,
  ]);

  return null;
}

// --- TV MODEL WITH FALLBACK ---
function TV() {
  const { scene } = useGLTF(TV_MODEL_PATH);

  // ✅ FIX: Disable dynamic lighting effects on the TV for better visibility
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // Make the material self-illuminating to remove shadows/reflections
        child.material.emissive = new THREE.Color(0xffffff); // Set to white
        child.material.emissiveIntensity = 0.1; // A low intensity to make it visible but not glowing
        child.material.needsUpdate = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}
function TVFallback() {
  return (
    <group>
      <mesh position={[0, 0, -0.02]}>
        {" "}
        <boxGeometry args={[0.3, 0.2, 0.04]} />{" "}
        <meshStandardMaterial color="#2a2a2a" />{" "}
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        {" "}
        <planeGeometry args={[0.25, 0.15]} />{" "}
        <meshStandardMaterial color="#000" />{" "}
      </mesh>
    </group>
  );
}

// --- MAPPER ---
function Mapper({
  view,
  anchors,
  handles,
  setAnchors,
  setHandles,
  cameraControlsRef,
}) {
  const handleOffsets = useRef([]);

  const curves = useMemo(
    () => [
      new THREE.CubicBezierCurve3(
        anchors[0],
        handles[0],
        handles[1],
        anchors[1],
      ),
      new THREE.CubicBezierCurve3(
        anchors[1],
        handles[2],
        handles[3],
        anchors[2],
      ),
      new THREE.CubicBezierCurve3(
        anchors[2],
        handles[4],
        handles[5],
        anchors[3],
      ),
      new THREE.CubicBezierCurve3(
        anchors[3],
        handles[6],
        handles[7],
        anchors[0],
      ),
    ],
    [anchors, handles],
  );

  const draggableObjects = useMemo(() => {
    const objs = [];
    const aGeo = new THREE.SphereGeometry(0.005, 16, 16);
    const hGeo = new THREE.SphereGeometry(0.0025, 16, 16);
    const aMat = new THREE.MeshBasicMaterial({
      color: "white",
      toneMapped: false,
    });
    const hMat = new THREE.MeshBasicMaterial({
      color: "cyan",
      toneMapped: false,
    });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(aGeo, aMat);
      m.userData = { type: "anchor", index: i };
      objs.push(m);
    }
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(hGeo, hMat);
      m.userData = { type: "handle", index: i };
      objs.push(m);
    }
    return objs;
  }, []);

  useEffect(() => {
    draggableObjects.forEach((obj, i) => {
      if (i < 4) obj.position.copy(anchors[i]);
      else obj.position.copy(handles[i - 4]);
    });
  }, [anchors, handles, draggableObjects]);

  const onDragStart = (obj) => {
    if (obj.userData.type === "anchor") {
      const i = obj.userData.index;
      handleOffsets.current = [
        handles[i * 2].clone().sub(anchors[i]),
        handles[(i * 2 - 1 + 8) % 8].clone().sub(anchors[i]),
      ];
    }
  };

  const onDrag = (obj) => {
    const { type, index } = obj.userData;
    const pos = obj.position;
    const newAnchors = anchors.map((a) => a.clone());
    const newHandles = handles.map((h) => h.clone());
    if (type === "anchor") {
      newAnchors[index].copy(pos);
      newHandles[index * 2].copy(pos).add(handleOffsets.current[0]);
      newHandles[(index * 2 - 1 + 8) % 8]
        .copy(pos)
        .add(handleOffsets.current[1]);
    } else {
      newHandles[index].copy(pos);
    }
    setAnchors(newAnchors);
    setHandles(newHandles);
  };

  return (
    <group>
      <Suspense fallback={<TVFallback />}>
        <TV />
      </Suspense>
      {curves.map((c, i) => (
        <Line key={i} points={c.getPoints(20)} color="#00ff00" lineWidth={2} />
      ))}
      {anchors.map((a, i) => (
        <React.Fragment key={i}>
          <Line points={[a, handles[i * 2]]} color="cyan" lineWidth={1} />
          <Line
            points={[a, handles[(i * 2 - 1 + 8) % 8]]}
            color="cyan"
            lineWidth={1}
          />
        </React.Fragment>
      ))}
      {draggableObjects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      <DragController
        objects={draggableObjects}
        view={view}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={() => {}}
        cameraControlsRef={cameraControlsRef}
      />
    </group>
  );
}

// --- VIEW-SPECIFIC RENDERERS ---
function FrontView({ anchors, handles, setAnchors, setHandles }) {
  const cameraRef = useRef();
  useLayoutEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.lookAt(new THREE.Vector3(...CAMERA_TARGET));
    }
  }, []);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={CAMERA_POSITION}
        fov={50}
      />
      <Mapper
        view="front"
        anchors={anchors}
        handles={handles}
        setAnchors={setAnchors}
        setHandles={setHandles}
        cameraControlsRef={null}
      />
    </>
  );
}

function OrthoView({ view, anchors, handles, setAnchors, setHandles }) {
  const cameraControlsRef = useRef();
  useLayoutEffect(() => {
    const ctrl = cameraControlsRef.current;
    if (!ctrl) return;
    if (view === "top") {
      ctrl.setLookAt(0, 1, 0, 0, 0, 0, false);
    } else {
      // side
      ctrl.setLookAt(1, 0, 0, 0, 0, 0, false);
    }
  }, [view]);

  return (
    <>
      <OrthographicCamera makeDefault zoom={500} position={[0, 1, 0]} />
      <CameraControls
        ref={cameraControlsRef}
        enablePan={false}
        enableRotate={false}
        enableZoom={true}
      />
      <Mapper
        view={view}
        anchors={anchors}
        handles={handles}
        setAnchors={setAnchors}
        setHandles={setHandles}
        cameraControlsRef={cameraControlsRef}
      />
    </>
  );
}

// --- MAIN ---
export function DebugApp() {
  const [view, setView] = useState("front");

  const initialZ = -0.1;
  const [anchors, setAnchors] = useState(() => [
    new THREE.Vector3(-0.1, 0.1, initialZ),
    new THREE.Vector3(0.1, 0.1, initialZ),
    new THREE.Vector3(0.1, -0.1, initialZ),
    new THREE.Vector3(-0.1, -0.1, initialZ),
  ]);
  const [handles, setHandles] = useState(() => {
    const a = [
      new THREE.Vector3(-0.1, 0.1, initialZ),
      new THREE.Vector3(0.1, 0.1, initialZ),
      new THREE.Vector3(0.1, -0.1, initialZ),
      new THREE.Vector3(-0.1, -0.1, initialZ),
    ];
    const h = [];
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      h.push(a[i].clone().lerp(a[next], 0.33));
      h.push(a[next].clone().lerp(a[i], 0.33));
    }
    return h;
  });

  useEffect(() => {
    const log = (e) => {
      if (e.key === "p") {
        console.clear();
        console.log(
          "Anchors:",
          JSON.stringify(
            anchors.map((p) => [
              +p.x.toFixed(4),
              +p.y.toFixed(4),
              +p.z.toFixed(4),
            ]),
          ),
        );
        console.log(
          "Handles:",
          JSON.stringify(
            handles.map((p) => [
              +p.x.toFixed(4),
              +p.y.toFixed(4),
              +p.z.toFixed(4),
            ]),
          ),
        );
      }
    };
    window.addEventListener("keydown", log);
    return () => window.removeEventListener("keydown", log);
  }, [anchors, handles]);

  return (
    <main
      className="w-screen h-screen bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/assets/background.jpg')",
        backgroundSize: "146%",
        backgroundPosition: "52% 21%",
      }}
    >
      <div className="w-full h-full bg-black bg-opacity-50 relative">
        <div className="absolute top-4 left-4 z-10 bg-gray-800 bg-opacity-90 p-4 rounded-lg text-white font-mono text-sm w-80">
          <h3 className="text-lg font-bold mb-2">UI Pen Tool</h3>
          <div className="flex space-x-2 mb-2">
            {["front", "top", "side"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 py-1 rounded ${view === v ? "bg-blue-500" : "bg-gray-600 hover:bg-blue-500"}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            - Drag points to shape the mesh.
            <br />- Use scroll wheel to zoom.
            <br />- Pan/Rotate are disabled.
            <br />- Press 'p' to log coords.
          </p>
        </div>
        <Canvas flat>
          <ambientLight intensity={0.5} />
          <directionalLight position={[0, 0, 5]} intensity={0.5} />
          <BackgroundParticles />
          <gridHelper args={[2, 20]} />
          {view === "front" ? (
            <FrontView
              anchors={anchors}
              handles={handles}
              setAnchors={setAnchors}
              setHandles={setHandles}
            />
          ) : (
            <OrthoView
              view={view}
              anchors={anchors}
              handles={handles}
              setAnchors={setAnchors}
              setHandles={setHandles}
            />
          )}
        </Canvas>
      </div>
    </main>
  );
}
