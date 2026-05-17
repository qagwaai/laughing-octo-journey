import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { CharacterAddRequest, CharacterAddResponse } from '../../model/character-add';
import { CharacterEditRequest, CharacterEditResponse } from '../../model/character-edit';
import { PlayerCharacterSummary } from '../../model/character-list';
import { generateDeterministicStarterShipUpdate } from '../../model/domain/starter-ship';
import { type ShipListRequest, type ShipListResponse } from '../../model/ship-list';
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
}

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
      this.editCharacter()?.characterName ?? this.playerName(),
      [Validators.required, Validators.minLength(2), Validators.maxLength(24)],
    ],
  });

  protected isSaved = signal(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected warningMessage = signal<string | null>(null);
  protected isSubmitting = signal(false);

  constructor() {
    this.unsubscribeInvalidSession = this.gameSessionService.subscribeInvalidSession(() => {
      this.sessionService.clearSession();
      this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });
  }

  /**
   * Validates form input and dispatches add/edit character request flow.
   */
  saveCharacter(): void {
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

    const handleSaveResponse = (response: CharacterAddResponse | CharacterEditResponse): void => {
      this.isSubmitting.set(false);
      if (response.success) {
        this.isSaved.set(true);
        this.successMessage.set(response.message);
        this.errorMessage.set(null);
        if (!isEditMode) {
          const addResponse = response as CharacterAddResponse;
          this.createStarterShipForCharacter(addResponse.characterId);
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
        handleSaveResponse(response);
      });
      return;
    }

    const request: CharacterAddRequest = {
      playerName,
      characterName,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.unsubscribeAddResponse = this.characterService.addCharacter(request, (response: CharacterAddResponse) => {
      handleSaveResponse(response);
    });
  }

  /**
   * Resolves starter ship and applies deterministic starter configuration/items.
   */
  private createStarterShipForCharacter(characterId?: string): void {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const resolvedCharacterId = characterId?.trim() ?? '';

    if (!playerName || !sessionKey || !resolvedCharacterId) {
      appLogger.warn('Skipping starter ship upsert due to missing character context.');
      this.warningMessage.set(this.t.character.setup.messages.starterShipInitPending);
      return;
    }

    const followupRequest: ShipListRequest = {
      playerName,
      characterId: resolvedCharacterId,
      sessionKey,
    };
    this.shipService.listShips(followupRequest, (response: ShipListResponse) => {
      if (!response.success) {
        appLogger.warn('Unable to resolve starter ship from ship-list:', response.message);
        this.warningMessage.set(this.t.character.setup.messages.starterShipResolvePending);
        return;
      }

      const starterShipId = response.ships?.[0]?.id?.trim();
      if (!starterShipId) {
        appLogger.warn('Starter ship id was not returned by ship-list response.');
        this.warningMessage.set(this.t.character.setup.messages.starterShipMissingRecord);
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
            return;
          }

          if (!Array.isArray(upsertResponse.ship?.inventory)) {
            appLogger.warn('Starter ship upsert did not include backend inventory payload.');
          }

          this.warningMessage.set(null);
        },
      );
    });
  }

  navigateToCharacterList(): void {
    const playerName = this.playerName() || this.characterForm.value.characterName || '';
    this.router.navigate([{ outlets: { left: ['character-list'] } }], {
      preserveFragment: true,
      state: { playerName },
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeAddResponse?.();
    this.unsubscribeInvalidSession?.();
  }
}
