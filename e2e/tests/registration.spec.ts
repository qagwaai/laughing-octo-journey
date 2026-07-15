import { expect, test } from '@playwright/test';
import {
  LOGIN_RESPONSE,
  REGISTER_RESPONSE,
  characterListResponse,
  setupSuccessfulRegistrationMock,
} from '../fixtures/registration-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { LoginPage } from '../page-objects/login.page';
import { RegistrationPage } from '../page-objects/registration.page';

test.describe('Registration', () => {
  let registrationPage: RegistrationPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    loginPage = new LoginPage(page);
    await registrationPage.goto();
  });

  test('renders registration form', async ({ page }) => {
    await expect(registrationPage.localeSelect).toBeVisible();
    await expect(registrationPage.playerNameInput).toBeVisible();
    await expect(registrationPage.emailInput).toBeVisible();
    await expect(registrationPage.passwordInput).toBeVisible();
    await expect(registrationPage.confirmPasswordInput).toBeVisible();
    await expect(registrationPage.submitButton).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    await expect(registrationPage.submitButton).toBeDisabled();
  });

  test('submit button is disabled when passwords do not match', async ({ page }) => {
    await registrationPage.playerNameInput.fill('validplayer');
    await registrationPage.emailInput.fill('player@example.com');
    await registrationPage.passwordInput.fill('password123');
    await registrationPage.confirmPasswordInput.fill('differentpassword');
    await registrationPage.confirmPasswordInput.blur();
    await expect(registrationPage.submitButton).toBeDisabled();
  });

  test('shows password mismatch error', async ({ page }) => {
    await registrationPage.playerNameInput.fill('validplayer');
    await registrationPage.emailInput.fill('player@example.com');
    await registrationPage.passwordInput.fill('password123');
    await registrationPage.confirmPasswordInput.fill('differentpassword');
    await registrationPage.confirmPasswordInput.blur();
    await expect(page.locator('.field-error')).toBeVisible();
  });

  test('submit button enables when form is valid', async ({ page }) => {
    await registrationPage.playerNameInput.fill('validplayer');
    await registrationPage.emailInput.fill('player@example.com');
    await registrationPage.passwordInput.fill('password123');
    await registrationPage.confirmPasswordInput.fill('password123');
    await expect(registrationPage.submitButton).toBeEnabled();
  });

  test('submit button uses create-account-and-login copy', async ({ page }) => {
    await expect(registrationPage.submitButton).toHaveText('Create Account and Login');
  });

  test('auto-logs in and redirects to character list after successful registration', async ({ page }) => {
    const { mock } = await setupSuccessfulRegistrationMock(page);

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: characterListResponse('validplayer'),
    }));

    await registrationPage.goto();
    await mock.connected;

    await registrationPage.register('validplayer', 'player@example.com', 'password123');
    // Deterministic fallback deliveries for heavily parallelized runs.
    mock.push('register-response', REGISTER_RESPONSE);
    mock.push('login-response', LOGIN_RESPONSE);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
  });

  test('stores opted-in handle and prefills login player name', async ({ page }) => {
    const { mock } = await setupSuccessfulRegistrationMock(page);

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: characterListResponse('rememberedpilot'),
    }));

    await registrationPage.goto();
    await mock.connected;

    await registrationPage.register('rememberedpilot', 'remembered@example.com', 'password123', 'en', true);
    mock.push('register-response', REGISTER_RESPONSE);
    mock.push('login-response', LOGIN_RESPONSE);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    await loginPage.goto();
    await expect(loginPage.playerNameInput).toHaveValue('rememberedpilot');
  });
});
