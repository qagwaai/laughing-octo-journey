import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	OnDestroy,
	OnInit,
	signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Asteroid, type AsteroidHoverEvent } from '../component/asteroid';
import { CurrentRoute } from '../component/current';
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
}

@Component({
	selector: 'app-cold-boot-scan-scene',
	templateUrl: './cold-boot-scan.html',
	imports: [NgtArgs, NgtsOrbitControls, CurrentRoute, Asteroid],
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
	protected asteroidSamples = signal<AsteroidScanSample[]>([
		{ id: 'sample-a1', position: [-2.4, 0.65, 0.25], scanProgress: 0, scanned: false },
		{ id: 'sample-a2', position: [-1.15, 0.38, -0.95], scanProgress: 0, scanned: false },
		{ id: 'sample-a3', position: [0.0, 0.82, -0.45], scanProgress: 0, scanned: false },
		{ id: 'sample-a4', position: [1.3, 0.46, -1.2], scanProgress: 0, scanned: false },
		{ id: 'sample-a5', position: [2.5, 0.61, 0.42], scanProgress: 0, scanned: false },
	]);

	protected scanStatusLine = computed(() => {
		const asteroids = this.asteroidSamples();
		const completedCount = asteroids.filter((sample) => sample.scanned).length;

		if (completedCount === asteroids.length) {
			return 'SCAN COMPLETE // ALL 5 SAMPLES CATALOGUED';
		}

		const activeId = this.activeScanAsteroidId();
		if (!activeId) {
			return `HOVER OVER ASTEROID SAMPLES TO SCAN // ${completedCount}/5 COMPLETE`;
		}

		const active = asteroids.find((sample) => sample.id === activeId);
		if (!active) {
			return `HOVER OVER ASTEROID SAMPLES TO SCAN // ${completedCount}/5 COMPLETE`;
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
				return {
					...sample,
					scanProgress: nextProgress,
					scanned: nextProgress >= 100,
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