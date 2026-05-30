import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { locale } from '../i18n/locale';
import { LeftPanelNavigationContextService } from '../services/left-panel-navigation-context.service';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';
import { buildCueDismissalKey, resolveActiveFirstTargetCue } from './first-target-nav-guidance';

@Component({
  selector: 'app-left-pane-mission-guidance-overlay',
  templateUrl: './left-pane-mission-guidance-overlay.html',
  styleUrls: ['./left-pane-mission-guidance-overlay.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeftPaneMissionGuidanceOverlay {
  protected readonly t = locale;
  private readonly router = inject(Router);
  private readonly missionStateService = inject(ShipExteriorMissionStateService);
  private readonly navContext = inject(LeftPanelNavigationContextService);

  protected readonly activeCue = signal<ReturnType<typeof resolveActiveFirstTargetCue>>(null);
  protected readonly visible = signal(false);

  protected readonly title = computed(() => this.t.game.firstTargetNavGuidance.title);
  protected readonly instruction = computed(() => {
    const cue = this.activeCue();
    if (!cue) {
      return '';
    }

    if (cue.route === 'fabrication-lab') {
      return this.t.game.firstTargetNavGuidance.fabricationInstruction;
    }

    return this.t.game.firstTargetNavGuidance.repairInstruction;
  });
  protected readonly targetLabel = computed(() => {
    const cue = this.activeCue();
    if (!cue) {
      return '';
    }

    if (cue.route === 'fabrication-lab') {
      return this.t.game.firstTargetNavGuidance.fabricationTargetLabel;
    }

    return this.t.game.firstTargetNavGuidance.repairTargetLabel;
  });

  constructor() {
    effect(() => {
      this.missionStateService.lastSaved();
      this.refreshCue();
    });

    effect(() => {
      this.navContext.playerName();
      this.navContext.joinCharacter();
      this.refreshCue();
    });
  }

  protected openGuidedRoute(): void {
    const cue = this.activeCue();
    if (!cue) {
      return;
    }

    this.router.navigate([{ outlets: { left: [cue.route] } }], {
      preserveFragment: true,
      state: {
        playerName: this.navContext.playerName(),
        joinCharacter: this.navContext.joinCharacter(),
      },
    });

    this.dismiss();
  }

  protected dismiss(): void {
    const cue = this.activeCue();
    const characterId = this.navContext.joinCharacter()?.id?.trim() ?? '';
    const dismissalKey = cue ? buildCueDismissalKey(cue, this.navContext.playerName(), characterId) : null;
    if (dismissalKey) {
      this.writeDismissalState(dismissalKey, true);
    }

    this.visible.set(false);
  }

  private refreshCue(): void {
    const playerName = this.navContext.playerName().trim();
    const characterId = this.navContext.joinCharacter()?.id?.trim() ?? '';
    if (!playerName || !characterId) {
      this.activeCue.set(null);
      this.visible.set(false);
      return;
    }

    const inMemoryState = this.missionStateService.lastSaved();
    const state =
      inMemoryState?.missionId === FIRST_TARGET_MISSION_ID && inMemoryState.characterId === characterId
        ? inMemoryState
        : this.missionStateService.loadState({
            missionId: FIRST_TARGET_MISSION_ID,
            playerName,
            characterId,
          });

    const cue = resolveActiveFirstTargetCue(state);
    this.activeCue.set(cue);

    if (!cue) {
      this.visible.set(false);
      return;
    }

    const dismissalKey = buildCueDismissalKey(cue, playerName, characterId);
    const wasDismissed = dismissalKey ? this.readDismissalState(dismissalKey) : false;
    this.visible.set(!wasDismissed);
  }

  private readDismissalState(key: string): boolean {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  private writeDismissalState(key: string, dismissed: boolean): void {
    try {
      localStorage.setItem(key, String(dismissed));
    } catch {
      // Ignore storage failures and keep in-memory behavior only.
    }
  }
}
