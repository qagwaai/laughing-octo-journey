import { OPENING_STAGE_TIMINGS_MS, resolveOpeningSequenceContent } from './opening-sequence';

describe('opening-sequence model', () => {
	it('should resolve default cold-boot variant', () => {
		const content = resolveOpeningSequenceContent('en-US');
		expect(content.sequenceTitle).toBe('Opening Sequence: Cold Boot');
		expect(content.systemChecks.length).toBe(3);
	});

	it('should resolve explicit distress variant', () => {
		const content = resolveOpeningSequenceContent('en', 'cold-boot-distress');
		expect(content.eyebrow).toBe('Distress Bootstrap');
		expect(content.hudTitle).toContain('DISTRESS');
	});

	it('should fallback to default variant for unknown variant keys', () => {
		const content = resolveOpeningSequenceContent('en', 'unknown-variant');
		expect(content.hudTitle).toBe('COLD BOOT // TIER 1 SCAVENGER POD');
	});

	it('should fallback to english locale when locale is unknown', () => {
		const content = resolveOpeningSequenceContent('zz-ZZ', 'cold-boot');
		expect(content.phaseOneTitle).toContain('Blackout');
	});

	it('should resolve Italian cold-boot content', () => {
		const content = resolveOpeningSequenceContent('it-IT', 'cold-boot');
		expect(content.sequenceTitle).toBe('Sequenza iniziale: Cold Boot');
		expect(content.phaseOneTitle).toContain('blackout');
		expect(content.systemChecks[0]).toContain('CONTROLLO BIOS');
	});

	it('should expose increasing stage timing values', () => {
		expect(OPENING_STAGE_TIMINGS_MS.blackoutReveal).toBeLessThan(OPENING_STAGE_TIMINGS_MS.firstViewReveal);
		expect(OPENING_STAGE_TIMINGS_MS.firstViewReveal).toBeLessThan(OPENING_STAGE_TIMINGS_MS.aiReveal);
	});
});
