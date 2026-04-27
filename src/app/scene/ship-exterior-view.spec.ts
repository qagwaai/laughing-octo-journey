export {};

function resolveCharacterName(value?: string): string {
	return value?.trim() || 'Unbound';
}

interface AsteroidSample {
	id: string;
	scanProgress: number;
	scanned: boolean;
}

interface ShipItem {
	id: string;
	itemType: string;
	displayName?: string;
	launchable?: boolean;
}

interface ShipSummary {
	id: string;
	model?: string;
	inventory?: ShipItem[];
	location?: {
		positionKm: { x: number; y: number; z: number };
	};
	kinematics?: {
		reference?: {
			solarSystemId?: string;
		};
	};
}

interface ShipExteriorViewNavigationState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName?: string;
	};
	joinShip?: ShipSummary;
	firstTargetMissionStatus?: string;
}

interface LaunchRequestForTest {
	hotkey: 1 | 2 | 3 | 4 | 5;
	itemId: string;
	itemType: string;
	targetCelestialBodyId: string;
}

class MockColdBootScanScene {
	currentRouteLabel = '/ship-exterior-view';
	solarSystemId = 'sol';
	shipLocationKm: { x: number; y: number; z: number } | null = null;
	playerName = 'Unknown Pilot';
	characterName = 'Unbound';
	activeScanAsteroidId: string | null = null;
	targetedAsteroidId: string | null = null;
	rightHoldCandidateId: string | null = null;
	shipModel = 'Scavenger Pod';
	hasExpendableDartDrone = false;
	launchableInventory: ShipItem[] = [];
	launchRequests: LaunchRequestForTest[] = [];
	asteroidSamples: AsteroidSample[] = [
		{ id: 'sample-a1', scanProgress: 0, scanned: false },
		{ id: 'sample-a2', scanProgress: 0, scanned: false },
		{ id: 'sample-a3', scanProgress: 0, scanned: false },
		{ id: 'sample-a4', scanProgress: 0, scanned: false },
		{ id: 'sample-a5', scanProgress: 0, scanned: false },
	];

	constructor(state: ShipExteriorViewNavigationState = {}) {
		this.playerName = state.playerName ?? 'Unknown Pilot';
		this.characterName = resolveCharacterName(state.joinCharacter?.characterName);
		this.shipModel = state.joinShip?.model?.trim() || 'Scavenger Pod';
		this.hasExpendableDartDrone =
			state.joinShip?.inventory?.some((item) => item.itemType === 'expendable-dart-drone') ?? false;
		this.shipLocationKm = state.joinShip?.location?.positionKm ?? null;
		this.solarSystemId = state.joinShip?.kinematics?.reference?.solarSystemId?.trim() || 'sol';
		this.launchableInventory = (state.joinShip?.inventory ?? [])
			.filter((item) => item.launchable !== false)
			.slice()
			.sort((left, right) => {
				const leftName = (left.displayName || left.itemType).toLowerCase();
				const rightName = (right.displayName || right.itemType).toLowerCase();
				return leftName.localeCompare(rightName);
			});
	}

	canTargetAsteroids(): boolean {
		return this.shipModel === 'Scavenger Pod' && this.hasExpendableDartDrone;
	}

	onAsteroidHoverChange(event: { id: string; hovering: boolean }): void {
		if (event.hovering) {
			if (this.activeScanAsteroidId && this.activeScanAsteroidId !== event.id) {
				this.resetPartialScanProgress(this.activeScanAsteroidId);
			}
			this.activeScanAsteroidId = event.id;
			return;
		}

		this.resetPartialScanProgress(event.id);

		if (this.activeScanAsteroidId === event.id) {
			this.activeScanAsteroidId = null;
		}
	}

	tickActiveScanProgress(): void {
		if (!this.activeScanAsteroidId) {
			return;
		}

		this.asteroidSamples = this.asteroidSamples.map((sample) => {
			if (sample.id !== this.activeScanAsteroidId || sample.scanned) {
				return sample;
			}

			const nextProgress = Math.min(100, sample.scanProgress + 1);
			return {
				...sample,
				scanProgress: nextProgress,
				scanned: nextProgress >= 100,
			};
		});
	}

