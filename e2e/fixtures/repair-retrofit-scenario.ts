import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const REPAIR_RETROFIT_CHARACTER_ID = 'char-repair-e2e';

export function registerRepairMockDefault(mock: SocketIOMock): void {
  configureRepairMock(mock, { usableShipSpatial: true });
}

export function configureRepairMock(mock: SocketIOMock, options: { usableShipSpatial: boolean }): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: REPAIR_RETROFIT_CHARACTER_ID,
          characterName: 'Repair Pilot',
          level: 3,
          missions: [{ missionId: 'first-target', status: 'active' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: REPAIR_RETROFIT_CHARACTER_ID,
        npcId: null,
        factionId: null,
      },
      ships: [
        {
          id: 'ship-repair-1',
          name: 'Repair Pod',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'docked',
          inventory: [],
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: options.usableShipSpatial ? { x: 100, y: 0, z: 0 } : { x: 0, y: 0, z: 0 },
            epochMs: 0,
          },
        },
      ],
    },
  }));
}