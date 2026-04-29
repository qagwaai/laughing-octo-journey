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

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);

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
