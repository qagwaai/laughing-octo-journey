import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	OnDestroy,
	OnInit,
	signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Asteroid, type AsteroidHoverEvent } from '../component/asteroid';
import { BackgroundStars } from '../component/background-stars';
import { Sol } from '../component/sol';
import { generateRandomAsteroidKinematics, type AsteroidKinematics } from '../model/asteroid-kinematics';
import { pickWeightedAsteroidMaterial, type AsteroidMaterialProfile } from '../model/asteroid-materials';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import {
	DEFAULT_SOLAR_SYSTEM_ID,
	type CelestialBodyUpsertRequest,
	type CelestialBodyUpsertResponse,
} from '../model/celestial-body-upsert';
import {
	CELESTIAL_BODY_LIST_REQUEST_EVENT,
	CELESTIAL_BODY_LIST_RESPONSE_EVENT,
	type CelestialBodyListRequest,
	type CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
	DEFAULT_CLUSTER_SPREAD_KM,
	type CelestialBodyLocation,
} from '../model/celestial-body-location';
import { type MissionStatus } from '../model/mission';
import { PlayerCharacterSummary } from '../model/character-list';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	coerceShipInventory,
	coerceShipModel,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../model/ship-list';
import type { ShipItem } from '../model/ship-item';
import {
	resolveShipExteriorViewSeedPolicy,
	type ShipExteriorViewMissionContext,
} from '../model/ship-exterior-view-context';
import { Triple } from '../model/triple';
import {
	LAUNCH_ITEM_REQUEST_EVENT,
	LAUNCH_ITEM_RESPONSE_EVENT,
	type LaunchItemRequest,
	type LaunchItemResponse,
} from '../model/launch-item';
import { resolveShipExteriorMission } from '../mission/ship-exterior-mission';
import { SessionService } from '../services/session.service';
import { SocketService } from '../services/socket.service';

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

interface SolarSystemSunConfig {
	color: string;
	radius: number;
}

interface LaunchFeedbackToast {
	message: string;
	tone: 'success' | 'error';
	seed: number | null;
}

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const DEFAULT_SHIP_SUN_DISTANCE_KM = 395_000_000;
const SOLAR_SYSTEM_SUN_CONFIGS: Record<string, SolarSystemSunConfig> = {
	sol: {
		color: '#f5ff6b',
		radius: 1,
	},
};
const DEFAULT_SUN_CONFIG: SolarSystemSunConfig = {
	color: '#f5ff6b',
	radius: 1,
};

function formatVelocityText(k: AsteroidKinematics | null): string {
	if (!k) {
		return 'VEL: ---';
	}

	const { x, y, z } = k.velocityKmPerSec;
	const speed = Math.sqrt(x * x + y * y + z * z);
	return `VEL: ${speed.toFixed(1)} km/s`;
}

function formatSpinText(k: AsteroidKinematics | null): string {
	if (!k) {
		return 'SPIN: ---';
	}

	const { x, y, z } = k.angularVelocityRadPerSec;
	const spin = Math.sqrt(x * x + y * y + z * z);
	return `SPIN: ${spin.toFixed(4)} rad/s`;
}

function formatMassText(k: AsteroidKinematics | null): string {
	if (!k) {
		return 'MASS: ---';
	}

	const kg = k.estimatedMassKg;
	if (kg >= 1e12) {
		return `MASS: ${(kg / 1e12).toFixed(2)}e12 kg`;
	}
	if (kg >= 1e9) {
		return `MASS: ${(kg / 1e9).toFixed(2)}e9 kg`;
	}
	return `MASS: ${kg.toFixed(0)} kg`;
}

function formatDiameterText(k: AsteroidKinematics | null): string {
	if (!k) {
		return 'DIAM: ---';
	}

	return k.estimatedDiameterM >= 1000
		? `DIAM: ${(k.estimatedDiameterM / 1000).toFixed(2)} km`
		: `DIAM: ${k.estimatedDiameterM} m`;
}

