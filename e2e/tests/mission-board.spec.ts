import { test, expect, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

// ── Shared test data ───────────────────────────────────────────────────────────

const FIRST_TARGET_MISSION_ID = 'first-target';

const characterWithStartedMission = {
  id: 'char-3',
  characterName: 'Scout Alpha',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
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

    mock.on('game-join-request', () => null);
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

    await page.locator('.character-item button[class*="join"]', { hasText: 'Join Game in Progress' }).click();
    await expect(page).toHaveURL(/left:game-main/);

    await page.locator('button[aria-label="Mission Board"]').click();
    await expect(page).toHaveURL(/left:mission-board/);

    const missionItem = page.locator('.mission-item').first();
    await expect(missionItem).toContainText('first-target');
    await expect(missionItem.locator('.mission-status')).toHaveText('completed');
    await expect(missionItem.locator('.mission-status')).toHaveAttribute('data-status', 'completed');
    await expect(missionItem).toContainText('Stage 4 of 4 — Complete');
    await expect(missionItem).toContainText('Mission objectives complete. Await further directives.');
  });
});
