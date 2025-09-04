// frontend/src/components/WarpedScreen.jsx

import React, { useMemo, useEffect } from "react";
import * as THREE from "three";

// --- Data remains the same ---
const anchorsData = [
  [-0.1949, 0.4158, -0.0016],
  [0.1953, 0.4148, -0.0039],
  [0.1954, 0.1249, -0.0022],
  [-0.1957, 0.1239, 0.0007],
];
const handlesData = [
  [-0.1221, 0.4225, -0.0016],
  [0.1134, 0.4238, -0.0039],
  [0.1986, 0.3473, -0.0039],
  [0.1987, 0.1922, -0.0022],
  [0.1216, 0.1171, -0.0022],
  [-0.154, 0.1185, 0.0007],
  [-0.2011, 0.1914, 0.0007],
  [-0.1984, 0.3542, -0.0016],
];
const anchors = anchorsData.map((p) => new THREE.Vector3(...p));
const handles = handlesData.map((p) => new THREE.Vector3(...p));

export default function WarpedScreen({ onGeometryReady }) {
  const warpedGeometry = useMemo(() => {
    // ... (geometry calculation is correct and remains the same)
    const topCurve = new THREE.CubicBezierCurve3(
      anchors[0],
      handles[0],
      handles[1],
      anchors[1],
    );
    const bottomCurve = new THREE.CubicBezierCurve3(
      anchors[3],
      handles[5],
      handles[4],
      anchors[2],
    );
    const divisions = 30;
    const vertices = [];
    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const p1 = topCurve.getPoint(t);
      const p2 = bottomCurve.getPoint(t);
      for (let j = 0; j <= divisions; j++) {
        const v = j / divisions;
        const p = p1.clone().lerp(p2, v);
        vertices.push(p.x, p.y, p.z);
      }
    }
    const indices = [];
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        const a = i * (divisions + 1) + j;
        const b = i * (divisions + 1) + (j + 1);
        const c = (i + 1) * (divisions + 1) + j;
        const d = (i + 1) * (divisions + 1) + (j + 1);
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geom.setIndex(indices);
    return geom;
  }, []);

  useEffect(() => {
    if (warpedGeometry) {
      onGeometryReady(warpedGeometry);
    }
    return () => warpedGeometry.dispose();
  }, [warpedGeometry, onGeometryReady]);

  // --- FIX: Make the mesh completely invisible ---
  return (
    <mesh geometry={warpedGeometry}>
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}
