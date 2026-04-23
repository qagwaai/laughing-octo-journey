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
