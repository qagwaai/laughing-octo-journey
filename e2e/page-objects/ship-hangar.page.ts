import { Page } from '@playwright/test';

export class ShipHangarPage {
  constructor(private readonly page: Page) {}

  get shipItems() {
    return this.page.locator('.ship-item');
  }

  shipItem(index: number) {
    return this.shipItems.nth(index);
  }

  shipItemByName(name: string) {
    return this.page.locator('.ship-item').filter({ hasText: name }).first();
  }

  activeShipControlButton(index: number) {
    return this.shipItem(index).locator('button.inventory-link').nth(3);
  }

  activeShipControlButtonByName(name: string) {
    return this.shipItemByName(name).locator('button.inventory-link').nth(3);
  }

  setActiveShipButton(index: number) {
    return this.activeShipControlButton(index);
  }

  activeShipButton(index: number) {
    return this.activeShipControlButton(index);
  }

  get shipBadgeName() {
    return this.page.locator('app-character-ship-badge .ship-badge-name');
  }
}
