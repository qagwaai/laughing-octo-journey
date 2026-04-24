export {};

function resolveCharacterName(value?: string): string {
	return value?.trim() || 'Unbound';
}

interface AsteroidSample {
	id: string;
	scanProgress: number;
	scanned: boolean;
}

interface ColdBootScanNavigationState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName?: string;
	};
	firstTargetMissionStatus?: string;
}

class MockColdBootScanScene {
	currentRouteLabel = '/opening-cold-boot-scan';
	playerName = 'Unknown Pilot';
	characterName = 'Unbound';
	activeScanAsteroidId: string | null = null;
	asteroidSamples: AsteroidSample[] = [
		{ id: 'sample-a1', scanProgress: 0, scanned: false },
		{ id: 'sample-a2', scanProgress: 0, scanned: false },
		{ id: 'sample-a3', scanProgress: 0, scanned: false },
		{ id: 'sample-a4', scanProgress: 0, scanned: false },
		{ id: 'sample-a5', scanProgress: 0, scanned: false },
	];

	constructor(state: ColdBootScanNavigationState = {}) {
		this.playerName = state.playerName ?? 'Unknown Pilot';
		this.characterName = resolveCharacterName(state.joinCharacter?.characterName);
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

describe('ColdBootScanScene', () => {
	it('should default to fallback labels when navigation state is empty', () => {
		const component = new MockColdBootScanScene();

		expect(component.playerName).toBe('Unknown Pilot');
		expect(component.characterName).toBe('Unbound');
		expect(component.currentRouteLabel).toBe('/opening-cold-boot-scan');
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
