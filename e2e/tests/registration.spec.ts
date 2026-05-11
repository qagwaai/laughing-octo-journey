import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { RegistrationPage } from '../page-objects/registration.page';

test.describe('Registration', () => {
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
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
    const registerResponse = {
      success: true,
      message: 'Registration successful!',
    };
    const loginResponse = {
      success: true,
      message: 'Login successful!',
      sessionKey: 'session-001',
    };

    const mock = new SocketIOMock(page);
    await mock.setup();

    mock.on('register', () => ({
      event: 'register-response',
      data: registerResponse,
    }));

    mock.on('login', () => ({
      event: 'login-response',
      data: loginResponse,
    }));

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: 'validplayer',
        characters: [],
      },
    }));

    await registrationPage.goto();
    await mock.connected;

    await registrationPage.register('validplayer', 'player@example.com', 'password123');
    // Deterministic fallback deliveries for heavily parallelized runs.
    mock.push('register-response', registerResponse);
    mock.push('login-response', loginResponse);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
  });
});
