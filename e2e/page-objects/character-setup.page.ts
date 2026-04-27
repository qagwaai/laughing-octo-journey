import { Page } from '@playwright/test';

export class CharacterSetupPage {
  constructor(private readonly page: Page) {}

  get heading() {
    return this.page.locator('.page-main h1');
  }

  get subtitle() {
    return this.page.locator('.page-main .subtitle');
  }

  get playerNameDisplay() {
    return this.page.locator('.player-name');
  }

  get characterNameInput() {
    return this.page.locator('#characterName');
  }

  get submitButton() {
    return this.page.locator('.submit-btn');
  }

  get listButton() {
    return this.page.locator('.list-btn');
  }

  get fieldError() {
    return this.page.locator('.field-error');
  }

  get errorMessage() {
    return this.page.locator('.error-message');
  }

  get successMessage() {
    return this.page.locator('.success-message');
  }

  get warningMessage() {
    return this.page.locator('.warning-message');
  }

  async fillCharacterName(name: string) {
    await this.characterNameInput.fill(name);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async clickViewCharacterList() {
    await this.listButton.click();
  }
}
