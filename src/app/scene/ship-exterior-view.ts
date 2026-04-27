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
import { generateRandomAsteroidKinematics, type AsteroidKinematics } from '../model/asteroid-kinematics';
import { pickWeightedAsteroidMaterial, type AsteroidMaterialProfile } from '../model/asteroid-materials';
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
	generateRandomAsteroidBeltClusterCenterKm,
	generateRandomCelestialBodyLocationNear,
	type CelestialBodyLocation,
} from '../model/celestial-body-location';
import { type MissionStatus } from '../model/mission';
import { PlayerCharacterSummary } from '../model/character-list';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	type ShipListRequest,
	type ShipListResponse,
} from '../model/ship-list';
import { Triple } from '../model/triple';
import { SessionService } from '../services/session.service';
import { SocketService } from '../services/socket.service';

interface ColdBootScanNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	firstTargetMissionStatus?: MissionStatus;
}

interface AsteroidScanSample {
	id: string;
	position: [number, number, number];
	basePosition: [number, number, number];
	scanProgress: number;
	scanned: boolean;
	revealedMaterial: AsteroidMaterialProfile | null;
	revealedKinematics: AsteroidKinematics | null;
	capturedKinematics: AsteroidKinematics;
	solarSystemLocation: CelestialBodyLocation;
	clusterCenterKm: Triple;
	motionPhase: number;
	motionRate: number;
	motionRadius: number;
	bobAmplitude: number;
}

