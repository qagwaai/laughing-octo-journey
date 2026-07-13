import { expect, test } from '@playwright/test';
import { configurePrintQueueMock } from '../fixtures/print-queue-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

async function loginAndOpenPrintQueue(options: { usableShipSpatial: boolean; includeIron: boolean }, page: Parameters<typeof test>[0]['page']) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();
  configurePrintQueueMock(mock, options);

  await loginViaUI(page, mock);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await gameShell.openNav('Fabrication Lab');
  await expect(page).toHaveURL(/left:fabrication-lab/, { timeout: 10_000 });

  await page.getByRole('button', { name: 'View Print Queue' }).click();
  await expect(page).toHaveURL(/right:print-queue/, { timeout: 10_000 });
}

test.describe('Print Queue', () => {
  test('queues a hull patch kit and cancel restores materials path', async ({ page }) => {
    await loginAndOpenPrintQueue({ usableShipSpatial: true, includeIron: true }, page);

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
    await loginAndOpenPrintQueue({ usableShipSpatial: false, includeIron: false }, page);

    await expect(page.locator('p.status-line--error[role="alert"]')).toHaveText(
      'No ship with usable spatial data is available.',
    );
    await expect(page.getByRole('button', { name: 'Print Hull Patch Kit' })).toHaveCount(0);
  });
});
