import { Page } from '@playwright/test';

export class CharacterListPage {
  constructor(private readonly page: Page) {}

  // ── Page-level elements ────────────────────────────────────────────────

  get heading() {
    return this.page.locator('.page-main h1');
  }

  get subtitle() {
    return this.page.locator('.page-main .subtitle');
  }

  get playerNameDisplay() {
    return this.page.locator('.player-name');
  }

  // ── Action buttons ─────────────────────────────────────────────────────

  get loadButton() {
    return this.page.locator('.load-btn');
  }

  get setupButton() {
    return this.page.locator('.setup-btn');
  }

  // ── Character list ─────────────────────────────────────────────────────

  get emptyState() {
    return this.page.locator('.empty-state');
  }

  get characterList() {
    return this.page.locator('.character-list');
  }

  get characterItems() {
    return this.page.locator('.character-item');
  }

  characterName(index: number) {
    return this.characterItems.nth(index).locator('.character-name');
  }

  joinButton(index: number) {
    return this.characterItems.nth(index).locator('.join-link');
  }

  editButton(index: number) {
    return this.characterItems.nth(index).locator('.edit-link');
  }

  deleteButton(index: number) {
    return this.characterItems.nth(index).locator('.delete-link');
  }

  characterMeta(index: number) {
    return this.characterItems.nth(index).locator('.character-meta');
  }

  // ── Status messages ────────────────────────────────────────────────────

  get errorMessage() {
    return this.page.locator('.error-message');
  }

  // ── Delete confirmation dialog ─────────────────────────────────────────

  get deleteDialog() {
    return this.page.locator('.dialog-backdrop');
  }

  get deleteDialogPanel() {
    return this.page.locator('.dialog-panel');
  }

  get deleteDialogTitle() {
    return this.page.locator('.dialog-panel h2');
  }

  get confirmDeleteButton() {
    return this.page.locator('.confirm-delete-btn');
  }

  get cancelDeleteButton() {
    return this.page.locator('.cancel-delete-btn');
  }

  // ── Actions ────────────────────────────────────────────────────────────

  async clickLoad() {
    await this.loadButton.click();
  }

  async clickSetup() {
    await this.setupButton.click();
  }

  async clickDelete(index: number) {
    await this.deleteButton(index).click();
  }

  async clickConfirmDelete() {
    await this.confirmDeleteButton.click();
  }

  async clickCancelDelete() {
    await this.cancelDeleteButton.click();
  }
}
