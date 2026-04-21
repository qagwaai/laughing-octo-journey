import { LOCALE_ID, ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OPENING_STAGE_TIMINGS_MS, resolveOpeningSequenceContent } from '../../model/opening-sequence';
import { OpeningAudioService } from '../../services';
import { locale } from '../../i18n/locale';

@Component({
	selector: 'app-cold-boot-opening-page',
	templateUrl: './cold-boot.html',
	styleUrls: ['./cold-boot.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootOpeningPage implements OnInit, OnDestroy {
	private route = inject(ActivatedRoute);
	private locale = inject(LOCALE_ID, { optional: true }) ?? 'en';
	private openingAudio = inject(OpeningAudioService);
	private timers: number[] = [];
	private onFirstGesture = () => {
		void this.enableAudio();
	};

	protected readonly t = locale;
	protected stage = signal(0);
	protected audioEnabled = signal(false);
	protected audioBedRunning = signal(false);
	protected speechAvailable = signal(false);

	protected armedStatusTooltip = computed(() =>
		this.audioEnabled()
			? this.t.opening.coldBoot.armedTooltipOn
			: this.t.opening.coldBoot.armedTooltipOff,
	);

	protected bedStatusTooltip = computed(() => {
		if (!this.audioEnabled()) {
			return this.t.opening.coldBoot.bedTooltipDisarmed;
		}
		if (!this.audioBedRunning()) {
			return this.t.opening.coldBoot.bedTooltipStopped;
		}
		return this.t.opening.coldBoot.bedTooltipRunning;
	});

	protected speechStatusTooltip = computed(() =>
		this.speechAvailable()
			? this.t.opening.coldBoot.speechTooltipAvailable
			: this.t.opening.coldBoot.speechTooltipUnavailable,
	);

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

	ngOnInit(): void {
		this.speechAvailable.set(this.openingAudio.isSpeechSynthesisAvailable());
		this.scheduleStageAdvances();
		this.installAudioGestureHooks();
	}

	ngOnDestroy(): void {
		this.openingAudio.stopCinematicBed();
		this.audioBedRunning.set(false);
		this.removeAudioGestureHooks();
		for (const timerId of this.timers) {
			clearTimeout(timerId);
		}
		this.timers = [];
	}

	protected async enableAudio(): Promise<void> {
		if (this.audioEnabled()) {
			return;
		}

		const armed = await this.openingAudio.armFromUserGesture();
		this.audioEnabled.set(armed);
		if (armed) {
			this.audioBedRunning.set(this.openingAudio.startCinematicBed());
			this.openingAudio.playBlackoutPulse();
			this.removeAudioGestureHooks();
		} else {
			this.audioBedRunning.set(false);
		}
	}

	protected async toggleAudio(): Promise<void> {
		if (this.audioEnabled()) {
			this.openingAudio.stopCinematicBed();
			this.audioBedRunning.set(false);
			this.audioEnabled.set(false);
			return;
		}

		await this.enableAudio();
	}

	private installAudioGestureHooks(): void {
		window.addEventListener('pointerdown', this.onFirstGesture, { once: true, passive: true });
		window.addEventListener('keydown', this.onFirstGesture, { once: true });
	}

	private removeAudioGestureHooks(): void {
		window.removeEventListener('pointerdown', this.onFirstGesture);
		window.removeEventListener('keydown', this.onFirstGesture);
	}

	private scheduleStageAdvances(): void {
		this.timers.push(window.setTimeout(() => this.advanceStage(1), OPENING_STAGE_TIMINGS_MS.blackoutReveal));
		this.timers.push(window.setTimeout(() => this.advanceStage(2), OPENING_STAGE_TIMINGS_MS.firstViewReveal));
		this.timers.push(window.setTimeout(() => this.advanceStage(3), OPENING_STAGE_TIMINGS_MS.aiReveal));
	}

	private advanceStage(nextStage: number): void {
		this.stage.set(nextStage);
		if (!this.audioEnabled()) {
			return;
		}

		if (nextStage === 1) {
			this.openingAudio.playBlackoutPulse();
		}
		if (nextStage === 2) {
			this.openingAudio.playHudFlicker();
		}
		if (nextStage === 3) {
			this.openingAudio.playAiAwakening();
			this.openingAudio.playAiTransmissionLine(this.content().aiTransmission);
		}
	}
}