function hashToSeed(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

@Component({
	selector: 'app-ship-exterior-view-scene',
	templateUrl: './ship-exterior-view.html',
	imports: [NgtArgs, NgtsOrbitControls, Asteroid, BackgroundStars],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorViewScene implements OnInit, OnDestroy {
	private static readonly SCAN_TICK_MS = 100;
	private static readonly SCAN_TOTAL_MS = 10000;
	private static readonly SCAN_STEP = 100 / (ShipExteriorViewScene.SCAN_TOTAL_MS / ShipExteriorViewScene.SCAN_TICK_MS);
	private static readonly ACTIVE_SCAN_MIN_MOTION_DAMPING = 0.15;
	private static readonly SCANNED_MOTION_DAMPING = 0.65;

	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private scanIntervalId: number | null = null;
	private sceneElapsedSeconds = 0;
	private sentCelestialBodyUpserts = new Set<string>();
	private unsubscribeShipListResponse?: () => void;
	private unsubscribeCelestialBodyListResponse?: () => void;
	private navigationState: ColdBootScanNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ColdBootScanNavigationState | undefined) ??
		(history.state as ColdBootScanNavigationState | undefined) ??
		{};

	protected playerName = signal(this.navigationState.playerName ?? 'Unknown Pilot');
	protected characterName = computed(() => this.navigationState.joinCharacter?.characterName?.trim() || 'Unbound');
	protected activeScanAsteroidId = signal<string | null>(null);
	protected asteroidSamples = signal<AsteroidScanSample[]>([]);

	private static generateAsteroidSamples(clusterCenterKm?: Triple, random: () => number = Math.random, count?: number): AsteroidScanSample[] {
		const resolvedCount = count ?? (Math.floor(random() * 16) + 5); // 5–20
		const samples: AsteroidScanSample[] = [];
		// All asteroids in this scan share a cluster center within the main
		// asteroid belt so their solar-system locations read as "neighbours".
		const resolvedClusterCenterKm = clusterCenterKm ?? generateRandomAsteroidBeltClusterCenterKm(random);

		for (let i = 0; i < resolvedCount; i++) {
			// Spread asteroids evenly around a circle with jitter, avoiding crowding
			const baseAngle = (i / resolvedCount) * Math.PI * 2;
			const angleJitter = (random() - 0.5) * (Math.PI / resolvedCount);
			const angle = baseAngle + angleJitter;

			const distance = 6 + random() * 14; // 6–20 units from centre
			const x = Math.cos(angle) * distance;
			const z = Math.sin(angle) * distance;
			const solarSystemLocation = generateRandomCelestialBodyLocationNear(resolvedClusterCenterKm, undefined, random);
			const y = (random() - 0.5) * 8; // -4 to +4 vertical spread
			const basePosition: [number, number, number] = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)];
			const capturedKinematics = generateRandomAsteroidKinematics(random);
			const velocity = capturedKinematics.velocityKmPerSec;
			const speedKmPerSec = Math.hypot(velocity.x, velocity.y, velocity.z);
			const speedFactor = Math.min(1, speedKmPerSec / 32);

			samples.push({
				id: `sample-a${i + 1}`,
				position: basePosition,
				basePosition,
				scanProgress: 0,
				scanned: false,
				revealedMaterial: null,
				revealedKinematics: null,
				solarSystemLocation,
				clusterCenterKm: resolvedClusterCenterKm,
				capturedKinematics,
				motionPhase: random() * Math.PI * 2,
				motionRate: 0.2 + speedFactor * 0.55,
				motionRadius: 0.2 + speedFactor * 0.95,
				bobAmplitude: 0.06 + random() * 0.4,
			});
		}

		return samples;
	}

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
		if (this.navigationState.firstTargetMissionStatus === 'started') {
			this.seedAsteroidsForInProgressMission();
		} else {
			this.seedAsteroidsAroundStarterShip();
		}
		this.scanIntervalId = window.setInterval(() => {
			this.tickScene();
		}, ShipExteriorViewScene.SCAN_TICK_MS);
	}

	ngOnDestroy(): void {
		this.unsubscribeShipListResponse?.();
		this.unsubscribeCelestialBodyListResponse?.();
		if (this.scanIntervalId !== null) {
			clearInterval(this.scanIntervalId);
			this.scanIntervalId = null;
		}
	}

	private seedAsteroidsForInProgressMission(): void {
		const playerName = this.navigationState.playerName?.trim() ?? '';
		const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			const samples = ShipExteriorViewScene.generateAsteroidSamples();
			this.asteroidSamples.set(samples);
			console.info('ColdBootScan (in-progress) seeded asteroids with fallback random center.', { count: samples.length });
			return;
		}

		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(shipResponse: ShipListResponse) => {
				this.unsubscribeShipListResponse?.();

				const firstShip = shipResponse.success ? shipResponse.ships?.[0] : undefined;
				const center = firstShip?.location?.positionKm;

				if (!center) {
					const fallbackSamples = ShipExteriorViewScene.generateAsteroidSamples();
					this.asteroidSamples.set(fallbackSamples);
					console.warn('ColdBootScan (in-progress) ship missing location; using fallback random center.');
					return;
				}

				this.unsubscribeCelestialBodyListResponse?.();
				this.unsubscribeCelestialBodyListResponse = this.socketService.on(
					CELESTIAL_BODY_LIST_RESPONSE_EVENT,
					(cbResponse: CelestialBodyListResponse) => {
						this.unsubscribeCelestialBodyListResponse?.();

						const rng = seededRandom(hashToSeed(`${playerName}::${characterId}::${center.x}:${center.y}:${center.z}`));
						const existingBodies = cbResponse.success ? (cbResponse.celestialBodies ?? []) : [];
						const randomTarget = Math.floor(rng() * 16) + 5; // 5–20, same seed sequence as just-started
						const total = Math.max(existingBodies.length, randomTarget);
						const allSamples = ShipExteriorViewScene.generateAsteroidSamples(center, rng, total);

						const seededSamples = allSamples.map((sample, index) => {
							const existingBody = existingBodies[index];
							if (!existingBody) {
								return sample;
							}

							return {
								...sample,
								scanProgress: 100,
								scanned: true,
								revealedMaterial: existingBody.composition,
								revealedKinematics: existingBody.kinematics,
								capturedKinematics: existingBody.kinematics,
								solarSystemLocation: existingBody.location,
							};
						});

						this.asteroidSamples.set(seededSamples);
						console.info('ColdBootScan (in-progress) seeded with existing and top-up asteroids.', {
							existing: existingBodies.length,
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
			const samples = ShipExteriorViewScene.generateAsteroidSamples();
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
					const fallbackSamples = ShipExteriorViewScene.generateAsteroidSamples();
					this.asteroidSamples.set(fallbackSamples);
					console.warn('ColdBootScan starter ship lookup failed; using fallback random center.', response.message);
					return;
				}

				const firstShip = response.ships?.[0];
				const center = firstShip?.location?.positionKm;
				if (!center) {
					const fallbackSamples = ShipExteriorViewScene.generateAsteroidSamples();
					this.asteroidSamples.set(fallbackSamples);
					console.warn('ColdBootScan ship list missing required location.positionKm; using fallback random center.');
					return;
				}

				const rng = seededRandom(hashToSeed(`${playerName}::${characterId}::${center.x}:${center.y}:${center.z}`));
				const samples = ShipExteriorViewScene.generateAsteroidSamples(center, rng);
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
			}
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
}