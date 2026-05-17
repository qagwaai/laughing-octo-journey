import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { PlayerCharacterSummary } from '../model/character-list';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';

const MENU_PIN_STORAGE_KEY = 'guarded-left-menu:pinned';
const FAB_LAB_HINT_DISMISS_PREFIX = 'first-target:fabrication-lab-hint-dismissed';
const REPAIR_HINT_DISMISS_PREFIX = 'first-target:repair-retrofit-hint-dismissed';
const AUTO_EXPAND_DURATION_MS = 8000;

interface GuidedMissionCue {
  route: 'fabrication-lab' | 'repair-retrofit';
  stepKey: 'manufacture_hull_patch_kit' | 'repair_scavenger_pod';
  dismissPrefix: string;
  coachmarkText: string;
}

const GUIDED_MISSION_CUES: readonly GuidedMissionCue[] = [
  {
    route: 'repair-retrofit',
    stepKey: 'repair_scavenger_pod',
    dismissPrefix: REPAIR_HINT_DISMISS_PREFIX,
    coachmarkText: 'Mission objective updated. Open Repair & Retrofit to continue first-target.',
  },
  {
    route: 'fabrication-lab',
    stepKey: 'manufacture_hull_patch_kit',
    dismissPrefix: FAB_LAB_HINT_DISMISS_PREFIX,
    coachmarkText: 'Mission objective updated. Open Fabrication Lab to continue first-target.',
  },
];

interface GuardedMenuItem {
  route: string;
  label: string;
  icon: string;
  logout?: boolean;
}

@Component({
  selector: 'app-guarded-left-menu',
  templateUrl: './guarded-left-menu.html',
  styleUrls: ['./guarded-left-menu.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuardedLeftMenu implements OnChanges, OnDestroy {
  private router = inject(Router);
  private missionStateService = inject(ShipExteriorMissionStateService);
  private autoExpandTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // React to scene-side mission state saves (e.g., after launch) even when
      // this menu's inputs are unchanged in the left outlet.
      this.missionStateService.lastSaved();
      this.refreshFirstTargetGuidance();
    });
  }

  @Input() playerName = '';
  @Input() joinCharacter: PlayerCharacterSummary | null = null;
  @Input() disableNonLogout = false;

  protected readonly menuItems: GuardedMenuItem[] = [
    { route: 'stellar-initiation', label: 'Stellar Initiation', icon: 'SI' },
    { route: 'mission-board', label: 'Mission Board', icon: 'MB' },
    { route: 'viewer', label: 'Viewer', icon: 'VW' },
    { route: 'character-profile', label: 'Character Profile', icon: 'CP' },
    { route: 'ship-hangar', label: 'Ship Hangar', icon: 'SH' },
    { route: 'repair-retrofit', label: 'Repair & Retrofit', icon: 'RR' },
    { route: 'market-hub', label: 'Market Hub', icon: 'MH' },
    { route: 'fabrication-lab', label: 'Fabrication Lab', icon: 'FL' },
    { route: 'logout', label: 'Logout', icon: 'LO', logout: true },
  ];
  protected isPinned = signal(this.readPinnedState());
  protected isHovered = signal(false);
  protected forceExpanded = signal(false);
  protected activeGuidedRoute = signal<'fabrication-lab' | 'repair-retrofit' | null>(null);
  protected coachmarkText = signal('');
  protected showGuidanceCoachmark = signal(false);
  protected isExpanded = computed(() => this.isPinned() || this.isHovered() || this.forceExpanded());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playerName'] || changes['joinCharacter']) {
      this.refreshFirstTargetGuidance();
    }
  }

  ngOnDestroy(): void {
    this.clearAutoExpandTimer();
  }

  navigateLeft(route: string): void {
    this.router.navigate([{ outlets: { left: [route] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName,
        joinCharacter: this.joinCharacter,
      },
    });

    if (route === this.activeGuidedRoute()) {
      this.dismissGuidanceCoachmark();
    }
  }

  protected onMouseEnter(): void {
    this.isHovered.set(true);
  }

  protected onMouseLeave(): void {
    this.isHovered.set(false);
  }

  protected togglePinned(): void {
    const nextPinned = !this.isPinned();
    this.isPinned.set(nextPinned);
    this.writePinnedState(nextPinned);
  }

  protected isGuidanceActiveForItem(route: string): boolean {
    return route === this.activeGuidedRoute();
  }

  protected openGuidedRouteFromCoachmark(): void {
    const route = this.activeGuidedRoute();
    if (!route) {
      return;
    }
    this.navigateLeft(route);
  }

  protected dismissGuidanceCoachmark(): void {
    const dismissalKey = this.buildActiveCueDismissalKey();
    if (dismissalKey) {
      this.writeDismissalState(dismissalKey, true);
    }
    this.showGuidanceCoachmark.set(false);
  }

  private refreshFirstTargetGuidance(): void {
    const playerName = this.playerName.trim();
    const characterId = this.joinCharacter?.id?.trim() ?? '';
    if (!playerName || !characterId) {
      this.activeGuidedRoute.set(null);
      this.coachmarkText.set('');
      this.showGuidanceCoachmark.set(false);
      this.forceExpanded.set(false);
      this.clearAutoExpandTimer();
      return;
    }

    const state = this.missionStateService.loadState({
      missionId: FIRST_TARGET_MISSION_ID,
      playerName,
      characterId,
    });

    const activeCue = GUIDED_MISSION_CUES.find((cue) =>
      state?.steps?.some((step) => step.key === cue.stepKey && step.status === 'active'),
    );
    this.activeGuidedRoute.set(activeCue?.route ?? null);
    this.coachmarkText.set(activeCue?.coachmarkText ?? '');

    const dismissalKey = activeCue ? this.buildCueDismissalKey(activeCue.dismissPrefix) : null;
    const wasDismissed = dismissalKey ? this.readDismissalState(dismissalKey) : false;
    this.showGuidanceCoachmark.set(!!activeCue && !wasDismissed);

    if (activeCue && !wasDismissed) {
      this.forceExpanded.set(true);
      this.clearAutoExpandTimer();
      this.autoExpandTimer = setTimeout(() => {
        this.forceExpanded.set(false);
        this.autoExpandTimer = null;
      }, AUTO_EXPAND_DURATION_MS);
      return;
    }

    this.forceExpanded.set(false);
    this.clearAutoExpandTimer();
  }

  private clearAutoExpandTimer(): void {
    if (this.autoExpandTimer) {
      clearTimeout(this.autoExpandTimer);
      this.autoExpandTimer = null;
    }
  }

  private buildActiveCueDismissalKey(): string | null {
    const cue = GUIDED_MISSION_CUES.find((entry) => entry.route === this.activeGuidedRoute());
    if (!cue) {
      return null;
    }

    return this.buildCueDismissalKey(cue.dismissPrefix);
  }

  private buildCueDismissalKey(prefix: string): string | null {
    const playerName = this.playerName.trim();
    const characterId = this.joinCharacter?.id?.trim() ?? '';
    if (!playerName || !characterId) {
      return null;
    }

    return `${prefix}::${playerName}::${characterId}`;
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

  private readPinnedState(): boolean {
    try {
      return sessionStorage.getItem(MENU_PIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writePinnedState(isPinned: boolean): void {
    try {
      sessionStorage.setItem(MENU_PIN_STORAGE_KEY, String(isPinned));
    } catch {
      // Ignore storage failures and keep in-memory state only.
    }
  }
}
