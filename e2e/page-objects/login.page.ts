import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/(left:login)');
  }

  get playerNameInput() {
    return this.page.locator('#playerName');
  }

  get passwordInput() {
    return this.page.locator('#password');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  get errorMessage() {
    return this.page.locator('.error-message');
  }

  get registerLink() {
    return this.page.locator('.register-link-text').last();
  }

  async login(playerName: string, password: string) {
    await this.playerNameInput.fill(playerName);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
