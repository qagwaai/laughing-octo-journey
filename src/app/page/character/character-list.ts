import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { CharacterDeleteRequest, CharacterDeleteResponse } from '../../model/character-delete';
import { CharacterListRequest, CharacterListResponse, PlayerCharacterSummary } from '../../model/character-list';
import { GameJoinRequest } from '../../model/game-join';
import type { CharacterMissionProgress, MissionStatus } from '../../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { type ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';
import type { ShipListRequest, ShipListResponse, ShipSummary } from '../../model/ship-list';
import { CharacterService } from '../../services/character.service';
import { GameSessionService } from '../../services/game-session.service';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { resolveNavigationState } from '../navigation-state';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';

@Component({
  selector: 'app-character-list-page',
  templateUrl: './character-list.html',
  styleUrls: ['./character-list.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu],
})
/**
 * Character hub page for listing, deleting, and launching into gameplay flows.
 */
export default class CharacterListPage implements OnDestroy {
  protected readonly t = locale;
  private characterService = inject(CharacterService);
  private gameSessionService = inject(GameSessionService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private shipService = inject(ShipService);
  private router = inject(Router);
  private unsubscribeInvalidSession?: () => void;
  private navigationState: { playerName?: string } = resolveNavigationState<{ playerName?: string }>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected characters = signal<PlayerCharacterSummary[]>([]);
  protected isLoading = signal(false);
  protected errorMessage = signal<string | null>(null);
  protected pendingDeleteCharacter = signal<PlayerCharacterSummary | null>(null);
  protected isDeleting = signal(false);

  constructor() {
    this.unsubscribeInvalidSession = this.gameSessionService.subscribeInvalidSession(() => {
      this.sessionService.clearSession();
      this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });

    this.socketLifecycleService.runWhenConnected(() => this.loadCharacters());
  }

  /**
   * Loads character summaries for the current player context.
   */
  loadCharacters(): void {
    const playerName = this.playerName().trim();
    if (!playerName) {
      this.errorMessage.set(this.t.character.list.errors.loadCharactersRequiresPlayer);
      this.characters.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const request: CharacterListRequest = { playerName, sessionKey: this.sessionService.getSessionKey()! };
    this.characterService.listCharacters(request, (response: CharacterListResponse) => {
      this.isLoading.set(false);
      if (response.success) {
        this.characters.set(this.normalizeCharacters(response.characters));
      } else {
        this.characters.set([]);
        this.errorMessage.set(response.message);
      }
    });
  }

  /**
   * Normalizes raw character payloads from backend variants into UI-safe summaries.
   */
  private normalizeCharacters(characters: unknown): PlayerCharacterSummary[] {
    if (!Array.isArray(characters)) {
      return [];
    }

    return characters.map((raw, index) => {
      const item = (raw ?? {}) as {
        id?: unknown;
        characterId?: unknown;
        characterName?: unknown;
        name?: unknown;
        character?: { name?: unknown };
        level?: unknown;
        createdAt?: unknown;
        missions?: unknown;
      };

      const nameFromObject = typeof item.character?.name === 'string' ? item.character.name : undefined;
      const resolvedCharacterName =
        typeof item.characterName === 'string'
          ? item.characterName
          : typeof item.name === 'string'
            ? item.name
            : nameFromObject;
      const missions = this.normalizeMissionProgress(item.missions);

      return {
        id:
          typeof item.id === 'string'
            ? item.id
            : typeof item.characterId === 'string'
              ? item.characterId
              : `char-${index}`,
        characterName: (resolvedCharacterName ?? '').trim(),
        level: typeof item.level === 'number' ? item.level : undefined,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
        ...(missions ? { missions } : {}),
      };
    });
  }

  /**
   * Normalizes mission progress payloads into typed mission status entries.
   */
  private normalizeMissionProgress(missions: unknown): CharacterMissionProgress[] | undefined {
    if (!Array.isArray(missions)) {
      return undefined;
    }

    const normalizedMissions = missions.flatMap((rawMission) => {
      const mission = (rawMission ?? {}) as { missionId?: unknown; status?: unknown };
      if (typeof mission.missionId !== 'string' || typeof mission.status !== 'string') {
        return [];
      }

      return [{ missionId: mission.missionId, status: mission.status as MissionStatus }];
    });

    return normalizedMissions.length > 0 ? normalizedMissions : undefined;
  }

  private getFirstTargetStatus(character: PlayerCharacterSummary): MissionStatus | null {
    const firstTargetMission = character.missions?.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID);
    return firstTargetMission?.status ?? null;
  }

  protected getJoinGameLabel(character: PlayerCharacterSummary): string {
    const firstTargetStatus = this.getFirstTargetStatus(character);
    const isInProgress =
      firstTargetStatus === 'started' || firstTargetStatus === 'in-progress' || firstTargetStatus === 'paused';
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
    this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
      preserveFragment: true,
      state: { playerName, mode: 'create' },
    });
  }

  navigateToCharacterEdit(character: PlayerCharacterSummary): void {
    const playerName = this.playerName();
    this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
      preserveFragment: true,
      state: {
        playerName,
        mode: 'edit',
        editCharacter: character,
      },
    });
  }

  /**
   * Starts game join and routes either to mission resume or cold-boot intro path.
   */
  navigateToGameJoin(character: PlayerCharacterSummary): void {
    const playerName = this.playerName().trim();
    if (!playerName) {
      this.errorMessage.set(this.t.character.list.errors.joinRequiresPlayer);
      return;
    }
    if (!character.id) {
      this.errorMessage.set(this.t.character.list.errors.joinRequiresCharacterId);
      return;
    }

    const request: GameJoinRequest = {
      playerName,
      characterId: character.id,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.sessionService.setActiveCharacter(character);
    this.gameSessionService.requestGameJoin(request);

    const firstTargetStatus = this.getFirstTargetStatus(character);
    const isFirstTargetInProgress =
      firstTargetStatus === 'started' || firstTargetStatus === 'in-progress' || firstTargetStatus === 'paused';
    const isFirstTargetCompleted = firstTargetStatus === 'completed' || firstTargetStatus === 'turned-in';

    const outlets = isFirstTargetInProgress
      ? { right: ['opening-cold-boot-scan'], left: ['game-main'] }
      : isFirstTargetCompleted
        ? { right: ['mission-board'], left: ['game-main'] }
        : { primary: ['opening-cold-boot'], left: ['opening-cold-boot'] };

    const missionContext = isFirstTargetInProgress
      ? ({
          missionId: FIRST_TARGET_MISSION_ID,
          missionStatusHint: firstTargetStatus,
          seedPolicy: 'auto',
          shipDamagePreset: 'cold-boot-starter-damaged',
        } satisfies ShipExteriorViewMissionContext)
      : undefined;

    const navigateToOutlets = (joinShip?: ShipSummary): void => {
      this.router.navigate([{ outlets }], {
        preserveFragment: true,
        state: {
          playerName,
          joinCharacter: character,
          ...(joinShip ? { joinShip } : {}),
          ...(missionContext ? { missionContext } : {}),
          ...(isFirstTargetInProgress ? { firstTargetMissionStatus: firstTargetStatus } : {}),
        },
      });
    };

    if (!isFirstTargetInProgress) {
      navigateToOutlets();
      return;
    }

    // First-target in progress: fetch the real ship before navigating so the
    // cold-boot scan flow operates on a ship with a real spatial location
    // (placed in the asteroid belt by `generateDeterministicStarterShipUpdate`).
    // The previous synthetic `(0, 0, 0)` placeholder rendered the ship inside
    // the sun in the stellar viewer; loading the real ship avoids that.
    const shipListRequest: ShipListRequest = {
      playerName,
      characterId: character.id,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.shipService.listShips(shipListRequest, (response: ShipListResponse) => {
      if (response.success) {
        const resolved = (response.ships ?? [])[0];
        if (resolved) {
          this.sessionService.setActiveShip(resolved);
        } else {
          appLogger.warn('ship-list returned no ships during cold-boot join; proceeding without active ship.');
        }
      } else {
        appLogger.warn('ship-list failed during cold-boot join; proceeding without active ship:', response.message);
      }
      window.dispatchEvent(new CustomEvent(START_SCANNING_UI_EVENT));
      navigateToOutlets(this.sessionService.activeShip() ?? undefined);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeInvalidSession?.();
  }
}
