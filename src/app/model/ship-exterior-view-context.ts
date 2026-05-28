/**
 * Navigation/state context contracts for ship exterior view mission initialization.
 */
import type { MissionStatus } from './mission';
import type { ShipDamagePreset } from './ship-damage';

export type ShipExteriorViewSeedPolicy = 'auto' | 'new' | 'resume';

export interface ShipExteriorViewMissionContext {
  missionId: string;
  missionStatusHint?: MissionStatus;
  seedPolicy?: ShipExteriorViewSeedPolicy;
  shipDamagePreset?: ShipDamagePreset;
}

export function resolveShipExteriorViewSeedPolicy(params: {
  seedPolicy?: ShipExteriorViewSeedPolicy;
  missionStatusHint?: MissionStatus | null;
}): Exclude<ShipExteriorViewSeedPolicy, 'auto'> {
  if (params.seedPolicy === 'new' || params.seedPolicy === 'resume') {
    return params.seedPolicy;
  }

  const status = params.missionStatusHint?.trim().toUpperCase();
  if (!status) {
    // Default to resume so exterior view can rehydrate persisted or backend state
    // even when the caller does not provide a mission status hint.
    return 'resume';
  }

  if (status === 'ACTIVE' || status === 'COMPLETED') {
    return 'resume';
  }

  if (status === 'AVAILABLE') {
    return 'new';
  }

  return 'new';
}
