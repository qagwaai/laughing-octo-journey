import { ItemContainer, ItemDamageStatus, ItemKinematics, ItemState, ShipItem } from './ship-item';
import { MotionState, SpatialState } from './spatial';

export const ITEM_UPSERT_REQUEST_EVENT = 'item-upsert-request';
export const ITEM_UPSERT_RESPONSE_EVENT = 'item-upsert-response';

export interface ItemUpsertPayload {
  id?: string;
  itemType?: string;
  displayName?: string;
  tier?: number;
  launchable?: boolean;
  state?: ItemState;
  damageStatus?: ItemDamageStatus;
  container?: ItemContainer | null;
  /** Canonical spatial state (null for contained items). */
  spatial?: SpatialState | null;
  /** Optional motion state; only present when item is in motion. */
  motion?: MotionState | null;
  /** Legacy kinematics (deprecated; use spatial/motion instead). */
  kinematics?: ItemKinematics | null;
  owningPlayerId?: string | null;
  owningCharacterId?: string | null;
  destroyedAt?: string | null;
  destroyedReason?: string | null;
  discoveredAt?: string | null;
  discoveredByCharacterId?: string | null;
}

export interface ItemUpsertRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  item: ItemUpsertPayload;
}

export interface ItemUpsertResponse {
  success: boolean;
  message: string;
  playerName: string;
  item?: ShipItem;
}
