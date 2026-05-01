import { test, expect, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';

const TEST_PLAYER = 'localeplayer';
const TEST_PASSWORD = 'testpassword123';

function characterListResponse() {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters: [
      {
        id: 'char-1',
        characterName: 'Nova',
        level: 4,
      },
    ],
  };
}

async function setupLoginSuccessMock(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  const loginResponse = {
    success: true,
    message: 'Login successful',
    playerId: 'player-id-001',
    sessionKey: 'session-key-001',
  };

  mock.on('login', () => ({
    event: 'login-response',
    data: loginResponse,
  }));

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse(),
  }));

  return { mock, loginResponse };
}

async function openLoginAndWaitForSocket(page: Page, mock: SocketIOMock) {
  const socketConnectedInApp = page
    .waitForEvent('console', {
      predicate: (msg) => msg.type() === 'log' && msg.text().includes('Socket connected:'),
      timeout: 10_000,
    })
    .catch(() => null);

  await page.goto('/(left:login)');
  await mock.connected;
  await socketConnectedInApp;
}

test.describe('Locale auth flow', () => {
  test('applies selected Italian locale after login and keeps English fallback where missing', async ({ page }) => {
    const { mock, loginResponse } = await setupLoginSuccessMock(page);
    await openLoginAndWaitForSocket(page, mock);

    await page.locator('#locale').selectOption('it');
    await page.locator('#playerName').fill(TEST_PLAYER);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Ensure deterministic delivery in case emit races with connect transition.
    mock.push('login-response', loginResponse);

    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
    await expect(page.locator('.page-main h1')).toHaveText('Lista Personaggi');
    await expect(page.locator('.page-main .subtitle')).toHaveText('Review characters created for your player profile.');
    await expect(page.locator('.character-item .join-link').first()).toHaveText('Entra nel gioco');
  });

  test('passes selected login locale into registration page default', async ({ page }) => {
    await page.goto('/(left:login)');

    await page.locator('#locale').selectOption('it');
    await page.locator('.register-link-text').last().click();

    await expect(page).toHaveURL(/left:registration/);
    await expect(page.locator('#locale')).toHaveValue('it');
  });

  test('uses persisted locale as login default after a successful Italian login', async ({ page }) => {
    const { mock, loginResponse } = await setupLoginSuccessMock(page);
    await openLoginAndWaitForSocket(page, mock);

    await page.locator('#locale').selectOption('it');
    await page.locator('#playerName').fill(TEST_PLAYER);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    mock.push('login-response', loginResponse);

    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    await page.goto('/(left:login)');
    await expect(page.locator('#locale')).toHaveValue('it');
    await expect(page.locator('.login-container h1')).toHaveText('Accesso');
  });
});
