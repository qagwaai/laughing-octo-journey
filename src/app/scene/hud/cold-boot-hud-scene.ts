import {
	LOCALE_ID,
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	OnDestroy,
	OnInit,
	computed,
	effect,
	inject,
	signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { injectStore, NgtArgs } from 'angular-three';
import { OPENING_STAGE_TIMINGS_MS, resolveOpeningSequenceContent } from '../../model/opening-sequence';
import { CrackedCockpitWindow } from './cracked-cockpit-window';
import { HudOverlay } from './hud-overlay';

@Component({
	selector: 'app-cold-boot-hud-scene',
	templateUrl: './cold-boot-hud-scene.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [NgtArgs, CrackedCockpitWindow, HudOverlay],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootHudScene implements OnInit, OnDestroy {
	private static readonly ALERT_STROBE_TICK_MS = 50;
	private static readonly ALERT_STROBE_CYCLE_MS = 1800;

	private route = inject(ActivatedRoute);
	private locale = inject(LOCALE_ID, { optional: true }) ?? 'en';
	private store = injectStore();
	private timers: number[] = [];

	constructor() {
		// Lock camera to a fixed first-person cockpit perspective — straight-on, no orbit.
		effect(() => {
			const camera = this.store.camera();
			if (!camera) return;
			camera.position.set(0, 0, 6);
			camera.lookAt(0, 0, 0);
		});
	}

	protected stage = signal(0);
	protected alertPulse = signal(0.35);

	protected content = signal(
		resolveOpeningSequenceContent(this.locale, this.route.snapshot.queryParamMap.get('variant') ?? undefined),
	);
	protected alertLightIntensity = computed(() => 1.2 + this.alertPulse() * 6.8);
	protected alertEmitterIntensity = computed(() => 0.9 + this.alertPulse() * 5.1);

	protected visibleSystemChecks = computed(() => {
		const checks = this.content().systemChecks;
		if (this.stage() < 1) {
			return [];
		}
		if (this.stage() === 1) {
			return checks.slice(0, 1);
		}
		if (this.stage() === 2) {
			return checks.slice(0, 2);
		}
		return checks;
	});

	protected hudTitle = computed(() => this.content().hudTitle);
	protected aiLabel = computed(() => this.content().aiLabel);
	protected visibleAiMessage = computed(() => (this.stage() >= 3 ? this.content().aiTransmission : ''));
	protected visibleDebris = computed(() => (this.stage() >= 2 ? this.debrisField : []));

	protected readonly debrisField = [
		{ position: [-2.8, -0.6, -5.2], rotation: [0.4, 0.8, 0.2], scale: [0.85, 0.45, 0.35] },
		{ position: [1.9, 1.1, -4.1], rotation: [0.2, -0.4, 0.3], scale: [0.52, 0.28, 0.65] },
		{ position: [3.1, -1.3, -6.2], rotation: [0.8, 0.3, 0.4], scale: [1.2, 0.22, 0.5] },
		{ position: [-1.1, 1.5, -7.1], rotation: [0.3, 0.5, -0.4], scale: [0.75, 0.3, 0.24] },
		{ position: [0.2, -1.7, -4.6], rotation: [0.9, -0.2, 0.7], scale: [0.4, 0.4, 0.9] },
	] as const;

	ngOnInit(): void {
		this.timers.push(
			window.setInterval(
				() => {
					const phase = (performance.now() % ColdBootHudScene.ALERT_STROBE_CYCLE_MS) /
						ColdBootHudScene.ALERT_STROBE_CYCLE_MS;
					const pulse = Math.pow(Math.sin(phase * Math.PI), 2);
					this.alertPulse.set(0.2 + pulse * 0.8);
				},
				ColdBootHudScene.ALERT_STROBE_TICK_MS,
			),
		);
		this.timers.push(window.setTimeout(() => this.stage.set(1), OPENING_STAGE_TIMINGS_MS.blackoutReveal));
		this.timers.push(window.setTimeout(() => this.stage.set(2), OPENING_STAGE_TIMINGS_MS.firstViewReveal));
		this.timers.push(window.setTimeout(() => this.stage.set(3), OPENING_STAGE_TIMINGS_MS.aiReveal));
	}

	ngOnDestroy(): void {
		for (const timerId of this.timers) {
			clearTimeout(timerId);
		}
		this.timers = [];
	}
}
