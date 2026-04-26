import { ItemContainer, ItemDamageStatus, ItemKinematics, ItemState, ShipItem } from './ship-item';

export const ITEM_UPSERT_REQUEST_EVENT = 'item-upsert-request';
export const ITEM_UPSERT_RESPONSE_EVENT = 'item-upsert-response';

export interface ItemUpsertPayload {
	id?: string;
	itemType?: string;
	displayName?: string;
	state?: ItemState;
	damageStatus?: ItemDamageStatus;
	container?: ItemContainer | null;
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
	item: ItemUpsertPayload;
}

export interface ItemUpsertResponse {
	success: boolean;
	message: string;
	playerName: string;
	item?: ShipItem;
}
