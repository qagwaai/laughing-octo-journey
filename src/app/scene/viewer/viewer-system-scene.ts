import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  EventEmitter,
  input,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { BufferGeometry, Color, Euler, IcosahedronGeometry, Quaternion, Vector3 } from 'three';
import { isValidShipSpatial } from '../../model/math/spatial';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { coerceShipModel, type ShipSummary } from '../../model/ship-list';
import {
  VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X,
  VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z,
  VIEWER_SCENE_ACTIVE_SHIP_COLOR,
  VIEWER_SCENE_INACTIVE_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_POSITION,
  resolveAnchoredOrbitSceneProfile,
  isGateBody,
  isStarBody,
  isMarketStationBody,
  resolveBodyColor,
  resolveBodySceneRadius,
  resolveBodyScenePosition,
  resolveBodyOrbitalPositionRelativeToAnchor,
  resolveOrbitColor,
  resolveSceneDistanceFromKm,
} from './viewer-formatters';
import { ViewerShipMesh } from './viewer-ship-mesh';
import { resolveDescriptorRenderProfile, type DescriptorRenderProfile } from './viewer-descriptor-selectors';

type BodyGeometryKind = 'sphere' | 'box' | 'icosahedron' | 'octahedron' | 'capsule' | 'cylinder' | 'torus' | 'rock-deformed';

export interface ViewerSystemSceneInputs {
  bodies: ViewerBody[];
  summary: SolarSystemSummary | null;
  targetBodyId?: string | null;
  ships?: ShipSummary[];
  activeShipId?: string | null;
}

interface RenderedBody {
  source: ViewerBody;
  id: string;
  bodyType: string;
  displayName: string;
  color: string;
  radius: number;
  position: [number, number, number];
  isStar: boolean;
  isMarketStation: boolean;
  isGate: boolean;
  geometryKind: BodyGeometryKind;
  geometryScale: [number, number, number];
  geometryRotation: [number, number, number];
  geometryDetail: number;
  geometryTorusTubeRadius: number;
  geometrySegments: number;
  rockSeed: string | null;
  rockDisplacement: number;
  rockCraterCount: number;
  rockLobeStrength: number;
  rockMinRadiusRatio: number;
  materialColor: string;
  materialEmissive: string;
  materialEmissiveIntensity: number;
  materialRoughness: number;
  materialMetalness: number;
}

interface RenderedShip {
  id: string;
  model: string;
  displayName: string;
  color: string;
  recognitionDistanceKm: number;
  position: [number, number, number];
  isActive: boolean;
  isUnknownSpatial: boolean;
}

interface OrbitEllipse {
  id: string;
  center: [number, number, number];
  radiusX: number;
  radiusZ: number;
  rotation: [number, number, number];
  opacity: number;
  color: string;
  isMarketStation: boolean;
}

interface CameraTween {
  kind: 'default' | 'target-fly';
  elapsedSec: number;
  durationSec: number;
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
}

interface OrbitControlsLike {
  enabled?: boolean;
  minDistance?: number;
  maxDistance?: number;
  target: Vector3;
  update: () => void;
}

export interface ViewerSceneCameraDistanceRange {
  min: number;
  max: number;
}

const VIEWER_DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3.5, 28];
const VIEWER_CAMERA_TWEEN_DURATION_SEC = 0.45;
const VIEWER_TARGET_FLY_DURATION_SEC = 3.5;
const VIEWER_TARGET_FLY_COMPLETION_T = 0.985;
const VIEWER_CAMERA_DISTANCE_MIN_FLOOR = 0.5;
const VIEWER_CAMERA_DISTANCE_MAX_FLOOR = 42;
const VIEWER_CAMERA_DISTANCE_MAX_CEILING = 180;
const VIEWER_CAMERA_DISTANCE_MIN_MAX_GAP = 12;
const VIEWER_LOCAL_ASTEROID_VIEW_ZOOM_THRESHOLD = 22;
const VIEWER_LOCAL_ASTEROID_VIEW_RANGE_KM = 30_000;
const VIEWER_LOCAL_ASTEROID_VIEW_SCALE = 0.00006;

function degToRad(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isAsteroidBody(body: ViewerBody): boolean {
  return body.bodyType?.trim().toLowerCase() === 'asteroid';
}

function resolveLocalAsteroidProjectionWeight(zoomLevel: number | undefined): number {
  if (typeof zoomLevel !== 'number' || !Number.isFinite(zoomLevel)) {
    return 0;
  }

  if (zoomLevel >= VIEWER_LOCAL_ASTEROID_VIEW_ZOOM_THRESHOLD) {
    return 0;
  }

  return clamp(1 - zoomLevel / VIEWER_LOCAL_ASTEROID_VIEW_ZOOM_THRESHOLD, 0, 1);
}

function resolveScenePositionFromSpatialKm(positionKm: { x: number; y: number; z: number }): [number, number, number] {
  const magnitudeKm = Math.hypot(positionKm.x, positionKm.y, positionKm.z);
  if (magnitudeKm <= 0) {
    return [0, 0, 0];
  }

  const scaled = resolveSceneDistanceFromKm(magnitudeKm);
  return [
    +((positionKm.x / magnitudeKm) * scaled).toFixed(3),
    +((positionKm.y / magnitudeKm) * scaled).toFixed(3),
    +((positionKm.z / magnitudeKm) * scaled).toFixed(3),
  ];
}

function resolveRenderedExtent(rendered: RenderedBody[]): number {
  let maxExtent = 0;
  for (const body of rendered) {
    const bodyDistance = Math.hypot(body.position[0], body.position[1], body.position[2]);
    maxExtent = Math.max(maxExtent, bodyDistance + body.radius);
  }

  return Math.max(maxExtent, 24);
}

function resolveDefaultMaterialColor(body: ViewerBody, isGate: boolean, isMarketStation: boolean): string {
  if (body.bodyType === 'planet') {
    return '#ffffff';
  }
  if (isGate) {
    return '#7dd3fc';
  }
  if (isMarketStation) {
    return '#22c55e';
  }
  return resolveBodyColor(body);
}

function resolveDefaultMaterialEmissive(body: ViewerBody, isGate: boolean, isMarketStation: boolean): string {
  if (body.bodyType === 'planet') {
    return '#aab8d0';
  }
  if (isGate) {
    return '#0c4a6e';
  }
  if (isMarketStation) {
    return '#14532d';
  }
  return '#000000';
}

function resolveDefaultMaterialEmissiveIntensity(body: ViewerBody, isGate: boolean, isMarketStation: boolean): number {
  if (body.bodyType === 'planet') {
    return 0.2;
  }
  if (isGate) {
    return 0.22;
  }
  if (isMarketStation) {
    return 0.2;
  }
  return 0;
}

function createDeterministicSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  const mixed = Math.imul(seed ^ salt, 2246822519) >>> 0;
  return mixed / 0xffffffff;
}

