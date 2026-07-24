import { TEST_PLAYER } from '../helpers/auth-helper';
import type { SocketIOMock } from './socket-mock';

type CharacterListOptions = {
  characters: object[];
  playerName?: string;
  message?: string;
};

type ShipListOptions = {
  characterId: string;
  ships: any[];
  playerName?: string;
  message?: string;
};

type SolarSystemListOptions = {
  solarSystems: any[];
  playerName?: string;
  message?: string;
};

export function registerViewerCharacterList(mock: SocketIOMock, options: CharacterListOptions) {
  const { characters, playerName = TEST_PLAYER, message = '' } = options;
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message,
      playerName,
      characters,
    },
  }));
}

export function registerViewerGameJoin(mock: SocketIOMock) {
  mock.on('game-join-request', () => null);
}

export function registerViewerShipListByOwner(mock: SocketIOMock, options: ShipListOptions) {
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

export function registerViewerSolarSystemList(mock: SocketIOMock, options: SolarSystemListOptions) {
  const { solarSystems, playerName = TEST_PLAYER, message = '' } = options;
  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message,
      playerName,
      solarSystems,
    },
  }));
}
