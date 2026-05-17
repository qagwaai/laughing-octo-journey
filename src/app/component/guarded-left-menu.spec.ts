import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';
import { GuardedLeftMenu } from './guarded-left-menu';

describe('GuardedLeftMenu', () => {
  let component: GuardedLeftMenu;
  let fixture: ComponentFixture<GuardedLeftMenu>;
  let navigateSpy: jasmine.Spy;
  let missionStateService: jasmine.SpyObj<ShipExteriorMissionStateService> & { lastSaved: () => unknown };

  const missionStateServiceSpy = () => {
    const spy = jasmine.createSpyObj<ShipExteriorMissionStateService>('ShipExteriorMissionStateService', ['loadState']);
    (spy as unknown as { lastSaved: jasmine.Spy }).lastSaved = jasmine.createSpy('lastSaved').and.returnValue(null);
    return spy as jasmine.SpyObj<ShipExteriorMissionStateService> & { lastSaved: () => unknown };
  };

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    navigateSpy = jasmine.createSpy('navigate');
    missionStateService = missionStateServiceSpy();
    missionStateService.loadState.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [GuardedLeftMenu],
      providers: [
        { provide: Router, useValue: { navigate: navigateSpy } },
        { provide: ShipExteriorMissionStateService, useValue: missionStateService },
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
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    component.ngOnDestroy();
  });

  it('should default to minimized and unpinned', () => {
    expect((component as any).isPinned()).toBeFalse();
    expect((component as any).isExpanded()).toBeFalse();
  });

  it('should expand on hover when unpinned', () => {
    (component as any).onMouseEnter();
    expect((component as any).isExpanded()).toBeTrue();

    (component as any).onMouseLeave();
    expect((component as any).isExpanded()).toBeFalse();
  });

  it('should stay expanded when pinned and persist that state', () => {
    (component as any).togglePinned();

    expect((component as any).isPinned()).toBeTrue();
    expect((component as any).isExpanded()).toBeTrue();
    expect(sessionStorage.getItem('guarded-left-menu:pinned')).toBe('true');

    (component as any).onMouseLeave();
    expect((component as any).isExpanded()).toBeTrue();
  });

  it('should restore pinned state from session storage', async () => {
    sessionStorage.setItem('guarded-left-menu:pinned', 'true');

    const restoredFixture = TestBed.createComponent(GuardedLeftMenu);
    const restoredComponent = restoredFixture.componentInstance;

    expect((restoredComponent as any).isPinned()).toBeTrue();
    expect((restoredComponent as any).isExpanded()).toBeTrue();
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

  it('should default disableNonLogout to false', () => {
    expect(component.disableNonLogout).toBeFalse();
  });

  it('should accept disableNonLogout as true', () => {
    component.disableNonLogout = true;
    expect(component.disableNonLogout).toBeTrue();
  });

  it('should enable fabrication guidance when first-target manufacture step is active', () => {
    missionStateService.loadState.and.returnValue({
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

    expect((component as any).showFabricationCue()).toBeTrue();
    expect((component as any).showFabricationCoachmark()).toBeTrue();
    expect((component as any).isFabricationLabGuidanceActiveForItem('fabrication-lab')).toBeTrue();
    expect((component as any).isFabricationLabGuidanceActiveForItem('market-hub')).toBeFalse();
  });

  it('should auto-expand temporarily while fabrication coachmark is active', fakeAsync(() => {
    missionStateService.loadState.and.returnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab.',
      updatedAt: new Date().toISOString(),
      steps: [{ key: 'manufacture_hull_patch_kit', status: 'active' }],
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

    expect((component as any).forceExpanded()).toBeTrue();
    expect((component as any).isExpanded()).toBeTrue();

    tick(8100);

    expect((component as any).forceExpanded()).toBeFalse();
  }));

  it('should persist dismissal and hide coachmark for the same character', () => {
    missionStateService.loadState.and.returnValue({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId: 'c-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab.',
      updatedAt: new Date().toISOString(),
      steps: [{ key: 'manufacture_hull_patch_kit', status: 'active' }],
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

    expect((component as any).showFabricationCoachmark()).toBeTrue();

    (component as any).dismissFabricationLabCoachmark();
    expect((component as any).showFabricationCoachmark()).toBeFalse();

    component.ngOnChanges({
      playerName: { currentValue: 'Pioneer', previousValue: 'Pioneer', firstChange: false, isFirstChange: () => false },
      joinCharacter: {
        currentValue: { id: 'c-1', characterName: 'Nova' },
        previousValue: { id: 'c-1', characterName: 'Nova' },
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect((component as any).showFabricationCue()).toBeTrue();
    expect((component as any).showFabricationCoachmark()).toBeFalse();
  });
});
