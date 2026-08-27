import { TEST_PLAYER } from '../helpers/auth-helper';
import type { SocketIOMock } from './socket-mock';

type RegisterMarketSessionOptions = {
  character: { id: string; [key: string]: unknown };
  ships: any[];
  playerName?: string;
  joinEvent?: string;
};

export function registerMarketCharacterList(
  mock: SocketIOMock,
  character: object,
  playerName = TEST_PLAYER,
): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName,
      characters: [character],
    },
  }));
}

export function registerMarketGameJoin(mock: SocketIOMock, joinEvent = 'game-join'): void {
  mock.on(joinEvent, () => null);
}

export function registerMarketShipListByOwner(
  mock: SocketIOMock,
  characterId: string,
  ships: any[],
  playerName = TEST_PLAYER,
): void {
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName,
      characterId,
      ships,
    },
  }));
}

export function registerMarketSharedSession(
  mock: SocketIOMock,
  options: RegisterMarketSessionOptions,
): void {
  const {
    character,
    ships,
    playerName = TEST_PLAYER,
    joinEvent = 'game-join',
  } = options;

  registerMarketCharacterList(mock, character, playerName);
  registerMarketGameJoin(mock, joinEvent);
  registerMarketShipListByOwner(mock, character.id, ships, playerName);
}
