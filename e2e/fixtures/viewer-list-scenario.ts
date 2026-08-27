import { type Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { loginAndJoinViewerSession } from './viewer-session-bootstrap';
import {
  registerViewerCharacterList,
  registerViewerGameJoin,
  registerViewerShipListByOwner,
  registerViewerSolarSystemList,
} from './viewer-fixture-helpers';

export const SOL_SYSTEM: Partial<any> = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: {
    hygId: '0',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.0,
  },
};

export const ALPHA_CENTAURI_SYSTEM: Partial<any> = {
  id: 'alpha-centauri',
  displayName: 'Alpha Centauri',
  source: 'procedural',
  distanceParsec: 1.3,
  starCount: 3,
  primaryStar: {
    hygId: '71681',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.1,
  },
};

export const SIRIUS_SYSTEM: Partial<any> = {
  id: 'sirius',
  displayName: 'Sirius',
  source: 'curated',
  distanceParsec: 2.6,
  starCount: 1,
  primaryStar: {
    hygId: '32349',
    spectralClass: 'A1V',
    colorHex: '#f0f4ff',
    luminositySolar: 26.0,
  },
};

export const ACTIVE_SHIP = {
  id: 'ship-viewer-list-1',
  name: 'Scout Pod',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 350000000, y: 0, z: 0 },
    epochMs: 1715000000000,
  },
};

export function solarSystemListResponse(systems: any[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystems: systems,
  };
}

export async function setupViewerListTest(page: Page, systems: any[] = []) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  registerViewerCharacterList(mock, {
    characters: [
      {
        id: 'char-viewer-1',
        characterName: 'Scout',
        level: 1,
        missions: [
          {
            missionId: 'first-target',
            status: 'active',
          },
        ],
      },
    ],
  });

  // Must join a game before viewer menu is enabled
  registerViewerGameJoin(mock);
  registerViewerShipListByOwner(mock, {
    characterId: 'char-viewer-1',
    ships: [ACTIVE_SHIP],
  });
  await loginAndJoinViewerSession({ page, mock, gameShell });

  registerViewerSolarSystemList(mock, { solarSystems: systems });

  return { mock };
}