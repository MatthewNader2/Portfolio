import { useMemo, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer";

// This component creates a parallel CSS3D scene that hosts the iframe.
export function Css3dRenderer({ warpedGeometry }) {
  const { scene, camera, size } = useThree(); // Get the main WebGL scene camera and size

  // Memoize the CSS3DRenderer and its scene to prevent re-creation
  const { cssScene, cssRenderer } = useMemo(() => {
    const cssScene = new THREE.Scene();
    const cssRenderer = new CSS3DRenderer();
    return { cssScene, cssRenderer };
  }, []);

  // Setup the renderer on mount
  useEffect(() => {
    cssRenderer.setSize(size.width, size.height);
    cssRenderer.domElement.style.position = "absolute";
    cssRenderer.domElement.style.top = "0px";
    cssRenderer.domElement.style.pointerEvents = "none"; // Only iframe should be interactive
    document.body.appendChild(cssRenderer.domElement);

    return () => {
      document.body.removeChild(cssRenderer.domElement);
    };
  }, [cssRenderer, size]);

  // Create and position the CSS3DObject (the iframe)
  useEffect(() => {
    if (!warpedGeometry) return;

    // Create the iframe element
    const iframe = document.createElement("iframe");
    iframe.src = "/terminal.html"; // Point to your standalone terminal app
    iframe.style.width = "1024px"; // Resolution of the content
    iframe.style.height = "768px";
    iframe.style.border = "none";
    iframe.style.pointerEvents = "auto"; // Make the iframe interactive

    const object = new CSS3DObject(iframe);

    // Calculate the center of the warped mesh to position the iframe
    warpedGeometry.computeBoundingBox();
    const center = new THREE.Vector3();
    warpedGeometry.boundingBox.getCenter(center);
    object.position.copy(center);

    // IMPORTANT: Match the scale and rotation of the TV screen mesh if needed.
    // For now, we assume the geometry is already in world space.
    // object.scale.copy(your_mesh.scale)
    // object.rotation.copy(your_mesh.rotation)

    cssScene.add(object);

    return () => {
      cssScene.remove(object);
    };
  }, [cssScene, warpedGeometry]);

  // On every frame, synchronize the cameras and render the CSS3D scene
  useFrame(() => {
    cssRenderer.render(cssScene, camera);
  });

  return null; // This component doesn't render anything to the React tree
}