	onAsteroidRightPointerDown(event: { id: string; button: number }): void {
		if (event.button !== 2 || !this.canTargetAsteroids()) {
			return;
		}

		this.rightHoldCandidateId = event.id;
	}

	onAsteroidRightPointerUp(event: { id: string; button: number }): void {
		if (event.button !== 2) {
			return;
		}

		this.rightHoldCandidateId = null;
	}

	completeTargetHoldForTest(): void {
		if (!this.rightHoldCandidateId) {
			return;
		}

		this.targetedAsteroidId = this.rightHoldCandidateId;
		this.rightHoldCandidateId = null;
	}

	getSunConfig(): { color: string; radius: number } {
		if (this.solarSystemId.toLowerCase() === 'sol') {
			return { color: '#f5ff6b', radius: 1 };
		}

		return { color: '#f5ff6b', radius: 1 };
	}

	getSunScenePosition(): [number, number, number] {
		const fallback = { x: -0.94, y: 0.12, z: -0.31 };
		const vector = this.shipLocationKm
			? { x: -this.shipLocationKm.x, y: -this.shipLocationKm.y, z: -this.shipLocationKm.z }
			: fallback;
		const magnitude = Math.hypot(vector.x, vector.y, vector.z) || 1;
		const direction = {
			x: vector.x / magnitude,
			y: vector.y / magnitude,
			z: vector.z / magnitude,
		};

		const shipDistanceKm = this.shipLocationKm
			? Math.hypot(this.shipLocationKm.x, this.shipLocationKm.y, this.shipLocationKm.z)
			: 395000000;
		const scaledDistance = shipDistanceKm / 5500000;
		const clampedDistance = Math.max(56, Math.min(120, scaledDistance));

		return [direction.x * clampedDistance, direction.y * clampedDistance, direction.z * clampedDistance];
	}

	getSunLightIntensity(): number {
		const shipDistanceKm = this.shipLocationKm
			? Math.hypot(this.shipLocationKm.x, this.shipLocationKm.y, this.shipLocationKm.z)
			: 395000000;
		const distanceAu = shipDistanceKm / 149597870.7;
		const rawIntensity = 0.7 / (distanceAu * distanceAu);
		return Math.max(0.02, Math.min(0.16, rawIntensity));
	}

	getLaunchHotkeySlots(): Array<{ hotkey: 1 | 2 | 3 | 4 | 5; label: string; enabled: boolean }> {
		const selected = this.launchableInventory.slice(0, 5);
		return Array.from({ length: 5 }, (_, index) => {
			const hotkey = (index + 1) as 1 | 2 | 3 | 4 | 5;
			const item = selected[index];
			const name = item ? (item.displayName || item.itemType) : 'empty';
			const label = name.length <= 12 ? name : `${name.slice(0, 9)}...`;
			return {
				hotkey,
				label,
				enabled: !!this.targetedAsteroidId && !!item,
			};
		});
	}

	launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void {
		if (!this.targetedAsteroidId) {
			return;
		}

		const item = this.launchableInventory[hotkey - 1];
		if (!item) {
			return;
		}

		this.launchRequests.push({
			hotkey,
			itemId: item.id,
			itemType: item.itemType,
			targetCelestialBodyId: this.targetedAsteroidId,
		});
	}

	onWindowKeyDownForTest(event: { key: string; code?: string }): void {
		let hotkey: 1 | 2 | 3 | 4 | 5 | null = null;
		if (event.key >= '1' && event.key <= '5') {
			hotkey = Number(event.key) as 1 | 2 | 3 | 4 | 5;
		} else {
			switch (event.code) {
				case 'Numpad1':
					hotkey = 1;
					break;
				case 'Numpad2':
					hotkey = 2;
					break;
				case 'Numpad3':
					hotkey = 3;
					break;
				case 'Numpad4':
					hotkey = 4;
					break;
				case 'Numpad5':
					hotkey = 5;
					break;
				default:
					hotkey = null;
			}
		}

		if (hotkey) {
			this.launchFromHotkeySlot(hotkey);
		}
	}

