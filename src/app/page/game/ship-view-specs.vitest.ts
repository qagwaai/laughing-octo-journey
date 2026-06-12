import { describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import ShipViewSpecsPage from './ship-view-specs';

interface ShipViewSpecsState {
  playerName?: string;
  joinCharacter?: { id: string; characterName: string };
  joinShip?: { id: string; name: string; model?: string; tier?: number; status?: string };
}

function setup(state?: ShipViewSpecsState) {
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
    navigate: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [ShipViewSpecsPage],
    providers: [{ provide: Router, useValue: mockRouter }],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ShipViewSpecsPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('ShipViewSpecsPage', () => {
  it('should initialize selected ship context from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
      joinShip: { id: 'd-2', name: 'Guardian', model: 'G-Class', tier: 2, status: 'ACTIVE' },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
    expect(component['joinShip']()).toEqual(
      expect.objectContaining({ id: 'd-2', name: 'Guardian', model: 'G-Class', tier: 2, status: 'ACTIVE' }),
    );
  });

  it('should handle missing ship context safely', () => {
    const { component } = setup({ playerName: 'Pioneer' });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toBeNull();
    expect(component['joinShip']()).toBeNull();
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
        joinShip: {
          id: 'd-2',
          name: 'Guardian',
          model: 'G-Class',
          tier: 2,
          status: 'ACTIVE',
        },
      });
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
