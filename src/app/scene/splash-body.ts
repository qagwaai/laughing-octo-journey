/**
 * Builds the celestial body shown behind the mining rig, independently of the
 * rig and debris so the overlay picker can swap it in place.
 */
import {
  ClampToEdgeWrapping,
  ConeGeometry,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type WebGLRenderer,
} from 'three';
import type { GasGiantHandle } from './gas-giant/gas-giant';
import type { GasGiantPaletteChoice, GasGiantRingChoice } from './gas-giant/gas-giant-settings';
import { createSplashGasGiant } from './gas-giant/splash-gas-giant';
import { createSplashPlanetMesh, disposeSplashObject } from './splash-composition';
import type { SplashQuality } from './splash-state';
import { type CatalogPlanetSurfaceResult, loadCatalogSurface } from './planet/catalog-surface-loader';
import { createTitanHazeTexture, resolveVenusAtmosphereUrl } from './planet/planet-atmosphere';
import { createPlanetCloudStormMaterial, type PlanetCloudStormMaterial } from './planet/planet-cloud-storms';
import { createPlanetCloudTexture, type PlanetCloudStyle, type PlanetCloudTexture } from './planet/planet-clouds';
import { resolveCatalogPlanetSurfaceAsset } from './planet/planet-surface-catalog';
import { createIoVolcanicCues } from './planet/planet-volcanism-layer';
import { bakeSplashPlanet } from './planet/splash-planet';
import { resolveSplashAppearance, solBodyHasClouds, type SplashPlanetEntry } from './planet/splash-planet-rotation';
import { createSplashStar } from './star/splash-star';
import type { StarHandle } from './star/star';

const SPLASH_BODY_RADIUS = 4;
const CLOUD_SHELL_SCALE = 1.012;

/** A snapshot of the overlay settings a new body is built with. */
export interface SplashBodySettings {
  cloudsEnabled: boolean;
  cloudStyle: PlanetCloudStyle;
  cloudCoverage: number;
  stormActivity: number;
  giantPalette: GasGiantPaletteChoice;
  giantRings: GasGiantRingChoice;
  /** Already resolved against the entry's seeded class. */
  starClass: string | null;
  flareActivity: number;
}

export interface SplashBodyOptions {
  quality: SplashQuality;
  renderer?: WebGLRenderer | null;
  settings: SplashBodySettings;
}

/** Mutable so the splash's settings effects can rebuild giants, stars and cloud layers in place. */
export interface SplashBody {
  readonly entry: SplashPlanetEntry;
  object: Object3D;
  giant?: GasGiantHandle;
  giantLook?: string;
  star?: StarHandle;
  starClass?: string | null;
  clouds?: PlanetCloudTexture;
  cloudStorm?: PlanetCloudStormMaterial;
  cloudMesh?: Mesh<SphereGeometry, MeshStandardMaterial>;
  cloudStyle?: PlanetCloudStyle;
  dispose(): void;
}

export async function createSplashBody(
  entry: SplashPlanetEntry,
  options: SplashBodyOptions,
): Promise<SplashBody> {
  const { quality, settings } = options;
  if (entry.kind === 'gas-giant' || entry.id === 'sol-saturn') {
    const appearance = resolveSplashAppearance(entry);
    const giant = createSplashGasGiant({
      bodyId: entry.id,
      surfaceArchetype:
        appearance.valid && appearance.input.surfaceArchetype === 'ice-giant' ? 'ice-giant' : 'gas-giant',
      quality,
      palette: settings.giantPalette,
      rings: settings.giantRings,
      stormActivity: settings.stormActivity,
    });
    const body: SplashBody = {
      entry,
      object: giant.group,
      giant,
      giantLook: `${settings.giantPalette}|${settings.giantRings}`,
      dispose: () => {
        body.giant?.group.removeFromParent();
        body.giant?.dispose();
      },
    };
    return body;
  }
  if (entry.kind === 'star') {
    const star = createSplashStar({
      bodyId: entry.id,
      spectralClass: settings.starClass,
      quality,
      flareActivity: settings.flareActivity,
    });
    const body: SplashBody = {
      entry,
      object: star.group,
      star,
      starClass: settings.starClass,
      dispose: () => {
        body.star?.group.removeFromParent();
        body.star?.dispose();
      },
    };
    return body;
  }
  if (entry.kind === 'sol') return createSolBody(entry, options);

  const appearance = resolveSplashAppearance(entry);
  if (!appearance.valid) throw new Error('Splash demo has no valid surface archetype.');
  const bake = bakeSplashPlanet(quality, options.renderer, entry.id, appearance.input.surfaceArchetype);
  const mesh = createSplashPlanetMesh(bake.albedo, bake.normal, bake.material);
  if (entry.kind === 'icy-moon' || entry.kind === 'rocky-moon') {
    mesh.name = entry.id;
    return plainBody(entry, mesh, () => bake.dispose());
  }
  // disposeSplashObject only releases the texture; the GPU bake also owns a render target.
  return withClouds(entry, mesh, options, () => bake.dispose());
}

