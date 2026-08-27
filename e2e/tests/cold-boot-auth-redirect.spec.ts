import { expect, test } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';

test.describe('Cold boot auth redirect', () => {
  test('redirects unauthenticated cold-boot entry to login', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await page.goto('/(left:opening-cold-boot)');

    await expect(page).not.toHaveURL(/opening-cold-boot/);
    await expect(page).toHaveURL(/left:login/, { timeout: 10_000 });
    await expect(loginPage.playerNameInput).toBeVisible();
  });
});
