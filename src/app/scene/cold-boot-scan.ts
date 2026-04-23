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
	generateRandomAsteroidBeltClusterCenterKm,
	generateRandomCelestialBodyLocationNear,
	type CelestialBodyLocation,
} from '../model/celestial-body-location';
import { PlayerCharacterSummary } from '../model/character-list';
import { Triple } from '../model/triple';
import { SessionService } from '../services/session.service';
import { SocketService } from '../services/socket.service';

interface ColdBootScanNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
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

@Component({
	selector: 'app-cold-boot-scan-scene',
	templateUrl: './cold-boot-scan.html',
	imports: [NgtArgs, NgtsOrbitControls, Asteroid, BackgroundStars],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootScanScene implements OnInit, OnDestroy {
	private static readonly SCAN_TICK_MS = 100;
	private static readonly SCAN_TOTAL_MS = 10000;
	private static readonly SCAN_STEP = 100 / (ColdBootScanScene.SCAN_TOTAL_MS / ColdBootScanScene.SCAN_TICK_MS);
	private static readonly ACTIVE_SCAN_MIN_MOTION_DAMPING = 0.15;
	private static readonly SCANNED_MOTION_DAMPING = 0.65;

	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private scanIntervalId: number | null = null;
	private sceneElapsedSeconds = 0;
	private sentCelestialBodyUpserts = new Set<string>();
	private navigationState: ColdBootScanNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ColdBootScanNavigationState | undefined) ??
		(history.state as ColdBootScanNavigationState | undefined) ??
		{};

	protected playerName = signal(this.navigationState.playerName ?? 'Unknown Pilot');
	protected characterName = computed(() => this.navigationState.joinCharacter?.characterName?.trim() || 'Unbound');
	protected activeScanAsteroidId = signal<string | null>(null);
	protected asteroidSamples = signal<AsteroidScanSample[]>(ColdBootScanScene.generateAsteroidSamples());

	private static generateAsteroidSamples(): AsteroidScanSample[] {
		const count = Math.floor(Math.random() * 16) + 5; // 5–20
		const samples: AsteroidScanSample[] = [];
		// All asteroids in this scan share a cluster center within the main
		// asteroid belt so their solar-system locations read as "neighbours".
		const clusterCenterKm = generateRandomAsteroidBeltClusterCenterKm();

		for (let i = 0; i < count; i++) {
			// Spread asteroids evenly around a circle with jitter, avoiding crowding
			const baseAngle = (i / count) * Math.PI * 2;
			const angleJitter = (Math.random() - 0.5) * (Math.PI / count);
			const angle = baseAngle + angleJitter;

			const distance = 6 + Math.random() * 14; // 6–20 units from centre
			const x = Math.cos(angle) * distance;
			const z = Math.sin(angle) * distance;
			const solarSystemLocation = generateRandomCelestialBodyLocationNear(clusterCenterKm);
			const y = (Math.random() - 0.5) * 8; // -4 to +4 vertical spread
			const basePosition: [number, number, number] = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)];
			const capturedKinematics = generateRandomAsteroidKinematics();
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
				clusterCenterKm,
				capturedKinematics,
				motionPhase: Math.random() * Math.PI * 2,
				motionRate: 0.2 + speedFactor * 0.55,
				motionRadius: 0.2 + speedFactor * 0.95,
				bobAmplitude: 0.06 + Math.random() * 0.4,
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
				const min = ColdBootScanScene.ACTIVE_SCAN_MIN_MOTION_DAMPING;
				return min + (1 - min) * eased;
			})()
			: sample.scanned
				? ColdBootScanScene.SCANNED_MOTION_DAMPING
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
		this.scanIntervalId = window.setInterval(() => {
			this.tickScene();
		}, ColdBootScanScene.SCAN_TICK_MS);
	}

	ngOnDestroy(): void {
		if (this.scanIntervalId !== null) {
			clearInterval(this.scanIntervalId);
			this.scanIntervalId = null;
		}
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
		this.sceneElapsedSeconds += ColdBootScanScene.SCAN_TICK_MS / 1000;
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

				const nextProgress = Math.min(100, sample.scanProgress + ColdBootScanScene.SCAN_STEP);
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