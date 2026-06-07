import { ChangeDetectionStrategy, Component, inject, NgZone, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { CharacterAddRequest, CharacterAddResponse } from '../../model/character-add';
import { CharacterEditRequest, CharacterEditResponse } from '../../model/character-edit';
import {
  type BustApparelAccent,
  type BustBlockedSaveReason,
  type BustBlockedSaveResponse,
  type BustDescriptorInput,
  type BustExpressionPreset,
  type BustFaceShape,
  type BustFacialHair,
  type BustHairColor,
  type BustHairStyle,
  type CharacterBustReadResponse,
  type BustScar,
  type BustSkinTone,
  type BustTattoo,
  type CharacterBustCreateTerminalResponse,
  type CharacterBustUpdateTerminalResponse,
} from '../../model/bust-descriptor';
import {
  normalizeCharacterName,
  pickSuggestedCharacterName,
} from '../../model/character-name-suggestions';
import { PlayerCharacterSummary } from '../../model/character-list';
import { generateDeterministicStarterShipUpdate } from '../../model/domain/starter-ship';
import { type ShipListByOwnerRequest, type ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { CharacterService } from '../../services/character.service';
import { BustDescriptorAdapterService } from '../../services/bust-descriptor-adapter.service';
import { CharacterBustPreviewStateService } from '../../services/character-bust-preview-state.service';
import { GameSessionService } from '../../services/game-session.service';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';

interface CharacterSetupNavigationState {
  playerName?: string;
  mode?: 'create' | 'edit';
  editCharacter?: PlayerCharacterSummary;
  existingCharacters?: { id: string; characterName: string }[];
}

const LAST_CHARACTER_NAME_SUGGESTION_STORAGE_KEY = 'character.setup.lastSuggestedName';
const STARTER_SHIP_PROVISIONING_TIMEOUT_MS = 3000;
const BUST_DEFAULT_PRESET_VERSION = 'sw-15-m2-a-v1';

const DEFAULT_BUST_DESCRIPTOR: BustDescriptorInput = {
  presetVersion: BUST_DEFAULT_PRESET_VERSION,
  faceShape: 'oval',
  skinTone: 'medium',
  hairStyle: 'short-crop',
  hairColor: 'brown',
  eyeStyle: 'almond',
  eyeColor: 'green',
  expressionPreset: 'focused',
  apparelAccent: 'collar',
  facialHair: 'none',
  scar: 'none',
  tattoo: 'none',
};

@Component({
  selector: 'app-character-setup-page',
  templateUrl: './character-setup.html',
  styleUrls: ['./character-setup.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GuardedLeftMenu],
})
/**
 * Character creation/edit page with starter-ship bootstrap for new characters.
 */
export default class CharacterSetupPage implements OnDestroy {
  protected readonly t = locale;
  private fb = inject(FormBuilder);
  private ngZone = inject(NgZone);
  private router = inject(Router);
  private characterService = inject(CharacterService);
  private bustAdapter = inject(BustDescriptorAdapterService);
  private previewState = inject(CharacterBustPreviewStateService);
  private gameSessionService = inject(GameSessionService);
  private socketService = inject(SocketService);
  private shipService = inject(ShipService);
  private sessionService = inject(SessionService);
  private unsubscribeAddResponse?: () => void;
  private unsubscribeInvalidSession?: () => void;
  private bustFormSubscription?: Subscription;
  private bustAutoSavePending = false;
  private bustAutoSaveReady = false;
  private bustAutoSaveDescriptorSignature: string | null = null;
  private setupState: CharacterSetupNavigationState = resolveNavigationState<CharacterSetupNavigationState>(
    this.router,
  );

  protected playerName = signal<string>(this.setupState.playerName ?? '');
  protected editCharacter = signal<PlayerCharacterSummary | null>(this.setupState.editCharacter ?? null);
  protected isEditMode = signal(this.setupState.mode === 'edit' && !!this.setupState.editCharacter);

  protected characterForm = this.fb.group({
    characterName: [
      this.editCharacter()?.characterName ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(24)],
    ],
    faceShape: [DEFAULT_BUST_DESCRIPTOR.faceShape, Validators.required],
    skinTone: [DEFAULT_BUST_DESCRIPTOR.skinTone, Validators.required],
    hairStyle: [DEFAULT_BUST_DESCRIPTOR.hairStyle, Validators.required],
    hairColor: [DEFAULT_BUST_DESCRIPTOR.hairColor, Validators.required],
    eyeStyle: [DEFAULT_BUST_DESCRIPTOR.eyeStyle, Validators.required],
    eyeColor: [DEFAULT_BUST_DESCRIPTOR.eyeColor, Validators.required],
    expressionPreset: [DEFAULT_BUST_DESCRIPTOR.expressionPreset, Validators.required],
    apparelAccent: [DEFAULT_BUST_DESCRIPTOR.apparelAccent, Validators.required],
    facialHair: [DEFAULT_BUST_DESCRIPTOR.facialHair, Validators.required],
    scar: [DEFAULT_BUST_DESCRIPTOR.scar, Validators.required],
    tattoo: [DEFAULT_BUST_DESCRIPTOR.tattoo, Validators.required],
  });

  protected isSaved = signal(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected warningMessage = signal<string | null>(null);
  protected isSubmitting = signal(false);
  protected pendingBustCharacterId = signal<string | null>(null);
  protected bustValidationErrors = signal<Array<{ field: string; reason: string; rejectedValue: unknown }>>([]);
  protected bustBlockedSave = signal<BustBlockedSaveResponse | null>(null);
  protected existingCharacters = signal<{ id: string; characterName: string }[]>(
    this.setupState.existingCharacters ?? [],
  );
  protected readonly faceShapeOptions: BustFaceShape[] = ['oval', 'round', 'square', 'angular', 'narrow'];
  protected readonly skinToneOptions: BustSkinTone[] = ['pale', 'light', 'medium', 'tan', 'dark', 'deep'];
  protected readonly hairStyleOptions: BustHairStyle[] = [
    'short-crop',
    'mid-fade',
    'long-loose',
    'braided',
    'shaved',
    'slicked',
  ];
  protected readonly hairColorOptions: BustHairColor[] = ['black', 'brown', 'auburn', 'blonde', 'silver', 'white', 'red'];
  protected readonly eyeStyleOptions = ['narrow', 'wide', 'almond', 'hooded', 'round'] as const;
  protected readonly eyeColorOptions = ['brown', 'hazel', 'green', 'blue', 'grey', 'amber', 'violet'] as const;
  protected readonly expressionPresetOptions: BustExpressionPreset[] = [
    'neutral',
    'focused',
    'smirk',
    'stern',
    'warm',
    'weary',
  ];
  protected readonly apparelAccentOptions: BustApparelAccent[] = ['none', 'collar', 'hood', 'visor', 'goggles', 'headband'];
  protected readonly facialHairOptions: BustFacialHair[] = ['none', 'stubble', 'short-beard', 'full-beard', 'goatee'];
  protected readonly scarOptions: BustScar[] = ['none', 'cheek-left', 'cheek-right', 'brow-left', 'brow-right', 'chin'];
  protected readonly tattooOptions: BustTattoo[] = ['none', 'temple-left', 'temple-right', 'neck-left', 'neck-right'];

  protected duplicateNameError(): string | null {
    const control = this.characterForm.get('characterName');
    if (!control || (!control.dirty && !control.touched)) {
      return null;
    }
    return this.hasDuplicateCharacterName(control.value ?? '')
      ? this.t.character.setup.errors.characterNameDuplicate
      : null;
  }

  constructor() {
    this.initializeSuggestedName();
    this.syncPreviewDescriptor();
    this.ensureBustPreviewPaneActive();
    this.initializeEditModeBustDescriptor();

    this.bustFormSubscription = this.characterForm.valueChanges.subscribe(() => {
      this.syncPreviewDescriptor();
      this.clearBustResponseState();
      this.queueBustAutoSave();
    });

    this.unsubscribeInvalidSession = this.gameSessionService.subscribeInvalidSession(() => {
      this.sessionService.clearSession();
      this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });
  }

  /**
   * Validates form input and dispatches add/edit character request flow.
   */
  saveCharacter(): void {
    const candidateName = this.characterForm.value.characterName ?? '';
    if (this.hasDuplicateCharacterName(candidateName)) {
      this.characterForm.get('characterName')?.markAsTouched();
      this.errorMessage.set(this.t.character.setup.errors.characterNameDuplicate);
      this.isSaved.set(false);
      return;
    }

    if (this.characterForm.invalid) {
      this.characterForm.markAllAsTouched();
      return;
    }

    const playerName = this.playerName().trim();
    const characterName = this.characterForm.value.characterName!;

    if (!playerName) {
      this.errorMessage.set(this.t.character.setup.messages.saveRequiresPlayer);
      this.isSaved.set(false);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.warningMessage.set(null);
    this.clearBustResponseState();
    this.isSaved.set(false);
    this.unsubscribeAddResponse?.();

    const isEditMode = this.isEditMode();
    if (isEditMode) {
      const editCharacter = this.editCharacter();
      if (!editCharacter?.id) {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.t.character.setup.messages.editRequiresCharacterId);
        return;
      }
    }

    const handleSaveResponse = async (response: CharacterAddResponse | CharacterEditResponse): Promise<void> => {
      this.isSubmitting.set(false);
      if (response.success) {
        this.isSaved.set(true);
        this.successMessage.set(response.message);
        this.errorMessage.set(null);
        const persistedCharacterId = isEditMode
          ? this.editCharacter()?.id?.trim() ?? ''
          : (response as CharacterAddResponse).characterId?.trim() ?? '';

        if (persistedCharacterId) {
          if (isEditMode) {
            const isBustSaved = await this.persistCharacterBustDescriptor(persistedCharacterId, true);
            if (!isBustSaved) {
              this.isSaved.set(false);
              return;
            }
          } else {
            // Do not strand the user on setup if the backend bust create response never arrives.
            this.persistCharacterBustDescriptorInBackground(persistedCharacterId);
          }
        }

        this.navigateToCharacterList();

        if (!isEditMode) {
          const addResponse = response as CharacterAddResponse;
          void this.createStarterShipForCharacter(addResponse.characterId);
        }
      } else {
        this.isSaved.set(false);
        this.successMessage.set(null);
        this.errorMessage.set(response.message);
      }
      this.unsubscribeAddResponse?.();
    };

    if (isEditMode) {
      const editCharacter = this.editCharacter()!;
      const request: CharacterEditRequest = {
        characterId: editCharacter.id,
        playerName,
        characterName,
        sessionKey: this.sessionService.getSessionKey()!,
      };
      this.unsubscribeAddResponse = this.characterService.editCharacter(request, (response: CharacterEditResponse) => {
        void this.ngZone.run(() => handleSaveResponse(response));
      });
      return;
    }

    const request: CharacterAddRequest = {
      playerName,
      characterName,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.unsubscribeAddResponse = this.characterService.addCharacter(request, (response: CharacterAddResponse) => {
      void this.ngZone.run(() => handleSaveResponse(response));
    });
  }

  protected formatBustOptionLabel(value: string): string {
    return value
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  protected hairColorSwatch(value: string): string {
    const map: Record<string, string> = {
      black: '#1a1a1f',
      brown: '#4e3428',
      auburn: '#7a2f20',
      blonde: '#cba45a',
      silver: '#b6bcc5',
      white: '#eef2f6',
      red: '#9f2118',
    };
    return map[value] ?? '#4e3428';
  }

  protected eyeColorSwatch(value: string): string {
    const map: Record<string, string> = {
      brown: '#5f3f2f',
      hazel: '#6e6a2d',
      green: '#2f6d49',
      blue: '#2b5d9b',
      grey: '#66717d',
      amber: '#b36a1f',
      violet: '#5c4da1',
    };
    return map[value] ?? '#2f6d49';
  }

  protected skinToneSwatch(value: BustSkinTone): string {
    const map: Record<BustSkinTone, string> = {
      pale: '#f2d7c3',
      light: '#e5c2a4',
      medium: '#c59673',
      tan: '#ac7a58',
      dark: '#7f5238',
      deep: '#583826',
    };
    return map[value];
  }

  protected blockedSaveReasonLabel(reason: BustBlockedSaveReason): string {
    const key = this.t.character.setup.bust.blockedSaveReasons[reason];
    return key ?? reason;
  }

  protected retryBustSave(): void {
    const characterId = this.pendingBustCharacterId()?.trim();
    if (!characterId || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.warningMessage.set(null);
    this.clearBustResponseState();

    void this.persistCharacterBustDescriptor(characterId, this.isEditMode()).finally(() => {
      this.isSubmitting.set(false);
      if (!this.bustBlockedSave() && this.bustValidationErrors().length === 0) {
        this.navigateToCharacterList();
      }
    });
  }

  /**
   * Resolves starter ship and applies deterministic starter configuration/items.
   */
  private createStarterShipForCharacter(characterId?: string): Promise<void> {
    return new Promise((resolve) => {
      let finished = false;
      const finish = (): void => {
        if (finished) {
          return;
        }
        finished = true;
        resolve();
      };

      const timeout = window.setTimeout(() => {
        appLogger.warn('Starter ship provisioning timed out before confirmation callback.');
        this.warningMessage.set(this.t.character.setup.messages.starterShipInitPending);
        finish();
      }, STARTER_SHIP_PROVISIONING_TIMEOUT_MS);

      const finishAndClearTimeout = (): void => {
        window.clearTimeout(timeout);
        finish();
      };

      const playerName = this.playerName().trim();
      const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
      const resolvedCharacterId = characterId?.trim() ?? '';

      if (!playerName || !sessionKey || !resolvedCharacterId) {
        appLogger.warn('Skipping starter ship upsert due to missing character context.');
        this.warningMessage.set(this.t.character.setup.messages.starterShipInitPending);
        finishAndClearTimeout();
        return;
      }

      const followupRequest: ShipListByOwnerRequest = {
        playerName,
        sessionKey,
        owner: {
          ownerType: 'player-character',
          characterId: resolvedCharacterId,
        },
      };
      this.shipService.listShipsByOwner(followupRequest, (response: ShipListByOwnerResponse) => {
        if (!response.success) {
          appLogger.warn('Unable to resolve starter ship from ship-list:', response.message);
          this.warningMessage.set(this.t.character.setup.messages.starterShipResolvePending);
          finishAndClearTimeout();
          return;
        }

        const starterShipId = response.ships?.[0]?.id?.trim();
        if (!starterShipId) {
          appLogger.warn('Starter ship id was not returned by ship-list response.');
          this.warningMessage.set(this.t.character.setup.messages.starterShipMissingRecord);
          finishAndClearTimeout();
          return;
        }

        const shipUpdate = generateDeterministicStarterShipUpdate(playerName, resolvedCharacterId, starterShipId);
        this.socketService.upsertShip(
          {
            playerName,
            characterId: resolvedCharacterId,
            sessionKey,
            ship: shipUpdate,
          },
          (upsertResponse: ShipUpsertResponse) => {
            if (!upsertResponse.success) {
              appLogger.warn('Starter ship upsert failed:', upsertResponse.message);
              this.warningMessage.set(this.t.character.setup.messages.starterShipUpdateFailed);
              finishAndClearTimeout();
              return;
            }

            if (!Array.isArray(upsertResponse.ship?.inventory)) {
              appLogger.warn('Starter ship upsert did not include backend inventory payload.');
            }

            this.warningMessage.set(null);
            finishAndClearTimeout();
          },
        );
      });
    });
  }

  navigateToCharacterList(): void {
    const playerName = this.playerName() || this.characterForm.value.characterName || '';
    this.router.navigate([{ outlets: { primary: ['knot'], left: ['character-list'], right: null } }], {
      preserveFragment: true,
      state: { playerName },
    });
  }

  protected isDuplicateNameBlockingSubmit(): boolean {
    const candidateName = this.characterForm.value.characterName ?? '';
    return this.hasDuplicateCharacterName(candidateName);
  }

  protected shuffleSuggestedName(): void {
    if (this.isEditMode()) {
      return;
    }

    const currentName = this.characterForm.get('characterName')?.value ?? '';
    this.applySuggestedName(currentName);
  }

  private initializeSuggestedName(): void {
    if (this.isEditMode()) {
      return;
    }

    const existingValue = this.characterForm.get('characterName')?.value ?? '';
    if (existingValue.trim()) {
      return;
    }

    this.applySuggestedName(null);
  }

  private applySuggestedName(disallowName: string | null): void {
    const suggestion = pickSuggestedCharacterName({
      existingNames: this.existingCharacters().map((character) => character.characterName),
      previousSuggestion: this.readLastSuggestedName(),
      disallowName,
    });

    this.characterForm.get('characterName')?.setValue(suggestion);
    this.writeLastSuggestedName(suggestion);
    this.errorMessage.set(null);
  }

  private readLastSuggestedName(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    return window.localStorage.getItem(LAST_CHARACTER_NAME_SUGGESTION_STORAGE_KEY);
  }

  private writeLastSuggestedName(name: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(LAST_CHARACTER_NAME_SUGGESTION_STORAGE_KEY, name);
  }

  private hasDuplicateCharacterName(candidateName: string): boolean {
    const normalizedCandidate = normalizeCharacterName(candidateName);
    if (!normalizedCandidate) {
      return false;
    }

    const editingCharacterId = this.editCharacter()?.id?.trim() ?? '';
    return this.existingCharacters().some((character) => {
      const candidateId = character.id?.trim() ?? '';
      if (editingCharacterId && candidateId === editingCharacterId) {
        return false;
      }
      return normalizeCharacterName(character.characterName) === normalizedCandidate;
    });
  }

  private syncPreviewDescriptor(): void {
    const value = this.characterForm.getRawValue();
    this.previewState.updateDescriptor({
      presetVersion: BUST_DEFAULT_PRESET_VERSION,
      faceShape: (value.faceShape ?? DEFAULT_BUST_DESCRIPTOR.faceShape) as BustFaceShape,
      skinTone: (value.skinTone ?? DEFAULT_BUST_DESCRIPTOR.skinTone) as BustSkinTone,
      hairStyle: (value.hairStyle ?? DEFAULT_BUST_DESCRIPTOR.hairStyle) as BustHairStyle,
      hairColor: (value.hairColor ?? DEFAULT_BUST_DESCRIPTOR.hairColor) as BustHairColor,
      eyeStyle: (value.eyeStyle ?? DEFAULT_BUST_DESCRIPTOR.eyeStyle) as BustDescriptorInput['eyeStyle'],
      eyeColor: (value.eyeColor ?? DEFAULT_BUST_DESCRIPTOR.eyeColor) as BustDescriptorInput['eyeColor'],
      expressionPreset: (value.expressionPreset ??
        DEFAULT_BUST_DESCRIPTOR.expressionPreset) as BustExpressionPreset,
      apparelAccent: (value.apparelAccent ?? DEFAULT_BUST_DESCRIPTOR.apparelAccent) as BustDescriptorInput['apparelAccent'],
      facialHair: (value.facialHair ?? DEFAULT_BUST_DESCRIPTOR.facialHair) as BustDescriptorInput['facialHair'],
      scar: (value.scar ?? DEFAULT_BUST_DESCRIPTOR.scar) as BustDescriptorInput['scar'],
      tattoo: (value.tattoo ?? DEFAULT_BUST_DESCRIPTOR.tattoo) as BustDescriptorInput['tattoo'],
    });
  }

  private clearBustResponseState(): void {
    this.bustValidationErrors.set([]);
    this.bustBlockedSave.set(null);
  }

  private queueBustAutoSave(): void {
    if (!this.shouldAutoSaveBustDescriptor()) {
      return;
    }

    const descriptorSignature = this.bustDescriptorSignature(this.previewState.descriptor() ?? DEFAULT_BUST_DESCRIPTOR);
    if (descriptorSignature === this.bustAutoSaveDescriptorSignature || this.bustAutoSavePending) {
      return;
    }

    this.bustAutoSavePending = true;
    void Promise.resolve().then(async () => {
      this.bustAutoSavePending = false;

      if (!this.shouldAutoSaveBustDescriptor()) {
        return;
      }

      const characterId = this.editCharacter()?.id?.trim() ?? '';
      if (!characterId) {
        return;
      }

      const currentSignature = this.bustDescriptorSignature(this.previewState.descriptor() ?? DEFAULT_BUST_DESCRIPTOR);
      if (currentSignature === this.bustAutoSaveDescriptorSignature) {
        return;
      }

      if (await this.persistCharacterBustDescriptor(characterId, true)) {
        this.bustAutoSaveDescriptorSignature = currentSignature;
      }
    });
  }

  private shouldAutoSaveBustDescriptor(): boolean {
    return this.isEditMode() && this.bustAutoSaveReady && !this.isSubmitting();
  }

  private bustDescriptorSignature(descriptor: BustDescriptorInput): string {
    return JSON.stringify(descriptor);
  }

  private initializeEditModeBustDescriptor(): void {
    if (!this.isEditMode()) {
      return;
    }

    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const characterId = this.editCharacter()?.id?.trim() ?? '';

    if (!playerName || !sessionKey || !characterId) {
      return;
    }

    void firstValueFrom(this.bustAdapter.readCharacterBust({ playerName, sessionKey, characterId }))
      .then((response: CharacterBustReadResponse) => {
        if (!response.success || !response.descriptor) {
          return;
        }

        this.bustAutoSaveDescriptorSignature = this.bustDescriptorSignature(response.descriptor);

        this.characterForm.patchValue({
          faceShape: response.descriptor.faceShape,
          skinTone: response.descriptor.skinTone,
          hairStyle: response.descriptor.hairStyle,
          hairColor: response.descriptor.hairColor,
          eyeStyle: response.descriptor.eyeStyle,
          eyeColor: response.descriptor.eyeColor,
          expressionPreset: response.descriptor.expressionPreset,
          apparelAccent: response.descriptor.apparelAccent,
          facialHair: response.descriptor.facialHair,
          scar: response.descriptor.scar,
          tattoo: response.descriptor.tattoo,
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        appLogger.warn(`Unable to preload existing bust descriptor for edit mode: ${message}`);
      })
      .finally(() => {
        if (this.isEditMode()) {
          this.bustAutoSaveReady = true;
          if (this.bustAutoSaveDescriptorSignature === null) {
            this.bustAutoSaveDescriptorSignature = this.bustDescriptorSignature(
              this.previewState.descriptor() ?? DEFAULT_BUST_DESCRIPTOR,
            );
          }
        }
      });
  }

  private async persistCharacterBustDescriptor(characterId: string, isEditMode: boolean): Promise<boolean> {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    if (!playerName || !sessionKey || !characterId.trim()) {
      return true;
    }

    try {
      const descriptor = this.previewState.descriptor() ?? DEFAULT_BUST_DESCRIPTOR;
      const response = await firstValueFrom(
        isEditMode
          ? this.bustAdapter.updateCharacterBust({ playerName, sessionKey, characterId, descriptor })
          : this.bustAdapter.createCharacterBust({ playerName, sessionKey, characterId, descriptor }),
      );

      if (response.success) {
        this.pendingBustCharacterId.set(null);
        this.clearBustResponseState();
        this.bustAutoSaveDescriptorSignature = this.bustDescriptorSignature(descriptor);
        return true;
      }

      this.pendingBustCharacterId.set(characterId);

      if ('blockedSave' in response) {
        this.bustBlockedSave.set(response as BustBlockedSaveResponse);
        this.warningMessage.set(this.t.character.setup.messages.bustSaveBlocked);
        return false;
      }

      this.bustValidationErrors.set(response.validationErrors);
      this.errorMessage.set(this.t.character.setup.messages.bustSaveValidationFailed);
      return false;
    } catch (error) {
      appLogger.error('Failed to persist character bust descriptor.', error);
      this.warningMessage.set(this.t.character.setup.messages.bustSaveUnexpectedError);
      this.pendingBustCharacterId.set(characterId);
      return false;
    }
  }

  private persistCharacterBustDescriptorInBackground(characterId: string): void {
    void this.persistCharacterBustDescriptor(characterId, false).then((isBustSaved) => {
      if (!isBustSaved) {
        appLogger.warn(`Character bust descriptor save did not complete before redirect for character ${characterId}.`);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeAddResponse?.();
    this.unsubscribeInvalidSession?.();
    this.bustFormSubscription?.unsubscribe();
    this.previewState.clear();
  }

  private ensureBustPreviewPaneActive(): void {
    if (this.router.url.includes('right:character-bust-preview')) {
      return;
    }

    void this.router.navigate(
      [{ outlets: { left: ['character-setup'], right: ['character-bust-preview'] } }],
      { preserveFragment: true, replaceUrl: true },
    );
  }
}
