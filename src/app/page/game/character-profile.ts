import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { PlayerCharacterSummary } from '../../model/character-list';
import { type BustDescriptorInput, type CharacterBustReadResponse } from '../../model/bust-descriptor';
import { readCachedCharacterBustDescriptor } from '../../model/character-bust-cache';
import { buildPortraitFilename } from '../character/components/character-preview-image/character-preview-image';
import { BustDescriptorAdapterService } from '../../services/bust-descriptor-adapter.service';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';

const PORTRAIT_BASE_PATH = '/images/portraits';
const CHARACTER_PROFILE_BUST_READ_TIMEOUT_MS = 5000;

interface CharacterProfileAttribute {
  label: string;
  value: string;
}

interface CharacterProfileNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-character-profile-page',
  templateUrl: './character-profile.html',
  styleUrls: ['./character-profile.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge, DatePipe],
})
/**
 * Displays character profile details and links back to profile outlet flows.
 */
export default class CharacterProfilePage {
  protected readonly t = locale;
  private router = inject(Router);
  private bustAdapter = inject(BustDescriptorAdapterService);
  private sessionService = inject(SessionService);
  private navigationState: CharacterProfileNavigationState =
    resolveNavigationState<CharacterProfileNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected bustDescriptor = signal<BustDescriptorInput | null>(null);
  protected bustDescriptorLoading = signal(false);
  protected bustDescriptorLoadFailed = signal(false);
  protected portraitLoadFailed = signal(false);

  protected readonly portraitSrc = computed(() => {
    const descriptor = this.bustDescriptor();
    if (!descriptor) {
      return null;
    }

    return `${PORTRAIT_BASE_PATH}/${buildPortraitFilename(descriptor)}`;
  });

  protected readonly bustAttributes = computed<CharacterProfileAttribute[]>(() => {
    const descriptor = this.bustDescriptor();
    if (!descriptor) {
      return [];
    }

    return [
      { label: this.t.character.setup.bust.presetVersionLabel, value: descriptor.presetVersion },
      { label: this.t.character.setup.bust.faceShapeLabel, value: descriptor.faceShape },
      { label: this.t.character.setup.bust.skinToneLabel, value: descriptor.skinTone },
      { label: this.t.character.setup.bust.hairStyleLabel, value: descriptor.hairStyle },
      { label: this.t.character.setup.bust.hairColorLabel, value: descriptor.hairColor },
      { label: this.t.character.setup.bust.eyeStyleLabel, value: descriptor.eyeStyle },
      { label: this.t.character.setup.bust.eyeColorLabel, value: descriptor.eyeColor },
      { label: this.t.character.setup.bust.expressionLabel, value: descriptor.expressionPreset },
      { label: this.t.character.setup.bust.apparelAccentLabel, value: descriptor.apparelAccent },
      { label: this.t.character.setup.bust.facialHairLabel, value: descriptor.facialHair },
      { label: this.t.character.setup.bust.scarLabel, value: descriptor.scar },
      { label: this.t.character.setup.bust.tattooLabel, value: descriptor.tattoo },
    ];
  });

  constructor() {
    this.loadCharacterBustDescriptor();
  }

  /**
   * Re-opens character profile outlet while preserving current player context.
   */
  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }

  protected handlePortraitLoad(): void {
    this.portraitLoadFailed.set(false);
  }

  protected handlePortraitError(): void {
    this.portraitLoadFailed.set(true);
  }

  private loadCharacterBustDescriptor(): void {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const characterId = this.joinCharacter()?.id?.trim() ?? '';

    if (characterId) {
      const cachedDescriptor = readCachedCharacterBustDescriptor(characterId);
      if (cachedDescriptor) {
        this.bustDescriptor.set(cachedDescriptor);
      }
    }

    if (!playerName || !sessionKey || !characterId) {
      return;
    }

    this.bustDescriptorLoading.set(true);
    this.bustDescriptorLoadFailed.set(false);

    void firstValueFrom(
      this.bustAdapter
        .readCharacterBust({ playerName, sessionKey, characterId })
        .pipe(timeout(CHARACTER_PROFILE_BUST_READ_TIMEOUT_MS)),
    )
      .then((response: CharacterBustReadResponse) => {
        if (!response.success || !response.descriptor) {
          this.bustDescriptorLoadFailed.set(this.bustDescriptor() === null);
          return;
        }

        this.bustDescriptor.set(response.descriptor);
      })
      .catch((error: unknown) => {
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        const hasDescriptor = this.bustDescriptor() !== null;

        this.bustDescriptorLoadFailed.set(!hasDescriptor);
        const message = error instanceof Error ? error.message : String(error);
        appLogger.warn(
          `Unable to load bust descriptor for character profile: ${message} (timeout=${isTimeout ? '1' : '0'}, usingCachedFallback=${hasDescriptor ? '1' : '0'})`,
        );
      })
      .finally(() => {
        this.bustDescriptorLoading.set(false);
      });
  }
}
