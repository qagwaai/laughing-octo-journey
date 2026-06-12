import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { LeftPanelNavigationContextService } from '../services/left-panel-navigation-context.service';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';
import { GuardedLeftMenu } from './guarded-left-menu';

describe('GuardedLeftMenu', () => {
  let component: GuardedLeftMenu;
  let fixture: ComponentFixture<GuardedLeftMenu>;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let contextService: LeftPanelNavigationContextService;
  let missionStateService: {
    loadState: ReturnType<typeof vi.fn>;
    lastSaved: ReturnType<typeof vi.fn>;
  };

  const missionStateServiceSpy = () => {
    return {
      loadState: vi.fn().mockReturnValue(null),
      lastSaved: vi.fn().mockReturnValue(null),
    };
  };

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    navigateSpy = vi.fn();
    missionStateService = missionStateServiceSpy();
    missionStateService.loadState.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [GuardedLeftMenu],
      providers: [
        { provide: Router, useValue: { navigate: navigateSpy } },
        { provide: ShipExteriorMissionStateService, useValue: missionStateService },
        LeftPanelNavigationContextService,
      ],
    })
      .overrideComponent(GuardedLeftMenu, {
        set: {
          template: '',
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(GuardedLeftMenu);
    component = fixture.componentInstance;
    contextService = TestBed.inject(LeftPanelNavigationContextService);
    contextService.setMenuMode('unpinned');
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should default to minimized and unpinned', () => {
    expect((component as any).menuMode()).toBe('unpinned');
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should expand on hover when unpinned', () => {
    (component as any).onMouseEnter();
    expect((component as any).isExpanded()).toBe(true);

    (component as any).onMouseLeave();
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should cycle through menu modes: unpinned -> pinned -> keep-mini -> unpinned', () => {
    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('pinned');
    expect((component as any).isExpanded()).toBe(true);

    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('keep-mini');
    expect((component as any).isExpanded()).toBe(false);

    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('unpinned');
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should expose toggle UI state for each menu mode', () => {
    expect((component as any).menuMode()).toBe('unpinned');
    expect((component as any).menuToggleLabel()).toBe('Pin Menu');
    expect((component as any).menuToggleIcon()).toBe('◨');
    expect((component as any).menuToggleAriaPressed()).toBe('false');

    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('pinned');
    expect((component as any).menuToggleLabel()).toBe('Keep Mini');
    expect((component as any).menuToggleIcon()).toBe('◧');
    expect((component as any).menuToggleAriaPressed()).toBe('true');

    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('keep-mini');
    expect((component as any).menuToggleLabel()).toBe('Unpin Menu');
    expect((component as any).menuToggleIcon()).toBe('◫');
    expect((component as any).menuToggleAriaPressed()).toBe('mixed');
  });

  it('should not expand on hover when keep-mini is active', () => {
    (component as any).togglePinned();
    (component as any).togglePinned();

    (component as any).onMouseEnter();
    expect((component as any).isExpanded()).toBe(false);

    (component as any).onMouseLeave();
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should clear hover expansion when switching from hovered unpinned to keep-mini', () => {
    (component as any).onMouseEnter();
    expect((component as any).isExpanded()).toBe(true);

    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('pinned');
    expect((component as any).isExpanded()).toBe(true);

    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('keep-mini');
    expect((component as any).isExpanded()).toBe(false);

    (component as any).onMouseEnter();
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should always start unpinned after reload even when storage has legacy pinned value', async () => {
    sessionStorage.setItem('guarded-left-menu:pinned', 'true');

    const restoredFixture = TestBed.createComponent(GuardedLeftMenu);
    const restoredComponent = restoredFixture.componentInstance;

    expect((restoredComponent as any).menuMode()).toBe('unpinned');
    expect((restoredComponent as any).isExpanded()).toBe(false);
  });

  it('should keep keep-mini mode across component recreation in the same app session', () => {
    (component as any).togglePinned();
    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('keep-mini');

    const recreatedFixture = TestBed.createComponent(GuardedLeftMenu);
    const recreatedComponent = recreatedFixture.componentInstance;

    expect((recreatedComponent as any).menuMode()).toBe('keep-mini');
    expect((recreatedComponent as any).isExpanded()).toBe(false);
  });

  it('should navigate with preserved player and character state', () => {
    component.playerName = 'Pioneer';
    component.joinCharacter = { id: 'c-1', characterName: 'Nova' } as any;

    component.navigateLeft('market-hub');

    expect(navigateSpy).toHaveBeenCalledWith([{ outlets: { left: ['market-hub'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });
  });

  it('should preserve keep-mini mode after standard route navigation', () => {
    (component as any).togglePinned();
    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('keep-mini');

    component.navigateLeft('market-hub');

    expect((component as any).menuMode()).toBe('keep-mini');
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should open mission board in right outlet while keeping game-main in left outlet', () => {
    component.playerName = 'Pioneer';
    component.joinCharacter = { id: 'c-1', characterName: 'Nova' } as any;

    component.navigateLeft('mission-board');

    expect(navigateSpy).toHaveBeenCalledWith([{ outlets: { left: ['game-main'], right: ['mission-board'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });
  });

  it('should preserve keep-mini mode after mission-board navigation', () => {
    (component as any).togglePinned();
    (component as any).togglePinned();
    expect((component as any).menuMode()).toBe('keep-mini');

    component.navigateLeft('mission-board');

    expect((component as any).menuMode()).toBe('keep-mini');
    expect((component as any).isExpanded()).toBe(false);
  });

  it('should publish left-panel navigation context when inputs change', () => {
    component.playerName = 'Pioneer';
    component.joinCharacter = { id: 'c-1', characterName: 'Nova' } as any;

    component.ngOnChanges({
      playerName: { currentValue: 'Pioneer', previousValue: '', firstChange: false, isFirstChange: () => false },
      joinCharacter: {
        currentValue: { id: 'c-1', characterName: 'Nova' },
        previousValue: null,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(contextService.playerName()).toBe('Pioneer');
    expect(contextService.joinCharacter()?.id).toBe('c-1');
  });

  it('should default disableNonLogout to false', () => {
    expect(component.disableNonLogout).toBe(false);
  });

  it('should accept disableNonLogout as true', () => {
    component.disableNonLogout = true;
    expect(component.disableNonLogout).toBe(true);
  });

  it('should enable fabrication guidance when first-target manufacture step is active', () => {
    missionStateService.loadState.mockReturnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab.',
      updatedAt: new Date().toISOString(),
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'active' },
      ],
    } as any);

    component.playerName = 'Pioneer';
    component.joinCharacter = { id: 'c-1', characterName: 'Nova' } as any;
    component.ngOnChanges({
      playerName: { currentValue: 'Pioneer', previousValue: '', firstChange: false, isFirstChange: () => false },
      joinCharacter: {
        currentValue: { id: 'c-1', characterName: 'Nova' },
        previousValue: null,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect((component as any).activeGuidedRoute()).toBe('fabrication-lab');
    expect((component as any).isGuidanceActiveForItem('fabrication-lab')).toBe(true);
    expect((component as any).isGuidanceActiveForItem('market-hub')).toBe(false);
  });

  it('should enable repair guidance when first-target repair step is active', () => {
    missionStateService.loadState.mockReturnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      updatedAt: new Date().toISOString(),
      steps: [{ key: 'repair_scavenger_pod', status: 'active' }],
    } as any);

    component.playerName = 'Pioneer';
    component.joinCharacter = { id: 'c-1', characterName: 'Nova' } as any;
    component.ngOnChanges({
      playerName: { currentValue: 'Pioneer', previousValue: '', firstChange: false, isFirstChange: () => false },
      joinCharacter: {
        currentValue: { id: 'c-1', characterName: 'Nova' },
        previousValue: null,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect((component as any).activeGuidedRoute()).toBe('repair-retrofit');
    expect((component as any).isGuidanceActiveForItem('repair-retrofit')).toBe(true);
    expect((component as any).isGuidanceActiveForItem('fabrication-lab')).toBe(false);
  });
});
