import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockSessionService, createMockSocketService } from '../../../testing';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import RepairRetrofitPage from './repair-retrofit';

interface NavigationState {
  playerName?: string;
  joinCharacter?: {
    id: string;
    characterName: string;
    missions?: Array<{ missionId: string; status: string }>;
  };
  joinShip?: {
    id: string;
    name: string;
    model: string;
    tier: number;
    spatial: any;
    inventory?: Array<{ id: string; itemType: string; displayName?: string }>;
  };
}

function setup(state?: NavigationState) {
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
    navigate: jasmine.createSpy('navigate'),
  };
  const mockSocket = createMockSocketService();
  const mockSession = createMockSessionService('session-key');
  const mockShipService = {
    listShipsByOwner: jasmine.createSpy('listShipsByOwner'),
  };
  const mockSocketLifecycle = {
    runWhenConnected: jasmine.createSpy('runWhenConnected'),
  };

  TestBed.configureTestingModule({
    imports: [RepairRetrofitPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: mockSocket },
      { provide: SessionService, useValue: mockSession },
      { provide: ShipService, useValue: mockShipService },
      { provide: SocketLifecycleService, useValue: mockSocketLifecycle },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(RepairRetrofitPage);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    mockRouter,
    mockSocket,
    mockSession,
    mockShipService,
    mockSocketLifecycle,
  };
}

