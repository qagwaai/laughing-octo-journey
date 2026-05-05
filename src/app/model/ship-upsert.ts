import { SpatialState } from './spatial';
import { ShipMotion } from './ship-list';
import { ShipItem } from './ship-item';
import { ShipDamageProfile } from './ship-damage';

export const SHIP_UPSERT_REQUEST_EVENT = 'ship-upsert-request';
export const SHIP_UPSERT_RESPONSE_EVENT = 'ship-upsert-response';

export interface ShipUpsertPayload {
	id: string;
	status?: string;
	model?: string;
	tier?: number;
	launchable?: boolean;
	damageProfile?: ShipDamageProfile | null;
	spatial: SpatialState;
	motion?: ShipMotion;
}

export interface ShipUpsertResponsePayload {
	id: string;
	shipName: string;
	status?: string;
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
	ship: ShipUpsertPayload;
}

export interface ShipUpsertResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	ship?: ShipUpsertResponsePayload;
}
