import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { LeftPanelNavigationContextService } from '../services/left-panel-navigation-context.service';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';
import { GuardedLeftMenu } from './guarded-left-menu';

describe('GuardedLeftMenu', () => {
  let component: GuardedLeftMenu;
  let fixture: ComponentFixture<GuardedLeftMenu>;
  let navigateSpy: jasmine.Spy;
  let contextService: LeftPanelNavigationContextService;
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
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
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

    expect((component as any).activeGuidedRoute()).toBe('fabrication-lab');
    expect((component as any).isGuidanceActiveForItem('fabrication-lab')).toBeTrue();
    expect((component as any).isGuidanceActiveForItem('market-hub')).toBeFalse();
  });

  it('should enable repair guidance when first-target repair step is active', () => {
    missionStateService.loadState.and.returnValue({
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
    expect((component as any).isGuidanceActiveForItem('repair-retrofit')).toBeTrue();
    expect((component as any).isGuidanceActiveForItem('fabrication-lab')).toBeFalse();
  });
});
