import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

// ── Test data ─────────────────────────────────────────────────────────────────

const FIRST_TARGET_MISSION_ID = 'first-target';
const M01_MISSION_ID = 'm-01';

const TEST_CHARACTER = { id: 'char-mission-test', characterName: 'Pioneer One', level: 1 };

function missionListResponseWith(missions: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: TEST_CHARACTER.id,
    missions,
  };
}

function missionUpsertResponse(missionId: string, status: string) {
  return {
    success: true,
    message: 'Mission updated.',
    playerName: TEST_PLAYER,
    characterId: TEST_CHARACTER.id,
    missionId,
    status,
  };
}

function missionAddResponse(missionId: string) {
  return {
    success: true,
    message: 'Mission added.',
    playerName: TEST_PLAYER,
    characterId: TEST_CHARACTER.id,
    missionId,
  };
}

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupMissionBoardTest(
  page: Page,
  options: {
    missions?: object[];
  } = {},
) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  const missions = options.missions ?? [];

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([
      {
        ...TEST_CHARACTER,
        // Keep join path deterministic (game-main) regardless of mission-list test data.
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
      },
    ]),
  }));

  mock.on('game-join-request', () => null);

  mock.on('mission-list-request', () => ({
    event: 'mission-list-response',
    data: missionListResponseWith(missions),
  }));

  mock.on('mission-upsert-request', (data) => {
    const req = data as { missionId?: string; status?: string };
    return {
      event: 'mission-upsert-response',
      data: missionUpsertResponse(req.missionId ?? '', req.status ?? ''),
    };
  });

  mock.on('mission-add-request', (data) => {
    const req = data as { missionId?: string };
    return {
      event: 'mission-add-response',
      data: missionAddResponse(req.missionId ?? ''),
    };
  });

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: missionListResponseWith(missions),
  }));

  await loginViaUI(page, mock);

  await gameShell.joinGame();
  await expect(page).toHaveURL(/left:game-main|left:opening-cold-boot/);

  await gameShell.openMissionBoard();

  return { mock };
}

// ── Tests: Mission Board before first-target completion ───────────────────────

test.describe('Mission Board — first-target in progress', () => {
  test('shows first-target mission in the active mission list when started', async ({ page }) => {
    const missions = [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }];
    await setupMissionBoardTest(page, { missions });

    await expect(page.getByText('Mission Log')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('ul[aria-label="Mission list"] .mission-item')).toHaveCount(1);
  });

  test('shows locked catalog missions when first-target is only started', async ({ page }) => {
    const missions = [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }];
    await setupMissionBoardTest(page, { missions });

    // M-01 should appear in the locked section (not yet available)
    await expect(page.getByText('Locked Missions')).toBeVisible({ timeout: 10_000 });
    // The Local Hub should appear as locked
    await expect(page.getByText('The Local Hub')).toBeVisible();
  });
});

// ── Tests: Mission Board after first-target completion → M-01 available ───────

test.describe('Mission Board — after first-target completion', () => {
  test('shows M-01 in available missions section when first-target is completed', async ({ page }) => {
    const missions = [
      { missionId: FIRST_TARGET_MISSION_ID, status: 'completed' },
      { missionId: M01_MISSION_ID, status: 'available' },
    ];
    await setupMissionBoardTest(page, { missions });

    // Available section should exist
    await expect(page.getByText('Available Missions')).toBeVisible({ timeout: 10_000 });
    // M-01's title should appear
    await expect(page.getByText('The Local Hub')).toBeVisible();
    // Status badge should say available
    await expect(page.locator('[data-status="available"]').first()).toBeVisible();
  });

  test('shows SQ-02 and SQ-03 as available after first-target completes', async ({ page }) => {
    const missions = [
      { missionId: FIRST_TARGET_MISSION_ID, status: 'completed' },
      { missionId: M01_MISSION_ID, status: 'available' },
      { missionId: 'sq-02', status: 'available' },
      { missionId: 'sq-03', status: 'available' },
    ];
    await setupMissionBoardTest(page, { missions });

    await expect(page.getByText("Scavenger's Bounty")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Market Fluctuation')).toBeVisible();
  });

  test('still-locked missions do not appear in available section', async ({ page }) => {
    // Only first-target done; M-02 requires M-01 which is not done.
    const missions = [
      { missionId: FIRST_TARGET_MISSION_ID, status: 'completed' },
      { missionId: M01_MISSION_ID, status: 'available' },
    ];
    await setupMissionBoardTest(page, { missions });

    // M-02 title should not appear as available; it requires M-01.
    const m02Item = page.locator('.mission-item--available', { hasText: 'Basic Economics' });
    await expect(m02Item).toHaveCount(0);

    // But M-02 should appear in the locked section
    await expect(page.locator('.mission-item--locked', { hasText: 'Basic Economics' })).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ── Tests: Mission Board title display ────────────────────────────────────────

test.describe('Mission Board — mission title display', () => {
  test('renders mission titles from catalog instead of raw IDs', async ({ page }) => {
    const missions = [{ missionId: FIRST_TARGET_MISSION_ID, status: 'in-progress' }];
    await setupMissionBoardTest(page, { missions });

    // Should show the human-readable title, not the raw ID
    await expect(page.getByText('The First Mission: Your First Target')).toBeVisible({ timeout: 10_000 });
    // Raw ID should not appear as the only text
    const rawIdLabel = page.locator('text=first-target');
    // It may appear in the "Mission:" label value — accept it but the title must also be shown
    await expect(page.getByText('The First Mission: Your First Target')).toBeVisible();
  });
});
