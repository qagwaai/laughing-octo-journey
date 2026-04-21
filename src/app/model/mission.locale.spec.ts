import { FIRST_TARGET_MISSION_ID, resolveMissionLocaleContent } from './mission.locale';

describe('mission locale content', () => {
	it('should return the first target mission in English', () => {
		const mission = resolveMissionLocaleContent(FIRST_TARGET_MISSION_ID, 'en-US');

		expect(mission.title).toBe('The First Mission: Your First Target');
		expect(mission.gameplayLoopSteps.length).toBe(4);
		expect(mission.gameplayLoopSteps[0]).toContain('Scanning:');
	});

	it('should fall back to first target mission when mission id is unknown', () => {
		const mission = resolveMissionLocaleContent('unknown-mission', 'en');
		expect(mission.title).toBe('The First Mission: Your First Target');
	});

	it('should fall back to English locale when locale is unsupported', () => {
		const mission = resolveMissionLocaleContent(FIRST_TARGET_MISSION_ID, 'fr-FR');
		expect(mission.title).toBe('The First Mission: Your First Target');
	});
});
