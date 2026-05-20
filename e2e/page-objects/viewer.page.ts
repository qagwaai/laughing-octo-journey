import { expect, Page } from '@playwright/test';

export class ViewerPage {
  constructor(private readonly page: Page) {}

  get heading() {
    return this.page.locator('h1').first();
  }

  get systemList() {
    return this.page.getByTestId('viewer-system-list');
  }

  systemItemById(id: string) {
    return this.systemList.locator(`[data-system-id="${id}"]`);
  }

  systemButtonByName(name: string) {
    return this.page.locator('.solar-system-item__button', { hasText: name }).first();
  }

  get detailsViewToggleButtons() {
    return this.page.locator('.details-view-toggle__btn');
  }

  get detailsViewByDistanceButton() {
    return this.detailsViewToggleButtons.nth(1);
  }

  get loadingState() {
    return this.page.getByTestId('viewer-loading');
  }

  get emptyState() {
    return this.page.getByTestId('viewer-empty');
  }

  get sceneHost() {
    return this.page.locator('app-viewer-scene-page .viewer-scene-host');
  }

  get sceneContainer() {
    return this.page.locator('app-viewer-scene-page');
  }

  get sceneCanvas() {
    return this.page.locator('.viewer-scene-host canvas').first();
  }

  get sceneError() {
    return this.page.getByTestId('viewer-scene-error');
  }

  async selectSystem(name: string) {
    await this.systemButtonByName(name).click();
    await expect(this.page).toHaveURL(/right:viewer-scene/);
  }

  async switchToDistanceView() {
    await this.detailsViewByDistanceButton.click();
    await expect(this.detailsViewByDistanceButton).toHaveAttribute('aria-pressed', 'true');
  }
}
