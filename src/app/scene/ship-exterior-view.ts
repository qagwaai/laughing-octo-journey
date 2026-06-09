import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { injectStore, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Euler, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { environment } from '../../environments/environment';
import { locale } from '../i18n/locale';
import { Asteroid, type AsteroidHoverEvent } from '../component/asteroid';
import { BackgroundStars } from '../component/background-stars';
import { Sol } from '../component/sol';
import {
  resolveMissionScenePlugin,
  type MissionScenePlugin,
} from '../mission/mission-scene-plugin';
import {
  createInitialMissionGateState,
  evaluateMissionGateOnScan,
  parseMissionGateState,
  type ShipExteriorMissionGateState,
  type ShipExteriorMissionGateStepStatus
} from '../mission/ship-exterior-mission';
import { FramePressureSampler } from './ship-exterior/frame-pressure-sampler';
// Side-effect import: register additional missions and their plugin factories
// so `resolveMissionScenePlugin` can resolve them when the navigation state
// targets one of these missions.
import '../mission/generic-exploration-ship-exterior-mission';
import { pickWeightedAsteroidMaterial, type AsteroidMaterialProfile } from '../model/catalog/asteroid-materials';
import {
  DEFAULT_SOLAR_SYSTEM_ID
} from '../model/celestial-body-upsert';
import { PlayerCharacterSummary } from '../model/character-list';
import type { FloatingDebrisItem } from '../model/floating-debris-item';
import { type ItemUpsertResponse } from '../model/item-upsert';
import { type LaunchItemRequest, type LaunchItemResponse, type LaunchItemYieldedMaterial } from '../model/launch-item';
import { type AsteroidKinematics } from '../model/math/asteroid-kinematics';
import { type MissionStatus } from '../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import {
  resolveSensorArrayCapabilities,
  resolveTractorBeamCapabilities,
  type ItemTierCapabilities,
  type TractorBeamTierCapabilities,
} from '../model/item-tier-capabilities';
import { Triple } from '../model/shared/triple';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import {
  resolveAsteroidExternalObjectDescriptor,
  resolveShipExternalObjectDescriptorFromModel,
  SHIP_EXTERIOR_SW13_FAMILY_BASELINE,
} from '../model/ship-exterior-descriptors';
import type {
  MarketListByLocationRequest,
  MarketListByLocationResponse,
  MarketRouteFeedEncounterShip,
  MarketRouteFeedGate,
  MarketRouteFeedStation,
} from '../model/market-list';
import {
  resolveShipExteriorViewSeedPolicy,
  type ShipExteriorViewMissionContext,
} from '../model/ship-exterior-view-context';
import type { ShipItem } from '../model/ship-item';
import {
  coerceShipInventory,
  coerceShipModel,
  type ShipSummary,
} from '../model/ship-list';
import { type ShipListByOwnerRequest, type ShipListByOwnerResponse } from '../model/ship-list-by-owner';
import { FloatingDebrisStateService } from '../services/floating-debris-state.service';
import { appLogger } from '../services/logger';
import { MarketService } from '../services/market.service';
import { MissionService } from '../services/mission.service';
import { SessionService } from '../services/session.service';
import {
  ShipExteriorAsteroidStateService,
  type ShipExteriorAsteroidStateContext,
} from '../services/ship-exterior-asteroid-state.service';
import {
  ShipExteriorMissionStateService,
  type ShipExteriorMissionStateContext,
} from '../services/ship-exterior-mission-state.service';
import { ShipExteriorSocketService } from '../services/ship-exterior-socket.service';
import { SocketLifecycleService } from '../services/socket-lifecycle.service';
import { SocketService } from '../services/socket.service';
import {
  assignAsteroidRenderTiers,
  DEFAULT_ASTEROID_TIER_CAPS,
  DEFAULT_ASTEROID_TIER_DISTANCES,
  resolveAsteroidTierDetailOverride,
  type AsteroidRenderTier,
} from './ship-exterior/asteroid-tier-selection';
import { FloatingDebrisController } from './ship-exterior/floating-debris-controller';
import {
  FloatingDebrisNode,
  type FloatingDebrisHoverEvent,
  type FloatingDebrisPointerEvent,
} from './ship-exterior/floating-debris-node';
import { HotkeyFlashController } from './ship-exterior/hotkey-flash-controller';
import { LaunchToastController, type LaunchFeedbackToast } from './ship-exterior/launch-toast-controller';
import { ShipDamageController } from './ship-exterior/ship-damage-controller';
import { ShipExteriorBootstrapController } from './ship-exterior/ship-exterior-bootstrap-controller';
import { ShipExteriorCelestialBodyController } from './ship-exterior/ship-exterior-celestial-body-controller';
import { ShipExteriorFlightController } from './ship-exterior/ship-exterior-flight-controller';
import { ShipExteriorInputAdapter } from './ship-exterior/ship-exterior-input-adapter';
import {
  ASTRONOMICAL_UNIT_KM,
  DEFAULT_SHIP_SUN_DISTANCE_KM,
  formatClusterText,
  formatDiameterText,
  formatLocationText,
  formatMassText,
  formatOffsetText,
  formatSpinText,
  formatVelocityText,
  getLaunchableLabel,
  normalizeDirection,
  resolveHotkeyNumber,
  resolveSunConfigForSolarSystem,
} from './ship-exterior/ship-exterior-formatters';
import { ShipExteriorLaunchController } from './ship-exterior/ship-exterior-launch-controller';
import { ShipExteriorMissionProgressController } from './ship-exterior/ship-exterior-mission-progress-controller';
import { ShipExteriorStateFacade } from './ship-exterior/ship-exterior-state-facade';
import { ShipExteriorSessionController } from './ship-exterior/ship-exterior-session-controller';
import { registerShipExteriorTestUtils, unregisterShipExteriorTestUtils } from './ship-exterior/ship-exterior-test-utils';
import { TractorBeamAudioController } from './ship-exterior/tractor-beam-audio-controller';
import { collectShipExteriorRouteFeeds } from './ship-exterior/ship-exterior-route-feed-adapter';
import {
  ShipExteriorRouteFeedLayer,
  type ShipExteriorRouteSceneEncounterShip,
  type ShipExteriorRouteSceneGate,
  type ShipExteriorRouteSceneStation,
} from './ship-exterior/ship-exterior-route-feed-layer';
import { resolveDescriptorRenderProfile } from './viewer/viewer-descriptor-selectors';
import {
  resolveTractorBeamVisualState as buildTractorBeamVisualState,
  type TractorBeamAnimationState,
  type TractorBeamVisualState,
} from './ship-exterior/tractor-beam-visual';

interface ShipExteriorViewNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  joinShip?: ShipSummary;
  firstTargetMissionStatus?: MissionStatus;
  missionContext?: ShipExteriorViewMissionContext;
}

interface LaunchHotkeySlot {
  hotkey: 1 | 2 | 3 | 4 | 5;
  item: ShipItem | null;
  label: string;
  enabled: boolean;
  launching: boolean;
}

function interpolateTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? '' : String(value);
  });
}

function resolveDescriptorDetailLevel(segments: number): number {
  if (segments >= 26) {
    return 2;
  }
  if (segments >= 20) {
    return 1;
  }
  return 0;
}

