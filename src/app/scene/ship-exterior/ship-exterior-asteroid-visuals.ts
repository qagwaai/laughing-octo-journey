import * as THREE from 'three';
import { ASTEROID_MATERIALS, type AsteroidMaterialProfile } from '../../model/catalog/asteroid-materials';
import type { AsteroidRenderTier } from './asteroid-tier-selection';
import type { ShipSceneAsteroidSample } from './ship-scene-types';

export interface ShipExteriorAsteroidVisual {
  id: string;
  position: [number, number, number];
  radius: number;
  scale: number;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  detail: number;
  meshProfileKey: string | null;
  isScanned: boolean;
  materialProfile: AsteroidMaterialProfile | null;
  renderTier: AsteroidRenderTier;
  isHovered: boolean;
  isTargeted: boolean;
}

type AsteroidRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | string;

// Matches the generated range in generateRandomAsteroidKinematics (asteroid-kinematics.ts).
const ASTEROID_DIAMETER_MIN_M = 40;
const ASTEROID_DIAMETER_MAX_M = 9400;
const ASTEROID_DIAMETER_RADIUS_MIN = 0.16;
const ASTEROID_DIAMETER_RADIUS_MAX = 0.62;
// Small secondary variation layered on top of the diameter-driven radius so asteroids keep some
// organic per-instance variety without ever overriding the primary diameter size signal.
const ASTEROID_RADIUS_SECONDARY_JITTER_SPAN = 0.2;

/**
 * Maps an estimated diameter (metres) to a clamped, logarithmic base radius in scene units.
 * This is the primary driver of a scanned asteroid's rendered size. Returns null for
 * missing/invalid diameters so callers can fall back to the pre-scan/legacy radius, keeping
 * pre-scan visuals free of hidden physical data.
 */
