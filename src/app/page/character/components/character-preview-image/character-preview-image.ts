import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import type { BustDescriptorInput } from '../../../../model/bust-descriptor';
import { locale } from '../../../../i18n/locale';

const PORTRAIT_BASE_PATH = '/images/portraits';

export interface PortraitImageState {
  filename: string;
  src: string;
}

export function buildPortraitFilename(descriptor: BustDescriptorInput): string {
  return [
    descriptor.faceShape,
    descriptor.skinTone,
    descriptor.hairStyle,
    descriptor.hairColor,
    descriptor.eyeStyle,
    descriptor.eyeColor,
    descriptor.expressionPreset,
    descriptor.apparelAccent,
  ].join('__') + '.jpeg';
}

@Component({
  selector: 'app-character-preview-image',
  templateUrl: './character-preview-image.html',
  styleUrls: ['./character-preview-image.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CharacterPreviewImageComponent {
  protected readonly t = locale;

  descriptor = input.required<BustDescriptorInput>();

  protected readonly portraitFilename = computed(() => buildPortraitFilename(this.descriptor()));
  protected readonly portraitSrc = computed(() => `${PORTRAIT_BASE_PATH}/${this.portraitFilename()}`);

  protected readonly currentSrc = signal<string>('');
  protected readonly previousSrc = signal<string | null>(null);
  protected readonly currentLoaded = signal(false);
  protected readonly missingFilename = signal<string | null>(null);

  private previousClearHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const nextSrc = this.portraitSrc();
      const nextFilename = this.portraitFilename();

      if (this.currentSrc() === nextSrc && this.missingFilename() !== nextFilename) {
        return;
      }

      if (this.currentSrc()) {
        this.previousSrc.set(this.currentSrc());
      }

      this.currentSrc.set(nextSrc);
      this.currentLoaded.set(false);
      this.missingFilename.set(null);

      if (this.previousClearHandle !== null) {
        clearTimeout(this.previousClearHandle);
        this.previousClearHandle = null;
      }
    });
  }

  protected readonly debugLabel = computed(() => {
    if (this.missingFilename()) {
      return `not-found - ${this.missingFilename()}`;
    }

    return this.portraitFilename();
  });

  protected readonly statusLabel = computed(() => (this.missingFilename() ? 'missing' : this.currentLoaded() ? 'loaded' : 'loading'));

  protected handleImageLoad(): void {
    this.currentLoaded.set(true);
    if (this.previousSrc()) {
      this.previousClearHandle = setTimeout(() => {
        this.previousSrc.set(null);
        this.previousClearHandle = null;
      }, 240);
    }
  }

  protected handleImageError(): void {
    this.currentLoaded.set(false);
    this.previousSrc.set(null);
    if (this.previousClearHandle !== null) {
      clearTimeout(this.previousClearHandle);
      this.previousClearHandle = null;
    }

    this.missingFilename.set(this.portraitFilename());
  }
}