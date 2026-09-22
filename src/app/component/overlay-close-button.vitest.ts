import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OverlayCloseButton } from './overlay-close-button';

function setup() {
  const mockRouter = { navigate: vi.fn() };

  TestBed.configureTestingModule({
    imports: [OverlayCloseButton],
    providers: [{ provide: Router, useValue: mockRouter }],
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

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { primary: ['ship-exterior-view'], right: null } }], {
      preserveFragment: true,
      replaceUrl: true,
    });
  });
});
