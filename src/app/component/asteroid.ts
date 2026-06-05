import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  InjectionToken,
  input,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender as _beforeRender, injectStore, NgtArgs } from 'angular-three';
import * as THREE from 'three';
import { AsteroidMaterialProfile } from '../model/catalog/asteroid-materials';
import {
  generateRandomAsteroidMeshProfile,
  resolveAsteroidMeshProfile,
  type AsteroidMeshGeometryKind,
  type AsteroidMeshProfile,
} from '../model/catalog/asteroid-mesh-profiles';
import { buildSw13bGeneratedVisualSample } from '../model/sw13b/asteroid-visual-generator';
import { computeSw13bVisualMetrics } from '../model/sw13b/asteroid-visual-metrics';
import { AsteroidKinematics } from '../model/math/asteroid-kinematics';
import { CelestialBodyLocation } from '../model/math/celestial-body-location';
import { Triple } from '../model/shared/triple';
import type { AsteroidRenderTier } from '../scene/ship-exterior/asteroid-tier-selection';

export interface AsteroidHoverEvent {
  id: string;
  hovering: boolean;
}

export interface AsteroidPointerButtonEvent {
  id: string;
  button: number;
}

export type AsteroidGeometryKind = AsteroidMeshGeometryKind;

export interface AsteroidRevealProfile extends AsteroidMeshProfile {}

export type AsteroidRockRevealGeometry = Exclude<AsteroidGeometryKind, 'rock'>;

export interface AsteroidRockRevealSelection {
  geometry: AsteroidRockRevealGeometry;
  detail: number;
}

export type AsteroidInteractionState =
  | 'idle'
  | 'scanning'
  | 'scanned'
  | 'hovered'
  | 'targeting'
  | 'targeted';

export interface AsteroidVisualState {
  interaction: AsteroidInteractionState;
  tier: AsteroidRenderTier;
}

const ASTEROID_ROCK_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();

const MORPH_PULSE_DURATION_SECONDS = 0.28;

export const ASTEROID_BEFORE_RENDER_FN = new InjectionToken<typeof _beforeRender>('ASTEROID_BEFORE_RENDER_FN', {
  providedIn: 'root',
  factory: () => _beforeRender,
});

export const ASTEROID_INJECT_STORE_FN = new InjectionToken<typeof injectStore>('ASTEROID_INJECT_STORE_FN', {
  providedIn: 'root',
  factory: () => injectStore,
});

export function resolveAsteroidVisualState(params: {
  hovered: boolean;
  targetingHold: boolean;
  targeted: boolean;
  scanProgress: number;
  scanned: boolean;
  tier: AsteroidRenderTier;
}): AsteroidVisualState {
  if (params.targeted) {
    return { interaction: 'targeted', tier: params.tier };
  }
  if (params.targetingHold) {
    return { interaction: 'targeting', tier: params.tier };
  }
  if (params.hovered) {
    return { interaction: 'hovered', tier: params.tier };
  }
  if (params.scanned) {
    return { interaction: 'scanned', tier: params.tier };
  }
  if (params.scanProgress > 0) {
    return { interaction: 'scanning', tier: params.tier };
  }

  return { interaction: 'idle', tier: params.tier };
}

function resolveAsteroidMaterialColorFromState(
  state: AsteroidVisualState,
  revealedMaterial: AsteroidMaterialProfile | null,
): string {
  switch (state.interaction) {
    case 'targeted':
      return '#ffb347';
    case 'targeting':
      return '#ff5e57';
    case 'hovered':
      return '#8de8ff';
    case 'scanned':
      return revealedMaterial?.textureColor ?? '#8df7b2';
    case 'scanning':
      return '#63a7bc';
    default:
      return '#5f6d7b';
  }
}

function resolveAsteroidBeamOpacityFromState(state: AsteroidVisualState): number {
  switch (state.interaction) {
    case 'targeted':
      return 0.72;
    case 'targeting':
      return 0.64;
    case 'hovered':
      return 0.58;
    case 'scanned':
      return 0.36;
    case 'scanning':
      return 0.24;
    default:
      return 0;
  }
}

