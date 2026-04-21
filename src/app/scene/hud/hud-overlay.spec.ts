class MockHudOverlay {
	title = 'COLD BOOT // TIER 1 SCAVENGER POD';
	systemChecks = [
		'BIOS CHECK... OK',
		'OXYGEN LEVELS... 18% (CRITICAL)',
		'NEURAL LINK... ESTABLISHED',
	];
	aiLabel = 'AI LINK // DEGRADED CHANNEL';
	aiMessage = 'Deployment of the last Expendable unit is authorized.';
}

describe('HudOverlay', () => {
	it('should expose default title and AI label', () => {
		const hud = new MockHudOverlay();
		expect(hud.title).toContain('COLD BOOT');
		expect(hud.aiLabel).toContain('AI LINK');
	});

	it('should expose system checks for terminal rendering', () => {
		const hud = new MockHudOverlay();
		expect(hud.systemChecks.length).toBe(3);
		expect(hud.systemChecks[1]).toContain('18%');
	});

	it('should expose AI message for overlay text', () => {
		const hud = new MockHudOverlay();
		expect(hud.aiMessage).toContain('Expendable unit');
	});
});
