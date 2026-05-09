import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import GameMainPage from './game-main';

function setup(navigationState?: Record<string, unknown>) {
  const mockRouter = {
    getCurrentNavigation: () => (navigationState ? { extras: { state: navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  TestBed.configureTestingModule({
    imports: [GameMainPage],
    providers: [{ provide: Router, useValue: mockRouter }],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(GameMainPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('GameMainPage', () => {
  it('should initialize from navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova' },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
  });

  it('should fallback to empty values', () => {
    const { component } = setup();
    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
