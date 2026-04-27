import { Triple } from './triple';

export const ITEM_STATES = ['contained', 'deployed', 'destroyed'] as const;
export type ItemState = typeof ITEM_STATES[number];

export const ITEM_DAMAGE_STATUSES = ['intact', 'damaged', 'disabled', 'destroyed'] as const;
export type ItemDamageStatus = typeof ITEM_DAMAGE_STATUSES[number];

export const ITEM_CONTAINER_TYPES = ['ship', 'market'] as const;
export type ItemContainerType = typeof ITEM_CONTAINER_TYPES[number];

export interface ItemContainer {
	containerType: ItemContainerType;
	containerId: string;
}

export interface ItemSpatialReference {
	solarSystemId: string;
	referenceKind: string;
	referenceBodyId: string | null;
	distanceUnit: string;
	velocityUnit: string;
	epochMs: number;
}

export interface ItemKinematics {
	position: Triple;
	velocity: Triple;
	reference: ItemSpatialReference;
}

export interface ShipItem {
	id: string;
	itemType: string;
	displayName: string;
	launchable: boolean;
	state: ItemState;
	damageStatus: ItemDamageStatus;
	container: ItemContainer | null;
	owningPlayerId: string | null;
	owningCharacterId: string | null;
	kinematics: ItemKinematics | null;
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
	const launchable = typeof obj['launchable'] === 'boolean' ? obj['launchable'] : true;
	const now = new Date().toISOString();
	return {
		id,
		itemType,
		displayName,
		launchable,
		state: coerceItemState(obj['state']),
		damageStatus: coerceItemDamageStatus(obj['damageStatus']),
		container: coerceItemContainer(obj['container']),
		owningPlayerId: typeof obj['owningPlayerId'] === 'string' ? obj['owningPlayerId'] : null,
		owningCharacterId: typeof obj['owningCharacterId'] === 'string' ? obj['owningCharacterId'] : null,
		kinematics: null,
		destroyedAt: typeof obj['destroyedAt'] === 'string' ? obj['destroyedAt'] : null,
		destroyedReason: typeof obj['destroyedReason'] === 'string' ? obj['destroyedReason'] : null,
		discoveredAt: typeof obj['discoveredAt'] === 'string' ? obj['discoveredAt'] : null,
		discoveredByCharacterId: typeof obj['discoveredByCharacterId'] === 'string' ? obj['discoveredByCharacterId'] : null,
		createdAt: typeof obj['createdAt'] === 'string' ? obj['createdAt'] : now,
		updatedAt: typeof obj['updatedAt'] === 'string' ? obj['updatedAt'] : now,
	};
}
