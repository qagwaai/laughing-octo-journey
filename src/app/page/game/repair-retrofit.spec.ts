import {
	CONDUIT_SEALS_PRINTABLE_ITEM,
	HULL_PATCH_KIT_PRINTABLE_ITEM,
	PRINTABLE_ITEMS,
	findConsumableMaterialsForPrintableItem,
	formatPrintableDuration,
	hasPrintableItemInInventory,
	isPrintableItemQueued,
	type PrintableItemDefinition,
} from '../../model/printable-item';

export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface NavigationState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName: string;
		missions?: Array<{ missionId: string; status: string }>;
	};
	joinShip?: {
		id: string;
		inventory?: Array<{ itemType: string; id: string; displayName?: string }>;
	};
}

interface PrintQueueItem {
	id: string;
	itemType: string;
	label: string;
	startedAt: string;
	durationMs: number;
	consumedMaterials?: Array<{ id: string; itemType: string; label: string }>;
}

type ShipDamageSeverity = 'minor' | 'major' | 'critical';

interface ShipSubsystemDamage {
	code: string;
	label: string;
	severity: ShipDamageSeverity;
	summary: string;
	repairPriority: number;
}

interface ShipDamageProfile {
	overallStatus: 'intact' | 'damaged' | 'disabled' | 'destroyed';
	summary: string;
	origin: 'cold-boot-scripted' | 'combat' | 'wear' | 'unknown';
	systems: ShipSubsystemDamage[];
	updatedAt: string;
}

interface DamagedAssetEntry {
	key: string;
	kind: 'ship' | 'ship-system' | 'inventory-item';
	label: string;
	severity: string;
	summary: string;
	repairPriority?: number;
}

class MockRepairRetrofitPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
	damageProfile = createSignal<ShipDamageProfile | null>(null);
	activeShip = createSignal<NavigationState['joinShip'] | null>(null);
	printerQueue = createSignal<PrintQueueItem[]>([]);
	printerError = createSignal<string | null>(null);
	printerSuccess = createSignal<string | null>(null);
	printableItems: readonly PrintableItemDefinition[] = PRINTABLE_ITEMS;

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.activeShip.set(state?.joinShip ?? null);

		const inFirstTarget =
			state?.joinCharacter?.missions?.some((mission) =>
				mission.missionId === 'first-target' &&
				(mission.status === 'started' || mission.status === 'in-progress' || mission.status === 'paused'),
			) ?? false;

		if (inFirstTarget) {
			this.damageProfile.set({
				overallStatus: 'damaged',
				summary: 'Primary propulsion manifold breach; emergency systems online.',
				origin: 'cold-boot-scripted',
				updatedAt: '2026-01-01T00:00:00.000Z',
				systems: [
					{
						code: 'propulsion-manifold',
						label: 'Propulsion Manifold',
						severity: 'critical',
						summary: 'Main thrust line rupture; sustained burn unavailable.',
						repairPriority: 1,
					},
				],
			});
		}
	}

	printerStatus(): 'idle' | 'printing' {
		return this.printerQueue().length > 0 ? 'printing' : 'idle';
	}

	hasHullPatchKit(): boolean {
		return hasPrintableItemInInventory(this.activeShip()?.inventory as any, HULL_PATCH_KIT_PRINTABLE_ITEM);
	}

	isHullPatchKitQueued(): boolean {
		return isPrintableItemQueued(this.printerQueue(), HULL_PATCH_KIT_PRINTABLE_ITEM);
	}

	canPrintHullPatchKit(): boolean {
		return !this.hasHullPatchKit()
			&& !this.isHullPatchKitQueued()
			&& !!findConsumableMaterialsForPrintableItem(this.activeShip()?.inventory as any, HULL_PATCH_KIT_PRINTABLE_ITEM)
			&& !!this.activeShip();
	}

	queueHullPatchKit(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const consumedMaterials = findConsumableMaterialsForPrintableItem(
			this.activeShip()?.inventory as any,
			HULL_PATCH_KIT_PRINTABLE_ITEM,
		);
		if (!playerName || !characterId || !consumedMaterials) {
			this.printerError.set('1 Iron (raw material) required in ship inventory to start this print job.');
			return;
		}

		this.printerError.set(null);
		this.printerSuccess.set(null);
		const newItem: PrintQueueItem = {
			id: `print-${Date.now()}`,
			itemType: HULL_PATCH_KIT_PRINTABLE_ITEM.itemType,
			label: HULL_PATCH_KIT_PRINTABLE_ITEM.displayName,
			startedAt: new Date().toISOString(),
			durationMs: HULL_PATCH_KIT_PRINTABLE_ITEM.durationMs,
			consumedMaterials,
		};
		this.printerQueue.set([...this.printerQueue(), newItem]);
		this.activeShip.set({
			...(this.activeShip() ?? { id: 's-1' }),
			inventory: (this.activeShip()?.inventory ?? []).filter(
				(item) => !new Set(consumedMaterials.map((material) => material.id)).has(item.id),
			),
		});
		this.printerSuccess.set(
			`Hull Patch Kit queued for printing. 1 Iron (raw material) consumed. Estimated time: ${formatPrintableDuration(HULL_PATCH_KIT_PRINTABLE_ITEM.durationMs)}.`,
		);
	}

	cancelPrintJob(item: PrintQueueItem): void {
		const [consumedMaterial] = item.consumedMaterials ?? [];
		if (consumedMaterial) {
			this.activeShip.set({
				...(this.activeShip() ?? { id: 's-1' }),
				inventory: [
					...(this.activeShip()?.inventory ?? []),
					{ id: consumedMaterial.id, itemType: consumedMaterial.itemType, displayName: consumedMaterial.label },
				],
			});
		}
		this.printerQueue.set(this.printerQueue().filter((q) => q.id !== item.id));
	}

	formatRemainingTime(ms: number): string {
		if (ms <= 0) {
			return '0:00';
		}

		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	damagedItems(): DamagedAssetEntry[] {
		const profile = this.damageProfile();
		if (!profile) {
			return [];
		}

		const entries: DamagedAssetEntry[] = [];
		if (profile.overallStatus !== 'intact') {
			entries.push({
				key: 'ship:active',
				kind: 'ship',
				label: 'Scavenger Pod',
				severity: profile.overallStatus,
				summary: profile.summary,
				repairPriority: 0,
			});
		}

		for (const system of profile.systems) {
			entries.push({
				key: `ship-system:${system.code}`,
				kind: 'ship-system',
				label: system.label,
				severity: system.severity,
				summary: system.summary,
				repairPriority: system.repairPriority,
			});
		}

		return entries.sort((left, right) => (left.repairPriority ?? 1000) - (right.repairPriority ?? 1000));
	}

	repairSubsystem(code: string): void {
		const profile = this.damageProfile();
		if (!profile) {
			return;
		}

		const nextSystems = profile.systems
			.map((system) => {
				if (system.code !== code) {
					return system;
				}

				if (system.severity === 'critical') {
					return { ...system, severity: 'major' as const };
				}

				if (system.severity === 'major') {
					return { ...system, severity: 'minor' as const };
				}

				return null;
			})
			.filter((system): system is ShipSubsystemDamage => system !== null);

		this.damageProfile.set({
			...profile,
			overallStatus: nextSystems.length === 0 ? 'intact' : 'damaged',
			systems: nextSystems,
		});
	}

}

describe('RepairRetrofitPage', () => {
	it('should initialize from navigation state', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
	});

	it('should fallback to empty values', () => {
		const component = new MockRepairRetrofitPage();
		expect(component.playerName()).toBe('');
		expect(component.joinCharacter()).toBeNull();
	});

	it('should apply cold boot damage fallback when first-target mission is in-progress', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: {
				id: 'c-1',
				characterName: 'Nova',
				missions: [{ missionId: 'first-target', status: 'started' }],
			},
		});

		expect(component.damageProfile()).not.toBeNull();
		expect(component.damageProfile()!.origin).toBe('cold-boot-scripted');
		expect(component.damageProfile()!.overallStatus).toBe('damaged');
		expect(component.damagedItems()[0].kind).toBe('ship');
		expect(component.damagedItems()[0].label).toBe('Scavenger Pod');
		expect(component.damagedItems().some((entry) => entry.kind === 'ship-system')).toBe(true);
	});

	it('should downgrade subsystem severity during staged repair', () => {
		const component = new MockRepairRetrofitPage({
			joinCharacter: {
				id: 'c-1',
				characterName: 'Nova',
				missions: [{ missionId: 'first-target', status: 'started' }],
			},
		});

		component.repairSubsystem('propulsion-manifold');
		expect(component.damageProfile()!.systems[0].severity).toBe('major');

		component.repairSubsystem('propulsion-manifold');
		expect(component.damageProfile()!.systems[0].severity).toBe('minor');

		component.repairSubsystem('propulsion-manifold');
		expect(component.damageProfile()!.systems.length).toBe(0);
		expect(component.damageProfile()!.overallStatus).toBe('intact');
	});
});