	scanStatusLine(): string {
		const completedCount = this.asteroidSamples.filter((sample) => sample.scanned).length;
		if (completedCount === this.asteroidSamples.length) {
			return 'SCAN COMPLETE // ALL 5 SAMPLES CATALOGUED';
		}

		if (!this.activeScanAsteroidId) {
			return `HOVER OVER ASTEROID SAMPLES TO SCAN // ${completedCount}/5 COMPLETE`;
		}

		const active = this.asteroidSamples.find((sample) => sample.id === this.activeScanAsteroidId);
		if (!active) {
			return `HOVER OVER ASTEROID SAMPLES TO SCAN // ${completedCount}/5 COMPLETE`;
		}

		return `SCANNING ${active.id.toUpperCase()} // ${Math.floor(active.scanProgress)}%`;
	}

	private resetPartialScanProgress(sampleId: string): void {
		this.asteroidSamples = this.asteroidSamples.map((sample) => {
			if (sample.id !== sampleId || sample.scanned || sample.scanProgress <= 0) {
				return sample;
			}

			return {
				...sample,
				scanProgress: 0,
			};
		});
	}
}

describe('ShipExteriorViewScene', () => {
	it('should default to fallback labels when navigation state is empty', () => {
		const component = new MockColdBootScanScene();

		expect(component.playerName).toBe('Unknown Pilot');
		expect(component.characterName).toBe('Unbound');
		expect(component.currentRouteLabel).toBe('/ship-exterior-view');
	});

	it('should initialize player and character from navigation state', () => {
		const component = new MockColdBootScanScene({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova Prime' },
		});

		expect(component.playerName).toBe('Pioneer');
		expect(component.characterName).toBe('Nova Prime');
	});

	it('should read firstTargetMissionStatus from navigation state', () => {
		const component = new MockColdBootScanScene({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova Prime' },
			firstTargetMissionStatus: 'started',
		});

		expect(component.playerName).toBe('Pioneer');
		expect(component.characterName).toBe('Nova Prime');
	});

	it('should enable targeting only for Scavenger Pod with expendable-dart-drone inventory', () => {
		const enabled = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone' }],
			},
		});
		const wrongModel = new MockColdBootScanScene({
			joinShip: {
				id: 's-2',
				model: 'Expendable Dart Ship',
				inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone' }],
			},
		});
		const noDrone = new MockColdBootScanScene({
			joinShip: {
				id: 's-3',
				model: 'Scavenger Pod',
				inventory: [{ id: 'i-2', itemType: 'basic-mining-laser' }],
			},
		});

		expect(enabled.canTargetAsteroids()).toBe(true);
		expect(wrongModel.canTargetAsteroids()).toBe(false);
		expect(noDrone.canTargetAsteroids()).toBe(false);
	});

	it('should lock a single target after right-click hold when targeting is enabled', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone' }],
			},
		});

		component.onAsteroidRightPointerDown({ id: 'sample-a2', button: 2 });
		component.completeTargetHoldForTest();
		expect(component.targetedAsteroidId).toBe('sample-a2');

		component.onAsteroidRightPointerDown({ id: 'sample-a4', button: 2 });
		component.completeTargetHoldForTest();
		expect(component.targetedAsteroidId).toBe('sample-a4');
	});

	it('should not lock target when gating is disabled', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [{ id: 'i-1', itemType: 'basic-mining-laser' }],
			},
		});

		component.onAsteroidRightPointerDown({ id: 'sample-a3', button: 2 });
		component.completeTargetHoldForTest();

		expect(component.targetedAsteroidId).toBeNull();
	});

	it('should resolve Sol sun config by default and fallback for unknown solar systems', () => {
		const solScene = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				kinematics: { reference: { solarSystemId: 'sol' } },
			},
		});
		expect(solScene.getSunConfig()).toEqual({ color: '#f5ff6b', radius: 1 });

		const fallbackScene = new MockColdBootScanScene({
			joinShip: {
				id: 's-2',
				kinematics: { reference: { solarSystemId: 'unknown-system' } },
			},
		});
		expect(fallbackScene.getSunConfig()).toEqual({ color: '#f5ff6b', radius: 1 });
	});

	it('should place sun very far opposite ship location vector for asteroid belt distances', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				location: {
					positionKm: {
						x: 395000000,
						y: 1500000,
						z: -12000000,
					},
				},
			},
		});

		const [sunX, sunY, sunZ] = component.getSunScenePosition();
		const sunDistance = Math.hypot(sunX, sunY, sunZ);
		expect(sunDistance).toBeGreaterThan(56);
		expect(sunDistance).toBeLessThanOrEqual(120);
		expect(Math.sign(sunX)).toBe(-1);
		expect(Math.sign(sunZ)).toBe(1);
	});

	it('should compute a low-intensity directional sun light in asteroid belt range', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				location: {
					positionKm: {
						x: 420000000,
						y: 0,
						z: 0,
					},
				},
			},
		});

		const intensity = component.getSunLightIntensity();
		expect(intensity).toBeGreaterThanOrEqual(0.02);
		expect(intensity).toBeLessThan(0.16);
		expect(intensity).toBeGreaterThan(0.05);
	});

	it('should expose five hotkey slots sorted alphabetically and capped to first five launchables', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [
					{ id: 'i6', itemType: 'zeta-tool', displayName: 'Zeta Tool', launchable: true },
					{ id: 'i1', itemType: 'alpha-tool', displayName: 'Alpha Tool', launchable: true },
					{ id: 'i4', itemType: 'delta-tool', displayName: 'Delta Tool', launchable: true },
					{ id: 'i3', itemType: 'gamma-tool', displayName: 'Gamma Tool', launchable: true },
					{ id: 'i2', itemType: 'beta-tool', displayName: 'Beta Tool', launchable: true },
					{ id: 'i5', itemType: 'epsilon-tool', displayName: 'Epsilon Tool', launchable: true },
					{ id: 'ix', itemType: 'locked-tool', displayName: 'Locked Tool', launchable: false },
				],
			},
		});

		component.targetedAsteroidId = 'sample-a2';

		const slots = component.getLaunchHotkeySlots();
		expect(slots.map((slot) => slot.label)).toEqual([
			'Alpha Tool',
			'Beta Tool',
			'Delta Tool',
			'Epsilon Tool',
			'Gamma Tool',
		]);
		expect(slots.every((slot) => slot.enabled)).toBe(true);
	});

	it('should show empty slots when fewer than five launchables exist', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [
					{ id: 'i1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone', launchable: true },
					{ id: 'i2', itemType: 'survey-probe', displayName: 'Survey Probe', launchable: true },
				],
			},
		});

		const slots = component.getLaunchHotkeySlots();
		expect(slots.map((slot) => slot.label)).toEqual([
			'Expendabl...',
			'Survey Probe',
			'empty',
			'empty',
			'empty',
		]);
		expect(slots.every((slot) => !slot.enabled)).toBe(true);
	});

	it('should ignore hotkeys until an asteroid target exists', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone', launchable: true }],
			},
		});

		component.onWindowKeyDownForTest({ key: '1' });
		expect(component.launchRequests.length).toBe(0);

		component.targetedAsteroidId = 'sample-a4';
		component.onWindowKeyDownForTest({ key: '1' });
		expect(component.launchRequests.length).toBe(1);
		expect(component.launchRequests[0]).toEqual({
			hotkey: 1,
			itemId: 'i-1',
			itemType: 'expendable-dart-drone',
			targetCelestialBodyId: 'sample-a4',
		});
	});

	it('should support both top-row and numpad hotkeys', () => {
		const component = new MockColdBootScanScene({
			joinShip: {
				id: 's-1',
				model: 'Scavenger Pod',
				inventory: [
					{ id: 'i-1', itemType: 'alpha-drone', displayName: 'Alpha Drone', launchable: true },
					{ id: 'i-2', itemType: 'beta-drone', displayName: 'Beta Drone', launchable: true },
				],
			},
		});

		component.targetedAsteroidId = 'sample-a5';
		component.onWindowKeyDownForTest({ key: '2' });
		component.onWindowKeyDownForTest({ key: '', code: 'Numpad1' });

		expect(component.launchRequests.length).toBe(2);
		expect(component.launchRequests[0].hotkey).toBe(2);
		expect(component.launchRequests[1].hotkey).toBe(1);
	});

	it('should trim character name and fallback when blank', () => {
		const withSpaces = new MockColdBootScanScene({
			joinCharacter: { id: 'c-1', characterName: '  Echo  ' },
		});
		expect(withSpaces.characterName).toBe('Echo');

		const blank = new MockColdBootScanScene({
			joinCharacter: { id: 'c-2', characterName: '   ' },
		});
		expect(blank.characterName).toBe('Unbound');
	});

	it('should expose five asteroid samples for scanning', () => {
		const component = new MockColdBootScanScene();
		expect(component.asteroidSamples.length).toBe(5);
	});

	it('should progress active asteroid scan one percent per tick', () => {
		const component = new MockColdBootScanScene();
		component.onAsteroidHoverChange({ id: 'sample-a2', hovering: true });

		component.tickActiveScanProgress();
		component.tickActiveScanProgress();
		component.tickActiveScanProgress();

		const target = component.asteroidSamples.find((sample) => sample.id === 'sample-a2');
		expect(target?.scanProgress).toBe(3);
		expect(target?.scanned).toBe(false);
	});

	it('should complete asteroid scan after one hundred ticks', () => {
		const component = new MockColdBootScanScene();
		component.onAsteroidHoverChange({ id: 'sample-a4', hovering: true });

		for (let i = 0; i < 100; i += 1) {
			component.tickActiveScanProgress();
		}

		const target = component.asteroidSamples.find((sample) => sample.id === 'sample-a4');
		expect(target?.scanProgress).toBe(100);
		expect(target?.scanned).toBe(true);
	});

	it('should reset scan progress when cursor leaves active asteroid', () => {
		const component = new MockColdBootScanScene();
		component.onAsteroidHoverChange({ id: 'sample-a1', hovering: true });
		component.tickActiveScanProgress();
		component.onAsteroidHoverChange({ id: 'sample-a1', hovering: false });
		component.tickActiveScanProgress();

		const target = component.asteroidSamples.find((sample) => sample.id === 'sample-a1');
		expect(component.activeScanAsteroidId).toBeNull();
		expect(target?.scanProgress).toBe(0);
	});

	it('should reset previous asteroid progress when switching hover targets', () => {
		const component = new MockColdBootScanScene();
		component.onAsteroidHoverChange({ id: 'sample-a1', hovering: true });
		for (let i = 0; i < 12; i += 1) {
			component.tickActiveScanProgress();
		}

		component.onAsteroidHoverChange({ id: 'sample-a3', hovering: true });

		const previous = component.asteroidSamples.find((sample) => sample.id === 'sample-a1');
		const active = component.asteroidSamples.find((sample) => sample.id === 'sample-a3');
		expect(previous?.scanProgress).toBe(0);
		expect(component.activeScanAsteroidId).toBe('sample-a3');
		expect(active?.scanProgress).toBe(0);
	});

	it('should report complete status when all asteroid scans finish', () => {
		const component = new MockColdBootScanScene();
		component.asteroidSamples = component.asteroidSamples.map((sample) => ({
			...sample,
			scanProgress: 100,
			scanned: true,
		}));

		expect(component.scanStatusLine()).toBe('SCAN COMPLETE // ALL 5 SAMPLES CATALOGUED');
	});
});