function resolveAsteroidSweepOpacityFromState(state: AsteroidVisualState): number {
  switch (state.interaction) {
    case 'targeted':
      return 0.96;
    case 'targeting':
      return 0.94;
    case 'hovered':
      return 0.92;
    default:
      return 0;
  }
}

function resolveAsteroidEmissiveColorFromState(
  state: AsteroidVisualState,
  revealedMaterial: AsteroidMaterialProfile | null,
): string {
  switch (state.interaction) {
    case 'targeted':
      return '#a9401b';
    case 'targeting':
      return '#7a1f1f';
    case 'hovered':
      return '#16404a';
    case 'scanned':
      return revealedMaterial?.textureColor ?? '#8df7b2';
    default:
      return '#0f141d';
  }
}

function resolveAsteroidEmissiveIntensityFromState(
  state: AsteroidVisualState,
  revealedMaterial: AsteroidMaterialProfile | null,
): number {
  const boost = revealedMaterial?.emissiveBoost ?? 0;
  switch (state.interaction) {
    case 'targeted':
      return 1.1 + boost;
    case 'targeting':
      return 1 + boost;
    case 'hovered':
      return 0.95 + boost;
    case 'scanned':
      return 0.8 + boost;
    case 'scanning':
      return 0.5;
    default:
      return 0.25;
  }
}

export function resolveAsteroidMaterialColor(
  scanProgress: number,
  hovered: boolean,
  scanned: boolean,
  revealedMaterial: AsteroidMaterialProfile | null,
): string {
  if (scanned) {
    return '#8de8ff';
  }
  if (hovered) {
    return '#8de8ff';
  }
  if (scanProgress > 0) {
    return '#63a7bc';
  }
  return '#5f6d7b';
}

export function resolveAsteroidBeamOpacity(scanProgress: number, hovered: boolean, scanned: boolean): number {
  if (hovered) {
    return 0.58;
  }
  if (scanned) {
    return 0.36;
  }
  if (scanProgress > 0) {
    return 0.24;
  }
  return 0;
}

export function resolveAsteroidSweepOpacity(hovered: boolean): number {
  return hovered ? 0.92 : 0;
}

export function generateRandomAsteroidRevealProfile(random: () => number = Math.random): AsteroidRevealProfile {
  return generateRandomAsteroidMeshProfile(random);
}

export function resolveAsteroidGeometryDetail(
  geometry: AsteroidGeometryKind,
  baseDetail: number,
  scanned: boolean,
  detailOverride: number | null = null,
): number {
  if (!scanned) {
    return Math.max(0, Math.min(1, baseDetail));
  }

  if (geometry === 'rock') {
    return 0;
  }

  const scannedDefault = geometry === 'octahedron' ? 0 : 2;
  if (detailOverride === null) {
    return scannedDefault;
  }

  if (geometry === 'octahedron') {
    return 0;
  }

  return Math.max(0, Math.min(scannedDefault, detailOverride));
}

export function resolveAsteroidPbrRoughness(scanned: boolean, revealedMaterial: AsteroidMaterialProfile | null): number {
  if (!scanned) {
    return 0.92;
  }

  return revealedMaterial?.roughness ?? 0.6;
}

export function resolveAsteroidPbrMetalness(scanned: boolean, revealedMaterial: AsteroidMaterialProfile | null): number {
  if (!scanned) {
    return 0.03;
  }

  return revealedMaterial?.metalness ?? 0.25;
}

export function resolveAsteroidEmissiveIntensity(
  scanned: boolean,
  hovered: boolean,
  revealedMaterial: AsteroidMaterialProfile | null,
): number {
  if (!scanned) {
    return hovered ? 0.5 : 0.25;
  }

  return 0.95 + (revealedMaterial?.emissiveBoost ?? 0);
}

