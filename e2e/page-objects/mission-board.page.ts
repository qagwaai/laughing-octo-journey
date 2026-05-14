import { Page } from '@playwright/test';

export class MissionBoardPage {
  constructor(private readonly page: Page) {}

  get heading() {
    return this.page.locator('.page-main h1').first();
  }

  get missionItems() {
    return this.page.locator('.mission-item');
  }

  missionItem(index: number) {
    return this.missionItems.nth(index);
  }

  missionStatus(index: number) {
    return this.missionItem(index).locator('.mission-status');
  }
}
