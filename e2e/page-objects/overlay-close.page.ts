import { expect, Locator, Page } from '@playwright/test';

/**
 * Shared control rendered by dismissible card overlays in the `right` outlet.
 *
 * See the `rightOutletRoutes` comment in `src/app/routed.routes.ts` for which pages
 * opt in, and why full-pane scenes deliberately do not.
 */
export class OverlayClosePage {
  constructor(private readonly page: Page) {}

  get closeButton(): Locator {
    return this.page.locator('[data-testid="overlay-close-button"]');
  }

  /**
   * Asserts the close button is tucked inside the overlay card's rounded corner rather than
   * anchored to the full-screen overlay pane.
   *
   * This guards a contract that has regressed twice: the button positions itself against the
   * nearest positioned ancestor, so a page root missing `position: relative` pushes it outside
   * the card (a negative inset), and a root using grid/flex can consume it as a layout item.
   * jsdom cannot compute layout, so this is only observable in a real browser.
   */
  async expectTuckedIntoCard(card: Locator, { minInset = 6, maxInset = 24 } = {}): Promise<void> {
    await expect(this.closeButton).toBeVisible();

    const cardBox = await card.boundingBox();
    const buttonBox = await this.closeButton.boundingBox();
    if (!cardBox || !buttonBox) {
      throw new Error('Overlay card and close button must both be visible to measure inset.');
    }

    const topInset = buttonBox.y - cardBox.y;
    const rightInset = cardBox.x + cardBox.width - (buttonBox.x + buttonBox.width);

    expect(topInset, 'close button top inset from card edge').toBeGreaterThanOrEqual(minInset);
    expect(topInset, 'close button top inset from card edge').toBeLessThanOrEqual(maxInset);
    expect(rightInset, 'close button right inset from card edge').toBeGreaterThanOrEqual(minInset);
    expect(rightInset, 'close button right inset from card edge').toBeLessThanOrEqual(maxInset);
  }

  async close(): Promise<void> {
    await expect(this.closeButton).toBeVisible();
    await this.closeButton.click();
  }
}
