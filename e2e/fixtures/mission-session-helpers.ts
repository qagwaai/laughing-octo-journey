import { TEST_PLAYER } from '../helpers/auth-helper';
import type { SocketIOMock } from './socket-mock';

type MissionListOptions = {
  characterId: string;
  missions: any[];
  playerName?: string;
  message?: string;
  requestEvent?: 'list-missions-request' | 'mission-list-request';
  responseEvent?: 'list-missions-response' | 'mission-list-response';
};

type ShipListOptions = {
  characterId: string;
  ships: any[];
  playerName?: string;
  message?: string;
};

export function registerMissionCharacterList(
  mock: SocketIOMock,
  characters: object[],
  playerName = TEST_PLAYER,
): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName,
      characters,
    },
  }));
}

export function registerMissionGameJoin(mock: SocketIOMock): void {
  mock.on('game-join-request', () => null);
}

export function registerMissionShipListByOwner(mock: SocketIOMock, options: ShipListOptions): void {
  const { characterId, ships, playerName = TEST_PLAYER, message = '' } = options;
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message,
      playerName,
      characterId,
      ships,
    },
  }));
}

export function registerMissionList(mock: SocketIOMock, options: MissionListOptions): void {
  const {
    characterId,
    missions,
    playerName = TEST_PLAYER,
    message = '',
    requestEvent = 'list-missions-request',
    responseEvent = 'list-missions-response',
  } = options;
  mock.on(requestEvent, () => ({
    event: responseEvent,
    data: {
      success: true,
      message,
      playerName,
      characterId,
      missions,
    },
  }));
}
