import { Page } from '@playwright/test';

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
}
