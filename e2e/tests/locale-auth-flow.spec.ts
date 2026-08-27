import { expect, test } from '@playwright/test';
import {
  openLoginAndWaitForSocket,
  setupLoginSuccessMock,
  TEST_PASSWORD,
  TEST_PLAYER,
} from '../fixtures/locale-auth-flow-scenario';
import { CharacterListPage } from '../page-objects/character-list.page';
import { LoginPage } from '../page-objects/login.page';

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