async function createSolBody(entry: SplashPlanetEntry, options: SplashBodyOptions): Promise<SplashBody> {
  const key = entry.solKey;
  if (key === 'venus' || key === 'titan') {
    const texture = key === 'venus' ? await loadVenusTexture() : createTitanTexture(options.quality);
    const mesh = createSplashPlanetMesh(texture);
    mesh.name = `sol-${key}`;
    return plainBody(entry, mesh);
  }
  const asset = resolveCatalogPlanetSurfaceAsset(key ? { namespace: 'sol', key } : null);
  if (!asset) throw new Error(`No catalog imagery for splash body ${entry.id}.`);
  // The 'low' catalog tier (2048 x 1024 albedo) matches the procedural standard bake; 4K is viewer-only.
  const surface: CatalogPlanetSurfaceResult = await loadCatalogSurface({
    key: `splash|${asset.assetVersion}|low`,
    bodyId: entry.id,
    identity: asset.identity,
    asset,
    tier: 'l1',
    variant: 'low',
    estimatedBytes: 0,
  });
  const mesh = createSplashPlanetMesh(surface.albedo, surface.normal);
  mesh.name = `sol-${key}`;
  if ('volcanism' in asset && asset.volcanism === 'io') mesh.add(createIoVolcanicCueGroup(options.quality));
  if (solBodyHasClouds(key)) return withClouds(entry, mesh, options, () => surface.dispose());
  return plainBody(entry, mesh, () => surface.dispose());
}

function plainBody(entry: SplashPlanetEntry, mesh: Object3D, release?: () => void): SplashBody {
  return {
    entry,
    object: mesh,
    dispose: () => {
      mesh.removeFromParent();
      disposeSplashObject(mesh);
      release?.();
    },
  };
}

function withClouds(
  entry: SplashPlanetEntry,
  mesh: Mesh,
  { quality, settings }: SplashBodyOptions,
  release: () => void,
): SplashBody {
  const clouds = createPlanetCloudTexture(
    entry.id,
    quality === 'standard' ? 512 : 256,
    quality === 'standard' ? 256 : 128,
    settings.cloudStyle,
  );
  clouds.setCoverage(settings.cloudCoverage);
  const cloudStorm = createPlanetCloudStormMaterial(entry.id, settings.cloudStyle, clouds.texture);
  cloudStorm.setActivity(settings.stormActivity);
  const cloudMesh = new Mesh(new SphereGeometry(SPLASH_BODY_RADIUS * CLOUD_SHELL_SCALE, 64, 48), cloudStorm.material);
  cloudMesh.visible = settings.cloudsEnabled;
  mesh.add(cloudMesh);
  const body: SplashBody = {
    entry,
    object: mesh,
    clouds,
    cloudStorm,
    cloudMesh,
    cloudStyle: settings.cloudStyle,
    dispose: () => {
      mesh.removeFromParent();
      // The style effect may have replaced the cloud layer, so release the current one explicitly.
      body.cloudMesh?.material.dispose();
      body.clouds?.texture.dispose();
      disposeSplashObject(mesh);
      release();
    },
  };
  return body;
}

async function loadVenusTexture(): Promise<Texture> {
  const texture = await new TextureLoader().loadAsync(resolveVenusAtmosphereUrl('overview'));
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createTitanTexture(quality: SplashQuality): Texture {
  return quality === 'standard' ? createTitanHazeTexture(512, 256) : createTitanHazeTexture(256, 128);
}

/** Imperative twin of PlanetVolcanismLayer for the splash, which has no Angular Three template. */
export function createIoVolcanicCueGroup(quality: SplashQuality): Group {
  const group = new Group();
  group.name = 'Io volcanic cues';
  for (const cue of createIoVolcanicCues(SPLASH_BODY_RADIUS, quality === 'standard' ? 'detail' : 'overview')) {
    const cueGroup = new Group();
    cueGroup.name = `Io volcanic cue ${cue.id}`;
    cueGroup.position.fromArray(cue.position);
    cueGroup.rotation.copy(new Euler(...cue.rotation));
    const halo = new Mesh(
      new SphereGeometry(1, cue.sphereSegments, cue.sphereSegments),
      new MeshBasicMaterial({
        color: '#ff672d',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.position.set(0, cue.haloThickness / 2, 0);
    halo.scale.set(cue.haloRadius, cue.haloThickness, cue.haloRadius);
    halo.renderOrder = 3;
    const hotspot = new Mesh(
      new SphereGeometry(cue.hotspotRadius, cue.sphereSegments, cue.sphereSegments),
      new MeshBasicMaterial({ color: '#ffad47', toneMapped: false }),
    );
    hotspot.position.set(0, cue.hotspotRadius * 0.3, 0);
    hotspot.renderOrder = 4;
    const plume = new Mesh(
      new ConeGeometry(cue.plumeRadius, cue.plumeHeight, cue.plumeSegments, 1),
      new MeshBasicMaterial({
        color: '#ffc66e',
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    plume.position.set(0, cue.plumeHeight / 2, 0);
    plume.renderOrder = 4;
    cueGroup.add(halo, hotspot, plume);
    group.add(cueGroup);
  }
  return group;
}
