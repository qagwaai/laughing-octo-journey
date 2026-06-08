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
  protected readonly menuMode = this.leftPanelContext.menuMode;
  protected isHovered = signal(false);
  protected activeGuidedRoute = signal<'fabrication-lab' | 'repair-retrofit' | null>(null);
  protected isExpanded = computed(() => {
    const mode = this.menuMode();
    if (mode === 'pinned') return true;
    if (mode === 'keep-mini') return false;
    return this.isHovered();
  });

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
    if (this.menuMode() === 'keep-mini') return;
    this.isHovered.set(true);
  }

  protected onMouseLeave(): void {
    if (this.menuMode() === 'keep-mini') return;
    this.isHovered.set(false);
  }

  protected togglePinned(): void {
    const currentMode = this.menuMode();
    if (currentMode === 'unpinned') {
      this.leftPanelContext.setMenuMode('pinned');
      return;
    }
    if (currentMode === 'pinned') {
      this.leftPanelContext.setMenuMode('keep-mini');
      this.isHovered.set(false);
      return;
    }
    this.leftPanelContext.setMenuMode('unpinned');
  }

  protected menuToggleIcon(): string {
    const mode = this.menuMode();
    if (mode === 'unpinned') return '◨';
    if (mode === 'pinned') return '◧';
    return '◫';
  }

  protected menuToggleLabel(): string {
    const mode = this.menuMode();
    if (mode === 'unpinned') return 'Pin Menu';
    if (mode === 'pinned') return 'Keep Mini';
    return 'Unpin Menu';
  }

  protected menuToggleAriaLabel(): string {
    const mode = this.menuMode();
    if (mode === 'unpinned') return 'Pin operations menu';
    if (mode === 'pinned') return 'Keep operations menu mini';
    return 'Unpin operations menu';
  }

  protected menuToggleAriaPressed(): 'true' | 'false' | 'mixed' {
    const mode = this.menuMode();
    if (mode === 'unpinned') return 'false';
    if (mode === 'pinned') return 'true';
    return 'mixed';
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

}
