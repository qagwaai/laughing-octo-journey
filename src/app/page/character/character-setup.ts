import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { CharacterAddRequest, CharacterAddResponse } from '../../model/character-add';
import { CharacterEditRequest, CharacterEditResponse } from '../../model/character-edit';
import {
  normalizeCharacterName,
  pickSuggestedCharacterName,
} from '../../model/character-name-suggestions';
import { PlayerCharacterSummary } from '../../model/character-list';
import { generateDeterministicStarterShipUpdate } from '../../model/domain/starter-ship';
import { type ShipListByOwnerRequest, type ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { CharacterService } from '../../services/character.service';
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
  private router = inject(Router);
  private characterService = inject(CharacterService);
  private gameSessionService = inject(GameSessionService);
  private socketService = inject(SocketService);
  private shipService = inject(ShipService);
  private sessionService = inject(SessionService);
  private unsubscribeAddResponse?: () => void;
  private unsubscribeInvalidSession?: () => void;
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
  });

  protected isSaved = signal(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected warningMessage = signal<string | null>(null);
  protected isSubmitting = signal(false);
  protected existingCharacters = signal<{ id: string; characterName: string }[]>(
    this.setupState.existingCharacters ?? [],
  );

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
        if (!isEditMode) {
          const addResponse = response as CharacterAddResponse;
          await this.createStarterShipForCharacter(addResponse.characterId);
        }
        this.navigateToCharacterList();
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
        void handleSaveResponse(response);
      });
      return;
    }

    const request: CharacterAddRequest = {
      playerName,
      characterName,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.unsubscribeAddResponse = this.characterService.addCharacter(request, (response: CharacterAddResponse) => {
      void handleSaveResponse(response);
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
    this.router.navigate([{ outlets: { left: ['character-list'] } }], {
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

  ngOnDestroy(): void {
    this.unsubscribeAddResponse?.();
    this.unsubscribeInvalidSession?.();
  }
}
