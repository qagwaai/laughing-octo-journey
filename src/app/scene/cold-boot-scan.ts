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
import { pickWeightedAsteroidMaterial, type AsteroidMaterialProfile } from '../model/asteroid-materials';
import { PlayerCharacterSummary } from '../model/character-list';

interface ColdBootScanNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

interface AsteroidScanSample {
	id: string;
	position: [number, number, number];
	scanProgress: number;
	scanned: boolean;
	revealedMaterial: AsteroidMaterialProfile | null;
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

	private router = inject(Router);
	private scanIntervalId: number | null = null;
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
		const usedAngles: number[] = [];

		for (let i = 0; i < count; i++) {
			// Spread asteroids evenly around a circle with jitter, avoiding crowding
			const baseAngle = (i / count) * Math.PI * 2;
			const angleJitter = (Math.random() - 0.5) * (Math.PI / count);
			const angle = baseAngle + angleJitter;
			usedAngles.push(angle);

			const distance = 6 + Math.random() * 14; // 6–20 units from centre
			const x = Math.cos(angle) * distance;
			const z = Math.sin(angle) * distance;
			const y = (Math.random() - 0.5) * 8; // -4 to +4 vertical spread

			samples.push({
				id: `sample-a${i + 1}`,
				position: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)],
				scanProgress: 0,
				scanned: false,
				revealedMaterial: null,
			});
		}

		return samples;
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
		this.scanIntervalId = window.setInterval(() => {
			this.tickActiveScanProgress();
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

	private tickActiveScanProgress(): void {
		const activeId = this.activeScanAsteroidId();
		if (!activeId) {
			return;
		}

		this.asteroidSamples.update((samples) =>
			samples.map((sample) => {
				if (sample.id !== activeId || sample.scanned) {
					return sample;
				}

				const nextProgress = Math.min(100, sample.scanProgress + ColdBootScanScene.SCAN_STEP);
				const completedNow = nextProgress >= 100;
				return {
					...sample,
					scanProgress: nextProgress,
					scanned: completedNow,
					revealedMaterial: completedNow ? sample.revealedMaterial ?? pickWeightedAsteroidMaterial() : sample.revealedMaterial,
				};
			}),
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
}