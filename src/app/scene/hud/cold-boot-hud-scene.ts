import {
	LOCALE_ID,
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	OnDestroy,
	OnInit,
	computed,
	inject,
	signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { CurrentRoute } from '../../component/current';
import { OPENING_STAGE_TIMINGS_MS, resolveOpeningSequenceContent } from '../../model/opening-sequence';
import { CrackedCockpitWindow } from './cracked-cockpit-window';
import { HudOverlay } from './hud-overlay';

@Component({
	selector: 'app-cold-boot-hud-scene',
	templateUrl: './cold-boot-hud-scene.html',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [NgtArgs, NgtsOrbitControls, CrackedCockpitWindow, HudOverlay, CurrentRoute],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootHudScene implements OnInit, OnDestroy {
	private route = inject(ActivatedRoute);
	private locale = inject(LOCALE_ID, { optional: true }) ?? 'en';
	private timers: number[] = [];

	protected stage = signal(0);

	protected content = signal(
		resolveOpeningSequenceContent(this.locale, this.route.snapshot.queryParamMap.get('variant') ?? undefined),
	);

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
