import { MotionState, SpatialState } from './spatial';
import { Triple } from './triple';

export const ITEM_STATES = ['contained', 'deployed', 'destroyed'] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export const ITEM_DAMAGE_STATUSES = ['intact', 'damaged', 'disabled', 'destroyed'] as const;
export type ItemDamageStatus = (typeof ITEM_DAMAGE_STATUSES)[number];

export const ITEM_CONTAINER_TYPES = ['ship', 'market'] as const;
export type ItemContainerType = (typeof ITEM_CONTAINER_TYPES)[number];

export interface ItemContainer {
  containerType: ItemContainerType;
  containerId: string;
}

/**
 * Legacy kinematics structure (deprecated).
 * @deprecated Use canonical spatial + optional motion instead
 */
export interface ItemKinematics {
  position: Triple;
  velocity: Triple;
  reference: ItemSpatialReference;
}

export interface ItemSpatialReference {
  solarSystemId: string;
  referenceKind: string;
  referenceBodyId: string | null;
  distanceUnit: string;
  velocityUnit: string;
  epochMs: number;
}

export interface ShipItem {
  id: string;
  itemType: string;
  displayName: string;
  tier?: number;
  launchable: boolean;
  state: ItemState;
  damageStatus: ItemDamageStatus;
  container: ItemContainer | null;
  owningPlayerId: string | null;
  owningCharacterId: string | null;
  /** Canonical spatial state (null for contained items). */
  spatial: SpatialState | null;
  /** Optional motion state; only present when item is in motion. */
  motion?: MotionState | null;
  /** Legacy kinematics (deprecated; replaced by spatial/motion). */
  kinematics?: ItemKinematics | null;
  destroyedAt: string | null;
  destroyedReason: string | null;
  discoveredAt: string | null;
  discoveredByCharacterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function coerceItemState(raw: unknown): ItemState {
  if (typeof raw === 'string' && (ITEM_STATES as readonly string[]).includes(raw)) {
    return raw as ItemState;
  }
  return 'contained';
}

export function coerceItemDamageStatus(raw: unknown): ItemDamageStatus {
  if (typeof raw === 'string' && (ITEM_DAMAGE_STATUSES as readonly string[]).includes(raw)) {
    return raw as ItemDamageStatus;
  }
  return 'intact';
}

export function coerceItemContainer(raw: unknown): ItemContainer | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const containerType = obj['containerType'];
  const containerId = typeof obj['containerId'] === 'string' ? obj['containerId'].trim() : '';
  if (!containerId) return null;
  if (!(ITEM_CONTAINER_TYPES as readonly unknown[]).includes(containerType)) return null;
  return { containerType: containerType as ItemContainerType, containerId };
}

export function coerceShipItem(raw: unknown): ShipItem | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj['id'] === 'string' ? obj['id'].trim() : '';
  if (!id) return null;
  const itemType = typeof obj['itemType'] === 'string' ? obj['itemType'].trim() : '';
  if (!itemType) return null;
  const rawDisplayName = typeof obj['displayName'] === 'string' ? obj['displayName'].trim() : '';
  const legacyName = typeof obj['name'] === 'string' ? obj['name'].trim() : '';
  const displayName = rawDisplayName || legacyName || itemType;
  const tier = typeof obj['tier'] === 'number' && Number.isInteger(obj['tier']) ? obj['tier'] : undefined;
  const launchable = typeof obj['launchable'] === 'boolean' ? obj['launchable'] : true;
  const now = new Date().toISOString();
  // Coerce spatial and motion from raw object
  let spatial: SpatialState | null = null;
  if (obj['spatial'] !== null && typeof obj['spatial'] === 'object' && !Array.isArray(obj['spatial'])) {
    const s = obj['spatial'] as Record<string, unknown>;
    if (
      typeof s['solarSystemId'] === 'string' &&
      s['frame'] === 'barycentric' &&
      typeof s['positionKm'] === 'object' &&
      typeof s['epochMs'] === 'number'
    ) {
      const pos = s['positionKm'] as Record<string, unknown>;
      if (typeof pos['x'] === 'number' && typeof pos['y'] === 'number' && typeof pos['z'] === 'number') {
        spatial = {
          solarSystemId: s['solarSystemId'] as string,
          frame: 'barycentric',
          positionKm: { x: pos['x'] as number, y: pos['y'] as number, z: pos['z'] as number },
          epochMs: s['epochMs'] as number,
        };
      }
    }
  }

  let motion: MotionState | null | undefined;
  if (spatial && obj['motion'] !== null && typeof obj['motion'] === 'object' && !Array.isArray(obj['motion'])) {
    const m = obj['motion'] as Record<string, unknown>;
    if (typeof m['velocityKmPerSec'] === 'object') {
      const vel = m['velocityKmPerSec'] as Record<string, unknown>;
      if (typeof vel['x'] === 'number' && typeof vel['y'] === 'number' && typeof vel['z'] === 'number') {
        motion = {
          velocityKmPerSec: { x: vel['x'] as number, y: vel['y'] as number, z: vel['z'] as number },
        };
        // Optional angular velocity
        if (typeof m['angularVelocityRadPerSec'] === 'object') {
          const angVel = m['angularVelocityRadPerSec'] as Record<string, unknown>;
          if (typeof angVel['x'] === 'number' && typeof angVel['y'] === 'number' && typeof angVel['z'] === 'number') {
            motion.angularVelocityRadPerSec = {
              x: angVel['x'] as number,
              y: angVel['y'] as number,
              z: angVel['z'] as number,
            };
          }
        }
      }
    }
  }

  return {
    id,
    itemType,
    displayName,
    tier,
    launchable,
    state: coerceItemState(obj['state']),
    damageStatus: coerceItemDamageStatus(obj['damageStatus']),
    container: coerceItemContainer(obj['container']),
    owningPlayerId: typeof obj['owningPlayerId'] === 'string' ? obj['owningPlayerId'] : null,
    owningCharacterId: typeof obj['owningCharacterId'] === 'string' ? obj['owningCharacterId'] : null,
    spatial,
    motion,
    destroyedAt: typeof obj['destroyedAt'] === 'string' ? obj['destroyedAt'] : null,
    destroyedReason: typeof obj['destroyedReason'] === 'string' ? obj['destroyedReason'] : null,
    discoveredAt: typeof obj['discoveredAt'] === 'string' ? obj['discoveredAt'] : null,
    discoveredByCharacterId: typeof obj['discoveredByCharacterId'] === 'string' ? obj['discoveredByCharacterId'] : null,
    createdAt: typeof obj['createdAt'] === 'string' ? obj['createdAt'] : now,
    updatedAt: typeof obj['updatedAt'] === 'string' ? obj['updatedAt'] : now,
  };
}
