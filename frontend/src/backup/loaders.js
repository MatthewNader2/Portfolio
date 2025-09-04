import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useThree } from "@react-three/fiber";

export function KTX2Config() {
  const { gl } = useThree();

  if (!GLTFLoader.hasKTX2Loader) {
    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/");
    ktx2Loader.detectSupport(gl);

    GLTFLoader.setKTX2Loader(ktx2Loader);
    GLTFLoader.setMeshoptDecoder(MeshoptDecoder);

    GLTFLoader.hasKTX2Loader = true;
  }

  return null;
}