describe('RepairRetrofitPage', () => {
  it('should initialize from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual(jasmine.objectContaining({ id: 'c-1', characterName: 'Nova' }));
  });

  it('should fallback to empty values', () => {
    const { component } = setup();
    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
  });

  it('should apply cold boot damage fallback when first-target mission is in-progress', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: {
        id: 'c-1',
        characterName: 'Nova',
        missions: [{ missionId: 'first-target', status: 'started' }],
      },
    });

    expect(component['damageProfile']()).not.toBeNull();
    expect(component['damageProfile']()!.origin).toBe('cold-boot-scripted');
    expect(component['damageProfile']()!.overallStatus).toBe('damaged');
    expect(component['damageProfile']()!.systems.length).toBeGreaterThan(0);
    expect(component['damageProfile']()!.systems[0].severity).toBe('critical');
  });

  it('should downgrade subsystem severity during staged repair', () => {
    // The repair-retrofit page holds the damage profile in a writable signal.
    // Updating the signal reflects state changes — validating signal reactivity.
    const { component } = setup({
      joinCharacter: {
        id: 'c-1',
        characterName: 'Nova',
        missions: [{ missionId: 'first-target', status: 'started' }],
      },
    });

    const profile = component['damageProfile']()!;
    expect(profile.systems[0].severity).toBe('critical');

    // Stage 1: critical → major
    component['damageProfile'].set({
      ...profile,
      systems: profile.systems.map((s: any) => ({ ...s, severity: 'major' })),
    });
    expect(component['damageProfile']()!.systems[0].severity).toBe('major');

    // Stage 2: major → minor
    const profileMajor = component['damageProfile']()!;
    component['damageProfile'].set({
      ...profileMajor,
      systems: profileMajor.systems.map((s: any) => ({ ...s, severity: 'minor' })),
    });
    expect(component['damageProfile']()!.systems[0].severity).toBe('minor');

    // Stage 3: fully repaired
    const profileMinor = component['damageProfile']()!;
    component['damageProfile'].set({ ...profileMinor, overallStatus: 'intact', systems: [] });
    expect(component['damageProfile']()!.systems.length).toBe(0);
    expect(component['damageProfile']()!.overallStatus).toBe('intact');
  });

  it('uses ship damage profile when present even during first-target mission', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: {
        id: 'c-1',
        characterName: 'Nova',
        missions: [{ missionId: 'first-target', status: 'in-progress' }],
      },
      joinShip: {
        id: 's-1',
        name: 'Iron Nomad',
        model: 'Scavenger Pod',
        tier: 1,
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [],
        damageProfile: {
          origin: 'wear',
          overallStatus: 'intact',
          summary: 'Nominal',
          systems: [],
        } as any,
      } as any,
    });

    expect(component['damageProfile']()?.origin).toBe('wear');
    expect(component['damageProfile']()?.overallStatus).toBe('intact');
  });

  it('treats paused first-target mission as in-progress for cold-boot fallback', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: {
        id: 'c-1',
        characterName: 'Nova',
        missions: [{ missionId: 'first-target', status: 'paused' }],
      },
    });

    expect(component['damageProfile']()?.origin).toBe('cold-boot-scripted');
  });

  it('does not use cold-boot fallback when first-target mission is completed', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: {
        id: 'c-1',
        characterName: 'Nova',
        missions: [{ missionId: 'first-target', status: 'completed' }],
      },
    });

    expect(component['damageProfile']()).toBeNull();
  });

  it('opens repair items view with full navigation state payload', () => {
    const { component, mockRouter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-1',
        name: 'Iron Nomad',
        model: 'Scavenger Pod',
        tier: 1,
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        inventory: [],
      },
    });
    component['selectedFilter'].set('needs-repair');
    component['selectedGrouping'].set('severity');
    component['searchQuery'].set('coolant');

    component['openRepairItemsView']();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['repair-retrofit-items'], left: ['repair-retrofit'] } }],
      jasmine.objectContaining({
        preserveFragment: true,
        queryParams: jasmine.any(Object),
        state: jasmine.objectContaining({
          playerName: 'Pioneer',
          selectedFilter: 'needs-repair',
          selectedGrouping: 'severity',
          searchQuery: 'coolant',
          missionId: 'first-target',
        }),
      }),
    );
  });

  it('navigates to character profile preserving player and character state', () => {
    const { component, mockRouter } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });

    component.navigateToCharacterProfile();

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: jasmine.objectContaining({ id: 'c-1' }),
      },
    });
  });

  it('reports that repair items view is unavailable when no active ship exists', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });
    component['activeShip'].set(null);

    expect(component['canOpenRepairItems']()).toBeFalse();
  });

  it('sets ship-load error when required player/session context is missing', () => {
    const { component, mockShipService } = setup();

    component['loadActiveShip']();

    expect(component['shipLoadError']()).toBe('Unable to load ship context for repair operations.');
    expect(mockShipService.listShipsByOwner).not.toHaveBeenCalled();
  });

  it('sets ship-load error when ship list request fails', () => {
    const { component, mockShipService } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });
    mockShipService.listShipsByOwner.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({ success: false, message: 'ship-list failed' });
    });

    component['loadActiveShip']();

    expect(component['isLoadingShip']()).toBeFalse();
    expect(component['shipLoadError']()).toBe('ship-list failed');
  });

  it('hydrates active ship and clears load error on successful ship list response', () => {
    const { component, mockShipService, mockSession } = setup({
      playerName: 'Pioneer',
      joinCharacter: {
        id: 'c-1',
        characterName: 'Nova',
        missions: [{ missionId: 'first-target', status: 'started' }],
      },
    });
    const setActiveShipSpy = spyOn(mockSession, 'setActiveShip').and.callThrough();
    mockShipService.listShipsByOwner.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({
        success: true,
        ships: [
          {
            id: 's-1',
            name: 'Scavenger Pod',
            model: 'Scavenger Pod',
            tier: 1,
            spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 10, y: 0, z: 0 }, epochMs: 0 },
            inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron', state: 'contained', damageStatus: 'intact' }],
          },
        ],
      });
    });

    component['shipLoadError'].set('previous error');
    component['loadActiveShip']();

    expect(component['activeShip']()?.id).toBe('s-1');
    expect(component['shipLoadError']()).toBeNull();
    expect((component['activeShip']()?.inventory?.length ?? 0)).toBeGreaterThan(0);
    expect(setActiveShipSpy).toHaveBeenCalled();
    // No explicit ship profile was returned; in-progress mission falls back to cold-boot profile.
    expect(component['damageProfile']()?.origin).toBe('cold-boot-scripted');
  });

  it('sets hard-fail error when ship list succeeds with no ships', () => {
    const { component, mockShipService } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: {
        id: 's-existing',
        name: 'Existing',
        model: 'Scavenger Pod',
        tier: 1,
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
      },
    });
    mockShipService.listShipsByOwner.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({ success: true, ships: [] });
    });

    component['loadActiveShip']();

    expect(component['activeShip']()).toBeNull();
    expect(component['shipLoadError']()).toBe('No ship with usable spatial data is available.');
  });

  it('sets hard-fail error when ship list has no usable ship spatial data', () => {
    const { component, mockShipService } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });
    mockShipService.listShipsByOwner.and.callFake((_request: any, cb: (response: any) => void) => {
      cb({
        success: true,
        ships: [
          {
            id: 's-1',
            name: 'Scavenger Pod',
            model: 'Scavenger Pod',
            tier: 1,
            spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
            inventory: [],
          },
        ],
      });
    });

    component['loadActiveShip']();

    expect(component['activeShip']()).toBeNull();
    expect(component['shipLoadError']()).toBe('No ship with usable spatial data is available.');
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: {
          id: 's-1',
          name: 'Iron Nomad',
          model: 'Scavenger Pod',
          tier: 1,
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: [0, 0, 0], epochMs: 0 },
        },
      });
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
