/**
 * Starter ship deterministic generation helpers for initial character setup.
 */
import { generateRandomAsteroidBeltClusterCenterKm } from '../math/celestial-body-location';
import { SpatialState } from '../math/spatial';
import { DEFAULT_SHIP_MODEL, DEFAULT_SHIP_TIER, ShipMotion } from '../ship-list';
import { ShipItem } from '../ship-item';
import { ShipUpsertPayload } from '../ship-upsert';

const STARTER_INVENTORY_TEMPLATE: ReadonlyArray<{
  itemType: string;
  displayName: string;
  launchable: boolean;
  tier: number;
}> = [
  {
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    launchable: true,
    tier: 1,
  },
  {
    itemType: 'sensor-array',
    displayName: 'Sensor Array',
    launchable: false,
    tier: 1,
  },
  {
    itemType: 'ship-tractor-beam',
    displayName: 'Tractor Beam',
    launchable: false,
    tier: 1,
  },
];

function hashToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildStarterShipMotion(spatial: SpatialState, random: () => number): ShipMotion {
  const { x, z } = spatial.positionKm;
  const planar = Math.hypot(x, z);
  const tangentX = planar > 0 ? -z / planar : 0;
  const tangentZ = planar > 0 ? x / planar : 1;

  // Realistic asteroid-belt-ish speed with slight deterministic variance.
  const speedKmPerSec = 15 + random() * 5;

  return {
    velocityKmPerSec: {
      x: +(tangentX * speedKmPerSec).toFixed(4),
      y: +((random() - 0.5) * 0.08).toFixed(4),
      z: +(tangentZ * speedKmPerSec).toFixed(4),
    },
  };
}

export function createCanonicalStarterShipInventory(shipId: string): ShipItem[] {
  const now = new Date().toISOString();
  return STARTER_INVENTORY_TEMPLATE.map((template) => ({
    id: `${shipId}-${template.itemType}`,
    itemType: template.itemType,
    displayName: template.displayName,
    tier: template.tier,
    launchable: template.launchable,
    state: 'contained',
    damageStatus: 'intact',
    container: null,
    owningPlayerId: null,
    owningCharacterId: null,
    spatial: null,
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: now,
    updatedAt: now,
  }));
}

export function generateDeterministicStarterShipUpdate(
  playerName: string,
  characterId: string,
  shipId: string,
): ShipUpsertPayload {
  const random = seededRandom(hashToSeed(`${playerName}::${characterId}`));
  const center = generateRandomAsteroidBeltClusterCenterKm(random);
  const spatial: SpatialState = {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: center,
    epochMs: Date.now(),
  };
  const motion = buildStarterShipMotion(spatial, random);
  const inventory = createCanonicalStarterShipInventory(shipId);

  return {
    id: shipId,
    model: DEFAULT_SHIP_MODEL,
    tier: DEFAULT_SHIP_TIER,
    inventory,
    spatial,
    motion,
  } satisfies ShipUpsertPayload;
}
