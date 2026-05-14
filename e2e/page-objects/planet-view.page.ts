import { Page } from '@playwright/test';

export class PlanetViewPage {
  constructor(private readonly page: Page) {}

  get header() {
    return this.page.getByTestId('planet-view-header');
  }

  get panel() {
    return this.page.getByTestId('planet-view-panel');
  }

  focusMoonButton(name: string) {
    return this.page.getByRole('button', { name: `Focus ${name}` });
  }

  get canvas() {
    return this.page.locator('canvas').first();
  }
}
