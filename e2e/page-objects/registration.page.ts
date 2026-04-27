import { Page } from '@playwright/test';

export class RegistrationPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/(left:registration)');
  }

  get playerNameInput() {
    return this.page.locator('#playerName');
  }

  get emailInput() {
    return this.page.locator('#email');
  }

  get passwordInput() {
    return this.page.locator('#password');
  }

  get confirmPasswordInput() {
    return this.page.locator('#confirmPassword');
  }

  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }

  get errorMessage() {
    return this.page.locator('.error-message');
  }

  get successMessage() {
    return this.page.locator('.success-message');
  }

  async register(playerName: string, email: string, password: string) {
    await this.playerNameInput.fill(playerName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }
}
