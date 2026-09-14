import { expect, Page } from '@playwright/test';
import { dispatchClick, dispatchClickUntilUrl } from '../helpers/dispatch-click';

export class GameShellPage {
  constructor(private readonly page: Page) {}

  joinButton(text?: string) {
    if (text) {
      return this.page.locator('.character-item button.join-link', { hasText: text }).first();
    }
    return this.page.locator('.character-item button.join-link').first();
  }

  async joinGame(text?: string) {
    const button = this.joinButton(text);
    await expect(button).toBeVisible({ timeout: 15_000 });
    await expect(button).toBeEnabled({ timeout: 15_000 });
    await button.click();
  }

  navButton(label: string) {
    return this.page.locator(`app-guarded-left-menu button[aria-label="${label}"]:visible`).first();
  }

  async openNav(label: string, expectedUrl?: RegExp) {
    if (expectedUrl) {
      await dispatchClickUntilUrl(this.page, this.navButton(label), expectedUrl);
      return;
    }
    await dispatchClick(this.navButton(label));
  }

  async openViewer() {
    await this.openNav('Viewer', /left:viewer/);
    await expect(this.page).toHaveURL(/left:viewer/);
  }

  async openMarketHub() {
    await this.openNav('Market Hub', /left:market-hub/);
    await expect(this.page).toHaveURL(/left:market-hub/);
  }

  async openMissionBoard() {
    await this.openNav('Mission Board', /right:mission-board/);
    await expect(this.page).toHaveURL(/right:mission-board/);
  }
}
