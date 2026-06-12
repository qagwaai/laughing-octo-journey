import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { LeftPanelNavigationContextService } from '../services/left-panel-navigation-context.service';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';
import { LeftPaneMissionGuidanceOverlay } from './left-pane-mission-guidance-overlay';

describe('LeftPaneMissionGuidanceOverlay', () => {
  let fixture: ComponentFixture<LeftPaneMissionGuidanceOverlay>;
  let component: LeftPaneMissionGuidanceOverlay;
  let missionStateService: {
    loadState: ReturnType<typeof vi.fn>;
    lastSaved: ReturnType<typeof vi.fn>;
  };
  let contextService: LeftPanelNavigationContextService;
  let navigateSpy: ReturnType<typeof vi.fn>;

  function missionStateServiceSpy() {
    return {
      loadState: vi.fn().mockReturnValue(null),
      lastSaved: vi.fn().mockReturnValue(null),
    };
  }

  beforeEach(async () => {
    localStorage.clear();
    navigateSpy = vi.fn().mockResolvedValue(true);
    missionStateService = missionStateServiceSpy();
    missionStateService.loadState.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [LeftPaneMissionGuidanceOverlay],
      providers: [
        LeftPanelNavigationContextService,
        { provide: ShipExteriorMissionStateService, useValue: missionStateService },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    }).compileComponents();

    contextService = TestBed.inject(LeftPanelNavigationContextService);
    fixture = TestBed.createComponent(LeftPaneMissionGuidanceOverlay);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should remain hidden when no active cue exists', () => {
    contextService.updateContext('Pioneer', { id: 'c-1', characterName: 'Nova' } as any);
    fixture.detectChanges();

    expect((component as any).visible()).toBe(false);
  });

  it('should show fabrication overlay when manufacture step is active', () => {
    missionStateService.loadState.mockReturnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab.',
      updatedAt: new Date().toISOString(),
      steps: [{ key: 'manufacture_hull_patch_kit', status: 'active' }],
    } as any);

    contextService.updateContext('Pioneer', { id: 'c-1', characterName: 'Nova' } as any);
    fixture.detectChanges();

    expect((component as any).visible()).toBe(true);
    expect((component as any).targetLabel()).toContain('Fabrication Lab');
  });

  it('should dismiss overlay for current step and keep it hidden until step changes', () => {
    missionStateService.loadState.mockReturnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab.',
      updatedAt: new Date().toISOString(),
      steps: [{ key: 'manufacture_hull_patch_kit', status: 'active' }],
    } as any);

    contextService.updateContext('Pioneer', { id: 'c-1', characterName: 'Nova' } as any);
    fixture.detectChanges();

    expect((component as any).visible()).toBe(true);

    (component as any).dismiss();
    expect((component as any).visible()).toBe(false);

    (component as any).refreshCue();
    expect((component as any).visible()).toBe(false);
  });

  it('should navigate to the guided left route when open is clicked', () => {
    missionStateService.loadState.mockReturnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      updatedAt: new Date().toISOString(),
      steps: [{ key: 'repair_scavenger_pod', status: 'active' }],
    } as any);

    const character = { id: 'c-1', characterName: 'Nova' } as any;
    contextService.updateContext('Pioneer', character);
    fixture.detectChanges();

    (component as any).openGuidedRoute();

    expect(navigateSpy).toHaveBeenCalledWith([{ outlets: { left: ['repair-retrofit'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });
  });
});
