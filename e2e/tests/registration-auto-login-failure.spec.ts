import { expect, test } from '@playwright/test';
import { registerAutoLoginFailureHandlers } from '../fixtures/registration-auto-login-failure-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { RegistrationPage } from '../page-objects/registration.page';

test.describe('Registration auto-login failure', () => {
  test('stays on registration and shows error when login fails after successful registration', async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();
    registerAutoLoginFailureHandlers(mock);

    const registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
    await mock.connected;

    await registrationPage.register('validplayer', 'player@example.com', 'password123');

    await expect(page).toHaveURL(/left:registration/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/left:character-list/);
    await expect(registrationPage.errorMessage).toHaveText('Auto-login failed. Please try again.');
  });
});