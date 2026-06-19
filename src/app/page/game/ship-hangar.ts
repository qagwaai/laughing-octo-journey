import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { environment } from '../../../environments/environment';
import { resolveNavigationState } from '../navigation-state';
import { resolveActiveShipSelection } from '../../model/active-ship-selection';
import { PlayerCharacterSummary } from '../../model/character-list';
import { type MissionStatus } from '../../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { type MarketListByLocationRequest, type MarketListByLocationResponse } from '../../model/market-list';
import { type MarketBuyResponse } from '../../model/market-buy';
import { type ShipListByOwnerRequest, type ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import {
  coerceShipDamageProfileOrNull,
  coerceShipInventory,
  coerceShipModel,
  coerceShipStatus,
  coerceShipTier,
  type ShipSummary,
} from '../../model/ship-list';
import { isValidShipSpatial } from '../../model/spatial';
import { SessionService } from '../../services/session.service';
import { MarketService } from '../../services/market.service';
import { ShipService } from '../../services/ship.service';
import { MissionService } from '../../services/mission.service';
import { MissionNavigationService } from '../../services/mission-navigation';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { appLogger } from '../../services/logger';

interface ShipHangarNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-ship-hangar-page',
  templateUrl: './ship-hangar.html',
  styleUrls: ['./ship-hangar.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Ship hangar page for ship listing, selection, and navigation into ship sub-flows.
 */
export default class ShipHangarPage {
  protected readonly t = locale;
  private router = inject(Router);
  private socketLifecycleService = inject(SocketLifecycleService);
  private shipService = inject(ShipService);
  private marketService = inject(MarketService);
  private sessionService = inject(SessionService);
  private missionService = inject(MissionService);
  private missionNavigationService = inject(MissionNavigationService);
  private navigationState: ShipHangarNavigationState = resolveNavigationState<ShipHangarNavigationState>(this.router);

  private normalizeShipId(value: string | undefined | null): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected ships = signal<ShipSummary[]>([]);
  protected isLoadingShips = signal(false);
  protected shipListError = signal<string | null>(null);
  protected showDevTools = computed(() => !environment.production);
  protected isBuyingTestShip = signal(false);
  protected devToolStatus = signal<string | null>(null);
  protected devToolError = signal<string | null>(null);

  constructor() {
    this.socketLifecycleService.runWhenConnected(() => this.loadShipsForCharacter());
  }

  /**
   * Loads ships for active player/character context and normalizes response payloads.
   */
  loadShipsForCharacter(): void {
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName) {
      this.shipListError.set(this.t.game.shipHangar.errors.loadShipsRequiresPlayer);
      this.ships.set([]);
      return;
    }

    if (!characterId) {
      this.shipListError.set(this.t.game.shipHangar.errors.loadShipsRequiresCharacterId);
      this.ships.set([]);
      return;
    }

    if (!sessionKey) {
      this.shipListError.set(this.t.game.shipHangar.errors.loadShipsRequiresSessionKey);
      this.ships.set([]);
      return;
    }

    this.isLoadingShips.set(true);
    this.shipListError.set(null);

    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };
    this.shipService.listShipsByOwner(request, (response: ShipListByOwnerResponse) => {
      this.isLoadingShips.set(false);
      if (response.success) {
        const normalizedShips = (response.ships ?? []).map((ship) => this.normalizeShipSummary(ship));
        this.ships.set(normalizedShips);

        const selected = resolveActiveShipSelection({
          ships: normalizedShips,
          sessionActiveShipId: this.sessionService.activeShip()?.id,
        });

        if (selected.ship) {
          this.sessionService.setActiveShip(selected.ship);
          this.shipListError.set(null);
          return;
        }

        if (selected.reason === 'no-usable-spatial-ship') {
          appLogger.log('ShipHangarPage.loadShipsForCharacter: hard fail due to missing usable ship spatial data', {
            playerName,
            characterId,
          });
          this.shipListError.set('No ship with usable spatial data is available.');
          return;
        }

        this.shipListError.set(null);
      } else {
        this.ships.set([]);
        this.shipListError.set(response.message);
      }
    });
  }

  buyScavengerPodFromClosestMarket(): void {
    const playerName = this.playerName().trim();
    const joinCharacter = this.joinCharacter();
    const characterId = joinCharacter?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const activeShip = this.sessionService.activeShip();
    const solarSystemId = activeShip?.spatial?.solarSystemId?.trim() ?? '';
    const positionKm = activeShip?.spatial?.positionKm;

    this.devToolError.set(null);
    this.devToolStatus.set(null);

    if (!playerName || !characterId || !sessionKey) {
      this.devToolError.set('Player, character, and session context are required for the dev buy test.');
      return;
    }

    if (!solarSystemId || !positionKm) {
      this.devToolError.set('Active ship spatial data is required to locate the closest market.');
      return;
    }

    this.isBuyingTestShip.set(true);
    this.buyScavengerPodFromClosestMarketCore({ playerName, sessionKey, characterId, activeShip });
  }

  private buyScavengerPodFromClosestMarketCore(context: {
    playerName: string;
    sessionKey: string;
    characterId: string;
    activeShip: ShipSummary | null;
  }): void {
    const activeShip = context.activeShip;
    const solarSystemId = activeShip?.spatial?.solarSystemId?.trim() ?? '';
    const positionKm = activeShip?.spatial?.positionKm;

    if (!solarSystemId || !positionKm) {
      this.isBuyingTestShip.set(false);
      this.devToolError.set('Active ship spatial data is required to locate the closest market.');
      this.devToolStatus.set(null);
      return;
    }

    this.devToolStatus.set('Finding closest market...');

    const request: MarketListByLocationRequest = {
      playerName: context.playerName,
      sessionKey: context.sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: 50,
      limit: 10,
      locationTypes: ['station', 'free-floating'],
      characterId: context.characterId,
      shipId: activeShip?.id,
    };

    this.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      if (!response.success) {
        this.isBuyingTestShip.set(false);
        this.devToolError.set(response.message);
        this.devToolStatus.set(null);
        return;
      }

      const closestMarket = response.markets?.[0];
      if (!closestMarket) {
        this.isBuyingTestShip.set(false);
        this.devToolError.set('No market was returned by the closest-market lookup.');
        this.devToolStatus.set(null);
        return;
      }

      this.devToolStatus.set(`Buying Scavenger Pod at ${closestMarket.marketName}...`);
      this.marketService.buyMarket(
        {
          playerName: context.playerName,
          sessionKey: context.sessionKey,
          marketId: closestMarket.marketId,
          solarSystemId: closestMarket.solarSystemId,
          characterId: context.characterId,
          itemId: 'scavenger-pod',
          quantity: 1,
          requestId: `dev-scavenger-pod-${Date.now()}`,
        },
        (buyResponse: MarketBuyResponse) => {
          this.isBuyingTestShip.set(false);
          if (!buyResponse.success) {
            this.devToolError.set(buyResponse.message);
            this.devToolStatus.set(null);
            return;
          }

          const purchasedShip = buyResponse.transaction?.purchasedShip;
          this.devToolError.set(null);
          this.devToolStatus.set(
            purchasedShip
              ? `Purchased ${purchasedShip.shipName} (${purchasedShip.id}). Refreshing hangar...`
              : 'Purchased Scavenger Pod. Refreshing hangar...',
          );
          this.loadShipsForCharacter();
        },
      );
    });
  }

  private normalizeShipSummary(ship: ShipSummary): ShipSummary {
    const rawShip = ship as ShipSummary & { modelName?: string; tierLevel?: number };
    const normalizedModel = coerceShipModel(rawShip.model ?? rawShip.modelName);
    return {
      ...ship,
      status: coerceShipStatus(rawShip.status),
      damageProfile: coerceShipDamageProfileOrNull(rawShip.damageProfile),
      model: normalizedModel,
      tier: coerceShipTier(rawShip.tier ?? rawShip.tierLevel),
      inventory: coerceShipInventory(rawShip.inventory),
    };
  }

  protected getShipDisplayName(ship: ShipSummary): string {
    return ship.name?.trim() || ship.id;
  }

  protected getShipModelLabel(ship: ShipSummary): string {
    return coerceShipModel(ship.model);
  }

  protected getShipTierLabel(ship: ShipSummary): string {
    return `T${coerceShipTier(ship.tier)}`;
  }

  protected getShipLocationSummary(ship: ShipSummary): string {
    const position = ship.spatial?.positionKm;
    if (!position) {
      return this.t.game.shipHangar.locationUnavailable;
    }

    return `(${position.x}, ${position.y}, ${position.z}) km`;
  }

  protected isShipActive(ship: ShipSummary): boolean {
    const activeShipId = this.sessionService.activeShip()?.id?.trim() ?? '';
    return activeShipId.length > 0 && ship.id === activeShipId;
  }

  protected getSetActiveShipLabel(ship: ShipSummary): string {
    return this.isShipActive(ship)
      ? this.t.game.shipHangar.shipActiveLabel
      : this.t.game.shipHangar.shipSetActiveLabel;
  }

  private getFirstTargetMissionStatus(): MissionStatus | undefined {
    const missions = this.joinCharacter()?.missions;
    if (!Array.isArray(missions)) {
      return undefined;
    }

    return missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status;
  }

  navigateToShipInventory(ship: ShipSummary): void {
    this.router.navigate([{ outlets: { left: ['ship-view-inventory'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
        joinShip: ship,
      },
    });
  }

  /**
   * Opens exterior view with mission context derived from first-target mission status.
   * Delegates to MissionNavigationService to build the mission context from the
   * registered initialization strategy.
   */
  async navigateToExteriorView(ship: ShipSummary): Promise<void> {
    const navigationShip = this.resolvePreferredExteriorNavigationShip(ship);
    this.sessionService.setActiveShip(navigationShip);

    const firstTargetMissionStatus = this.getFirstTargetMissionStatus();
    const joinCharacter = this.joinCharacter();
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    let missionContext;
    if (joinCharacter && playerName) {
      const prepared = await this.missionNavigationService.prepareNavigation({
        missionId: FIRST_TARGET_MISSION_ID,
        playerName,
        joinCharacter,
        sessionKey,
        missionStatus: firstTargetMissionStatus ?? null,
      });
      missionContext = prepared.missionContext;
    } else {
      missionContext = {
        missionId: FIRST_TARGET_MISSION_ID,
        seedPolicy: 'resume' as const,
        ...(firstTargetMissionStatus ? { missionStatusHint: firstTargetMissionStatus } : {}),
      };
    }

    // For active in-progress first-target missions, surface the damage preset on
    // the mission context so the cold-boot scan view applies starter damage.
    if (this.missionService.isMissionInProgress(firstTargetMissionStatus)) {
      const damagePreset = this.missionService.getMissionDamagePreset(
        FIRST_TARGET_MISSION_ID,
        firstTargetMissionStatus ?? null,
      );
      if (damagePreset) {
        missionContext = { ...missionContext, shipDamagePreset: damagePreset };
      }
    }

    this.router.navigate([{ outlets: { primary: ['ship-exterior-view'], right: null, left: ['ship-hangar'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
        joinShip: navigationShip,
        missionContext,
        ...(firstTargetMissionStatus ? { firstTargetMissionStatus } : {}),
      },
    });
  }

  private resolvePreferredExteriorNavigationShip(ship: ShipSummary): ShipSummary {
    const activeShip = this.sessionService.activeShip();
    if (!activeShip) {
      return ship;
    }

    const activeShipId = this.normalizeShipId(activeShip.id);
    const selectedShipId = this.normalizeShipId(ship.id);
    if (!activeShipId || !selectedShipId || activeShipId !== selectedShipId) {
      return ship;
    }

    if (!isValidShipSpatial(activeShip.spatial)) {
      return ship;
    }

    return {
      ...ship,
      spatial: activeShip.spatial,
    };
  }

  navigateToShipSpecs(ship: ShipSummary): void {
    this.router.navigate([{ outlets: { right: ['item-view-specs'], left: ['ship-hangar'] } }], {
      preserveFragment: true,
      queryParams: { specsNav: Date.now() },
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
        itemType: coerceShipModel(ship.model),
        item: ship,
      },
    });
  }

  /**
   * Persists chosen ship as active session ship for downstream flows.
   */
  setActiveShip(ship: ShipSummary): void {
    if (this.isShipActive(ship)) {
      return;
    }

    this.sessionService.setActiveShip(ship);
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
