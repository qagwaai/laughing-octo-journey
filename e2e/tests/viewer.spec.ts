import { expect, test, type Page } from '@playwright/test';
import { setupViewerTest } from '../fixtures/viewer-scenario';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

async function navigateToViewer(page: Page) {
  const gameShell = new GameShellPage(page);
  await gameShell.openViewer();
}

test.describe('Viewer — solar system browser (en)', () => {
  test('lists solar systems and renders the scene host on selection', async ({ page }) => {
    await setupViewerTest(page);
    await navigateToViewer(page);
    const viewerPage = new ViewerPage(page);

    await expect(page.getByRole('heading', { name: 'Solar System Viewer' })).toBeVisible();
    const list = viewerPage.systemList;
    await expect(list).toBeVisible();
    await expect(viewerPage.systemItemById('sol')).toContainText('Sol');
    await expect(viewerPage.systemItemById('alpha-centauri')).toContainText('Alpha Centauri');

    await viewerPage.selectSystem('Sol');
    await expect(viewerPage.sceneHost).toBeVisible();
  });
});

test.describe('Viewer — locale strings (it)', () => {
  test('renders Italian labels when locale is set to it', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('stellar.preferredLocale', 'it');
    });

    await setupViewerTest(page);
    await navigateToViewer(page);

    await expect(page.getByRole('heading', { name: 'Visualizzatore di sistemi' })).toBeVisible();
    await expect(page.getByText('Sistemi conosciuti')).toBeVisible();
  });
});
