import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveActiveShipSelection } from '../../model/active-ship-selection';
import { PlayerCharacterSummary } from '../../model/character-list';
import { type MarketBuyResponse } from '../../model/market-buy';
import { type MarketListByLocationRequest, type MarketListByLocationResponse } from '../../model/market-list';
import {
  coerceShipDamageProfileOrNull,
  coerceShipInventory,
  coerceShipModel,
  coerceShipStatus,
  coerceShipTier,
  type ShipSummary,
} from '../../model/ship-list';
import { isValidShipSpatial } from '../../model/spatial';
import { type ShipListByOwnerRequest, type ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { appLogger } from '../../services/logger';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipExteriorNavigationService } from '../../services/ship-exterior-navigation.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import {
  ShipHangarLastSuccessfulLoad,
  ShipHangarLoadState,
  registerSw13AppTestReadinessApi,
  unregisterSw13AppTestReadinessApi,
  updateShipHangarReadinessSnapshot,
} from '../../services/sw13-app-test-readiness-contract';
import { resolveNavigationState } from '../navigation-state';

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
export default class ShipHangarPage implements OnDestroy {
  protected readonly t = locale;
  private router = inject(Router);
  private socketLifecycleService = inject(SocketLifecycleService);
  private shipService = inject(ShipService);
  private marketService = inject(MarketService);
  private sessionService = inject(SessionService);
  private exteriorNavigation = inject(ShipExteriorNavigationService);
  private navigationState: ShipHangarNavigationState = resolveNavigationState<ShipHangarNavigationState>(this.router);

  private normalizeShipId(value: string | undefined | null): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected ships = signal<ShipSummary[]>([]);
  protected isLoadingShips = signal(false);
  protected shipListError = signal<string | null>(null);
  protected hangarLoadState = signal<ShipHangarLoadState>('idle');
  protected showDevTools = computed(() => !environment.production);
  protected isBuyingTestShip = signal(false);
  protected devToolStatus = signal<string | null>(null);
  protected devToolError = signal<string | null>(null);
  protected lastSuccessfulShipLoad = signal<ShipHangarLastSuccessfulLoad | null>(null);

  private shipListRequestGeneration = 0;
  private latestActiveShipListRequestGeneration = 0;

  constructor() {
    registerSw13AppTestReadinessApi(!environment.production);
    this.publishHangarReadinessSnapshot();
    this.socketLifecycleService.runWhenConnected(() => this.loadShipsForCharacter());
  }

  ngOnDestroy(): void {
    unregisterSw13AppTestReadinessApi();
  }

  /**
   * Loads ships for active player/character context and normalizes response payloads.
   */
  loadShipsForCharacter(): void {
    const nextGeneration = this.shipListRequestGeneration + 1;
    this.shipListRequestGeneration = nextGeneration;

    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName) {
      this.shipListError.set(this.t.game.shipHangar.errors.loadShipsRequiresPlayer);
      this.hangarLoadState.set('error');
      this.ships.set([]);
      this.publishHangarReadinessSnapshot(nextGeneration);
      return;
    }

    if (!characterId) {
      this.shipListError.set(this.t.game.shipHangar.errors.loadShipsRequiresCharacterId);
      this.hangarLoadState.set('error');
      this.ships.set([]);
      this.publishHangarReadinessSnapshot(nextGeneration);
      return;
    }

    if (!sessionKey) {
      this.shipListError.set(this.t.game.shipHangar.errors.loadShipsRequiresSessionKey);
      this.hangarLoadState.set('error');
      this.ships.set([]);
      this.publishHangarReadinessSnapshot(nextGeneration);
      return;
    }

