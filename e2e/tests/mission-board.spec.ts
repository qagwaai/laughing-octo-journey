import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MissionBoardPage } from '../page-objects/mission-board.page';

// ── Shared test data ───────────────────────────────────────────────────────────

const FIRST_TARGET_MISSION_ID = 'first-target';

const characterWithStartedMission = {
  id: 'char-3',
  characterName: 'Scout Alpha',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
};

const characterWithCompletedMission = {
  id: 'char-4',
  characterName: 'Scout Beta',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

const completedMissionGateState = {
  missionId: FIRST_TARGET_MISSION_ID,
  characterId: 'char-3',
  activeObjectiveText: 'Mission objectives complete. Await further directives.',
  updatedAt: '2026-04-30T00:00:00.000Z',
  steps: [
    { key: 'identify_iron_asteroid', status: 'completed' },
    { key: 'neutralize_identified_asteroid', status: 'completed' },
    { key: 'manufacture_hull_patch_kit', status: 'completed' },
    { key: 'repair_scavenger_pod', status: 'completed' },
  ],
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

// ── Helper: set up socket mock, log in, and return the character-list page ────

async function setupMissionBoardTest(page: Page, characters: object[]) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse(characters),
  }));

  await loginViaUI(page, mock);

  return { mock };
}

// ── Tests: mission board ───────────────────────────────────────────────────────

test.describe('Mission Board — mission progress display', () => {
  test('shows completed mission status and stage on mission board after joining in-progress game', async ({ page }) => {
    const { mock } = await setupMissionBoardTest(page, [characterWithStartedMission]);
    const gameShell = new GameShellPage(page);
    const missionBoardPage = new MissionBoardPage(page);

    mock.on('game-join-request', () => null);
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-3',
        ships: [
          {
            id: 'ship-1',
            name: 'Nomad',
            model: 'Scavenger Pod',
            tier: 1,
            status: 'ACTIVE',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 350000000, y: 0, z: 10000000 },
              epochMs: 1715000000000,
            },
          },
        ],
      },
    }));
    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-3',
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'in-progress',
            statusDetail: JSON.stringify(completedMissionGateState),
            startedAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
        ],
      },
    }));

    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/left:game-main/);

    await gameShell.openMissionBoard();

    const leftMissionBoard = page.locator('app-mission-board-page .ops-page-container').first();
    await expect(leftMissionBoard.locator('button[aria-label="Mission Board"]')).toHaveCount(1);

    const missionItem = missionBoardPage.missionItem(0);
    await expect(missionItem).toContainText('Your First Target');
    await expect(missionBoardPage.missionStatus(0)).toHaveText('completed');
    await expect(missionBoardPage.missionStatus(0)).toHaveAttribute('data-status', 'completed');
    await expect(missionItem).toContainText('Stage 4 of 4 — Complete');
    await expect(missionItem).toContainText('Mission objectives complete. Await further directives.');
  });

  test('right mission-board does not render guarded menu items after first-target completion', async ({ page }) => {
    const { mock } = await setupMissionBoardTest(page, [characterWithCompletedMission]);
    const gameShell = new GameShellPage(page);

    mock.on('game-join-request', () => null);
    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-4',
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'completed',
            statusDetail: JSON.stringify(completedMissionGateState),
            startedAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
        ],
      },
    }));

    await gameShell.joinGame();
    await expect(page).toHaveURL(/right:mission-board/);

    const rightMissionBoard = page.locator('app-mission-board-page .ops-page-container').first();
    await expect(rightMissionBoard).toBeVisible();
    await expect(rightMissionBoard.locator('app-guarded-left-menu')).toHaveCount(0);
    await expect(rightMissionBoard.locator('button[aria-label="Mission Board"]')).toHaveCount(0);
    await expect(rightMissionBoard.locator('button[aria-label="Viewer"]')).toHaveCount(0);
  });
});