describe('RepairRetrofitPage - 3D Fabricator', () => {
	it('should expose conduit seals as a second printable recipe', () => {
		const component = new MockRepairRetrofitPage();

		expect(component.printableItems.map((item) => item.itemType)).toEqual([
			'hull-patch-kit',
			'conduit-seals',
		]);
		expect(CONDUIT_SEALS_PRINTABLE_ITEM.durationMs).toBe(10 * 60 * 1000);
		expect(formatPrintableDuration(CONDUIT_SEALS_PRINTABLE_ITEM.durationMs)).toBe('10 min');
	});

	it('should resolve conduit seals raw materials from inventory', () => {
		const consumedMaterials = findConsumableMaterialsForPrintableItem(
			[
				{ id: 'copper-1', itemType: 'copper-raw-material', displayName: 'Copper (raw material)' },
				{ id: 'copper-2', itemType: 'copper-ore', displayName: 'Copper Ore' },
				{ id: 'polymer-1', itemType: 'polymer-resin', displayName: 'Polymer Resin' },
			] as any,
			CONDUIT_SEALS_PRINTABLE_ITEM,
		);

		expect(consumedMaterials).toEqual([
			{ id: 'copper-1', itemType: 'copper-raw-material', label: 'Copper (raw material)' },
			{ id: 'copper-2', itemType: 'copper-ore', label: 'Copper Ore' },
			{ id: 'polymer-1', itemType: 'polymer-resin', label: 'Polymer Resin' },
		]);
	});

	it('should start with empty print queue and idle status', () => {
		const component = new MockRepairRetrofitPage();
		expect(component.printerQueue()).toEqual([]);
		expect(component.printerStatus()).toBe('idle');
	});

	it('should show printing status when queue has items', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1', inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }] },
		});
		component.queueHullPatchKit();
		expect(component.printerStatus()).toBe('printing');
	});

	it('should not allow printing without iron in inventory', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1' },
		});
		expect(component.canPrintHullPatchKit()).toBe(false);
		component.queueHullPatchKit();
		expect(component.printerQueue().length).toBe(0);
		expect(component.printerError()).toContain('1 Iron');
	});

	it('should add hull-patch-kit to print queue with 1 minute duration', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1', inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }] },
		});
		component.queueHullPatchKit();

		const queue = component.printerQueue();
		expect(queue.length).toBe(1);
		expect(queue[0].itemType).toBe('hull-patch-kit');
		expect(queue[0].durationMs).toBe(HULL_PATCH_KIT_PRINTABLE_ITEM.durationMs);
		expect(component.activeShip()?.inventory ?? []).toEqual([]);
	});

	it('should allow printing when inventory contains normalized iron raw material item', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'iron-1', itemType: 'iron-raw-material', displayName: 'Iron (raw material)' }],
			},
		});

		expect(component.canPrintHullPatchKit()).toBe(true);
		component.queueHullPatchKit();
		expect(component.printerQueue().length).toBe(1);
	});

	it('should not allow printing when hull patch kit is already in inventory', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1', inventory: [{ id: 'item-1', itemType: 'hull-patch-kit' }] },
		});
		expect(component.canPrintHullPatchKit()).toBe(false);
	});

	it('should remove item from queue on cancel', () => {
		const component = new MockRepairRetrofitPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1', inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }] },
		});
		component.queueHullPatchKit();
		const item = component.printerQueue()[0];
		component.cancelPrintJob(item);
		expect(component.printerQueue().length).toBe(0);
		expect(component.printerStatus()).toBe('idle');
		expect(component.activeShip()?.inventory?.[0].itemType).toBe('iron');
	});

	it('should format remaining time as m:ss', () => {
		const component = new MockRepairRetrofitPage();
		expect(component.formatRemainingTime(1 * 60 * 1000)).toBe('1:00');
		expect(component.formatRemainingTime(90 * 1000)).toBe('1:30');
		expect(component.formatRemainingTime(5 * 1000)).toBe('0:05');
		expect(component.formatRemainingTime(0)).toBe('0:00');
	});
});
