import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";

import Scene from "./components/Scene";
import WarpedScreen from "./components/WarpedScreen"; // Import the correct component

const CAMERA_POSITION = [0.0148, 0.2411, -0.5288];
const CAMERA_TARGET = [0.0126, 0.2119, 0.0011];

function App() {
  // --- PERMANENT LOGGING ---
  console.log("[App LOG] Component rendering.");
  // -------------------------

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
        <Canvas
          flat
          dpr={[1, 1]}
          gl={{
            powerPreference: "low-power",
            antialias: false,
            stencil: false,
            depth: true,
          }}
        >
          <PerspectiveCamera
            makeDefault
            position={CAMERA_POSITION}
            fov={50}
            onUpdate={(c) => c.lookAt(...CAMERA_TARGET)}
          />
          <Suspense fallback={null}>
            <Scene onReady={() => {}} />
            <WarpedScreen zOffset={0} />
          </Suspense>
        </Canvas>
      </div>
    </main>
  );
}

export default App;
