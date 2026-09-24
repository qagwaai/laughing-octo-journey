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
  isDevMode,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AsteroidScanDetailPanel } from '../../component/asteroid-scan-detail-panel';
import { locale } from '../../i18n/locale';
import { GENERIC_EXPLORATION_MISSION_ID } from '../../mission/generic-exploration-ship-exterior-mission';
import { resolveMissionScenePlugin } from '../../mission/mission-scene-plugin';import {
  createInitialMissionGateState,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import {
  resolveSensorArrayDetectionRangeKm,
  resolveSensorArrayTargetLockHoldMs,
} from '../../model/item-tier-capabilities';
import type { ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';
import type {
  LaunchItemRequest,
  LaunchItemResponse,
  LaunchItemYieldedItem,
  LaunchItemYieldedMaterial,
} from '../../model/launch-item';
import { type MarketListByLocationRequest, type MarketListByLocationResponse } from '../../model/market-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import type { ShipItem } from '../../model/ship-item';
import { ShipSummary } from '../../model/ship-list';
import { ShipListByOwnerRequest } from '../../model/ship-list-by-owner';
import { FloatingDebrisStateService } from '../../services/floating-debris-state.service';
import { appLogger } from '../../services/logger';
import { MarketService } from '../../services/market.service';
import { MissionProgressFacade } from '../../services/mission-progression-facade.service';
import { SessionService } from '../../services/session.service';
import type { ShipExteriorMissionStateContext } from '../../services/ship-exterior-mission-state.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import { ShipFlightPositionPersistenceService } from '../../services/ship-flight-position-persistence.service';
import { ShipExteriorViewStateService } from '../../services/ship-exterior-view-state.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { AsteroidPersistenceService } from './asteroid-persistence.service';
import { AsteroidScanController } from './asteroid-scan-controller';
import { AsteroidScanRevealController } from './asteroid-scan-reveal-controller';
import { FloatingDebrisController } from './floating-debris-controller';
import { resolveFramePressureHealth } from './frame-pressure-sampler';
import { HotkeyFlashController } from './hotkey-flash-controller';
import { InventoryRewardService } from './inventory-reward.service';
import { NavigationStateReader } from './navigation-state-reader';
import {
  ShipExteriorBareSceneTestAdapter,
  type ShipExteriorBareSceneTestAdapterSources,
} from './ship-exterior-bare-scene-test-adapter.service';
import {
  type ShipExteriorLegacyAsteroidSample,
  type ShipExteriorLegacyScannableDebrisSample,
  type ShipExteriorLegacyScannableShipSample,
} from './ship-exterior-bare-scene-test-api';
import {
  ShipExteriorBootstrapController,
  type ShipExteriorLocalBodiesResult,
} from './ship-exterior-bootstrap-controller';
import { mapLocalCelestialBodiesToSamples } from './ship-exterior-local-body-samples';
import {
  seedColdBootAsteroids as resolveColdBootAsteroidSamples,
  type ShipExteriorColdBootAsteroidSeedIntent,
} from './ship-exterior-cold-boot-asteroid-seed';
import {
  buildShipExteriorHotkeyBindings,
  SHIP_EXTERIOR_HOTKEY_ACTION_ROW_KEYS,
  type ShipExteriorHotkeyBinding,
  type ShipExteriorHotkeyFlashKey,
} from './ship-exterior-hotkey-bindings';
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
/** Minimum gap between HUD revision bumps driven by the animation loop (~10Hz). */
const RUNTIME_REVISION_BUMP_INTERVAL_MS = 100;
type ShipExteriorScanDetail =
  | { kind: 'asteroid'; sample: ShipSceneAsteroidSample }
  | { kind: 'debris'; sample: ShipSceneScannableDebrisSample }
  | { kind: 'ship'; sample: ShipSceneScannableShipSample };

@Component({
  selector: 'app-ship-exterior-bare-scene',
  standalone: true,
  imports: [AsteroidScanDetailPanel],
  templateUrl: './ship-exterior-bare-scene.component.html',
  styleUrls: ['./ship-exterior-bare-scene.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorBareSceneComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly showDebugButton = isDevMode();
  protected readonly t = locale.shipExterior.debugDrawer;
  protected readonly emptyStateText = locale.shipExterior.emptyState;
  /**
   * Overlay shown when the viewport would otherwise render an empty starfield, so the
   * player gets an explanation instead of a blank scene.
   */
  protected readonly sceneEmptyState = computed<{ title: string; detail: string } | null>(() => {
    this.asteroidRevision();
    this.activeContextKey();

    if (!this.sessionService.activeShip()?.id?.trim()) {
      return { title: this.emptyStateText.noShipTitle, detail: this.emptyStateText.noShipDetail };
    }

    if (this.usesScriptedSeeding()) {
      return null;
    }

    const localBodies = this.localBodiesState();
    if (localBodies?.status === 'unavailable') {
      return {
        title: this.emptyStateText.sensorsUnavailableTitle,
        detail: this.emptyStateText.sensorsUnavailableDetail,
      };
    }

    if (!localBodies) {
      return null;
    }

    const hasContacts = (this.registry.getActiveContext()?.getAsteroidSamples().length ?? 0) > 0;
    return hasContacts
      ? null
      : { title: this.emptyStateText.noContactsTitle, detail: this.emptyStateText.noContactsDetail };
  });
  private readonly router = inject(Router);
  private readonly navigationStateReader = inject(NavigationStateReader);
  private readonly sessionService = inject(SessionService);
  private readonly shipService = inject(ShipService);
  private readonly marketService = inject(MarketService);
  private readonly socketService = inject(SocketService);
  private readonly asteroidPersistenceService = inject(AsteroidPersistenceService);
  private readonly inventoryRewardService = inject(InventoryRewardService);
  private readonly shipExteriorSocketService = inject(ShipExteriorSocketService);
  private readonly shipFlightPositionPersistence = inject(ShipFlightPositionPersistenceService);
  private readonly missionProgressFacade = inject(MissionProgressFacade);
  private readonly shipExteriorViewStateService = inject(ShipExteriorViewStateService);
  private readonly floatingDebrisStateService = inject(FloatingDebrisStateService);
  private readonly missionStateService = inject(ShipExteriorMissionStateService);
  private readonly testAdapter = inject(ShipExteriorBareSceneTestAdapter);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionController = new ShipExteriorSessionController();
  private readonly missionPublicationDisposers = new Map<string, () => void>();

  readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  readonly debugButton = viewChild<ElementRef<HTMLButtonElement>>('debugButton');
  readonly debugDrawer = viewChild<ElementRef<HTMLElement>>('debugDrawer');
  // CHANGE ANCHOR: reactive scene state
  readonly contexts = signal<ShipSceneContext[]>([]);
  readonly activeContextKey = signal<string | null>(null);
  readonly contextKeys = computed(() => this.contexts().map((context) => context.contextKey));
  readonly activeShipTitleLine = computed(() => {
    const activeShip = this.sessionService.activeShip();
    const name = activeShip?.name?.trim();
    return name ? name.toUpperCase() : 'UNKNOWN SHIP';
  });
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
  readonly activeFlightStatusLine = computed(() => {
    this.flightRevision();
    this.activeContextKey();
    const flightModeEnabled = this.activeFlightSnapshot()?.flightModeEnabled ?? false;
    const modeLabel = flightModeEnabled ? 'FLIGHT' : 'INITIALIZING';
    const captureLabel = this.registry.getActiveContext()?.flightPointerLocked() ? 'LOCKED' : 'FREE';
    return `${modeLabel}: CAPTURE // ${captureLabel}`;
  });
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
    const telemetry = this.activeFlightSnapshot()?.performance;
    if (!telemetry || telemetry.status === 'sampling') {
      return 'FRAME TIME // SAMPLING';
    }
    if (telemetry.status === 'paused') {
      return 'FRAME TIME // PAUSED';
    }
    return `FRAME TIME // ${telemetry.averageFrameTimeMs?.toFixed(2)} ms ROLLING AVG`;
  });
  readonly activeFlightQualityScalerLine = computed(() => {
    const telemetry = this.activeFlightSnapshot()?.performance;
    const appliedPercent = (telemetry?.asteroidDetailCapMultiplier ?? 1) * 100;
    const threshold = telemetry?.detailCapThresholdMs ?? 24;
    return `ASTEROID DETAIL CAP // ${appliedPercent.toFixed(0)}% // REDUCED ABOVE ${threshold.toFixed(0)} ms`;
  });
  readonly debugDrawerOpen = signal(false);
  readonly performanceHealth = computed(() => {
    const telemetry = this.activeFlightSnapshot()?.performance;
    return resolveFramePressureHealth(telemetry?.status ?? 'sampling', telemetry?.averageFrameTimeMs ?? null);
  });
  readonly performanceHealthLabel = computed(() => {
    const health = this.performanceHealth();
    const label =
      health === 'green' ? this.t.healthGreen : health === 'amber' ? this.t.healthAmber : this.t.healthNeutral;
    return `${this.t.performanceHealth}: ${label}`;
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
  readonly activeLaunchToast = signal<{ message: string; tone: 'success' | 'error'; seed: number | null } | null>(null);
  readonly hotkeyBindings = computed<readonly ShipExteriorHotkeyBinding[]>(() => {
    this.activeContextKey();
    this.flightRevision();
    this.asteroidRevision();
    const active = this.registry.getActiveContext();
    const activeShip = this.sessionService.activeShip();
    return buildShipExteriorHotkeyBindings({
      hasActiveContext: active !== undefined,
      flightModeEnabled: active?.flightModeEnabled() ?? false,
      pointerLocked: active?.flightPointerLocked() ?? false,
      rightMouseHeld: this.rightMouseHeld(),
      heldMovementCodes: this.heldHotkeyCodes(),
      flashedHotkeys: this.hotkeyFlashController.active(),
      hasActiveShip: !!activeShip,
      launchableItems: activeShip?.inventory?.filter((item) => item.launchable === true) ?? [],
      hasValidLaunchTarget: this.hasValidLaunchTarget(active),
    });
  });
  /** Controls row (mouse + movement) of the two-row hotkey HUD. */
  readonly hotkeyControlsRow = computed<readonly ShipExteriorHotkeyBinding[]>(() =>
    this.hotkeyBindings().filter((binding) => !SHIP_EXTERIOR_HOTKEY_ACTION_ROW_KEYS.has(binding.key)),
  );
  /** Action row (launch slots + ESC/Q/E) of the two-row hotkey HUD, rendered above the controls row. */
  readonly hotkeyActionRow = computed<readonly ShipExteriorHotkeyBinding[]>(() =>
    this.hotkeyBindings().filter((binding) => SHIP_EXTERIOR_HOTKEY_ACTION_ROW_KEYS.has(binding.key)),
  );

  // CHANGE ANCHOR: scene registry and bootstrap controllers
  private readonly registry = new ShipSceneRegistry();
  private readonly navigationMissionContext = signal<ShipExteriorViewMissionContext | null>(null);
  /**
   * Mission that owns this scene instance. Resolved from the navigation state supplied
   * by the entry point, falling back to generic exploration when the scene is entered
   * without a mission (for example, after dismissing an overlay).
   */
  private readonly activeMissionId = computed(
    () => this.navigationMissionContext()?.missionId?.trim() || GENERIC_EXPLORATION_MISSION_ID,
  );
  private readonly missionScenePlugin = computed(() => resolveMissionScenePlugin(this.activeMissionId()));
  /**
   * Scripted cold-boot onboarding is the only flow permitted to fabricate asteroids
   * client-side. Every other mission hydrates from backend local-body sweeps.
   */
  private readonly usesScriptedSeeding = computed(() => this.activeMissionId() === FIRST_TARGET_MISSION_ID);
  private readonly localBodiesState = signal<ShipExteriorLocalBodiesResult | null>(null);
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
    getDetectionRangeKm: () => this.resolveDetectionRangeKm(),
    emitLocalCelestialBodies: (result) => {
      this.localBodiesState.set(result);
      this.applyLocalCelestialBodies(result);
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
  private pointerLockRequested = false;
  // Chromium fires a trailing 'mousemove' immediately after pointer lock engages,
  // reporting the OS cursor's real (and platform/display-server dependent) jump to
  // the locked reference frame. That event is indistinguishable from genuine
  // flight-stick input by movement magnitude alone, so discard exactly one locked,
  // isTrusted mousemove per lock acquisition (synthetic/test-dispatched events are
  // never the warp and always apply, sidestepping any race in event ordering).
  // Arm this flag synchronously at the requestPointerLock() call site (not in the
  // 'pointerlockchange' listener) because the trailing mousemove can race
  // document.pointerLockElement's update and fire before that listener runs.
  private discardNextLockedMouseMove = false;
  private readonly rightMouseHeld = signal(false);
  private readonly heldHotkeyCodes = signal<ReadonlySet<string>>(new Set());
  private readonly hotkeyFlashController = new HotkeyFlashController<ShipExteriorHotkeyFlashKey>();
  private readonly handledKeyboardEvents = new WeakSet<KeyboardEvent>();
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
      onWindowBlur: () => this.releasePilotInput(),
      onVisibilityChange: () => {
        if (document.hidden) {
          this.releasePilotInput();
        }
      },
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
  private lastRuntimeRevisionBumpAtMs = 0;
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
    onScanComplete: (contextKey, sampleId) => this.completeAsteroidScanInContext(contextKey, sampleId),
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
      const active = this.registry.getActiveContext();
      const context = active ? this.buildMissionStateContext(active.getState()) : null;
      if (context) {
        this.missionProgressFacade.syncPublishedState(
          {
            ...context,
            sessionKey: this.sessionService.getSessionKey() ?? '',
          },
          item.gateState,
        );
      }
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
    this.testAdapter.registerFromSources(this.createTestAdapterSources());

    this.destroyRef.onDestroy(() => {
      this.inputAdapter.detach();
      this.testAdapter.unregister();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.attachVisibleCanvas();
    this.observeResize();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    void this.shipFlightPositionPersistence.flushPending().catch((error: unknown) => {
      appLogger.error('Failed to flush ship position while leaving the exterior scene.', error);
    });
    this.hotkeyFlashController.dispose();
    this.releasePilotInput();
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
    if (contextKey !== this.activeContextKey()) {
      this.releasePilotInput();
    }
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

  toggleDebugDrawer(): void {
    if (this.debugDrawerOpen()) {
      this.closeDebugDrawer();
      return;
    }

    this.releasePilotInput();
    this.debugDrawerOpen.set(true);
    setTimeout(() => this.debugDrawer()?.nativeElement.focus());
  }

  closeDebugDrawer(restoreFocus = true): void {
    if (!this.debugDrawerOpen()) {
      return;
    }

    this.releasePilotInput();
    this.debugDrawerOpen.set(false);
    if (restoreFocus) {
      setTimeout(() => this.debugButton()?.nativeElement.focus());
    }
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
    if (this.usesScriptedSeeding()) {
      this.bootstrapController.seedAsteroidsForInProgressMission();
      return;
    }

    this.bootstrapController.loadLocalCelestialBodies();
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

    const samples = resolveColdBootAsteroidSamples(intent, this.missionScenePlugin().seedPolicy);
    targetContext.setAsteroidSamples(samples);
    this.activateContext(targetContext.contextKey);
    if (intent.kind !== 'fallback') {
      this.asteroidPersistenceService.persistSeededAsteroidsAsUnscanned(samples, intent);
    }
    this.pendingColdBootAsteroidSeedIntent.set(null);
    this.bumpAsteroidRevision();
  }

  private resolveNavigationIdentity(): void {
    const { playerName, characterId, missionContext } = this.navigationStateReader.resolve(this.router);

    this.navigationPlayerName.set(playerName || 'unknown-player');
    this.navigationCharacterId.set(
      characterId || this.sessionService.activeCharacter()?.id?.trim() || 'unknown-character',
    );
    this.navigationMissionContext.set(missionContext);

    this.shipExteriorViewStateService.saveCurrentContext({
      playerName: this.navigationPlayerName(),
      characterId: this.navigationCharacterId(),
      shipId: this.sessionService.activeShip()?.id?.trim() || 'unknown-ship',
    });
  }

  private onWindowPointerDown(event: PointerEvent): void {
    const active = this.registry.getActiveContext();
    if (
      !active ||
      active.isPaused() ||
      document.hidden ||
      !document.hasFocus() ||
      event.target !== active.getRenderingState()?.canvas
    ) {
      return;
    }
    if (active && !active.flightPointerLocked() && event.button === 2) {
      this.rightMouseHeld.set(true);
      const hoveredId = active.getHoveredAsteroidId();

      if (hoveredId) {
        this.beginAsteroidTargetHold(hoveredId);
        event.preventDefault();
        return;
      }
    }

    if (event.button === 0) {
      this.syncPointerLockForActiveContext(true);
    }
  }

  private onWindowPointerUp(event: PointerEvent): void {
    if (event.button !== 2) {
      return;
    }

    this.rightMouseHeld.set(false);
    this.clearTestTargetHoldTimer();
  }

  private onWindowContextMenu(event: MouseEvent): void {
    if (event.target === this.registry.getActiveContext()?.getRenderingState()?.canvas) {
      event.preventDefault();
    }
  }

  private onWindowKeyDown(event: KeyboardEvent): void {
    if (this.handledKeyboardEvents.has(event)) {
      return;
    }
    this.handledKeyboardEvents.add(event);

    if (event.code === 'Escape') {
      if (this.debugDrawerOpen()) {
        event.preventDefault();
        event.stopPropagation();
        this.closeDebugDrawer();
        return;
      }
      if (!event.repeat && this.registry.getActiveContext()?.flightPointerLocked()) {
        this.hotkeyFlashController.trigger('ESC');
      }
      this.releasePilotInput();
      return;
    }

    if (this.isDebugDrawerEvent(event)) {
      return;
    }

    if (document.hidden || !document.hasFocus()) {
      return;
    }
    const active = this.registry.getActiveContext();
    if (!active) {
      return;
    }

    if (active.captureFlightMovementKey(event.code)) {
      this.heldHotkeyCodes.update((held) => {
        if (held.has(event.code)) {
          return held;
        }
        const next = new Set(held);
        next.add(event.code);
        return next;
      });
      event.preventDefault();
      return;
    }

    const hotkey = this.resolveLaunchHotkeyFromCode(event.code);
    if (hotkey !== null && !event.repeat) {
      if (this.isLaunchHotkeyAvailable(hotkey)) {
        this.hotkeyFlashController.trigger(hotkey);
      }
      this.launchFromHotkey(hotkey);
      event.preventDefault();
    }
  }

  private onWindowKeyUp(event: KeyboardEvent): void {
    if (this.handledKeyboardEvents.has(event)) {
      return;
    }
    this.handledKeyboardEvents.add(event);

    if (this.isDebugDrawerEvent(event)) {
      return;
    }

    this.heldHotkeyCodes.update((held) => {
      if (!held.has(event.code)) {
        return held;
      }
      const next = new Set(held);
      next.delete(event.code);
      return next;
    });
    this.registry.getActiveContext()?.releaseFlightMovementKey(event.code);
  }

  private isDebugDrawerEvent(event: KeyboardEvent): boolean {
    const target = event.target;
    return target instanceof Node && (this.debugDrawer()?.nativeElement.contains(target) ?? false);
  }

  private onWindowMouseMove(event: MouseEvent): void {
    if (document.hidden || !document.hasFocus()) {
      return;
    }
    const active = this.registry.getActiveContext();
    const locked = active?.flightPointerLocked() ?? false;
    if (!locked) {
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

    // Only a real (browser-generated, isTrusted) event can be the pointer-lock
    // warp; synthetic events (e.g. tests dispatching MouseEvent directly) can
    // never be it and must always apply, regardless of dispatch ordering races
    // against the real trailing warp event.
    if (this.discardNextLockedMouseMove && event.isTrusted) {
      this.discardNextLockedMouseMove = false;
      return;
    }

    active!.applyFlightMouseMove(event.movementX, event.movementY);
  }

  private onSocketCorrelationWarning(_event: Event): void {}

  private onPointerLockChange(): void {
    const active = this.registry.getActiveContext();
    if (this.registry.getAllContexts().some((context) => context !== active && context.flightPointerLocked())) {
      this.releasePilotInput();
      return;
    }
    if (active?.flightPointerLocked()) {
      // A lock request can finish after blur or a context switch.
      if (!this.pointerLockRequested || document.hidden || !document.hasFocus() || active.isPaused()) {
        this.releasePilotInput();
        return;
      }
    } else {
      this.pointerLockRequested = false;
      this.discardNextLockedMouseMove = false;
      active?.clearFlightMovementInput();
      this.rightMouseHeld.set(false);
      this.heldHotkeyCodes.set(new Set());
    }
    this.syncPointerLockForActiveContext(false);
    this.bumpFlightRevision();
  }

  private releasePilotInput(): void {
    this.pointerLockRequested = false;
    this.discardNextLockedMouseMove = false;
    for (const context of this.registry.getAllContexts()) {
      context.clearFlightMovementInput();
      if (context.flightPointerLocked()) {
        document.exitPointerLock();
      }
    }
    this.clearTestTargetHoldTimer();
    this.rightMouseHeld.set(false);
    this.heldHotkeyCodes.set(new Set());
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
      if (!allowRequest || active.isPaused() || document.hidden || !document.hasFocus()) {
        return;
      }

      if (
        typeof rendering.canvas.requestPointerLock === 'function' &&
        document.pointerLockElement !== rendering.canvas
      ) {
        this.pointerLockRequested = true;
        // Arm the discard flag before the lock request resolves: the browser's
        // trailing warp mousemove can race document.pointerLockElement's update
        // (observed as fired before OR after the property flips depending on the
        // engine), so this must be set ahead of that race rather than reacting to
        // 'pointerlockchange', which can run too late to catch the same event.
        this.discardNextLockedMouseMove = true;
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
    context.setFlightLocationCommitHandler((positionKm) => {
      this.shipFlightPositionPersistence.queuePosition({
        playerName,
        characterId,
        shipId,
        positionKm,
      });
    });
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
        this.bumpRuntimeRevisionThrottled();
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
    this.missionPublicationDisposers.forEach((dispose) => dispose());
    this.missionPublicationDisposers.clear();
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

  private createTestAdapterSources(): ShipExteriorBareSceneTestAdapterSources {
    return {
      contextKeys: this.contextKeys,
      activeContextKey: this.activeContextKey.asReadonly(),
      activateContext: (contextKey: string) => this.activateContext(contextKey),
      toggleFlightMode: () => this.toggleFlightMode(),
      setFlightInvertY: (enabled: boolean) => this.setFlightInvertY(enabled),
      setFlightMouseSensitivityFromSliderValue: (rawValue: number) =>
        this.setFlightMouseSensitivityFromSliderValue(rawValue),
      getActiveRouteFeedCounts: () => this.getActiveRouteFeedCounts(),
      getActiveContext: () => this.registry.getActiveContext(),
      getAsteroidSamples: () => this.getActiveAsteroidSamples(),
      getScannableDebrisSamples: () => this.getActiveScannableDebrisSamples(),
      getScannableShipSamples: () => this.getActiveScannableShipSamples(),
      beginAsteroidTargetHold: (sampleId: string) => this.beginAsteroidTargetHold(sampleId),
      unhoverAsteroid: (sampleId: string) => this.unhoverAsteroid(sampleId),
      getTargetHoldCandidateId: () => this.testTargetHoldCandidateId(),
      forceCompleteIronScan: (sampleId?: string) => this.forceCompleteIronScan(sampleId),
      forceTargetAsteroid: (sampleId: string) => this.forceTargetAsteroid(sampleId),
      forceCompleteDebrisScan: (sampleId?: string) => this.forceCompleteDebrisScan(sampleId),
      forceCompleteShipScan: (sampleId?: string) => this.forceCompleteShipScan(sampleId),
      launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => this.launchFromHotkey(hotkey),
      getActiveShipInventoryItemTypes: () => this.getActiveShipInventoryItemTypes(),
      getActiveLaunchToast: () => this.activeLaunchToast(),
      getMissionGateState: () => this.getActiveMissionGateState() ?? this.createInitialMissionGateStateForTestApi(),
      resetMissionGateState: () => this.resetMissionGateStateForTest(),
    };
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
    this.bumpMissionRevision();
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

  /**
   * Sensor-array tier drives how far the local celestial body sweep reaches.
   * Ships without a sensor array fall back to the tier 1 range.
   */
  private resolveDetectionRangeKm(): number {
    const inventory = this.sessionService.activeShip()?.inventory ?? [];
    return resolveSensorArrayDetectionRangeKm(this.resolveActiveSensorArrayTier(inventory));
  }

  /**
   * Renders the backend local-body sweep into the active scene context. Contacts are
   * rendered verbatim: an empty or unavailable sweep clears the field rather than
   * substituting fabricated asteroids.
   */
  private applyLocalCelestialBodies(result: ShipExteriorLocalBodiesResult): void {
    if (this.usesScriptedSeeding()) {
      return;
    }

    const targetContext = this.resolveSeedTargetContext();
    if (!targetContext) {
      return;
    }

    const center = result.center;
    const samples =
      result.status === 'loaded' && center ? mapLocalCelestialBodiesToSamples(result.bodies, center) : [];

    targetContext.setAsteroidSamples(samples);
    this.activateContext(targetContext.contextKey);
    this.bumpAsteroidRevision();
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
    this.registerMissionPublisher(context);
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

  private registerMissionPublisher(context: ShipSceneContext): void {
    if (this.missionPublicationDisposers.has(context.contextKey)) {
      return;
    }

    const storageContext = this.buildMissionStateContext(context.getState());
    if (!storageContext) {
      return;
    }

    const dispose = this.missionProgressFacade.registerPublisher(storageContext, (gateState) => {
      context.setMissionGateState(gateState);
      this.bumpMissionRevision();
    });
    this.missionPublicationDisposers.set(context.contextKey, dispose);
  }

  private persistMissionGateState(context: ShipSceneContext, state: ShipExteriorMissionGateState): void {
    const storageContext = this.buildMissionStateContext(context.getState());
    if (!storageContext) {
      return;
    }

    this.missionStateService.saveState(storageContext, state);
  }

  // CHANGE ANCHOR: mission gate state updates
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

  /**
   * Per-frame variant of {@link bumpRuntimeRevision} for the animation loop.
   *
   * These revisions are cache-busting signals for the HUD computeds, so bumping
   * them on every frame invalidated three signals ~60x/second and forced a full
   * change-detection pass per frame on top of rendering. Where there is no GPU
   * (CI falls back to SwiftShader) that starved the renderer main thread badly
   * enough to stall input handling and scroll-into-view.
   *
   * The HUD only displays human-readable telemetry, so a ~10Hz refresh is
   * indistinguishable on screen while cutting the change-detection work
   * dramatically. Discrete events still call bumpRuntimeRevision() directly so
   * state transitions remain immediate.
   */
  private bumpRuntimeRevisionThrottled(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastRuntimeRevisionBumpAtMs < RUNTIME_REVISION_BUMP_INTERVAL_MS) {
      return;
    }
    this.lastRuntimeRevisionBumpAtMs = now;
    this.bumpRuntimeRevision();
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

    // Only scripted onboarding may invent contacts; every other mission renders
    // exactly what the backend reported, so an empty sweep stays empty.
    if (!this.usesScriptedSeeding()) {
      return existing;
    }

    const fallbackSamples = resolveColdBootAsteroidSamples({ kind: 'fallback' }, this.missionScenePlugin().seedPolicy);
    context.setAsteroidSamples(fallbackSamples);
    this.bumpRuntimeRevision();
    return context.getAsteroidSamples();
  }

  // CHANGE ANCHOR: mission gate scan completion side-effects
  private readonly asteroidScanRevealController = new AsteroidScanRevealController<
    ShipSceneAsteroidSample,
    ShipSceneContext
  >({
    getActiveContext: () => this.registry.getActiveContext(),
    getContext: (contextKey) => this.registry.getContext(contextKey),
    ensureAsteroidSamples: (context) => this.ensureContextAsteroidSamplesForMissionProgress(context),
    ensureMissionGateState: (context) => {
      this.ensureMissionGateStateForContext(context);
    },
    buildMissionStateContext: (state) => this.buildMissionStateContext(state),
    getSessionKey: () => this.sessionService.getSessionKey() ?? '',
    advanceScanThroughFacade: (context, sample) => this.missionProgressFacade.advanceScan(context, sample),
    persistScanComplete: (sample) =>
      this.asteroidPersistenceService.persistScanComplete(sample, {
        playerName: this.navigationPlayerName(),
        characterId: this.navigationCharacterId(),
        sessionKey: this.sessionService.getSessionKey() ?? undefined,
      }),
    onRuntimeChanged: () => this.bumpRuntimeRevision(),
    onMissionChanged: () => this.bumpMissionRevision(),
  });

  private forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null {
    return this.asteroidScanRevealController.forceCompleteIronScan(sampleId);
  }

  private completeAsteroidScanInContext(contextKey: string, sampleId: string): ShipExteriorMissionGateState | null {
    return this.asteroidScanRevealController.completeScanInContext(contextKey, sampleId);
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
    const selectedItem = launchableItems[hotkey - 1];
    if (!selectedItem) {
      this.activeLaunchToast.set({
        message: `Cannot launch: hotkey ${hotkey} has no launchable item assigned.`,
        tone: 'error',
        seed: null,
      });
      return;
    }

    const active = this.registry.getActiveContext();
    const activeState = active?.getState();
    const resolvedPlayerName = activeState?.playerName?.trim() || this.navigationPlayerName();
    const resolvedCharacterId =
      activeState?.characterId?.trim() ||
      this.sessionService.activeCharacter()?.id?.trim() ||
      this.navigationCharacterId();

    const samples = active ? this.ensureContextAsteroidSamplesForMissionProgress(active) : [];
    const targetId = active?.getTargetedAsteroidId() ?? null;
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

  private hasValidLaunchTarget(active: ShipSceneContext | null | undefined): boolean {
    if (!active) {
      return false;
    }
    const targetId = active.getTargetedAsteroidId();
    if (!targetId) {
      return false;
    }
    return active.getAsteroidSamples().some((sample) => sample.id === targetId);
  }

  private isLaunchHotkeyAvailable(hotkey: 1 | 2 | 3 | 4 | 5): boolean {
    const active = this.registry.getActiveContext();
    const items = this.sessionService.activeShip()?.inventory?.filter((item) => item.launchable === true) ?? [];
    return !!this.sessionService.activeShip() && !!items[hotkey - 1] && this.hasValidLaunchTarget(active);
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

  private getActiveShipInventoryItemTypes(): string[] {
    const activeInventory = this.sessionService.activeShip()?.inventory ?? [];
    const baseTypes = activeInventory
      .map((item: ShipItem) => item.itemType)
      .filter((itemType: string): itemType is string => itemType.length > 0);

    return baseTypes;
  }
}
