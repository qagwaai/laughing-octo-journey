import { expect, Page } from '@playwright/test';

/**
 * Page object for ship-related elements in the stellar viewer scene.
 * Provides locators for ship legend entries and helpers to assert ship visibility.
 */
export class ViewerShipsPage {
  constructor(private readonly page: Page) {}

  get legend() {
    return this.page.getByTestId('viewer-legend');
  }

  get activeShipLegendItem() {
    return this.page.getByTestId('viewer-legend-active-ship');
  }

  get inactiveShipLegendItem() {
    return this.page.getByTestId('viewer-legend-inactive-ship');
  }

  get activeShipLegendSwatch() {
    return this.activeShipLegendItem.locator('.viewer-legend__swatch');
  }

  get inactiveShipLegendSwatch() {
    return this.inactiveShipLegendItem.locator('.viewer-legend__swatch');
  }

  async assertLegendVisible() {
    await expect(this.legend).toBeVisible();
    await expect(this.activeShipLegendItem).toBeVisible();
    await expect(this.inactiveShipLegendItem).toBeVisible();
  }

  async assertActiveShipSwatchColor(expectedHex: string) {
    const style = await this.activeShipLegendSwatch.getAttribute('style');
    expect(style).toContain(expectedHex.toLowerCase());
  }

  async assertInactiveShipSwatchColor(expectedHex: string) {
    const style = await this.inactiveShipLegendSwatch.getAttribute('style');
    expect(style).toContain(expectedHex.toLowerCase());
  }
}
