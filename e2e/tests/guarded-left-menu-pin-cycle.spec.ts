import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { registerGuardedLeftMenuPinCycleHandlers } from '../fixtures/guarded-left-menu-pin-cycle-scenario';
import { bootstrapSharedGameMainSession } from '../fixtures/shared-session-bootstrap';
import { SocketIOMock } from '../fixtures/socket-mock';
import { GameShellPage } from '../page-objects/game-shell.page';

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);

  await sharedMock.setup();
  await bootstrapSharedGameMainSession({
    page: sharedPage,
    mock: sharedMock,
    gameShell: sharedGameShell,
    registerSessionHandlers: registerGuardedLeftMenuPinCycleHandlers,
  });
});

test.afterEach(async () => {
  if (!sharedPage || sharedPage.isClosed()) return;
  sharedMock.reset();
  registerGuardedLeftMenuPinCycleHandlers(sharedMock);

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }
  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Guarded Left Menu - pin cycle', () => {
  test('cycles unpinned to pinned to keep-mini and suppresses hover expansion in keep-mini', async () => {
    const opsMenu = sharedPage.locator('app-guarded-left-menu nav.ops-menu').first();
    const pinToggle = sharedPage.locator('app-guarded-left-menu .pin-toggle').first();
    const pinToggleLabel = sharedPage.locator('app-guarded-left-menu .pin-toggle .menu-label').first();

    await expect(opsMenu).toBeVisible();
    await expect(pinToggle).toBeVisible();

    await expect(pinToggleLabel).toHaveText('Pin Menu');
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await opsMenu.hover();
    await expect(opsMenu).toHaveClass(/is-expanded/);

    await sharedPage.locator('body').hover();
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await pinToggle.click();
    await expect(pinToggleLabel).toHaveText('Keep Mini');
    await expect(opsMenu).toHaveClass(/is-expanded/);

    await pinToggle.click();
    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await opsMenu.hover();
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await pinToggle.click();
    await expect(pinToggleLabel).toHaveText('Pin Menu');
    await expect(opsMenu).not.toHaveClass(/is-expanded/);
  });

  test('keeps keep-mini mode after menu navigation clicks', async () => {
    const opsMenu = sharedPage.locator('app-guarded-left-menu nav.ops-menu').first();
    const pinToggle = sharedPage.locator('app-guarded-left-menu .pin-toggle').first();
    const pinToggleLabel = sharedPage.locator('app-guarded-left-menu .pin-toggle .menu-label').first();

    await expect(opsMenu).toBeVisible();
    await expect(pinToggle).toBeVisible();

    await pinToggle.click();
    await pinToggle.click();

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await sharedPage.locator('app-guarded-left-menu button[aria-label="Market Hub"]').first().click();
    await expect(sharedPage).toHaveURL(/left:market-hub/, { timeout: 10_000 });

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await sharedPage.locator('app-guarded-left-menu button[aria-label="Mission Board"]').first().click();
    await expect(sharedPage).toHaveURL(/right:mission-board/, { timeout: 10_000 });

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);
  });
});
