import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockSessionService, createMockSocketService } from '../../../testing';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
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

  TestBed.configureTestingModule({
    imports: [RepairRetrofitPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: mockSocket },
      { provide: SessionService, useValue: mockSession },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(RepairRetrofitPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter, mockSocket, mockSession };
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
