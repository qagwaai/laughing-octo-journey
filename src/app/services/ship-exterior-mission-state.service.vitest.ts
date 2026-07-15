import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import {
  ShipExteriorMissionStateService,
  type ShipExteriorMissionStateContext,
} from './ship-exterior-mission-state.service';

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
      activeObjectiveText: 'Objective: Identify an Iron asteroid via full scan.',
      updatedAt: '2026-04-28T00:00:00.000Z',
      steps: [
        {
          key: 'identify_iron_asteroid',
          status: 'active',
        },
        {
          key: 'neutralize_identified_asteroid',
          status: 'locked',
        },
        {
          key: 'manufacture_hull_patch_kit',
          status: 'locked',
        },
        {
          key: 'repair_scavenger_pod',
          status: 'locked',
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
    window.localStorage.setItem('ship-exterior-mission-state::first-target::Pioneer::char-1', '{not-json');

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

  it('should load fallback state when player name differs for same mission and character', () => {
    service.saveState(context, state);

    expect(
      service.loadState({
        ...context,
        playerName: 'Pioneer  ',
      }),
    ).toEqual(state);
  });

  it('should normalize legacy first-target state that is missing the repair step', () => {
    window.localStorage.setItem(
      'ship-exterior-mission-state::first-target::Pioneer::char-1',
      JSON.stringify({
        missionId: 'first-target',
        characterId: 'char-1',
        activeObjectiveText: 'Mission objectives complete. Await further directives.',
        updatedAt: '2026-04-30T00:00:00.000Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'completed' },
          { key: 'neutralize_identified_asteroid', status: 'completed' },
          { key: 'manufacture_hull_patch_kit', status: 'completed' },
        ],
      }),
    );

    expect(service.loadState(context)).toEqual({
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      updatedAt: '2026-04-30T00:00:00.000Z',
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'completed' },
        { key: 'repair_scavenger_pod', status: 'active' },
      ],
    });
  });
});
