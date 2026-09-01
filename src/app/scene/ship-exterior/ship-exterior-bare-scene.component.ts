/*
 * CHANGE ANCHOR GUIDE
 * - Search for "CHANGE ANCHOR:" in this file to jump between responsibility boundaries.
 * - Keep anchors on behavior boundaries instead of fixed line intervals.
 * - Use these markers as stable edit locators while the scene component is being split into smaller services/controllers.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AsteroidScanDetailPanel } from '../../component/asteroid-scan-detail-panel';
import { resolveMissionScenePlugin } from '../../mission/mission-scene-plugin';
import {
  createInitialMissionGateState,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import { resolveSensorArrayTargetLockHoldMs } from '../../model/item-tier-capabilities';
import type {
  LaunchItemRequest,
  LaunchItemResponse,
  LaunchItemYieldedItem,
  LaunchItemYieldedMaterial,
} from '../../model/launch-item';
import { type MarketListByLocationRequest, type MarketListByLocationResponse } from '../../model/market-list';
import { generateRandomAsteroidKinematics } from '../../model/math/asteroid-kinematics';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import type { ShipItem } from '../../model/ship-item';
import { ShipSummary } from '../../model/ship-list';
import { ShipListByOwnerRequest } from '../../model/ship-list-by-owner';
import { FloatingDebrisStateService } from '../../services/floating-debris-state.service';
import { MarketService } from '../../services/market.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { SessionService } from '../../services/session.service';
import type { ShipExteriorMissionStateContext } from '../../services/ship-exterior-mission-state.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import { ShipExteriorViewStateService } from '../../services/ship-exterior-view-state.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { AsteroidPersistenceService } from './asteroid-persistence.service';
import { AsteroidScanController } from './asteroid-scan-controller';
import { FloatingDebrisController } from './floating-debris-controller';
import { InventoryRewardService } from './inventory-reward.service';
import { MissionGateSimulator } from './mission-gate-simulator';
import { NavigationStateReader } from './navigation-state-reader';
import {
  registerShipExteriorBareSceneTestApi,
  unregisterShipExteriorBareSceneTestApi,
  type ShipExteriorLegacyAsteroidSample,
  type ShipExteriorLegacyScannableDebrisSample,
  type ShipExteriorLegacyScannableShipSample,
} from './ship-exterior-bare-scene-test-api';
import { ShipExteriorBootstrapController } from './ship-exterior-bootstrap-controller';
import {
  seedColdBootAsteroids as resolveColdBootAsteroidSamples,
  type ShipExteriorColdBootAsteroidSeedIntent,
} from './ship-exterior-cold-boot-asteroid-seed';
import { ShipExteriorInputAdapter } from './ship-exterior-input-adapter';
import { ShipExteriorLaunchController } from './ship-exterior-launch-controller';
import { collectShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';
import {
  formatShipExteriorRouteFeedSummary,
  type ShipExteriorRouteFeedCounts,
} from './ship-exterior-route-feed-summary';
import { ShipExteriorSessionController } from './ship-exterior-session-controller';
import { ShipSceneContext } from './ship-scene-context';
import { ShipSceneRegistry } from './ship-scene-registry';
import {
  buildShipSceneContextKey,
  ShipSceneAsteroidSample,
  ShipSceneContextState,
  ShipSceneHoverScanTarget,
  ShipSceneScannableDebrisSample,
  ShipSceneScannableShipSample,
} from './ship-scene-types';
const ROUTE_FEED_DISCOVERY_DISTANCE_AU = 200;
const ROUTE_FEED_DISCOVERY_LIMIT = 250;
type ShipExteriorScanDetail =
  | { kind: 'asteroid'; sample: ShipSceneAsteroidSample }
  | { kind: 'debris'; sample: ShipSceneScannableDebrisSample }
  | { kind: 'ship'; sample: ShipSceneScannableShipSample };

export function shouldToggleFlightModeFromKey(code: string, flightModeEnabled: boolean): boolean {
  return code === 'KeyF' || (code === 'Escape' && flightModeEnabled);
}

@Component({
  selector: 'app-ship-exterior-bare-scene',
  standalone: true,
  imports: [AsteroidScanDetailPanel],
  templateUrl: './ship-exterior-bare-scene.component.html',
  styleUrls: ['./ship-exterior-bare-scene.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorBareSceneComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly navigationStateReader = inject(NavigationStateReader);
  private readonly sessionService = inject(SessionService);
  private readonly shipService = inject(ShipService);
  private readonly marketService = inject(MarketService);
  private readonly socketService = inject(SocketService);
  private readonly asteroidPersistenceService = inject(AsteroidPersistenceService);
  private readonly inventoryRewardService = inject(InventoryRewardService);
  private readonly shipExteriorSocketService = inject(ShipExteriorSocketService);
  private readonly missionProgressSyncService = inject(MissionProgressSyncService);
  private readonly shipExteriorViewStateService = inject(ShipExteriorViewStateService);
  private readonly floatingDebrisStateService = inject(FloatingDebrisStateService);
  private readonly missionStateService = inject(ShipExteriorMissionStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionController = new ShipExteriorSessionController();

  readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  // CHANGE ANCHOR: reactive scene state
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
    this.flightRevision();
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
    this.flightRevision();
    this.activeContextKey();
    return formatShipExteriorRouteFeedSummary(this.getActiveRouteFeedCounts());
  });
  readonly activeAsteroidLine = computed(() => {
    this.asteroidRevision();
    this.activeContextKey();
    const active = this.registry.getActiveContext();
    if (!active) {
      return 'ASTEROIDS // ---';
    }

    const samples = active.getAsteroidSamples();
    const targetedId = active.getTargetedAsteroidId() ?? 'none';
    const hoveredId = active.getHoveredAsteroidId() ?? 'none';
    return `ASTEROIDS // ${samples.length} / ${targetedId} / ${hoveredId} / ${active.getAsteroidLayoutSignature()}`;
  });
  readonly activeScanDetailSample = computed<ShipExteriorScanDetail | null>(() => {
    this.asteroidRevision();
    this.activeContextKey();
    const active = this.registry.getActiveContext();
    if (!active) {
      return null;
    }

    const hoveredId = active.getHoveredAsteroidId();
    if (hoveredId) {
      const sample = active.getAsteroidSamples().find((s) => s.id === hoveredId);
      if (sample?.scanned) {
        return { kind: 'asteroid', sample };
      }
    }

    const hoveredDebrisId = active.getHoveredScannableDebrisId();
    if (hoveredDebrisId) {
      const hoveredDebris = active.getScannableDebrisSamples().find((sample) => sample.id === hoveredDebrisId);
      if (hoveredDebris?.scanned) {
        return { kind: 'debris', sample: hoveredDebris };
      }
    }

    const hoveredShipId = active.getHoveredScannableShipId();
    if (!hoveredShipId) {
      return null;
    }
    const hoveredShip = active.getScannableShipSamples().find((sample) => sample.id === hoveredShipId);
    return hoveredShip?.scanned ? { kind: 'ship', sample: hoveredShip } : null;
  });
  readonly floatingDebrisItems = computed(() => this.floatingDebrisStateService.items());
  readonly objectiveMessage = computed(() => {
    this.missionRevision();
    this.activeContextKey();
    return (
      this.getActiveMissionGateState()?.activeObjectiveText ?? 'Mission objectives complete. Await further directives.'
    );
  });
  readonly selectedLaunchHotkey = signal<1 | 2 | 3 | 4 | 5>(1);
  readonly launchQuestionAnswer = signal('');
  readonly activeLaunchToast = signal<{ message: string; tone: 'success' | 'error'; seed: number | null } | null>(null);

  // CHANGE ANCHOR: scene registry and bootstrap controllers
  private readonly registry = new ShipSceneRegistry();
  private readonly missionScenePlugin = resolveMissionScenePlugin(FIRST_TARGET_MISSION_ID);
  private readonly pendingColdBootAsteroidSeedIntent = signal<ShipExteriorColdBootAsteroidSeedIntent | null>(null);
  private readonly bootstrapController = new ShipExteriorBootstrapController({
    missionId: FIRST_TARGET_MISSION_ID,
    sessionService: this.sessionService,
    socketService: this.shipExteriorSocketService,
    getPlayerName: () => this.navigationPlayerName().trim() || 'unknown-player',
    getCharacterId: () =>
      this.navigationCharacterId().trim() || this.sessionService.activeCharacter()?.id?.trim() || 'unknown-character',
    getPreferredShipId: () => this.sessionService.activeShip()?.id?.trim() ?? null,
    getLaunchSeedHint: () => null,
    updateTargetingCapabilityFromShipList: () => undefined,
    emitColdBootAsteroidSeedIntent: (intent) => {
      this.pendingColdBootAsteroidSeedIntent.set(intent);
    },
  });
  private readonly coldBootAsteroidSeedEffect = effect(() => {
    this.activeContextKey();
    // Re-evaluate whenever the context list changes so a seed intent that
    // arrives before any scene context exists (e.g. on a hard refresh, while
    // ship/session data is still loading) is retried once a context appears
    // instead of being silently dropped.
    this.contexts();
    const intent = this.pendingColdBootAsteroidSeedIntent();
    if (!intent) {
      return;
    }

    this.applyPendingColdBootAsteroidSeedIntent(intent);
  });
  private readonly floatingDebrisController = new FloatingDebrisController({
    socketService: this.shipExteriorSocketService,
    sessionService: this.sessionService,
    stateService: this.floatingDebrisStateService,
    onItemsChanged: (items) => this.registry.getActiveContext()?.setDebrisItems(items),
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
    this.asteroidRevision();
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
  private readonly flightRevision = signal(0);
  private readonly asteroidRevision = signal(0);
  private readonly missionRevision = signal(0);
  // CHANGE ANCHOR: mission gate simulator
  private readonly asteroidScanController = new AsteroidScanController({
    getActiveContext: () => {
      const active = this.registry.getActiveContext();
      if (!active) {
        return null;
      }
      return {
        contextKey: active.contextKey,
        getScannableSamples: () => active.getAsteroidSamples(),
      };
    },
    getContext: (contextKey) => {
      const context = this.registry.getContext(contextKey);
      if (!context) {
        return null;
      }
      return {
        contextKey: context.contextKey,
        getScannableSamples: () => context.getAsteroidSamples(),
      };
    },
    onScanComplete: (contextKey, sampleId) => this.forceCompleteIronScanInContext(contextKey, sampleId),
    resolveHoldMs: () => this.resolveHoverScanHoldMs(),
  });
  private readonly shipScanController = new AsteroidScanController({
    getActiveContext: () => {
      const active = this.registry.getActiveContext();
      if (!active) {
        return null;
      }
      return {
        contextKey: active.contextKey,
        getScannableSamples: () => active.getScannableShipSamples(),
      };
    },
    getContext: (contextKey) => {
      const context = this.registry.getContext(contextKey);
      if (!context) {
        return null;
      }
      return {
        contextKey: context.contextKey,
        getScannableSamples: () => context.getScannableShipSamples(),
      };
    },
    onScanComplete: (contextKey, sampleId) => this.forceCompleteShipScanInContext(contextKey, sampleId),
    resolveHoldMs: () => this.resolveHoverScanHoldMs(),
  });
  private readonly debrisScanController = new AsteroidScanController({
    getActiveContext: () => {
      const active = this.registry.getActiveContext();
      if (!active) {
        return null;
      }
      return {
        contextKey: active.contextKey,
        getScannableSamples: () => active.getScannableDebrisSamples(),
      };
    },
    getContext: (contextKey) => {
      const context = this.registry.getContext(contextKey);
      if (!context) {
        return null;
      }
      return {
        contextKey: context.contextKey,
        getScannableSamples: () => context.getScannableDebrisSamples(),
      };
    },
    onScanComplete: (contextKey, sampleId) => this.forceCompleteDebrisScanInContext(contextKey, sampleId),
    resolveHoldMs: () => this.resolveHoverScanHoldMs(),
  });
  private readonly missionGateSimulator = new MissionGateSimulator({
    createInitialState: (characterId) => this.createInitialMissionGateStateForTestApi(characterId),
    getCurrentState: () => this.getActiveMissionGateState(),
    setState: (state) => {
      const active = this.registry.getActiveContext();
      if (active) {
        active.setMissionGateState(state);
      }
    },
    persistState: (state) => {
      const active = this.registry.getActiveContext();
      if (active) {
        this.persistMissionGateState(active, state);
      }
    },
    refreshView: () => this.bumpMissionRevision(),
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

  // CHANGE ANCHOR: lifecycle and bootstrap wiring
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
    this.asteroidScanController.dispose();
    this.shipScanController.dispose();
    this.debrisScanController.dispose();
    this.sessionController.dispose();
    this.bootstrapController.dispose();
    this.floatingDebrisController.stop();
    this.teardownAllContexts();
  }

  activateContext(contextKey: string): boolean {
    const activated = this.registry.activate(contextKey);
    if (!activated) {
      return false;
    }

    this.registry.getAllContexts().forEach((context) => context.setTargetHoldCandidateId(null));
    this.sessionController.clearTargetHoldTimer();
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

    const contextKey = buildShipSceneContextKey({
      playerName,
      characterId,
      shipId: activeShip.id,
    });

    this.upsertContextFromShip(activeShip, playerName, characterId);
    this.activateContext(contextKey);

    // A ship switch (e.g. "View External" from the hangar) reuses the same
    // routed component instance, so ngOnInit's one-time asteroid seeding never
    // re-runs. bootstrapContexts() eagerly creates a context for every owned
    // ship up front (via listShipsByOwner) but only seeds asteroids for the
    // ship that was active at that moment, so any other owned ship's context
    // starts out empty. Reseed here whenever the activated context has no
    // asteroid samples yet, regardless of whether the context is brand new.
    const activatedContext = this.registry.getContext(contextKey);
    if (activatedContext && activatedContext.getAsteroidSamples().length === 0) {
      this.seedColdBootAsteroids();
    }
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

    this.seedColdBootAsteroids();

    const sessionKey = this.sessionService.getSessionKey();
    if (!sessionKey || !playerName || !activeCharacterId || activeCharacterId === 'unknown-character') {
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
      this.syncContextsSignal();
      this.activateFirstContextIfNeeded();
      this.attachVisibleCanvas();
    });

    this.syncContextsSignal();
    this.activateFirstContextIfNeeded();
  }

  private seedColdBootAsteroids(): void {
    this.bootstrapController.seedAsteroidsForInProgressMission();
  }

  private resolveSeedTargetContext(): ShipSceneContext | null {
    const active = this.registry.getActiveContext();
    if (active) {
      return active;
    }

    const preferredShipId = this.sessionService.activeShip()?.id?.trim() ?? null;
    if (preferredShipId) {
      const shipMatch = this.registry
        .getAllContexts()
        .find((context) => (context.getState().shipId ?? '').trim() === preferredShipId);
      if (shipMatch) {
        return shipMatch;
      }
    }

    return this.registry.getAllContexts()[0] ?? null;
  }

  private applyPendingColdBootAsteroidSeedIntent(intent: ShipExteriorColdBootAsteroidSeedIntent): void {
    const targetContext = this.resolveSeedTargetContext();
    if (!targetContext) {
      // Keep the intent pending: no scene context exists yet (e.g. ship/session
      // data is still loading after a hard refresh). The effect re-runs when
      // contexts() changes, so the intent will be applied once a context exists
      // instead of being dropped.
      return;
    }

    const samples = resolveColdBootAsteroidSamples(intent, this.missionScenePlugin.seedPolicy);
    targetContext.setAsteroidSamples(samples);
    this.activateContext(targetContext.contextKey);
    if (intent.kind !== 'fallback') {
      this.asteroidPersistenceService.persistSeededAsteroidsAsUnscanned(samples, intent);
    }
    this.pendingColdBootAsteroidSeedIntent.set(null);
    this.bumpAsteroidRevision();
  }

  private resolveNavigationIdentity(): void {
    const { playerName, characterId } = this.navigationStateReader.resolve(this.router);

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
    if (active && !active.flightModeEnabled() && event.button === 2) {
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
    if (event.button !== 2) {
      return;
    }

    this.clearTestTargetHoldTimer();
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
      const prevHoveredAsteroidId = active?.getHoveredAsteroidId() ?? null;
      const prevHoveredDebrisId = active?.getHoveredScannableDebrisId() ?? null;
      const prevHoveredShipId = active?.getHoveredScannableShipId() ?? null;
      const hoveredTarget = active?.updateHoveredScanTargetFromPointer(event.clientX, event.clientY) ?? null;
      this.syncHoverScanFromHover(active?.contextKey ?? null, hoveredTarget);
      if (
        active?.getHoveredAsteroidId() !== prevHoveredAsteroidId ||
        active?.getHoveredScannableDebrisId() !== prevHoveredDebrisId ||
        active?.getHoveredScannableShipId() !== prevHoveredShipId
      ) {
        this.bumpAsteroidRevision();
      }
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
    this.bumpFlightRevision();
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

      if (
        typeof rendering.canvas.requestPointerLock === 'function' &&
        document.pointerLockElement !== rendering.canvas
      ) {
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
    this.ensureRouteFeedsForContext(contextKey, ship, playerName, characterId);
    this.syncContextsSignal();
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

      if (!response.success) {
        this.bumpRuntimeRevision();
        return;
      }

      context.setRouteFeeds(collectShipExteriorRouteFeeds(response.markets));
      this.bumpRuntimeRevision();
    });
  }

  private getActiveRouteFeedCounts(): ShipExteriorRouteFeedCounts | null {
    return this.registry.getActiveContext()?.getRouteFeedCounts() ?? null;
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
        getScannableDebrisSamples: () => this.getActiveScannableDebrisSamples(),
        getScannableShipSamples: () => this.getActiveScannableShipSamples(),
        beginAsteroidTargetHold: (sampleId: string) => this.beginAsteroidTargetHold(sampleId),
        unhoverAsteroid: (sampleId: string) => this.unhoverAsteroid(sampleId),
        getTargetHoldCandidateId: () => this.testTargetHoldCandidateId(),
        getMissionGateState: () => this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi(),
        resetMissionGateState: () => this.resetMissionGateStateForTest(),
        forceCompleteIronScan: (sampleId?: string) => this.forceCompleteIronScan(sampleId),
        forceTargetAsteroid: (sampleId: string) => this.forceTargetAsteroid(sampleId),
        getTargetedAsteroidId: () => this.registry.getActiveContext()?.getTargetedAsteroidId() ?? null,
        getHoveredAsteroidId: () => this.registry.getActiveContext()?.getHoveredAsteroidId() ?? null,
        forceCompleteDebrisScan: (sampleId?: string) => this.forceCompleteDebrisScan(sampleId),
        getHoveredScannableDebrisId: () => this.registry.getActiveContext()?.getHoveredScannableDebrisId() ?? null,
        forceCompleteShipScan: (sampleId?: string) => this.forceCompleteShipScan(sampleId),
        getHoveredScannableShipId: () => this.registry.getActiveContext()?.getHoveredScannableShipId() ?? null,
        launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => this.launchFromHotkey(hotkey),
        simulateDebrisCollection: (remainingDebrisCount?: number) =>
          this.simulateDebrisCollection(remainingDebrisCount),
        simulateManufacture: (itemType: string) => this.simulateManufacture(itemType),
        simulateRepair: (repairKind: string) => this.simulateRepair(repairKind),
        getActiveShipInventoryItemTypes: () => this.getActiveShipInventoryItemTypes(),
        getActiveLaunchToast: () => this.activeLaunchToast(),
      },
    });
  }

  private resetMissionGateStateForTest(): ShipExteriorMissionGateState {
    const active = this.registry.getActiveContext();
    const resetState = this.missionGateSimulator.resetForTest(
      active?.getState().characterId?.trim() || this.navigationCharacterId().trim() || 'unknown-character',
    );
    this.bumpRuntimeRevision();

    this.clearHoverScanTimer();
    this.clearTestTargetHoldTimer();
    this.testInventoryRewards.set([]);
    if (active) {
      const resetSamples = active.getAsteroidSamples().map((sample) => ({
        ...sample,
        scanned: false,
        scanProgress: 0,
        revealedKinematics: null,
      }));
      const resetScannableShips = active.getScannableShipSamples().map((sample) => ({
        ...sample,
        scanned: false,
        scanProgress: 0,
      }));
      const resetScannableDebris = active.getScannableDebrisSamples().map((sample) => ({
        ...sample,
        scanned: false,
        scanProgress: 0,
      }));
      active.setAsteroidSamples(resetSamples);
      active.setScannableDebrisSamples(resetScannableDebris);
      active.setScannableShipSamples(resetScannableShips);
      active.setTargetedAsteroidId(null);
      this.bumpRuntimeRevision();
    }

    return resetState;
  }

  // CHANGE ANCHOR: hover timer cleanup
  private clearHoverScanTimer(): void {
    this.asteroidScanController.clearHoverScanTimer();
    this.debrisScanController.clearHoverScanTimer();
    this.shipScanController.clearHoverScanTimer();
  }

  // CHANGE ANCHOR: hover-to-scan synchronization
  private syncHoverScanFromHover(contextKey: string | null, hoveredTarget: ShipSceneHoverScanTarget | null): void {
    if (!contextKey) {
      this.clearHoverScanTimer();
      this.clearTestTargetHoldTimer();
      return;
    }

    if (!hoveredTarget) {
      this.clearHoverScanTimer();
      if (this.registry.getActiveContext()?.contextKey === contextKey) {
        this.clearTestTargetHoldTimer();
      }
      return;
    }

    if (hoveredTarget.kind === 'asteroid') {
      this.debrisScanController.clearHoverScanTimer();
      this.shipScanController.clearHoverScanTimer();
      this.asteroidScanController.syncFromHover(contextKey, hoveredTarget.id);
      return;
    }

    if (hoveredTarget.kind === 'debris') {
      this.clearTestTargetHoldTimer();
      this.asteroidScanController.clearHoverScanTimer();
      this.shipScanController.clearHoverScanTimer();
      this.debrisScanController.syncFromHover(contextKey, hoveredTarget.id);
      return;
    }

    this.clearTestTargetHoldTimer();
    this.asteroidScanController.clearHoverScanTimer();
    this.debrisScanController.clearHoverScanTimer();
    this.shipScanController.syncFromHover(contextKey, hoveredTarget.id);
  }

  // CHANGE ANCHOR: target hold and sensor array behavior
  private beginAsteroidTargetHold(sampleId: string): boolean {
    const active = this.registry.getActiveContext();

    if (!active) {
      return false;
    }

    const sampleExists = active.getAsteroidSamples().some((sample) => sample.id === sampleId);
    if (!sampleExists) {
      return false;
    }

    if (!this.hasActiveSensorArrayCapability()) {
      this.activeLaunchToast.set({
        message: 'Target lock unavailable: the active ship requires a sensor array.',
        tone: 'error',
        seed: null,
      });
      this.clearTestTargetHoldTimer();
      return false;
    }

    this.clearTestTargetHoldTimer();
    this.testTargetHoldCandidateId.set(sampleId);
    this.testTargetHoldContextKey.set(active.contextKey);
    active.setTargetHoldCandidateId(sampleId);
    const holdMs = this.resolveTargetLockHoldMs();

    this.sessionController.beginTargetHold(
      sampleId,
      () => {
        const contextKey = this.testTargetHoldContextKey();

        if (contextKey) {
          this.forceTargetAsteroidInContext(contextKey, sampleId);
        }
        this.clearTestTargetHoldTimer();
      },
      holdMs,
    );

    return true;
  }

  private unhoverAsteroid(sampleId: string): boolean {
    const activeContextKey = this.registry.getActiveContext()?.contextKey ?? null;
    if (this.testTargetHoldCandidateId() !== sampleId || this.testTargetHoldContextKey() !== activeContextKey) {
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
    this.sessionController.clearTargetHoldTimer();
    this.registry.getActiveContext()?.setTargetHoldCandidateId(null);
    this.testTargetHoldCandidateId.set(null);
    this.testTargetHoldContextKey.set(null);
  }

  private hasActiveSensorArrayCapability(): boolean {
    const activeShip = this.sessionService.activeShip();
    return (activeShip?.inventory ?? []).some((item) => item.itemType === 'sensor-array');
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

  private createInitialMissionGateStateForTestApi(
    characterId: string = this.navigationCharacterId().trim() || 'unknown-character',
  ): ShipExteriorMissionGateState {
    return createInitialMissionGateState({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId,
      steps: resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).getGateStepDefinitions(),
    });
  }

  private getActiveMissionGateState(): ShipExteriorMissionGateState | null {
    return this.registry.getActiveContext()?.getMissionGateState() ?? null;
  }

  private buildMissionStateContext(state: {
    playerName: string;
    characterId: string;
    shipId: string;
  }): ShipExteriorMissionStateContext | null {
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

    this.bumpMissionRevision();
    return nextState;
  }

  private persistMissionGateState(context: ShipSceneContext, state: ShipExteriorMissionGateState): void {
    const storageContext = this.buildMissionStateContext(context.getState());
    if (!storageContext) {
      return;
    }

    this.missionStateService.saveState(storageContext, state);
  }

  // CHANGE ANCHOR: mission gate state updates
  private updateMissionGateState(
    updater: (state: ShipExteriorMissionGateState) => ShipExteriorMissionGateState,
  ): ShipExteriorMissionGateState {
    const active = this.registry.getActiveContext();
    if (!active) {
      return this.missionGateSimulator.resetForTest();
    }

    this.ensureMissionGateStateForContext(active);
    return this.missionGateSimulator.updateState(updater);
  }

  private setStepStatus(
    state: ShipExteriorMissionGateState,
    key: string,
    status: 'locked' | 'active' | 'completed' | 'pending-retry',
  ): ShipExteriorMissionGateState {
    return MissionGateSimulator.setStepStatus(state, key, status);
  }

  private bumpFlightRevision(): void {
    this.flightRevision.update((value) => value + 1);
  }

  private bumpAsteroidRevision(): void {
    this.asteroidRevision.update((value) => value + 1);
  }

  private bumpMissionRevision(): void {
    this.missionRevision.update((value) => value + 1);
  }

  private bumpRuntimeRevision(): void {
    this.bumpFlightRevision();
    this.bumpAsteroidRevision();
    this.bumpMissionRevision();
  }

  private getActiveAsteroidSamples(): ShipExteriorLegacyAsteroidSample[] {
    const samples = this.registry.getActiveContext()?.getAsteroidSamples() ?? [];
    return samples.map((sample) => ({
      ...sample,
      revealedMaterial: sample.revealedMaterial ? { ...sample.revealedMaterial } : undefined,
    }));
  }

  private getActiveScannableShipSamples(): ShipExteriorLegacyScannableShipSample[] {
    const samples = this.registry.getActiveContext()?.getScannableShipSamples() ?? [];
    return samples.map((sample) => ({
      ...sample,
      modelAssetPath: sample.modelAssetPath ?? null,
    }));
  }

  private getActiveScannableDebrisSamples(): ShipExteriorLegacyScannableDebrisSample[] {
    const samples = this.registry.getActiveContext()?.getScannableDebrisSamples() ?? [];
    return samples.map((sample) => ({
      ...sample,
    }));
  }

  private ensureContextAsteroidSamplesForMissionProgress(
    context: ShipSceneContext,
  ): readonly ShipSceneAsteroidSample[] {
    const existing = context.getAsteroidSamples();
    if (existing.length > 0) {
      return existing;
    }

    const fallbackSamples = resolveColdBootAsteroidSamples({ kind: 'fallback' }, this.missionScenePlugin.seedPolicy);
    context.setAsteroidSamples(fallbackSamples);
    this.bumpRuntimeRevision();
    return context.getAsteroidSamples();
  }

  // CHANGE ANCHOR: mission gate scan completion side-effects
  private forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null {
    const active = this.registry.getActiveContext();
    if (!active) {
      return null;
    }

    const samples = this.ensureContextAsteroidSamplesForMissionProgress(active);
    const requestedSample = sampleId ? (samples.find((sample) => sample.id === sampleId) ?? null) : null;
    const targetSample =
      requestedSample ?? samples.find((sample) => sample.revealedMaterial?.material === 'Iron') ?? samples[0] ?? null;
    if (!targetSample) {
      return null;
    }

    const targetId = targetSample.id;
    let updatedSample: ShipSceneAsteroidSample | null = null;

    const nextSamples: ShipSceneAsteroidSample[] = samples.map((sample) => {
      if (sample.id !== targetId) {
        return sample;
      }

      const scannedSample: ShipSceneAsteroidSample = {
        ...sample,
        scanned: true,
        scanProgress: 100,
        revealedMaterial: {
          material: 'Iron',
          rarity: sample.revealedMaterial?.rarity ?? 'Common',
        },
        revealedKinematics: sample.revealedKinematics ?? generateRandomAsteroidKinematics(),
      };
      updatedSample = scannedSample;
      return scannedSample;
    });
    active.setAsteroidSamples(nextSamples);
    this.bumpRuntimeRevision();

    if (!updatedSample) {
      return null;
    }

    const completedSample: ShipSceneAsteroidSample = updatedSample;
    this.asteroidPersistenceService.persistScanComplete(completedSample, {
      playerName: this.navigationPlayerName(),
      characterId: this.navigationCharacterId(),
      sessionKey: this.sessionService.getSessionKey() ?? undefined,
    });
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

    const samples = this.ensureContextAsteroidSamplesForMissionProgress(context);
    const requestedSample = samples.find((sample) => sample.id === sampleId) ?? null;
    const targetSample =
      requestedSample ?? samples.find((sample) => sample.revealedMaterial?.material === 'Iron') ?? samples[0] ?? null;
    if (!targetSample) {
      return null;
    }

    context.setTargetHoldCandidateId(null);
    const nextSamples: ShipSceneAsteroidSample[] = samples.map((sample) =>
      sample.id === targetSample.id
        ? {
            ...sample,
            scanned: true,
            scanProgress: 100,
            revealedMaterial: {
              material: 'Iron',
              rarity: sample.revealedMaterial?.rarity ?? 'Common',
            },
            revealedKinematics: sample.revealedKinematics ?? generateRandomAsteroidKinematics(),
          }
        : sample,
    );
    context.setAsteroidSamples(nextSamples);
    this.bumpRuntimeRevision();
    const scannedSample = nextSamples.find((s) => s.id === targetSample.id);
    if (scannedSample) {
      this.asteroidPersistenceService.persistScanComplete(scannedSample, {
        playerName: this.navigationPlayerName(),
        characterId: this.navigationCharacterId(),
        sessionKey: this.sessionService.getSessionKey() ?? undefined,
      });
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

  private forceCompleteShipScan(sampleId?: string): boolean {
    const active = this.registry.getActiveContext();
    if (!active) {
      return false;
    }

    return this.forceCompleteShipScanInContext(active.contextKey, sampleId ?? '');
  }

  private forceCompleteShipScanInContext(contextKey: string, sampleId: string): boolean {
    const context = this.registry.getContext(contextKey);
    if (!context) {
      return false;
    }

    const samples = context.getScannableShipSamples();
    const targetSample = sampleId
      ? (samples.find((sample) => sample.id === sampleId) ?? null)
      : (samples.find((sample) => !sample.scanned) ?? samples[0] ?? null);
    if (!targetSample) {
      return false;
    }

    const nextSamples = samples.map((sample) =>
      sample.id === targetSample.id
        ? {
            ...sample,
            scanned: true,
            scanProgress: 100,
          }
        : sample,
    );
    context.setScannableShipSamples(nextSamples);
    this.bumpRuntimeRevision();
    return true;
  }

  private forceCompleteDebrisScan(sampleId?: string): boolean {
    const active = this.registry.getActiveContext();
    if (!active) {
      return false;
    }

    return this.forceCompleteDebrisScanInContext(active.contextKey, sampleId ?? '');
  }

  private forceCompleteDebrisScanInContext(contextKey: string, sampleId: string): boolean {
    const context = this.registry.getContext(contextKey);
    if (!context) {
      return false;
    }

    const samples = context.getScannableDebrisSamples();
    const targetSample = sampleId
      ? (samples.find((sample) => sample.id === sampleId) ?? null)
      : (samples.find((sample) => !sample.scanned) ?? samples[0] ?? null);
    if (!targetSample) {
      return false;
    }

    const nextSamples = samples.map((sample) =>
      sample.id === targetSample.id
        ? {
            ...sample,
            scanned: true,
            scanProgress: 100,
          }
        : sample,
    );
    context.setScannableDebrisSamples(nextSamples);
    this.bumpRuntimeRevision();
    return true;
  }

  // CHANGE ANCHOR: target selection and launch flow
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

  // CHANGE ANCHOR: launch and reward execution
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
      activeState?.characterId?.trim() ||
      this.sessionService.activeCharacter()?.id?.trim() ||
      this.navigationCharacterId();

    const samples = active ? this.ensureContextAsteroidSamplesForMissionProgress(active) : [];
    const targetId = active?.getTargetedAsteroidId() ?? samples[0]?.id ?? null;
    if (!targetId) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: no target selected.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    const targetSample = samples.find((sample) => sample.id === targetId) ?? null;
    if (!targetSample || !active || !activeState) {
      this.activeLaunchToast.set({
        message: 'Cannot launch: selected target sample is unavailable.',
        tone: 'error',
        seed: null,
      });
      return;
    }

    this.asteroidPersistenceService.ensureLaunchTargetCelestialBodyId({
      sample: targetSample,
      playerName: resolvedPlayerName,
      characterId: resolvedCharacterId,
      context: active,
      basePositionKm: active.getState().world?.shipPosition ?? { x: 0, y: 0, z: 0 },
      onMissingIdentity: () => {
        this.activeLaunchToast.set({
          message: 'Cannot launch: missing session or character identity for target registration.',
          tone: 'error',
          seed: null,
        });
      },
      onUpsertFailure: (message) => {
        this.activeLaunchToast.set({
          message: message || 'Target registration failed.',
          tone: 'error',
          seed: null,
        });
      },
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

  // CHANGE ANCHOR: inventory-reward delegation
  private consumeLaunchedItem(response: LaunchItemResponse): void {
    this.inventoryRewardService.consumeLaunchedItem(response);
  }

  // CHANGE ANCHOR: asteroid-sample cleanup
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

  // CHANGE ANCHOR: inventory reward application
  private applyMaterialRewards(materials: readonly LaunchItemYieldedMaterial[]): void {
    const activeShip = this.sessionService.activeShip();
    const ownerCharacterId =
      this.sessionService.activeCharacter()?.id?.trim() || this.navigationCharacterId().trim() || null;
    const nextShip = this.inventoryRewardService.applyMaterialRewards(materials, activeShip, ownerCharacterId);
    if (!nextShip && activeShip) {
      return;
    }

    const rewardTypes = materials.flatMap((material) =>
      Array.from({ length: material.quantity }, () => material.material.toLowerCase()),
    );
    this.testInventoryRewards.update((types) => [...types, ...rewardTypes]);
  }

  // CHANGE ANCHOR: yielded item handling
  private applyYieldedItems(items: readonly LaunchItemYieldedItem[]): void {
    const activeShip = this.sessionService.activeShip();
    const ownerCharacterId =
      this.sessionService.activeCharacter()?.id?.trim() || this.navigationCharacterId().trim() || null;
    this.inventoryRewardService.applyYieldedItems(items, activeShip, ownerCharacterId);
  }

  private persistRewardItemsToBackend(items: readonly ShipItem[]): void {
    this.inventoryRewardService.persistRewardItemsToBackend(items, {
      playerName: this.navigationPlayerName().trim() || this.sessionService.getPlayerName()?.trim() || '',
      characterId: this.navigationCharacterId().trim() || this.sessionService.activeCharacter()?.id?.trim() || '',
      shipId: this.sessionService.activeShip()?.id?.trim() ?? '',
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
    return this.missionGateSimulator.simulateDebrisCollection(_remainingDebrisCount);
  }

  private simulateManufacture(itemType: string): ShipExteriorMissionGateState {
    return this.missionGateSimulator.simulateManufacture(itemType);
  }

  private simulateRepair(repairKind: string): ShipExteriorMissionGateState {
    return this.missionGateSimulator.simulateRepair(repairKind);
  }

  private getActiveShipInventoryItemTypes(): string[] {
    const activeInventory = this.sessionService.activeShip()?.inventory ?? [];
    const baseTypes = activeInventory
      .map((item: ShipItem) => item.itemType)
      .filter((itemType: string): itemType is string => itemType.length > 0);

    return baseTypes;
  }
}
