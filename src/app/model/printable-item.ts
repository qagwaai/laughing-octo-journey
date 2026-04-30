import type { ShipItem } from './ship-item';

export interface PrintableConsumedMaterial {
	id: string;
	itemType: string;
	label: string;
}

export interface PrintableMaterialRequirement {
	materialKey: string;
	label: string;
	quantity: number;
	acceptedItemTypes: readonly string[];
	acceptedDisplayNames: readonly string[];
}

export interface PrintableItemDefinition {
	itemType: string;
	displayName: string;
	description: string;
	tier: number;
	durationMs: number;
	requiredMaterials: readonly PrintableMaterialRequirement[];
}

export const HULL_PATCH_KIT_PRINTABLE_ITEM: PrintableItemDefinition = {
	itemType: 'hull-patch-kit',
	displayName: 'Hull Patch Kit',
	description: 'Structural repair kit for hull breach patching and restoring ship integrity. Required for the Scavenger Pod repair mission step.',
	tier: 1,
	durationMs: 1 * 60 * 1000,
	requiredMaterials: [
		{
			materialKey: 'iron',
			label: 'Iron (raw material)',
			quantity: 1,
			acceptedItemTypes: ['iron', 'iron-ore', 'iron-raw-material'],
			acceptedDisplayNames: ['iron', 'iron ore', 'iron (raw material)'],
		},
	],
};

export const CONDUIT_SEALS_PRINTABLE_ITEM: PrintableItemDefinition = {
	itemType: 'conduit-seals',
	displayName: 'Conduit Seals',
	description: 'Pressure-rated sealing sleeves for rerouting damaged ship conduits and stabilizing subsystem junctions.',
	tier: 1,
	durationMs: 10 * 60 * 1000,
	requiredMaterials: [
		{
			materialKey: 'copper',
			label: 'Copper (raw material)',
			quantity: 2,
			acceptedItemTypes: ['copper', 'copper-ore', 'copper-raw-material'],
			acceptedDisplayNames: ['copper', 'copper ore', 'copper (raw material)'],
		},
		{
			materialKey: 'polymer-resin',
			label: 'Polymer Resin',
			quantity: 1,
			acceptedItemTypes: ['polymer-resin', 'polymer', 'polymer-raw-material'],
			acceptedDisplayNames: ['polymer resin', 'polymer', 'polymer (raw material)'],
		},
	],
};

export const PRINTABLE_ITEMS: readonly PrintableItemDefinition[] = [
	HULL_PATCH_KIT_PRINTABLE_ITEM,
	CONDUIT_SEALS_PRINTABLE_ITEM,
];

export function resolvePrintableItemDefinition(itemType: string): PrintableItemDefinition | null {
	return PRINTABLE_ITEMS.find((item) => item.itemType === itemType) ?? null;
}

export function formatPrintableDuration(durationMs: number): string {
	const totalMinutes = Math.floor(durationMs / 60_000);
	if (totalMinutes < 60) {
		return `${totalMinutes} min`;
	}

	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

export function hasPrintableItemInInventory(
	inventory: readonly ShipItem[] | undefined,
	printableItem: PrintableItemDefinition,
): boolean {
	return (inventory ?? []).some((item) => item.itemType === printableItem.itemType);
}

export function isPrintableItemQueued(
	queue: ReadonlyArray<{ itemType: string }> | undefined,
	printableItem: PrintableItemDefinition,
): boolean {
	return (queue ?? []).some((item) => item.itemType === printableItem.itemType);
}

export function countAvailablePrintableMaterial(
	inventory: readonly ShipItem[] | undefined,
	requirement: PrintableMaterialRequirement,
): number {
	return (inventory ?? []).filter((item) => doesItemMatchPrintableRequirement(item, requirement)).length;
}

export function findConsumableMaterialsForPrintableItem(
	inventory: readonly ShipItem[] | undefined,
	printableItem: PrintableItemDefinition,
): PrintableConsumedMaterial[] | null {
	const availableInventory = [...(inventory ?? [])];
	const consumedMaterials: PrintableConsumedMaterial[] = [];

	for (const requirement of printableItem.requiredMaterials) {
		for (let index = 0; index < requirement.quantity; index += 1) {
			const matchIndex = availableInventory.findIndex((item) => doesItemMatchPrintableRequirement(item, requirement));
			if (matchIndex < 0) {
				return null;
			}

			const [matchedItem] = availableInventory.splice(matchIndex, 1);
			consumedMaterials.push({
				id: matchedItem.id,
				itemType: matchedItem.itemType,
				label: matchedItem.displayName || matchedItem.itemType,
			});
		}
	}

	return consumedMaterials;
}

export function describePrintableMaterials(printableItem: PrintableItemDefinition): string[] {
	return printableItem.requiredMaterials.map((requirement) => `${requirement.quantity} x ${requirement.label}`);
}

export function getMissingPrintableMaterials(printableItem: PrintableItemDefinition, inventory: readonly ShipItem[] | undefined): string[] {
	return printableItem.requiredMaterials
		.filter((requirement) => countAvailablePrintableMaterial(inventory, requirement) < requirement.quantity)
		.map((requirement) => `${requirement.quantity} ${requirement.label}`);
}

function doesItemMatchPrintableRequirement(item: ShipItem, requirement: PrintableMaterialRequirement): boolean {
	const normalizedType = item.itemType.trim().toLowerCase();
	const normalizedName = (item.displayName || '').trim().toLowerCase();
	return requirement.acceptedItemTypes.some((value) => normalizedType.includes(value.toLowerCase()))
		|| requirement.acceptedDisplayNames.some((value) => normalizedName.includes(value.toLowerCase()));
}