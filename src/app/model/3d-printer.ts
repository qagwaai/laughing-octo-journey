import { ShipItem, coerceShipItem } from './ship-item';

export { ItemState, ItemDamageStatus, ItemContainer, ItemKinematics, ShipItem } from './ship-item';

export const THREE_D_PRINTER_ITEM_TYPE = '3d-printer';
export const THREE_D_PRINTER_DISPLAY_NAME = '3D Printer';
export const THREE_D_PRINTER_TIER = 1;

export interface ThreeDPrinter extends ShipItem {
	itemType: typeof THREE_D_PRINTER_ITEM_TYPE;
	tier: typeof THREE_D_PRINTER_TIER;
}

export function isThreeDPrinter(item: ShipItem): item is ThreeDPrinter {
	return item.itemType === THREE_D_PRINTER_ITEM_TYPE && item.tier === THREE_D_PRINTER_TIER;
}

export function create3DPrinter(): ThreeDPrinter {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		itemType: THREE_D_PRINTER_ITEM_TYPE,
		displayName: THREE_D_PRINTER_DISPLAY_NAME,
		tier: THREE_D_PRINTER_TIER,
		launchable: false,
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

export function coerce3DPrinter(raw: unknown): ThreeDPrinter | null {
	const item = coerceShipItem(raw);
	if (!item) return null;
	if (item.itemType !== THREE_D_PRINTER_ITEM_TYPE) return null;
	if (item.tier !== THREE_D_PRINTER_TIER) return null;
	return item as ThreeDPrinter;
}