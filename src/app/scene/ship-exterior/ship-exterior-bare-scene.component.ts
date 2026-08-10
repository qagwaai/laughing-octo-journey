import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MarketService } from '../../services/market.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { FloatingDebrisStateService } from '../../services/floating-debris-state.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import { ShipExteriorViewStateService } from '../../services/ship-exterior-view-state.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { appLogger } from '../../services/logger';
import { environment } from '../../../environments/environment';
import {
  type MarketListByLocationRequest,
  type MarketListByLocationResponse,
} from '../../model/market-list';
import { ShipSummary } from '../../model/ship-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { DEFAULT_SOLAR_SYSTEM_ID, type CelestialBodyUpsertRequest } from '../../model/celestial-body-upsert';
import { ShipListByOwnerRequest } from '../../model/ship-list-by-owner';
import { resolveSensorArrayTargetLockHoldMs } from '../../model/item-tier-capabilities';
import { ShipSceneContext } from './ship-scene-context';
import { ShipExteriorInputAdapter } from './ship-exterior-input-adapter';
import { ShipExteriorLaunchController } from './ship-exterior-launch-controller';
import { FloatingDebrisController } from './floating-debris-controller';
import { ShipSceneRegistry } from './ship-scene-registry';
import { buildShipSceneContextKey, ShipSceneAsteroidSample, ShipSceneContextState } from './ship-scene-types';
import { collectShipExteriorRouteFeeds, type ShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';
import {
  formatShipExteriorRouteFeedSummary,
  type ShipExteriorRouteFeedCounts,
} from './ship-exterior-route-feed-summary';
import {
  createInitialMissionGateState,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import type { ShipExteriorMissionStateContext } from '../../services/ship-exterior-mission-state.service';
import type { ShipItem } from '../../model/ship-item';
import type {
  LaunchItemRequest,
  LaunchItemResponse,
  LaunchItemYieldedItem,
  LaunchItemYieldedMaterial,
} from '../../model/launch-item';
import {
  type ShipExteriorLegacyAsteroidSample,
  registerShipExteriorBareSceneTestApi,
  unregisterShipExteriorBareSceneTestApi,
} from './ship-exterior-bare-scene-test-api';
import { seedRouteFeedsWithDevStation } from './ship-exterior-dev-station-seed';

const ROUTE_FEED_DISCOVERY_DISTANCE_AU = 200;
const ROUTE_FEED_DISCOVERY_LIMIT = 250;

export function shouldToggleFlightModeFromKey(code: string, flightModeEnabled: boolean): boolean {
  return code === 'KeyF' || (code === 'Escape' && flightModeEnabled);
}

@Component({
  selector: 'app-ship-exterior-bare-scene',
  standalone: true,
  templateUrl: './ship-exterior-bare-scene.component.html',
  styleUrls: ['./ship-exterior-bare-scene.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorBareSceneComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly shipService = inject(ShipService);
  private readonly marketService = inject(MarketService);
  private readonly socketService = inject(SocketService);
  private readonly shipExteriorSocketService = inject(ShipExteriorSocketService);
  private readonly missionProgressSyncService = inject(MissionProgressSyncService);
  private readonly shipExteriorViewStateService = inject(ShipExteriorViewStateService);
  private readonly floatingDebrisStateService = inject(FloatingDebrisStateService);
  private readonly missionStateService = inject(ShipExteriorMissionStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  readonly contexts = signal<ShipSceneContext[]>([]);
  readonly activeContextKey = signal<string | null>(null);
  readonly contextKeys = computed(() => this.contexts().map((context) => context.contextKey));
  readonly activeStarfieldSignature = computed(() => {
    const key = this.activeContextKey();
    if (!key) {
      return null;
    }

    return this.registry.getContext(key)?.getStarfieldSignature() ?? null;
  });
  readonly activeFlightSnapshot = computed(() => {
    this.runtimeRevision();
    this.activeContextKey();
    return this.registry.getActiveContext()?.snapshotRuntime() ?? null;
  });
  readonly activeFlightStatusLine = computed(
    () => `FLIGHT // ${this.activeFlightSnapshot()?.flightModeEnabled ? 'ON' : 'OFF'}`,
  );
  readonly activeFlightCoordsLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'COORD KM // ---';
    }

    const location = snapshot.flightCurrentLocationKm;
    return `COORD KM // ${location.x.toFixed(2)}, ${location.y.toFixed(2)}, ${location.z.toFixed(2)}`;
  });
  readonly activeFlightSpeedLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'SPD // 0.00 km/s';
    }

    return `SPD // ${snapshot.flightSpeedKmPerSec.toFixed(2)} km/s`;
  });
  readonly activeFlightDirectionLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'VIEW // YAW 0.0° PITCH 0.0°';
    }

    const context = this.registry.getActiveContext();
    const flight = context?.getState().flight;
    const orientation = flight?.orientation ?? { yawRad: 0, pitchRad: 0 };
    return `VIEW // YAW ${(orientation.yawRad * 57.2958).toFixed(1)}° PITCH ${(orientation.pitchRad * 57.2958).toFixed(1)}°`;
  });
  readonly activeFlightMovementLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    if (!snapshot) {
      return 'MOVE // OFF';
    }

    const offset = snapshot.flightWorldOffset;
    return `MOVE // OFFSET(${offset.x.toFixed(2)},${offset.y.toFixed(2)},${offset.z.toFixed(2)})`;
  });
  readonly activeFlightFramePressureLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    return `FRAME PRESSURE // ${(snapshot?.renderedFrameCount ?? 0).toFixed(0)} FRAMES`;
  });
  readonly activeFlightQualityScalerLine = computed(() => {
    const snapshot = this.activeFlightSnapshot();
    return `QUALITY SCALER // ${snapshot?.isPaused ? 'PAUSED' : 'ACTIVE'}`;
  });
  readonly activeRouteFeedLine = computed(() => {
    this.runtimeRevision();
    this.activeContextKey();
    return formatShipExteriorRouteFeedSummary(this.getActiveRouteFeedCounts());
  });
  readonly activeAsteroidLine = computed(() => {
    const active = this.registry.getActiveContext();
    if (!active) {
      return 'ASTEROIDS // ---';
    }

    const samples = active.getAsteroidSamples();
    const targetedId = active.getTargetedAsteroidId() ?? 'none';
    const hoveredId = active.getHoveredAsteroidId() ?? 'none';
    return `ASTEROIDS // ${samples.length} / ${targetedId} / ${hoveredId} / ${active.getAsteroidLayoutSignature()}`;
  });
  readonly floatingDebrisItems = computed(() => this.floatingDebrisStateService.items());
  readonly objectiveMessage = computed(() => {
    this.runtimeRevision();
    this.activeContextKey();
    return this.getActiveMissionGateState()?.activeObjectiveText ?? 'Mission objectives complete. Await further directives.';
  });
  readonly selectedLaunchHotkey = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly launchQuestionAnswer = signal('');
  readonly activeLaunchToast = signal<{ message: string; tone: 'success' | 'error'; seed: number | null } | null>(
    null,
  );

  private readonly registry = new ShipSceneRegistry();
  private readonly floatingDebrisController = new FloatingDebrisController({
    socketService: this.shipExteriorSocketService,
    sessionService: this.sessionService,
    stateService: this.floatingDebrisStateService,
    getPlayerName: () => this.navigationPlayerName(),
    getCharacterId: () => this.navigationCharacterId(),
    getActiveShipId: () => this.registry.getActiveContext()?.getState().shipId ?? null,
    getCelestialBodyId: () => this.registry.getActiveContext()?.getState().shipId ?? null,
    getShipPositionKm: () => {
      const active = this.registry.getActiveContext();
      const state = active?.getState();
      return state?.flight?.currentLocationKm ?? state?.world?.shipPosition ?? null;
    },
    getSolarSystemId: () => DEFAULT_SOLAR_SYSTEM_ID,
  });
  private readonly inputAdapter = new ShipExteriorInputAdapter(
    {
      onWindowPointerDown: (event) => this.onWindowPointerDown(event),
      onWindowPointerUp: (event) => this.onWindowPointerUp(event),
      onWindowContextMenu: (event) => this.onWindowContextMenu(event),
      onWindowKeyDown: (event) => this.onWindowKeyDown(event),
      onWindowKeyUp: (event) => this.onWindowKeyUp(event),
      onWindowMouseMove: (event) => this.onWindowMouseMove(event),
      onSocketCorrelationWarning: (event) => this.onSocketCorrelationWarning(event),
      onPointerLockChange: () => this.onPointerLockChange(),
    },
    window,
    document,
  );
  readonly targetedAsteroidId = computed(() => {
    this.runtimeRevision();
    this.activeContextKey();
    return this.registry.getActiveContext()?.getTargetedAsteroidId() ?? null;
  });
  private readonly testTargetHoldCandidateId = signal<string | null>(null);
  private readonly testTargetHoldContextKey = signal<string | null>(null);
  private testTargetHoldTimeoutId: number | null = null;
  private readonly testInventoryRewards = signal<string[]>([]);
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;
  private hasBootstrappedContexts = false;
  private readonly runtimeRevision = signal(0);
  private readonly testHoverScanCandidateId = signal<string | null>(null);
  private readonly testHoverScanContextKey = signal<string | null>(null);
  private testHoverScanTimeoutId: number | null = null;
  private readonly floatingDebrisSync = effect(() => {
    this.activeContextKey();
    this.floatingDebrisItems();
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    active.setDebrisItems(this.floatingDebrisItems());
  });
  private readonly navigationPlayerName = signal<string>('unknown-player');
  private readonly navigationCharacterId = signal<string>('unknown-character');
  private readonly launchController = new ShipExteriorLaunchController({
    missionDefinition: resolveShipExteriorMission(FIRST_TARGET_MISSION_ID),
    getAsteroidSamples: () => this.getActiveAsteroidSamples(),
    getMissionGateState: () => this.getActiveMissionGateState(),
    setMissionGateState: (gateState) => this.setActiveMissionGateState(gateState),
    persistMissionGateState: (gateState) => {
      const active = this.registry.getActiveContext();
      if (active) {
        this.persistMissionGateState(active, gateState);
      }
    },
    enqueueMissionProgressUpsert: (item) => {
      void this.syncMissionProgressToBackend(item.gateState);
    },
    removeAsteroidSamples: (sampleIds) => this.removeAsteroidSamples(sampleIds),
    consumeLaunchedItem: (response) => this.consumeLaunchedItem(response),
    applyMaterialRewards: (materials) => this.applyMaterialRewards(materials),
    applyYieldedItems: (items) => this.applyYieldedItems(items),
    queuePostLaunchRefresh: () => this.queuePostLaunchRefresh(),
    setLaunchToast: (message, tone, seed) => this.activeLaunchToast.set({ message, tone, seed }),
    invokePluginHook: () => {},
    setLaunchSeedHint: (launchSeed) => this.setLaunchSeedHint(launchSeed),
  });

  ngOnInit(): void {
    this.resolveNavigationIdentity();
    this.bootstrapContexts();
    this.floatingDebrisController.start();
    this.inputAdapter.attach();
    this.registerTestApi();

    this.destroyRef.onDestroy(() => {
      this.inputAdapter.detach();
      unregisterShipExteriorBareSceneTestApi();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.attachVisibleCanvas();
    this.observeResize();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.clearHoverScanTimer();
    this.clearTestTargetHoldTimer();
    this.floatingDebrisController.stop();
    this.teardownAllContexts();
  }

  activateContext(contextKey: string): boolean {
    const activated = this.registry.activate(contextKey);
    if (!activated) {
      return false;
    }

    this.activeContextKey.set(contextKey);
    const activeState = this.registry.getActiveContext()?.getState();
    if (activeState) {
      this.shipExteriorViewStateService.saveCurrentContext({
        playerName: activeState.playerName,
        characterId: activeState.characterId,
        shipId: activeState.shipId,
      });
    }
    this.attachVisibleCanvas();
    this.logContextActivation(contextKey);
    this.bumpRuntimeRevision();
    this.floatingDebrisController.requestNearbyItems();
    return true;
  }

  toggleFlightMode(): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    active.toggleFlightMode();
    this.syncPointerLockForActiveContext(false);
    this.logContextActivation(active.contextKey);
    this.bumpRuntimeRevision();
  }

  setFlightInvertY(enabled: boolean): void {
    const active = this.registry.getActiveContext();
    active?.setFlightInvertY(enabled);
    this.bumpRuntimeRevision();
  }

  setFlightMouseSensitivityFromSliderValue(rawValue: number): void {
    const active = this.registry.getActiveContext();
    active?.setFlightMouseSensitivityFromSliderValue(rawValue);
    this.bumpRuntimeRevision();
  }

  private setActiveMissionGateState(gateState: ShipExteriorMissionGateState): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    active.setMissionGateState(gateState);
    this.persistMissionGateState(active, gateState);
    this.bumpRuntimeRevision();
  }

  selectFirstScannedIronTargetForTest(): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    const samples = active.getAsteroidSamples();
    const sample = samples.find(
      (candidate) => candidate.scanned && candidate.revealedMaterial?.material?.toLowerCase() === 'iron',
    );

    if (sample) {
      active.setTargetedAsteroidId(sample.id);
      this.bumpRuntimeRevision();
      return;
    }

    const first = samples[0];
    if (first) {
      active.setTargetedAsteroidId(first.id);
      this.bumpRuntimeRevision();
    }
  }

  snapshotActiveContext(): ReturnType<ShipSceneContext['snapshotRuntime']> {
    return this.registry.getActiveContext()?.snapshotRuntime() ?? null;
  }

  private readonly onSessionActiveShipChange = effect(() => {
    const activeShip = this.sessionService.activeShip();
    if (!activeShip?.id?.trim()) {
      return;
    }

    const playerName = this.navigationPlayerName();
    const characterId = this.navigationCharacterId();

    this.upsertContextFromShip(activeShip, playerName, characterId);
    const contextKey = buildShipSceneContextKey({
      playerName,
      characterId,
      shipId: activeShip.id,
    });

    this.activateContext(contextKey);
  });

  private readonly onSessionReset = effect(() => {
    if (!this.hasBootstrappedContexts) {
      return;
    }

    const activeShip = this.sessionService.activeShip();
    const activeCharacter = this.sessionService.activeCharacter();

    if (activeShip || activeCharacter) {
      return;
    }

    this.teardownAllContexts();
  });

  private bootstrapContexts(): void {
    const initialShip = this.sessionService.activeShip();
    const activeCharacterId = this.navigationCharacterId();
    const playerName = this.navigationPlayerName();

    if (initialShip) {
      this.upsertContextFromShip(initialShip, playerName, activeCharacterId);
    }

    const sessionKey = this.sessionService.getSessionKey();
    if (!sessionKey || !playerName || !activeCharacterId || activeCharacterId === 'unknown-character') {
      this.ensureFallbackContexts(playerName, activeCharacterId);
      this.activateFirstContextIfNeeded();
      return;
    }

    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: activeCharacterId,
      },
    };

    this.shipService.listShipsByOwner(request, (response) => {
      response.ships.forEach((ship) => this.upsertContextFromShip(ship, playerName, activeCharacterId));
      this.ensureFallbackContexts(playerName, activeCharacterId);
      this.syncContextsSignal();
      this.activateFirstContextIfNeeded();
      this.attachVisibleCanvas();
    });

    this.syncContextsSignal();
    this.activateFirstContextIfNeeded();
  }

  private resolveNavigationIdentity(): void {
    const navigationState = (this.router.getCurrentNavigation()?.extras.state ?? window.history.state) as
      | { playerName?: unknown; joinCharacter?: { id?: unknown } }
      | undefined;

    const playerName = typeof navigationState?.playerName === 'string' ? navigationState.playerName.trim() : '';
    const characterId =
      typeof navigationState?.joinCharacter?.id === 'string' ? navigationState.joinCharacter.id.trim() : '';

    this.navigationPlayerName.set(playerName || 'unknown-player');
    this.navigationCharacterId.set(
      characterId || this.sessionService.activeCharacter()?.id?.trim() || 'unknown-character',
    );

    this.shipExteriorViewStateService.saveCurrentContext({
      playerName: this.navigationPlayerName(),
      characterId: this.navigationCharacterId(),
      shipId: this.sessionService.activeShip()?.id?.trim() || 'unknown-ship',
    });
  }

  private onWindowPointerDown(event: PointerEvent): void {
    const active = this.registry.getActiveContext();
    if (active && !active.flightModeEnabled() && event.button === 0 && event.ctrlKey) {
      const hoveredId = active.getHoveredAsteroidId();
      if (hoveredId) {
        this.beginAsteroidTargetHold(hoveredId);
        event.preventDefault();
        return;
      }
    }

    this.syncPointerLockForActiveContext(true);
  }

  private onWindowPointerUp(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    if (this.testTargetHoldCandidateId()) {
      this.clearTestTargetHoldTimer();
    }
  }

  private onWindowContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private onWindowKeyDown(event: KeyboardEvent): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    if (shouldToggleFlightModeFromKey(event.code, active.flightModeEnabled())) {
      this.toggleFlightMode();
      event.preventDefault();
      return;
    }

    if (active.captureFlightMovementKey(event.code)) {
      event.preventDefault();
      return;
    }

    const hotkey = this.resolveLaunchHotkeyFromCode(event.code);
    if (hotkey !== null) {
      this.launchFromHotkey(hotkey);
      event.preventDefault();
    }
  }

  private onWindowKeyUp(event: KeyboardEvent): void {
    this.registry.getActiveContext()?.releaseFlightMovementKey(event.code);
  }

  private onWindowMouseMove(event: MouseEvent): void {
    const active = this.registry.getActiveContext();
    if (!active?.flightModeEnabled()) {
      const hoveredId = active?.updateHoveredAsteroidFromPointer(event.clientX, event.clientY) ?? null;
      this.syncAsteroidHoverScanFromHover(active?.contextKey ?? null, hoveredId);
      return;
    }

    active.applyFlightMouseMove(event.movementX, event.movementY);
  }

  private onSocketCorrelationWarning(_event: Event): void {}

  setSelectedLaunchHotkey(rawValue: string): void {
    const parsed = Number.parseInt(rawValue, 10);
    if (parsed >= 1 && parsed <= 5) {
      this.selectedLaunchHotkey.set(parsed as 1 | 2 | 3 | 4 | 5);
    }
  }

  setLaunchQuestionAnswer(rawValue: string): void {
    this.launchQuestionAnswer.set(rawValue);
  }

  submitLaunchFromControls(): void {
    const answer = this.launchQuestionAnswer().trim();
    if (!answer) {
      this.activeLaunchToast.set({
        message: 'Launch hold: answer the launch question before proceeding.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    this.launchFromHotkey(this.selectedLaunchHotkey());
  }

  private onPointerLockChange(): void {
    this.syncPointerLockForActiveContext(false);
    this.bumpRuntimeRevision();
  }

  private syncPointerLockForActiveContext(allowRequest: boolean): void {
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    const rendering = active.getRenderingState();
    if (!rendering) {
      return;
    }

    if (active.flightModeEnabled()) {
      if (!allowRequest) {
        return;
      }

      if (typeof rendering.canvas.requestPointerLock === 'function' && document.pointerLockElement !== rendering.canvas) {
        rendering.canvas.requestPointerLock();
      }
      return;
    }

    if (document.pointerLockElement === rendering.canvas && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
  }

  private resolveLaunchHotkeyFromCode(code: string): 1 | 2 | 3 | 4 | 5 | null {
    switch (code) {
      case 'Digit1':
        return 1;
      case 'Digit2':
        return 2;
      case 'Digit3':
        return 3;
      case 'Digit4':
        return 4;
      case 'Digit5':
        return 5;
      default:
        return null;
    }
  }

  private upsertContextFromShip(ship: ShipSummary, playerName: string, characterId: string): void {
    const shipId = ship.id?.trim();
    if (!shipId) {
      return;
    }

    const initialState: ShipSceneContextState = {
      playerName,
      characterId,
      shipId,
      world: {
        shipPosition: {
          x: ship.spatial?.positionKm?.x ?? 0,
          y: ship.spatial?.positionKm?.y ?? 0,
          z: ship.spatial?.positionKm?.z ?? 0,
        },
      },
    };

    const contextKey = buildShipSceneContextKey({ playerName, characterId, shipId });
    const context = this.registry.getOrCreateContext(contextKey, initialState);
    context.setState(initialState);
    this.ensureMissionGateStateForContext(context);
    this.ensureDevStationForContext(context, ship);
    this.ensureRouteFeedsForContext(contextKey, ship, playerName, characterId);
    this.syncContextsSignal();
  }

  private ensureDevStationForContext(context: ShipSceneContext, ship: ShipSummary): void {
    if (environment.production) {
      return;
    }

    const routeFeeds = context.getRouteFeeds();
    if (routeFeeds?.stations.length) {
      return;
    }

    const shipId = ship.id?.trim();
    const solarSystemId = ship.spatial?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID;
    const positionKm = ship.spatial?.positionKm ?? context.getState().world?.shipPosition;
    if (!shipId || !positionKm) {
      return;
    }

    context.setRouteFeeds(
      this.resolveRouteFeedsForContext(
        routeFeeds ?? {
          gates: [],
          stations: [],
          encounterShips: [],
        },
        shipId,
        solarSystemId,
        positionKm,
      ),
    );
  }

  private ensureRouteFeedsForContext(
    contextKey: string,
    ship: ShipSummary,
    playerName: string,
    characterId: string,
  ): void {
    const shipId = ship.id?.trim();
    const solarSystemId = ship.spatial?.solarSystemId?.trim() ?? '';
    const positionKm = ship.spatial?.positionKm;
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const context = this.registry.getContext(contextKey);
    if (!context) {
      return;
    }

    const currentRouteFeeds = context.getRouteFeeds();
    if (currentRouteFeeds && currentRouteFeeds.stations.length > 0) {
      return;
    }

    if (!shipId || !positionKm) {
      return;
    }

    if (!solarSystemId || !sessionKey || !playerName || !characterId) {
      if (!environment.production) {
        context.setRouteFeeds(
          this.resolveRouteFeedsForContext(
            currentRouteFeeds ?? {
              gates: [],
              stations: [],
              encounterShips: [],
            },
            shipId,
            solarSystemId || DEFAULT_SOLAR_SYSTEM_ID,
            positionKm,
          ),
        );
        this.bumpRuntimeRevision();
      }
      return;
    }

    const request: MarketListByLocationRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: ROUTE_FEED_DISCOVERY_DISTANCE_AU,
      limit: ROUTE_FEED_DISCOVERY_LIMIT,
      locationTypes: ['station', 'free-floating'],
      characterId,
      shipId,
    };

    this.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      const context = this.registry.getContext(contextKey);
      const contextShipId = context?.getState().shipId?.trim() ?? '';
      if (!context || contextShipId !== shipId) {
        return;
      }

      const currentRouteFeeds = context.getRouteFeeds();
      if (!response.success) {
        context.setRouteFeeds(
          this.resolveRouteFeedsForContext(
            currentRouteFeeds ?? {
              gates: [],
              stations: [],
              encounterShips: [],
            },
            shipId,
            solarSystemId,
            positionKm,
          ),
        );
        this.bumpRuntimeRevision();
        return;
      }

      context.setRouteFeeds(
        this.resolveRouteFeedsForContext(
          collectShipExteriorRouteFeeds(response.markets),
          shipId,
          solarSystemId,
          positionKm,
        ),
      );
      this.bumpRuntimeRevision();
    });
  }

  private getActiveRouteFeedCounts(): ShipExteriorRouteFeedCounts | null {
    return this.registry.getActiveContext()?.getRouteFeedCounts() ?? null;
  }

  private resolveRouteFeedsForContext(
    routeFeeds: ShipExteriorRouteFeeds,
    shipId: string,
    solarSystemId: string,
    positionKm: { x: number; y: number; z: number },
  ): ShipExteriorRouteFeeds {
    if (environment.production) {
      return routeFeeds;
    }

    return seedRouteFeedsWithDevStation(routeFeeds, {
      shipId,
      solarSystemId,
      positionKm,
    });
  }

  private ensureFallbackContexts(playerName: string, characterId: string): void {
    if (this.registry.getAllContexts().length >= 2) {
      return;
    }

    const fallbackIds = ['fallback-ship-a', 'fallback-ship-b'];
    for (const shipId of fallbackIds) {
      const contextKey = buildShipSceneContextKey({ playerName, characterId, shipId });
      const context = this.registry.getOrCreateContext(contextKey, {
        playerName,
        characterId,
        shipId,
        world: {
          shipPosition: { x: shipId.endsWith('a') ? -1 : 1.25, y: 0, z: 0 },
        },
      });
      this.ensureMissionGateStateForContext(context);
      if (!environment.production) {
        const shipPosition = context.getState().world?.shipPosition ?? { x: 0, y: 0, z: 0 };
        context.setRouteFeeds(
          this.resolveRouteFeedsForContext(
            {
              gates: [],
              stations: [],
              encounterShips: [],
            },
            shipId,
            DEFAULT_SOLAR_SYSTEM_ID,
            shipPosition,
          ),
        );
      }
    }

    this.syncContextsSignal();
  }

  private syncContextsSignal(): void {
    const contexts = this.registry.getAllContexts();
    this.contexts.set(contexts);
    if (contexts.length > 0) {
      this.hasBootstrappedContexts = true;
    }
  }

  private activateFirstContextIfNeeded(): void {
    if (this.activeContextKey()) {
      return;
    }

    const first = this.registry.getAllContexts()[0];
    if (!first) {
      return;
    }

    this.activateContext(first.contextKey);
  }

  private attachVisibleCanvas(): void {
    if (!this.viewReady) {
      return;
    }

    const host = this.canvasHost().nativeElement;
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    this.registry.getAllContexts().forEach((context) => {
      const rendering = context.getRenderingState();
      if (!rendering) {
        return;
      }

      if (!host.contains(rendering.canvas)) {
        host.appendChild(rendering.canvas);
      }

      rendering.canvas.style.display = context.contextKey === active.contextKey ? 'block' : 'none';
      if (context.contextKey === active.contextKey) {
        context.setViewport(host.clientWidth, host.clientHeight);
      }
    });

    if (!active.getRenderingState()) {
      const rendering = active.initializeRendering();
      host.appendChild(rendering.canvas);
      rendering.canvas.style.display = 'block';
      active.setViewport(host.clientWidth, host.clientHeight);
      active.resume();
    }
  }

  private observeResize(): void {
    const host = this.canvasHost().nativeElement;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      this.registry.getAllContexts().forEach((context) => context.setViewport(width, height));
    });

    this.resizeObserver.observe(host);
  }

  private startAnimationLoop(): void {
    const loop = () => {
      this.registry.enforceActivePauseInvariants();
      const active = this.registry.getActiveContext();
      active?.renderFrame();
      if (active) {
        this.bumpRuntimeRevision();
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private logContextActivation(contextKey: string): void {
    if (typeof console === 'undefined') {
      return;
    }

    const active = this.registry.getActiveContext();
    const state = active?.getState();
    const contextSummary = this.registry.getAllContexts().map((context) => ({
      contextKey: context.contextKey,
      shipId: context.getState().shipId,
      starfieldSignature: context.getStarfieldSignature(),
      paused: context.isPaused(),
      renderedFrameCount: context.getRenderedFrameCount(),
    }));

    console.log('[ship-exterior] active context switched', {
      contextKey,
      shipId: state?.shipId ?? null,
      playerName: state?.playerName ?? null,
      characterId: state?.characterId ?? null,
      totalContexts: this.registry.getAllContexts().length,
      activeStarfieldSignature: active?.getStarfieldSignature() ?? null,
      flightModeEnabled: active?.flightModeEnabled() ?? false,
      flightPointerLocked: active?.flightPointerLocked() ?? false,
      contexts: contextSummary,
    });
  }

  private teardownAllContexts(): void {
    this.registry.dispose();
    this.floatingDebrisStateService.clear();
    this.contexts.set([]);
    this.activeContextKey.set(null);
    this.hasBootstrappedContexts = false;

    if (!this.viewReady) {
      return;
    }

    const host = this.canvasHost().nativeElement;
    host.querySelectorAll('canvas.ship-scene-canvas').forEach((node) => node.remove());
  }

  private registerTestApi(): void {
    registerShipExteriorBareSceneTestApi({
      contextKeys: this.contextKeys,
      activeContextKey: this.activeContextKey.asReadonly(),
      activateContext: (contextKey: string) => this.activateContext(contextKey),
      snapshotActiveContext: () => this.registry.getActiveContext()?.snapshotRuntime() ?? null,
      toggleFlightMode: () => this.toggleFlightMode(),
      setFlightInvertY: (enabled: boolean) => this.setFlightInvertY(enabled),
      setFlightMouseSensitivityFromSliderValue: (rawValue: number) =>
        this.setFlightMouseSensitivityFromSliderValue(rawValue),
      getActiveRouteFeedCounts: () => this.getActiveRouteFeedCounts(),
      getMissionGateState: () => this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi(),
      resetMissionGateState: () => this.resetMissionGateStateForTest(),
      legacy: {
        getAsteroidSamples: () => this.getActiveAsteroidSamples(),
        beginAsteroidTargetHold: (sampleId: string) => this.beginAsteroidTargetHold(sampleId),
        unhoverAsteroid: (sampleId: string) => this.unhoverAsteroid(sampleId),
        getTargetHoldCandidateId: () => this.testTargetHoldCandidateId(),
        getMissionGateState: () => this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi(),
        resetMissionGateState: () => this.resetMissionGateStateForTest(),
        forceCompleteIronScan: (sampleId?: string) => this.forceCompleteIronScan(sampleId),
        forceTargetAsteroid: (sampleId: string) => this.forceTargetAsteroid(sampleId),
        getTargetedAsteroidId: () => this.registry.getActiveContext()?.getTargetedAsteroidId() ?? null,
        getHoveredAsteroidId: () => this.registry.getActiveContext()?.getHoveredAsteroidId() ?? null,
        launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => this.launchFromHotkey(hotkey),
        simulateDebrisCollection: (remainingDebrisCount?: number) => this.simulateDebrisCollection(remainingDebrisCount),
        simulateManufacture: (itemType: string) => this.simulateManufacture(itemType),
        simulateRepair: (repairKind: string) => this.simulateRepair(repairKind),
        getActiveShipInventoryItemTypes: () => this.getActiveShipInventoryItemTypes(),
        getActiveLaunchToast: () => this.activeLaunchToast(),
      },
    });
  }

  private resetMissionGateStateForTest(): ShipExteriorMissionGateState {
    const active = this.registry.getActiveContext();
    const resetState = this.createInitialMissionGateStateForTestApi(
      active?.getState().characterId?.trim() || this.navigationCharacterId().trim() || 'unknown-character',
    );
    if (active) {
      active.setMissionGateState(resetState);
      this.persistMissionGateState(active, resetState);
    }
    this.bumpRuntimeRevision();

    this.clearHoverScanTimer();
    this.clearTestTargetHoldTimer();
    this.testInventoryRewards.set([]);
    if (active) {
      const resetSamples = active.getAsteroidSamples().map((sample) => ({
        ...sample,
        scanned: false,
        scanProgress: 0,
        revealedMaterial: { material: 'Iron', rarity: 'Common' },
      }));
      active.setAsteroidSamples(resetSamples);
      active.setTargetedAsteroidId(null);
      this.bumpRuntimeRevision();
    }

    return resetState;
  }

  private beginAsteroidHoverScan(sampleId: string): boolean {
    const active = this.registry.getActiveContext();
    if (!active) {
      return false;
    }

    const sampleExists = active.getAsteroidSamples().some((sample) => sample.id === sampleId);
    if (!sampleExists) {
      return false;
    }

    this.clearHoverScanTimer();
    this.testHoverScanCandidateId.set(sampleId);
    this.testHoverScanContextKey.set(active.contextKey);
    this.testHoverScanTimeoutId = window.setTimeout(() => {
      if (this.testHoverScanCandidateId() === sampleId) {
        const contextKey = this.testHoverScanContextKey();
        if (contextKey) {
          this.forceCompleteIronScanInContext(contextKey, sampleId);
        }
      }
      this.clearHoverScanTimer();
    }, this.resolveHoverScanHoldMs());

    return true;
  }

  private clearHoverScanTimer(): void {
    if (this.testHoverScanTimeoutId !== null) {
      clearTimeout(this.testHoverScanTimeoutId);
      this.testHoverScanTimeoutId = null;
    }
    this.testHoverScanCandidateId.set(null);
    this.testHoverScanContextKey.set(null);
  }

  private syncAsteroidHoverScanFromHover(contextKey: string | null, hoveredAsteroidId: string | null): void {
    if (!contextKey) {
      this.clearHoverScanTimer();
      return;
    }

    if (!hoveredAsteroidId) {
      if (this.testHoverScanContextKey() === contextKey) {
        this.clearHoverScanTimer();
      }
      return;
    }

    if (
      this.testHoverScanContextKey() !== contextKey ||
      this.testHoverScanCandidateId() !== hoveredAsteroidId
    ) {
      this.beginAsteroidHoverScan(hoveredAsteroidId);
    }
  }

  private beginAsteroidTargetHold(sampleId: string): boolean {
    const active = this.registry.getActiveContext();
    if (!active) {
      return false;
    }

    const sampleExists = active.getAsteroidSamples().some((sample) => sample.id === sampleId);
    if (!sampleExists) {
      return false;
    }

    this.clearTestTargetHoldTimer();
    this.testTargetHoldCandidateId.set(sampleId);
    this.testTargetHoldContextKey.set(active.contextKey);
    active.setTargetHoldCandidateId(sampleId);
    this.testTargetHoldTimeoutId = window.setTimeout(() => {
      if (this.testTargetHoldCandidateId() === sampleId) {
        const contextKey = this.testTargetHoldContextKey();
        if (contextKey) {
          this.forceTargetAsteroidInContext(contextKey, sampleId);
        }
      }
      this.clearTestTargetHoldTimer();
    }, this.resolveTargetLockHoldMs());

    return true;
  }

  private unhoverAsteroid(sampleId: string): boolean {
    const activeContextKey = this.registry.getActiveContext()?.contextKey ?? null;
    if (
      this.testTargetHoldCandidateId() !== sampleId ||
      this.testTargetHoldContextKey() !== activeContextKey
    ) {
      return false;
    }

    this.clearTestTargetHoldTimer();
    return true;
  }

  private clearTestTargetHoldTimer(): void {
    if (this.testTargetHoldTimeoutId !== null) {
      clearTimeout(this.testTargetHoldTimeoutId);
      this.testTargetHoldTimeoutId = null;
    }
    this.registry.getActiveContext()?.setTargetHoldCandidateId(null);
    this.testTargetHoldCandidateId.set(null);
    this.testTargetHoldContextKey.set(null);
  }

  private resolveTargetLockHoldMs(): number {
    const activeShip = this.sessionService.activeShip();
    const sensorTier = this.resolveActiveSensorArrayTier(activeShip?.inventory ?? []);
    return resolveSensorArrayTargetLockHoldMs(sensorTier);
  }

  private resolveActiveSensorArrayTier(inventory: readonly ShipItem[]): number {
    let resolvedTier = 1;
    for (const item of inventory) {
      if (item.itemType !== 'sensor-array') {
        continue;
      }

      const tier = Number.isFinite(item.tier) && item.tier ? Math.trunc(item.tier) : 1;
      if (tier > resolvedTier) {
        resolvedTier = tier;
      }
    }

    return resolvedTier;
  }

  private resolveHoverScanHoldMs(): number {
    return 10_000;
  }

  private createInitialMissionGateStateForTestApi(characterId: string = this.navigationCharacterId().trim() || 'unknown-character'): ShipExteriorMissionGateState {
    return createInitialMissionGateState({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId,
      steps: resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).getGateStepDefinitions(),
    });
  }

  private getActiveMissionGateState(): ShipExteriorMissionGateState | null {
    return this.registry.getActiveContext()?.getMissionGateState() ?? null;
  }

  private buildMissionStateContext(state: { playerName: string; characterId: string; shipId: string }): ShipExteriorMissionStateContext | null {
    const playerName = state.playerName.trim();
    const characterId = state.characterId.trim();
    const shipId = state.shipId.trim();
    if (!playerName || !characterId || !shipId || characterId === 'unknown-character') {
      return null;
    }

    return {
      missionId: FIRST_TARGET_MISSION_ID,
      playerName,
      characterId,
      shipId,
    };
  }

  private ensureMissionGateStateForContext(context: ShipSceneContext): ShipExteriorMissionGateState {
    const existing = context.getMissionGateState();
    if (existing) {
      return existing;
    }

    const contextState = context.getState();
    const storageContext = this.buildMissionStateContext(contextState);
    const fromStorage = storageContext ? this.missionStateService.loadState(storageContext) : null;
    const nextState = fromStorage ?? this.createInitialMissionGateStateForTestApi(contextState.characterId);
    context.setMissionGateState(nextState);

    if (!fromStorage && storageContext) {
      this.missionStateService.saveState(storageContext, nextState);
    }

    this.bumpRuntimeRevision();
    return nextState;
  }

  private persistMissionGateState(context: ShipSceneContext, state: ShipExteriorMissionGateState): void {
    const storageContext = this.buildMissionStateContext(context.getState());
    if (!storageContext) {
      return;
    }

    this.missionStateService.saveState(storageContext, state);
  }

  private updateMissionGateState(
    updater: (state: ShipExteriorMissionGateState) => ShipExteriorMissionGateState,
  ): ShipExteriorMissionGateState {
    const active = this.registry.getActiveContext();
    if (!active) {
      return this.createInitialMissionGateStateForTestApi();
    }

    const currentState = this.ensureMissionGateStateForContext(active);
    const nextState = updater(currentState);
    active.setMissionGateState(nextState);
    this.persistMissionGateState(active, nextState);
    this.bumpRuntimeRevision();
    return nextState;
  }

  private setStepStatus(
    state: ShipExteriorMissionGateState,
    key: string,
    status: 'locked' | 'active' | 'completed' | 'pending-retry',
  ): ShipExteriorMissionGateState {
    return {
      ...state,
      updatedAt: new Date().toISOString(),
      steps: state.steps.map((step) =>
        step.key === key
          ? {
              ...step,
              status,
              completedAt: status === 'completed' ? step.completedAt ?? new Date().toISOString() : step.completedAt,
            }
          : step,
      ),
    };
  }

  private bumpRuntimeRevision(): void {
    this.runtimeRevision.update((value) => value + 1);
  }

  private getActiveAsteroidSamples(): ShipExteriorLegacyAsteroidSample[] {
    const samples = this.registry.getActiveContext()?.getAsteroidSamples() ?? [];
    return samples.map((sample) => ({
      ...sample,
      revealedMaterial: sample.revealedMaterial ? { ...sample.revealedMaterial } : undefined,
    }));
  }

  private forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null {
    const active = this.registry.getActiveContext();
    if (!active) {
      return null;
    }

    const targetId = sampleId ?? active.getAsteroidSamples()[0]?.id;
    if (!targetId) {
      return null;
    }

    let updatedSample: ShipSceneAsteroidSample | null = null;

    const nextSamples = active.getAsteroidSamples().map((sample) => {
      if (sample.id !== targetId) {
        return sample;
      }

      updatedSample = {
        ...sample,
        scanned: true,
        scanProgress: 100,
        revealedMaterial: { material: 'Iron', rarity: 'Common' },
      };
      return updatedSample;
    });
    active.setAsteroidSamples(nextSamples);
    this.bumpRuntimeRevision();

    if (!updatedSample) {
      return null;
    }

    return this.updateMissionGateState((state) => {
      const identifyCompleted = this.setStepStatus(state, 'identify_iron_asteroid', 'completed');
      const neutralizeActive = this.setStepStatus(identifyCompleted, 'neutralize_identified_asteroid', 'active');
      return {
        ...neutralizeActive,
        activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
      };
    });
  }

  private forceCompleteIronScanInContext(contextKey: string, sampleId: string): ShipExteriorMissionGateState | null {
    const context = this.registry.getContext(contextKey);
    if (!context) {
      return null;
    }

    const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
    if (!exists) {
      return null;
    }

    context.setTargetedAsteroidId(sampleId);
    context.setTargetHoldCandidateId(null);
    const nextSamples = context.getAsteroidSamples().map((sample) =>
      sample.id === sampleId
        ? {
            ...sample,
            scanned: true,
            scanProgress: 100,
            revealedMaterial: { material: 'Iron', rarity: 'Common' },
          }
        : sample,
    );
    context.setAsteroidSamples(nextSamples);
    this.bumpRuntimeRevision();
    return this.updateMissionGateState((state) => {
      const identifyCompleted = this.setStepStatus(state, 'identify_iron_asteroid', 'completed');
      const neutralizeActive = this.setStepStatus(identifyCompleted, 'neutralize_identified_asteroid', 'active');
      return {
        ...neutralizeActive,
        activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
      };
    });
  }

  private forceTargetAsteroid(sampleId: string): boolean {
    const active = this.registry.getActiveContext();
    if (!active) {
      return false;
    }

    return this.forceTargetAsteroidInContext(active.contextKey, sampleId);
  }

  private forceTargetAsteroidInContext(contextKey: string, sampleId: string): boolean {
    const context = this.registry.getContext(contextKey);
    if (!context) {
      return false;
    }

    const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
    if (!exists) {
      return false;
    }

    context.setTargetedAsteroidId(sampleId);
    context.setTargetHoldCandidateId(null);
    this.bumpRuntimeRevision();
    return true;
  }

  private launchFromHotkey(hotkey: 1 | 2 | 3 | 4 | 5): void {
    const activeShip = this.sessionService.activeShip();
    if (!activeShip) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: no active ship selected.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    const resolvedActiveShip: ShipSummary = activeShip;
    const launchableItems = resolvedActiveShip.inventory?.filter((item) => item.launchable === true) ?? [];
    if (launchableItems.length === 0) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: no launchable item available in active ship inventory.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    const selectedItem = launchableItems[hotkey - 1] ?? launchableItems[0];
    const active = this.registry.getActiveContext();
    const activeState = active?.getState();
    const resolvedPlayerName = activeState?.playerName?.trim() || this.navigationPlayerName();
    const resolvedCharacterId =
      activeState?.characterId?.trim() || this.sessionService.activeCharacter()?.id?.trim() || this.navigationCharacterId();

    const targetId = active?.getTargetedAsteroidId() ?? active?.getAsteroidSamples()[0]?.id ?? null;
    if (!targetId) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: no target selected.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    const targetSample = active?.getAsteroidSamples().find((sample) => sample.id === targetId) ?? null;
    if (!targetSample || !active || !activeState) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: selected target sample is unavailable.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    this.ensureLaunchTargetCelestialBodyId({
      contextKey: active.contextKey,
      sample: targetSample,
      playerName: resolvedPlayerName,
      characterId: resolvedCharacterId,
      onResolved: (launchTargetCelestialBodyId) => {
        const request: LaunchItemRequest = {
          playerName: resolvedPlayerName,
          characterId: resolvedCharacterId,
          shipId: resolvedActiveShip.id,
          sessionKey: this.sessionService.getSessionKey() ?? '',
          hotkey,
          itemId: selectedItem.id,
          itemType: selectedItem.itemType,
          targetCelestialBodyId: launchTargetCelestialBodyId,
          requestIdentity: {
            operation: 'launch-item',
            entityType: selectedItem.itemType,
            containerId: resolvedActiveShip.id,
            itemId: selectedItem.id,
            hotkey,
            targetCelestialBodyId: launchTargetCelestialBodyId,
            characterId: resolvedCharacterId,
          },
        };

        this.activeLaunchToast.set({
          message: `Launch queued for ${selectedItem.displayName ?? selectedItem.itemType}.`,
          tone: 'success',
          seed: null,
        });

        this.socketService.launchItem(request, (response) => {
          this.launchController.handleLaunchItemResponse(response);
        });
      },
    });
  }

  private ensureLaunchTargetCelestialBodyId(params: {
    contextKey: string;
    sample: ShipSceneAsteroidSample;
    playerName: string;
    characterId: string;
    onResolved: (targetCelestialBodyId: string) => void;
  }): void {
    const existingTargetId = params.sample.serverCelestialBodyId?.trim();
    if (existingTargetId) {
      params.onResolved(existingTargetId);
      return;
    }

    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const resolvedPlayerName = params.playerName.trim() || this.sessionService.getPlayerName()?.trim() || '';
    const resolvedCharacterId =
      params.characterId.trim() || this.sessionService.activeCharacter()?.id?.trim() || this.navigationCharacterId().trim();
    const hasPlaceholderIdentity =
      resolvedPlayerName === 'unknown-player' || resolvedCharacterId === 'unknown-character';

    if (!sessionKey || !resolvedPlayerName || !resolvedCharacterId || hasPlaceholderIdentity) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: missing session or character identity for target registration.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const requestedCelestialBodyId = `cb-${params.characterId}-${FIRST_TARGET_MISSION_ID}-${params.sample.id}`;
    const fallbackPositionKm = this.resolveFallbackTargetPositionKm(params.sample.id);
    const request: CelestialBodyUpsertRequest = {
      sessionKey,
      playerName: resolvedPlayerName,
      createdByCharacterId: resolvedCharacterId,
      celestialBody: {
        id: requestedCelestialBodyId,
        catalogId: `sol-${resolvedCharacterId}-${FIRST_TARGET_MISSION_ID}-${params.sample.id}`,
        sourceScanId: params.sample.id,
        createdByCharacterId: resolvedCharacterId,
        bodyType: 'asteroid',
        displayName: `Asteroid ${params.sample.id}`,
        missionId: FIRST_TARGET_MISSION_ID,
        createdAt: nowIso,
        updatedAt: nowIso,
        spatial: {
          solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
          frame: 'barycentric',
          positionKm: fallbackPositionKm,
          epochMs: Date.now(),
        },
        motion: {
          velocityKmPerSec: { x: 0, y: 0, z: 0 },
          angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
        },
        physical: {
          estimatedMassKg: 1_000_000_000,
          estimatedDiameterM: 120,
        },
        physicalCatalog: {
          estimatedMassKg: 1_000_000_000,
          estimatedDiameterM: 120,
          radiusKm: 0.06,
        },
        visualization: {
          colorHex: '#8f99a7',
          textureKey: null,
        },
        composition: params.sample.revealedMaterial
          ? {
              material: params.sample.revealedMaterial.material,
              rarity: params.sample.revealedMaterial.rarity as 'Common' | 'Uncommon' | 'Rare' | 'Exotic',
              textureColor: '#8f99a7',
            }
          : undefined,
        observability: {
          visibility: 'visible',
          scanState: params.sample.scanned ? 'scanned' : 'unscanned',
        },
        state: params.sample.scanned ? 'active' : 'unscanned',
      },
    };

    this.activeLaunchToast.set({
      message: 'Preparing target registration for launch...',
      tone: 'success',
      seed: null,
    });

    this.socketService.upsertCelestialBody(request, (response) => {
      if (!response.success) {
        this.activeLaunchToast.set({
          message: response.message || 'Target registration failed.',
          tone: 'error',
          seed: null,
        });
        return;
      }

      const persistedId = response.celestialBody?.id?.trim() || requestedCelestialBodyId;
      this.setAsteroidSampleServerCelestialBodyId(params.contextKey, params.sample.id, persistedId);
      params.onResolved(persistedId);
    });
  }

  private resolveFallbackTargetPositionKm(sampleId: string): { x: number; y: number; z: number } {
    const base = this.registry.getActiveContext()?.getState().world?.shipPosition ?? { x: 0, y: 0, z: 0 };
    const hash = sampleId
      .split('')
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
    const offset = (Math.abs(hash) % 1500) + 300;
    return {
      x: base.x + offset,
      y: base.y + Math.floor(offset / 3),
      z: base.z - Math.floor(offset / 2),
    };
  }

  private setAsteroidSampleServerCelestialBodyId(contextKey: string, sampleId: string, serverCelestialBodyId: string): void {
    const context = this.registry.getContext(contextKey);
    if (!context) {
      return;
    }

    const nextSamples = context.getAsteroidSamples().map((sample) =>
      sample.id === sampleId
        ? {
            ...sample,
            serverCelestialBodyId,
          }
        : sample,
    );
    context.setAsteroidSamples(nextSamples);
    this.bumpRuntimeRevision();
  }

  private consumeLaunchedItem(response: LaunchItemResponse): void {
    const activeShip = this.sessionService.activeShip();
    if (!activeShip || activeShip.id !== response.shipId) {
      return;
    }

    const nextInventory = (activeShip.inventory ?? []).filter((item) => item.id !== response.itemId);
    this.sessionService.setActiveShip({
      ...activeShip,
      inventory: nextInventory,
    });
  }

  private removeAsteroidSamples(sampleIds: readonly string[]): void {
    const active = this.registry.getActiveContext();
    if (!active || sampleIds.length === 0) {
      return;
    }

    const removedSampleIds = new Set(sampleIds);
    const nextSamples = active.getAsteroidSamples().filter((sample) => !removedSampleIds.has(sample.id));
    active.setAsteroidSamples(nextSamples);
    this.bumpRuntimeRevision();
  }

  private applyMaterialRewards(materials: readonly LaunchItemYieldedMaterial[]): void {
    if (materials.length === 0) {
      return;
    }

    const activeShip = this.sessionService.activeShip();
    if (activeShip) {
      const nowIso = new Date().toISOString();
      const ownerCharacterId = this.sessionService.activeCharacter()?.id?.trim() || this.navigationCharacterId().trim() || null;
      const rewardedInventoryItems: ShipItem[] = materials.flatMap((material) => {
        const normalizedItemType = material.material.trim().toLowerCase().replace(/[\s_]+/g, '-');
        const quantity = Number.isFinite(material.quantity) && material.quantity > 0 ? Math.floor(material.quantity) : 0;
        return Array.from({ length: quantity }, (_, index) => ({
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `reward-${Date.now()}-${normalizedItemType}-${index}`,
          itemType: normalizedItemType || 'unknown-material',
          displayName: `${material.material} (raw material)`,
          launchable: false,
          state: 'contained',
          damageStatus: 'intact',
          container: {
            containerType: 'ship',
            containerId: activeShip.id,
          },
          owningPlayerId: activeShip.ownership?.playerId ?? null,
          owningCharacterId: ownerCharacterId,
          spatial: null,
          destroyedAt: null,
          destroyedReason: null,
          discoveredAt: null,
          discoveredByCharacterId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
      });

      if (rewardedInventoryItems.length > 0) {
        this.sessionService.setActiveShip({
          ...activeShip,
          inventory: [...(activeShip.inventory ?? []), ...rewardedInventoryItems],
        });
        this.persistRewardItemsToBackend(rewardedInventoryItems);
      }
    }

    const rewardTypes = materials.flatMap((material) => Array.from({ length: material.quantity }, () => material.material.toLowerCase()));
    this.testInventoryRewards.update((types) => [...types, ...rewardTypes]);
  }

  private applyYieldedItems(items: readonly LaunchItemYieldedItem[]): void {
    if (items.length === 0) {
      return;
    }

    const activeShip = this.sessionService.activeShip();
    if (!activeShip) {
      return;
    }

    const yieldedInventoryItems: ShipItem[] = items.flatMap((item) => {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 0;
      if (quantity === 0) {
        return [];
      }
      const first: ShipItem = {
        id: item.id,
        itemType: item.itemType,
        displayName: item.displayName,
        launchable: item.launchable,
        state: item.state,
        damageStatus: 'intact',
        container: item.container
          ? {
              containerType: item.container.containerType,
              containerId: item.container.containerId,
            }
          : null,
        owningPlayerId: activeShip.ownership?.playerId ?? null,
        owningCharacterId: this.sessionService.activeCharacter()?.id ?? null,
        spatial: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const rest = Array.from({ length: quantity - 1 }, (_, index) => ({
        ...first,
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${item.id}-copy-${index + 1}`,
      }));
      return [first, ...rest];
    });

    if (yieldedInventoryItems.length === 0) {
      return;
    }

    this.sessionService.setActiveShip({
      ...activeShip,
      inventory: [...(activeShip.inventory ?? []), ...yieldedInventoryItems],
    });
    this.persistRewardItemsToBackend(yieldedInventoryItems);
  }

  private persistRewardItemsToBackend(items: readonly ShipItem[]): void {
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const playerName = this.navigationPlayerName().trim() || this.sessionService.getPlayerName()?.trim() || '';
    const characterId = this.navigationCharacterId().trim() || this.sessionService.activeCharacter()?.id?.trim() || '';
    const shipId = this.sessionService.activeShip()?.id?.trim() ?? '';
    if (!sessionKey || !playerName || !characterId || !shipId) {
      appLogger.warn('ShipExteriorBareSceneComponent.persistRewardItemsToBackend: skipped due to missing context', {
        hasSessionKey: !!sessionKey,
        hasPlayerName: !!playerName,
        hasCharacterId: !!characterId,
        hasShipId: !!shipId,
      });
      return;
    }

    items.forEach((item) => {
      this.socketService.upsertItem(
        {
          playerName,
          sessionKey,
          correlationSource: 'ship-exterior.launch-reward',
          item: {
            id: item.id,
            itemType: item.itemType,
            displayName: item.displayName,
            launchable: item.launchable,
            state: item.state,
            damageStatus: item.damageStatus,
            container: item.container ?? { containerType: 'ship', containerId: shipId },
            owningPlayerId: item.owningPlayerId ?? playerName,
            owningCharacterId: item.owningCharacterId ?? characterId,
          },
        },
        (response) => {
          if (!response.success || !response.item) {
            appLogger.warn('ShipExteriorBareSceneComponent.persistRewardItemsToBackend: reward item upsert failed', {
              message: response.message,
              itemId: item.id,
              itemType: item.itemType,
            });
          }
        },
      );
    });
  }

  private queuePostLaunchRefresh(): void {
    this.bumpRuntimeRevision();
  }

  private setLaunchSeedHint(_launchSeed: number | null): void {
    this.bumpRuntimeRevision();
  }

  private async syncMissionProgressToBackend(gateState: ShipExteriorMissionGateState): Promise<void> {
    await this.missionProgressSyncService.syncGateState({
      playerName: this.navigationPlayerName(),
      characterId: this.navigationCharacterId(),
      sessionKey: this.sessionService.getSessionKey() ?? '',
      gateState,
    });
  }

  private simulateDebrisCollection(_remainingDebrisCount?: number): ShipExteriorMissionGateState {
    return this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi();
  }

  private simulateManufacture(itemType: string): ShipExteriorMissionGateState {
    if (itemType !== 'hull-patch-kit') {
      return this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi();
    }

    const missionState = this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi();
    const manufactureStep = missionState.steps.find((step) => step.key === 'manufacture_hull_patch_kit');
    if (manufactureStep?.status !== 'active') {
      return missionState;
    }

    return this.updateMissionGateState((state) => {
      const manufactureCompleted = this.setStepStatus(state, 'manufacture_hull_patch_kit', 'completed');
      const repairActive = this.setStepStatus(manufactureCompleted, 'repair_scavenger_pod', 'active');
      return {
        ...repairActive,
        activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      };
    });
  }

  private simulateRepair(repairKind: string): ShipExteriorMissionGateState {
    if (repairKind !== 'ship') {
      return this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi();
    }

    const missionState = this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi();
    const repairStep = missionState.steps.find((step) => step.key === 'repair_scavenger_pod');
    if (repairStep?.status !== 'active') {
      return missionState;
    }

    return this.updateMissionGateState((state) => {
      const repairCompleted = this.setStepStatus(state, 'repair_scavenger_pod', 'completed');
      return {
        ...repairCompleted,
        activeObjectiveText: 'Mission objectives complete. Await further directives.',
      };
    });
  }

  private getActiveShipInventoryItemTypes(): string[] {
    const activeInventory = this.sessionService.activeShip()?.inventory ?? [];
    const baseTypes = activeInventory
      .map((item: ShipItem) => item.itemType)
      .filter((itemType: string): itemType is string => itemType.length > 0);

    return baseTypes;
  }
}
