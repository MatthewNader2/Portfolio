import React, { Suspense, useState, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { BackgroundParticles } from "./BackgroundParticles";
import * as THREE from "three";

const TV_MODEL_PATH = "/crt_tv_basis.glb";

function Model({ onReady }) {
  const [scene, setScene] = useState(null);
  const { gl } = useThree();

  useEffect(() => {
    const loader = new GLTFLoader();
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath("/basis/");
    ktx2Loader.detectSupport(gl);
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);
    let isMounted = true;

    console.log("[Model LOG] Starting to load GLB model...");

    loader.load(
      TV_MODEL_PATH,
      (gltf) => {
        console.log(
          "[Model LOG] SUCCESS: GLB model loaded. Traversing meshes to apply material...",
        );
        if (isMounted) {
          gltf.scene.traverse((child) => {
            if (child.isMesh && child.material) {
              const oldMaterial = child.material;
              const newMaterial = new THREE.MeshBasicMaterial({
                map: oldMaterial.map,
                aoMap: oldMaterial.aoMap,
              });
              child.material = newMaterial;
              oldMaterial.dispose();
              console.log(
                `[Model LOG] Applied 'MeshBasicMaterial' with aoMap to mesh '${child.name || "unnamed"}'.`,
              );
            }
          });
          setScene(gltf.scene);
          onReady();
        }
      },
      undefined,
      (error) =>
        console.error(
          "[Model LOG] ERROR: An error happened during model loading:",
          error,
        ),
    );

    return () => {
      isMounted = false;
      ktx2Loader.dispose();
      if (scene) {
        scene.traverse((object) => {
          if (object.isMesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
          }
        });
      }
    };
  }, [gl, onReady]);

  return scene ? <primitive object={scene} /> : null;
}

export default function Scene({ onReady }) {
  console.log("[Scene LOG] Component rendering.");
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight color="white" position={[0, 0, 5]} intensity={0.5} />
      <BackgroundParticles />
      <group position={[0, 0, 0]} scale={1}>
        <Suspense fallback={null}>
          <Model onReady={onReady} />
        </Suspense>
      </group>
    </>
  );
}
