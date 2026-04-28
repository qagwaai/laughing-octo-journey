export const LAUNCH_ITEM_REQUEST_EVENT = 'launch-item-request';
export const LAUNCH_ITEM_RESPONSE_EVENT = 'launch-item-response';

export interface LaunchItemRequest {
	playerName: string;
	characterId: string;
	shipId: string;
	sessionKey: string;
	targetCelestialBodyId: string;
	hotkey: 1 | 2 | 3 | 4 | 5;
	itemId: string;
	itemType: string;
}

export interface LaunchItemContainer {
	containerType: 'ship' | 'market';
	containerId: string;
}

export interface LaunchItemConsumedState {
	id: string;
	state: 'contained' | 'deployed' | 'destroyed';
	container: LaunchItemContainer | null;
	launchable: boolean;
	destroyedAt?: string;
	destroyedReason?: string;
	updatedAt?: string;
}

export interface LaunchItemYieldedMaterial {
	material: string;
	rarity: 'Common' | 'Uncommon' | 'Rare' | 'Exotic';
	quantity: number;
}

export interface LaunchItemYieldedItem {
	id: string;
	itemType: string;
	displayName: string;
	quantity: number;
	state: 'contained' | 'deployed' | 'destroyed';
	container: LaunchItemContainer | null;
	launchable: boolean;
}

export interface LaunchItemTargetCelestialBodyResolution {
	id: string;
	state: 'active' | 'destroyed';
	destroyedAt: string | null;
	destroyedReason: string | null;
	debrisSeed: number | null;
	debris: Array<{
		material: string;
		rarity: 'Common' | 'Uncommon' | 'Rare' | 'Exotic';
		quantity: number;
		itemType: string;
	}>;
}

export interface LaunchItemResolution {
	outcome: 'target-destroyed' | 'no-effect';
	targetDestroyed: boolean;
	yieldedMaterials: LaunchItemYieldedMaterial[];
	yieldedItems: LaunchItemYieldedItem[];
	targetCelestialBody?: LaunchItemTargetCelestialBodyResolution;
	launchSeed: number;
}

export interface LaunchItemResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	shipId: string;
	targetCelestialBodyId: string;
	hotkey: 1 | 2 | 3 | 4 | 5;
	itemId: string;
	itemType: string;
	launchedItem?: LaunchItemConsumedState;
	resolution?: LaunchItemResolution;
}