function resolveBodyGeometryVariant(
  body: ViewerBody,
  descriptorProfile: DescriptorRenderProfile | null,
  isGate: boolean,
  isMarketStation: boolean,
): {
  kind: BodyGeometryKind;
  scale: [number, number, number];
  rotation: [number, number, number];
} {
  if (descriptorProfile) {
    if (descriptorProfile.domain === 'debris') {
      if (descriptorProfile.objectFamily === 'salvage-fragment') {
        return {
          kind: 'icosahedron',
          scale: [1.05, 0.8, 0.95],
          rotation: [0.22, 0.36, 0.18],
        };
      }
      if (descriptorProfile.objectFamily === 'wreckage-panel') {
        return {
          kind: 'box',
          scale: [1.9, 0.34, 1.2],
          rotation: [0.28, 0.16, 0.52],
        };
      }
      if (descriptorProfile.objectFamily === 'cargo-canister') {
        return {
          kind: 'capsule',
          scale: [0.9, 1.25, 0.9],
          rotation: [0.18, 0.54, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'field-shard') {
        return {
          kind: 'octahedron',
          scale: [0.88, 1.35, 0.88],
          rotation: [0.12, 0.42, 0.24],
        };
      }
    }

    if (descriptorProfile.domain === 'asteroids') {
      if (descriptorProfile.objectFamily === 'rocky-irregular') {
        return {
          kind: 'icosahedron',
          scale: [1.12, 0.84, 1.06],
          rotation: [0.16, 0.31, 0.22],
        };
      }
      if (descriptorProfile.objectFamily === 'metallic-cluster') {
        return {
          kind: 'octahedron',
          scale: [0.96, 1.08, 0.96],
          rotation: [0.26, 0.44, 0.12],
        };
      }
      if (descriptorProfile.objectFamily === 'icy-body') {
        return {
          kind: 'sphere',
          scale: [1, 1, 1],
          rotation: [0, 0, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'cinematic-hero') {
        return {
          kind: 'icosahedron',
          scale: [1.35, 0.9, 1.28],
          rotation: [0.34, 0.22, 0.43],
        };
      }
    }

    if (descriptorProfile.domain === 'stations') {
      if (descriptorProfile.objectFamily === 'trade-hub') {
        return {
          kind: 'box',
          scale: [1.65, 0.82, 1.65],
          rotation: [0, 0.14, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'refinery') {
        return {
          kind: 'cylinder',
          scale: [0.92, 1.5, 0.92],
          rotation: [0, 0.2, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'naval-outpost') {
        return {
          kind: 'octahedron',
          scale: [1.12, 1.48, 1.12],
          rotation: [0.1, 0.28, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'research-platform') {
        return {
          kind: 'torus',
          scale: [1.36, 1.36, 1.36],
          rotation: [Math.PI / 2, 0.3, 0],
        };
      }
    }

    if (descriptorProfile.domain === 'gates') {
      if (descriptorProfile.objectFamily === 'ring-gate') {
        return {
          kind: 'torus',
          scale: [1.8, 1.8, 1.8],
          rotation: [Math.PI / 2, 0, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'segmented-arch') {
        return {
          kind: 'torus',
          scale: [1.55, 1.55, 1.55],
          rotation: [Math.PI / 2, 0.34, 0],
        };
      }
      if (descriptorProfile.objectFamily === 'relay-spindle') {
        return {
          kind: 'cylinder',
          scale: [0.8, 2.1, 0.8],
          rotation: [0, 0.2, 0],
        };
      }
    }
  }

  if (isGate) {
    return {
      kind: 'torus',
      scale: [1.6, 1.6, 1.6],
      rotation: [Math.PI / 2, 0, 0],
    };
  }

  if (isMarketStation) {
    return {
      kind: 'box',
      scale: [1.5, 0.85, 1.5],
      rotation: [0, 0.2, 0],
    };
  }

  return {
    kind: 'sphere',
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
  };
}

function resolveAsteroidGeometryVariant(
  body: ViewerBody,
  descriptorProfile: DescriptorRenderProfile | null,
  baseVariant: {
    kind: BodyGeometryKind;
    scale: [number, number, number];
    rotation: [number, number, number];
  },
): {
  kind: BodyGeometryKind;
  scale: [number, number, number];
  rotation: [number, number, number];
  detail: number;
  rockSeed: string | null;
  rockDisplacement: number;
  rockCraterCount: number;
  rockLobeStrength: number;
  rockMinRadiusRatio: number;
} {
  if (normalizeToken(body.bodyType) !== 'asteroid') {
    return {
      kind: baseVariant.kind,
      scale: [...baseVariant.scale],
      rotation: [...baseVariant.rotation],
      detail: baseVariant.kind === 'icosahedron' ? 1 : 0,
      rockSeed: null,
      rockDisplacement: 0,
      rockCraterCount: 0,
      rockLobeStrength: 0,
      rockMinRadiusRatio: 0.78,
    };
  }

  const seedSource = body.externalObjectDescriptor?.descriptorId?.trim() || body.id;
  const seed = createDeterministicSeed(seedSource);
  const swayA = seededUnit(seed, 0x1a2b3c4d);
  const swayB = seededUnit(seed, 0x9e3779b9);
  const swayC = seededUnit(seed, 0x7f4a7c15);
  const heroBoost =
    descriptorProfile?.domain === 'asteroids' && descriptorProfile.objectFamily === 'cinematic-hero' ? 1.65 : 1;
  const skew = heroBoost > 1 ? 0.052 : 0.036;

  const variedScale: [number, number, number] = [
    +(baseVariant.scale[0] * (0.985 + swayA * skew + (heroBoost > 1 ? 0.012 : 0))).toFixed(4),
    +(baseVariant.scale[1] * (0.98 + swayB * skew - (heroBoost > 1 ? 0.01 : 0))).toFixed(4),
    +(baseVariant.scale[2] * (0.985 + swayC * skew + (heroBoost > 1 ? 0.01 : 0))).toFixed(4),
  ];

  const variedRotation: [number, number, number] = [
    +(baseVariant.rotation[0] + swayA * 0.7).toFixed(4),
    +(baseVariant.rotation[1] + swayB * 0.7).toFixed(4),
    +(baseVariant.rotation[2] + swayC * 0.7).toFixed(4),
  ];

  let kind = baseVariant.kind;
  if (kind === 'sphere' || kind === 'icosahedron' || kind === 'octahedron') {
    kind = descriptorProfile?.objectFamily === 'icy-body' ? 'sphere' : 'rock-deformed';
  }

  const resolvedScale: [number, number, number] =
    kind === 'rock-deformed'
      ? [
          +(1 + (swayA - 0.5) * (heroBoost > 1 ? 0.1 : 0.07)).toFixed(4),
          +(1 + (swayB - 0.5) * (heroBoost > 1 ? 0.08 : 0.06)).toFixed(4),
          +(1 + (swayC - 0.5) * (heroBoost > 1 ? 0.1 : 0.07)).toFixed(4),
        ]
      : variedScale;

  const detail = kind === 'rock-deformed' ? (heroBoost > 1 ? 3 : 2) : 0;
  const rockSeed = kind === 'rock-deformed' ? seedSource : null;
  const rockDisplacement = kind === 'rock-deformed' ? +(0.125 + swayA * 0.06 + (heroBoost > 1 ? 0.075 : 0)).toFixed(4) : 0;
  const rockCraterCount = kind === 'rock-deformed' ? Math.max(4, Math.floor(4 + swayC * 3 + (heroBoost > 1 ? 4 : 0))) : 0;
  const rockLobeStrength = kind === 'rock-deformed' ? +(heroBoost > 1 ? 0.62 + swayB * 0.18 : 0.3 + swayB * 0.12).toFixed(4) : 0;
  const rockMinRadiusRatio = kind === 'rock-deformed' ? (heroBoost > 1 ? 0.46 : 0.56) : 0.78;

  return {
    kind,
    scale: resolvedScale,
    rotation: variedRotation,
    detail,
    rockSeed,
    rockDisplacement,
    rockCraterCount,
    rockLobeStrength,
    rockMinRadiusRatio,
  };
}

function resolveAsteroidMaterialColorVariant(body: ViewerBody, baseColor: string): string {
  if (normalizeToken(body.bodyType) !== 'asteroid') {
    return baseColor;
  }

  const seedSource = body.externalObjectDescriptor?.descriptorId?.trim() || body.id;
  const seed = createDeterministicSeed(seedSource);
  const color = new Color(baseColor);
  const hueShift = (seededUnit(seed, 0x88aabbcc) - 0.5) * 0.03;
  const saturationShift = (seededUnit(seed, 0xccbbaa88) - 0.5) * 0.12;
  const lightnessShift = (seededUnit(seed, 0x13fa77bd) - 0.5) * 0.14;
  color.offsetHSL(hueShift, saturationShift, lightnessShift);

  return `#${color.getHexString()}`;
}

function createUnitVectorFromSeed(seed: number, salt: number): [number, number, number] {
  const x = seededUnit(seed, salt) * 2 - 1;
  const y = seededUnit(seed, salt + 1) * 2 - 1;
  const z = seededUnit(seed, salt + 2) * 2 - 1;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function buildDeterministicRockGeometry(params: {
  radius: number;
  detail: number;
  seed: string;
  displacement: number;
  craterCount: number;
  lobeStrength: number;
  minRadiusRatio: number;
}): BufferGeometry {
  const geometry = new IcosahedronGeometry(params.radius, params.detail);
  const position = geometry.getAttribute('position');
  const seed = createDeterministicSeed(params.seed);
  const lobeAxisPrimary = createUnitVectorFromSeed(seed, 0x13579bdf);
  const lobeAxisSecondary = createUnitVectorFromSeed(seed, 0x2468ace1);
  const lobeAxisTertiary = createUnitVectorFromSeed(seed, 0x5aa55aa5);
  const phaseA = seededUnit(seed, 0x1001) * Math.PI * 2;
  const phaseB = seededUnit(seed, 0x1002) * Math.PI * 2;
  const phaseC = seededUnit(seed, 0x1003) * Math.PI * 2;
  const phaseD = seededUnit(seed, 0x1004) * Math.PI * 2;
  const phaseE = seededUnit(seed, 0x1005) * Math.PI * 2;
  const craterCenters = Array.from({ length: params.craterCount }, (_, index) => {
    const center = createUnitVectorFromSeed(seed, 0x91e10da5 + index * 17);
    const radius = 0.08 + seededUnit(seed, 0x7f4a7c15 + index * 13) * 0.12;
    const depth = 0.018 + seededUnit(seed, 0x9e3779b9 + index * 19) * 0.028;
    return {
      center,
      radius,
      depth,
    };
  });
  const dentCenters = Array.from({ length: 4 }, (_, index) => {
    const center = createUnitVectorFromSeed(seed, 0x37a24d1f + index * 23);
    const radius = 0.21 + seededUnit(seed, 0x12f0aa90 + index * 29) * 0.18;
    const depth = 0.02 + seededUnit(seed, 0x89a23ec1 + index * 31) * 0.022;
    return { center, radius, depth };
  });
  const massifCenters = Array.from({ length: 3 }, (_, index) => {
    const center = createUnitVectorFromSeed(seed, 0x5522aa11 + index * 37);
    const radius = 0.34 + seededUnit(seed, 0x71b91c30 + index * 41) * 0.2;
    const amplitude = (seededUnit(seed, 0x66778899 + index * 43) - 0.42) * 0.26;
    return { center, radius, amplitude };
  });
  const facetCuts = Array.from({ length: 5 }, (_, index) => {
    const normal = createUnitVectorFromSeed(seed, 0x31f2a047 + index * 47);
    const offset = 0.12 + seededUnit(seed, 0x713a1001 + index * 53) * 0.16;
    const depth = 0.03 + seededUnit(seed, 0x9ac41f03 + index * 59) * 0.06;
    const softness = 0.08 + seededUnit(seed, 0x2d17b3c1 + index * 61) * 0.12;
    return { normal, offset, depth, softness };
  });

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    const macro =
      Math.sin((nx * 2.7 + ny * 0.8 + nz * 0.45) + phaseA) +
      Math.sin((ny * 2.4 + nz * 0.7 + nx * 0.35) + phaseB) +
      Math.sin((nz * 2.9 + nx * 0.6 + ny * 0.3) + phaseC);
    const meso =
      Math.sin((nx - ny * 0.75 + nz * 0.32) * 5.4 + phaseD) * 0.45 +
      Math.sin((ny - nz * 0.7 + nx * 0.28) * 5.1 + phaseE) * 0.38;
    const shelf =
      (Math.abs(Math.sin((nx * 3.6 + ny * 1.7 + nz * 1.2) + phaseB)) - 0.5) * 2 +
      (Math.abs(Math.sin((ny * 3.1 + nz * 1.6 + nx * 1.1) + phaseD)) - 0.5) * 1.4;
    const lobePrimary = nx * lobeAxisPrimary[0] + ny * lobeAxisPrimary[1] + nz * lobeAxisPrimary[2];
    const lobeSecondary = nx * lobeAxisSecondary[0] + ny * lobeAxisSecondary[1] + nz * lobeAxisSecondary[2];
    const lobeTertiary = nx * lobeAxisTertiary[0] + ny * lobeAxisTertiary[1] + nz * lobeAxisTertiary[2];
    const lobe =
      Math.pow(Math.max(0, lobePrimary), 2.3) * params.lobeStrength * 0.95 -
      Math.pow(Math.max(0, -lobeSecondary), 2.2) * params.lobeStrength * 0.72 +
      Math.pow(Math.max(0, lobeTertiary), 1.8) * params.lobeStrength * 0.42 -
      Math.pow(Math.max(0, -lobeTertiary), 1.6) * params.lobeStrength * 0.28;
    let massif = 0;
    for (const field of massifCenters) {
      const dot = nx * field.center[0] + ny * field.center[1] + nz * field.center[2];
      const angularDistance = 1 - dot;
      if (angularDistance < field.radius) {
        const t = 1 - angularDistance / field.radius;
        massif += field.amplitude * t * t;
      }
    }
    let displacement =
      macro * params.displacement * 0.14 +
      meso * params.displacement * 0.11 +
      shelf * params.displacement * 0.06 +
      lobe * 0.18 +
      massif;

    for (const dent of dentCenters) {
      const dot = nx * dent.center[0] + ny * dent.center[1] + nz * dent.center[2];
      const angularDistance = 1 - dot;
      if (angularDistance < dent.radius) {
        const t = 1 - angularDistance / dent.radius;
        displacement -= t * t * dent.depth;
      }
    }

    for (const crater of craterCenters) {
      const dot = nx * crater.center[0] + ny * crater.center[1] + nz * crater.center[2];
      const angularDistance = 1 - dot;
      if (angularDistance < crater.radius) {
        const t = 1 - angularDistance / crater.radius;
        displacement -= t * t * crater.depth;
      }
    }

    for (const facet of facetCuts) {
      const dot = nx * facet.normal[0] + ny * facet.normal[1] + nz * facet.normal[2];
      const over = dot - facet.offset;
      if (over > 0) {
        const t = Math.min(1, over / facet.softness);
        displacement -= facet.depth * t * t;
      }
    }

    displacement = Math.max(-0.42, Math.min(0.34, displacement));
    const radius = Math.max(params.radius * params.minRadiusRatio, params.radius * (1 + displacement));
    position.setXYZ(index, nx * radius, ny * radius, nz * radius);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function resolveViewerSceneCameraDistanceRange(bodies: ViewerBody[]): ViewerSceneCameraDistanceRange {
  const extent = resolveRenderedExtent(mapBodiesToRendered(bodies));
  // Min is always the planet-detail floor — allow zooming right up to bodies.
  const minDistance = VIEWER_CAMERA_DISTANCE_MIN_FLOOR;

  let maxDistance = clamp(extent * 2.25 + 18, VIEWER_CAMERA_DISTANCE_MAX_FLOOR, VIEWER_CAMERA_DISTANCE_MAX_CEILING);
  if (maxDistance < minDistance + VIEWER_CAMERA_DISTANCE_MIN_MAX_GAP) {
    maxDistance = minDistance + VIEWER_CAMERA_DISTANCE_MIN_MAX_GAP;
  }

  return {
    min: +minDistance.toFixed(3),
    max: +maxDistance.toFixed(3),
  };
}

function resolveZoomDistance(zoomLevel: number, bodies: ViewerBody[]): number {
  const { min, max } = resolveViewerSceneCameraDistanceRange(bodies);
  const normalized = clamp(zoomLevel, 0, 100) / 100;
  // Logarithmic mapping: evenly distributes zoom across planet-detail to full-system scale.
  return min * Math.pow(max / min, normalized);
}

function resolveZoomPercent(distance: number, bodies: ViewerBody[]): number {
  const { min, max } = resolveViewerSceneCameraDistanceRange(bodies);
  if (max <= min || min <= 0) {
    return 0;
  }

  // Inverse log: normalized = log(distance/min) / log(max/min)
  const ratio = Math.log(clamp(distance, min, max) / min) / Math.log(max / min);
  return clamp(ratio * 100, 0, 100);
}

/**
 * Resolves orbit ring orientation using explicit transform composition:
 * base (XY->XZ) then node, inclination, periapsis within the scene frame.
 */
function resolveOrbitRotationEuler(orbital: ViewerBody['orbitalElements']): [number, number, number] {
  const ascendingNode = degToRad(orbital?.longitudeOfAscendingNodeDeg);
  const inclination = degToRad(orbital?.inclinationDeg);
  const argumentOfPeriapsis = degToRad(orbital?.argumentOfPeriapsisDeg);

  const yAxis = new Vector3(0, 1, 0);
  const xAxis = new Vector3(1, 0, 0);

  const qBase = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0, 'XYZ'));
  const qNode = new Quaternion().setFromAxisAngle(yAxis, ascendingNode);
  const qInclination = new Quaternion().setFromAxisAngle(xAxis, inclination);
  const qPeriapsis = new Quaternion().setFromAxisAngle(yAxis, argumentOfPeriapsis);

  // Apply base plane first (XY -> XZ), then orbital orientation.
  // This ensures node/periapsis rotate within the reference plane and
  // inclination is the term that controls out-of-plane tilt.
  const orbitQ = qNode.clone().multiply(qInclination).multiply(qPeriapsis).multiply(qBase);
  const orbitEuler = new Euler().setFromQuaternion(orbitQ, 'XYZ');
  return [orbitEuler.x, orbitEuler.y, orbitEuler.z];
}

/**
 * Pure mapping from raw {@link ViewerBody} entries to the lightweight `RenderedBody`
 * shape used by the scene template. Exposed for unit tests so the scene component
 * itself (which depends on `NgtStore` at change detection) does not need to mount.
 *
 * Handles hierarchical positioning: first pass calculates star/primary positions,
 * second pass uses parent positions for anchored bodies (moons around planets, etc).
 * @param zoomLevel Optional zoom level (0-100) for dynamic radius scaling
 */
export function mapBodiesToRendered(
  bodies: ViewerBody[],
  zoomLevel?: number,
  targetBodyId?: string | null,
  ships: ShipSummary[] = [],
): RenderedBody[] {
  const positionCache = new Map<string, [number, number, number]>();

  // First pass: calculate positions for stars and non-anchored bodies
  const firstPass = bodies.map((body) => {
    const position = resolveBodyScenePosition(body);
    positionCache.set(body.id, position);
    return position;
  });

  // Second pass: recalculate anchored bodies using parent positions
  const rendered = bodies.map((body, idx) => {
    let position = firstPass[idx];

    // If body has an anchor, recalculate position relative to anchor
    const anchorId = body.orbitalElements?.anchorBodyId;
    if (anchorId) {
      if (positionCache.has(anchorId)) {
        const anchorPos = positionCache.get(anchorId)!;
        const orbitalPos = resolveBodyOrbitalPositionRelativeToAnchor(body, anchorPos);
        if (orbitalPos) {
          position = orbitalPos;
          positionCache.set(body.id, position);
        }
      }
    }

    const isGate = isGateBody(body);
    const isMarketStation = isMarketStationBody(body);
    const descriptorProfile = resolveDescriptorRenderProfile(body.externalObjectDescriptor);
    const baseGeometryVariant = resolveBodyGeometryVariant(body, descriptorProfile, isGate, isMarketStation);
    const geometryVariant = resolveAsteroidGeometryVariant(body, descriptorProfile, baseGeometryVariant);
    const defaultMaterialColor = resolveDefaultMaterialColor(body, isGate, isMarketStation);
    const resolvedMaterialColor = resolveAsteroidMaterialColorVariant(
      body,
      descriptorProfile?.color ?? defaultMaterialColor,
    );
    const resolvedRadius = +(resolveBodySceneRadius(body, zoomLevel) * (descriptorProfile?.radiusScale ?? 1)).toFixed(4);

    return {
      source: body,
      id: body.id,
      bodyType: body.bodyType,
      displayName: body.displayName || body.id,
      color: descriptorProfile?.color ?? resolveBodyColor(body),
      radius: resolvedRadius,
      position,
      isStar: isStarBody(body),
      isMarketStation,
      isGate,
      geometryKind: geometryVariant.kind,
      geometryScale: geometryVariant.scale,
      geometryRotation: geometryVariant.rotation,
      geometryDetail: geometryVariant.detail,
      geometryTorusTubeRadius: Math.max(resolvedRadius * 0.2, 0.03),
      geometrySegments: descriptorProfile?.geometrySegments ?? 32,
      rockSeed: geometryVariant.rockSeed,
      rockDisplacement: geometryVariant.rockDisplacement,
      rockCraterCount: geometryVariant.rockCraterCount,
      rockLobeStrength: geometryVariant.rockLobeStrength,
      rockMinRadiusRatio: geometryVariant.rockMinRadiusRatio,
      materialColor: resolvedMaterialColor,
      materialEmissive: descriptorProfile?.emissive ?? resolveDefaultMaterialEmissive(body, isGate, isMarketStation),
      materialEmissiveIntensity:
        descriptorProfile?.emissiveIntensity ?? resolveDefaultMaterialEmissiveIntensity(body, isGate, isMarketStation),
      materialRoughness:
        normalizeToken(body.bodyType) === 'asteroid'
          ? Math.min(0.98, (descriptorProfile?.roughness ?? 0.84) + seededUnit(createDeterministicSeed(body.id), 0x44) * 0.1)
          : descriptorProfile?.roughness ?? 0.8,
      materialMetalness:
        normalizeToken(body.bodyType) === 'asteroid'
          ? Math.max(0.01, (descriptorProfile?.metalness ?? 0.08) + (seededUnit(createDeterministicSeed(body.id), 0x55) - 0.5) * 0.04)
          : descriptorProfile?.metalness ?? 0.05,
    };
  });

  const localProjectionWeight = resolveLocalAsteroidProjectionWeight(zoomLevel);
  if (!targetBodyId || localProjectionWeight <= 0) {
    return rendered;
  }

  const targetBody = bodies.find((body) => body.id === targetBodyId);
  const targetRendered = rendered.find((body) => body.id === targetBodyId);
  const targetShip = ships.find((ship) => ship.id === targetBodyId && isValidShipSpatial(ship.spatial));

  let targetPositionKm: { x: number; y: number; z: number } | null = null;
  let targetPositionScene: [number, number, number] | null = null;

  if (targetBody && targetRendered && isAsteroidBody(targetBody)) {
    targetPositionKm = targetBody.spatial.positionKm;
    targetPositionScene = targetRendered.position;
  } else if (targetShip && isValidShipSpatial(targetShip.spatial)) {
    targetPositionKm = targetShip.spatial.positionKm;
    targetPositionScene = resolveScenePositionFromSpatialKm(targetShip.spatial.positionKm);
  }

  if (!targetPositionKm || !targetPositionScene) {
    return rendered;
  }

  return rendered.map((candidate) => {
    if ((targetBody && candidate.id === targetBodyId) || !isAsteroidBody(candidate.source)) {
      return candidate;
    }

    const candidatePosKm = candidate.source.spatial.positionKm;
    const dxKm = candidatePosKm.x - targetPositionKm.x;
    const dyKm = candidatePosKm.y - targetPositionKm.y;
    const dzKm = candidatePosKm.z - targetPositionKm.z;
    const localDistanceKm = Math.hypot(dxKm, dyKm, dzKm);
    if (!Number.isFinite(localDistanceKm) || localDistanceKm <= 0 || localDistanceKm > VIEWER_LOCAL_ASTEROID_VIEW_RANGE_KM) {
      return candidate;
    }

    const localScale = VIEWER_LOCAL_ASTEROID_VIEW_SCALE * localProjectionWeight;
    const localPosition: [number, number, number] = [
      +(targetPositionScene[0] + dxKm * localScale).toFixed(3),
      +(targetPositionScene[1] + dyKm * localScale).toFixed(3),
      +(targetPositionScene[2] + dzKm * localScale).toFixed(3),
    ];

    return {
      ...candidate,
      position: localPosition,
    };
  });
}

/**
 * Pure helper that maps ship summaries to viewer-ready render descriptors.
 *
 * - Ships with invalid spatial (null / malformed / sun-origin) are routed to a
 *   synthetic offset and flagged via `isUnknownSpatial: true` with a distinct
 *   color so they remain visible while lazy repair runs upstream.
 * - Otherwise the position is projected from km to scene units along the unit
 *   vector of the spatial position using the same log-distance scaling as the
 *   bodies (see `resolveSceneDistanceFromKm`).
 */
export function mapShipsToRendered(ships: ShipSummary[], activeShipId: string | null): RenderedShip[] {
  return ships.map((ship): RenderedShip => {
    const isActive = activeShipId !== null && ship.id === activeShipId;
    const model = coerceShipModel(ship.model);
    const descriptorProfile = resolveDescriptorRenderProfile(ship.externalObjectDescriptor);
    const descriptorColor = descriptorProfile?.domain === 'ships' ? descriptorProfile.color : null;
    const defaultShipColor = isActive ? VIEWER_SCENE_ACTIVE_SHIP_COLOR : VIEWER_SCENE_INACTIVE_SHIP_COLOR;
    if (!isValidShipSpatial(ship.spatial)) {
      return {
        id: ship.id,
        model,
        displayName: ship.name?.trim() || ship.id,
        color: VIEWER_SCENE_UNKNOWN_SHIP_COLOR,
        recognitionDistanceKm: descriptorProfile?.recognitionDistanceKm ?? 40_000,
        position: [...VIEWER_SCENE_UNKNOWN_SHIP_POSITION] as [number, number, number],
        isActive,
        isUnknownSpatial: true,
      };
    }
    const pos = ship.spatial.positionKm;
    const magnitudeKm = Math.hypot(pos.x, pos.y, pos.z);
    const scaled = resolveSceneDistanceFromKm(magnitudeKm);
    const scenePos: [number, number, number] = [
      +((pos.x / magnitudeKm) * scaled).toFixed(3),
      +((pos.y / magnitudeKm) * scaled).toFixed(3),
      +((pos.z / magnitudeKm) * scaled).toFixed(3),
    ];
    return {
      id: ship.id,
      model,
      displayName: ship.name?.trim() || ship.id,
      color: isActive ? VIEWER_SCENE_ACTIVE_SHIP_COLOR : descriptorColor ?? defaultShipColor,
      recognitionDistanceKm: descriptorProfile?.recognitionDistanceKm ?? 40_000,
      position: scenePos,
      isActive,
      isUnknownSpatial: false,
    };
  });
}

/**
 * Resolve a target id to a scene-space position.
 *
 * Target ids primarily refer to celestial bodies, but the details panel can
 * also emit ship ids. This helper enables camera fly-to for both paths.
 */
export function resolveTargetScenePosition(
  targetId: string,
  renderedBodies: ReadonlyArray<{ id: string; position: [number, number, number] }>,
  renderedShips: ReadonlyArray<{ id: string; position: [number, number, number] }>,
): [number, number, number] | null {
  const targetBody = renderedBodies.find((body) => body.id === targetId);
  if (targetBody) {
    return targetBody.position;
  }

  const targetShip = renderedShips.find((ship) => ship.id === targetId);
  if (targetShip) {
    return targetShip.position;
  }

  return null;
}

@Component({
  selector: 'app-viewer-system-scene',
  templateUrl: './viewer-system-scene.html',
  imports: [NgtArgs, NgtsOrbitControls, ViewerShipMesh],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Inner Angular Three scene that renders a solar system: stars rendered with
 * `MeshBasicMaterial` (self-lit) using their color/luminosity, and other bodies
 * rendered with `MeshStandardMaterial` lit by a point light at the system origin.
 *
 * Coordinates use the hybrid log-distance scaling defined in
 * [viewer-formatters.ts](./viewer-formatters.ts).
 */
export class ViewerSystemScene {
  private store = injectStore();
  private orbitControlsRef = viewChild(NgtsOrbitControls);

  private cameraTween: CameraTween | null = null;
  private planetViewRequestTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProcessedTargetBodyId: string | null = null;
  private persistentLookTarget = new Vector3(0, 0, 0);
  private settledCameraPosition: Vector3 | null = null;
  private rockGeometryCache = new Map<string, BufferGeometry>();

  bodies = input<ViewerBody[]>([]);
  summary = input<SolarSystemSummary | null>(null);
  targetBodyId = input<string | null>(null);
  zoomLevel = input<number>(18);
  ships = input<ShipSummary[]>([]);
  activeShipId = input<string | null>(null);
  @Output() hoveredBodyChange = new EventEmitter<ViewerBody | null>();
  @Output() focusedPlanetChange = new EventEmitter<ViewerBody | null>();
  @Output() planetViewRequest = new EventEmitter<ViewerBody>();
  @Output() zoomLevelChange = new EventEmitter<number>();

  protected readonly rendered = computed<RenderedBody[]>(() =>
    mapBodiesToRendered(this.bodies(), this.zoomLevel(), this.targetBodyId(), this.ships()),
  );

  protected readonly renderedShips = computed<RenderedShip[]>(() => mapShipsToRendered(this.ships(), this.activeShipId()));

  protected readonly focusedPlanetId = signal<string | null>(null);

  protected readonly focusedBodyIds = computed<Set<string> | null>(() => {
    const focusedPlanetId = this.focusedPlanetId();
    if (!focusedPlanetId) {
      return null;
    }

    const ids = new Set<string>([focusedPlanetId]);
    for (const body of this.rendered()) {
      if (body.source.orbitalElements?.anchorBodyId === focusedPlanetId) {
        ids.add(body.id);
      }
    }
    return ids;
  });

  protected readonly stars = computed(() => (this.focusedPlanetId() ? [] : this.rendered().filter((b: RenderedBody) => b.isStar)));
  protected readonly nonStars = computed(() => {
    const focusIds = this.focusedBodyIds();
    const allNonStars = this.rendered().filter((b: RenderedBody) => !b.isStar);
    if (!focusIds) {
      return allNonStars;
    }
    return allNonStars.filter((body) => focusIds.has(body.id));
  });

  protected resolveRockGeometry(body: RenderedBody): BufferGeometry {
    const seed = body.rockSeed ?? body.id;
    const key = [
      seed,
      body.radius.toFixed(4),
      body.geometryDetail,
      body.rockDisplacement.toFixed(4),
      body.rockCraterCount,
      body.rockLobeStrength.toFixed(4),
      body.rockMinRadiusRatio.toFixed(4),
    ].join('|');
    const cached = this.rockGeometryCache.get(key);
    if (cached) {
      return cached;
    }

    const geometry = buildDeterministicRockGeometry({
      radius: body.radius,
      detail: Math.max(1, body.geometryDetail),
      seed,
      displacement: body.rockDisplacement || 0.12,
      craterCount: body.rockCraterCount || 8,
      lobeStrength: body.rockLobeStrength || 0.1,
      minRadiusRatio: body.rockMinRadiusRatio || 0.78,
    });
    this.rockGeometryCache.set(key, geometry);
    return geometry;
  }

  protected readonly orbitEllipses = computed<OrbitEllipse[]>(() => {
    const byId = new Map<string, RenderedBody>(this.rendered().map((body) => [body.id, body]));
    const hoveredId = this.hoveredBodyId();
    const focusedPlanetId = this.focusedPlanetId();
    const focusIds = this.focusedBodyIds();
    const hoveredBody = hoveredId ? byId.get(hoveredId) : undefined;
    const hoveredIsPlanet = hoveredBody?.bodyType === 'planet';

    // Build the set of highlighted orbit IDs (hovered body + its parent + its children)
    const highlightedIds = new Set<string>();
    if (hoveredId) {
      highlightedIds.add(hoveredId);
      const hoveredParentId = hoveredBody?.source.orbitalElements?.anchorBodyId;
      if (hoveredParentId && byId.has(hoveredParentId)) {
        highlightedIds.add(hoveredParentId);
      }
      for (const candidate of this.nonStars()) {
        if (candidate.source.orbitalElements?.anchorBodyId === hoveredId) {
          highlightedIds.add(candidate.id);
        }
      }
    }

    // All orbits always visible; highlighted ones get boosted opacity
    return this.nonStars()
      .map((body): OrbitEllipse | null => {
        if (focusIds && !focusIds.has(body.id)) {
          return null;
        }

        // Moon orbits are only shown when hovering a planet.
        if (body.bodyType === 'moon' && !hoveredIsPlanet && !focusedPlanetId) {
          return null;
        }

        const orbital = body.source.orbitalElements;
        const semiMajorAxisKm = orbital?.semiMajorAxisKm;
        if (typeof semiMajorAxisKm !== 'number' || !Number.isFinite(semiMajorAxisKm) || semiMajorAxisKm <= 0) {
          return null;
        }

        const eRaw = orbital?.eccentricity;
        const eccentricity = typeof eRaw === 'number' && Number.isFinite(eRaw) ? Math.min(Math.max(eRaw, 0), 0.98) : 0;
        const anchorId = orbital?.anchorBodyId;
        const isAnchoredOrbit = typeof anchorId === 'string' && anchorId.length > 0;
        const orbitProfile = isAnchoredOrbit ? resolveAnchoredOrbitSceneProfile(body.source) : null;
        const scaledRadius = isAnchoredOrbit
          ? resolveSceneDistanceFromKm(semiMajorAxisKm) * orbitProfile!.scale
          : resolveSceneDistanceFromKm(semiMajorAxisKm);
        const radiusX = Math.max(
          isAnchoredOrbit ? orbitProfile!.minRadiusX : VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X,
          +scaledRadius.toFixed(3),
        );
        const radiusZ = Math.max(
          isAnchoredOrbit ? orbitProfile!.minRadiusZ : VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z,
          +(radiusX * Math.sqrt(1 - eccentricity * eccentricity)).toFixed(3),
        );

        const anchorPosition = anchorId && byId.has(anchorId) ? byId.get(anchorId)!.position : [0, 0, 0];

        let opacity: number;
        if (focusedPlanetId) {
          opacity = body.id === focusedPlanetId ? 0.9 : 0.35;
        } else if (!hoveredId) {
          opacity = 0.18; // default always-on low opacity
        } else if (hoveredId === body.id) {
          opacity = 0.9;  // hovered body's own orbit
        } else if (highlightedIds.has(body.id)) {
          opacity = 0.35; // related orbits (parent/children)
        } else {
          opacity = 0.08; // unrelated orbits dimmed but still visible
        }

        const orbitOpacity = body.isMarketStation ? Math.max(opacity, hoveredId === body.id ? 1 : 0.72) : opacity;

        return {
          id: body.id,
          center: [anchorPosition[0], anchorPosition[1], anchorPosition[2]],
          radiusX,
          radiusZ,
          rotation: resolveOrbitRotationEuler(orbital),
          opacity: orbitOpacity,
            color: resolveOrbitColor(body.source),
          isMarketStation: body.isMarketStation,
        };
      })
      .filter((orbit): orbit is OrbitEllipse => orbit !== null);
  });

  // Hovered body tracking
  protected readonly targetedBodyId = signal<string | null>(null);
  protected readonly activeTargetFlightId = signal<string | null>(null);
  protected hoveredBodyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.targetBodyId();

      // Only react to actual target-id transitions.
      if (id === this.lastProcessedTargetBodyId) {
        return;
      }
      this.lastProcessedTargetBodyId = id;

      if (id) {
        this.targetedBodyId.set(id);
        this.flyToTargetBody(id);
      } else {
        this.activeTargetFlightId.set(null);
        this.targetedBodyId.set(null);
        // Clearing list-target state should not recenter the camera.
        // Keep current camera pose and only stop any active target flight.
        this.cameraTween = null;
        this.settledCameraPosition = null;
        this.setOrbitControlsEnabled(true);
      }
    });

    beforeRender(({ delta }) => {
      const camera = this.store.camera();
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;

      this.syncOrbitControlsTarget();

      if (camera && controls && !this.cameraTween) {
        const targetDistance = resolveZoomDistance(this.zoomLevel(), this.rendered().map((body) => body.source));
        controls.minDistance = targetDistance;
        controls.maxDistance = targetDistance;
        controls.update();
      }

      if (camera && !this.cameraTween && this.targetedBodyId() && this.settledCameraPosition) {
        // Preserve target composition only during brief handoffs where controls
        // are unavailable; otherwise orbit interactions must remain user-driven.
        if (!controls?.target) {
          const drift = camera.position.distanceTo(this.settledCameraPosition);
          if (drift > 0.001) {
            camera.position.copy(this.settledCameraPosition);
          }
          camera.lookAt(this.persistentLookTarget);
        }
      }

      if (!this.cameraTween) {
        return;
      }

      if (!camera) {
        this.cameraTween = null;
        return;
      }

      this.cameraTween.elapsedSec += delta;
      const t = Math.min(1, this.cameraTween.elapsedSec / this.cameraTween.durationSec);
      const eased = t * t * (3 - 2 * t);

      camera.position.lerpVectors(this.cameraTween.fromPosition, this.cameraTween.toPosition, eased);

      if (controls?.target) {
        controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        controls.update();
        this.persistentLookTarget.copy(controls.target);
      } else {
        const lookAtTarget = new Vector3().lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        camera.lookAt(lookAtTarget);
        this.persistentLookTarget.copy(lookAtTarget);
      }

      // For cinematic target flights, finish slightly before the exact endpoint
      // to avoid a visible final-frame perspective snap.
      if (this.cameraTween.kind === 'target-fly' && t >= VIEWER_TARGET_FLY_COMPLETION_T) {
        this.finalizeCameraTween();
        return;
      }

      if (t >= 1) {
        this.finalizeCameraTween();
      }
    });
  }

  onBodyPointerOver(body: ViewerBody) {
    this.hoveredBodyId.set(body.id);
    this.hoveredBodyChange.emit(body);
  }

  onBodyPointerDown(
    event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number; preventDefault?: () => void }; stopPropagation?: () => void },
    body: ViewerBody,
  ) {
    if (!this.isRightButton(event) || body.bodyType !== 'planet') {
      return;
    }

    event.stopPropagation?.();
    event.nativeEvent?.preventDefault?.();
    this.focusPlanet(body.id);

    if (this.planetViewRequestTimer) {
      clearTimeout(this.planetViewRequestTimer);
    }
    this.planetViewRequestTimer = setTimeout(() => {
      this.planetViewRequest.emit(body);
      this.planetViewRequestTimer = null;
    }, Math.round(VIEWER_CAMERA_TWEEN_DURATION_SEC * 1000));
  }

  onScenePointerDown(
    event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number; preventDefault?: () => void } },
  ) {
    if (this.isRightButton(event) && this.activeTargetFlightId()) {
      event.nativeEvent?.preventDefault?.();
      this.activeTargetFlightId.set(null);
      this.cameraTween = null;
      this.settledCameraPosition = null;
      this.setOrbitControlsEnabled(true);
      return;
    }

    if (!this.isRightButton(event) || !this.focusedPlanetId()) {
      return;
    }

    event.nativeEvent?.preventDefault?.();
    this.clearPlanetFocus();
  }

  onBodyPointerOut(id: string) {
    if (this.hoveredBodyId() === id) {
      this.hoveredBodyId.set(null);
      this.hoveredBodyChange.emit(null);
    }
  }

  private isRightButton(event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number } }): boolean {
    const button = event.button ?? event.nativeEvent?.button;
    const buttons = event.buttons ?? event.nativeEvent?.buttons;
    return button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
  }

  private focusPlanet(planetId: string): void {
    this.focusedPlanetId.set(planetId);

    const focused = this.rendered().find((body) => body.id === planetId);
    if (!focused) {
      this.focusedPlanetChange.emit(null);
      return;
    }

    this.focusedPlanetChange.emit(focused.source);

    const focusDistance = this.resolveFocusDistance(planetId);
    this.beginCameraTween(focused.position, focusDistance);
  }

  private flyToTargetBody(targetBodyId: string): void {
    const targetPosition = resolveTargetScenePosition(targetBodyId, this.rendered(), this.renderedShips());
    if (!targetPosition) {
      this.activeTargetFlightId.set(null);
      return;
    }

    const targetBody = this.rendered().find((body) => body.id === targetBodyId);
    const flyDistance = targetBody ? Math.max(3.5, Math.min(14, targetBody.radius * 16)) : 5;

    this.activeTargetFlightId.set(targetBodyId);
    this.beginCameraTween(targetPosition, flyDistance, undefined, VIEWER_TARGET_FLY_DURATION_SEC, 'target-fly');
  }

  private clearPlanetFocus(): void {
    this.focusedPlanetId.set(null);
    this.focusedPlanetChange.emit(null);
    this.settledCameraPosition = null;
    this.beginCameraTween([0, 0, 0], undefined, VIEWER_DEFAULT_CAMERA_POSITION);
  }

  private resolveFocusDistance(planetId: string): number {
    const planet = this.rendered().find((body) => body.id === planetId);
    if (!planet) {
      return 4;
    }

    let maxMoonDistance = 0;
    for (const body of this.rendered()) {
      if (body.source.orbitalElements?.anchorBodyId !== planetId) {
        continue;
      }
      const dx = body.position[0] - planet.position[0];
      const dy = body.position[1] - planet.position[1];
      const dz = body.position[2] - planet.position[2];
      maxMoonDistance = Math.max(maxMoonDistance, Math.hypot(dx, dy, dz));
    }

    if (maxMoonDistance > 0) {
      return Math.min(14, Math.max(3.2, maxMoonDistance * 3.4));
    }

    return Math.max(3.2, Math.min(8, planet.radius * 14));
  }

  private beginCameraTween(
    target: [number, number, number],
    distance: number | undefined,
    explicitPosition?: [number, number, number],
    durationSec: number = VIEWER_CAMERA_TWEEN_DURATION_SEC,
    kind: CameraTween['kind'] = 'default',
  ): void {
    const camera = this.store.camera();
    if (!camera) {
      return;
    }

    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    const fromPosition = camera.position.clone();
    const fromTarget = controls?.target?.clone() ?? this.persistentLookTarget.clone();
    const toTarget = new Vector3(target[0], target[1], target[2]);
    this.persistentLookTarget.copy(fromTarget);

    let toPosition: Vector3;
    if (explicitPosition) {
      toPosition = new Vector3(explicitPosition[0], explicitPosition[1], explicitPosition[2]);
    } else {
      const direction = fromPosition.clone().sub(fromTarget);
      if (direction.lengthSq() < 1e-6) {
        direction.set(0, 0.2, 1);
      }
      direction.normalize();
      toPosition = toTarget.clone().add(direction.multiplyScalar(distance ?? 6));
    }

    if (kind === 'target-fly') {
      this.setOrbitControlsEnabled(false);
    }

    this.cameraTween = {
      kind,
      elapsedSec: 0,
      durationSec,
      fromPosition,
      toPosition,
      fromTarget,
      toTarget,
    };
  }

  private finalizeCameraTween(): void {
    const tween = this.cameraTween;
    if (tween?.kind === 'target-fly') {
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
      this.persistentLookTarget.copy(tween.toTarget);
      if (controls?.target) {
        // Ensure controls resume from the same target the flight finished on.
        controls.target.copy(tween.toTarget);
        controls.update();
      }
      this.setOrbitControlsEnabled(true);
    }

    const camera = this.store.camera();
    if (camera) {
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
      const distance = controls?.target ? camera.position.distanceTo(controls.target) : camera.position.length();
      this.zoomLevelChange.emit(resolveZoomPercent(distance, this.rendered().map((body) => body.source)));
    }

    if (camera && tween?.kind === 'target-fly') {
      this.settledCameraPosition = camera.position.clone();
    } else if (tween?.kind !== 'target-fly') {
      this.settledCameraPosition = null;
    }

    this.activeTargetFlightId.set(null);
    this.cameraTween = null;
  }

  private setOrbitControlsEnabled(enabled: boolean): void {
    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    if (!controls) {
      return;
    }
    controls.enabled = enabled;
  }

  private syncOrbitControlsTarget(): void {
    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    if (!controls?.target) {
      return;
    }

    if (controls.target.distanceToSquared(this.persistentLookTarget) <= 1e-6) {
      return;
    }

    controls.target.copy(this.persistentLookTarget);
    controls.update();
  }

  ngOnDestroy(): void {
    if (this.planetViewRequestTimer) {
      clearTimeout(this.planetViewRequestTimer);
      this.planetViewRequestTimer = null;
    }
  }
}
