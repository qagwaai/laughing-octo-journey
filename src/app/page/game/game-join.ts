import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { PlayerCharacterSummary } from '../../model/character-list';
import { summarizeShipMotion } from '../../model/math/kinematics';
import { type SpatialState } from '../../model/math/spatial';
import {
  coerceShipDamageProfileOrNull,
  coerceShipInventory,
  coerceShipModel,
  coerceShipStatus,
  coerceShipTier,
  type ShipListRequest,
  type ShipListResponse,
  type ShipMotion,
  type ShipSummary,
} from '../../model/ship-list';
import { GameSessionService } from '../../services/game-session.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';

interface GameJoinNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-game-join-page',
  templateUrl: './game-join.html',
  styleUrls: ['./game-join.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Game-join staging page that loads ships and prepares ship-scoped navigation state.
 */
export default class GameJoinPage {
  protected readonly t = locale;
  private router = inject(Router);
  private gameSessionService = inject(GameSessionService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private shipService = inject(ShipService);
  private sessionService = inject(SessionService);
  private unsubscribeInvalidSession?: () => void;
  private navigationState: GameJoinNavigationState = resolveNavigationState<GameJoinNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected characterName = signal<string>(this.joinCharacter()?.characterName ?? 'Unknown Character');
  protected ships = signal<ShipSummary[]>([]);
  protected isLoadingShips = signal(false);
  protected shipListError = signal<string | null>(null);

  constructor() {
    this.unsubscribeInvalidSession = this.gameSessionService.subscribeInvalidSession(() => {
      this.sessionService.clearSession();
      this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });

    this.socketLifecycleService.runWhenConnected(() => this.loadShipsForCharacter());
  }

  /**
   * Loads ships for the selected character and normalizes backend payload variants.
   */
  loadShipsForCharacter(): void {
    const playerName = this.playerName().trim();
    const character = this.joinCharacter();

    if (!playerName) {
      this.shipListError.set(this.t.game.join.errors.loadShipsRequiresPlayer);
      this.ships.set([]);
      return;
    }

    if (!character?.id) {
      this.shipListError.set(this.t.game.join.errors.loadShipsRequiresCharacterId);
      this.ships.set([]);
      return;
    }

    this.sessionService.setActiveCharacter(character);
    this.isLoadingShips.set(true);
    this.shipListError.set(null);

    const request: ShipListRequest = {
      playerName,
      characterId: character.id,
      sessionKey: this.sessionService.getSessionKey()!,
    };
    this.shipService.listShips(request, (response: ShipListResponse) => {
      this.isLoadingShips.set(false);
      if (response.success) {
        this.ships.set((response.ships ?? []).map((ship) => this.normalizeShipSummary(ship)));
        this.shipListError.set(null);
      } else {
        this.ships.set([]);
        this.shipListError.set(response.message);
      }
    });
  }

  /**
   * Normalizes optional/legacy ship fields into a consistent ShipSummary shape.
   */
  private normalizeShipSummary(ship: ShipSummary): ShipSummary {
    const rawShip = ship as ShipSummary & {
      shipName?: string;
      displayName?: string;
      modelName?: string;
      tierLevel?: number;
      spatial?: SpatialState;
      motion?: ShipMotion;
    };

    const normalizedName =
      rawShip.name?.trim() || rawShip.shipName?.trim() || rawShip.displayName?.trim() || rawShip.id;
    const normalizedModel = coerceShipModel(rawShip.model ?? rawShip.modelName);
    const normalizedTier = coerceShipTier(rawShip.tier ?? rawShip.tierLevel);
    const normalizedInventory = coerceShipInventory(rawShip.inventory);
    const normalizedSpatial = rawShip.spatial ?? {
      solarSystemId: 'unknown-system',
      frame: 'barycentric' as const,
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: Date.now(),
    };

    return {
      ...ship,
      name: normalizedName,
      status: coerceShipStatus(rawShip.status),
      damageProfile: coerceShipDamageProfileOrNull(rawShip.damageProfile),
      model: normalizedModel,
      tier: normalizedTier,
      inventory: normalizedInventory,
      spatial: normalizedSpatial,
      motion: rawShip.motion,
    };
  }

  /**
   * Opens item/specs panel for the selected ship and persists active-ship session state.
   */
  navigateToShipSpecs(ship: ShipSummary): void {
    const playerName = this.playerName();
    const joinCharacter = this.joinCharacter();

    this.sessionService.setActiveShip(ship);

    this.router.navigate([{ outlets: { right: ['item-view-specs'], left: ['game-join'] } }], {
      preserveFragment: true,
      queryParams: { specsNav: Date.now() },
      state: {
        playerName,
        joinCharacter,
        itemType: coerceShipModel(ship.model),
        item: ship,
      },
    });
  }

  protected getShipDisplayName(ship: ShipSummary): string {
    return ship.name.trim() || 'Unnamed Ship';
  }

  protected getShipModelLabel(ship: ShipSummary): string {
    return coerceShipModel(ship.model);
  }

  protected getShipTierLabel(ship: ShipSummary): string {
    return `T${coerceShipTier(ship.tier)}`;
  }

  /**
   * Builds a human-readable kinematics summary from spatial + motion vectors.
   */
  protected getShipKinematicsSummary(ship: ShipSummary): string {
    const spatial = ship.spatial;
    const motion = ship.motion;
    if (!spatial || !motion) {
      return 'Kinematics unavailable';
    }

    const summary = summarizeShipMotion(motion);
    const speed = `${summary.speedKmPerSec.toFixed(3)} km/s`;
    const position = `(${spatial.positionKm.x}, ${spatial.positionKm.y}, ${spatial.positionKm.z}) km`;

    if (!summary.headingUnitVector) {
      return `${spatial.frame}, position ${position}, stationary at ${speed}`;
    }

    const heading = `(${summary.headingUnitVector.x.toFixed(3)}, ${summary.headingUnitVector.y.toFixed(3)}, ${summary.headingUnitVector.z.toFixed(3)})`;
    return `${spatial.frame}, position ${position}, speed ${speed}, heading ${heading}`;
  }

  ngOnDestroy(): void {
    this.unsubscribeInvalidSession?.();
  }

  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }
}