    this.latestActiveShipListRequestGeneration = nextGeneration;
    this.isLoadingShips.set(true);
    this.hangarLoadState.set('loading');
    this.shipListError.set(null);
    this.publishHangarReadinessSnapshot(nextGeneration);

    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };
    this.shipService.listShipsByOwner(request, (response: ShipListByOwnerResponse) => {
      if (nextGeneration !== this.latestActiveShipListRequestGeneration) {
        return;
      }

      this.isLoadingShips.set(false);
      if (response.success) {
        const normalizedShips = (response.ships ?? []).map((ship) => this.normalizeShipSummary(ship));
        this.ships.set(normalizedShips);
        this.hangarLoadState.set(normalizedShips.length > 0 ? 'loaded' : 'empty');

        const selected = resolveActiveShipSelection({
          ships: normalizedShips,
          sessionActiveShipId: this.sessionService.activeShip()?.id,
        });

        if (selected.ship) {
          this.sessionService.setActiveShip(selected.ship);
          this.shipListError.set(null);
          this.lastSuccessfulShipLoad.set({
            requestGeneration: nextGeneration,
            shipCount: normalizedShips.length,
            loadedAtEpochMs: Date.now(),
          });
          this.publishHangarReadinessSnapshot(nextGeneration);
          return;
        }

        if (selected.reason === 'no-usable-spatial-ship') {
          appLogger.log('ShipHangarPage.loadShipsForCharacter: hard fail due to missing usable ship spatial data', {
            playerName,
            characterId,
          });
          this.shipListError.set('No ship with usable spatial data is available.');
          this.hangarLoadState.set('error');
          this.publishHangarReadinessSnapshot(nextGeneration);
          return;
        }

        this.lastSuccessfulShipLoad.set({
          requestGeneration: nextGeneration,
          shipCount: normalizedShips.length,
          loadedAtEpochMs: Date.now(),
        });
        this.shipListError.set(null);
        this.publishHangarReadinessSnapshot(nextGeneration);
      } else {
        this.ships.set([]);
        this.hangarLoadState.set('error');
        this.shipListError.set(response.message);
        this.publishHangarReadinessSnapshot(nextGeneration);
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
    return this.isShipActive(ship) ? this.t.game.shipHangar.shipActiveLabel : this.t.game.shipHangar.shipSetActiveLabel;
  }

  protected canViewInStarSystem(ship: ShipSummary): boolean {
    return !!ship.id?.trim() && isValidShipSpatial(ship.spatial) && !!ship.spatial.solarSystemId.trim();
  }

  protected navigateToStarSystem(ship: ShipSummary): void {
    if (!this.canViewInStarSystem(ship)) return;
    const solarSystemId = ship.spatial.solarSystemId.trim();
    void this.router
      .navigate([{ outlets: { left: ['solar-system-details', solarSystemId], right: ['viewer-scene', solarSystemId] } }], {
        preserveFragment: true,
        state: {
          playerName: this.playerName(),
          joinCharacter: this.joinCharacter(),
          viewerTargetShipId: ship.id,
        },
      })
      .then((navigated) => {
        if (!navigated) appLogger.warn('Ship star system navigation was cancelled.', { shipId: ship.id, solarSystemId });
      })
      .catch((error: unknown) => appLogger.error('Ship star system navigation failed.', { shipId: ship.id, error }));
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

  async navigateToExteriorView(ship: ShipSummary): Promise<void> {
    await this.exteriorNavigation.navigate(ship, this.playerName(), this.joinCharacter());
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
    this.publishHangarReadinessSnapshot();
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

  private publishHangarReadinessSnapshot(requestGeneration?: number): void {
    updateShipHangarReadinessSnapshot({
      state: this.hangarLoadState(),
      requestGeneration: requestGeneration ?? this.latestActiveShipListRequestGeneration,
      shipCount: this.ships().length,
      error: this.shipListError(),
      routeContext: {
        playerName: this.playerName().trim() || null,
        characterId: this.joinCharacter()?.id?.trim() || null,
        shipId: this.sessionService.activeShip()?.id?.trim() || null,
      },
      lastSuccessfulLoad: this.lastSuccessfulShipLoad(),
      updatedAtEpochMs: Date.now(),
    });
  }
}
