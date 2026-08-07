import * as THREE from 'three';
import type { ShipSceneAsteroidSample } from './ship-scene-types';

export interface ShipExteriorAsteroidVisual {
  id: string;
  position: [number, number, number];
  radius: number;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  detail: number;
  isTargeted: boolean;
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

function createAsteroidPalette(
  seed: number,
  scanned: boolean,
  targeted: boolean,
  materialName: string | null,
): { color: number; emissive: number; emissiveIntensity: number } {
  if (targeted) {
    return {
      color: new THREE.Color('#f59e0b').getHex(),
      emissive: new THREE.Color('#7c2d12').getHex(),
      emissiveIntensity: 0.65,
    };
  }

  if (scanned) {
    const hue = (seed % 36) * 10 + (materialName ? materialName.length * 2 : 0);
    return {
      color: new THREE.Color(`hsl(${hue % 360}, 78%, 61%)`).getHex(),
      emissive: new THREE.Color('#3f2d13').getHex(),
      emissiveIntensity: 0.32,
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
      `${index}:${sample.id}:${sample.scanned ? 1 : 0}:${sample.scanProgress}:${sample.revealedMaterial?.material ?? 'unknown'}`,
  );
  return `${hashStringToSeed(`${shipId}:${targetedAsteroidId ?? 'none'}`).toString(16)}:${parts.join('|')}`;
}

export function deriveAsteroidVisuals(
  shipId: string,
  samples: readonly ShipSceneAsteroidSample[],
  targetedAsteroidId: string | null,
): ShipExteriorAsteroidVisual[] {
  const visuals: ShipExteriorAsteroidVisual[] = [];
  const shipSeed = hashStringToSeed(shipId);

  samples.forEach((sample, index) => {
    const sampleSeed = hashStringToSeed(`${shipId}:${sample.id}:${index}`);
    const random = createSeededRng(sampleSeed);
    const theta = random() * Math.PI * 2;
    const phi = (random() - 0.5) * 0.7;
    const distance = 3.2 + random() * 3.8;
    const x = Math.cos(theta) * distance;
    const y = Math.sin(phi) * 1.35;
    const z = Math.sin(theta) * distance;
    const radius = 0.18 + random() * 0.2;
    const targeted = targetedAsteroidId === sample.id;
    const palette = createAsteroidPalette(sampleSeed ^ shipSeed, sample.scanned, targeted, sample.revealedMaterial?.material ?? null);

    visuals.push({
      id: sample.id,
      position: [x, y, z],
      radius,
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: palette.emissiveIntensity,
      detail: sample.scanned ? 1 : 0,
      isTargeted: targeted,
    });
  });

  return visuals;
}