function formatLocationText(location: CelestialBodyLocation | null): string {
	if (!location) {
		return 'LOC(Mkm): ---';
	}

	const { x, y, z } = location.positionKm;
	const xM = (x / 1e6).toFixed(3);
	const yM = (y / 1e6).toFixed(3);
	const zM = (z / 1e6).toFixed(3);
	return `LOC(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
}

function formatClusterText(center: Triple | null): string {
	if (!center) {
		return 'CLUSTER(Mkm): ---';
	}

	const xM = (center.x / 1e6).toFixed(3);
	const yM = (center.y / 1e6).toFixed(3);
	const zM = (center.z / 1e6).toFixed(3);
	return `CLUSTER(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
}

function formatOffsetText(location: CelestialBodyLocation | null, center: Triple | null): string {
	if (!location || !center) {
		return 'OFFSET(km): ---';
	}

	const dx = location.positionKm.x - center.x;
	const dy = location.positionKm.y - center.y;
	const dz = location.positionKm.z - center.z;
	const distance = Math.hypot(dx, dy, dz);
	return `OFFSET(km): dX ${dx.toFixed(0)} dY ${dy.toFixed(0)} dZ ${dz.toFixed(0)} | R ${distance.toFixed(0)}`;
}

@Component({
	selector: 'app-ship-exterior-view-scene',
	templateUrl: './ship-exterior-view.html',
	imports: [NgtArgs, NgtsOrbitControls, Asteroid, BackgroundStars, Sol],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorViewScene implements OnInit, OnDestroy {
	private static readonly SCAN_TICK_MS = 100;
	private static readonly SCAN_TOTAL_MS = 10000;
	private static readonly SCAN_STEP = 100 / (ShipExteriorViewScene.SCAN_TOTAL_MS / ShipExteriorViewScene.SCAN_TICK_MS);
	private static readonly TARGET_HOLD_MS = 250;
	private static readonly ACTIVE_SCAN_MIN_MOTION_DAMPING = 0.15;
	private static readonly SCANNED_MOTION_DAMPING = 0.65;
	private static readonly HOTKEY_SLOT_COUNT = 5;
	private static readonly HOTKEY_LAUNCH_FLASH_MS = 220;
	private static readonly POST_LAUNCH_REFRESH_DEBOUNCE_MS = 90;
	private static readonly LAUNCH_TOAST_MS = 3200;
	private static readonly SOLAR_DISTANCE_SCENE_SCALE_KM = 5_500_000;
	private static readonly SUN_DISTANCE_MIN_SCENE_UNITS = 56;
	private static readonly SUN_DISTANCE_MAX_SCENE_UNITS = 120;

	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private scanIntervalId: number | null = null;
	private targetHoldTimeoutId: number | null = null;
	private hotkeyLaunchFlashTimeoutIds = new Map<1 | 2 | 3 | 4 | 5, number>();
	protected targetHoldCandidateId = signal<string | null>(null);
	private sceneElapsedSeconds = 0;
	private sentCelestialBodyUpserts = new Set<string>();
	private unsubscribeShipListResponse?: () => void;
	private unsubscribeCelestialBodyListResponse?: () => void;
	private unsubscribeLaunchItemResponse?: () => void;
	private launchToastTimeoutId: number | null = null;
	private postLaunchRefreshTimeoutId: number | null = null;
	private launchSeedHint: number | null = null;
	private navigationState: ShipExteriorViewNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipExteriorViewNavigationState | undefined) ??
		(history.state as ShipExteriorViewNavigationState | undefined) ??
		{};
	private readonly missionDefinition = resolveShipExteriorMission(
		this.navigationState.missionContext?.missionId ?? FIRST_TARGET_MISSION_ID,
	);

	protected playerName = signal(this.navigationState.playerName ?? 'Unknown Pilot');
	protected characterName = computed(() => this.navigationState.joinCharacter?.characterName?.trim() || 'Unbound');
	protected shipModel = computed(() => coerceShipModel(this.navigationState.joinShip?.model));
	protected hasExpendableDartDrone = signal(this.missionDefinition.resolveTargetingCapabilityFromInventory(this.navigationState.joinShip?.inventory));
	private activeShipId = signal(this.navigationState.joinShip?.id?.trim() ?? '');
	private activeShipLocationKm = signal<Triple | null>(this.resolveNavigationShipLocationKm());
	private activeSolarSystemId = signal(this.resolveNavigationSolarSystemId());
	private launchableInventory = signal(this.resolveLaunchableInventory(this.navigationState.joinShip?.inventory));
	private launchingHotkeys = signal<ReadonlySet<1 | 2 | 3 | 4 | 5>>(new Set());
	private launchFeedbackToast = signal<LaunchFeedbackToast | null>(null);
	readonly activeLaunchToast = computed(() => this.launchFeedbackToast());
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
			? normalizeDirection({ x: -shipLocation.x, y: -shipLocation.y, z: -shipLocation.z }, { x: -0.94, y: 0.12, z: -0.31 })
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
	protected activeScanAsteroidId = signal<string | null>(null);
	protected targetedAsteroidId = signal<string | null>(null);
	protected asteroidSamples = signal<AsteroidScanSample[]>([]);
	readonly launchHotkeysEnabled = computed(() => !!this.targetedAsteroidId());
	readonly launchHotkeySlots = computed<LaunchHotkeySlot[]>(() => {
		const launchables = this.launchableInventory().slice(0, ShipExteriorViewScene.HOTKEY_SLOT_COUNT);
		const enabled = this.launchHotkeysEnabled();
		const launchingHotkeys = this.launchingHotkeys();

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
	readonly propertiesVelocityText = computed(() => formatVelocityText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null));
	readonly propertiesSpinText = computed(() => formatSpinText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null));
	readonly propertiesMassText = computed(() => formatMassText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null));
	readonly propertiesDiameterText = computed(() => formatDiameterText(this.hoveredScannedAsteroid()?.revealedKinematics ?? null));
	readonly propertiesLocationText = computed(() =>
		formatLocationText(this.hoveredScannedAsteroid()?.solarSystemLocation ?? null)
	);
	readonly propertiesClusterText = computed(() =>
		formatClusterText(this.hoveredScannedAsteroid()?.clusterCenterKm ?? null)
	);
	readonly propertiesOffsetText = computed(() =>
		formatOffsetText(
			this.hoveredScannedAsteroid()?.solarSystemLocation ?? null,
			this.hoveredScannedAsteroid()?.clusterCenterKm ?? null,
		)
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

		const damping = sample.id === activeScanId
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
		this.socketService.connect(this.socketService.serverUrl);
		this.unsubscribeLaunchItemResponse = this.socketService.on(
			LAUNCH_ITEM_RESPONSE_EVENT,
			(response: LaunchItemResponse) => this.handleLaunchItemResponse(response),
		);
		const seedPolicy = this.resolveSeedPolicy();
		if (seedPolicy === 'resume') {
			this.seedAsteroidsForInProgressMission();
		} else {
			this.seedAsteroidsAroundStarterShip();
		}
		this.scanIntervalId = window.setInterval(() => {
			this.tickScene();
		}, ShipExteriorViewScene.SCAN_TICK_MS);
		window.addEventListener('pointerdown', this.onWindowPointerDown);
		window.addEventListener('pointerup', this.onWindowPointerUp);
		window.addEventListener('contextmenu', this.onWindowContextMenu);
		window.addEventListener('keydown', this.onWindowKeyDown);
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
		const location = this.navigationState.joinShip?.location?.positionKm;
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
		return this.navigationState.joinShip?.kinematics?.reference?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID;
	}

	ngOnDestroy(): void {
		this.unsubscribeShipListResponse?.();
		this.unsubscribeCelestialBodyListResponse?.();
		this.unsubscribeLaunchItemResponse?.();
		this.clearTargetHoldTimer();
		window.removeEventListener('pointerdown', this.onWindowPointerDown);
		window.removeEventListener('pointerup', this.onWindowPointerUp);
		window.removeEventListener('contextmenu', this.onWindowContextMenu);
		window.removeEventListener('keydown', this.onWindowKeyDown);
		this.hotkeyLaunchFlashTimeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
		this.hotkeyLaunchFlashTimeoutIds.clear();
		if (this.launchToastTimeoutId !== null) {
			clearTimeout(this.launchToastTimeoutId);
			this.launchToastTimeoutId = null;
		}
		if (this.postLaunchRefreshTimeoutId !== null) {
			clearTimeout(this.postLaunchRefreshTimeoutId);
			this.postLaunchRefreshTimeoutId = null;
		}
		if (this.scanIntervalId !== null) {
			clearInterval(this.scanIntervalId);
			this.scanIntervalId = null;
		}
	}

	private onWindowPointerDown = (event: PointerEvent): void => {
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
		if (!this.canTargetAsteroids()) {
			return;
		}

		event.preventDefault();
	};

	private onWindowKeyDown = (event: KeyboardEvent): void => {
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

	private seedAsteroidsForInProgressMission(): void {
		const playerName = this.navigationState.playerName?.trim() ?? '';
		const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			const samples = this.missionDefinition.createFallbackAsteroidSamples();
			this.asteroidSamples.set(samples);
			console.info('ColdBootScan (in-progress) seeded asteroids with fallback random center.', { count: samples.length });
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(shipResponse: ShipListResponse) => {
				this.unsubscribeShipListResponse?.();
				if (shipResponse.success) {
					this.updateTargetingCapabilityFromShipList(shipResponse.ships);
				}

				const firstShip = shipResponse.success ? shipResponse.ships?.[0] : undefined;
				const center = firstShip?.location?.positionKm;

				if (!center) {
					const fallbackSamples = this.missionDefinition.createFallbackAsteroidSamples();
					this.asteroidSamples.set(fallbackSamples);
					console.warn('ColdBootScan (in-progress) ship missing location; using fallback random center.');
					return;
				}

				this.unsubscribeCelestialBodyListResponse?.();
				this.unsubscribeCelestialBodyListResponse = this.socketService.on(
					CELESTIAL_BODY_LIST_RESPONSE_EVENT,
					(cbResponse: CelestialBodyListResponse) => {
						this.unsubscribeCelestialBodyListResponse?.();

						const seededSamples = this.missionDefinition.createResumedAsteroidSamples({
							playerName,
							characterId,
							center,
							launchSeedHint: this.launchSeedHint,
							existingBodies: cbResponse.success ? (cbResponse.celestialBodies ?? []) : [],
						});

						this.asteroidSamples.set(seededSamples);
						console.info('ColdBootScan (in-progress) seeded with existing and top-up asteroids.', {
							existing: cbResponse.success ? (cbResponse.celestialBodies ?? []).filter((body) => body.state !== 'destroyed').length : 0,
							total: seededSamples.length,
							centerKm: center,
						});
					},
				);

				const cbRequest: CelestialBodyListRequest = {
					playerName,
					sessionKey,
					solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
					positionKm: center,
					distanceKm: DEFAULT_CLUSTER_SPREAD_KM * 2,
				};
				this.socketService.emit(CELESTIAL_BODY_LIST_REQUEST_EVENT, cbRequest);
			},
		);

		const shipRequest: ShipListRequest = { playerName, characterId, sessionKey };
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, shipRequest);
	}

	private seedAsteroidsAroundStarterShip(): void {
		const playerName = this.navigationState.playerName?.trim() ?? '';
		const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			const samples = this.missionDefinition.createFallbackAsteroidSamples();
			this.asteroidSamples.set(samples);
			console.info('ColdBootScan seeded asteroids with fallback random center.', { count: samples.length });
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.unsubscribeShipListResponse?.();
				if (!response.success) {
					const fallbackSamples = this.missionDefinition.createFallbackAsteroidSamples();
					this.asteroidSamples.set(fallbackSamples);
					console.warn('ColdBootScan starter ship lookup failed; using fallback random center.', response.message);
					return;
				}

				this.updateTargetingCapabilityFromShipList(response.ships);

				const firstShip = response.ships?.[0];
				const center = firstShip?.location?.positionKm;
				if (!center) {
					const fallbackSamples = this.missionDefinition.createFallbackAsteroidSamples();
					this.asteroidSamples.set(fallbackSamples);
					console.warn('ColdBootScan ship list missing required location.positionKm; using fallback random center.');
					return;
				}

				const samples = this.missionDefinition.createNewAsteroidSamplesAroundShip({
					playerName,
					characterId,
					center,
					launchSeedHint: this.launchSeedHint,
				});
				this.asteroidSamples.set(samples);
				console.info('ColdBootScan seeded asteroids around starter ship center.', {
					count: samples.length,
					centerKm: center,
				});
			},
		);

		const request: ShipListRequest = { playerName, characterId, sessionKey };
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
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
		this.activeShipLocationKm.set(matchingShip?.location?.positionKm ?? null);
		this.activeSolarSystemId.set(matchingShip?.kinematics?.reference?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID);
		this.launchableInventory.set(this.resolveLaunchableInventory(matchingShip?.inventory));
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
		if (!slot?.item || !slot.enabled) {
			this.setLaunchToast(`Hotkey ${hotkey} has no launchable item.`, 'error', null);
			return;
		}

		const targetCelestialBodyId = this.resolveTargetCelestialBodyIdForLaunch(targetedSampleId);
		if (!targetCelestialBodyId) {
			this.setLaunchToast('Target is not synchronized yet. Scan and wait for sync before launch.', 'error', null);
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
		this.socketService.launchItem(request);
		this.setLaunchToast(`Launch request sent for hotkey ${hotkey}.`, 'success', null);
		this.triggerHotkeyLaunchFlash(hotkey);
	}

	private resolveTargetCelestialBodyIdForLaunch(targetedSampleId: string): string | null {
		const targeted = this.asteroidSamples().find((sample) => sample.id === targetedSampleId);
		const serverId = targeted?.serverCelestialBodyId?.trim() ?? '';
		return serverId.length > 0 ? serverId : null;
	}

	private handleLaunchItemResponse(response: LaunchItemResponse): void {
		if (!response || typeof response !== 'object') {
			return;
		}

		const launchSeed = response.resolution?.launchSeed ?? null;
		this.launchSeedHint = launchSeed;
		const missionResolution = this.missionDefinition.resolveLaunchItemResponse({
			response,
			asteroidSamples: this.asteroidSamples(),
		});

		if (!response.success) {
			this.setLaunchToast(response.message || 'Launch failed', 'error', launchSeed);
			return;
		}

		if (missionResolution.removeAsteroidSampleIds.length > 0) {
			this.removeAsteroidSamples(missionResolution.removeAsteroidSampleIds);
		}

		this.setLaunchToast(response.message || 'Launch complete', 'success', launchSeed);
		if (missionResolution.shouldRefreshAfterLaunch) {
			this.queuePostLaunchRefresh();
		}
	}

	private removeAsteroidSamples(sampleIds: readonly string[]): void {
		if (sampleIds.length === 0) {
			return;
		}

		const matchingSampleIds = new Set(sampleIds);

		this.asteroidSamples.update((samples) =>
			samples.filter((sample) => !matchingSampleIds.has(sample.id)),
		);

		if (matchingSampleIds.has(this.targetedAsteroidId() ?? '')) {
			this.targetedAsteroidId.set(null);
		}
		if (matchingSampleIds.has(this.activeScanAsteroidId() ?? '')) {
			this.activeScanAsteroidId.set(null);
		}
	}

	private queuePostLaunchRefresh(): void {
		if (this.postLaunchRefreshTimeoutId !== null) {
			clearTimeout(this.postLaunchRefreshTimeoutId);
		}

		this.postLaunchRefreshTimeoutId = window.setTimeout(() => {
			this.postLaunchRefreshTimeoutId = null;
			this.seedAsteroidsForInProgressMission();
		}, ShipExteriorViewScene.POST_LAUNCH_REFRESH_DEBOUNCE_MS);
	}

	private setLaunchToast(message: string, tone: 'success' | 'error', seed: number | null): void {
		this.launchFeedbackToast.set({ message, tone, seed });
		if (this.launchToastTimeoutId !== null) {
			clearTimeout(this.launchToastTimeoutId);
		}

		this.launchToastTimeoutId = window.setTimeout(() => {
			this.launchFeedbackToast.set(null);
			this.launchToastTimeoutId = null;
		}, ShipExteriorViewScene.LAUNCH_TOAST_MS);
	}

	private triggerHotkeyLaunchFlash(hotkey: 1 | 2 | 3 | 4 | 5): void {
		this.launchingHotkeys.update((current) => {
			const next = new Set(current);
			next.add(hotkey);
			return next;
		});

		const existingTimeout = this.hotkeyLaunchFlashTimeoutIds.get(hotkey);
		if (existingTimeout !== undefined) {
			clearTimeout(existingTimeout);
		}

		const timeoutId = window.setTimeout(() => {
			this.launchingHotkeys.update((current) => {
				const next = new Set(current);
				next.delete(hotkey);
				return next;
			});
			this.hotkeyLaunchFlashTimeoutIds.delete(hotkey);
		}, ShipExteriorViewScene.HOTKEY_LAUNCH_FLASH_MS);

		this.hotkeyLaunchFlashTimeoutIds.set(hotkey, timeoutId);
	}

	protected onAsteroidHoverChange(event: AsteroidHoverEvent): void {
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
		if (event.button !== 2 || !this.canTargetAsteroids()) {
			return;
		}

		this.beginTargetHold(event.id);
	}

	protected onAsteroidRightPointerUp(event: { id: string; button: number }): void {
		if (event.button !== 2) {
			return;
		}

		this.clearTargetHoldTimer();
	}

	private beginTargetHold(asteroidId: string): void {
		this.clearTargetHoldTimer();
		this.targetHoldCandidateId.set(asteroidId);
		this.targetHoldTimeoutId = window.setTimeout(() => {
			if (this.targetHoldCandidateId() === asteroidId) {
				this.targetedAsteroidId.set(asteroidId);
			}
			this.clearTargetHoldTimer();
		}, ShipExteriorViewScene.TARGET_HOLD_MS);
	}

	private clearTargetHoldTimer(): void {
		if (this.targetHoldTimeoutId !== null) {
			clearTimeout(this.targetHoldTimeoutId);
			this.targetHoldTimeoutId = null;
		}
		this.targetHoldCandidateId.set(null);
	}

	private tickScene(): void {
		this.sceneElapsedSeconds += ShipExteriorViewScene.SCAN_TICK_MS / 1000;
		const activeId = this.activeScanAsteroidId();
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
					? sample.revealedMaterial ?? pickWeightedAsteroidMaterial()
					: sample.revealedMaterial;
				const revealedKinematics = completedNow
					? sample.revealedKinematics ?? sample.capturedKinematics
					: sample.revealedKinematics;

				if (completedNow && !sample.scanned) {
					this.emitCelestialBodyUpsert(sample, revealedMaterial, revealedKinematics);
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
	}

	private emitCelestialBodyUpsert(
		sample: AsteroidScanSample,
		revealedMaterial: AsteroidMaterialProfile | null,
		revealedKinematics: AsteroidKinematics | null,
	): void {
		if (this.sentCelestialBodyUpserts.has(sample.id)) {
			return;
		}

		const sessionKey = this.sessionService.getSessionKey();
		const playerName = this.playerName().trim();
		const createdByCharacterId = this.navigationState.joinCharacter?.id;
		if (!sessionKey || !playerName || !createdByCharacterId || !revealedMaterial || !revealedKinematics) {
			console.warn('Skipping celestial body upsert due to missing actor/session context.');
			return;
		}

		const nowIso = new Date().toISOString();
		const uniqueSuffix = Math.random().toString(16).slice(2, 10);
		const request: CelestialBodyUpsertRequest = {
			sessionKey,
			playerName,
			createdByCharacterId,
			celestialBody: {
				id: `cb-${sample.id}-${uniqueSuffix}`,
				catalogId: `sol-${sample.id}-${uniqueSuffix}`,
				solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
				sourceScanId: sample.id,
				createdByCharacterId,
				createdAt: nowIso,
				updatedAt: nowIso,
				location: sample.solarSystemLocation,
				kinematics: revealedKinematics,
				composition: revealedMaterial,
			},
		};

		this.socketService.upsertCelestialBody(request, (response: CelestialBodyUpsertResponse) => {
			if (!response.success) {
				console.warn('Celestial body upsert failed:', response.message);
				return;
			}

			const persistedId = response.celestialBody?.id?.trim() || request.celestialBody.id;
			this.asteroidSamples.update((samples) =>
				samples.map((candidate) =>
					candidate.id === sample.id
						? {
							...candidate,
							serverCelestialBodyId: persistedId,
						}
						: candidate,
				),
			);
		});

		this.sentCelestialBodyUpserts.add(sample.id);
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

function resolveSunConfigForSolarSystem(solarSystemId: string): SolarSystemSunConfig {
	const normalizedId = solarSystemId.trim().toLowerCase();
	return SOLAR_SYSTEM_SUN_CONFIGS[normalizedId] ?? DEFAULT_SUN_CONFIG;
}

function normalizeDirection(vector: Triple, fallback: Triple): Triple {
	const magnitude = Math.hypot(vector.x, vector.y, vector.z);
	if (magnitude <= 0) {
		return normalizeDirection(fallback, { x: -1, y: 0, z: 0 });
	}

	return {
		x: vector.x / magnitude,
		y: vector.y / magnitude,
		z: vector.z / magnitude,
	};
}

function getLaunchableLabel(item: ShipItem): string {
	const preferred = item.displayName?.trim() || item.itemType?.trim() || 'Unknown';
	if (preferred.length <= 12) {
		return preferred;
	}

	return `${preferred.slice(0, 9)}...`;
}

function resolveHotkeyNumber(event: KeyboardEvent): 1 | 2 | 3 | 4 | 5 | null {
	if (event.key >= '1' && event.key <= '5') {
		return Number(event.key) as 1 | 2 | 3 | 4 | 5;
	}

	switch (event.code) {
		case 'Numpad1':
			return 1;
		case 'Numpad2':
			return 2;
		case 'Numpad3':
			return 3;
		case 'Numpad4':
			return 4;
		case 'Numpad5':
			return 5;
		default:
			return null;
	}
}