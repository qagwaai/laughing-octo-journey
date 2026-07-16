import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import {
  characterBustReadResponse,
  registerCharacterProfileSessionHandlers,
} from '../fixtures/character-profile-scenario';
import { bootstrapSharedGameMainSession } from '../fixtures/shared-session-bootstrap';
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
    registerSessionHandlers: registerCharacterProfileSessionHandlers,
  });
});

test.afterEach(async () => {
  if (!sharedPage || sharedPage.isClosed()) return;
  sharedMock.reset();
  registerCharacterProfileSessionHandlers(sharedMock);

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

test.describe('Character Profile - portrait and attributes', () => {
  test('renders portrait image and read-only persisted attributes from character setup descriptor', async () => {
    sharedMock.on('character-bust-read-request', () => ({
      event: 'character-bust-read-response',
      data: characterBustReadResponse(),
    }));

    await sharedGameShell.openNav('Character Profile');
    await expect(sharedPage).toHaveURL(/left:character-profile/);

    await expect(sharedPage.locator('.page-main h1')).toHaveText('Character Profile');
    await expect(sharedPage.locator('.portrait-window')).toBeVisible();

    const portraitImage = sharedPage.locator('.portrait-window__image');
    await expect(portraitImage).toBeVisible();
    await expect(portraitImage).toHaveAttribute(
      'src',
      /oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none\.jpeg/,
    );

    const attributesSection = sharedPage.locator('.attributes-section');
    await expect(attributesSection).toContainText('Profile Attributes');
    await expect(attributesSection.locator('.attribute-row')).toHaveCount(12);
    await expect(attributesSection).toContainText('Preset Version');
    await expect(attributesSection).toContainText('sw-15-m2-a-v1');
    await expect(attributesSection).toContainText('Face Shape');
    await expect(attributesSection).toContainText('oval');
    await expect(attributesSection).toContainText('Expression');
    await expect(attributesSection).toContainText('focused');

    await expect(attributesSection.locator('input, select, textarea, button')).toHaveCount(0);
  });

  test('shows loading state then resolves to portrait and attributes when bust read response arrives late', async () => {
    let capturedBustReadRequest: Record<string, unknown> | null = null;
    sharedMock.on('character-bust-read-request', (request) => {
      capturedBustReadRequest = request as Record<string, unknown>;
      return null;
    });

    await sharedGameShell.openNav('Character Profile');
    await expect(sharedPage).toHaveURL(/left:character-profile/);

    await expect(sharedPage.locator('.portrait-window__empty')).toContainText('Loading portrait descriptor...');

    await expect.poll(() => !!capturedBustReadRequest, { timeout: 5000 }).toBe(true);

    sharedMock.push('character-bust-read-response', {
      ...characterBustReadResponse(),
      correlationId: capturedBustReadRequest!['correlationId'] as string,
      requestIdentity: capturedBustReadRequest!['requestIdentity'] as Record<string, unknown>,
    });

    await expect(sharedPage.locator('.portrait-window__empty')).not.toBeVisible();
    await expect(sharedPage.locator('.portrait-window__image')).toBeVisible();
    await expect(sharedPage.locator('.attributes-section .attribute-row')).toHaveCount(12);
  });
});
