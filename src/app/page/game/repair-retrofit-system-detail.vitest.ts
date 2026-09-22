import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { createMockSessionService, createMockSocketService } from '../../../testing';
import { SessionService } from '../../services/session.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { SocketService } from '../../services/socket.service';
import RepairRetrofitSystemDetailPage from './repair-retrofit-system-detail';

function setup() {
  const mockRouter = {
    getCurrentNavigation: () => null,
    navigate: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [RepairRetrofitSystemDetailPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: createMockSocketService() },
      { provide: SocketLifecycleService, useValue: { ensureConnected: vi.fn() } },
      { provide: SessionService, useValue: createMockSessionService('session-key') },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(RepairRetrofitSystemDetailPage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, mockRouter };
}

// ---------------------------------------------------------------------------
// Tests: Overlay close button
// ---------------------------------------------------------------------------

describe('RepairRetrofitSystemDetailPage - overlay close button', () => {
  it('should render the overlay close button', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]')).toBeTruthy();
  });

  it('should close back to the ship exterior scene when the close button is clicked', () => {
    const { fixture, mockRouter } = setup();

    fixture.nativeElement.querySelector('[data-testid="overlay-close-button"]').click();

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { primary: ['ship-exterior-view'], right: null } }], {
      preserveFragment: true,
      replaceUrl: true,
    });
  });
});
