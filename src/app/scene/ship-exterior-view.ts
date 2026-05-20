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
import { Euler, PMREMGenerator, Quaternion, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { NgtArgs, injectStore } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { environment } from '../../environments/environment';
import { Asteroid, type AsteroidHoverEvent } from '../component/asteroid';
import { BackgroundStars } from '../component/background-stars';
import { Sol } from '../component/sol';
import { FramePressureSampler } from './ship-exterior/frame-pressure-sampler';
import {
  clearMissionGatePendingRetry,
  createInitialMissionGateState,
  evaluateMissionGateOnLaunch,
  evaluateMissionGateOnManufacture,
  evaluateMissionGateOnRepair,
  evaluateMissionGateOnScan,
  hasMissionGatePendingRetry,
  markMissionGateStepPendingRetry,
  parseMissionGateState,
  serializeMissionGateState,
  type ShipExteriorMissionGateState,
  type ShipExteriorMissionGateStepStatus,
} from '../mission/ship-exterior-mission';
import {
  resolveMissionScenePlugin,
  type MissionScenePlugin,
} from '../mission/mission-scene-plugin';
// Side-effect import: register additional missions and their plugin factories
// so `resolveMissionScenePlugin` can resolve them when the navigation state
// targets one of these missions.
import '../mission/generic-exploration-ship-exterior-mission';
import { pickWeightedAsteroidMaterial, type AsteroidMaterialProfile } from '../model/catalog/asteroid-materials';
import { type CelestialBodyListRequest, type CelestialBodyListResponse } from '../model/celestial-body-list';
import {
  DEFAULT_SOLAR_SYSTEM_ID,
  type CelestialBodyUpsertRequest,
  type CelestialBodyUpsertResponse,
} from '../model/celestial-body-upsert';
import { PlayerCharacterSummary } from '../model/character-list';
import { type LaunchItemRequest, type LaunchItemResponse } from '../model/launch-item';
import { type AsteroidKinematics } from '../model/math/asteroid-kinematics';
import { DEFAULT_CLUSTER_SPREAD_KM } from '../model/math/celestial-body-location';
import { type MissionStatus } from '../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { Triple } from '../model/shared/triple';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import {
  resolveShipExteriorViewSeedPolicy,
  type ShipExteriorViewMissionContext,
} from '../model/ship-exterior-view-context';
import type { ShipItem } from '../model/ship-item';
import {
  assignAsteroidRenderTiers,
  DEFAULT_ASTEROID_TIER_CAPS,
  DEFAULT_ASTEROID_TIER_DISTANCES,
  resolveAsteroidTierDetailOverride,
  type AsteroidRenderTier,
} from './ship-exterior/asteroid-tier-selection';
import {
  coerceShipInventory,
  coerceShipModel,
  type ShipListRequest,
  type ShipListResponse,
  type ShipSummary,
} from '../model/ship-list';
import { appLogger } from '../services/logger';
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
import { SocketService } from '../services/socket.service';
import {
  ASTRONOMICAL_UNIT_KM,
  DEFAULT_SHIP_SUN_DISTANCE_KM,
  cloneForTest,
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
import {
  applyMouseLook,
  integrateFlightStep,
  quantizeCoordinate,
  resolveMovementInput,
  type FlightOrientation,
} from './ship-exterior/ship-exterior-flight-controls';
import { AsyncSerialQueue } from './ship-exterior/async-serial-queue';
import { HotkeyFlashController } from './ship-exterior/hotkey-flash-controller';
import { LaunchToastController, type LaunchFeedbackToast } from './ship-exterior/launch-toast-controller';
import { ShipExteriorLaunchController } from './ship-exterior/ship-exterior-launch-controller';
import { ShipExteriorCelestialBodyController } from './ship-exterior/ship-exterior-celestial-body-controller';
import { ShipExteriorMissionProgressController } from './ship-exterior/ship-exterior-mission-progress-controller';
import { ShipExteriorBootstrapController } from './ship-exterior/ship-exterior-bootstrap-controller';
import { ShipExteriorSessionController } from './ship-exterior/ship-exterior-session-controller';
import { ShipDamageController } from './ship-exterior/ship-damage-controller';

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

interface CelestialBodyUpsertQueueItem {
  sampleId: string;
  state: 'unscanned' | 'active' | 'destroyed';
  revealedMaterial: AsteroidMaterialProfile | null;
  revealedKinematics: AsteroidKinematics | null;
}

interface MissionProgressUpsertQueueItem {
  gateState: ShipExteriorMissionGateState;
  completedStepKey: string | null;
  toastMessage: string | null;
}

interface ShipExteriorViewTestApi {
  getMissionGateState(): ShipExteriorMissionGateState | null;
  getMissionObjectiveText(): string;
  getAsteroidSamples(): AsteroidScanSample[];
  getTargetedAsteroidId(): string | null;
  hoverAsteroid(sampleId: string): boolean;
  unhoverAsteroid(sampleId: string): boolean;
  forceTargetAsteroid(sampleId: string): boolean;
  tickScanTicks(ticks?: number): AsteroidScanSample[];
  forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null;
  simulateManufacture(itemType: string): ShipExteriorMissionGateState | null;
  simulateRepair(repairKind: string): ShipExteriorMissionGateState | null;
  launchFromHotkey(hotkey: 1 | 2 | 3 | 4 | 5): void;
  clearToast(): void;
}

declare global {
  interface Window {
    __shipExteriorTestUtils?: ShipExteriorViewTestApi;
  }
}

@Component({
  selector: 'app-ship-exterior-view-scene',
  templateUrl: './ship-exterior-view.html',
  imports: [NgtArgs, NgtsOrbitControls, Asteroid, BackgroundStars, Sol],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Real-time ship-exterior scene controller for scanning, mission gating, and launch actions.
 */
export default class ShipExteriorViewScene implements OnInit, OnDestroy {
  // --- Phase 3: Frame-pressure & Quality Scaler ---
  private readonly framePressureSampler = new FramePressureSampler(30); // Configurable window size
  private lastTickTimestamp: number | null = null;
  private readonly _qualityScaler = signal(1); // [0,1], 1 = best quality
  private readonly qualityScaler = this._qualityScaler;
  private readonly framePressureAvg = computed(() => this.framePressureSampler.getAverage());
  private static readonly SCAN_TICK_MS = 100;
  private static readonly SCAN_TOTAL_MS = 10000;
  private static readonly SCAN_STEP = 100 / (ShipExteriorViewScene.SCAN_TOTAL_MS / ShipExteriorViewScene.SCAN_TICK_MS);
  private static readonly TARGET_HOLD_MS = 250;
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

  private router = inject(Router);
  private socketService = inject(SocketService);
  private shipExteriorSocketService = inject(ShipExteriorSocketService);
  private sessionService = inject(SessionService);
  private missionService = inject(MissionService);
  private asteroidStateService = inject(ShipExteriorAsteroidStateService);
  private missionStateService = inject(ShipExteriorMissionStateService);
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
  private flightTickIntervalId: number | null = null;
  private flightTrackingAccumulatorMs = 0;
  private readonly flightPressedKeys = new Set<string>();
  private flightOrientation = signal<FlightOrientation>({ yawRad: 0, pitchRad: 0, rollRad: 0 });
  // Camera orientation polled from the live Three.js camera each tick. Used for VIEW/MOVE
  // displays when flight mode is OFF (so they reflect OrbitControls rotation).
  private cameraOrientation = signal<FlightOrientation>({ yawRad: 0, pitchRad: 0, rollRad: 0 });
  private flightDisplacementScene: Triple = { x: 0, y: 0, z: 0 };
  private flightCurrentLocationKm: Triple = { x: 0, y: 0, z: 0 };
  private unsubscribeShipListResponse?: () => void;
  private unsubscribeCelestialBodyListResponse?: () => void;
  private unsubscribeLaunchItemResponse?: () => void;
  private launchSeedHint: number | null = null;
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
  protected hasExpendableDartDrone = signal(
    this.missionDefinition.resolveTargetingCapabilityFromInventory(this.navigationState.joinShip?.inventory),
  );
  private activeShipId = signal(this.navigationState.joinShip?.id?.trim() ?? '');
  private activeShipLocationKm = signal<Triple | null>(this.resolveNavigationShipLocationKm());
  private activeSolarSystemId = signal(this.resolveNavigationSolarSystemId());
  private launchableInventory = signal(this.resolveLaunchableInventory(this.navigationState.joinShip?.inventory));
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
  private missionGateState = signal<ShipExteriorMissionGateState | null>(null);
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
  readonly flightModeEnabled = signal(false);
  readonly flightPointerLocked = signal(false);
  readonly flightInvertY = signal(false);
  readonly flightMouseSensitivity = signal(ShipExteriorViewScene.FLIGHT_DEFAULT_MOUSE_SENSITIVITY);
  readonly flightSpeedKmPerSec = signal(0);
  readonly flightWorldOffset = signal<[number, number, number]>([0, 0, 0]);
  readonly flightWorldRotation = signal<[number, number, number]>([0, 0, 0]);
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
  protected asteroidSamples = signal<AsteroidScanSample[]>([]);
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

  resolveAsteroidRenderTier(sampleId: string): AsteroidRenderTier {
    return this.asteroidRenderTiers().get(sampleId) ?? 'background';
  }
  resolveAsteroidDetailOverride(sample: AsteroidScanSample): number | null {
    const tier = this.resolveAsteroidRenderTier(sample.id);
    return resolveAsteroidTierDetailOverride(tier, sample.scanned);
  }
  readonly showPropertiesPanel = computed(() => !!this.hoveredScannedAsteroid() && !this.propertiesPanelHidden());
  readonly showPropertiesPanelReveal = computed(() => !!this.hoveredScannedAsteroid() && this.propertiesPanelHidden());
  readonly propertiesPanelTitle = computed(() => {
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
    this.flightCurrentLocationKm = this.resolveNavigationShipLocationKm() ?? { x: 0, y: 0, z: 0 };
    this.socketService.connect(this.socketService.serverUrl);
    this.installSceneEnvironment();
    this.initializeMissionGateState();
    this.refreshMissionGateStateFromBackend();
    this.registerTestUtils();
    this.unsubscribeLaunchItemResponse = this.shipExteriorSocketService.subscribeLaunchResponses(
      (response: LaunchItemResponse) => this.handleLaunchItemResponse(response),
    );
    const seedPolicy = this.resolveSeedPolicy();
    if (seedPolicy === 'new') {
      this.clearPersistedAsteroidSamples();
      this.clearPersistedMissionGateState();
      this.initializeMissionGateState();
    }
    if (seedPolicy === 'resume') {
      if (!this.restorePersistedAsteroidSamples()) {
        this.bootstrapController.seedAsteroidsForInProgressMission();
      } else {
        this.refreshShipStateAfterLaunch();
      }
    } else {
      this.bootstrapController.seedAsteroidsAroundStarterShip();
    }
    this.sessionController.startScanLoop(() => this.tickScene(), ShipExteriorViewScene.SCAN_TICK_MS);
    this.startFlightLoop();
    window.addEventListener('pointerdown', this.onWindowPointerDown);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('contextmenu', this.onWindowContextMenu);
    window.addEventListener('keydown', this.onWindowKeyDown);
    window.addEventListener('keyup', this.onWindowKeyUp);
    window.addEventListener('mousemove', this.onWindowMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private resolveSeedPolicy(): 'new' | 'resume' {
    const missionStatusHint =
      this.navigationState.missionContext?.missionStatusHint ?? this.navigationState.firstTargetMissionStatus;

    return resolveShipExteriorViewSeedPolicy({
      seedPolicy: this.navigationState.missionContext?.seedPolicy,
      missionStatusHint,
    });
  }

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
      const normalizedStatus = mission.status?.trim().toLowerCase();
      if (normalizedStatus === 'started') {
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

      if (normalizedStatus === 'in-progress' || normalizedStatus === 'paused') {
        const reconciled = this.reconcileInProgressGateStateWithoutStatusDetail(this.missionGateState());
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
    this.bootstrapController.dispose();
    this.sessionController.dispose();
    this.stopFlightLoop();
    this.disposeSceneEnvironment();
    window.removeEventListener('pointerdown', this.onWindowPointerDown);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('contextmenu', this.onWindowContextMenu);
    window.removeEventListener('keydown', this.onWindowKeyDown);
    window.removeEventListener('keyup', this.onWindowKeyUp);
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.hotkeyFlashController.dispose();
    this.launchToastController.dispose();
  }

  setFlightModeEnabled(enabled: boolean): void {
    this.flightModeEnabled.set(enabled);
    this.flightPressedKeys.clear();
    this.flightTrackingAccumulatorMs = 0;
    this.flightSpeedKmPerSec.set(0);
    this.clearTargetHoldTimer();
    this.activeScanAsteroidId.set(null);
    if (enabled) {
      // Reset camera to a canonical orientation facing -Z so flight math aligns with the camera view.
      this.resetCameraForFlight();
      // Reset flight orientation and displacement so we start from a clean slate.
      this.flightOrientation.set({ yawRad: 0, pitchRad: 0, rollRad: 0 });
      this.flightDisplacementScene = { x: 0, y: 0, z: 0 };
      this.syncFlightWorldTransform();
    } else {
      this.exitPointerLockIfHeld();
    }
  }

  private resetCameraForFlight(): void {
    const camera = this.store?.snapshot.camera;
    if (!camera) {
      return;
    }
    // Position the camera so its forward direction is exactly -Z.
    camera.position.set(0, 0, 6.6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
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

  // Polls the live Three.js camera and pushes its yaw/pitch/roll into `cameraOrientation`.
  // Used to drive the VIEW / MOVE diagnostic lines when flight mode is OFF (OrbitControls active).
  private pollCameraOrientation(): void {
    const camera = this.store?.snapshot.camera;
    if (!camera) {
      return;
    }
    const euler = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const current = this.cameraOrientation();
    const next: FlightOrientation = {
      yawRad: euler.y,
      pitchRad: euler.x,
      rollRad: euler.z,
    };
    // Avoid pointless signal churn when nothing changed (sub-milliradian threshold).
    if (
      Math.abs(next.yawRad - current.yawRad) < 1e-4 &&
      Math.abs(next.pitchRad - current.pitchRad) < 1e-4 &&
      Math.abs(next.rollRad - current.rollRad) < 1e-4
    ) {
      return;
    }
    this.cameraOrientation.set(next);
  }

  toggleFlightMode(): void {
    this.setFlightModeEnabled(!this.flightModeEnabled());
  }

  setFlightInvertY(enabled: boolean): void {
    this.flightInvertY.set(enabled);
  }

  setFlightMouseSensitivity(rawValue: number): void {
    const clamped = Math.max(
      ShipExteriorViewScene.FLIGHT_MOUSE_SENSITIVITY_MIN,
      Math.min(ShipExteriorViewScene.FLIGHT_MOUSE_SENSITIVITY_MAX, rawValue),
    );
    this.flightMouseSensitivity.set(clamped);
  }

  getFlightMouseSensitivitySliderValue(): number {
    return Math.round(this.flightMouseSensitivity() * 10000);
  }

  setFlightMouseSensitivityFromSliderValue(rawValue: number): void {
    this.setFlightMouseSensitivity(rawValue / 10000);
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

      if (this.captureFlightMovementKey(event.code)) {
        event.preventDefault();
        return;
      }
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
    if (!this.flightModeEnabled()) {
      return;
    }

    if (this.flightPressedKeys.delete(event.code)) {
      event.preventDefault();
    }
  };

  private onWindowMouseMove = (event: MouseEvent): void => {
    if (!this.flightModeEnabled() || !this.flightPointerLocked()) {
      return;
    }

    this.flightOrientation.set(applyMouseLook(this.flightOrientation(), event.movementX, event.movementY, {
      sensitivity: this.flightMouseSensitivity(),
      invertY: this.flightInvertY(),
      maxPitchRad: ShipExteriorViewScene.FLIGHT_MAX_PITCH_RAD,
    }));
    this.syncFlightWorldTransform();
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

  private captureFlightMovementKey(code: string): boolean {
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'Space' ||
      code === 'ControlLeft' ||
      code === 'ControlRight' ||
      code === 'KeyC' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'KeyQ' ||
      code === 'KeyE'
    ) {
      this.flightPressedKeys.add(code);
      return true;
    }

    return false;
  }

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

  private startFlightLoop(): void {
    this.stopFlightLoop();
    this.flightTickIntervalId = window.setInterval(() => this.tickFlight(), ShipExteriorViewScene.FLIGHT_TICK_MS);
  }

  private stopFlightLoop(): void {
    if (this.flightTickIntervalId !== null) {
      clearInterval(this.flightTickIntervalId);
      this.flightTickIntervalId = null;
    }
  }

  private tickFlight(): void {
    if (!this.flightModeEnabled()) {
      this.pollCameraOrientation();
      return;
    }

    const step = integrateFlightStep(
      this.flightOrientation(),
      resolveMovementInput(this.flightPressedKeys),
      {
        deltaSeconds: ShipExteriorViewScene.FLIGHT_TICK_MS / 1000,
        baseSpeedSceneUnitsPerSec: ShipExteriorViewScene.FLIGHT_BASE_SPEED_SCENE_UNITS_PER_SEC,
        boostMultiplier: ShipExteriorViewScene.FLIGHT_BOOST_MULTIPLIER,
        rollSpeedRadPerSec: ShipExteriorViewScene.FLIGHT_ROLL_SPEED_RAD_PER_SEC,
      },
    );
    this.flightOrientation.set(step.orientation);
    this.flightSpeedKmPerSec.set(step.speedSceneUnitsPerSec * ShipExteriorViewScene.FLIGHT_SCENE_UNIT_TO_KM);

    if (step.speedSceneUnitsPerSec <= 0) {
      this.syncFlightWorldTransform();
      return;
    }

    this.flightDisplacementScene = {
      x: this.flightDisplacementScene.x + step.worldDelta.x,
      y: this.flightDisplacementScene.y + step.worldDelta.y,
      z: this.flightDisplacementScene.z + step.worldDelta.z,
    };

    const kmScale = ShipExteriorViewScene.FLIGHT_SCENE_UNIT_TO_KM;
    this.flightCurrentLocationKm = {
      x: this.flightCurrentLocationKm.x + step.worldDelta.x * kmScale,
      y: this.flightCurrentLocationKm.y + step.worldDelta.y * kmScale,
      z: this.flightCurrentLocationKm.z + step.worldDelta.z * kmScale,
    };

    this.flightTrackingAccumulatorMs += ShipExteriorViewScene.FLIGHT_TICK_MS;
    if (this.flightTrackingAccumulatorMs >= ShipExteriorViewScene.FLIGHT_TRACKING_CHECKPOINT_MS) {
      this.commitFlightTrackingCheckpoint();
      this.flightTrackingAccumulatorMs = 0;
    }

    this.syncFlightWorldTransform();
  }

  private commitFlightTrackingCheckpoint(): void {
    const nextLocation: Triple = {
      x: quantizeCoordinate(this.flightCurrentLocationKm.x, ShipExteriorViewScene.FLIGHT_TRACKING_QUANTIZE_KM),
      y: quantizeCoordinate(this.flightCurrentLocationKm.y, ShipExteriorViewScene.FLIGHT_TRACKING_QUANTIZE_KM),
      z: quantizeCoordinate(this.flightCurrentLocationKm.z, ShipExteriorViewScene.FLIGHT_TRACKING_QUANTIZE_KM),
    };

    this.activeShipLocationKm.set(nextLocation);

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

  private syncFlightWorldTransform(): void {
    const orientation = this.flightOrientation();
    this.flightWorldOffset.set([
      +(-this.flightDisplacementScene.x).toFixed(3),
      +(-this.flightDisplacementScene.y).toFixed(3),
      +(-this.flightDisplacementScene.z).toFixed(3),
    ]);
    // Convert flight orientation (YXZ Euler) to world rotation (XYZ Euler via Quaternion).
    // Movement is calculated using YXZ order, but ngt-group expects XYZ order.
    // Use Quaternion as the common representation to avoid order confusion.
    const orientationQuaternion = new Quaternion().setFromEuler(
      new Euler(
        orientation.pitchRad,
        orientation.yawRad,
        orientation.rollRad,
        'YXZ',
      ),
    );
    // Convert the quaternion back to Euler angles, negated and in XYZ order (which ngt-group uses).
    const sceneEuler = new Euler().setFromQuaternion(orientationQuaternion.invert(), 'XYZ');
    this.flightWorldRotation.set([
      +(sceneEuler.x).toFixed(4),
      +(sceneEuler.y).toFixed(4),
      +(sceneEuler.z).toFixed(4),
    ]);
  }

  private updateTargetingCapabilityFromShipList(ships: ShipSummary[] | undefined): void {
    if (!Array.isArray(ships) || ships.length === 0) {
      return;
    }

    const navShipId = this.navigationState.joinShip?.id;
    const matchingShip = (navShipId ? ships.find((ship) => ship.id === navShipId) : undefined) ?? ships[0];
    const nextHasDrone = this.missionDefinition.resolveTargetingCapabilityFromInventory(matchingShip?.inventory);
    this.hasExpendableDartDrone.set(nextHasDrone);
    this.activeShipId.set(matchingShip?.id?.trim() ?? '');
    this.activeShipLocationKm.set(matchingShip?.spatial?.positionKm ?? null);
    if (!this.flightModeEnabled()) {
      this.flightCurrentLocationKm = matchingShip?.spatial?.positionKm ?? { x: 0, y: 0, z: 0 };
    }
    this.activeSolarSystemId.set(matchingShip?.spatial?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID);
    this.launchableInventory.set(this.resolveLaunchableInventory(matchingShip?.inventory));
    this.shipDamageController.resolveFromShipSummary(matchingShip);
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

    // Deliberate decision: rapid launches are allowed. Requests are emitted
    // immediately, and responses are consumed on one shared listener.
    this.shipExteriorSocketService.launchItem(request);
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
    const shipRequest: ShipListRequest = { playerName, characterId, sessionKey };
    this.unsubscribeShipListResponse = this.shipExteriorSocketService.listShips(
      shipRequest,
      (shipResponse: ShipListResponse) => {
        if (!shipResponse.success) {
          return;
        }

        this.updateTargetingCapabilityFromShipList(shipResponse.ships);
      },
    );
  }

  private setLaunchToast(message: string, tone: 'success' | 'error', seed: number | null): void {
    this.launchToastController.set(message, tone, seed);
  }

  private registerTestUtils(): void {
    if (environment.production || typeof window === 'undefined') {
      return;
    }

    window.__shipExteriorTestUtils = {
      getMissionGateState: () => {
        const gateState = this.missionGateState();
        return gateState ? cloneForTest(gateState) : null;
      },
      getMissionObjectiveText: () => this.missionObjectiveText(),
      getAsteroidSamples: () => cloneForTest(this.asteroidSamples()),
      getTargetedAsteroidId: () => this.targetedAsteroidId(),
      hoverAsteroid: (sampleId: string) => {
        const exists = this.asteroidSamples().some((sample) => sample.id === sampleId);
        if (!exists) {
          return false;
        }
        this.onAsteroidHoverChange({ id: sampleId, hovering: true });
        return true;
      },
      unhoverAsteroid: (sampleId: string) => {
        const exists = this.asteroidSamples().some((sample) => sample.id === sampleId);
        if (!exists) {
          return false;
        }
        this.onAsteroidHoverChange({ id: sampleId, hovering: false });
        return true;
      },
      forceTargetAsteroid: (sampleId: string) => {
        const exists = this.asteroidSamples().some((sample) => sample.id === sampleId);
        if (!exists || !this.canTargetAsteroids()) {
          return false;
        }
        this.targetedAsteroidId.set(sampleId);
        return true;
      },
      tickScanTicks: (ticks: number = 1) => {
        const safeTicks = Math.max(1, Math.min(500, Math.floor(ticks)));
        for (let index = 0; index < safeTicks; index += 1) {
          this.tickScene();
        }
        return cloneForTest(this.asteroidSamples());
      },
      forceCompleteIronScan: (sampleId?: string) => {
        const targetId = sampleId ?? this.asteroidSamples()[0]?.id;
        if (!targetId) {
          return null;
        }

        let updated = false;
        this.asteroidSamples.update((samples) =>
          samples.map((sample) => {
            if (sample.id !== targetId) {
              return sample;
            }
            updated = true;
            return {
              ...sample,
              scanProgress: 100,
              scanned: true,
              revealedMaterial: {
                rarity: 'Common',
                material: 'Iron',
                textureColor: '#8f8f8f',
              },
              revealedKinematics: sample.revealedKinematics ?? sample.capturedKinematics,
            };
          }),
        );

        if (!updated) {
          return this.missionGateState();
        }

        this.persistAsteroidSamples();
        this.evaluateMissionGateForCompletedSamples([targetId]);
        const gateState = this.missionGateState();
        return gateState ? cloneForTest(gateState) : null;
      },
      simulateManufacture: (itemType: string) => {
        const gateState = this.missionGateState();
        if (!gateState) {
          return null;
        }

        const evaluation = evaluateMissionGateOnManufacture({
          mission: this.missionDefinition,
          gateState,
          manufacturedItemType: itemType,
        });
        if (evaluation.changed) {
          this.missionGateState.set(evaluation.gateState);
          this.persistMissionGateState(evaluation.gateState);
          this.invokePluginHook('onManufacture', {
            manufacturedItemType: itemType,
            gateState: evaluation.gateState,
          });
        }
        return cloneForTest(this.missionGateState());
      },
      simulateRepair: (repairKind: string) => {
        const gateState = this.missionGateState();
        if (!gateState) {
          return null;
        }

        const evaluation = evaluateMissionGateOnRepair({
          mission: this.missionDefinition,
          gateState,
          repairKind,
        });
        if (evaluation.changed) {
          this.missionGateState.set(evaluation.gateState);
          this.persistMissionGateState(evaluation.gateState);
          this.invokePluginHook('onRepair', { repairKind, gateState: evaluation.gateState });
        }
        return cloneForTest(this.missionGateState());
      },
      launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => {
        this.launchFromHotkeySlot(hotkey);
      },
      clearToast: () => {
        this.launchToastController.clear();
      },
    };
  }

  private unregisterTestUtils(): void {
    if (environment.production || typeof window === 'undefined') {
      return;
    }

    if (window.__shipExteriorTestUtils) {
      delete window.__shipExteriorTestUtils;
    }
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

  private beginTargetHold(asteroidId: string): void {
    this.sessionController.beginTargetHold(
      asteroidId,
      () => this.targetedAsteroidId.set(asteroidId),
      ShipExteriorViewScene.TARGET_HOLD_MS,
    );
  }

  private clearTargetHoldTimer(): void {
    this.sessionController.clearTargetHoldTimer();
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

    this.sceneElapsedSeconds += ShipExteriorViewScene.SCAN_TICK_MS / 1000;
    if (!this.sceneEnvironmentInstalled) {
      this.installSceneEnvironment();
    }
    const activeId = this.activeScanAsteroidId();
    let completedScanThisTick = false;
    const completedSampleIds: string[] = [];
    this.asteroidSamples.update((samples) =>
      samples.map((sample) => {
        const animatedPosition = this.resolveAsteroidPosition(sample, this.sceneElapsedSeconds, activeId);

        if (!activeId || sample.id !== activeId || sample.scanned) {
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

        const nextProgress = Math.min(100, sample.scanProgress + ShipExteriorViewScene.SCAN_STEP);
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

  hidePropertiesPanel(): void {
    this.propertiesPanelHidden.set(true);
  }

  revealPropertiesPanel(): void {
    this.propertiesPanelHidden.set(false);
  }
}
