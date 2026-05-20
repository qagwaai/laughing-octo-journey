import { expect, Page } from '@playwright/test';

export class GameShellPage {
  constructor(private readonly page: Page) {}

  joinButton(text?: string) {
    if (text) {
      return this.page.locator('.character-item button.join-link', { hasText: text }).first();
    }
    return this.page.locator('.character-item button.join-link').first();
  }

  async joinGame(text?: string) {
    await this.joinButton(text).click();
  }

  navButton(label: string) {
    return this.page.locator(`app-guarded-left-menu button[aria-label="${label}"]`).last();
  }

  async openNav(label: string) {
    const button = this.navButton(label);
    await button.scrollIntoViewIfNeeded();
    await button.click();
  }

  async openViewer() {
    await this.openNav('Viewer');
    await expect(this.page).toHaveURL(/left:viewer/);
  }

  async openMarketHub() {
    await this.openNav('Market Hub');
    await expect(this.page).toHaveURL(/left:market-hub/);
  }

  async openMissionBoard() {
    await this.openNav('Mission Board');
    await expect(this.page).toHaveURL(/left:mission-board/);
  }

  async openShipHangar() {
    await this.openNav('Ship Hangar');
    await expect(this.page).toHaveURL(/left:ship-hangar/);
  }
}
