import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MissingItemToastService } from './missing-item-toast.service';

describe('MissingItemToastService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('shows a missing-item snackbar with expected copy and styling', () => {
    const snackBar = {
      open: vi.fn(),
    } as unknown as MatSnackBar;

    TestBed.configureTestingModule({
      providers: [MissingItemToastService, { provide: MatSnackBar, useValue: snackBar }],
    });
    const service = TestBed.inject(MissingItemToastService);

    service.showMissingItem('exotic-core');

    expect((snackBar.open as any).mock.calls[0]).toEqual([
      "Item 'exotic-core' is missing from the backend catalog. Please report this to the dev team.",
      'Dismiss',
      { duration: 8000, panelClass: 'snackbar-error' },
    ]);
  });
});
