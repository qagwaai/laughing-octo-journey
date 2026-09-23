import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BustDescriptorInput } from '../../../../model/bust-descriptor';
import { buildPortraitFilename } from '../character-preview-image/character-preview-image';

const PORTRAIT_BASE_PATH = '/images/portraits';

export type CharacterBustThumbnailStatus = 'loading' | 'loaded' | 'error';

/**
 * Lightweight per-row bust state, populated by a second pass after the character
 * list itself has rendered (see CharacterListPage.loadCharacterBusts).
 */
export interface CharacterBustThumbnailState {
  status: CharacterBustThumbnailStatus;
  descriptor?: BustDescriptorInput;
}

@Component({
  selector: 'app-character-bust-thumbnail',
  templateUrl: './character-bust-thumbnail.html',
  styleUrls: ['./character-bust-thumbnail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CharacterBustThumbnail {
  state = input.required<CharacterBustThumbnailState>();
  alt = input<string>('');

  protected readonly isLoading = computed(() => this.state().status === 'loading');

  protected readonly portraitSrc = computed(() => {
    const descriptor = this.state().descriptor;
    return descriptor ? `${PORTRAIT_BASE_PATH}/${buildPortraitFilename(descriptor)}` : null;
  });

  protected readonly imageFailed = signal(false);

  protected readonly showSilhouette = computed(
    () => !this.isLoading() && (this.state().status === 'error' || !this.portraitSrc() || this.imageFailed()),
  );

  protected handleImageError(): void {
    this.imageFailed.set(true);
  }
}