export function resolveAsteroidDiameterRadius(diameterM: number | null | undefined): number | null {
  if (diameterM == null || !Number.isFinite(diameterM) || diameterM <= 0) {
    return null;
  }
  const clamped = Math.min(ASTEROID_DIAMETER_MAX_M, Math.max(ASTEROID_DIAMETER_MIN_M, diameterM));
  const logMin = Math.log(ASTEROID_DIAMETER_MIN_M);
  const logMax = Math.log(ASTEROID_DIAMETER_MAX_M);
  const t = (Math.log(clamped) - logMin) / (logMax - logMin);
  return ASTEROID_DIAMETER_RADIUS_MIN + t * (ASTEROID_DIAMETER_RADIUS_MAX - ASTEROID_DIAMETER_RADIUS_MIN);
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalizeRarity(rarity: AsteroidRarity | null | undefined): string {
  return rarity?.trim().toLowerCase() ?? 'common';
}

function resolveCatalogMaterial(materialName: string | null): AsteroidMaterialProfile | null {
  return ASTEROID_MATERIALS.find((item) => item.material === materialName) ?? null;
}

function getAsteroidVisualProfile(rarity: AsteroidRarity | null | undefined): {
  radiusScale: number;
  detail: number;
  emissiveIntensity: number;
  saturation: number;
  lightness: number;
} {
  switch (normalizeRarity(rarity)) {
    case 'legendary':
      return { radiusScale: 1.24, detail: 2, emissiveIntensity: 0.38, saturation: 88, lightness: 66 };
    case 'epic':
      return { radiusScale: 1.18, detail: 2, emissiveIntensity: 0.34, saturation: 84, lightness: 63 };
    case 'rare':
      return { radiusScale: 1.12, detail: 1, emissiveIntensity: 0.3, saturation: 80, lightness: 61 };
    case 'uncommon':
      return { radiusScale: 1.06, detail: 1, emissiveIntensity: 0.26, saturation: 74, lightness: 58 };
    default:
      return { radiusScale: 1, detail: 0, emissiveIntensity: 0.22, saturation: 68, lightness: 54 };
  }
}

function createAsteroidPalette(
  seed: number,
  scanned: boolean,
  hovered: boolean,
  targeted: boolean,
  materialName: string | null,
  rarity: AsteroidRarity | null | undefined,
): { color: number; emissive: number; emissiveIntensity: number } {
  // Once an asteroid has been scanned, its revealed material color is the authoritative
  // "hero tier" appearance. Targeting/hover only add a static bracket/ring overlay and must
  // not override this true material color, so the scanned catalog lookup takes priority here.
  if (scanned) {
    const catalogMaterial = resolveCatalogMaterial(materialName);
    if (catalogMaterial) {
      const rarityProfile = getAsteroidVisualProfile(rarity);
      return {
        color: new THREE.Color(catalogMaterial.textureColor).getHex(),
        emissive: new THREE.Color(catalogMaterial.textureColor).multiplyScalar(0.28).getHex(),
        emissiveIntensity: 0.8 + rarityProfile.emissiveIntensity + (catalogMaterial.emissiveBoost ?? 0),
      };
    }

    const hue = (seed % 36) * 10 + (materialName ? materialName.length * 2 : 0);
    const profile = getAsteroidVisualProfile(rarity);
    return {
      color: new THREE.Color(`hsl(${hue % 360}, ${profile.saturation}%, ${profile.lightness}%)`).getHex(),
      emissive: new THREE.Color('#3f2d13').getHex(),
      emissiveIntensity: profile.emissiveIntensity,
    };
  }

  if (targeted) {
    return {
      color: new THREE.Color('#f59e0b').getHex(),
      emissive: new THREE.Color('#7c2d12').getHex(),
      emissiveIntensity: 0.65,
    };
  }

  if (hovered) {
    return {
      color: new THREE.Color('#b9f4ff').getHex(),
      emissive: new THREE.Color('#215d6f').getHex(),
      emissiveIntensity: 0.68,
    };
  }

  const hue = (seed % 18) * 20;
  return {
    color: new THREE.Color(`hsl(${hue % 360}, 12%, 38%)`).getHex(),
    emissive: new THREE.Color('#0f172a').getHex(),
    emissiveIntensity: 0.1,
  };
}

export function buildAsteroidLayoutSignature(
  shipId: string,
  samples: readonly ShipSceneAsteroidSample[],
  targetedAsteroidId: string | null,
): string {
  const parts = samples.map(
    (sample, index) =>
      [
        index,
        sample.id,
        sample.scanned ? 1 : 0,
        sample.scanProgress,
        sample.revealedMaterial?.material ?? 'unknown',
        sample.revealedMaterial?.rarity ?? 'common',
        sample.meshProfileKey ?? 'no-profile',
        sample.estimatedDiameterM ?? 'no-diameter',
      ].join(':'),
  );
  return `${hashStringToSeed(`${shipId}:${targetedAsteroidId ?? 'none'}`).toString(16)}:${parts.join('|')}`;
}

export function deriveAsteroidVisuals(
  shipId: string,
  samples: readonly ShipSceneAsteroidSample[],
  targetedAsteroidId: string | null,
  hoveredAsteroidId: string | null = null,
): ShipExteriorAsteroidVisual[] {
  const visuals: ShipExteriorAsteroidVisual[] = [];
  const shipSeed = hashStringToSeed(shipId);

  samples.forEach((sample, index) => {
    const sampleSeed = hashStringToSeed(`${shipId}:${sample.id}:${index}`);
    const random = createSeededRng(sampleSeed);
    const profile = getAsteroidVisualProfile(sample.revealedMaterial?.rarity ?? null);
    const theta = random() * Math.PI * 2;
    const phi = (random() - 0.5) * 0.7;
    const distance = 3.2 + random() * 3.8;
    const x = Math.cos(theta) * distance;
    const y = Math.sin(phi) * 1.35;
    const z = Math.sin(theta) * distance;
    const targeted = targetedAsteroidId === sample.id;
    const hovered = !targeted && hoveredAsteroidId === sample.id;
    const radiusJitterRoll = random();
    const legacyRadius = (0.18 + radiusJitterRoll * 0.2) * profile.radiusScale * (targeted ? 1.08 : 1);
    // Diameter drives radius directly once scanned, since it is the authoritative physical-size
    // signal; the historical rarity/random jitter becomes a small secondary variation on top of it
    // instead of competing with (and potentially inverting) the diameter-based size ordering.
    const diameterRadius = sample.scanned ? resolveAsteroidDiameterRadius(sample.estimatedDiameterM) : null;
    const secondaryJitter = 1 - ASTEROID_RADIUS_SECONDARY_JITTER_SPAN / 2 + radiusJitterRoll * ASTEROID_RADIUS_SECONDARY_JITTER_SPAN;
    const radius =
      diameterRadius != null ? diameterRadius * secondaryJitter * (targeted ? 1.08 : 1) : legacyRadius;
    const palette = createAsteroidPalette(
      sampleSeed ^ shipSeed,
      sample.scanned,
      hovered,
      targeted,
      sample.revealedMaterial?.material ?? null,
      sample.revealedMaterial?.rarity ?? null,
    );
    const materialProfile = sample.scanned ? resolveCatalogMaterial(sample.revealedMaterial?.material ?? null) : null;

    visuals.push({
      id: sample.id,
      position: [x, y, z],
      radius,
      scale: targeted ? 1.28 : hovered ? 1.22 : sample.scanned ? 1.08 : 0.94,
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: palette.emissiveIntensity,
      detail: targeted ? Math.max(2, profile.detail) : sample.scanned ? profile.detail : 0,
      meshProfileKey: sample.meshProfileKey ?? null,
      isScanned: sample.scanned,
      materialProfile,
      renderTier: 'hero',
      isHovered: hovered,
      isTargeted: targeted,
    });
  });

  return visuals;
}
