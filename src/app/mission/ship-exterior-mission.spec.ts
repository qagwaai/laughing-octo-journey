import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import {
	SHIP_EXTERIOR_MISSION_IDS,
	resolveShipExteriorMission,
} from './ship-exterior-mission';

describe('resolveShipExteriorMission', () => {
	it('should resolve the first-target mission by id', () => {
		expect(resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).missionId).toBe(FIRST_TARGET_MISSION_ID);
		expect(resolveShipExteriorMission(SHIP_EXTERIOR_MISSION_IDS.firstTarget).missionId).toBe(FIRST_TARGET_MISSION_ID);
	});

	it('should fall back to first-target when the mission id is empty or unknown', () => {
		expect(resolveShipExteriorMission('').missionId).toBe(FIRST_TARGET_MISSION_ID);
		expect(resolveShipExteriorMission('unknown-mission').missionId).toBe(FIRST_TARGET_MISSION_ID);
	});
});