export function resolveAsteroidRockRevealSelection(params: {
  asteroidId: string;
  meshProfileKey: string | null;
  renderTier: AsteroidRenderTier;
  forceHeroDetail?: boolean;
}): AsteroidRockRevealSelection {
  const seedSuffix = params.meshProfileKey?.trim() ? params.meshProfileKey.trim() : params.asteroidId;
  let ordinalHash = 0;
  for (let i = 0; i < seedSuffix.length; i += 1) {
    ordinalHash = (ordinalHash + seedSuffix.charCodeAt(i) * (i + 1)) % 1000;
  }

  const ordinal = String(Math.max(1, ordinalHash)).padStart(3, '0');
  const syntheticSeed = `AST-SV-B-carbon-RK-${ordinal}-r1`;
  const sample = buildSw13bGeneratedVisualSample({
    seedId: syntheticSeed,
    surface: 'SV',
  });
  const metrics = computeSw13bVisualMetrics(sample);
  const heroTierBoost = params.renderTier === 'hero' || params.forceHeroDetail ? 1 : 0;

  if (metrics.sphericityProxy < 0.42 || metrics.silhouetteComplexityScore > 0.42 + heroTierBoost * 0.03) {
    return {
      geometry: 'dodecahedron',
      detail: heroTierBoost > 0 ? 3 : 2,
    };
  }

  if (metrics.silhouetteComplexityScore > 0.34 || metrics.featureDensity > 0.2) {
    return {
      geometry: 'icosahedron',
      detail: heroTierBoost > 0 ? 2 : 1,
    };
  }

  return {
    geometry: 'octahedron',
    detail: heroTierBoost > 0 ? 1 : 0,
  };
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
  shardStrength: number;
  razorStrength: number;
}): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(params.radius, params.detail);
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
  const shardAxes = Array.from({ length: params.shardStrength > 0.01 ? (params.shardStrength > 0.5 ? 8 : 5) : 0 }, (_, index) => {
    const axis = createUnitVectorFromSeed(seed, 0xc2b2ae35 + index * 67);
    const taper = 0.04 + seededUnit(seed, 0x27d4eb2f + index * 71) * 0.14;
    const length = 0.32 + seededUnit(seed, 0x165667b1 + index * 73) * 0.42;
    return { axis, taper, length };
  });
  const razorAxes = Array.from({ length: params.razorStrength > 0.15 ? (params.razorStrength > 0.6 ? 6 : 3) : 0 }, (_, index) => {
    const axis = createUnitVectorFromSeed(seed, 0x94d049bb + index * 79);
    const taper = 0.01 + seededUnit(seed, 0xa0761d65 + index * 83) * 0.08;
    const length = 0.42 + seededUnit(seed, 0xe7037ed1 + index * 89) * 0.58;
    return { axis, taper, length };
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
      Math.sin(nx * 2.7 + ny * 0.8 + nz * 0.45 + phaseA) +
      Math.sin(ny * 2.4 + nz * 0.7 + nx * 0.35 + phaseB) +
      Math.sin(nz * 2.9 + nx * 0.6 + ny * 0.3 + phaseC);
    const meso =
      Math.sin((nx - ny * 0.75 + nz * 0.32) * 5.4 + phaseD) * 0.45 +
      Math.sin((ny - nz * 0.7 + nx * 0.28) * 5.1 + phaseE) * 0.38;
    const lobePrimary = nx * lobeAxisPrimary[0] + ny * lobeAxisPrimary[1] + nz * lobeAxisPrimary[2];
    const lobeSecondary = nx * lobeAxisSecondary[0] + ny * lobeAxisSecondary[1] + nz * lobeAxisSecondary[2];
    const lobeTertiary = nx * lobeAxisTertiary[0] + ny * lobeAxisTertiary[1] + nz * lobeAxisTertiary[2];
    const lobe =
      Math.pow(Math.max(0, lobePrimary), 2.3) * params.lobeStrength * 0.95 -
      Math.pow(Math.max(0, -lobeSecondary), 2.2) * params.lobeStrength * 0.72 +
      Math.pow(Math.max(0, lobeTertiary), 1.8) * params.lobeStrength * 0.42 -
      Math.pow(Math.max(0, -lobeTertiary), 1.6) * params.lobeStrength * 0.28;

    let displacement = macro * params.displacement * 0.26 + meso * params.displacement * 0.21 + lobe * 0.31;

    for (const crater of craterCenters) {
      const dot = nx * crater.center[0] + ny * crater.center[1] + nz * crater.center[2];
      const angularDistance = 1 - dot;
      if (angularDistance < crater.radius) {
        const t = 1 - angularDistance / crater.radius;
        displacement -= t * t * crater.depth;
      }
    }

    for (const shard of shardAxes) {
      const dot = nx * shard.axis[0] + ny * shard.axis[1] + nz * shard.axis[2];
      if (dot > shard.taper) {
        const t = (dot - shard.taper) / Math.max(0.001, 1 - shard.taper);
        displacement += Math.pow(t, 2.35) * shard.length * params.shardStrength;
      }
      if (dot < -0.1) {
        const t = Math.min(1, (-0.1 - dot) / 0.35);
        displacement -= Math.pow(t, 1.95) * shard.length * 0.18 * params.shardStrength;
      }
    }

    for (const razor of razorAxes) {
      const dot = nx * razor.axis[0] + ny * razor.axis[1] + nz * razor.axis[2];
      if (dot > razor.taper) {
        const t = (dot - razor.taper) / Math.max(0.001, 1 - razor.taper);
        displacement += Math.pow(t, 1.7) * razor.length * params.razorStrength;
      }
      if (dot < -0.18) {
        const t = Math.min(1, (-0.18 - dot) / 0.24);
        displacement -= Math.pow(t, 1.55) * razor.length * 0.24 * params.razorStrength;
      }
    }

    displacement = Math.max(-0.76, Math.min(0.72, displacement));
    const radius = Math.max(params.radius * params.minRadiusRatio, params.radius * (1 + displacement));
    position.setXYZ(index, nx * radius, ny * radius, nz * radius);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function resolveAsteroidRockGeometry(params: {
  asteroidId: string;
  meshProfileKey: string | null;
  renderTier: AsteroidRenderTier;
  detail: number;
  forceHeroDetail?: boolean;
}): THREE.BufferGeometry {
  const seedSource = params.meshProfileKey?.trim() ? params.meshProfileKey.trim() : params.asteroidId;
  const heroBoost = params.renderTier === 'hero' || params.forceHeroDetail ? 1 : 0;
  const cacheKey = `${seedSource}|${params.renderTier}|${params.detail}|${params.forceHeroDetail ? 'forced-hero' : 'normal'}`;
  const cached = ASTEROID_ROCK_GEOMETRY_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const seed = createDeterministicSeed(seedSource);
  const swayA = seededUnit(seed, 0xabc001);
  const swayB = seededUnit(seed, 0xabc002);
  const swayC = seededUnit(seed, 0xabc003);
  const shardStrength = heroBoost > 0 ? Math.max(0, Math.min(1, 0.35 + swayC * 0.55)) : Math.max(0, Math.min(0.22, swayC * 0.18));
  const razorStrength = heroBoost > 0 ? Math.min(1, 0.42 + swayA * 0.48 + shardStrength * 0.2) : Math.min(0.26, 0.08 + swayA * 0.14);
  const geometry = buildDeterministicRockGeometry({
    radius: 0.55,
    detail: Math.max(1, Math.min(3, params.detail)),
    seed: seedSource,
    displacement: +(0.16 + swayA * 0.08 + heroBoost * 0.06).toFixed(4),
    craterCount: Math.max(4, Math.floor(4 + swayC * 4 + heroBoost * 2)),
    lobeStrength: +(0.42 + swayB * 0.18 + heroBoost * 0.12).toFixed(4),
    minRadiusRatio: heroBoost > 0 ? 0.18 : 0.5,
    shardStrength: heroBoost > 0 ? Math.min(1, shardStrength + 0.4) : shardStrength,
    razorStrength,
  });
  ASTEROID_ROCK_GEOMETRY_CACHE.set(cacheKey, geometry);
  return geometry;
}

@Component({
  selector: 'app-asteroid',
  templateUrl: './asteroid.html',
  imports: [NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Asteroid {
  asteroidId = input('sample-1');
  position = input<[number, number, number]>([0, 0, 0]);
  targetingHold = input(false);
  targeted = input(false);
  scanProgress = input(0);
  scanned = input(false);
  revealedMaterial = input<AsteroidMaterialProfile | null>(null);
  revealedKinematics = input<AsteroidKinematics | null>(null);
  revealedLocation = input<CelestialBodyLocation | null>(null);
  revealedClusterCenterKm = input<Triple | null>(null);
  renderTier = input<AsteroidRenderTier>('near');
  detailOverride = input<number | null>(null);
  meshProfileKey = input<string | null>(null);

  @Output() hoverChange = new EventEmitter<AsteroidHoverEvent>();
  @Output() pointerButtonDown = new EventEmitter<AsteroidPointerButtonEvent>();
  @Output() pointerButtonUp = new EventEmitter<AsteroidPointerButtonEvent>();

  private meshRef = viewChild.required<ElementRef<THREE.Mesh>>('mesh');
  private revealProfile = signal<AsteroidRevealProfile>(generateRandomAsteroidRevealProfile());
  private completionEdgePrimed = false;
  private morphPulseElapsedSeconds = signal(MORPH_PULSE_DURATION_SECONDS);
  protected hovered = signal(false);
  protected pulsePhase = signal(0);
  protected Math = Math;
  protected morphPulse = computed(() => {
    const elapsed = this.morphPulseElapsedSeconds();
    if (elapsed >= MORPH_PULSE_DURATION_SECONDS) {
      return 0;
    }

    const progress = elapsed / MORPH_PULSE_DURATION_SECONDS;
    return Math.sin(progress * Math.PI);
  });
  protected activeGeometry = computed(() => {
    const profile = this.revealProfile();
    return this.scanned() ? profile.revealGeometry : profile.geometry;
  });
  protected activeDetail = computed(() =>
    resolveAsteroidGeometryDetail(
      this.activeGeometry(),
      this.scanned() ? this.revealProfile().revealDetail : this.revealProfile().detail,
      this.scanned(),
      this.detailOverride(),
    ),
  );
  protected activeRockReveal = computed(() =>
    resolveAsteroidRockRevealSelection({
      asteroidId: this.asteroidId(),
      meshProfileKey: this.meshProfileKey(),
      renderTier: this.renderTier(),
      forceHeroDetail: this.scanned(),
    }),
  );
  protected activeRockGeometry = computed(() => this.activeRockReveal().geometry);
  protected activeRockDetail = computed(() => this.activeRockReveal().detail);
  protected activeRockPrimitiveGeometry = computed(() =>
    resolveAsteroidRockGeometry({
      asteroidId: this.asteroidId(),
      meshProfileKey: this.meshProfileKey(),
      renderTier: this.renderTier(),
      detail: this.activeRockDetail(),
      forceHeroDetail: this.scanned(),
    }),
  );
  protected visualState = computed<AsteroidVisualState>(() =>
    resolveAsteroidVisualState({
      hovered: this.hovered(),
      targetingHold: this.targetingHold(),
      targeted: this.targeted(),
      scanProgress: this.scanProgress(),
      scanned: this.scanned(),
      tier: this.renderTier(),
    }),
  );
  protected meshScale = computed<[number, number, number]>(() => {
    const state = this.visualState();
    let base = 1;
    if (state.interaction === 'targeted') {
      base = 1.09;
    } else if (state.interaction === 'targeting') {
      base = 1.06;
    } else if (state.interaction === 'hovered') {
      base = 1.03;
    } else if (state.interaction === 'scanned') {
      base = 1.08;
    }
    const profileScale = this.revealProfile().scale;
    const morph = this.morphPulse();
    const x = (1 + morph * 0.14) * profileScale[0];
    const y = (1 - morph * 0.08) * profileScale[1];
    const z = (1 + morph * 0.18) * profileScale[2];
    return [base * x, base * y, base * z];
  });
  protected morphShellScale = computed(() => 1 + this.morphPulse() * 0.4);
  protected morphShellOpacity = computed(() => this.morphPulse() * 0.55);
  protected morphTiltX = computed(() => Math.sin(this.pulsePhase() * 2.3) * this.morphPulse() * 0.16);
  protected morphTiltZ = computed(() => Math.cos(this.pulsePhase() * 1.9) * this.morphPulse() * 0.12);
  protected revealedMaterialColor = computed(() => this.revealedMaterial()?.textureColor ?? '#8df7b2');
  protected pbrRoughness = computed(() => resolveAsteroidPbrRoughness(this.scanned(), this.revealedMaterial()));
  protected pbrMetalness = computed(() => resolveAsteroidPbrMetalness(this.scanned(), this.revealedMaterial()));
  protected emissiveColor = computed(() => resolveAsteroidEmissiveColorFromState(this.visualState(), this.revealedMaterial()));
  protected resolvedEmissiveIntensity = computed(() =>
    resolveAsteroidEmissiveIntensityFromState(this.visualState(), this.revealedMaterial()),
  );
  protected showResultDialog = computed(() => this.scanned() && this.hovered() && !!this.revealedMaterial());
  protected resultDialogMaterialText = computed(() => `MATERIAL: ${this.revealedMaterial()?.material ?? 'UNKNOWN'}`);
  protected resultDialogRarityText = computed(() => `RARITY: ${this.revealedMaterial()?.rarity ?? 'UNKNOWN'}`);
  protected resultDialogVelocityText = computed(() => {
    const k = this.revealedKinematics();
    if (!k) return 'VEL: ---';
    const { x, y, z } = k.velocityKmPerSec;
    const speed = Math.sqrt(x * x + y * y + z * z);
    return `VEL: ${speed.toFixed(1)} km/s`;
  });
  protected resultDialogSpinText = computed(() => {
    const k = this.revealedKinematics();
    if (!k) return 'SPIN: ---';
    const { x, y, z } = k.angularVelocityRadPerSec;
    const spin = Math.sqrt(x * x + y * y + z * z);
    return `SPIN: ${spin.toFixed(4)} rad/s`;
  });
  protected resultDialogMassText = computed(() => {
    const k = this.revealedKinematics();
    if (!k) return 'MASS: ---';
    const kg = k.estimatedMassKg;
    if (kg >= 1e12) return `MASS: ${(kg / 1e12).toFixed(2)}e12 kg`;
    if (kg >= 1e9) return `MASS: ${(kg / 1e9).toFixed(2)}e9 kg`;
    return `MASS: ${kg.toFixed(0)} kg`;
  });
  protected resultDialogDiameterText = computed(() => {
    const k = this.revealedKinematics();
    if (!k) return 'DIAM: ---';
    return k.estimatedDiameterM >= 1000
      ? `DIAM: ${(k.estimatedDiameterM / 1000).toFixed(2)} km`
      : `DIAM: ${k.estimatedDiameterM} m`;
  });
  protected resultDialogLocationText = computed(() => {
    const location = this.revealedLocation();
    if (!location) return 'LOC: ---';

    const { x, y, z } = location.positionKm;
    const xM = (x / 1e6).toFixed(3);
    const yM = (y / 1e6).toFixed(3);
    const zM = (z / 1e6).toFixed(3);
    return `LOC(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
  });
  protected resultDialogClusterText = computed(() => {
    const center = this.revealedClusterCenterKm();
    if (!center) return 'CLUSTER(Mkm): ---';

    const xM = (center.x / 1e6).toFixed(3);
    const yM = (center.y / 1e6).toFixed(3);
    const zM = (center.z / 1e6).toFixed(3);
    return `CLUSTER(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
  });
  protected resultDialogOffsetText = computed(() => {
    const location = this.revealedLocation();
    const center = this.revealedClusterCenterKm();
    if (!location || !center) return 'OFFSET(km): ---';

    const dx = location.positionKm.x - center.x;
    const dy = location.positionKm.y - center.y;
    const dz = location.positionKm.z - center.z;
    const distance = Math.hypot(dx, dy, dz);
    return `OFFSET(km): dX ${dx.toFixed(0)} dY ${dy.toFixed(0)} dZ ${dz.toFixed(0)} | R ${distance.toFixed(0)}`;
  });
  private cameraDistance = signal(1);
  protected dialogScale = computed(() => {
    const d = this.cameraDistance();
    // Keep billboard at a constant apparent size; calibrated to look right at ~6 units
    return Math.max(1, d / 6);
  });
  protected materialColor = computed(() => resolveAsteroidMaterialColorFromState(this.visualState(), this.revealedMaterial()));
  protected beamOpacity = computed(() => resolveAsteroidBeamOpacityFromState(this.visualState()));
  protected showScanFx = computed(() => {
    if (this.morphPulse() > 0) {
      return true;
    }
    const interaction = this.visualState().interaction;
    return interaction === 'scanning' || interaction === 'hovered' || interaction === 'targeting';
  });
  protected ringOpacityA = computed(() =>
    this.showScanFx() ? Math.min(1, 0.18 + this.scanProgress() * 0.0042 + this.morphPulse() * 0.36) : 0,
  );
  protected ringOpacityB = computed(() =>
    this.showScanFx() ? Math.min(1, 0.12 + this.scanProgress() * 0.0028 + this.morphPulse() * 0.24) : 0,
  );
  protected ringOpacityC = computed(() =>
    this.showScanFx() ? Math.min(1, 0.08 + this.scanProgress() * 0.002 + this.morphPulse() * 0.2) : 0,
  );
  protected ringScaleA = computed(() => 1 + Math.sin(this.pulsePhase()) * 0.06 + this.morphPulse() * 0.16);
  protected ringScaleB = computed(() => 1 + Math.sin(this.pulsePhase() + 1.1) * 0.08 + this.morphPulse() * 0.2);
  protected ringScaleC = computed(() => 1 + Math.sin(this.pulsePhase() + 2.2) * 0.1 + this.morphPulse() * 0.24);
  protected sweepOffsetY = computed(() => Math.sin(this.pulsePhase() * 2.2) * 0.43);
  protected sweepOpacity = computed(() => resolveAsteroidSweepOpacityFromState(this.visualState()));
  protected targetHoldRingOpacity = computed(() => (this.visualState().interaction === 'targeting' ? 0.95 : 0));
  protected targetedRingOpacity = computed(() => (this.visualState().interaction === 'targeted' ? 0.94 : 0));

  private readonly meshProfileSync = effect(() => {
    const parsed = resolveAsteroidMeshProfile(this.meshProfileKey(), this.revealProfile());
    if (parsed.meshProfileKey === this.revealProfile().meshProfileKey) {
      return;
    }

    this.revealProfile.set(parsed);
  });

  constructor() {
    const beforeRender = inject(ASTEROID_BEFORE_RENDER_FN);
    const injectStoreFn = inject(ASTEROID_INJECT_STORE_FN);
    const store = injectStoreFn();
    const _pos = new THREE.Vector3();

    effect(() => {
      const scanComplete = this.scanProgress() >= 100;
      if (!this.completionEdgePrimed && scanComplete && !this.scanned()) {
        this.morphPulseElapsedSeconds.set(0);
      }

      this.completionEdgePrimed = scanComplete;
    });

    beforeRender(({ delta }) => {
      const mesh = this.meshRef().nativeElement;
      const k = this.revealedKinematics();
      if (k && this.scanned()) {
        // Scale rad/s values up so subtle kinematics are visible in scene units
        const SPIN_SCALE = 20;
        mesh.rotation.x += delta * k.angularVelocityRadPerSec.x * SPIN_SCALE;
        mesh.rotation.y += delta * k.angularVelocityRadPerSec.y * SPIN_SCALE;
        mesh.rotation.z += delta * k.angularVelocityRadPerSec.z * SPIN_SCALE;
      } else {
        mesh.rotation.y += delta * 0.45;
        mesh.rotation.x += delta * 0.1;
      }
      this.morphPulseElapsedSeconds.update((elapsed) => Math.min(MORPH_PULSE_DURATION_SECONDS, elapsed + delta));
      this.pulsePhase.update((phase) => (phase + delta * 2.1) % (Math.PI * 2));

      const pos = this.position();
      _pos.set(pos[0], pos[1], pos[2]);
      const cam = store.snapshot.camera;
      this.cameraDistance.set(cam.position.distanceTo(_pos));
    });
  }

  protected emitHover(hovering: boolean): void {
    this.hovered.set(hovering);
    this.hoverChange.emit({
      id: this.asteroidId(),
      hovering,
    });
  }

  protected onPointerDown(event: {
    button?: number;
    buttons?: number;
    nativeEvent?: { button?: number; buttons?: number };
  }): void {
    const button = event.button ?? event.nativeEvent?.button;
    const buttons = event.buttons ?? event.nativeEvent?.buttons;
    const isRightButton = button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
    if (!isRightButton) {
      return;
    }

    this.pointerButtonDown.emit({
      id: this.asteroidId(),
      button: 2,
    });
  }

  protected onPointerUp(event: { button?: number; nativeEvent?: { button?: number } }): void {
    const button = event.button ?? event.nativeEvent?.button;
    if (button !== 2) {
      return;
    }

    this.pointerButtonUp.emit({
      id: this.asteroidId(),
      button,
    });
  }
}
