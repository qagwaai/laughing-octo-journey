import { expect, Page } from '@playwright/test';

export class MissionBoardPage {
  constructor(private readonly page: Page) {}

  private get boardRoot() {
    return this.page.locator('app-mission-board-page .ops-page-container').first();
  }

  get heading() {
    return this.boardRoot.locator('.page-main h1').first();
  }

  get missionItems() {
    return this.boardRoot.locator('.mission-item');
  }

  missionItem(index: number) {
    return this.missionItems.nth(index);
  }

  missionStatus(index: number) {
    return this.missionItem(index).locator('.mission-status');
  }

  lane(lane: 'available' | 'active' | 'completed') {
    return this.boardRoot.locator(`.mission-lane[data-lane="${lane}"]`).first();
  }

  laneCount(lane: 'available' | 'active' | 'completed') {
    return this.boardRoot.locator(`.lane-count[data-lane-count="${lane}"]`).first();
  }

  laneItems(lane: 'available' | 'active' | 'completed') {
    return this.boardRoot.locator(`[data-lane-item="${lane}"]`);
  }

  filterButton(filter: 'all' | 'available' | 'active' | 'completed') {
    return this.boardRoot.locator(`.lane-filter__button[data-filter="${filter}"]`).first();
  }

  guardedNavButton(label: string) {
    return this.boardRoot.locator(`button[aria-label="${label}"]`);
  }

  guardedMenu() {
    return this.boardRoot.locator('app-guarded-left-menu');
  }

  laneStatusBadges(lane: 'available' | 'active' | 'completed', status: string) {
    return this.lane(lane).locator(`.mission-status[data-status="${status}"]`);
  }

  contractViolationBanner() {
    return this.boardRoot.locator('.contract-violation');
  }

  contractViolationStatusBadges() {
    return this.boardRoot.locator('.mission-status[data-status="contract-violation"]');
  }

  async expectLaneItemCount(lane: 'available' | 'active' | 'completed', expectedCount: number, timeout = 10_000) {
    await expect(this.laneItems(lane)).toHaveCount(expectedCount, { timeout });
  }

  async expectLaneStatusCount(
    lane: 'available' | 'active' | 'completed',
    status: string,
    expectedCount: number,
    timeout = 10_000,
  ) {
    await expect(this.laneStatusBadges(lane, status)).toHaveCount(expectedCount, { timeout });
  }

  async expectGuardedNavHidden(label: string) {
    await expect(this.guardedNavButton(label)).not.toBeVisible();
  }

  async expectGuardedMenuHidden() {
    await expect(this.guardedMenu()).not.toBeVisible();
  }

  async expectNoContractViolationStatusBadge() {
    await expect(this.contractViolationStatusBadges()).not.toBeVisible();
  }

  async expectContractViolationContains(text: string | RegExp) {
    await expect(this.contractViolationBanner()).toContainText(text);
  }
}
