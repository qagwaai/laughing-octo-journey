/**
 * Planet texture bake service.
 *
 * Prefers a GPU render-target bake and falls back to the CPU reference when
 * WebGL2 is unavailable. The splash already supports WebGL2-less environments,
 * so the fallback is a real runtime path rather than a test-only oracle.
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  GLSL3,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  type Texture,
  UnsignedByteType,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { derivePlanetClimate, type PlanetArchetype, type PlanetClimate } from '../../model/planet/planet-seed';
import {
  PLANET_LOD,
  type PlanetLodPreset,
  type PlanetLodTier,
  rasterizePlanet,
} from '../../model/planet/planet-texture';
import {
  buildPlanetShaderUniforms,
  PLANET_BAKE_MODE_ALBEDO,
  PLANET_BAKE_MODE_MATERIAL,
  PLANET_BAKE_MODE_NORMAL,
  PLANET_FRAGMENT_SHADER,
  PLANET_VERTEX_SHADER,
} from './planet-shader';

export type PlanetBakeSource = 'gpu' | 'cpu';

export interface PlanetBakeResult {
  albedo: Texture;
  normal?: Texture;
  /** Roughness in green, metalness in blue. */
  material?: Texture;
  source: PlanetBakeSource;
  climate: PlanetClimate;
  dispose(): void;
}

export interface PlanetBakeOptions {
  bodyId: string;
  tier?: PlanetLodTier;
  /** Overrides the tier preset. Lets callers pick a bespoke size and keeps tests off the expensive L1 raster. */
  preset?: PlanetLodPreset;
  archetype?: PlanetArchetype;
  renderer?: WebGLRenderer | null;
}

export function supportsGpuBake(renderer?: WebGLRenderer | null): renderer is WebGLRenderer {
  if (!renderer) return false;
  if (typeof WebGL2RenderingContext === 'undefined') return false;

  const context = renderer.getContext?.();
  return context instanceof WebGL2RenderingContext;
}

function applyAlbedoSettings(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
}

/** Normal and roughness/metalness maps are data, not colour, so they must stay linear. */
function applyLinearSettings(texture: Texture): void {
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
}

function renderPlanetPass(
  renderer: WebGLRenderer,
  climate: PlanetClimate,
  mode: number,
  width: number,
  height: number,
): WebGLRenderTarget {
  const target = new WebGLRenderTarget(width, height, {
    format: RGBAFormat,
    type: UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
  });

  const values = buildPlanetShaderUniforms(climate, mode, width, height);
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: PLANET_VERTEX_SHADER,
    fragmentShader: PLANET_FRAGMENT_SHADER,
    uniforms: {
      uSeedLo: { value: values.uSeedLo },
      uSeedHi: { value: values.uSeedHi },
      uSeaLevel: { value: values.uSeaLevel },
      uOceanSpan: { value: values.uOceanSpan },
      uLandSpan: { value: values.uLandSpan },
      uIceLatitudeDeg: { value: values.uIceLatitudeDeg },
      uContinentFrequency: { value: values.uContinentFrequency },
      uWarpStrength: { value: values.uWarpStrength },
      uMountainAmplitude: { value: values.uMountainAmplitude },
      uAridity: { value: values.uAridity },
      uHueBias: { value: values.uHueBias },
      uMode: { value: values.uMode },
      uTexel: { value: [values.uTexel[0], values.uTexel[1]] },
    },
  });

  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));

  const previousTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
  } finally {
    renderer.setRenderTarget(previousTarget);
    geometry.dispose();
    material.dispose();
  }

  return target;
}

function bakeOnGpu(renderer: WebGLRenderer, climate: PlanetClimate, preset: PlanetLodPreset): PlanetBakeResult {
  const albedoTarget = renderPlanetPass(renderer, climate, PLANET_BAKE_MODE_ALBEDO, preset.width, preset.height);
  applyAlbedoSettings(albedoTarget.texture);

  const detailWidth = Math.max(1, Math.round(preset.width * preset.normalScale));
  const detailHeight = Math.max(1, Math.round(preset.height * preset.normalScale));

  let normalTarget: WebGLRenderTarget | undefined;
  if (preset.includeNormal) {
    normalTarget = renderPlanetPass(renderer, climate, PLANET_BAKE_MODE_NORMAL, detailWidth, detailHeight);
    applyLinearSettings(normalTarget.texture);
  }

  let materialTarget: WebGLRenderTarget | undefined;
  if (preset.includeMaterial) {
    materialTarget = renderPlanetPass(renderer, climate, PLANET_BAKE_MODE_MATERIAL, detailWidth, detailHeight);
    applyLinearSettings(materialTarget.texture);
  }

  return {
    albedo: albedoTarget.texture,
    normal: normalTarget?.texture,
    material: materialTarget?.texture,
    source: 'gpu',
    climate,
    dispose: () => {
      albedoTarget.dispose();
      normalTarget?.dispose();
      materialTarget?.dispose();
    },
  };
}

function bakeOnCpu(climate: PlanetClimate, preset: PlanetLodPreset): PlanetBakeResult {
  const raster = rasterizePlanet(climate, preset);

  const albedo = new DataTexture(raster.albedo, raster.width, raster.height, RGBAFormat, UnsignedByteType);
  applyAlbedoSettings(albedo);
  albedo.needsUpdate = true;

  let normal: DataTexture | undefined;
  if (raster.normal && raster.normalWidth && raster.normalHeight) {
    normal = new DataTexture(raster.normal, raster.normalWidth, raster.normalHeight, RGBAFormat, UnsignedByteType);
    applyLinearSettings(normal);
    normal.needsUpdate = true;
  }

  let material: DataTexture | undefined;
  if (raster.material && raster.normalWidth && raster.normalHeight) {
    material = new DataTexture(raster.material, raster.normalWidth, raster.normalHeight, RGBAFormat, UnsignedByteType);
    applyLinearSettings(material);
    material.needsUpdate = true;
  }

  return {
    albedo,
    normal,
    material,
    source: 'cpu',
    climate,
    dispose: () => {
      albedo.dispose();
      normal?.dispose();
      material?.dispose();
    },
  };
}

export function bakePlanetTextures(options: PlanetBakeOptions): PlanetBakeResult {
  const preset = options.preset ?? PLANET_LOD[options.tier ?? 'l0'];
  const climate = derivePlanetClimate(options.bodyId, options.archetype ?? 'terran');

  return supportsGpuBake(options.renderer) ? bakeOnGpu(options.renderer, climate, preset) : bakeOnCpu(climate, preset);
}