@Component({
  selector: 'app-ship-exterior-view-scene',
  templateUrl: './ship-exterior-view.html',
  imports: [NgtArgs, NgtsOrbitControls, Asteroid, BackgroundStars, Sol, FloatingDebrisNode, ShipExteriorRouteFeedLayer],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Real-time ship-exterior scene controller for scanning, mission gating, and launch actions.
 */
export default class ShipExteriorViewScene implements OnInit, OnDestroy {
  protected readonly t = locale;
  // --- Phase 3: Frame-pressure & Quality Scaler ---
  private readonly framePressureSampler = new FramePressureSampler(30); // Configurable window size
  private lastTickTimestamp: number | null = null;
  private readonly _qualityScaler = signal(1); // [0,1], 1 = best quality
  private readonly qualityScaler = this._qualityScaler;
  private readonly framePressureAvg = computed(() => this.framePressureSampler.getAverage());
  private static readonly SCAN_TICK_MS = 100;
  private static readonly SENSOR_ARRAY_ITEM_TYPE = 'sensor-array';
  private static readonly TRACTOR_BEAM_ITEM_TYPE = 'ship-tractor-beam';
  private static readonly EXPENDABLE_DART_DRONE_ITEM_TYPE = 'expendable-dart-drone';
  private static readonly DEBRIS_KM_TO_SCENE_UNITS = 0.4;
  private static readonly TRACTOR_BEAM_REVERSE_DURATION_MS = 550;
  private static readonly TRACTOR_BEAM_ANIMATION_TICK_MS = 16;
  private static readonly TRACTOR_BEAM_PARTICLE_COUNT = 8;
  private static readonly ACTIVE_SCAN_MIN_MOTION_DAMPING = 0.15;
  private static readonly SCANNED_MOTION_DAMPING = 0.65;
  private static readonly HOTKEY_SLOT_COUNT = 5;
  private static readonly POST_LAUNCH_REFRESH_DEBOUNCE_MS = 90;
  private static readonly SOLAR_DISTANCE_SCENE_SCALE_KM = 5_500_000;
  private static readonly SUN_DISTANCE_MIN_SCENE_UNITS = 56;
  private static readonly SUN_DISTANCE_MAX_SCENE_UNITS = 120;
  private static readonly FLIGHT_TICK_MS = 16;
  private static readonly FLIGHT_TRACKING_CHECKPOINT_MS = 50;
  private static readonly FLIGHT_TRACKING_QUANTIZE_KM = 10;
  private static readonly FLIGHT_SCENE_UNIT_TO_KM = 1200;
  private static readonly FLIGHT_BASE_SPEED_SCENE_UNITS_PER_SEC = 2.2;
  private static readonly FLIGHT_BOOST_MULTIPLIER = 2.15;
  private static readonly FLIGHT_ROLL_SPEED_RAD_PER_SEC = 1.8;
  private static readonly FLIGHT_DEFAULT_MOUSE_SENSITIVITY = 0.0023;
  private static readonly FLIGHT_MOUSE_SENSITIVITY_MIN = 0.001;
  private static readonly FLIGHT_MOUSE_SENSITIVITY_MAX = 0.007;
  private static readonly FLIGHT_MAX_PITCH_RAD = Math.PI * 0.48;
  private static readonly SCENE_ENVIRONMENT_INTENSITY = 0.35;
  private static readonly QUALITY_SCALER_CAP_MULTIPLIER_THRESHOLD = 0.9;
  private static readonly ROUTE_FEED_DISCOVERY_DISTANCE_AU = 0.35;
  private static readonly ROUTE_FEED_DISCOVERY_LIMIT = 75;
  private static readonly ROUTE_FEED_SCENE_UNITS_PER_KM = 1 / 160_000;
  private static readonly ROUTE_FEED_MAX_SCENE_DISTANCE = 28;

  private router = inject(Router);
  private socketService = inject(SocketService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private shipExteriorSocketService = inject(ShipExteriorSocketService);
  private sessionService = inject(SessionService);
  private missionService = inject(MissionService);
  private marketService = inject(MarketService);
  private asteroidStateService = inject(ShipExteriorAsteroidStateService);
  private missionStateService = inject(ShipExteriorMissionStateService);
  private floatingDebrisStateService = inject(FloatingDebrisStateService);
  private store: ReturnType<typeof injectStore> | null = (() => {
    try {
      return injectStore();
    } catch {
      // Test environments may not provide NgtStore — that's OK; flight camera reset will no-op.
      return null;
    }
  })();
  private sceneEnvironmentInstalled = false;
  private pmremGenerator: PMREMGenerator | null = null;
  private generatedEnvironmentTexture: import('three').Texture | null = null;
  private readonly sessionController = new ShipExteriorSessionController();
  protected readonly targetHoldCandidateId = this.sessionController.targetHoldCandidateId;
  private sceneElapsedSeconds = 0;
  private pendingActiveStateUpserts = new Set<string>();
  private tractorBeamAnimationIntervalId: number | null = null;
  private readonly tractorBeamAnimationState = signal<TractorBeamAnimationState | null>(null);
  private readonly tractorBeamAnimationClockMs = signal(0);
  private readonly tractorBeamAudioController = new TractorBeamAudioController();
  private readonly flightController = new ShipExteriorFlightController({
    config: {
      tickMs: ShipExteriorViewScene.FLIGHT_TICK_MS,
      trackingCheckpointMs: ShipExteriorViewScene.FLIGHT_TRACKING_CHECKPOINT_MS,
      trackingQuantizeKm: ShipExteriorViewScene.FLIGHT_TRACKING_QUANTIZE_KM,
      sceneUnitToKm: ShipExteriorViewScene.FLIGHT_SCENE_UNIT_TO_KM,
      baseSpeedSceneUnitsPerSec: ShipExteriorViewScene.FLIGHT_BASE_SPEED_SCENE_UNITS_PER_SEC,
      boostMultiplier: ShipExteriorViewScene.FLIGHT_BOOST_MULTIPLIER,
      rollSpeedRadPerSec: ShipExteriorViewScene.FLIGHT_ROLL_SPEED_RAD_PER_SEC,
      defaultMouseSensitivity: ShipExteriorViewScene.FLIGHT_DEFAULT_MOUSE_SENSITIVITY,
      mouseSensitivityMin: ShipExteriorViewScene.FLIGHT_MOUSE_SENSITIVITY_MIN,
      mouseSensitivityMax: ShipExteriorViewScene.FLIGHT_MOUSE_SENSITIVITY_MAX,
      maxPitchRad: ShipExteriorViewScene.FLIGHT_MAX_PITCH_RAD,
    },
    getCamera: () => this.store?.snapshot.camera ?? null,
    setActiveShipLocationKm: (location) => this.activeShipLocationKm.set(location),
    commitTrackedLocation: (location) => this.commitFlightTrackingCheckpointToSession(location),
  });
  private readonly flightOrientation = this.flightController.flightOrientation;
  private readonly cameraOrientation = this.flightController.cameraOrientation;
  private unsubscribeShipListResponse?: () => void;
  private unsubscribeCelestialBodyListResponse?: () => void;
  private unsubscribeLaunchItemResponse?: () => void;
  private launchSeedHint: number | null = null;
  private lastConsumedLaunchItemId: string | null = null;
  private readonly knownDroneDepletedShipIds = new Set<string>();
  private navigationState: ShipExteriorViewNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as ShipExteriorViewNavigationState | undefined) ??
    (history.state as ShipExteriorViewNavigationState | undefined) ??
    {};
  private readonly missionScenePlugin: MissionScenePlugin = resolveMissionScenePlugin(
    this.navigationState.missionContext?.missionId ?? FIRST_TARGET_MISSION_ID,
  );
  private readonly missionDefinition = this.missionScenePlugin.definition;

  protected playerName = signal(this.navigationState.playerName ?? 'Unknown Pilot');
  protected characterName = computed(() => this.navigationState.joinCharacter?.characterName?.trim() || 'Unbound');
  protected shipModel = computed(() => coerceShipModel(this.navigationState.joinShip?.model));
  private readonly normalizedNavigationInventory = coerceShipInventory(this.navigationState.joinShip?.inventory);
  protected hasExpendableDartDrone = signal(
    this.missionDefinition.resolveTargetingCapabilityFromInventory(this.normalizedNavigationInventory),
  );
  private activeShipId = signal(this.navigationState.joinShip?.id?.trim() ?? '');
  private activeShipLocationKm = signal<Triple | null>(this.resolveNavigationShipLocationKm());
  private activeSolarSystemId = signal(this.resolveNavigationSolarSystemId());
  private launchableInventory = signal(this.resolveLaunchableInventory(this.normalizedNavigationInventory));
  private readonly shipDamageController = new ShipDamageController(
    this.navigationState.missionContext?.shipDamagePreset,
    this.navigationState.joinShip,
  );
  private readonly hotkeyFlashController = new HotkeyFlashController();
  private readonly launchToastController = new LaunchToastController();
  private readonly celestialBodyController = new ShipExteriorCelestialBodyController({
    missionId: this.missionDefinition.missionId,
    socketService: this.socketService,
    sessionService: this.sessionService,
    getPlayerName: () => this.playerName(),
    getCharacterId: () => this.navigationState.joinCharacter?.id?.trim() ?? null,
    getSampleById: (sampleId) => this.asteroidSamples().find((sample) => sample.id === sampleId),
    hasPendingActiveStateUpsert: (sampleId) => this.pendingActiveStateUpserts.has(sampleId),
    clearPendingActiveStateUpsert: (sampleId) => this.pendingActiveStateUpserts.delete(sampleId),
    updateSampleServerCelestialBodyId: (sampleId, persistedId) => {
      this.asteroidSamples.update((samples) =>
        samples.map((candidate) =>
          candidate.id === sampleId
            ? {
                ...candidate,
                serverCelestialBodyId: persistedId,
              }
            : candidate,
        ),
      );
    },
    persistAsteroidSamples: () => this.persistAsteroidSamples(),
  });
  private readonly missionProgressController = new ShipExteriorMissionProgressController({
    missionDefinition: this.missionDefinition,
    missionService: this.missionService,
    sessionService: this.sessionService,
    getPlayerName: () => this.playerName(),
    getCharacterId: () => this.navigationState.joinCharacter?.id?.trim() ?? null,
    getGateState: () => this.missionGateState(),
    setGateState: (gateState) => this.missionGateState.set(gateState),
    persistGateState: (gateState) => this.persistMissionGateState(gateState),
    setLaunchToast: (message, tone, seed) => this.setLaunchToast(message, tone, seed),
  });
  private readonly launchController = new ShipExteriorLaunchController({
    missionDefinition: this.missionDefinition,
    getAsteroidSamples: () => this.asteroidSamples(),
    getMissionGateState: () => this.missionGateState(),
    setMissionGateState: (gateState) => this.missionGateState.set(gateState),
    persistMissionGateState: (gateState) => this.persistMissionGateState(gateState),
    enqueueMissionProgressUpsert: (item) => this.missionProgressController.enqueueMissionProgressUpsert(item),
    removeAsteroidSamples: (sampleIds) => this.removeAsteroidSamples(sampleIds),
    consumeLaunchedItem: (response) => this.consumeLaunchedItemFromInventory(response),
    applyMaterialRewards: (materials) => this.applyLaunchMaterialRewards(materials),
    queuePostLaunchRefresh: () => this.queuePostLaunchRefresh(),
    setLaunchToast: (message, tone, seed) => this.setLaunchToast(message, tone, seed),
    invokePluginHook: (name, payload) => this.invokePluginHook(name, payload),
    setLaunchSeedHint: (launchSeed) => {
      this.launchSeedHint = launchSeed;
    },
  });
  private readonly bootstrapController = new ShipExteriorBootstrapController({
    missionId: this.missionDefinition.missionId,
    sessionService: this.sessionService,
    socketService: this.shipExteriorSocketService,
    getPlayerName: () => this.navigationState.playerName?.trim() ?? '',
    getCharacterId: () => this.navigationState.joinCharacter?.id?.trim() ?? null,
    getLaunchSeedHint: () => this.launchSeedHint,
    missionScenePlugin: this.missionScenePlugin,
    setAsteroidSamples: (samples) => this.setAsteroidSamples(samples),
    persistSeededAsteroidsAsUnscanned: (samples) => this.persistSeededAsteroidsAsUnscanned(samples),
    updateTargetingCapabilityFromShipList: (ships) => this.updateTargetingCapabilityFromShipList(ships),
  });
  private readonly floatingDebrisController = new FloatingDebrisController({
    socketService: this.shipExteriorSocketService,
    sessionService: this.sessionService,
    stateService: this.floatingDebrisStateService,
    getPlayerName: () => this.playerName(),
    getCharacterId: () => this.navigationState.joinCharacter?.id?.trim() ?? null,
    getActiveShipId: () => this.activeShipId() || null,
    getHasTractorBeamInInventory: () => {
      const activeShip = this.sessionService.activeShip() ?? this.navigationState.joinShip ?? null;
      return (activeShip?.inventory ?? []).some(
        (item) => item.itemType === ShipExteriorViewScene.TRACTOR_BEAM_ITEM_TYPE && item.state !== 'destroyed',
      );
    },
    getShipPositionKm: () => this.activeShipLocationKm() ?? this.resolveNavigationShipLocationKm(),
    getSolarSystemId: () => this.activeSolarSystemId() || this.resolveNavigationSolarSystemId(),
  });
  private readonly stateFacade = new ShipExteriorStateFacade({
    getNavigationShip: () => this.navigationState.joinShip ?? null,
    setNavigationShip: (ship) => {
      this.navigationState.joinShip = ship;
    },
    getSessionShip: () => this.sessionService.activeShip(),
    setSessionShip: (ship) => this.sessionService.setActiveShip(ship),
    resolveLaunchableInventory: (rawInventory) => this.resolveLaunchableInventory(rawInventory),
    resolveTargetingCapabilityFromInventory: (inventory) =>
      this.missionDefinition.resolveTargetingCapabilityFromInventory(inventory),
    setLaunchableInventory: (inventory) => this.launchableInventory.set(inventory),
    setHasExpendableDartDrone: (hasDrone) => this.hasExpendableDartDrone.set(hasDrone),
  });
  private inputAdapter: ShipExteriorInputAdapter | null = null;
  private missionGateState = signal<ShipExteriorMissionGateState | null>(null);
  private previousFloatingDebrisCount = 0;
  private readonly missionGateStateSync = effect(() => {
    const updated = this.missionStateService.lastSaved();
    if (!updated) {
      return;
    }

    const current = this.missionGateState();
    if (current && this.getMissionGateProgressRank(updated) < this.getMissionGateProgressRank(current)) {
      return;
    }

    this.missionGateState.set(updated);
  });
  private readonly floatingDebrisMissionGateSync = effect(() => {
    const debrisCount = this.floatingDebrisItems().length;
    this.missionProgressController.evaluateFloatingDebrisCollection(this.previousFloatingDebrisCount, debrisCount);
    this.previousFloatingDebrisCount = debrisCount;
  });
  readonly shipConditionLine = computed(() => {
    const profile = this.shipDamageController.current();
    if (!profile) {
      return 'SHIP CONDITION // UNKNOWN';
    }

    return `SHIP CONDITION // ${profile.overallStatus.toUpperCase()} // ${profile.summary.toUpperCase()}`;
  });
  readonly activeLaunchToast: () => LaunchFeedbackToast | null = this.launchToastController.current;
  readonly showQuickTargetIronControl = computed(
    () => !environment.production && this.missionDefinition.missionId === FIRST_TARGET_MISSION_ID,
  );
  protected forceAllAsteroidsHeroForTest = signal(false);
  readonly missionObjectiveText = computed(() => {
    const gateState = this.missionGateState();
    if (gateState) {
      return gateState.activeObjectiveText;
    }

    return this.missionDefinition.getGateStepDefinitions()[0]?.objectiveText ?? 'Objective unavailable.';
  });
  protected canTargetAsteroids = computed(() =>
    this.missionDefinition.canTargetAsteroids({
      shipModel: this.shipModel(),
      hasExpendableDartDrone: this.hasExpendableDartDrone(),
    }),
  );
  readonly sunConfig = computed(() => resolveSunConfigForSolarSystem(this.activeSolarSystemId()));
  readonly shipSunDistanceKm = computed(() => {
    const shipLocation = this.activeShipLocationKm();
    if (!shipLocation) {
      return DEFAULT_SHIP_SUN_DISTANCE_KM;
    }

    const magnitude = Math.hypot(shipLocation.x, shipLocation.y, shipLocation.z);
    return magnitude > 0 ? magnitude : DEFAULT_SHIP_SUN_DISTANCE_KM;
  });
  readonly sunScenePosition = computed<[number, number, number]>(() => {
    const shipLocation = this.activeShipLocationKm();
    const sunDirection = shipLocation
      ? normalizeDirection(
          { x: -shipLocation.x, y: -shipLocation.y, z: -shipLocation.z },
          { x: -0.94, y: 0.12, z: -0.31 },
        )
      : { x: -0.94, y: 0.12, z: -0.31 };

    const scaledDistance = this.shipSunDistanceKm() / ShipExteriorViewScene.SOLAR_DISTANCE_SCENE_SCALE_KM;
    const clampedDistance = Math.max(
      ShipExteriorViewScene.SUN_DISTANCE_MIN_SCENE_UNITS,
      Math.min(ShipExteriorViewScene.SUN_DISTANCE_MAX_SCENE_UNITS, scaledDistance),
    );

    return [
      +(sunDirection.x * clampedDistance).toFixed(3),
      +(sunDirection.y * clampedDistance).toFixed(3),
      +(sunDirection.z * clampedDistance).toFixed(3),
    ];
  });
  readonly solarDirectionalLightIntensity = computed(() => {
    const distanceAu = this.shipSunDistanceKm() / ASTRONOMICAL_UNIT_KM;
    const rawIntensity = 0.7 / (distanceAu * distanceAu);
    return +Math.max(0.02, Math.min(0.16, rawIntensity)).toFixed(3);
  });
  protected Math = Math;
  private propertiesPanelHidden = signal(false);
  readonly flightModeEnabled = this.flightController.flightModeEnabled;
  readonly flightPointerLocked = signal(false);
  readonly flightInvertY = this.flightController.flightInvertY;
  readonly flightMouseSensitivity = this.flightController.flightMouseSensitivity;
  readonly flightSpeedKmPerSec = this.flightController.flightSpeedKmPerSec;
  readonly flightWorldOffset = this.flightController.flightWorldOffset;
  readonly flightWorldRotation = this.flightController.flightWorldRotation;
  readonly flightStatusLine = computed(() => {
    if (!this.flightModeEnabled()) {
      return 'FLIGHT // OFF';
    }

    const lockLabel = this.flightPointerLocked() ? 'LOCKED' : 'CLICK VIEW TO LOCK';
    return `FLIGHT // ACTIVE // MOUSE ${lockLabel}`;
  });
  readonly flightCoordsLine = computed(() => {
    const location = this.activeShipLocationKm();
    if (!location) {
      return 'COORD KM // ---';
    }

    return `COORD KM // X ${Math.round(location.x)} Y ${Math.round(location.y)} Z ${Math.round(location.z)}`;
  });
  readonly flightSpeedLine = computed(() => `SPD // ${Math.round(this.flightSpeedKmPerSec())} km/s`);
  readonly flightControlLine = computed(
    () => 'W/S FWD-BACK | A/D STRAFE | SPACE/CTRL VERT | Q/E ROLL | SHIFT BOOST',
  );
  readonly flightViewDirectionLine = computed(() => {
    const orientation = this.flightModeEnabled() ? this.flightOrientation() : this.cameraOrientation();
    const yawDeg = (orientation.yawRad * 180) / Math.PI;
    const pitchDeg = (orientation.pitchRad * 180) / Math.PI;
    const rollDeg = (orientation.rollRad * 180) / Math.PI;
    return `VIEW // YAW ${yawDeg.toFixed(1)}° PITCH ${pitchDeg.toFixed(1)}° ROLL ${rollDeg.toFixed(1)}°`;
  });
    readonly flightMovementVectorsLine = computed(() => {
      const orientation = this.flightModeEnabled() ? this.flightOrientation() : this.cameraOrientation();
      // Calculate forward, right, and up vectors in world space by applying the flight orientation.
      // Local vectors: forward=(0,0,-1), right=(1,0,0), up=(0,1,0)
      const forwardLocal = new Vector3(0, 0, -1);
      const rightLocal = new Vector3(1, 0, 0);
      const upLocal = new Vector3(0, 1, 0);
      const euler = new Euler(orientation.pitchRad, orientation.yawRad, orientation.rollRad, 'YXZ');
      forwardLocal.applyEuler(euler);
      rightLocal.applyEuler(euler);
      upLocal.applyEuler(euler);
      return `MOVE // FWD(${forwardLocal.x.toFixed(2)},${forwardLocal.y.toFixed(2)},${forwardLocal.z.toFixed(2)}) RIGHT(${rightLocal.x.toFixed(2)},${rightLocal.y.toFixed(2)},${rightLocal.z.toFixed(2)}) UP(${upLocal.x.toFixed(2)},${upLocal.y.toFixed(2)},${upLocal.z.toFixed(2)})`;
    });
  protected activeScanAsteroidId = signal<string | null>(null);
  protected targetedAsteroidId = signal<string | null>(null);
  protected targetedDebrisId = signal<string | null>(null);
  protected hoveredDebrisId = signal<string | null>(null);
  protected activeTarget = signal<{ kind: 'asteroid' | 'debris'; id: string } | null>(null);
  protected floatingDebrisItems = computed<FloatingDebrisItem[]>(() => this.floatingDebrisStateService.items());
  private routeFeedGates = signal<MarketRouteFeedGate[]>([]);
  private routeFeedStations = signal<MarketRouteFeedStation[]>([]);
  private routeFeedEncounterShips = signal<MarketRouteFeedEncounterShip[]>([]);
  readonly routeSceneGates = computed<ShipExteriorRouteSceneGate[]>(() =>
    this.routeFeedGates()
      .map((gate) => {
        const position = this.projectRouteFeedScenePosition(gate.spatial.positionKm);
        if (!position) {
          return null;
        }

        const profile = resolveDescriptorRenderProfile(gate.descriptor);
        return {
          id: gate.gateId,
          displayName: gate.descriptor.displayLabel || gate.gateId,
          position,
          descriptorColor: profile?.color ?? '#38bdf8',
          emissive: profile?.emissive ?? '#0c4a6e',
          emissiveIntensity: profile?.emissiveIntensity ?? 0.22,
          tubeRadius: Math.max(0.03, (profile?.radiusScale ?? 1) * 0.045),
        };
      })
      .filter((row): row is ShipExteriorRouteSceneGate => row !== null),
  );
  readonly routeSceneStations = computed<ShipExteriorRouteSceneStation[]>(() =>
    this.routeFeedStations()
      .map((station) => {
        const position = this.projectRouteFeedScenePosition(station.spatial.positionKm);
        if (!position) {
          return null;
        }

        const profile = resolveDescriptorRenderProfile(station.descriptor);
        const radiusScale = profile?.radiusScale ?? 1;
        return {
          id: station.marketId,
          displayName: station.siteName?.trim() || station.marketName?.trim() || station.marketId,
          position,
          descriptorColor: profile?.color ?? '#22c55e',
          emissive: profile?.emissive ?? '#14532d',
          emissiveIntensity: profile?.emissiveIntensity ?? 0.2,
          scale: [radiusScale * 0.58, radiusScale * 0.64, radiusScale * 0.58],
        };
      })
      .filter((row): row is ShipExteriorRouteSceneStation => row !== null),
  );
  readonly routeSceneEncounterShips = computed<ShipExteriorRouteSceneEncounterShip[]>(() =>
    this.routeFeedEncounterShips()
      .map((encounterShip) => {
        const position = this.projectRouteFeedScenePosition(encounterShip.spatial.positionKm);
        if (!position) {
          return null;
        }

        const profile = resolveDescriptorRenderProfile(encounterShip.descriptor);
        return {
          id: encounterShip.shipId,
          displayName: encounterShip.shipName?.trim() || encounterShip.shipId,
          model: encounterShip.model,
          position,
          color: profile?.color ?? '#ef4444',
        };
      })
      .filter((row): row is ShipExteriorRouteSceneEncounterShip => row !== null),
  );
  protected tractorBeamVisual = computed<TractorBeamVisualState | null>(() => this.resolveTractorBeamVisualState());
  protected asteroidSamples = signal<AsteroidScanSample[]>([]);
  private readonly activeSensorArrayCapabilities = computed<ItemTierCapabilities | null>(() =>
    this.resolveActiveSensorArrayCapabilities(),
  );
  private readonly activeTractorBeamCapabilities = computed<TractorBeamTierCapabilities | null>(() =>
    this.resolveActiveTractorBeamCapabilities(),
  );
  readonly launchHotkeysEnabled = computed(() => {
    const targetedId = this.targetedAsteroidId();
    if (!targetedId) {
      return false;
    }

    const targeted = this.asteroidSamples().find((sample) => sample.id === targetedId);
    const serverId = targeted?.serverCelestialBodyId?.trim() ?? '';
    return serverId.length > 0;
  });
  readonly launchHotkeySlots = computed<LaunchHotkeySlot[]>(() => {
    const launchables = this.launchableInventory().slice(0, ShipExteriorViewScene.HOTKEY_SLOT_COUNT);
    const enabled = this.launchHotkeysEnabled();
    const launchingHotkeys = this.hotkeyFlashController.active();

    return Array.from({ length: ShipExteriorViewScene.HOTKEY_SLOT_COUNT }, (_, index) => {
      const hotkey = (index + 1) as 1 | 2 | 3 | 4 | 5;
      const item = launchables[index] ?? null;
      return {
        hotkey,
        item,
        label: item ? getLaunchableLabel(item) : 'empty',
        enabled: enabled && !!item,
        launching: launchingHotkeys.has(hotkey),
      };
    });
  });
  readonly launchInventoryDebugLine = computed(() => {
    if (environment.production) {
      return '';
    }

    const launchables = this.launchableInventory();
    const targetId = this.targetedAsteroidId();
    const activeShip = this.navigationState.joinShip;
    const navInventoryCount = coerceShipInventory(activeShip?.inventory).length;

    return [
      'LAUNCH DBG',
      `SHIP ${this.activeShipId() || 'none'}`,
      `NAV_INV ${navInventoryCount}`,
      `LAUNCHABLE ${launchables.length}`,
      `HAS_DRONE ${this.hasExpendableDartDrone() ? 'Y' : 'N'}`,
      `TARGET ${targetId ? 'Y' : 'N'}`,
      `HOTKEYS ${this.launchHotkeysEnabled() ? 'ON' : 'OFF'}`,
    ].join(' // ');
  });
  private readonly socketCorrelationDebugMessage = signal('');
  private readonly launchIdentityDebugMessage = signal('');
  private readonly lastLaunchRequestDebug = signal<LaunchItemRequest | null>(null);
  private readonly socketContractViolationTimestampsMs = signal<number[]>([]);
  private readonly socketLastContractViolationOperation = signal<string>('none');
  private readonly socketLastContractViolationAtMs = signal<number | null>(null);
  readonly socketCorrelationDebugLine = computed(() => {
    if (environment.production) {
      return '';
    }

    return this.socketCorrelationDebugMessage();
  });
  readonly socketContractViolationCounterLine = computed(() => {
    if (environment.production) {
      return '';
    }

    const now = Date.now();
    const cutoff = now - 60_000;
    const recentCount = this.socketContractViolationTimestampsMs().filter((timestamp) => timestamp >= cutoff).length;
    const lastOperation = this.socketLastContractViolationOperation();
    const lastAt = this.socketLastContractViolationAtMs();
    const ageSec = lastAt ? Math.max(0, Math.floor((now - lastAt) / 1000)) : null;

    return `CONTRACT VIOLATIONS // ${recentCount}/min // LAST_OP ${lastOperation}${ageSec !== null ? ` // LAST_${ageSec}s` : ''}`;
  });
  readonly launchIdentityDebugLine = computed(() => {
    if (environment.production) {
      return '';
    }

    return this.launchIdentityDebugMessage();
  });
  readonly hoveredScannedAsteroid = computed<AsteroidScanSample | null>(() => {
    const hoveredId = this.activeScanAsteroidId();
    if (!hoveredId) {
      return null;
    }

    const sample = this.asteroidSamples().find((candidate) => candidate.id === hoveredId);
    if (!sample?.scanned || !sample.revealedMaterial) {
      return null;
    }

    return sample;
  });
  readonly asteroidDebugSample = computed<AsteroidScanSample | null>(() => {
    const focusId = this.activeScanAsteroidId() ?? this.targetedAsteroidId();
    if (!focusId) {
      return null;
    }

    return this.asteroidSamples().find((candidate) => candidate.id === focusId) ?? null;
  });
  readonly showAsteroidDebugTag = computed(() => !environment.production && !!this.asteroidDebugSample());
  readonly asteroidDebugHeaderText = computed(() => {
    const sample = this.asteroidDebugSample();
    if (!sample) {
      return 'ASTEROID DEBUG // NO SAMPLE';
    }

    return `ASTEROID DEBUG // ${sample.id.toUpperCase()} // ${sample.scanned ? 'SCANNED' : 'UNSCANNED'}`;
  });
  readonly asteroidDebugMaterialText = computed(() => {
    const sample = this.asteroidDebugSample();
    if (!sample?.revealedMaterial) {
      return 'MAT // --- (scan to reveal PBR profile)';
    }

    return `MAT // ${sample.revealedMaterial.material.toUpperCase()} ${sample.revealedMaterial.rarity.toUpperCase()}`;
  });
  readonly asteroidDebugPbrText = computed(() => {
    const sample = this.asteroidDebugSample();
    if (!sample?.revealedMaterial || !sample.scanned) {
      return 'PBR // rough 0.92 metal 0.03 emissive base';
    }

    const roughness = (sample.revealedMaterial.roughness ?? 0.6).toFixed(2);
    const metalness = (sample.revealedMaterial.metalness ?? 0.25).toFixed(2);
    const emissive = (0.8 + (sample.revealedMaterial.emissiveBoost ?? 0)).toFixed(2);
    return `PBR // rough ${roughness} metal ${metalness} emissive ${emissive}`;
  });
  readonly asteroidDebugDetailRuleText = computed(() => {
    const sample = this.asteroidDebugSample();
    if (!sample?.scanned) {
      return 'DETAIL // pre-scan low (0-1)';
    }
    return 'DETAIL // post-scan mesh swap (rock profile)';
  });
  readonly asteroidRenderTiers = computed<Map<string, AsteroidRenderTier>>(() => {
    if (this.forceAllAsteroidsHeroForTest()) {
      return new Map(this.asteroidSamples().map((sample) => [sample.id, 'hero' as AsteroidRenderTier]));
    }

    const camera = this.store?.snapshot.camera;
    const cameraPosition: [number, number, number] = camera
      ? [camera.position.x, camera.position.y, camera.position.z]
      : [0, 0, 6.6];

    // Phase 3: Plumb qualityScaler as capMultiplier for dynamic LOD
    return assignAsteroidRenderTiers(
      this.asteroidSamples(),
      {
        cameraPosition,
        targetedAsteroidId: this.targetedAsteroidId(),
        activeScanAsteroidId: this.activeScanAsteroidId(),
        scannedOnlyHero: true,
      },
      DEFAULT_ASTEROID_TIER_CAPS,
      DEFAULT_ASTEROID_TIER_DISTANCES,
      this.resolveAsteroidCapMultiplier(),
    );
  });
  readonly asteroidDebugTierText = computed(() => {
    const sample = this.asteroidDebugSample();
    if (!sample) {
      return 'TIER // ---';
    }
    const tier = this.asteroidRenderTiers().get(sample.id) ?? 'background';
    return `TIER // ${tier.toUpperCase()}`;
  });
  readonly asteroidDebugSw13SeedText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 SEED // ${sample?.sw13bSeedId?.trim() || '---'}`;
  });
  readonly asteroidDebugSw13GeneratorText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 GEN // ${sample?.sw13bGeneratorVersion?.trim() || '---'}`;
  });
  readonly asteroidDebugSw13BundleHashText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 BUNDLE // ${sample?.sw13bParameterBundleHash?.trim() || '---'}`;
  });
  readonly asteroidDebugSw13ProfilePresetText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 PROFILE // ${sample?.sw13bProfilePreset?.trim() || '---'}`;
  });
  readonly asteroidDebugSw13SurfacesText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 SURFACES // ${this.formatSw13Surfaces(sample?.sw13bTargetSurfaces ?? null)}`;
  });
  readonly asteroidDebugSw13ValidationText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 VALIDATION // ${sample?.sw13bValidationStatus?.trim() || '---'}`;
  });
  readonly asteroidDebugSw13TierText = computed(() => {
    const sample = this.asteroidDebugSample();
    return `SW13 TIER // ${this.resolveSw13TierFromSeed(sample?.sw13bSeedId ?? null)}`;
  });
  readonly asteroidSw13ParitySummaryText = computed(() => {
    const samples = this.asteroidSamples();
    if (samples.length === 0) {
      return 'SW13 PARITY // TOTAL 0 // B 0 H 0 // SV 0 SEV 0 // META 0/0';
    }

    let baselineCount = 0;
    let heroCount = 0;
    let surfaceSvCount = 0;
    let surfaceSevCount = 0;
    let metadataCompleteCount = 0;

    for (const sample of samples) {
      const tier = this.resolveSw13TierFromSeed(sample.sw13bSeedId ?? null);
      if (tier === 'B') {
        baselineCount += 1;
      }
      if (tier === 'H') {
        heroCount += 1;
      }

      const surfaces = sample.sw13bTargetSurfaces ?? [];
      if (surfaces.includes('SV')) {
        surfaceSvCount += 1;
      }
      if (surfaces.includes('SEV')) {
        surfaceSevCount += 1;
      }

      const hasCompleteMetadata =
        !!sample.sw13bSeedId &&
        !!sample.sw13bGeneratorVersion &&
        !!sample.sw13bParameterBundleHash &&
        !!sample.sw13bProfilePreset &&
        (sample.sw13bTargetSurfaces?.length ?? 0) > 0 &&
        !!sample.sw13bValidationStatus;
      if (hasCompleteMetadata) {
        metadataCompleteCount += 1;
      }
    }

    return [
      'SW13 PARITY',
      `TOTAL ${samples.length}`,
      `B ${baselineCount}`,
      `H ${heroCount}`,
      `SV ${surfaceSvCount}`,
      `SEV ${surfaceSevCount}`,
      `META ${metadataCompleteCount}/${samples.length}`,
    ].join(' // ');
  });

  readonly debrisDebugSample = computed<FloatingDebrisItem | null>(() => {
    const targetedId = this.targetedDebrisId();
    if (!targetedId) {
      return null;
    }
    return this.floatingDebrisItems().find((debris) => debris.id === targetedId) ?? null;
  });
  readonly showDebrisDebugTag = computed(() => !environment.production && !!this.debrisDebugSample());
  readonly debrisDebugHeaderText = computed(() => {
    const sample = this.debrisDebugSample();
    if (!sample) {
      return 'DEBRIS DEBUG // NO SAMPLE';
    }
    return `DEBRIS DEBUG // ${sample.id.toUpperCase()} // ${sample.itemType.toUpperCase()}`;
  });
  readonly debrisDebugDisplayNameText = computed(() => {
    const sample = this.debrisDebugSample();
    return sample ? `NAME // ${sample.displayName}` : 'NAME // ---';
  });
  readonly debrisDebugPositionText = computed(() => {
    const sample = this.debrisDebugSample();
    if (!sample) {
      return 'POS KM // ---';
    }
    const { x, y, z } = sample.positionKm;
    return `POS KM // X ${x.toFixed(1)} Y ${y.toFixed(1)} Z ${z.toFixed(1)}`;
  });
  readonly showAnyDebugTag = computed(() => this.showAsteroidDebugTag() || this.showDebrisDebugTag());

  // --- Phase 3: Debug HUD lines ---
  readonly framePressureLine = computed(() => `FRAME PRESSURE // ${this.framePressureAvg().toFixed(2)} ms`);
  readonly qualityScalerLine = computed(() => `QUALITY SCALER // ${(this.qualityScaler() * 100).toFixed(0)}%`);

  private resolveAsteroidCapMultiplier(): { capMultiplier?: number } | undefined {
    const qualityScaler = this.qualityScaler();
    if (qualityScaler >= ShipExteriorViewScene.QUALITY_SCALER_CAP_MULTIPLIER_THRESHOLD) {
      return undefined;
    }

    return { capMultiplier: qualityScaler };
  }

  private resolveSw13TierFromSeed(seedId: string | null): 'B' | 'H' | '---' {
    if (!seedId) {
      return '---';
    }

    const segments = seedId.split('-');
    const tier = segments[2]?.trim().toUpperCase();
    if (tier === 'B' || tier === 'H') {
      return tier;
    }

    return '---';
  }

  private formatSw13Surfaces(surfaces: Array<'SV' | 'SEV'> | null): string {
    if (!surfaces || surfaces.length === 0) {
      return '---';
    }

    return Array.from(new Set(surfaces.map((surface) => surface.trim().toUpperCase()))).join(',');
  }

  resolveAsteroidRenderTier(sampleId: string): AsteroidRenderTier {
    return this.asteroidRenderTiers().get(sampleId) ?? 'background';
  }

  readonly sw13ShipExteriorFamilyCoverageSummary = computed(() => {
    const asteroidFamilies = new Set<string>();
    for (const sample of this.asteroidSamples()) {
      const descriptor =
        sample.externalObjectDescriptor ??
        resolveAsteroidExternalObjectDescriptor({
          sampleId: sample.id,
          revealedMaterial: sample.revealedMaterial,
          fallbackTier: sample.scanned ? 'hero' : 'standard',
        });
      asteroidFamilies.add(descriptor.objectFamily);
    }

    const debrisFamilies = new Set<string>();
    for (const debris of this.floatingDebrisItems()) {
      if (debris.externalObjectDescriptor?.domain === 'debris') {
        debrisFamilies.add(debris.externalObjectDescriptor.objectFamily);
      }
    }

    const activeShipModel = this.shipModel();
    const shipDescriptor = resolveShipExternalObjectDescriptorFromModel({ model: activeShipModel });

    return {
      asteroidsSeen: Array.from(asteroidFamilies).sort(),
      debrisSeen: Array.from(debrisFamilies).sort(),
      activeShipFamily: shipDescriptor.objectFamily,
      baseline: SHIP_EXTERIOR_SW13_FAMILY_BASELINE,
    };
  });

  resolveAsteroidDetailOverride(sample: AsteroidScanSample): number | null {
    const tier = this.resolveAsteroidRenderTier(sample.id);
    const tierDetail = resolveAsteroidTierDetailOverride(tier, sample.scanned);
    const descriptor =
      sample.externalObjectDescriptor ??
      resolveAsteroidExternalObjectDescriptor({
        sampleId: sample.id,
        revealedMaterial: sample.revealedMaterial,
        fallbackTier: sample.scanned ? 'hero' : 'standard',
      });
    const descriptorProfile = resolveDescriptorRenderProfile(descriptor);
    if (!descriptorProfile || descriptorProfile.domain !== 'asteroids') {
      return tierDetail;
    }

    const descriptorDetail = resolveDescriptorDetailLevel(descriptorProfile.geometrySegments);
    return Math.max(tierDetail ?? 0, descriptorDetail);
  }
  readonly showPropertiesPanel = computed(
    () => (!!this.hoveredScannedAsteroid() || !!this.hoveredDebrisItem()) && !this.propertiesPanelHidden(),
  );
  readonly showPropertiesPanelReveal = computed(
    () => (!!this.hoveredScannedAsteroid() || !!this.hoveredDebrisItem()) && this.propertiesPanelHidden(),
  );
  readonly hoveredDebrisItem = computed<FloatingDebrisItem | null>(() => {
    const id = this.hoveredDebrisId();
    if (!id) {
      return null;
    }
    return this.floatingDebrisItems().find((debris) => debris.id === id) ?? null;
  });
  readonly showAsteroidProperties = computed(() => !!this.hoveredScannedAsteroid());
  readonly showDebrisProperties = computed(
    () => !this.hoveredScannedAsteroid() && !!this.hoveredDebrisItem(),
  );
  readonly debrisPropertiesPanelTitle = computed(() => {
    const debris = this.hoveredDebrisItem();
    return debris ? `${debris.displayName.toUpperCase()} // PROPERTIES` : 'DEBRIS // PROPERTIES';
  });
  readonly debrisPropertiesItemTypeText = computed(
    () => `ITEM TYPE: ${this.hoveredDebrisItem()?.itemType?.toUpperCase() ?? 'UNKNOWN'}`,
  );
  readonly debrisPropertiesNameText = computed(
    () => `NAME: ${this.hoveredDebrisItem()?.displayName ?? 'UNKNOWN'}`,
  );
  readonly debrisPropertiesPositionText = computed(() => {
    const debris = this.hoveredDebrisItem();
    if (!debris) {
      return 'POS KM: ---';
    }
    const { x, y, z } = debris.positionKm;
    return `POS KM: X ${x.toFixed(1)} Y ${y.toFixed(1)} Z ${z.toFixed(1)}`;
  });
  readonly debrisPropertiesDistanceText = computed(() => {
    const debris = this.hoveredDebrisItem();
    const ship = this.activeShipLocationKm();
    if (!debris || !ship) {
      return 'DIST KM: ---';
    }
    const dx = debris.positionKm.x - ship.x;
    const dy = debris.positionKm.y - ship.y;
    const dz = debris.positionKm.z - ship.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return `DIST KM: ${distance.toFixed(1)}`;
  });
  readonly debrisPropertiesStateText = computed(() => {
    const debris = this.hoveredDebrisItem();
    if (!debris) {
      return 'STATE: ---';
    }
    const state = debris.state ? debris.state.toUpperCase() : '---';
    const damage = debris.damageStatus ? debris.damageStatus.toUpperCase() : '---';
    return `STATE: ${state} // DAMAGE: ${damage}`;
  });
  readonly showTractorBeamCapabilityDetails = computed(
    () => this.hoveredDebrisItem()?.itemType === ShipExteriorViewScene.TRACTOR_BEAM_ITEM_TYPE,
  );
  readonly tractorBeamCapabilityText = computed(() => {
    const capabilities = this.activeTractorBeamCapabilities();
    if (!capabilities) {
      if (this.hasOnlyNonIntactTractorBeamInstalled()) {
        return 'TRACTOR EQ: DAMAGED // REPAIR REQUIRED';
      }

      return 'TRACTOR EQ: UNAVAILABLE';
    }

    return `TRACTOR EQ: T${capabilities.tier} // RANGE ${capabilities.maxRangeKm.toFixed(1)} KM`;
  });
  readonly tractorBeamTimingText = computed(() => {
    const capabilities = this.activeTractorBeamCapabilities();
    if (!capabilities) {
      if (this.hasOnlyNonIntactTractorBeamInstalled()) {
        return 'TRACTOR PULL: REPAIR REQUIRED';
      }

      return 'TRACTOR PULL: ---';
    }

    return `TRACTOR PULL: ${capabilities.pullDurationMs} MS`;
  });
  readonly propertiesPanelTitle = computed(() => {
    const debris = this.hoveredDebrisItem();
    if (debris && !this.hoveredScannedAsteroid()) {
      return this.debrisPropertiesPanelTitle();
    }
    const sample = this.hoveredScannedAsteroid();
    return sample ? `ASTEROID ${sample.id.toUpperCase()} // PROPERTIES` : 'ASTEROID // PROPERTIES';
  });
  readonly propertiesMaterialText = computed(
    () => `MATERIAL: ${this.hoveredScannedAsteroid()?.revealedMaterial?.material ?? 'UNKNOWN'}`,
  );
  readonly propertiesRarityText = computed(
    () => `RARITY: ${this.hoveredScannedAsteroid()?.revealedMaterial?.rarity ?? 'UNKNOWN'}`,
  );
  readonly propertiesVelocityText = computed(() =>
    formatVelocityText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null),
  );
  readonly propertiesSpinText = computed(() =>
    formatSpinText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null),
  );
  readonly propertiesMassText = computed(() =>
    formatMassText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null),
  );
  readonly propertiesDiameterText = computed(() =>
    formatDiameterText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null),
  );
  readonly propertiesLocationText = computed(() =>
    formatLocationText(this.hoveredScannedAsteroid()?.solarSystemLocation ?? null),
  );
  readonly propertiesClusterText = computed(() =>
    formatClusterText(this.hoveredScannedAsteroid()?.clusterCenterKm ?? null),
  );
  readonly propertiesOffsetText = computed(() =>
    formatOffsetText(
      this.hoveredScannedAsteroid()?.solarSystemLocation ?? null,
      this.hoveredScannedAsteroid()?.clusterCenterKm ?? null,
    ),
  );
  protected targetedAsteroidPosition = computed<[number, number, number] | null>(() => {
    const targetedId = this.targetedAsteroidId();
    if (!targetedId) {
      return null;
    }

    const target = this.asteroidSamples().find((sample) => sample.id === targetedId);
    return target?.position ?? null;
  });

  protected targetedDebrisPosition = computed<[number, number, number] | null>(() => {
    const targetedId = this.targetedDebrisId();
    if (!targetedId) {
      return null;
    }
    const target = this.floatingDebrisItems().find((debris) => debris.id === targetedId);
    return target ? this.debrisScenePosition(target) : null;
  });

  private resolveAsteroidPosition(
    sample: AsteroidScanSample,
    elapsedSeconds: number,
    activeScanId: string | null,
  ): [number, number, number] {
    const velocity = sample.capturedKinematics.velocityKmPerSec;
    const horizontalMagnitude = Math.hypot(velocity.x, velocity.z);
    const dirX = horizontalMagnitude > 0 ? velocity.x / horizontalMagnitude : 1;
    const dirZ = horizontalMagnitude > 0 ? velocity.z / horizontalMagnitude : 0;

    const damping =
      sample.id === activeScanId
        ? (() => {
            const progress01 = Math.max(0, Math.min(1, sample.scanProgress / 100));
            const eased = 1 - Math.pow(progress01, 1.35);
            const min = ShipExteriorViewScene.ACTIVE_SCAN_MIN_MOTION_DAMPING;
            return min + (1 - min) * eased;
          })()
        : sample.scanned
          ? ShipExteriorViewScene.SCANNED_MOTION_DAMPING
          : 1;

    const phase = sample.motionPhase;
    const t = elapsedSeconds * sample.motionRate;
    const orbit = Math.sin(t + phase) * sample.motionRadius * damping;
    const strafe = Math.cos(t * 0.85 + phase * 1.3) * sample.motionRadius * 0.6 * damping;
    const bob = Math.sin(t * 1.5 + phase * 0.7) * sample.bobAmplitude * damping;

    const x = sample.basePosition[0] + dirX * orbit - dirZ * strafe;
    const y = sample.basePosition[1] + bob;
    const z = sample.basePosition[2] + dirZ * orbit + dirX * strafe;

    return [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)];
  }

  protected scanStatusLine = computed(() => {
    const asteroids = this.asteroidSamples();
    const total = asteroids.length;
    const completedCount = asteroids.filter((sample) => sample.scanned).length;
    const holdCandidateId = this.targetHoldCandidateId();
    const targetedId = this.targetedAsteroidId();

    if (holdCandidateId) {
      return `TARGETING // HOLD // ${holdCandidateId.toUpperCase()}`;
    }

    if (targetedId) {
      return `TARGET LOCKED // ${targetedId.toUpperCase()}`;
    }

    if (completedCount === total) {
      return `SCAN COMPLETE // ALL ${total} SAMPLES CATALOGUED`;
    }

    const activeId = this.activeScanAsteroidId();
    if (!activeId) {
      return `HOVER OVER ASTEROID SAMPLES TO SCAN // ${completedCount}/${total} COMPLETE`;
    }

    const active = asteroids.find((sample) => sample.id === activeId);
    if (!active) {
      return `HOVER OVER ASTEROID SAMPLES TO SCAN // ${completedCount}/${total} COMPLETE`;
    }

    return `SCANNING ${active.id.toUpperCase()} // ${Math.floor(active.scanProgress)}%`;
  });

  protected pilotLine = computed(
    () => `PILOT ${this.playerName().toUpperCase()} // RIG ${this.characterName().toUpperCase()}`,
  );

  ngOnInit(): void {
    this.inputAdapter = new ShipExteriorInputAdapter(
      {
        onWindowPointerDown: this.onWindowPointerDown,
        onWindowPointerUp: this.onWindowPointerUp,
        onWindowContextMenu: this.onWindowContextMenu,
        onWindowKeyDown: this.onWindowKeyDown,
        onWindowKeyUp: this.onWindowKeyUp,
        onWindowMouseMove: this.onWindowMouseMove,
        onSocketCorrelationWarning: this.onSocketCorrelationWarning,
        onPointerLockChange: this.onPointerLockChange,
      },
      window,
      document,
    );
    this.flightController.initializeCurrentLocation(this.resolveNavigationShipLocationKm() ?? { x: 0, y: 0, z: 0 });
    this.socketLifecycleService.ensureConnected();
    this.installSceneEnvironment();
    this.initializeMissionGateState();
    this.refreshMissionGateStateFromBackend();
    this.registerTestUtils();
    this.logLaunchabilitySnapshot({
      source: 'navigation-state',
      ship: this.navigationState.joinShip ?? null,
      inventory: this.normalizedNavigationInventory,
    });
    this.reportLaunchabilityContractMismatch(
      this.normalizedNavigationInventory,
      'navigation-state',
      this.activeShipId(),
    );
    this.unsubscribeLaunchItemResponse = this.shipExteriorSocketService.subscribeLaunchResponses(
      (response: LaunchItemResponse) => this.handleLaunchItemResponse(response),
    );
    this.floatingDebrisController.start();
    const seedPolicy = this.resolveSeedPolicy();
    const restoredPersistedAsteroids = this.restorePersistedAsteroidSamples();
    if (restoredPersistedAsteroids) {
      this.refreshShipStateAfterLaunch();
    } else if (seedPolicy === 'new') {
      this.clearPersistedAsteroidSamples();
      this.clearPersistedMissionGateState();
      this.initializeMissionGateState();
      this.bootstrapController.seedAsteroidsAroundStarterShip();
    } else {
      if (!this.restorePersistedAsteroidSamples()) {
        this.bootstrapController.seedAsteroidsForInProgressMission();
      } else {
        this.refreshShipStateAfterLaunch();
      }
    }
    const scanTickMs = this.activeSensorArrayCapabilities()?.scanTickMs ?? ShipExteriorViewScene.SCAN_TICK_MS;
    this.sessionController.startScanLoop(() => this.tickScene(), scanTickMs);
    this.flightController.start();
    this.inputAdapter.attach();
  }

  private resolveSeedPolicy(): 'new' | 'resume' {
    const missionStatusHint =
      this.navigationState.missionContext?.missionStatusHint ?? this.navigationState.firstTargetMissionStatus;

    return resolveShipExteriorViewSeedPolicy({
      seedPolicy: this.navigationState.missionContext?.seedPolicy,
      missionStatusHint,
    });
  }
  private onSocketCorrelationWarning = (event: Event): void => {
    if (environment.production) {
      return;
    }

    if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') {
      return;
    }

    const detail = event.detail as Record<string, unknown>;
    const code = typeof detail['code'] === 'string' ? detail['code'] : '';
    const operation = typeof detail['operation'] === 'string' ? detail['operation'] : 'unknown';
    const responseRequestOperation =
      typeof detail['responseRequestOperation'] === 'string' ? detail['responseRequestOperation'] : null;
    const responseCorrelationId =
      typeof detail['responseCorrelationId'] === 'string' ? detail['responseCorrelationId'] : 'missing';
    const expectedCorrelationId =
      typeof detail['expectedCorrelationId'] === 'string' ? detail['expectedCorrelationId'] : 'missing';
    const responseShipCount = typeof detail['responseShipCount'] === 'number' ? detail['responseShipCount'] : null;
    const firstShipInventoryCount =
      typeof detail['firstShipInventoryCount'] === 'number' ? detail['firstShipInventoryCount'] : null;
    const firstShipInventoryItemIdsCount =
      typeof detail['firstShipInventoryItemIdsCount'] === 'number' ? detail['firstShipInventoryItemIdsCount'] : null;
    const firstShipInventoryIdsCount =
      typeof detail['firstShipInventoryIdsCount'] === 'number' ? detail['firstShipInventoryIdsCount'] : null;
    const responseItemId = typeof detail['responseItemId'] === 'string' ? detail['responseItemId'] : null;
    const responseItemType = typeof detail['responseItemType'] === 'string' ? detail['responseItemType'] : null;
    const responseShipId = typeof detail['responseShipId'] === 'string' ? detail['responseShipId'] : null;

    const parts = [
      'SOCKET DBG',
      `OP ${operation}`,
      `RESP_CORR ${responseCorrelationId}`,
      `EXP_CORR ${expectedCorrelationId}`,
    ];

    if (responseShipCount !== null) {
      parts.push(`SHIPS ${responseShipCount}`);
    }
    if (firstShipInventoryCount !== null) {
      parts.push(`INV ${firstShipInventoryCount}`);
    }
    if (firstShipInventoryItemIdsCount !== null) {
      parts.push(`INV_ITEM_IDS ${firstShipInventoryItemIdsCount}`);
    }
    if (firstShipInventoryIdsCount !== null) {
      parts.push(`INV_IDS ${firstShipInventoryIdsCount}`);
    }
    if (responseItemId) {
      parts.push(`RESP_ITEM ${responseItemId}`);
    }
    if (responseItemType) {
      parts.push(`RESP_TYPE ${responseItemType}`);
    }
    if (responseShipId) {
      parts.push(`RESP_SHIP ${responseShipId}`);
    }

    if (code === 'socket-contract-violation') {
      const offendingOperation = responseRequestOperation?.trim() || operation;
      this.recordSocketContractViolation(offendingOperation);
      parts.push(`CODE ${code}`);
    }

    this.socketCorrelationDebugMessage.set(parts.join(' // '));
  };

  private resolveNavigationShipLocationKm(): Triple | null {
    const location = this.navigationState.joinShip?.spatial?.positionKm;
    if (!location) {
      return null;
    }

    return {
      x: location.x,
      y: location.y,
      z: location.z,
    };
  }

  private resolveNavigationSolarSystemId(): string {
    return this.navigationState.joinShip?.spatial?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID;
  }

  private recordSocketContractViolation(offendingOperation: string): void {
    const now = Date.now();
    const cutoff = now - 60_000;

    this.socketContractViolationTimestampsMs.update((timestamps) => {
      const recent = timestamps.filter((timestamp) => timestamp >= cutoff);
      recent.push(now);
      return recent;
    });
    this.socketLastContractViolationOperation.set(offendingOperation);
    this.socketLastContractViolationAtMs.set(now);
  }

  private resolveAsteroidStateContext(): ShipExteriorAsteroidStateContext | null {
    const playerName = this.playerName().trim();
    const characterId = this.navigationState.joinCharacter?.id?.trim();
    const missionId = this.missionDefinition.missionId?.trim();
    if (!playerName || !characterId || !missionId) {
      return null;
    }

    return {
      missionId,
      playerName,
      characterId,
    };
  }

  private resolveMissionStateContext(): ShipExteriorMissionStateContext | null {
    const playerName = this.playerName().trim();
    const characterId = this.navigationState.joinCharacter?.id?.trim();
    const missionId = this.missionDefinition.missionId?.trim();
    if (!playerName || !characterId || !missionId) {
      return null;
    }

    return {
      missionId,
      playerName,
      characterId,
    };
  }

  private persistAsteroidSamples(samples: readonly AsteroidScanSample[] = this.asteroidSamples()): void {
    const context = this.resolveAsteroidStateContext();
    if (!context) {
      return;
    }

    this.asteroidStateService.saveSamples(context, samples);
  }

  private clearPersistedAsteroidSamples(): void {
    const context = this.resolveAsteroidStateContext();
    if (!context) {
      return;
    }

    this.asteroidStateService.clearSamples(context);
  }

  private clearPersistedMissionGateState(): void {
    const context = this.resolveMissionStateContext();
    if (!context) {
      return;
    }

    this.missionStateService.clearState(context);
  }

  private restorePersistedAsteroidSamples(): boolean {
    const context = this.resolveAsteroidStateContext();
    if (!context) {
      return false;
    }

    const samples = this.asteroidStateService.loadSamples(context);
    if (!samples) {
      return false;
    }

    this.asteroidSamples.set(samples);
    return true;
  }

  private setAsteroidSamples(samples: AsteroidScanSample[]): void {
    this.asteroidSamples.set(samples);
    this.persistAsteroidSamples(samples);
  }

  private initializeMissionGateState(): void {
    const context = this.resolveMissionStateContext();
    if (!context) {
      return;
    }

    const cached = this.missionStateService.loadState(context);
    if (cached) {
      const normalizedCached = parseMissionGateState({
        rawStatusDetail: JSON.stringify(cached),
        missionId: this.missionDefinition.missionId,
        characterId: context.characterId,
        steps: this.missionDefinition.getGateStepDefinitions(),
      });
      this.missionGateState.set(normalizedCached ?? cached);
      return;
    }

    this.missionGateState.set(
      createInitialMissionGateState({
        missionId: this.missionDefinition.missionId,
        characterId: context.characterId,
        steps: this.missionDefinition.getGateStepDefinitions(),
      }),
    );
  }

  private async refreshMissionGateStateFromBackend(): Promise<void> {
    const context = this.resolveMissionStateContext();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    if (!context || !sessionKey) {
      return;
    }

    const result = await this.missionService.listMissions({
      playerName: context.playerName,
      characterId: context.characterId,
      sessionKey,
    });
    if (result.status !== 'loaded') {
      return;
    }

    const mission = result.missions.find((candidate) => candidate.missionId === this.missionDefinition.missionId);
    if (!mission) {
      return;
    }

    if (!mission.statusDetail) {
      const normalizedStatus = mission.status?.trim().toUpperCase();
      if (normalizedStatus === 'AVAILABLE') {
        const current = this.missionGateState();
        const currentRank = current ? this.getMissionGateProgressRank(current) : 0;
        const maxRank = current ? current.steps.length : 0;
        const hasPartialProgress = currentRank > 0 && currentRank < maxRank;
        if (!hasPartialProgress) {
          const resetGateState = this.createInitialMissionGateStateForCharacter(context.characterId);
          this.missionGateState.set(resetGateState);
          this.persistMissionGateState(resetGateState);
        }
      }

      if (normalizedStatus === 'ACTIVE') {
        const current = this.missionGateState();
        const hasPendingRetry = Boolean(current?.steps.some((step) => step.status === 'pending-retry'));
        if (!hasPendingRetry) {
          return;
        }

        const reconciled = this.reconcileInProgressGateStateWithoutStatusDetail(current);
        if (reconciled) {
          this.missionGateState.set(reconciled);
          this.persistMissionGateState(reconciled);
        }
      }
      return;
    }

    const parsed = parseMissionGateState({
      rawStatusDetail: mission.statusDetail,
      missionId: this.missionDefinition.missionId,
      characterId: context.characterId,
      steps: this.missionDefinition.getGateStepDefinitions(),
    });
    if (!parsed) {
      return;
    }

    const current = this.missionGateState();
    if (current && this.getMissionGateProgressRank(parsed) < this.getMissionGateProgressRank(current)) {
      return;
    }

    this.missionGateState.set(parsed);
    this.persistMissionGateState(parsed);
  }

  private createInitialMissionGateStateForCharacter(characterId: string): ShipExteriorMissionGateState {
    return createInitialMissionGateState({
      missionId: this.missionDefinition.missionId,
      characterId,
      steps: this.missionDefinition.getGateStepDefinitions(),
    });
  }

  private reconcileInProgressGateStateWithoutStatusDetail(
    gateState: ShipExteriorMissionGateState | null,
  ): ShipExteriorMissionGateState | null {
    if (!gateState) {
      return null;
    }

    const stepDefinitions = this.missionDefinition.getGateStepDefinitions();
    const totalSteps = gateState.steps.length;
    if (totalSteps === 0) {
      return null;
    }

    const completedCount = gateState.steps.filter(
      (step) => step.status === 'completed' || step.status === 'pending-retry',
    ).length;
    if (completedCount < totalSteps) {
      return null;
    }

    for (let index = stepDefinitions.length - 1; index >= 0; index -= 1) {
      const targetKey = stepDefinitions[index].key;
      const targetStep = gateState.steps.find((step) => step.key === targetKey);
      if (!targetStep || (targetStep.status !== 'completed' && targetStep.status !== 'pending-retry')) {
        continue;
      }

      const nextSteps = gateState.steps.map((step) => {
        if (step.key !== targetKey) {
          return step;
        }

        return {
          key: step.key,
          status: 'active' as const,
        };
      });

      return {
        ...gateState,
        steps: nextSteps,
        activeObjectiveText: this.resolveObjectiveTextForGateSteps(nextSteps),
        updatedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  private resolveObjectiveTextForGateSteps(
    stepStates: readonly { key: string; status: ShipExteriorMissionGateStepStatus }[],
  ): string {
    const definitions = this.missionDefinition.getGateStepDefinitions();
    const active = definitions.find((definition) =>
      stepStates.some((step) => step.key === definition.key && step.status === 'active'),
    );
    if (active) {
      return active.objectiveText;
    }

    const pendingRetry = definitions.find((definition) =>
      stepStates.some((step) => step.key === definition.key && step.status === 'pending-retry'),
    );
    if (pendingRetry) {
      return `${pendingRetry.objectiveText} (sync pending)`;
    }

    return 'Mission objectives complete. Await further directives.';
  }

  private getMissionGateProgressRank(gateState: ShipExteriorMissionGateState): number {
    return gateState.steps.filter((step) => step.status === 'completed' || step.status === 'pending-retry').length;
  }

  ngOnDestroy(): void {
    this.unregisterTestUtils();
    this.unsubscribeShipListResponse?.();
    this.unsubscribeCelestialBodyListResponse?.();
    this.unsubscribeLaunchItemResponse?.();
    this.floatingDebrisController.stop();
    this.stopTractorBeamAnimationLoop();
    this.tractorBeamAudioController.dispose();
    this.bootstrapController.dispose();
    this.sessionController.dispose();
    this.flightController.dispose();
    this.disposeSceneEnvironment();
    this.inputAdapter?.detach();
    this.inputAdapter = null;
    this.hotkeyFlashController.dispose();
    this.launchToastController.dispose();
  }

  setFlightModeEnabled(enabled: boolean): void {
    this.clearTargetHoldTimer();
    this.activeScanAsteroidId.set(null);
    this.flightController.setFlightModeEnabled(enabled);
    if (!enabled) {
      this.exitPointerLockIfHeld();
    }
  }

  private installSceneEnvironment(): void {
    if (this.sceneEnvironmentInstalled || !this.store) {
      return;
    }

    const snapshot = this.store.snapshot;
    const renderer = snapshot.gl;
    const scene = snapshot.scene;
    if (!renderer || !scene) {
      return;
    }

    try {
      const pmrem = new PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const roomScene = new RoomEnvironment();
      const envTexture = pmrem.fromScene(roomScene, 0.04).texture;
      scene.environment = envTexture;
      scene.environmentIntensity = ShipExteriorViewScene.SCENE_ENVIRONMENT_INTENSITY;
      this.pmremGenerator = pmrem;
      this.generatedEnvironmentTexture = envTexture;
      this.sceneEnvironmentInstalled = true;
    } catch (error) {
      appLogger.warn('Failed to install scene environment map.', error);
    }
  }

  private disposeSceneEnvironment(): void {
    if (!this.sceneEnvironmentInstalled) {
      return;
    }

    const scene = this.store?.snapshot.scene ?? null;
    if (scene && scene.environment === this.generatedEnvironmentTexture) {
      scene.environment = null;
    }
    this.generatedEnvironmentTexture?.dispose();
    this.pmremGenerator?.dispose();
    this.generatedEnvironmentTexture = null;
    this.pmremGenerator = null;
    this.sceneEnvironmentInstalled = false;
  }

  toggleFlightMode(): void {
    this.setFlightModeEnabled(!this.flightModeEnabled());
  }

  setFlightInvertY(enabled: boolean): void {
    this.flightController.setFlightInvertY(enabled);
  }

  setFlightMouseSensitivity(rawValue: number): void {
    this.flightController.setFlightMouseSensitivity(rawValue);
  }

  getFlightMouseSensitivitySliderValue(): number {
    return this.flightController.getFlightMouseSensitivitySliderValue();
  }

  setFlightMouseSensitivityFromSliderValue(rawValue: number): void {
    this.flightController.setFlightMouseSensitivityFromSliderValue(rawValue);
  }

  private onWindowPointerDown = (event: PointerEvent): void => {
    if (this.flightModeEnabled()) {
      if (event.button === 0) {
        this.requestPointerLock();
      }
      return;
    }

    if (event.button !== 2) {
      return;
    }

    const hoveredAsteroidId = this.activeScanAsteroidId();

    if (!this.canTargetAsteroids()) {
      return;
    }

    if (!hoveredAsteroidId) {
      return;
    }

    this.beginTargetHold(hoveredAsteroidId);
  };

  private onWindowPointerUp = (event: PointerEvent): void => {
    if (event.button !== 2) {
      return;
    }

    this.clearTargetHoldTimer();
  };

  private onWindowContextMenu = (event: MouseEvent): void => {
    if (this.flightModeEnabled()) {
      event.preventDefault();
      return;
    }

    if (!this.canTargetAsteroids()) {
      return;
    }

    event.preventDefault();
  };

  private onWindowKeyDown = (event: KeyboardEvent): void => {
    if (this.flightModeEnabled()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.setFlightModeEnabled(false);
        return;
      }

      if (this.flightController.captureFlightMovementKey(event.code)) {
        event.preventDefault();
        return;
      }
    }

    if (event.code === 'KeyE' && !this.flightModeEnabled()) {
      event.preventDefault();
      this.tryActivateTractorBeam();
      return;
    }

    const hotkey = resolveHotkeyNumber(event);
    if (!hotkey) {
      return;
    }

    if (!this.targetedAsteroidId()) {
      return;
    }

    event.preventDefault();
    this.launchFromHotkeySlot(hotkey);
  };

  private onWindowKeyUp = (event: KeyboardEvent): void => {
    if (this.flightController.releaseFlightMovementKey(event.code)) {
      event.preventDefault();
    }
  };

  private onWindowMouseMove = (event: MouseEvent): void => {
    if (!this.flightModeEnabled() || !this.flightPointerLocked()) {
      return;
    }

    this.flightController.applyMouseMove(event.movementX, event.movementY);
  };

  private onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === document.body;
    this.flightPointerLocked.set(locked);
    if (!locked && this.flightModeEnabled()) {
      this.setFlightModeEnabled(false);
      return;
    }

    // Pointer lock acquisition is asynchronous: a pointerdown that triggers
    // requestPointerLock() while disabling flight can resolve *after* the
    // click handler has already toggled flight off. Release immediately so
    // the cursor doesn't stay captured outside flight mode.
    if (locked && !this.flightModeEnabled()) {
      document.exitPointerLock();
    }
  };

  private requestPointerLock(): void {
    if (!this.flightModeEnabled() || this.flightPointerLocked()) {
      return;
    }

    void document.body.requestPointerLock();
  }

  private exitPointerLockIfHeld(): void {
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
  }

  private commitFlightTrackingCheckpointToSession(nextLocation: Triple): void {
    const activeShip = this.sessionService.activeShip();
    const shipId = this.activeShipId();
    if (!activeShip || activeShip.id !== shipId) {
      return;
    }

    this.sessionService.setActiveShip({
      ...activeShip,
      spatial: {
        ...(activeShip.spatial ?? {
          solarSystemId: this.activeSolarSystemId(),
          frame: 'icrs',
          epochMs: Date.now(),
          velocityKmPerSec: { x: 0, y: 0, z: 0 },
          heading: { x: 0, y: 0, z: -1 },
        }),
        solarSystemId: this.activeSolarSystemId(),
        positionKm: nextLocation,
        epochMs: Date.now(),
      },
    });
  }

  private updateTargetingCapabilityFromShipList(ships: ShipSummary[] | undefined): void {
    if (!Array.isArray(ships) || ships.length === 0) {
      return;
    }

    const navShipId = this.navigationState.joinShip?.id;
    const matchingShip = (navShipId ? ships.find((ship) => ship.id === navShipId) : undefined) ?? ships[0];
    const normalizedInventory = coerceShipInventory(matchingShip?.inventory);
    const normalizedShipId = matchingShip?.id?.trim() ?? '';
    const hasDroneInInventory = normalizedInventory.some(
      (item) => item.itemType.trim().toLowerCase() === ShipExteriorViewScene.EXPENDABLE_DART_DRONE_ITEM_TYPE,
    );
    if (normalizedShipId && hasDroneInInventory) {
      this.knownDroneDepletedShipIds.delete(normalizedShipId);
    }
    if (this.lastConsumedLaunchItemId) {
      const consumedItemStillPresent = normalizedInventory.some((item) => item.id === this.lastConsumedLaunchItemId);
      if (consumedItemStillPresent) {
        appLogger.warn('[ship-exterior-launch-contract] Ship list still includes consumed launched item.', {
          shipId: matchingShip?.id ?? null,
          consumedItemId: this.lastConsumedLaunchItemId,
        });
      } else {
        this.lastConsumedLaunchItemId = null;
      }
    }

    this.logLaunchabilitySnapshot({
      source: 'ship-list-response',
      ship: matchingShip ?? null,
      inventory: normalizedInventory,
    });
    this.reportLaunchabilityContractMismatch(normalizedInventory, 'ship-list-response', matchingShip?.id ?? null);
    const nextHasDrone = this.missionDefinition.resolveTargetingCapabilityFromInventory(normalizedInventory);
    this.hasExpendableDartDrone.set(nextHasDrone);
    this.activeShipId.set(matchingShip?.id?.trim() ?? '');
    this.activeShipLocationKm.set(matchingShip?.spatial?.positionKm ?? null);
    this.flightController.syncCurrentLocationFromShip(matchingShip?.spatial?.positionKm ?? null);
    this.activeSolarSystemId.set(matchingShip?.spatial?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID);
    this.refreshContractBackedRouteFeeds();
    this.stateFacade.syncNavigationShipFromShipList(matchingShip, normalizedInventory);
    this.shipDamageController.resolveFromShipSummary(matchingShip);
  }

  private logLaunchabilitySnapshot(params: {
    source: 'navigation-state' | 'ship-list-response';
    ship: ShipSummary | null;
    inventory: readonly ShipItem[];
  }): void {
    const ship = params.ship;
    const inventory = params.inventory;
    const droneItems = inventory.filter(
      (item) => item.itemType.trim().toLowerCase() === ShipExteriorViewScene.EXPENDABLE_DART_DRONE_ITEM_TYPE,
    );
    const launchableDroneCount = droneItems.filter((item) => item.launchable).length;
    const launchableCount = inventory.filter((item) => item.launchable).length;
    const inventoryItemTypes = inventory.map((item) => item.itemType);
    const inventoryLaunchableFlags = inventory.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      launchable: item.launchable,
    }));
    const shipRecord = ship as Record<string, unknown> | null;
    const inventoryItemIds = this.resolveInventoryReferenceIds(shipRecord, 'inventoryItemIds');
    const inventoryIds = this.resolveInventoryReferenceIds(shipRecord, 'inventoryIds');
    const inventoryRefIds = this.resolveInventoryReferenceIds(shipRecord, 'inventoryRefIds');
    const hasInventoryArray = Array.isArray(ship?.inventory);
    const hasLegacyInventoryIds = inventoryItemIds.length > 0 || inventoryIds.length > 0 || inventoryRefIds.length > 0;

    const shipId = ship?.id?.trim() ?? '';
    const emptyInventoryExpectedFromLaunch = shipId.length > 0 && this.knownDroneDepletedShipIds.has(shipId);
    const suspiciousEmptyInventoryPayload = !hasInventoryArray || hasLegacyInventoryIds;
    if (
      params.source === 'ship-list-response' &&
      ship &&
      inventory.length === 0 &&
      !emptyInventoryExpectedFromLaunch &&
      suspiciousEmptyInventoryPayload
    ) {
      appLogger.warn('[ship-exterior-contract] Ship list response contains ship with empty inventory payload.', {
        source: params.source,
        shipId: shipId || null,
        shipModel: ship.model,
        inventoryItemTypes,
        inventoryLaunchableFlags,
        hasInventoryArray,
        inventoryItemIdsCount: inventoryItemIds.length,
        inventoryIdsCount: inventoryIds.length,
        inventoryRefIdsCount: inventoryRefIds.length,
      });
    }

    const normalizedShipModel = (ship?.model ?? '').trim().toLowerCase();
    const droneAbsenceExpectedFromLaunch =
      (shipId.length > 0 && this.knownDroneDepletedShipIds.has(shipId)) ||
      this.isDroneAbsenceExpectedFromMissionProgress();
    if (normalizedShipModel === 'scavenger pod' && droneItems.length === 0 && !droneAbsenceExpectedFromLaunch) {
      appLogger.warn('[ship-exterior-contract] Scavenger Pod inventory missing Expendable Dart Drone.', {
        source: params.source,
        shipId: shipId || null,
        shipModel: ship?.model ?? null,
        inventoryCount: inventory.length,
        inventoryItemTypes,
        inventoryLaunchableFlags,
      });
    }
  }

  private isDroneAbsenceExpectedFromMissionProgress(): boolean {
    if (this.missionDefinition.missionId !== FIRST_TARGET_MISSION_ID) {
      return false;
    }

    const gateState = this.missionGateState();
    const neutralizeStep = gateState?.steps.find((step) => step.key === 'neutralize_identified_asteroid');
    if (neutralizeStep?.status === 'completed') {
      return true;
    }

    const normalizedMissionStatusHint = (
      this.navigationState.missionContext?.missionStatusHint ?? this.navigationState.firstTargetMissionStatus ?? ''
    )
      .trim()
      .toLowerCase();
    return normalizedMissionStatusHint === 'completed';
  }

  private reportLaunchabilityContractMismatch(
    inventory: readonly ShipItem[],
    source: 'navigation-state' | 'ship-list-response',
    shipId: string | null,
  ): void {
    const droneItems = inventory.filter(
      (item) => item.itemType.trim().toLowerCase() === ShipExteriorViewScene.EXPENDABLE_DART_DRONE_ITEM_TYPE,
    );
    if (droneItems.length === 0) {
      return;
    }

    const launchableDroneItems = droneItems.filter((item) => item.launchable);
    if (launchableDroneItems.length > 0) {
      return;
    }

    appLogger.warn(
      '[ship-exterior-contract] Expendable Dart Drone present but no launchable drone available.',
      {
        source,
        shipId: shipId?.trim() || null,
        droneCount: droneItems.length,
        droneItemIds: droneItems.map((item) => item.id),
        droneLaunchableFlags: droneItems.map((item) => item.launchable),
      },
    );
  }

  private resolveLaunchableInventory(rawInventory: unknown): ShipItem[] {
    const inventory = coerceShipInventory(rawInventory);
    return inventory
      .filter((item) => item.launchable)
      .sort((a, b) => {
        const left = (a.displayName || a.itemType).toLowerCase();
        const right = (b.displayName || b.itemType).toLowerCase();
        return left.localeCompare(right);
      });
  }

  private buildLaunchContractSnapshot(): Record<string, unknown> {
    const navigationShip = this.navigationState.joinShip;
    const navigationInventory = coerceShipInventory(navigationShip?.inventory);
    const launchableInventory = this.launchableInventory();
    const targetedSampleId = this.targetedAsteroidId();
    const targetedSample = targetedSampleId
      ? this.asteroidSamples().find((sample) => sample.id === targetedSampleId) ?? null
      : null;
    const shipRecord = (navigationShip as unknown as Record<string, unknown> | null) ?? null;
    const inventoryItemIds = this.resolveInventoryReferenceIds(shipRecord, 'inventoryItemIds');
    const inventoryIds = this.resolveInventoryReferenceIds(shipRecord, 'inventoryIds');
    const inventoryRefIds = this.resolveInventoryReferenceIds(shipRecord, 'inventoryRefIds');

    return {
      shipId: this.activeShipId(),
      navigationInventoryCount: navigationInventory.length,
      launchableInventoryCount: launchableInventory.length,
      navigationInventoryItemIds: navigationInventory.map((item) => item.id),
      navigationInventoryItemTypes: navigationInventory.map((item) => item.itemType),
      launchableInventoryItemIds: launchableInventory.map((item) => item.id),
      launchableInventoryItemTypes: launchableInventory.map((item) => item.itemType),
      shipInventoryItemIdsCount: inventoryItemIds.length,
      shipInventoryIdsCount: inventoryIds.length,
      shipInventoryRefIdsCount: inventoryRefIds.length,
      shipInventoryItemIds: inventoryItemIds,
      shipInventoryIds: inventoryIds,
      shipInventoryRefIds: inventoryRefIds,
      targetedSampleId,
      targetedSampleServerCelestialBodyId: targetedSample?.serverCelestialBodyId ?? null,
      targetedSampleScanned: targetedSample?.scanned ?? null,
      targetedSampleMaterial: targetedSample?.revealedMaterial?.material ?? null,
    };
  }

  private resolveInventoryReferenceIds(
    shipRecord: Record<string, unknown> | null,
    key: 'inventoryItemIds' | 'inventoryIds' | 'inventoryRefIds',
  ): string[] {
    const raw = shipRecord?.[key];
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  private serializeLaunchDebugValue(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void {
    const targetedSampleId = this.targetedAsteroidId();
    if (!targetedSampleId) {
      this.setLaunchToast('Lock an asteroid target before launch.', 'error', null);
      return;
    }

    const slot = this.launchHotkeySlots().find((candidate) => candidate.hotkey === hotkey);
    if (!slot?.item) {
      this.setLaunchToast(`Hotkey ${hotkey} has no launchable item.`, 'error', null);
      return;
    }

    const targetCelestialBodyId = this.resolveTargetCelestialBodyIdForLaunch(targetedSampleId);
    if (!targetCelestialBodyId) {
      this.setLaunchToast(
        'Target synchronization in progress. Wait for server confirmation before launch.',
        'error',
        null,
      );
      return;
    }

    const sessionKey = this.sessionService.getSessionKey()?.trim();
    const characterId = this.navigationState.joinCharacter?.id?.trim();
    const shipId = this.activeShipId();
    const playerName = this.playerName().trim();

    if (!sessionKey || !characterId || !shipId || !targetCelestialBodyId || !playerName) {
      this.setLaunchToast('Missing launch context. Rejoin the game and try again.', 'error', null);
      return;
    }

    if (!this.socketService.getIsConnected()) {
      this.setLaunchToast('Socket is not connected. Waiting for reconnect before launch.', 'error', null);
      return;
    }

    const request: LaunchItemRequest = {
      playerName,
      characterId,
      shipId,
      sessionKey,
      targetCelestialBodyId,
      hotkey,
      itemId: slot.item.id,
      itemType: slot.item.itemType,
    };

    this.launchIdentityDebugMessage.set(
      [
        'LAUNCH ID DBG',
        `REQ_ITEM ${request.itemId || 'missing'}`,
        `REQ_TYPE ${request.itemType || 'missing'}`,
        `HOTKEY ${request.hotkey}`,
        `SHIP ${request.shipId}`,
        `TARGET ${request.targetCelestialBodyId}`,
      ].join(' // '),
    );

    const correlatedRequest = this.shipExteriorSocketService.launchItem(request);
    this.lastLaunchRequestDebug.set(correlatedRequest);
    // Deliberate decision: rapid launches are allowed. Requests are emitted
    // immediately, and responses are consumed on one shared listener.
    this.setLaunchToast(`Launch request sent for hotkey ${hotkey}.`, 'success', null);
    this.triggerHotkeyLaunchFlash(hotkey);
  }

  selectFirstScannedIronTargetForTest(): void {
    if (!this.showQuickTargetIronControl()) {
      return;
    }

    if (!this.canTargetAsteroids()) {
      this.setLaunchToast('Targeting unavailable. Ensure the ship has an expendable dart drone.', 'error', null);
      return;
    }

    const ironSample = this.asteroidSamples().find(
      (sample) => sample.scanned && sample.revealedMaterial?.material === 'Iron',
    );
    if (ironSample) {
      this.targetedAsteroidId.set(ironSample.id);
      this.setLaunchToast(`Test target locked: ${ironSample.id.toUpperCase()}.`, 'success', null);
      return;
    }

    const sampleToScan = this.asteroidSamples().find((sample) => !sample.scanned);
    if (!sampleToScan) {
      this.setLaunchToast('No asteroid samples available for test scan.', 'error', null);
      return;
    }

    this.asteroidSamples.update((samples) =>
      samples.map((sample) => {
        if (sample.id !== sampleToScan.id) {
          return sample;
        }

        return {
          ...sample,
          scanProgress: 100,
          scanned: true,
          externalObjectDescriptor: resolveAsteroidExternalObjectDescriptor({
            sampleId: sample.id,
            revealedMaterial: {
              rarity: 'Common',
              material: 'Iron',
              textureColor: '#8f8f8f',
            },
            fallbackTier: 'hero',
          }),
          revealedMaterial: {
            rarity: 'Common',
            material: 'Iron',
            textureColor: '#8f8f8f',
          },
          revealedKinematics: sample.revealedKinematics ?? sample.capturedKinematics,
        };
      }),
    );

    const scannedIronSample = this.asteroidSamples().find((sample) => sample.id === sampleToScan.id);
    if (!scannedIronSample) {
      this.setLaunchToast('Unable to complete Iron scan for target lock.', 'error', null);
      return;
    }

    if (scannedIronSample.serverCelestialBodyId) {
      this.emitCelestialBodyUpsert(
        scannedIronSample,
        'active',
        scannedIronSample.revealedMaterial,
        scannedIronSample.revealedKinematics ?? scannedIronSample.capturedKinematics,
      );
    } else {
      this.pendingActiveStateUpserts.add(scannedIronSample.id);
    }

    this.persistAsteroidSamples();
    this.retryPendingMissionProgressSync();
    this.evaluateMissionGateForCompletedSamples([scannedIronSample.id]);
    this.targetedAsteroidId.set(scannedIronSample.id);
    this.setLaunchToast(`Test scan complete. Target locked: ${scannedIronSample.id.toUpperCase()}.`, 'success', null);
  }

  scanAllAsteroidsToHeroForTest(): void {
    if (!this.showQuickTargetIronControl()) {
      return;
    }

    const samples = this.asteroidSamples();
    if (samples.length === 0) {
      this.setLaunchToast('No asteroid samples available for test scan.', 'error', null);
      return;
    }

    this.forceAllAsteroidsHeroForTest.set(true);

    const completedSampleIds: string[] = [];
    this.asteroidSamples.update((existingSamples) =>
      existingSamples.map((sample) => {
        const revealedMaterial = sample.revealedMaterial ?? pickWeightedAsteroidMaterial();
        const revealedKinematics = sample.revealedKinematics ?? sample.capturedKinematics;
        completedSampleIds.push(sample.id);

        if (sample.serverCelestialBodyId) {
          this.emitCelestialBodyUpsert(sample, 'active', revealedMaterial, revealedKinematics);
        } else {
          this.pendingActiveStateUpserts.add(sample.id);
        }

        return {
          ...sample,
          scanProgress: 100,
          scanned: true,
          externalObjectDescriptor: resolveAsteroidExternalObjectDescriptor({
            sampleId: sample.id,
            revealedMaterial,
            fallbackTier: 'hero',
          }),
          revealedMaterial,
          revealedKinematics,
        };
      }),
    );

    this.persistAsteroidSamples();
    this.retryPendingMissionProgressSync();
    this.evaluateMissionGateForCompletedSamples(completedSampleIds);
    this.targetedAsteroidId.set(samples[0].id);
    this.setLaunchToast(`Test scan complete. All ${samples.length} asteroids elevated to Hero tier.`, 'success', null);
  }

  private resolveTargetCelestialBodyIdForLaunch(targetedSampleId: string): string | null {
    const targeted = this.asteroidSamples().find((sample) => sample.id === targetedSampleId);
    const serverId = targeted?.serverCelestialBodyId?.trim() ?? '';
    return serverId.length > 0 ? serverId : null;
  }

  private persistSeededAsteroidsAsUnscanned(samples: readonly AsteroidScanSample[]): void {
    for (const sample of samples) {
      if (sample.serverCelestialBodyId) {
        continue;
      }

      this.emitCelestialBodyUpsert(sample, 'unscanned', sample.revealedMaterial, sample.capturedKinematics);
    }
  }

  private handleLaunchItemResponse(response: LaunchItemResponse): void {
    const rawMessage = typeof response.message === 'string' ? response.message.trim() : '';
    const compactMessage = rawMessage.length > 64 ? `${rawMessage.slice(0, 61)}...` : rawMessage || 'missing';
    this.launchIdentityDebugMessage.set(
      [
        'LAUNCH ID DBG',
        `RESP_OK ${response.success ? 'Y' : 'N'}`,
        `RESP_ITEM ${response.itemId || 'missing'}`,
        `RESP_TYPE ${response.itemType || 'missing'}`,
        `RESP_SHIP ${response.shipId || 'missing'}`,
        `RESP_CORR ${response.correlationId || 'missing'}`,
        `MSG ${compactMessage}`,
      ].join(' // '),
    );

    if (!response.success) {
      const lastRequest = this.lastLaunchRequestDebug();
      const snapshot = this.buildLaunchContractSnapshot();
      appLogger.warn('[ship-exterior-launch-contract] Launch response rejected.', {
        response: {
          success: response.success,
          message: rawMessage || null,
          correlationId: response.correlationId ?? null,
          itemId: response.itemId ?? null,
          itemType: response.itemType ?? null,
          shipId: response.shipId ?? null,
          targetCelestialBodyId: response.targetCelestialBodyId ?? null,
          requestIdentity: response.requestIdentity ?? null,
        },
        lastRequest: lastRequest
          ? {
              correlationId: lastRequest.correlationId ?? null,
              itemId: lastRequest.itemId,
              itemType: lastRequest.itemType,
              shipId: lastRequest.shipId,
              targetCelestialBodyId: lastRequest.targetCelestialBodyId,
              requestIdentity: lastRequest.requestIdentity ?? null,
            }
          : null,
        snapshot,
      });
      appLogger.warn(
        '[ship-exterior-launch-contract] reject-summary ' +
          `corr=${response.correlationId ?? 'missing'} ` +
          `item=${response.itemId ?? 'missing'} ` +
          `itemType=${response.itemType ?? 'missing'} ` +
          `ship=${response.shipId ?? 'missing'} ` +
          `target=${response.targetCelestialBodyId ?? 'missing'} ` +
          `message=${rawMessage || 'missing'} ` +
          `respIdentity=${this.serializeLaunchDebugValue(response.requestIdentity ?? null)} ` +
          `reqIdentity=${this.serializeLaunchDebugValue(lastRequest?.requestIdentity ?? null)} ` +
          `navIds=${this.serializeLaunchDebugValue(snapshot['navigationInventoryItemIds'])} ` +
          `launchableIds=${this.serializeLaunchDebugValue(snapshot['launchableInventoryItemIds'])} ` +
          `shipInventoryItemIds=${this.serializeLaunchDebugValue(snapshot['shipInventoryItemIds'])} ` +
          `shipInventoryIds=${this.serializeLaunchDebugValue(snapshot['shipInventoryIds'])}`,
      );
    }

    this.launchController.handleLaunchItemResponse(response);
  }

  private removeAsteroidSamples(sampleIds: readonly string[]): void {
    if (sampleIds.length === 0) {
      return;
    }

    const matchingSampleIds = new Set(sampleIds);

    let didChange = false;
    this.asteroidSamples.update((samples) => {
      const next = samples.filter((sample) => !matchingSampleIds.has(sample.id));
      didChange = next.length !== samples.length;
      return next;
    });
    if (didChange) {
      this.persistAsteroidSamples();
    }

    if (matchingSampleIds.has(this.targetedAsteroidId() ?? '')) {
      this.targetedAsteroidId.set(null);
    }
    if (matchingSampleIds.has(this.activeScanAsteroidId() ?? '')) {
      this.activeScanAsteroidId.set(null);
    }
  }

  private queuePostLaunchRefresh(): void {
    this.sessionController.queuePostLaunchRefresh(
      () => this.refreshShipStateAfterLaunch(),
      ShipExteriorViewScene.POST_LAUNCH_REFRESH_DEBOUNCE_MS,
    );
  }

  private refreshShipStateAfterLaunch(): void {
    const playerName = this.navigationState.playerName?.trim() ?? '';
    const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName || !characterId || !sessionKey) {
      return;
    }

    this.unsubscribeShipListResponse?.();
    const shipRequest: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };
    this.unsubscribeShipListResponse = this.shipExteriorSocketService.listShipsByOwner(
      shipRequest,
      (shipResponse: ShipListByOwnerResponse) => {
        if (!shipResponse.success) {
          return;
        }

        this.updateTargetingCapabilityFromShipList(shipResponse.ships);
      },
    );
  }

  private refreshContractBackedRouteFeeds(): void {
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const solarSystemId = this.activeSolarSystemId().trim();
    const positionKm = this.activeShipLocationKm();
    const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
    const shipId = this.activeShipId().trim();

    if (!playerName || !sessionKey || !solarSystemId || !positionKm) {
      this.routeFeedGates.set([]);
      this.routeFeedStations.set([]);
      this.routeFeedEncounterShips.set([]);
      return;
    }

    const request: MarketListByLocationRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: ShipExteriorViewScene.ROUTE_FEED_DISCOVERY_DISTANCE_AU,
      limit: ShipExteriorViewScene.ROUTE_FEED_DISCOVERY_LIMIT,
      locationTypes: ['station', 'free-floating'],
      ...(characterId ? { characterId } : {}),
      ...(shipId ? { shipId } : {}),
    };

    this.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      if (!response.success) {
        this.routeFeedGates.set([]);
        this.routeFeedStations.set([]);
        this.routeFeedEncounterShips.set([]);
        return;
      }

      const feeds = collectShipExteriorRouteFeeds(response.markets ?? []);
      this.routeFeedGates.set(feeds.gates);
      this.routeFeedStations.set(feeds.stations);
      this.routeFeedEncounterShips.set(feeds.encounterShips);
    });
  }

  private projectRouteFeedScenePosition(positionKm: Triple): [number, number, number] | null {
    const ship = this.activeShipLocationKm();
    if (!ship) {
      return null;
    }

    const dx = (positionKm.x - ship.x) * ShipExteriorViewScene.ROUTE_FEED_SCENE_UNITS_PER_KM;
    const dy = (positionKm.y - ship.y) * ShipExteriorViewScene.ROUTE_FEED_SCENE_UNITS_PER_KM;
    const dz = (positionKm.z - ship.z) * ShipExteriorViewScene.ROUTE_FEED_SCENE_UNITS_PER_KM;
    const magnitude = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(magnitude)) {
      return null;
    }

    if (magnitude <= ShipExteriorViewScene.ROUTE_FEED_MAX_SCENE_DISTANCE) {
      return [dx, dy, dz];
    }

    const scale = ShipExteriorViewScene.ROUTE_FEED_MAX_SCENE_DISTANCE / magnitude;
    return [dx * scale, dy * scale, dz * scale];
  }

  private setLaunchToast(message: string, tone: 'success' | 'error', seed: number | null): void {
    this.launchToastController.set(message, tone, seed);
  }

  private normalizeMaterialToken(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private toCanonicalYieldItemTypeToken(token: string): string {
    return token.replace(/^raw-material-/, '').replace(/-raw-material$/, '').trim();
  }

  private consumeLaunchedItemFromInventory(response: LaunchItemResponse): void {
    const shipId = response.shipId?.trim() ?? '';
    if (!shipId) {
      return;
    }

    const lastLaunchRequest = this.lastLaunchRequestDebug();
    const requestItemId = lastLaunchRequest?.itemId?.trim() ?? '';
    const candidateConsumedItemIds = [response.launchedItem?.id?.trim() ?? '', response.itemId?.trim() ?? '', requestItemId]
      .filter((value) => value.length > 0)
      .filter((value, index, values) => values.indexOf(value) === index);
    if (candidateConsumedItemIds.length === 0) {
      appLogger.warn('[ship-exterior-launch-contract] Launch success missing consumed item id.', {
        shipId,
        correlationId: response.correlationId ?? null,
        itemId: response.itemId ?? null,
        launchedItemId: response.launchedItem?.id ?? null,
      });
      return;
    }

    const inventoryMutation = this.stateFacade.removeConsumedLaunchItems(shipId, candidateConsumedItemIds);

    const consumedItemId = candidateConsumedItemIds[0];
    this.lastConsumedLaunchItemId = consumedItemId;
    const launchedItemType = (response.itemType || lastLaunchRequest?.itemType || '').trim().toLowerCase();
    if (launchedItemType === ShipExteriorViewScene.EXPENDABLE_DART_DRONE_ITEM_TYPE) {
      this.knownDroneDepletedShipIds.add(shipId);
    }
    if (!inventoryMutation.didMutateNavigationInventory && !inventoryMutation.didMutateSessionInventory) {
      appLogger.warn('[ship-exterior-launch-contract] Consumed launch item was not found in local inventory state.', {
        shipId,
        consumedItemId,
        fallbackCandidateIds: candidateConsumedItemIds,
        correlationId: response.correlationId ?? null,
      });
    }
  }

  private applyLaunchMaterialRewards(materials: readonly LaunchItemYieldedMaterial[]): void {
    const quantityByMaterial = new Map<string, number>();
    for (const material of materials) {
      const token = this.normalizeMaterialToken(material.material);
      if (!token) {
        continue;
      }

      const quantity = Math.max(0, Math.floor(material.quantity));
      if (quantity <= 0) {
        continue;
      }

      quantityByMaterial.set(token, (quantityByMaterial.get(token) ?? 0) + quantity);
    }

    if (quantityByMaterial.size === 0) {
      return;
    }

    const shipId = this.activeShipId().trim();
    if (!shipId) {
      return;
    }

    const nowIso = new Date().toISOString();
    const rewardItems: ShipItem[] = [];
    for (const [token, quantity] of quantityByMaterial.entries()) {
      const canonicalToken = this.toCanonicalYieldItemTypeToken(token);
      if (!canonicalToken) {
        continue;
      }

      if (canonicalToken !== token) {
        appLogger.warn('[ship-exterior-launch-contract] Non-canonical yielded material token received.', {
          yieldedToken: token,
          canonicalToken,
        });
      }

      const materialName = canonicalToken
        .split('-')
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      const itemType = canonicalToken;
      const displayName = materialName;

      for (let index = 0; index < quantity; index += 1) {
        rewardItems.push({
          id: `launch-${itemType}-${Date.now().toString(36)}-${index}`,
          itemType,
          displayName,
          launchable: false,
          state: 'contained',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: shipId },
          owningPlayerId: this.playerName().trim() || null,
          owningCharacterId: this.navigationState.joinCharacter?.id?.trim() || null,
          spatial: null,
          destroyedAt: null,
          destroyedReason: null,
          discoveredAt: null,
          discoveredByCharacterId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    if (rewardItems.length === 0) {
      return;
    }

    this.persistLaunchMaterialRewards(rewardItems, shipId);

    this.stateFacade.appendLaunchRewardItems(shipId, rewardItems);
  }

  private persistLaunchMaterialRewards(rewardItems: readonly ShipItem[], shipId: string): void {
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const playerName = this.playerName().trim();
    const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
    if (!sessionKey || !playerName || !characterId || !shipId) {
      return;
    }

    for (const rewardItem of rewardItems) {
      this.socketService.upsertItem(
        {
          playerName,
          sessionKey,
          correlationSource: 'ship-exterior.launch-material-reward',
          item: {
            itemType: rewardItem.itemType,
            displayName: rewardItem.displayName,
            launchable: false,
            state: 'contained',
            damageStatus: 'intact',
            container: { containerType: 'ship', containerId: shipId },
            spatial: null,
            motion: null,
            owningPlayerId: playerName,
            owningCharacterId: characterId,
          },
        },
        (_response: ItemUpsertResponse) => {
          if (!_response.success) {
            this.setLaunchToast(`Material reward sync failed: ${_response.message}`, 'error', null);
            return;
          }

          this.queuePostLaunchRefresh();
        },
      );
    }
  }

  private registerTestUtils(): void {
    registerShipExteriorTestUtils({
      isProduction: environment.production,
      missionDefinition: this.missionDefinition,
      getMissionGateState: () => this.missionGateState(),
      setMissionGateState: (gateState) => this.missionGateState.set(gateState),
      persistMissionGateState: (gateState) => this.persistMissionGateState(gateState),
      getMissionObjectiveText: () => this.missionObjectiveText(),
      getAsteroidSamples: () => this.asteroidSamples(),
      updateAsteroidSamples: (updater) => this.asteroidSamples.update(updater),
      getActiveShipInventoryItemTypes: () => {
        const activeShip = this.sessionService.activeShip() ?? this.navigationState.joinShip ?? null;
        return (activeShip?.inventory ?? []).map((item) => item.itemType);
      },
      getTargetedAsteroidId: () => this.targetedAsteroidId(),
      onAsteroidHoverChange: (event) => this.onAsteroidHoverChange(event),
      canTargetAsteroids: () => this.canTargetAsteroids(),
      setTargetedAsteroidId: (sampleId) => this.targetedAsteroidId.set(sampleId),
      tickScene: () => this.tickScene(),
      persistAsteroidSamples: () => this.persistAsteroidSamples(),
      evaluateMissionGateForCompletedSamples: (sampleIds) => this.evaluateMissionGateForCompletedSamples(sampleIds),
      enqueueMissionProgressUpsert: (payload) => this.missionProgressController.enqueueMissionProgressUpsert(payload),
      invokePluginOnManufacture: (payload) => this.invokePluginHook('onManufacture', payload),
      invokePluginOnRepair: (payload) => this.invokePluginHook('onRepair', payload),
      launchFromHotkeySlot: (hotkey) => this.launchFromHotkeySlot(hotkey),
      clearLaunchToast: () => this.launchToastController.clear(),
    });
  }

  private unregisterTestUtils(): void {
    unregisterShipExteriorTestUtils(environment.production);
  }

  private persistMissionGateState(gateState: ShipExteriorMissionGateState): void {
    const context = this.resolveMissionStateContext();
    if (!context) {
      return;
    }

    this.missionStateService.saveState(context, gateState);
  }

  private evaluateMissionGateForCompletedSamples(sampleIds: readonly string[]): void {
    if (sampleIds.length === 0) {
      return;
    }

    const currentGateState = this.missionGateState();
    if (!currentGateState) {
      return;
    }

    let gateState = currentGateState;
    for (const sampleId of sampleIds) {
      const sample = this.asteroidSamples().find((candidate) => candidate.id === sampleId);
      if (!sample || !sample.scanned) {
        continue;
      }

      const evaluation = evaluateMissionGateOnScan({
        mission: this.missionDefinition,
        gateState,
        sample,
      });
      if (!evaluation.changed) {
        continue;
      }

      gateState = evaluation.gateState;
      this.missionGateState.set(gateState);
      this.persistMissionGateState(gateState);
      this.missionProgressController.enqueueMissionProgressUpsert({
        gateState,
        completedStepKey: evaluation.completedStepKey,
        toastMessage: evaluation.completionToastMessage,
      });
      this.invokePluginHook('onScan', { sample, gateState });
    }
  }

  /**
   * Invoke a `MissionScenePlugin` lifecycle hook. Hooks are advisory: any
   * exception is caught and logged so plugin authors cannot destabilize the
   * scene.
   */
  private invokePluginHook<K extends keyof MissionScenePlugin['hooks']>(
    name: K,
    payload: Parameters<NonNullable<MissionScenePlugin['hooks'][K]>>[0],
  ): void {
    const hook = this.missionScenePlugin.hooks[name] as
      | ((arg: typeof payload) => void)
      | undefined;
    if (!hook) {
      return;
    }
    try {
      hook(payload);
    } catch (error) {
      appLogger.warn(`MissionScenePlugin hook "${String(name)}" threw an error.`, error);
    }
  }

  private retryPendingMissionProgressSync(): void {
    this.missionProgressController.retryPendingMissionProgressSync();
  }

  private triggerHotkeyLaunchFlash(hotkey: 1 | 2 | 3 | 4 | 5): void {
    this.hotkeyFlashController.trigger(hotkey);
  }

  protected onAsteroidHoverChange(event: AsteroidHoverEvent): void {
    if (this.flightModeEnabled()) {
      return;
    }

    if (event.hovering) {
      if (!this.activeSensorArrayCapabilities()) {
        this.setLaunchToast('Sensor array unavailable. Install a sensor array to scan asteroids.', 'error', null);
        this.activeScanAsteroidId.set(null);
        return;
      }
      const previousActiveId = this.activeScanAsteroidId();
      if (previousActiveId && previousActiveId !== event.id) {
        this.resetPartialScanProgress(previousActiveId);
      }
      this.activeScanAsteroidId.set(event.id);
      return;
    }

    this.resetPartialScanProgress(event.id);

    if (this.activeScanAsteroidId() === event.id) {
      this.activeScanAsteroidId.set(null);
    }
  }

  protected onAsteroidRightPointerDown(event: { id: string; button: number }): void {
    if (this.flightModeEnabled()) {
      return;
    }

    if (event.button !== 2 || !this.canTargetAsteroids()) {
      return;
    }

    this.beginTargetHold(event.id);
  }

  protected onAsteroidRightPointerUp(event: { id: string; button: number }): void {
    if (this.flightModeEnabled()) {
      return;
    }

    if (event.button !== 2) {
      return;
    }

    this.clearTargetHoldTimer();
  }

  protected onDebrisRightPointerDown(event: FloatingDebrisPointerEvent): void {
    if (this.flightModeEnabled()) {
      return;
    }
    if (event.button !== 2) {
      return;
    }
    this.beginDebrisTargetHold(event.id);
  }

  protected onDebrisRightPointerUp(event: FloatingDebrisPointerEvent): void {
    if (this.flightModeEnabled()) {
      return;
    }
    if (event.button !== 2) {
      return;
    }
    this.clearTargetHoldTimer();
  }

  protected onDebrisHoverChange(event: FloatingDebrisHoverEvent): void {
    if (event.hovering) {
      this.hoveredDebrisId.set(event.id);
      return;
    }
    if (this.hoveredDebrisId() === event.id) {
      this.hoveredDebrisId.set(null);
    }
  }

  private beginTargetHold(asteroidId: string): void {
    const targetHoldMs = this.resolveTargetHoldDurationMs();
    if (targetHoldMs === null) {
      return;
    }

    this.sessionController.beginTargetHold(
      asteroidId,
      () => {
        this.targetedAsteroidId.set(asteroidId);
        this.targetedDebrisId.set(null);
        this.activeTarget.set({ kind: 'asteroid', id: asteroidId });
      },
      targetHoldMs,
    );
  }

  private beginDebrisTargetHold(debrisId: string): void {
    const targetHoldMs = this.resolveTargetHoldDurationMs();
    if (targetHoldMs === null) {
      return;
    }

    this.sessionController.beginTargetHold(
      debrisId,
      () => {
        this.targetedDebrisId.set(debrisId);
        this.targetedAsteroidId.set(null);
        this.activeTarget.set({ kind: 'debris', id: debrisId });
      },
      targetHoldMs,
    );
  }

  private clearTargetHoldTimer(): void {
    this.sessionController.clearTargetHoldTimer();
  }

  protected debrisScenePosition(item: FloatingDebrisItem): [number, number, number] {
    const pullState = this.tractorBeamAnimationState();
    if (pullState && pullState.debrisId === item.id) {
      return this.debrisScenePositionFromKm(pullState.currentPositionKm);
    }

    const ship = this.activeShipLocationKm() ?? { x: 0, y: 0, z: 0 };
    const scale = ShipExteriorViewScene.DEBRIS_KM_TO_SCENE_UNITS;
    return [
      (item.positionKm.x - ship.x) * scale,
      (item.positionKm.y - ship.y) * scale,
      (item.positionKm.z - ship.z) * scale,
    ];
  }

  private debrisScenePositionFromKm(positionKm: Triple): [number, number, number] {
    const ship = this.activeShipLocationKm() ?? { x: 0, y: 0, z: 0 };
    const scale = ShipExteriorViewScene.DEBRIS_KM_TO_SCENE_UNITS;
    return [
      (positionKm.x - ship.x) * scale,
      (positionKm.y - ship.y) * scale,
      (positionKm.z - ship.z) * scale,
    ];
  }

  protected isDebrisTargeted(debrisId: string): boolean {
    const target = this.activeTarget();
    return !!target && target.kind === 'debris' && target.id === debrisId;
  }

  private tryActivateTractorBeam(): void {
    if (this.tractorBeamAnimationState()) {
      this.setLaunchToast('Tractor beam is already active.', 'error', null);
      return;
    }

    const tractorBeamCapabilities = this.activeTractorBeamCapabilities();
    if (!tractorBeamCapabilities) {
      this.setLaunchToast('Tractor beam unavailable. Install an intact tractor beam to collect debris.', 'error', null);
      return;
    }

    const target = this.activeTarget();
    if (!target || target.kind !== 'debris') {
      this.setLaunchToast('Lock a debris target before activating the tractor beam.', 'error', null);
      return;
    }

    const debris = this.floatingDebrisItems().find((item) => item.id === target.id);
    if (!debris) {
      this.setLaunchToast('Targeted debris is no longer in range.', 'error', null);
      this.clearDebrisTarget();
      return;
    }

    const shipPosKm = this.activeShipLocationKm();
    if (!shipPosKm) {
      this.setLaunchToast('Ship location unknown. Cannot fire tractor beam.', 'error', null);
      return;
    }

    const dx = debris.positionKm.x - shipPosKm.x;
    const dy = debris.positionKm.y - shipPosKm.y;
    const dz = debris.positionKm.z - shipPosKm.z;
    const distanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distanceKm > tractorBeamCapabilities.maxRangeKm) {
      this.setLaunchToast(
        `Out of tractor range (${distanceKm.toFixed(1)} km > ${tractorBeamCapabilities.maxRangeKm.toFixed(1)} km).`,
        'error',
        null,
      );
      return;
    }

    this.startTractorBeamPull(debris, tractorBeamCapabilities);
  }

  private startTractorBeamPull(
    debris: FloatingDebrisItem,
    tractorBeamCapabilities: TractorBeamTierCapabilities,
  ): void {
    const nowMs = Date.now();
    this.tractorBeamAnimationState.set({
      debrisId: debris.id,
      itemType: debris.itemType,
      displayName: debris.displayName,
      startPositionKm: { ...debris.positionKm },
      currentPositionKm: { ...debris.positionKm },
      phase: 'pulling',
      phaseStartedAtMs: nowMs,
      phaseDurationMs: tractorBeamCapabilities.pullDurationMs,
      reverseFailureMessage: null,
    });
    this.tractorBeamAnimationClockMs.set(nowMs);
    this.tractorBeamAudioController.startLoop();
    this.startTractorBeamAnimationLoop();
    this.setLaunchToast(this.t.shipExterior.tractorBeam.collecting, 'success', null);
  }

  private startTractorBeamAnimationLoop(): void {
    if (this.tractorBeamAnimationIntervalId !== null) {
      return;
    }

    this.tractorBeamAnimationIntervalId = window.setInterval(
      () => this.tickTractorBeamAnimation(),
      ShipExteriorViewScene.TRACTOR_BEAM_ANIMATION_TICK_MS,
    );
  }

  private stopTractorBeamAnimationLoop(): void {
    if (this.tractorBeamAnimationIntervalId !== null) {
      window.clearInterval(this.tractorBeamAnimationIntervalId);
      this.tractorBeamAnimationIntervalId = null;
    }
  }

  private tickTractorBeamAnimation(): void {
    const state = this.tractorBeamAnimationState();
    if (!state) {
      this.stopTractorBeamAnimationLoop();
      return;
    }

    const nowMs = Date.now();
    this.tractorBeamAnimationClockMs.set(nowMs);

    if (state.phase === 'committing') {
      return;
    }

    const elapsedMs = Math.max(0, nowMs - state.phaseStartedAtMs);
    const t = Math.max(0, Math.min(1, elapsedMs / Math.max(1, state.phaseDurationMs)));
    const eased = 1 - Math.pow(1 - t, 3);
    const bayKm = this.activeShipLocationKm() ?? { x: 0, y: 0, z: 0 };

    const from = state.phase === 'pulling' ? state.startPositionKm : bayKm;
    const to = state.phase === 'pulling' ? bayKm : state.startPositionKm;
    const nextPosition: Triple = {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      z: from.z + (to.z - from.z) * eased,
    };

    this.tractorBeamAnimationState.set({
      ...state,
      currentPositionKm: nextPosition,
    });

    if (t < 1) {
      return;
    }

    if (state.phase === 'pulling') {
      this.commitTractorBeamCollection(state);
      return;
    }

    if (state.phase === 'reversing') {
      const reverseMessage = state.reverseFailureMessage ?? 'unknown error';
      this.tractorBeamAnimationState.set(null);
      this.stopTractorBeamAnimationLoop();
      this.tractorBeamAudioController.stopLoop();
      this.setLaunchToast(`Tractor beam failed: ${reverseMessage}.`, 'error', null);
    }
  }

  private commitTractorBeamCollection(state: TractorBeamAnimationState): void {
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const playerName = this.playerName().trim();
    const shipId = this.activeShipId().trim();
    const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
    if (!sessionKey || !playerName || !shipId || !characterId) {
      this.tractorBeamAnimationState.set(null);
      this.stopTractorBeamAnimationLoop();
      this.tractorBeamAudioController.stopLoop();
      this.setLaunchToast('Missing player/ship context. Cannot fire tractor beam.', 'error', null);
      return;
    }

    const settledAtBay = this.activeShipLocationKm() ?? state.currentPositionKm;
    this.tractorBeamAnimationState.set({
      ...state,
      phase: 'committing',
      phaseStartedAtMs: Date.now(),
      phaseDurationMs: 1,
      currentPositionKm: {
        x: settledAtBay.x,
        y: settledAtBay.y,
        z: settledAtBay.z,
      },
    });

    this.socketService.upsertItem(
      {
        playerName,
        sessionKey,
        correlationSource: 'ship-exterior.tractor-beam',
        item: {
          id: state.debrisId,
          itemType: state.itemType,
          displayName: state.displayName,
          state: 'contained',
          container: { containerType: 'ship', containerId: shipId },
          spatial: null,
          motion: null,
          owningPlayerId: playerName,
          owningCharacterId: characterId,
        },
      },
      (response: ItemUpsertResponse) => {
        if (response.success) {
          this.floatingDebrisStateService.removeById(state.debrisId);
          this.clearDebrisTarget();
          this.tractorBeamAnimationState.set(null);
          this.stopTractorBeamAnimationLoop();
          this.tractorBeamAudioController.stopLoop();
          this.tractorBeamAudioController.playCompletionChime();
          this.setLaunchToast(
            interpolateTemplate(this.t.shipExterior.tractorBeam.collected, { name: state.displayName }),
            'success',
            null,
          );
          return;
        }

        const current = this.tractorBeamAnimationState();
        if (!current || current.debrisId !== state.debrisId) {
          return;
        }

        this.tractorBeamAnimationState.set({
          ...current,
          phase: 'reversing',
          phaseStartedAtMs: Date.now(),
          phaseDurationMs: ShipExteriorViewScene.TRACTOR_BEAM_REVERSE_DURATION_MS,
          reverseFailureMessage: response.message || 'unknown error',
        });
      },
    );
  }

  private resolveTractorBeamVisualState(): TractorBeamVisualState | null {
    return buildTractorBeamVisualState({
      state: this.tractorBeamAnimationState(),
      elapsedMs: this.tractorBeamAnimationClockMs(),
      particleCount: ShipExteriorViewScene.TRACTOR_BEAM_PARTICLE_COUNT,
      debrisScenePositionFromKm: (positionKm) => this.debrisScenePositionFromKm(positionKm),
    });
  }

  private clearDebrisTarget(): void {
    this.targetedDebrisId.set(null);
    if (this.activeTarget()?.kind === 'debris') {
      this.activeTarget.set(null);
    }
  }

  private tickScene(): void {
    // --- Phase 3: Frame-pressure sampling ---
    const now = performance.now();
    if (this.lastTickTimestamp !== null) {
      const delta = now - this.lastTickTimestamp;
      this.framePressureSampler.addSample(delta);
      // Best guess: 16.7ms (60fps) = 1.0, 33ms (30fps) = 0.5, 50ms+ = 0.2
      let scaler = 1;
      if (delta > 50) scaler = 0.2;
      else if (delta > 33) scaler = 0.5;
      else if (delta > 20) scaler = 0.8;
      else scaler = 1;
      // Rolling average for stability
      const avg = this.framePressureSampler.getAverage();
      if (avg > 50) scaler = 0.2;
      else if (avg > 33) scaler = 0.5;
      else if (avg > 20) scaler = 0.8;
      else scaler = 1;
      this._qualityScaler.set(scaler);
    }
    this.lastTickTimestamp = now;

    const scanCapabilities = this.activeSensorArrayCapabilities();
    const scanTickMs = scanCapabilities?.scanTickMs ?? ShipExteriorViewScene.SCAN_TICK_MS;
    const scanStep = this.resolveScanStep(scanCapabilities);

    this.sceneElapsedSeconds += scanTickMs / 1000;
    if (!this.sceneEnvironmentInstalled) {
      this.installSceneEnvironment();
    }
    const activeId = this.activeScanAsteroidId();
    let completedScanThisTick = false;
    const completedSampleIds: string[] = [];
    this.asteroidSamples.update((samples) =>
      samples.map((sample) => {
        const animatedPosition = this.resolveAsteroidPosition(sample, this.sceneElapsedSeconds, activeId);

        if (!activeId || scanStep <= 0 || sample.id !== activeId || sample.scanned) {
          if (
            sample.position[0] === animatedPosition[0] &&
            sample.position[1] === animatedPosition[1] &&
            sample.position[2] === animatedPosition[2]
          ) {
            return sample;
          }
          return {
            ...sample,
            position: animatedPosition,
          };
        }

        const nextProgress = Math.min(100, sample.scanProgress + scanStep);
        const completedNow = nextProgress >= 100;
        const revealedMaterial = completedNow
          ? (sample.revealedMaterial ?? pickWeightedAsteroidMaterial())
          : sample.revealedMaterial;
        const revealedKinematics = completedNow
          ? (sample.revealedKinematics ?? sample.capturedKinematics)
          : sample.revealedKinematics;

        if (completedNow && !sample.scanned) {
          completedScanThisTick = true;
          completedSampleIds.push(sample.id);
          if (sample.serverCelestialBodyId) {
            this.emitCelestialBodyUpsert(sample, 'active', revealedMaterial, revealedKinematics);
          } else {
            // Seeded unscanned record has not returned an id yet; queue active update.
            this.pendingActiveStateUpserts.add(sample.id);
          }
        }

        return {
          ...sample,
          position: animatedPosition,
          scanProgress: nextProgress,
          scanned: completedNow,
          externalObjectDescriptor: resolveAsteroidExternalObjectDescriptor({
            sampleId: sample.id,
            revealedMaterial,
            fallbackTier: completedNow ? 'hero' : 'standard',
          }),
          revealedMaterial,
          revealedKinematics,
        };
      }),
    );
    if (completedScanThisTick) {
      this.persistAsteroidSamples();
      this.retryPendingMissionProgressSync();
      this.evaluateMissionGateForCompletedSamples(completedSampleIds);
    }
  }

  private emitCelestialBodyUpsert(
    sample: AsteroidScanSample,
    state: 'unscanned' | 'active' | 'destroyed',
    revealedMaterial: AsteroidMaterialProfile | null,
    revealedKinematics: AsteroidKinematics | null,
  ): void {
    this.celestialBodyController.enqueueCelestialBodyUpsert(
      sample,
      state,
      revealedMaterial,
      revealedKinematics,
    );
  }

  private resetPartialScanProgress(sampleId: string): void {
    this.asteroidSamples.update((samples) =>
      samples.map((sample) => {
        if (sample.id !== sampleId || sample.scanned || sample.scanProgress <= 0) {
          return sample;
        }

        return {
          ...sample,
          scanProgress: 0,
        };
      }),
    );
  }

  private resolveActiveSensorArrayCapabilities(): ItemTierCapabilities | null {
    const activeShip = this.sessionService.activeShip() ?? this.navigationState.joinShip ?? null;
    const highestInstalledTier = (activeShip?.inventory ?? []).reduce<number | null>((highestTier, item) => {
      if (
        item.itemType !== ShipExteriorViewScene.SENSOR_ARRAY_ITEM_TYPE ||
        item.state === 'destroyed' ||
        item.damageStatus === 'destroyed'
      ) {
        return highestTier;
      }

      const itemTier = typeof item.tier === 'number' ? item.tier : 1;
      return highestTier === null ? itemTier : Math.max(highestTier, itemTier);
    }, null);
    if (highestInstalledTier === null) {
      return null;
    }

    return resolveSensorArrayCapabilities(highestInstalledTier);
  }

  private resolveScanStep(capabilities: ItemTierCapabilities | null): number {
    if (!capabilities) {
      return 0;
    }

    const durationMs = Math.max(capabilities.scanTickMs, capabilities.scanDurationMs);
    const totalTicks = durationMs / capabilities.scanTickMs;
    return 100 / totalTicks;
  }

  private resolveTargetHoldDurationMs(): number | null {
    const capabilities = this.activeSensorArrayCapabilities();
    if (!capabilities) {
      this.setLaunchToast('Sensor array unavailable. Install a sensor array to target objects.', 'error', null);
      return null;
    }

    return capabilities.scanDurationMs;
  }

  private resolveActiveTractorBeamCapabilities(): TractorBeamTierCapabilities | null {
    const activeShip = this.sessionService.activeShip() ?? this.navigationState.joinShip ?? null;
    const tractorBeamItems = (activeShip?.inventory ?? []).filter(
      (item) => item.itemType === ShipExteriorViewScene.TRACTOR_BEAM_ITEM_TYPE && item.state !== 'destroyed',
    );

    if (tractorBeamItems.length === 0) {
      // Preserve current gameplay until the backend consistently surfaces the
      // installed tractor beam in ship inventory payloads.
      return resolveTractorBeamCapabilities(1);
    }

    const highestInstalledTier = tractorBeamItems.reduce<number | null>((highestTier, item) => {
      if (item.damageStatus !== 'intact') {
        return highestTier;
      }

      const itemTier = typeof item.tier === 'number' ? item.tier : 1;
      return highestTier === null ? itemTier : Math.max(highestTier, itemTier);
    }, null);

    if (highestInstalledTier === null) {
      return null;
    }

    return resolveTractorBeamCapabilities(highestInstalledTier);
  }

  private hasOnlyNonIntactTractorBeamInstalled(): boolean {
    const activeShip = this.sessionService.activeShip() ?? this.navigationState.joinShip ?? null;
    const tractorBeamItems = (activeShip?.inventory ?? []).filter(
      (item) => item.itemType === ShipExteriorViewScene.TRACTOR_BEAM_ITEM_TYPE && item.state !== 'destroyed',
    );

    return tractorBeamItems.length > 0 && tractorBeamItems.every((item) => item.damageStatus !== 'intact');
  }

  hidePropertiesPanel(): void {
    this.propertiesPanelHidden.set(true);
  }

  revealPropertiesPanel(): void {
    this.propertiesPanelHidden.set(false);
  }
}