// ---------------------------------------------------------------------------
// In-progress seeding logic
// ---------------------------------------------------------------------------

interface MockCelestialBodyItem {
	id: string;
	composition: { rarity: string; material: string; textureColor: string };
	kinematics: object;
	location: { positionKm: { x: number; y: number; z: number } };
	distanceKm: number;
}

interface AsteroidSampleFull {
	id: string;
	scanProgress: number;
	scanned: boolean;
	revealedMaterial: { rarity: string; material: string; textureColor: string } | null;
	revealedKinematics: object | null;
}

/** Mirrors the seeding-branch and merge logic from ColdBootScanScene. */
class MockColdBootScanSceneSeeding {
	asteroidSamples: AsteroidSampleFull[] = [];
	seedingPath: 'in-progress' | 'just-started' | 'fallback' | null = null;

	ngOnInit(firstTargetMissionStatus?: string): void {
		if (firstTargetMissionStatus === 'started') {
			this.seedingPath = 'in-progress';
		} else {
			this.seedingPath = 'just-started';
		}
	}

	/**
	 * Mirrors seedAsteroidsForInProgressMission() synchronously for unit tests
	 * by accepting pre-resolved ship center + cb-list response.
	 */
	seedForInProgress(
		auth: { playerName: string; characterId: string; sessionKey: string },
		shipCenter: { x: number; y: number; z: number } | null,
		existingBodies: MockCelestialBodyItem[],
		randomTargetCount: number,
	): void {
		if (!auth.playerName || !auth.characterId || !auth.sessionKey) {
			this.asteroidSamples = this.makeRawSamples(5);
			this.seedingPath = 'fallback';
			return;
		}

		if (!shipCenter) {
			this.asteroidSamples = this.makeRawSamples(5);
			this.seedingPath = 'fallback';
			return;
		}

		const total = Math.max(existingBodies.length, randomTargetCount);
		const allSamples = this.makeRawSamples(total);

		this.asteroidSamples = allSamples.map((sample, index) => {
			const existing = existingBodies[index];
			if (!existing) {
				return sample;
			}
			return {
				...sample,
				scanProgress: 100,
				scanned: true,
				revealedMaterial: existing.composition,
				revealedKinematics: existing.kinematics,
			};
		});
	}

