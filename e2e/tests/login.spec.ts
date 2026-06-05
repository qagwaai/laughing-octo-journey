import { expect, test } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';

const REMEMBERED_PLAYER_HANDLE_STORAGE_KEY = 'auth.rememberedPlayerHandle';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('renders login form', async ({ page }) => {
    await expect(loginPage.localeSelect).toBeVisible();
    await expect(loginPage.playerNameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('locale selector defaults to current app locale', async ({ page }) => {
    await expect(loginPage.localeSelect).toHaveValue('en');
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    await expect(loginPage.submitButton).toBeDisabled();
  });

  test('submit button is disabled when player name is too short', async ({ page }) => {
    await loginPage.playerNameInput.fill('ab');
    await loginPage.passwordInput.fill('validpassword');
    await expect(loginPage.submitButton).toBeDisabled();
  });

  test('submit button enables when form is valid', async ({ page }) => {
    await loginPage.playerNameInput.fill('validplayer');
    await loginPage.passwordInput.fill('validpassword');
    await expect(loginPage.submitButton).toBeEnabled();
  });

  test('shows validation error when player name is touched and cleared', async ({ page }) => {
    await loginPage.playerNameInput.fill('abc');
    await loginPage.playerNameInput.clear();
    await loginPage.playerNameInput.blur();
    await expect(page.locator('.field-error')).toBeVisible();
  });

  test('register link navigates to registration', async ({ page }) => {
    await loginPage.registerLink.click();
    await expect(page).toHaveURL(/(left:registration)/);
  });

  test('focuses player name when no remembered username exists', async ({ page }) => {
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.id ?? null))
      .toBe('playerName');
  });

  test('focuses password when remembered username exists', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, 'RememberedPilot');
    }, REMEMBERED_PLAYER_HANDLE_STORAGE_KEY);

    await loginPage.goto();

    await expect(loginPage.playerNameInput).toHaveValue('RememberedPilot');
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.id ?? null))
      .toBe('password');
  });
});
