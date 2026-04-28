import {
	ShipExteriorMissionStateService,
	type ShipExteriorMissionStateContext,
} from './ship-exterior-mission-state.service';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';

describe('ShipExteriorMissionStateService', () => {
	let service: ShipExteriorMissionStateService;
	let context: ShipExteriorMissionStateContext;
	let state: ShipExteriorMissionGateState;

	beforeEach(() => {
		service = new ShipExteriorMissionStateService();
		context = {
			missionId: 'first-target',
			playerName: 'Pioneer',
			characterId: 'char-1',
		};
		state = {
			missionId: 'first-target',
			characterId: 'char-1',
			activeObjectiveText: 'Identify an Iron asteroid',
			updatedAt: '2026-04-28T00:00:00.000Z',
			steps: [
				{
					key: 'identify_iron_asteroid',
					status: 'active',
				},
			],
		};
		window.localStorage.clear();
	});

	it('should save and load state for a context', () => {
		service.saveState(context, state);
		expect(service.loadState(context)).toEqual(state);
	});

	it('should return null for malformed payloads', () => {
		window.localStorage.setItem(
			'ship-exterior-mission-state::first-target::Pioneer::char-1',
			'{not-json',
		);

		expect(service.loadState(context)).toBeNull();
	});

	it('should isolate states between characters', () => {
		service.saveState(context, state);

		expect(
			service.loadState({
				...context,
				characterId: 'char-2',
			}),
		).toBeNull();
	});

	it('should clear stored state', () => {
		service.saveState(context, state);
		service.clearState(context);

		expect(service.loadState(context)).toBeNull();
	});
});
