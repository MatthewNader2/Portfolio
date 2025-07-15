// frontend/src/components/BackgroundParticles.jsx

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function BackgroundParticles({ count = 500 }) {
  const meshRef = useRef();
  const lightRef = useRef();

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const time = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const x = (Math.random() - 0.5) * 25;
      const y = (Math.random() - 0.5) * 25;
      const z = (Math.random() - 0.5) * 15;
      temp.push({ time, factor, speed, x, y, z });
    }
    return temp;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    particles.forEach((particle, index) => {
      let { factor, speed, x, y, z } = particle;
      const t = (particle.time += speed);
      dummy.position.set(
        x + Math.cos(t) + Math.sin(t * 1) / 10,
        y + Math.sin(t) + Math.cos(t * 2) / 10,
        z + Math.cos(t) + Math.sin(t * 3) / 10,
      );
      const s = Math.cos(t);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* Light is now brighter and more yellow */}
      <pointLight ref={lightRef} distance={50} intensity={25} color="#FFFFE0" />

      <instancedMesh ref={meshRef} args={[null, null, count]}>
        <dodecahedronGeometry args={[0.015, 0]} />
        {/* Material is now emissive yellow to make it glow */}
        <meshStandardMaterial
          color="#FFFFE0"
          emissive="#FFFFE0"
          emissiveIntensity={2}
          roughness={0.2}
          metalness={0.5}
        />
      </instancedMesh>
    </>
  );
}
