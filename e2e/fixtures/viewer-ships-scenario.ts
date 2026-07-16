import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { bootstrapSharedGameMainSession } from './shared-session-bootstrap';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

export const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: { hygId: '0', spectralClass: 'G2V', colorHex: '#fff5b6', luminositySolar: 1.0 },
};

export const SOL_BODIES: any[] = [
  {
    id: 'sun',
    bodyType: 'star',
    displayName: 'The Sun',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 1715000000000 },
    visualization: { colorHex: '#fff5b6' },
    spectralClass: 'G2V',
    luminositySolar: 1.0,
    massSolar: 1.0,
  },
  {
    id: 'earth',
    bodyType: 'planet',
    displayName: 'Earth',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 149597870.7, y: 0, z: 0 }, epochMs: 1715000000000 },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 149597870.7,
      eccentricity: 0.0167,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 102.9,
      meanAnomalyAtEpochDeg: 100.5,
      orbitalPeriodSec: 31536000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
];

export const ACTIVE_SHIP = {
  id: 'ship-active-1',
  name: 'Wayfarer I',
  model: 'Scavenger Pod',
  tier: 1,
  status: null,
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 10000000, y: 0, z: 0 }, epochMs: 1715000000000 },
};

export const INACTIVE_SHIP = {
  id: 'ship-inactive-2',
  name: 'Drifter II',
  model: 'Scavenger Pod',
  tier: 1,
  status: null,
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 20000000, y: 0, z: 0 }, epochMs: 1715000000000 },
};

export const SHIP_IN_OTHER_SYSTEM = {
  id: 'ship-other-3',
  name: 'Far Wanderer',
  model: 'Scavenger Pod',
  tier: 1,
  status: null,
  spatial: { solarSystemId: 'proxima', frame: 'barycentric', positionKm: { x: 5000000, y: 0, z: 0 }, epochMs: 1715000000000 },
};

export function makeShipListResponse(ships: any[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: 'char-viewer-1',
    ships,
  };
}

export function makeSolarSystemGetResponse(bodies: any[] = SOL_BODIES) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystemId: 'sol',
    solarSystem: SOL_SUMMARY,
    bodies,
  };
}

function registerViewerSessionHandlers(mock: SocketIOMock, ships = [ACTIVE_SHIP, INACTIVE_SHIP]) {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: 'char-viewer-1',
          characterName: 'Scout',
          level: 1,
          missions: [{ missionId: 'first-target', status: 'active' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: makeShipListResponse(ships),
  }));
}

export async function setupIsolatedViewerShipsSession(page: Page): Promise<SocketIOMock> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  await bootstrapSharedGameMainSession({
    page,
    mock,
    gameShell,
    registerSessionHandlers: (registeredMock) => registerViewerSessionHandlers(registeredMock),
    joinButtonText: 'Join Game',
  });
  await expect(gameShell.navButton('Viewer')).toBeVisible({ timeout: 10_000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: { success: true, message: '', playerName: TEST_PLAYER, solarSystems: [SOL_SUMMARY] },
  }));

  return mock;
}

export type SharedViewerShipsSession = {
  context: BrowserContext;
  page: Page;
  mock: SocketIOMock;
  gameShell: GameShellPage;
  viewerPage: ViewerPage;
};

export async function setupSharedViewerShipsSession(browser: Browser): Promise<SharedViewerShipsSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);

  await mock.setup();

  await bootstrapSharedGameMainSession({
    page,
    mock,
    gameShell,
    registerSessionHandlers: (registeredMock) => registerViewerSessionHandlers(registeredMock),
    joinButtonText: 'Join Game',
  });
  await expect(gameShell.navButton('Viewer')).toBeVisible({ timeout: 10_000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: { success: true, message: '', playerName: TEST_PLAYER, solarSystems: [SOL_SUMMARY] },
  }));

  return { context, page, mock, gameShell, viewerPage };
}