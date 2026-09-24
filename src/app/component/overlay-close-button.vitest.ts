import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OverlayCloseButton } from './overlay-close-button';
import { SessionService } from '../services/session.service';

function setup(sessionOverrides: Partial<Record<string, unknown>> = {}) {
  const mockRouter = { navigate: vi.fn() };
  const mockSession = {
    missionEntryContext: signal(null),
    playerName: signal(''),
    activeCharacter: signal(null),
    ...sessionOverrides,
  };

  TestBed.configureTestingModule({
    imports: [OverlayCloseButton],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SessionService, useValue: mockSession },
    ],
  });

  const fixture = TestBed.createComponent(OverlayCloseButton);
  fixture.detectChanges();
  return { fixture, mockRouter };
}

describe('OverlayCloseButton', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render a labelled close button', () => {
    const { fixture } = setup();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]');

    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Close panel');
  });

  it('should clear the right outlet and pin the primary outlet to the ship exterior scene', () => {
    const { fixture, mockRouter } = setup();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]');

    button.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null } }],
      expect.objectContaining({ preserveFragment: true, replaceUrl: true }),
    );
  });

  it('should preserve navigation identity from the mission entry context', () => {
    const character = { id: 'char-1', name: 'Vex' };
    const { fixture, mockRouter } = setup({
      missionEntryContext: signal({ playerName: 'pilot-1', joinCharacter: character }),
    });
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]');

    button.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null } }],
      expect.objectContaining({ state: { playerName: 'pilot-1', joinCharacter: character } }),
    );
  });

  it('should fall back to session identity when no mission entry context exists', () => {
    const character = { id: 'char-2', name: 'Rell' };
    const { fixture, mockRouter } = setup({
      playerName: signal('pilot-2'),
      activeCharacter: signal(character),
    });
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]');

    button.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null } }],
      expect.objectContaining({ state: { playerName: 'pilot-2', joinCharacter: character } }),
    );
  });

  it('should degrade to an empty state when the session exposes no identity accessors', () => {
    const { fixture, mockRouter } = setup({
      missionEntryContext: undefined,
      playerName: undefined,
      activeCharacter: undefined,
    });
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]');

    button.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null } }],
      expect.objectContaining({ state: {} }),
    );
  });
});
