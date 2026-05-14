import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { CharacterListPage } from '../page-objects/character-list.page';
import { LoginPage } from '../page-objects/login.page';

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
    const loginPage = new LoginPage(page);
    const characterListPage = new CharacterListPage(page);
    await openLoginAndWaitForSocket(page, mock);

    await loginPage.localeSelect.selectOption('it');
    await loginPage.playerNameInput.fill(TEST_PLAYER);
    await loginPage.passwordInput.fill(TEST_PASSWORD);
    await loginPage.submitButton.click();

    // Ensure deterministic delivery in case emit races with connect transition.
    mock.push('login-response', loginResponse);

    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
    await expect(characterListPage.heading).toHaveText('Lista Personaggi');
    await expect(characterListPage.subtitle).toHaveText(
      'Rivedi i personaggi creati per il tuo profilo giocatore.',
    );
    await expect(characterListPage.joinButton(0)).toHaveText('Entra nel gioco');
  });

  test('passes selected login locale into registration page default', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/(left:login)');

    await loginPage.localeSelect.selectOption('it');
    await loginPage.registerLink.click();

    await expect(page).toHaveURL(/left:registration/);
    await expect(page.locator('#locale')).toHaveValue('it');
  });

  test('uses persisted locale as login default after a successful Italian login', async ({ page }) => {
    const { mock, loginResponse } = await setupLoginSuccessMock(page);
    const loginPage = new LoginPage(page);
    await openLoginAndWaitForSocket(page, mock);

    await loginPage.localeSelect.selectOption('it');
    await loginPage.playerNameInput.fill(TEST_PLAYER);
    await loginPage.passwordInput.fill(TEST_PASSWORD);
    await loginPage.submitButton.click();
    mock.push('login-response', loginResponse);

    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    await page.goto('/(left:login)');
    await expect(loginPage.localeSelect).toHaveValue('it');
    await expect(page.locator('.login-container h1')).toHaveText('Accesso');
  });
});
