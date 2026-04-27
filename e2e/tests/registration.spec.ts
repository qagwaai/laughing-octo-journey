import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../page-objects/registration.page';

test.describe('Registration', () => {
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
  });

  test('renders registration form', async ({ page }) => {
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
});
