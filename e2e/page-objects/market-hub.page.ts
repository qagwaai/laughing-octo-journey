import { expect, Page } from '@playwright/test';

export class MarketHubPage {
  constructor(private readonly page: Page) {}

  get reachableHeading() {
    return this.page.getByRole('heading', { name: 'Reachable Markets' });
  }

  get beyondCurrentDriveHeading() {
    return this.page.getByRole('heading', { name: 'Beyond Current Drive' });
  }

  get showOutOfRangeToggle() {
    return this.page.locator('#showOutOfRangeMarkets');
  }

  get marketItems() {
    return this.page.locator('.market-item');
  }

  marketList(index: number) {
    return this.page.locator('.market-list').nth(index);
  }

  marketItemInList(listIndex: number, itemIndex: number) {
    return this.marketList(listIndex).locator('.market-item').nth(itemIndex);
  }

  get reloadButton() {
    return this.page.locator('.reload-btn');
  }

  async enableOutOfRangeMarkets() {
    await this.showOutOfRangeToggle.scrollIntoViewIfNeeded();
    await this.showOutOfRangeToggle.check();
  }

  async waitForMarketItemCount(expectedCount: number, timeout = 5_000) {
    await expect(this.marketItems).toHaveCount(expectedCount, { timeout });
  }

  async waitForAtLeastMarketItems(minimumCount: number, timeout = 15_000) {
    await expect.poll(() => this.marketItems.count(), { timeout }).toBeGreaterThanOrEqual(minimumCount);
  }
}
