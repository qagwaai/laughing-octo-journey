import { Triple } from './triple';
import { CelestialBodyLocation } from './celestial-body-location';

export const SHIP_LIST_REQUEST_EVENT = 'ship-list-request';
export const SHIP_LIST_RESPONSE_EVENT = 'ship-list-response';
export const DEFAULT_SHIP_MODEL = 'Scavenger Pod';
export const DEFAULT_SHIP_TIER = 1;
export const MIN_SHIP_TIER = 1;
export const MAX_SHIP_TIER = 10;
export const EXPENDABLE_DART_DRONE_INVENTORY_ITEM = 'Expendable Dart Drone';

// Kept as string for now to match the current server contract.
export type ShipInventoryItem = string;

export interface ShipListRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
}

export interface ShipSummary {
	id: string;
	name: string;
	status?: string;
	model: string;
	tier: number;
	inventory?: ShipInventoryItem[];
	location?: CelestialBodyLocation;
	kinematics?: ShipKinematics;
}

export function coerceShipModel(model: unknown): string {
	if (typeof model !== 'string') {
		return DEFAULT_SHIP_MODEL;
	}

	const trimmed = model.trim();
	return trimmed.length > 0 ? trimmed : DEFAULT_SHIP_MODEL;
}

export function coerceShipTier(tier: unknown): number {
	if (typeof tier !== 'number' || !Number.isInteger(tier)) {
		return DEFAULT_SHIP_TIER;
	}

	if (tier < MIN_SHIP_TIER || tier > MAX_SHIP_TIER) {
		return DEFAULT_SHIP_TIER;
	}

	return tier;
}

export function coerceShipInventory(inventory: unknown): ShipInventoryItem[] {
	if (!Array.isArray(inventory)) {
		return [];
	}

	return inventory
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function getDefaultInventoryForShipModel(model: unknown): ShipInventoryItem[] {
	if (coerceShipModel(model) === DEFAULT_SHIP_MODEL) {
		return [EXPENDABLE_DART_DRONE_INVENTORY_ITEM];
	}

	return [];
}

export function coerceShipInventoryWithBackfill(inventory: unknown, model: unknown): ShipInventoryItem[] {
	const normalizedInventory = coerceShipInventory(inventory);
	if (normalizedInventory.length > 0 || inventory !== undefined) {
		return normalizedInventory;
	}

	return getDefaultInventoryForShipModel(model);
}

export type SpatialReferenceKind = 'barycentric' | 'body-centered';

export interface SpatialReference {
	solarSystemId: string;
	referenceKind: SpatialReferenceKind;
	referenceBodyId?: string;
	distanceUnit: 'km';
	velocityUnit: 'km/s';
	epochMs: number;
}

export interface ShipKinematics {
	position: Triple;
	velocity: Triple;
	reference: SpatialReference;
}

export interface ShipListResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	ships: ShipSummary[];
}
