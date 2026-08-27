import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

export const CHARACTER_SHIP_BADGE_MISSION_ID = 'first-target';

export const CHARACTER_WITH_MISSION = {
  id: 'char-1',
  characterName: 'Nova-Prime',
  level: 5,
  missions: [{ missionId: CHARACTER_SHIP_BADGE_MISSION_ID, status: 'active' }],
};

export const PRIMARY_SHIP = {
  id: 'd-1',
  name: 'Surveyor',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 1, y: 0, z: 0 },
    epochMs: 0,
  },
};

export const SECONDARY_SHIP = {
  id: 'd-2',
  name: 'Pathfinder',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 2, y: 0, z: 0 },
    epochMs: 0,
  },
};

export function characterListResponse(characters: object[]) {
  return { success: true, message: '', playerName: TEST_PLAYER, characters };
}

export function shipListByOwnerResponse(ships: object[]) {
  return {
    success: true,
    message: '',
    owner: {
      ownerType: 'player-character',
      playerId: 'player-1',
      characterId: CHARACTER_WITH_MISSION.id,
      npcId: null,
      factionId: null,
    },
    ships,
  };
}

export function registerCharacterShipBadgeSessionHandlers(mock: SocketIOMock, ships: object[] = [PRIMARY_SHIP]): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([CHARACTER_WITH_MISSION]),
  }));
  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: shipListByOwnerResponse(ships),
  }));
}