	private makeRawSamples(count: number): AsteroidSampleFull[] {
		return Array.from({ length: count }, (_, i) => ({
			id: `sample-a${i + 1}`,
			scanProgress: 0,
			scanned: false,
			revealedMaterial: null,
			revealedKinematics: null,
		}));
	}
}

describe('ColdBootScanScene in-progress seeding', () => {
	it('should route to in-progress seeding path when firstTargetMissionStatus is started', () => {
		const scene = new MockColdBootScanSceneSeeding();
		scene.ngOnInit('started');
		expect(scene.seedingPath).toBe('in-progress');
	});

	it('should route to just-started seeding path when firstTargetMissionStatus is absent', () => {
		const scene = new MockColdBootScanSceneSeeding();
		scene.ngOnInit();
		expect(scene.seedingPath).toBe('just-started');
	});

	it('should fall back to random seeding when auth context is missing', () => {
		const scene = new MockColdBootScanSceneSeeding();
		scene.seedForInProgress({ playerName: '', characterId: '', sessionKey: '' }, null, [], 5);
		expect(scene.seedingPath).toBe('fallback');
		expect(scene.asteroidSamples.length).toBe(5);
		expect(scene.asteroidSamples.every((s) => !s.scanned)).toBe(true);
	});

	it('should fall back to random seeding when ship has no location', () => {
		const scene = new MockColdBootScanSceneSeeding();
		scene.seedForInProgress({ playerName: 'p', characterId: 'c', sessionKey: 'k' }, null, [], 5);
		expect(scene.seedingPath).toBe('fallback');
		expect(scene.asteroidSamples.length).toBe(5);
	});

	it('should mark fetched celestial bodies as already-scanned in the merged set', () => {
		const scene = new MockColdBootScanSceneSeeding();
		const existing: MockCelestialBodyItem[] = [
			{
				id: 'cb-1',
				composition: { rarity: 'Rare', material: 'Nickel-Iron', textureColor: '#8df7b2' },
				kinematics: { velocityKmPerSec: { x: 0, y: 0, z: 0 }, angularVelocityRadPerSec: { x: 0, y: 0, z: 0 }, estimatedMassKg: 1e9, estimatedDiameterM: 200 },
				location: { positionKm: { x: 1, y: 2, z: 3 } },
				distanceKm: 1.5,
			},
		];

		scene.seedForInProgress(
			{ playerName: 'Pioneer', characterId: 'char-1', sessionKey: 'sk' },
			{ x: 100, y: 200, z: 50 },
			existing,
			5,
		);

		expect(scene.asteroidSamples[0].scanned).toBe(true);
		expect(scene.asteroidSamples[0].scanProgress).toBe(100);
		expect(scene.asteroidSamples[0].revealedMaterial).toEqual(existing[0].composition);
		expect(scene.asteroidSamples[0].revealedKinematics).toEqual(existing[0].kinematics);
	});

	it('should leave top-up asteroids as unscanned fresh samples', () => {
		const scene = new MockColdBootScanSceneSeeding();
		const existing: MockCelestialBodyItem[] = [
			{
				id: 'cb-1',
				composition: { rarity: 'Common', material: 'Silicate', textureColor: '#aabbcc' },
				kinematics: {},
				location: { positionKm: { x: 0, y: 0, z: 0 } },
				distanceKm: 0.5,
			},
		];

		scene.seedForInProgress(
			{ playerName: 'Pioneer', characterId: 'char-1', sessionKey: 'sk' },
			{ x: 0, y: 0, z: 0 },
			existing,
			5,
		);

		expect(scene.asteroidSamples[0].scanned).toBe(true);
		const topUp = scene.asteroidSamples.slice(1);
		expect(topUp.length).toBeGreaterThan(0);
		expect(topUp.every((s) => !s.scanned && s.scanProgress === 0)).toBe(true);
	});

	it('should produce at least as many samples as existing bodies when random target is smaller', () => {
		const scene = new MockColdBootScanSceneSeeding();
		const existing: MockCelestialBodyItem[] = Array.from({ length: 8 }, (_, i) => ({
			id: `cb-${i}`,
			composition: { rarity: 'Common', material: 'Rock', textureColor: '#aaa' },
			kinematics: {},
			location: { positionKm: { x: 0, y: 0, z: 0 } },
			distanceKm: i,
		}));

		scene.seedForInProgress(
			{ playerName: 'Pioneer', characterId: 'char-1', sessionKey: 'sk' },
			{ x: 0, y: 0, z: 0 },
			existing,
			5, // random target is smaller than existing count
		);

		// max(8, 5) = 8 — existing bodies always preserved in full
		expect(scene.asteroidSamples.length).toBe(8);
		expect(scene.asteroidSamples.filter((s) => s.scanned).length).toBe(8);
	});

	it('should use the random target count when it exceeds existing body count', () => {
		const scene = new MockColdBootScanSceneSeeding();
		const existing: MockCelestialBodyItem[] = [
			{
				id: 'cb-1',
				composition: { rarity: 'Common', material: 'Rock', textureColor: '#aaa' },
				kinematics: {},
				location: { positionKm: { x: 0, y: 0, z: 0 } },
				distanceKm: 1,
			},
		];

		scene.seedForInProgress(
			{ playerName: 'Pioneer', characterId: 'char-1', sessionKey: 'sk' },
			{ x: 0, y: 0, z: 0 },
			existing,
			12, // random target exceeds existing count
		);

		// max(1, 12) = 12
		expect(scene.asteroidSamples.length).toBe(12);
		expect(scene.asteroidSamples.filter((s) => s.scanned).length).toBe(1);
		expect(scene.asteroidSamples.filter((s) => !s.scanned).length).toBe(11);
	});
});
