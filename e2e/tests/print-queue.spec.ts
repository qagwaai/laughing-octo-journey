import { expect, test } from '@playwright/test';
import { setupAndOpenPrintQueue } from '../fixtures/print-queue-scenario';

test.describe('Print Queue', () => {
  test('queues a hull patch kit and cancel restores materials path', async ({ page }) => {
    await setupAndOpenPrintQueue({ usableShipSpatial: true, includeIron: true }, page);

    const printButton = page.getByRole('button', { name: 'Print Hull Patch Kit' });
    await expect(printButton).toBeVisible();
    await expect(printButton).toBeEnabled();

    await printButton.click();

    await expect(page.locator('.status-line--success')).toContainText('queued for printing');
    const cancelButton = page.getByRole('button', { name: 'Cancel' }).first();
    await expect(cancelButton).toBeVisible();

    await cancelButton.click();

    await expect(page.locator('.status-line--success')).toContainText('Print job canceled.');
    await expect(page.getByRole('button', { name: 'Print Hull Patch Kit' })).toBeVisible();
  });

  test('shows hard-fail error and keeps print action unavailable when no ship has usable spatial data', async ({ page }) => {
    await setupAndOpenPrintQueue({ usableShipSpatial: false, includeIron: false }, page);

    await expect(page.locator('p.status-line--error[role="alert"]')).toHaveText(
      'No ship with usable spatial data is available.',
    );
    await expect(page.getByRole('button', { name: 'Print Hull Patch Kit' })).not.toBeVisible();
  });
});
