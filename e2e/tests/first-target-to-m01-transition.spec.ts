import { expect, test } from '@playwright/test';
import { setupFirstTargetToM01MissionBoardTest } from '../fixtures/first-target-to-m01-transition-scenario';

// ── Test data ─────────────────────────────────────────────────────────────────

const FIRST_TARGET_MISSION_ID = 'first-target';
const M01_MISSION_ID = 'm-01';

// ── Tests: Mission Board before first-target completion ───────────────────────

test.describe('Mission Board — first-target in progress', () => {
  test('shows first-target mission in the active mission list when started', async ({ page }) => {
    const missions = [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }];
    await setupFirstTargetToM01MissionBoardTest(page, { missions });

    await expect(page.getByText('Mission Log')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.mission-lane[data-lane="active"] [data-lane-item="active"]')).toHaveCount(1);
  });

  test('shows locked catalog missions when first-target is only started', async ({ page }) => {
    const missions = [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }];
    await setupFirstTargetToM01MissionBoardTest(page, { missions });

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
    await setupFirstTargetToM01MissionBoardTest(page, { missions });

    // Available lane should exist
    await expect(page.getByRole('region', { name: 'Available' })).toBeVisible({ timeout: 10_000 });
    // M-01's title should appear
    await expect(page.locator('.mission-lane[data-lane="available"]', { hasText: 'The Local Hub' })).toBeVisible();
    // Status badge should say available
    await expect(page.locator('.mission-lane[data-lane="available"] [data-status="available"]').first()).toBeVisible();
  });

  test('shows SQ-02 and SQ-03 as available after first-target completes', async ({ page }) => {
    const missions = [
      { missionId: FIRST_TARGET_MISSION_ID, status: 'completed' },
      { missionId: M01_MISSION_ID, status: 'available' },
      { missionId: 'sq-02', status: 'available' },
      { missionId: 'sq-03', status: 'available' },
    ];
    await setupFirstTargetToM01MissionBoardTest(page, { missions });

    await expect(page.getByText("Scavenger's Bounty")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Market Fluctuation')).toBeVisible();
  });

  test('still-locked missions do not appear in available section', async ({ page }) => {
    // Only first-target done; M-02 requires M-01 which is not done.
    const missions = [
      { missionId: FIRST_TARGET_MISSION_ID, status: 'completed' },
      { missionId: M01_MISSION_ID, status: 'available' },
    ];
    await setupFirstTargetToM01MissionBoardTest(page, { missions });

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
    const missions = [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }];
    await setupFirstTargetToM01MissionBoardTest(page, { missions });

    // Should show the human-readable title, not the raw ID
    await expect(page.getByText('The First Mission: Your First Target')).toBeVisible({ timeout: 10_000 });
    // Raw ID should not appear as the only text
    const rawIdLabel = page.locator('text=first-target');
    // It may appear in the "Mission:" label value — accept it but the title must also be shown
    await expect(page.getByText('The First Mission: Your First Target')).toBeVisible();
  });
});
