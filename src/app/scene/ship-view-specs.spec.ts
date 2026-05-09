import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NGT_STORE } from 'angular-three';

import ShipViewSpecs from './ship-view-specs';

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName: string };
  joinShip?: { id: string; name: string; model?: string; tier?: number; status?: string };
}

function setup(state?: NavigationState) {
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
  };

  TestBed.configureTestingModule({
    imports: [ShipViewSpecs],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: NGT_STORE, useValue: { snapshot: { gl: {} } } },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  TestBed.overrideComponent(ShipViewSpecs, { set: { imports: [], template: '' } });

  const fixture = TestBed.createComponent(ShipViewSpecs);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture };
}

describe('ShipViewSpecs Scene', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should initialize selected ship context from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: { id: 'd-2', name: 'Guardian', model: 'G-Class', tier: 2, status: 'ACTIVE' },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual(jasmine.objectContaining({ id: 'c-1', characterName: 'Nova' }));
    expect(component['joinShip']()).toEqual(
      jasmine.objectContaining({ id: 'd-2', name: 'Guardian', model: 'G-Class', tier: 2, status: 'ACTIVE' }),
    );
  });

  it('should handle missing ship context safely', () => {
    const { component } = setup({ playerName: 'Pioneer' });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toBeNull();
    expect(component['joinShip']()).toBeNull();
  });

  it('should define its own current route label for in-canvas display', () => {
    const { component } = setup();
    // Real component uses computed 'routeLabel' (not 'currentRouteLabel' string property)
    expect(component['routeLabel']()).toBe('/ship-view-specs');
  });
});
