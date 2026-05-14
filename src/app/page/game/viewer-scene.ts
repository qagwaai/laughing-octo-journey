import { ChangeDetectionStrategy, Component, computed, inject, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgtCanvas } from 'angular-three/dom';
import { locale } from '../../i18n/locale';
import {
  type MarketListByLocationRequest,
  type MarketListByLocationResponse,
  type MarketSummary,
} from '../../model/market-list';
import { generateDeterministicStarterShipUpdate } from '../../model/domain/starter-ship';
import { isValidShipSpatial } from '../../model/math/spatial';
import type { SolarSystemGetResponse, ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import type { ShipSummary, ShipListRequest, ShipListResponse } from '../../model/ship-list';
import type { ShipUpsertRequest, ShipUpsertResponse } from '../../model/ship-upsert';
import { MarketService } from '../../services/market.service';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import { ViewerSystemScene } from '../../scene/viewer/viewer-system-scene';
import type { ViewerSystemSceneInputs } from '../../scene/viewer/viewer-system-scene';

interface ViewerSceneNavigationState {
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemSummary;
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

const VIEWER_MARKET_DISCOVERY_DISTANCE_AU = 200;
const VIEWER_MARKET_DISCOVERY_LIMIT = 250;

@Component({
  selector: 'app-viewer-scene-page',
  templateUrl: './viewer-scene.html',
  styleUrls: ['./viewer-scene.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgtCanvas, ViewerSystemScene],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
/**
 * Right-pane host for the Angular Three Viewer scene. Hosts `<ngt-canvas>`
 * (so child scene components have an `NgtStore`) and feeds the inner scene
 * the {@link ViewerBody} list resolved from the backend's
 * `solar-system-get-response`.
 */
export default class ViewerScenePage {
  protected readonly t = locale;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);
  private marketService = inject(MarketService);
  private shipService = inject(ShipService);
  private socketService = inject(SocketService);

  private navigationState: ViewerSceneNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as ViewerSceneNavigationState | undefined) ??
    (history.state as ViewerSceneNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected solarSystem = signal<SolarSystemSummary | null>(this.navigationState.solarSystem ?? null);
  protected solarSystemId = signal<string | null>(null);
  protected bodies = signal<ViewerBody[]>([]);
  protected ships = signal<ShipSummary[]>([]);
  protected hoveredBody = signal<ViewerBody | null>(null);
  protected focusedPlanet = signal<ViewerBody | null>(null);
  protected isLoading = signal(false);
  protected sceneError = signal<string | null>(null);
  protected isPlanetTransitioning = signal(false);
  protected zoomLevel = signal<number>(78);

  protected zoomPercent = computed<number>(() => Math.round(this.zoomLevel()));

  protected hasSystem = computed(() => this.solarSystemId() !== null);

  /** True when at least one ship in the active list has missing/invalid spatial state. */
  protected hasUnknownSpatialShip = computed<boolean>(() => this.ships().some((s) => !isValidShipSpatial(s.spatial)));

  /** Inputs forwarded to `<app-viewer-system-scene *canvasContent />`. */
  private viewerTargetService = inject(ViewerTargetService);

  protected sceneInputs = computed<ViewerSystemSceneInputs>(() => ({
    bodies: this.bodies(),
    summary: this.solarSystem(),
    targetBodyId: this.viewerTargetService.targetBodyId(),
    ships: this.ships(),
    activeShipId: this.sessionService.activeShip()?.id ?? null,
  }));


  private lastLoadedSystemId: string | null = null;
  private planetTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  private mergeUniqueBodies(bodies: ViewerBody[]): ViewerBody[] {
    const dedupedBodies: ViewerBody[] = [];
    const seenBodyIds = new Set<string>();
    for (const body of bodies) {
      if (seenBodyIds.has(body.id)) {
        continue;
      }
      seenBodyIds.add(body.id);
      dedupedBodies.push(body);
    }
    return dedupedBodies;
  }

  private toViewerMarketStationBody(market: MarketSummary): ViewerBody {
    const displayName = market.siteName?.trim() || market.marketName?.trim() || market.marketId;
    return {
      id: market.marketId,
      bodyType: 'station',
      stationKind: 'market',
      displayName,
      spatial: market.spatial,
      orbitalElements: market.trajectory?.orbit,
    };
  }

  private maybeHydrateMarketStations(
    baseBodies: ViewerBody[],
    playerName: string,
    sessionKey: string,
    solarSystemId: string,
  ): void {
    const hasStationBodies = baseBodies.some((body) => normalizeToken(body.bodyType) === 'station');
    if (hasStationBodies) {
      return;
    }

    const firstStar = baseBodies.find((body) => normalizeToken(body.bodyType) === 'star');
    const positionKm = firstStar?.spatial.positionKm ?? { x: 0, y: 0, z: 0 };

    const request: MarketListByLocationRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: VIEWER_MARKET_DISCOVERY_DISTANCE_AU,
      limit: VIEWER_MARKET_DISCOVERY_LIMIT,
      locationTypes: ['station', 'free-floating'],
    };

    this.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      if (!response.success || this.solarSystemId() !== solarSystemId) {
        return;
      }

      const marketStations = (response.markets ?? []).map((market) => this.toViewerMarketStationBody(market));
      if (marketStations.length === 0) {
        return;
      }

      const mergedBodies = this.mergeUniqueBodies([...this.bodies(), ...marketStations]);
      this.bodies.set(mergedBodies);
    });
  }

  ngOnInit(): void {
    // Subscribe to route param changes
    this.route.paramMap.subscribe(params => {
      const id = params.get('solarSystemId');
      this.solarSystemId.set(id);
      if (id) {
        this.loadSystem();
      }
    });
  }

  protected loadSystem(): void {
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey();
    const solarSystemId = this.solarSystemId();
    if (!playerName || !sessionKey || !solarSystemId) {
      this.sceneError.set(this.t.game.viewer.sceneErrorPrefix + ' missing-session');
      return;
    }
    // Prevent duplicate loads for the same system
    if (solarSystemId === this.lastLoadedSystemId) {
      return;
    }
    this.lastLoadedSystemId = solarSystemId;
    this.isLoading.set(true);
    this.sceneError.set(null);

    this.solarSystemService.getSolarSystem(
      { playerName, sessionKey, solarSystemId },
      (response: SolarSystemGetResponse) => {
        this.isLoading.set(false);
        if (!response.success) {
          this.sceneError.set(this.t.game.viewer.sceneErrorPrefix + ' ' + (response.message ?? 'unknown-error'));
          return;
        }
        if (response.solarSystem) {
          this.solarSystem.set(response.solarSystem);
        }
        const allBodies = [...(response.stars ?? []), ...(response.bodies ?? [])];
        const dedupedBodies = this.mergeUniqueBodies(allBodies);
        this.bodies.set(dedupedBodies);
        this.maybeHydrateMarketStations(dedupedBodies, playerName, sessionKey, solarSystemId);
        this.hoveredBody.set(null);
        this.focusedPlanet.set(null);
        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      },
    );
  }

  private loadShipsForSystem(playerName: string, sessionKey: string, solarSystemId: string): void {
    const character = this.sessionService.activeCharacter();
    if (!character?.id) {
      this.ships.set([]);
      return;
    }

    const request: ShipListRequest = {
      playerName,
      characterId: character.id,
      sessionKey,
    };

    this.shipService.listShips(request, (response: ShipListResponse) => {
      if (!response.success || this.solarSystemId() !== solarSystemId) {
        this.ships.set([]);
        return;
      }
      const allShips = response.ships ?? [];
      const systemShips = allShips.filter(
        (ship) => !ship.spatial || ship.spatial.solarSystemId === solarSystemId,
      );
      this.ships.set(systemShips);
      this.maybeRepairInvalidShipSpatial(playerName, sessionKey, solarSystemId, allShips);
    });
  }

  /**
   * If any ship for the active character has missing or sun-origin spatial, run
   * the deterministic starter-ship upsert again to give it a real asteroid-belt
   * position. Idempotent because the seed is derived from
   * `(playerName, characterId, shipId)`. Called after `loadShipsForSystem` so
   * legacy characters (or those whose initial upsert failed) self-heal on the
   * first viewer load.
   */
  private repairedShipIds = new Set<string>();
  private maybeRepairInvalidShipSpatial(
    playerName: string,
    sessionKey: string,
    solarSystemId: string,
    ships: ShipSummary[],
  ): void {
    const character = this.sessionService.activeCharacter();
    if (!character?.id) {
      return;
    }
    for (const ship of ships) {
      if (!ship?.id || isValidShipSpatial(ship.spatial)) {
        continue;
      }
      if (this.repairedShipIds.has(ship.id)) {
        continue;
      }
      this.repairedShipIds.add(ship.id);
      const update = generateDeterministicStarterShipUpdate(playerName, character.id, ship.id);
      const upsertRequest: ShipUpsertRequest = {
        playerName,
        characterId: character.id,
        sessionKey,
        ship: update,
      };
      appLogger.warn(
        `Repairing ship ${ship.id} with invalid spatial; re-running deterministic asteroid-belt upsert.`,
      );
      this.socketService.upsertShip(upsertRequest, (upsertResponse: ShipUpsertResponse) => {
        if (!upsertResponse.success) {
          appLogger.warn(`Ship spatial repair failed for ${ship.id}:`, upsertResponse.message);
          return;
        }
        if (this.solarSystemId() !== solarSystemId) {
          return;
        }
        // Refresh ship list so the viewer picks up the repaired spatial.
        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      });
    }
  }

  protected onHoveredBodyChange(body: ViewerBody | null): void {
    this.hoveredBody.set(body);
  }

  protected onFocusedPlanetChange(body: ViewerBody | null): void {
    this.focusedPlanet.set(body);
  }

  protected onPlanetViewRequest(body: ViewerBody): void {
    const solarSystemId = this.solarSystemId();
    if (!solarSystemId || this.isPlanetTransitioning()) {
      return;
    }

    this.isPlanetTransitioning.set(true);
    this.planetTransitionTimer = setTimeout(() => {
      this.router.navigate([{ outlets: { right: ['planet-view', solarSystemId, body.id] } }], {
        preserveFragment: true,
        state: {
          playerName: this.playerName(),
          solarSystem: this.solarSystem(),
          bodies: this.bodies(),
        },
      });
      this.planetTransitionTimer = null;
    }, 140);
  }

  protected onZoomChange(value: string | number): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.zoomLevel.set(Math.max(0, Math.min(100, parsed)));
  }

  protected onWheel(event: WheelEvent): void {
    if (!this.hasSystem()) {
      return;
    }

    event.preventDefault();

    // deltaMode 0 = pixels (~100 per notch), 1 = lines, 2 = pages.
    // Scroll up (negative deltaY) decreases zoom level → camera moves closer.
    const STEP_PER_LINE = 5;
    const delta = event.deltaMode === 0
      ? (event.deltaY / 100) * STEP_PER_LINE
      : event.deltaY * STEP_PER_LINE;

    this.onZoomChange(this.zoomLevel() + delta);
  }

  protected onZoomInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.onZoomChange(target.value);
  }

  protected onZoomContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomPointerDown(event: PointerEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomPointerUp(event: PointerEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomMouseDown(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomMouseUp(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  protected onZoomAuxClick(event: MouseEvent): void {
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  ngOnDestroy(): void {
    if (this.planetTransitionTimer) {
      clearTimeout(this.planetTransitionTimer);
      this.planetTransitionTimer = null;
    }
  }
}
