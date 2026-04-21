export {};

class MockColdBootOpeningPage {
	stage = 0;
	content = {
		sequenceTitle: 'Opening Sequence: Cold Boot',
		eyebrow: 'Mission Bootstrap',
		phaseOneTitle: '1. The Blackout Phase',
		phaseTwoTitle: '2. The First View',
		phaseThreeTitle: '3. The AI Awakening',
		systemChecks: [
		'BIOS CHECK... OK',
		'OXYGEN LEVELS... 18% (CRITICAL)',
		'NEURAL LINK... ESTABLISHED',
		],
		aiTransmission:
			'Pilot, the Reactor Drone has been lost. We are drifting on residual battery. To survive, we must secure high-density matter for the Fabrication Unit. Deployment of the last Expendable unit is authorized.',
	};

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
}

describe('ColdBootOpeningPage', () => {
	it('should expose opening sequence title', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.sequenceTitle).toBe('Opening Sequence: Cold Boot');
	});

	it('should list blackout system checks in order', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.systemChecks).toEqual([
			'BIOS CHECK... OK',
			'OXYGEN LEVELS... 18% (CRITICAL)',
			'NEURAL LINK... ESTABLISHED',
		]);
	});

	it('should include critical oxygen warning in checks', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.systemChecks[1]).toContain('CRITICAL');
	});

	it('should include expendable unit authorization in AI transmission', () => {
		const component = new MockColdBootOpeningPage();
		expect(component.content.aiTransmission).toContain('Deployment of the last Expendable unit is authorized.');
	});

	it('should reveal checks progressively by stage', () => {
		const component = new MockColdBootOpeningPage();

		component.stage = 0;
		expect(component.visibleSystemChecks().length).toBe(0);

		component.stage = 1;
		expect(component.visibleSystemChecks()).toEqual(['BIOS CHECK... OK']);

		component.stage = 2;
		expect(component.visibleSystemChecks().length).toBe(2);

		component.stage = 3;
		expect(component.visibleSystemChecks().length).toBe(3);
	});
});
