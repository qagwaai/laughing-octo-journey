import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import type { CharacterBustReadResponse } from '../../model/bust-descriptor';
import { CharacterDeleteRequest, CharacterDeleteResponse } from '../../model/character-delete';
import { CharacterListRequest, CharacterListResult, PlayerCharacterSummary } from '../../model/character-list';
import { GameJoinRequest } from '../../model/game-join';
import type { MissionStatus } from '../../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { GENERIC_EXPLORATION_MISSION_ID } from '../../mission/generic-exploration-ship-exterior-mission';
import { BustDescriptorAdapterService } from '../../services/bust-descriptor-adapter.service';
import { CharacterService } from '../../services/character.service';
import { GameSessionService } from '../../services/game-session.service';
import { appLogger } from '../../services/logger';
import { MissionNavigationService } from '../../services/mission-navigation';
import { MissionService } from '../../services/mission.service';
import { SessionService } from '../../services/session.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { resolveNavigationState } from '../navigation-state';
import CharacterBustThumbnail, {
  type CharacterBustThumbnailState,
} from './components/character-bust-thumbnail/character-bust-thumbnail';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';
const CHARACTER_LIST_BUST_READ_TIMEOUT_MS = 5000;

@Component({
  selector: 'app-character-list-page',
  templateUrl: './character-list.html',
  styleUrls: ['./character-list.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterBustThumbnail],
})
/**
 * Character hub page for listing, deleting, and launching into gameplay flows.
 */
export default class CharacterListPage implements OnDestroy {
  protected readonly t = locale;
  private characterService = inject(CharacterService);
  private bustAdapter = inject(BustDescriptorAdapterService);
  private gameSessionService = inject(GameSessionService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private missionService = inject(MissionService);
  private missionNavigationService = inject(MissionNavigationService);
  private router = inject(Router);
  private unsubscribeInvalidSession?: () => void;
  private unsubscribeList?: () => void;
  private unsubscribeJoin?: () => void;
  private destroyed = false;
  private joinAttempt = 0;
  private navigationState: { playerName?: string } = resolveNavigationState<{ playerName?: string }>(this.router);

  protected playerName = signal<string>(this.resolveInitialPlayerName());
  protected characters = signal<PlayerCharacterSummary[]>([]);
  protected isLoading = signal(false);
  protected isJoining = signal(false);
  protected errorMessage = signal<string | null>(null);
  protected pendingDeleteCharacter = signal<PlayerCharacterSummary | null>(null);
  protected isDeleting = signal(false);
  protected bustThumbnails = signal<Record<string, CharacterBustThumbnailState>>({});

  private buildExistingCharacterState(): { id: string; characterName: string }[] {
    return this.characters().map((character) => ({
      id: character.id,
      characterName: character.characterName,
    }));
  }

  constructor() {
    const resolvedPlayerName = this.resolveInitialPlayerName();
    if (resolvedPlayerName) {
      this.playerName.set(resolvedPlayerName);
      this.sessionService.setPlayerName(resolvedPlayerName);
    }

    this.socketLifecycleService.runWhenConnected(() => this.loadCharacters());
  }

  private resolveInitialPlayerName(): string {
    return this.navigationState.playerName?.trim() || this.sessionService.getPlayerName()?.trim() || '';
  }

  /**
   * Loads character summaries for the current player context.
   * Subscribes to invalid-session only after a successful response so that
   * server-side game-session teardown events during reconnect do not misfire.
   */
  loadCharacters(): void {
    if (this.isJoining()) return;
    this.unsubscribeList?.();
    const playerName = this.playerName().trim();
    if (!playerName) {
      this.errorMessage.set(this.t.character.list.errors.loadCharactersRequiresPlayer);
      this.characters.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const request: CharacterListRequest = { playerName, sessionKey: this.sessionService.getSessionKey()! };
    this.unsubscribeList = this.characterService.listCharacters(request, (response: CharacterListResult) => {
      if (this.sessionService.getSessionKey() !== request.sessionKey) return;
      this.isLoading.set(false);
      if (response.success) {
        const normalizedCharacters = response.characters;
        this.characters.set(normalizedCharacters);
        // Bust thumbnails are fetched as a second pass so the character list itself
        // renders immediately, without waiting on per-character portrait lookups.
        this.loadCharacterBusts(normalizedCharacters);
        this.unsubscribeInvalidSession?.();
        this.unsubscribeInvalidSession = this.gameSessionService.subscribeInvalidSession(() => {
          this.joinAttempt++;
          this.unsubscribeJoin?.();
          this.isJoining.set(false);
          this.characters.set([]);
          this.loadCharacters();
        });
      } else {
        this.characters.set([]);
        this.bustThumbnails.set({});
        this.errorMessage.set(response.message);
        if (response.reason === 'invalid_session') {
          this.sessionService.clearSession();
          this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
        }
      }
    });
  }

  /**
   * Fetches each character's bust descriptor via BustDescriptorAdapterService after
   * the character list has already rendered, so bust thumbnails never block the list.
   */
  private loadCharacterBusts(characters: PlayerCharacterSummary[]): void {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    const initialThumbnails: Record<string, CharacterBustThumbnailState> = {};
    for (const character of characters) {
      initialThumbnails[character.id] = { status: 'loading' };
    }
    this.bustThumbnails.set(initialThumbnails);

    if (!playerName || !sessionKey) {
      this.markAllBustsFailed(characters);
      return;
    }

    for (const character of characters) {
      const characterId = character.id?.trim();
      if (!characterId) {
        continue;
      }

      void firstValueFrom(
        this.bustAdapter
          .readCharacterBust({ playerName, sessionKey, characterId })
          .pipe(timeout(CHARACTER_LIST_BUST_READ_TIMEOUT_MS)),
      )
        .then((response: CharacterBustReadResponse) => {
          if (!response.success || !response.descriptor) {
            this.setBustThumbnailState(characterId, { status: 'error' });
            return;
          }
          this.setBustThumbnailState(characterId, { status: 'loaded', descriptor: response.descriptor });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          appLogger.warn(`[character-list] Failed to load bust for character ${characterId}: ${message}`);
          this.setBustThumbnailState(characterId, { status: 'error' });
        });
    }
  }

  private setBustThumbnailState(characterId: string, state: CharacterBustThumbnailState): void {
    this.bustThumbnails.update((current) => ({ ...current, [characterId]: state }));
  }

  private markAllBustsFailed(characters: PlayerCharacterSummary[]): void {
    const failedThumbnails: Record<string, CharacterBustThumbnailState> = {};
    for (const character of characters) {
      failedThumbnails[character.id] = { status: 'error' };
    }
    this.bustThumbnails.set(failedThumbnails);
  }

  protected getBustThumbnailState(characterId: string): CharacterBustThumbnailState {
    return this.bustThumbnails()[characterId] ?? { status: 'loading' };
  }

  private getFirstTargetStatus(character: PlayerCharacterSummary): MissionStatus | null {
    const firstTargetMission = character.missions?.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID);
    return firstTargetMission?.status ?? null;
  }

  protected getJoinGameLabel(character: PlayerCharacterSummary): string {
    const firstTargetStatus = this.getFirstTargetStatus(character);
    // Keep "Join Game in Progress" for all post-initial mission states.
    const isInProgress = firstTargetStatus !== null && firstTargetStatus !== 'available';
    return isInProgress ? this.t.character.list.joinInProgressLabel : this.t.character.list.joinLabel;
  }

  requestDeleteCharacter(character: PlayerCharacterSummary): void {
    this.errorMessage.set(null);
    this.pendingDeleteCharacter.set(character);
  }

  cancelDeleteCharacter(): void {
    if (this.isDeleting()) {
      return;
    }
    this.pendingDeleteCharacter.set(null);
  }

  confirmDeleteCharacter(): void {
    const playerName = this.playerName().trim();
    const character = this.pendingDeleteCharacter();
    if (!character) {
      return;
    }
    if (!playerName) {
      this.errorMessage.set(this.t.character.list.errors.deleteRequiresPlayer);
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set(null);

    const request: CharacterDeleteRequest = {
      playerName,
      characterId: character.id,
      characterName: character.characterName,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.characterService.deleteCharacter(request, (response: CharacterDeleteResponse) => {
      this.isDeleting.set(false);
      if (response.success) {
        this.characters.set(this.characters().filter((c) => c.id !== character.id));
        this.pendingDeleteCharacter.set(null);
      } else {
        this.errorMessage.set(response.message);
      }
    });
  }

  navigateToCharacterSetup(): void {
    const playerName = this.playerName();
    this.router.navigate([{ outlets: { left: ['character-setup'], right: ['character-bust-preview'] } }], {
      preserveFragment: true,
      state: {
        playerName,
        mode: 'create',
        existingCharacters: this.buildExistingCharacterState(),
      },
    });
  }

  navigateToCharacterEdit(character: PlayerCharacterSummary): void {
    const playerName = this.playerName();
    this.router.navigate([{ outlets: { left: ['character-setup'], right: ['character-bust-preview'] } }], {
      preserveFragment: true,
      state: {
        playerName,
        mode: 'edit',
        editCharacter: character,
        existingCharacters: this.buildExistingCharacterState(),
      },
    });
  }

  /**
   * Starts game join and routes either to mission resume or cold-boot intro path.
   */
  navigateToGameJoin(character: PlayerCharacterSummary): void {
    if (this.isLoading() || this.isJoining()) return;
    this.errorMessage.set(null);
    const playerName = this.playerName().trim();
    if (!playerName) {
      this.errorMessage.set(this.t.character.list.errors.joinRequiresPlayer);
      return;
    }
    if (!character.id) {
      this.errorMessage.set(this.t.character.list.errors.joinRequiresCharacterId);
      return;
    }

    const sessionKey = this.sessionService.getSessionKey();
    if (!sessionKey) {
      this.errorMessage.set(this.t.character.list.errors.joinRequiresSession);
      return;
    }
    this.isJoining.set(true);
    const joinAttempt = ++this.joinAttempt;
    const request: GameJoinRequest = {
      playerName,
      characterId: character.id,
      sessionKey,
    };
    this.unsubscribeJoin = this.gameSessionService.requestGameJoin(request, (response) => {
      if (this.destroyed || this.joinAttempt !== joinAttempt) return;
      if (this.sessionService.getSessionKey() !== sessionKey) {
        this.isJoining.set(false);
        this.errorMessage.set(this.t.character.list.errors.joinRequiresSession);
        return;
      }
      if (!response.success) {
        this.isJoining.set(false);
        this.errorMessage.set(response.message);
        return;
      }
      this.enterJoinedCharacter(playerName, character, sessionKey, joinAttempt);
    });
  }

  private enterJoinedCharacter(playerName: string, character: PlayerCharacterSummary, sessionKey: string, joinAttempt: number): void {
    this.sessionService.setMissionEntryContext(playerName, character);
    this.sessionService.setActiveCharacter(character);

    const firstTargetStatus = this.getFirstTargetStatus(character);
    const isFirstTargetInProgress = this.missionService.isMissionInProgress(firstTargetStatus);
    const isFirstTargetCompleted = firstTargetStatus === 'completed';

    const outlets = isFirstTargetInProgress
      ? { primary: ['ship-exterior-view'], right: ['opening-cold-boot-scan'], left: ['game-main'] }
      : isFirstTargetCompleted
        ? { primary: ['ship-exterior-view'], right: ['mission-board'], left: ['game-main'] }
        : { primary: ['opening-cold-boot'], left: ['opening-cold-boot'] };

    // Both the in-progress and completed paths enter the ship exterior scene, so both
    // must hydrate a real active ship before navigating. Without this the scene mounts
    // with no selected ship and renders an empty field.
    const needsShipHydration = isFirstTargetInProgress || isFirstTargetCompleted;

    if (!needsShipHydration) {
      this.isJoining.set(false);
      this.router.navigate([{ outlets }], {
        preserveFragment: true,
        state: { playerName, joinCharacter: character },
      });
      return;
    }

    // Delegate to MissionNavigationService to fetch the real ship and build the mission
    // context. This ensures the ship is placed at its real spatial location (not a
    // synthetic (0,0,0) placeholder).
    this.missionNavigationService
      .prepareNavigation({
        missionId: isFirstTargetInProgress ? FIRST_TARGET_MISSION_ID : GENERIC_EXPLORATION_MISSION_ID,
        playerName,
        joinCharacter: character,
        sessionKey,
        missionStatus: firstTargetStatus ?? undefined,
      })
      .then((prepared) => {
        if (this.destroyed || this.joinAttempt !== joinAttempt) return;
        this.isJoining.set(false);
        if (this.sessionService.getSessionKey() !== sessionKey) {
          this.errorMessage.set(this.t.character.list.errors.joinRequiresSession);
          return;
        }
        if (!prepared.joinShip) {
          this.errorMessage.set(this.t.character.list.errors.joinShipUnavailable);
          return;
        }
        if (isFirstTargetInProgress) {
          window.dispatchEvent(new CustomEvent(START_SCANNING_UI_EVENT));
        }
        return this.router.navigate([{ outlets }], {
          preserveFragment: true,
          state: {
            playerName: prepared.playerName,
            joinCharacter: prepared.joinCharacter,
            ...(prepared.joinShip ? { joinShip: prepared.joinShip } : {}),
            missionContext: prepared.missionContext,
            ...(prepared.firstTargetMissionStatus
              ? { firstTargetMissionStatus: prepared.firstTargetMissionStatus }
              : {}),
          },
        });
      })
      .catch((error: unknown) => {
        if (this.destroyed || this.joinAttempt !== joinAttempt) return;
        this.isJoining.set(false);
        appLogger.warn('[character-list] Failed to prepare joined character navigation', error);
        this.errorMessage.set(this.t.character.list.errors.joinShipUnavailable);
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.unsubscribeList?.();
    this.unsubscribeInvalidSession?.();
    this.unsubscribeJoin?.();
  }
}
