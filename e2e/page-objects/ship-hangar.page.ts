import { Page } from '@playwright/test';

export class ShipHangarPage {
  constructor(private readonly page: Page) {}

  get shipItems() {
    return this.page.locator('.ship-item');
  }

  shipItem(index: number) {
    return this.shipItems.nth(index);
  }

  setActiveShipButton(index: number) {
    return this.shipItem(index).locator('button', { hasText: 'Set as Active Ship' });
  }

  get shipBadgeName() {
    return this.page.locator('app-character-ship-badge .ship-badge-name');
  }
}
