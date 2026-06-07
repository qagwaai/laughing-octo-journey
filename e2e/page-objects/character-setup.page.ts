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

  get retryBustSaveButton() {
    return this.page.locator('.retry-btn');
  }

  get bustPreviewPane() {
    return this.page.locator('[data-testid="character-bust-preview-pane"]');
  }

  get previewImage() {
    return this.page.locator('[data-testid="character-preview-image"]');
  }

  get previewImageAssetName() {
    return this.page.locator('[data-testid="character-preview-image-asset-name"]');
  }

  get previewImageState() {
    return this.page.locator('[data-testid="character-preview-image-state"]');
  }

  get bustViewer() {
    return this.previewImage;
  }

  bustViewerPresetButton(preset: 'front' | 'three-quarter' | 'left-profile' | 'right-profile') {
    return this.page.locator(`[data-testid="character-bust-viewer-preset-${preset}"]`);
  }

  get bustViewerResetButton() {
    return this.page.locator('[data-testid="character-bust-viewer-reset"]');
  }

  get bustViewerState() {
    return this.previewImageState;
  }

  get bustViewerAssetRoot() {
    return this.previewImageAssetName;
  }

  async fillCharacterName(name: string) {
    await this.characterNameInput.fill(name);
  }

  async selectBustOption(
    field:
      | 'faceShape'
      | 'skinTone'
      | 'hairStyle'
      | 'hairColor'
      | 'eyeStyle'
      | 'eyeColor'
      | 'expressionPreset'
      | 'apparelAccent'
      | 'facialHair'
      | 'scar'
      | 'tattoo',
    value: string,
  ) {
    await this.page.selectOption(`#${field}`, value);
  }

  async clickBustViewerPreset(preset: 'front' | 'three-quarter' | 'left-profile' | 'right-profile') {
    await this.bustViewerPresetButton(preset).click();
  }

  async clickBustViewerReset() {
    await this.bustViewerResetButton.click();
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async clickRetryBustSave() {
    await this.retryBustSaveButton.click();
  }

  async clickViewCharacterList() {
    await this.listButton.click();
  }
}
