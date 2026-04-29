import { Triple } from './triple';
import { CelestialBodyLocation } from './celestial-body-location';
import { ShipItem, coerceShipItem } from './ship-item';
import { coerceShipDamageProfile, type ShipDamageProfile } from './ship-damage';

export { ShipItem } from './ship-item';

export const SHIP_LIST_REQUEST_EVENT = 'ship-list-request';
export const SHIP_LIST_RESPONSE_EVENT = 'ship-list-response';
export const DEFAULT_SHIP_MODEL = 'Scavenger Pod';
export const DEFAULT_SHIP_TIER = 1;
export const MIN_SHIP_TIER = 1;
export const MAX_SHIP_TIER = 10;

export interface ShipListRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
}

export interface ShipSummary {
	id: string;
	name: string;
	status?: string | null;
	damageProfile?: ShipDamageProfile | null;
	model: string;
	tier: number;
	launchable?: boolean;
	inventory?: ShipItem[];
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

export function coerceShipStatus(status: unknown): string | null {
	if (status === null) {
		return null;
	}

	if (typeof status !== 'string') {
		return null;
	}

	const trimmed = status.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function coerceShipDamageProfileOrNull(raw: unknown): ShipDamageProfile | null {
	return coerceShipDamageProfile(raw);
}

function coerceShipItemFromDisplayName(displayName: string): ShipItem {
	const trimmed = displayName.trim();
	const itemType = trimmed.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		itemType: itemType || 'unknown',
		displayName: trimmed || 'Unknown',
		launchable: true,
		state: 'contained',
		damageStatus: 'intact',
		container: null,
		owningPlayerId: null,
		owningCharacterId: null,
		kinematics: null,
		destroyedAt: null,
		destroyedReason: null,
		discoveredAt: null,
		discoveredByCharacterId: null,
		createdAt: now,
		updatedAt: now,
	};
}

export function coerceShipInventory(inventory: unknown): ShipItem[] {
	if (!Array.isArray(inventory)) {
		return [];
	}

	return inventory
		.map((item) => {
			if (typeof item === 'string') {
				return item.trim() ? coerceShipItemFromDisplayName(item) : null;
			}
			return coerceShipItem(item);
		})
		.filter((item): item is ShipItem => item !== null);
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
