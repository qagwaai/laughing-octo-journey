import { LOCALE_ID, ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { OPENING_STAGE_TIMINGS_MS, resolveOpeningSequenceContent } from '../../model/opening-sequence';
import { MissionService, OpeningAudioService, SessionService } from '../../services';
import { locale } from '../../i18n/locale';

interface ColdBootNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-cold-boot-opening-page',
	templateUrl: './cold-boot.html',
	styleUrls: ['./cold-boot.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ColdBootOpeningPage implements OnInit, OnDestroy {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private locale = inject(LOCALE_ID, { optional: true }) ?? 'en';
	private openingAudio = inject(OpeningAudioService);
	private missionService = inject(MissionService);
	private sessionService = inject(SessionService);
	private timers: number[] = [];
	private didStartBedForCurrentEnablement = false;
	private didRequestInitialMission = false;
	private navigationState: ColdBootNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ColdBootNavigationState | undefined) ??
		(history.state as ColdBootNavigationState | undefined) ??
		{};

	protected readonly t = locale;
	protected stage = signal(0);
	protected audioEnabled = signal(false);
	protected audioBedRunning = signal(false);

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

	constructor() {
		effect(() => {
			const hooksEnabled = this.openingAudio.isAudioHooksEnabled();
			const armed = this.openingAudio.isArmed();
			this.audioEnabled.set(hooksEnabled);

			if (!hooksEnabled) {
				this.openingAudio.stopCinematicBed();
				this.audioBedRunning.set(false);
				this.didStartBedForCurrentEnablement = false;
				return;
			}

			if (!armed) {
				this.audioBedRunning.set(false);
				return;
			}

			const running = this.openingAudio.startCinematicBed();
			this.audioBedRunning.set(running);
			if (!this.didStartBedForCurrentEnablement && running) {
				this.openingAudio.playBlackoutPulse();
				this.didStartBedForCurrentEnablement = true;
			}
		});
	}

	ngOnInit(): void {
		this.requestInitialMission();
		this.scheduleStageAdvances();
	}

	ngOnDestroy(): void {
		this.openingAudio.stopCinematicBed();
		this.audioBedRunning.set(false);
		for (const timerId of this.timers) {
			clearTimeout(timerId);
		}
		this.timers = [];
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

	private requestInitialMission(): void {
		if (this.didRequestInitialMission) {
			return;
		}

		const playerName = this.navigationState.playerName?.trim() ?? '';
		const characterId = this.navigationState.joinCharacter?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey();

		if (!playerName || !characterId || !sessionKey) {
			return;
		}

		this.didRequestInitialMission = true;
		void this.missionService.ensureMissionExists({
			playerName,
			characterId,
			sessionKey,
			missionId: FIRST_TARGET_MISSION_ID,
			initialStatus: 'started',
		});
	}
}
