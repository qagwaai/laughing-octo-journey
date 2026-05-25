/**
 * Ship upsert socket contracts and payload shape for ship persistence updates.
 */
import type { ShipOwnership } from './ship-owner';
import { ShipDamageProfile } from './ship-damage';
import { ShipItem } from './ship-item';
import { ShipMotion } from './ship-list';
import { SpatialState } from './spatial';

export const SHIP_UPSERT_REQUEST_EVENT = 'ship-upsert-request';
export const SHIP_UPSERT_RESPONSE_EVENT = 'ship-upsert-response';

export interface ShipUpsertRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
  characterId?: string;
}

export interface ShipUpsertPayload {
  id: string;
  status?: string;
  ownership?: ShipOwnership | null;
  model?: string;
  tier?: number;
  launchable?: boolean;
  inventory?: ShipItem[];
  damageProfile?: ShipDamageProfile | null;
  spatial: SpatialState;
  motion?: ShipMotion;
}

export interface ShipUpsertResponsePayload {
  id: string;
  shipName: string;
  status?: string;
  ownership?: ShipOwnership | null;
  model: string;
  tier: number;
  launchable?: boolean;
  inventory?: ShipItem[];
  damageProfile?: ShipDamageProfile | null;
  spatial: SpatialState;
  motion?: ShipMotion;
}

export interface ShipUpsertRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
  claimToken?: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: ShipUpsertRequestIdentity;
  ship: ShipUpsertPayload;
}

export interface ShipUpsertResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId: string;
  correlationId?: string;
  requestIdentity?: ShipUpsertRequestIdentity;
  ship?: ShipUpsertResponsePayload;
}
