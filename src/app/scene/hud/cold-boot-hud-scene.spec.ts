export {};

class MockColdBootHudScene {
	stage = 0;
	currentRouteLabel = '/opening-cold-boot';
	content = {
		hudTitle: 'COLD BOOT // TIER 1 SCAVENGER POD',
		aiLabel: 'AI LINK // DEGRADED CHANNEL',
		systemChecks: [
		'BIOS CHECK... OK',
		'OXYGEN LEVELS... 18% (CRITICAL)',
		'NEURAL LINK... ESTABLISHED',
		],
		aiTransmission:
		'Pilot, the Reactor Ship has been lost. We are drifting on residual battery. To survive, we must secure high-density matter for the Fabrication Unit. Deployment of the last Expendable unit is authorized.',
	};

	debrisField: readonly { position: number[]; rotation: number[]; scale: number[] }[] = [
		{ position: [-2.8, -0.6, -5.2], rotation: [0.4, 0.8, 0.2], scale: [0.85, 0.45, 0.35] },
		{ position: [1.9, 1.1, -4.1], rotation: [0.2, -0.4, 0.3], scale: [0.52, 0.28, 0.65] },
	];

	visibleSystemChecks() {
		if (this.stage < 1) {
			return [];
		}
		if (this.stage === 1) {
			return this.content.systemChecks.slice(0, 1);
		}
		if (this.stage === 2) {
			return this.content.systemChecks.slice(0, 2);
		}
		return this.content.systemChecks;
	}

	visibleAiMessage() {
		return this.stage >= 3 ? this.content.aiTransmission : '';
	}

	visibleDebris() {
		return this.stage >= 2 ? this.debrisField : [];
	}
}

describe('ColdBootHudScene', () => {
	it('should provide all three cold boot system checks', () => {
		const scene = new MockColdBootHudScene();
		scene.stage = 3;
		expect(scene.visibleSystemChecks().length).toBe(3);
		expect(scene.visibleSystemChecks()[0]).toContain('BIOS CHECK');
		expect(scene.visibleSystemChecks()[1]).toContain('OXYGEN LEVELS');
		expect(scene.visibleSystemChecks()[2]).toContain('NEURAL LINK');
	});

	it('should provide AI message with fabrication objective', () => {
		const scene = new MockColdBootHudScene();
		scene.stage = 3;
		expect(scene.visibleAiMessage()).toContain('secure high-density matter');
		expect(scene.visibleAiMessage()).toContain('Fabrication Unit');
	});

	it('should hide AI message until stage 3', () => {
		const scene = new MockColdBootHudScene();
		scene.stage = 2;
		expect(scene.visibleAiMessage()).toBe('');
	});

	it('should include debris field elements for graveyard ambience', () => {
		const scene = new MockColdBootHudScene();
		scene.stage = 2;
		expect(scene.visibleDebris().length).toBeGreaterThan(1);
		expect(scene.visibleDebris()[0].position.length).toBe(3);
		expect(scene.visibleDebris()[0].rotation.length).toBe(3);
		expect(scene.visibleDebris()[0].scale.length).toBe(3);
	});

	it('should expose HUD metadata from content model', () => {
		const scene = new MockColdBootHudScene();
		expect(scene.content.hudTitle).toContain('COLD BOOT');
		expect(scene.content.aiLabel).toContain('AI LINK');
	});

	it('should own route label rendering for this scene', () => {
		const scene = new MockColdBootHudScene();
		expect(scene.currentRouteLabel).toBe('/opening-cold-boot');
	});
});
