import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { PlayerCharacterSummary } from '../model/character-list';
import { resolveActiveFirstTargetCue } from './first-target-nav-guidance';
import { LeftPanelNavigationContextService } from '../services/left-panel-navigation-context.service';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';

const MENU_PIN_STORAGE_KEY = 'guarded-left-menu:pinned';

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
export class GuardedLeftMenu implements OnChanges {
  private router = inject(Router);
  private missionStateService = inject(ShipExteriorMissionStateService);
  private leftPanelContext = inject(LeftPanelNavigationContextService);

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
  protected activeGuidedRoute = signal<'fabrication-lab' | 'repair-retrofit' | null>(null);
  protected isExpanded = computed(() => this.isPinned() || this.isHovered());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playerName'] || changes['joinCharacter']) {
      this.leftPanelContext.updateContext(this.playerName, this.joinCharacter);
      this.refreshFirstTargetGuidance();
    }
  }

  navigateLeft(route: string): void {
    const outlets =
      route === 'mission-board'
        ? { left: ['game-main'], right: ['mission-board'] }
        : { left: [route] };

    this.router.navigate([{ outlets }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName,
        joinCharacter: this.joinCharacter,
      },
    });
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

  private refreshFirstTargetGuidance(): void {
    const playerName = this.playerName.trim();
    const characterId = this.joinCharacter?.id?.trim() ?? '';
    if (!playerName || !characterId) {
      this.activeGuidedRoute.set(null);
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

    const activeCue = resolveActiveFirstTargetCue(state);
    this.activeGuidedRoute.set(activeCue?.route ?? null);
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
