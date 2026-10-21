import { Box3, Group, Vector3, type WebGLRenderer } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { disposeSplashObject } from '../splash-composition';

/** Centers the model and fits its largest dimension to a diameter of two. */
export function normalizeStationModel(model: Group): Group {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('Station model has invalid bounds.');
  model.position.sub(bounds.getCenter(new Vector3()));
  const root = new Group();
  root.name = 'dedicated-station-model';
  root.add(model);
  root.scale.setScalar(2 / extent);
  return root;
}

export async function loadStationModel(url: string, renderer: WebGLRenderer): Promise<Group> {
  const ktx = new KTX2Loader().setTranscoderPath('decoders/basis/').detectSupport(renderer);
  try {
    const loader = new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    try {
      return normalizeStationModel(gltf.scene);
    } catch (error) {
      disposeSplashObject(gltf.scene);
      throw error;
    }
  } finally {
    ktx.dispose();
  }
}
