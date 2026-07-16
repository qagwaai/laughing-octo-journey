import type { Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { loginAndJoinViewerSession } from './viewer-session-bootstrap';

const characterWithJoin = {
  id: 'char-vw-1',
  characterName: 'Astrocartographer',
  level: 2,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

const solSummary = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  isMultiStar: false,
  starCount: 1,
  distanceParsec: 0,
  primaryStar: { hygId: '0', spectralClass: 'G2V', colorHex: '#fff5b6', luminositySolar: 1, massSolar: 1 },
};

const alphaCenSummary = {
  id: 'alpha-centauri',
  displayName: 'Alpha Centauri',
  source: 'curated',
  isMultiStar: true,
  starCount: 3,
  distanceParsec: 1.34,
  primaryStar: { hygId: '71456', spectralClass: 'G2V', colorHex: '#ffe7a8', luminositySolar: 1.5, massSolar: 1.1 },
};

const ACTIVE_SHIP = {
  id: 'ship-vw-1',
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

const solGetResponse = {
  success: true,
  message: 'ok',
  playerName: TEST_PLAYER,
  solarSystemId: 'sol',
  solarSystem: solSummary,
  stars: [
    {
      id: 'sol-star',
      bodyType: 'star',
      displayName: 'Sol',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#fff5b6' },
      spectralClass: 'G2V',
      luminositySolar: 1,
    },
  ],
  bodies: [
    {
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1.5e8, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#3399ff' },
      physicalCatalog: { estimatedDiameterM: 12_742_000 },
    },
    {
      id: 'mars',
      bodyType: 'planet',
      displayName: 'Mars',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 2.28e8, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#c1440e' },
      physicalCatalog: { estimatedDiameterM: 6_792_000 },
    },
  ],
};

export async function setupViewerTest(page: Page): Promise<{ mock: SocketIOMock }> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithJoin]),
  }));
  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: 'ok',
      playerName: TEST_PLAYER,
      characterId: characterWithJoin.id,
      ships: [ACTIVE_SHIP],
    },
  }));
  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: 'ok',
      playerName: TEST_PLAYER,
      solarSystems: [solSummary, alphaCenSummary],
    },
  }));
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solGetResponse,
  }));

  await loginAndJoinViewerSession({ page, mock, gameShell });
  return { mock };
}