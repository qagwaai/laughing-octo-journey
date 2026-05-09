import { signal, type Signal } from '@angular/core';

/**
 * Toast feedback shown after a launch action (success or error).
 */
export interface LaunchFeedbackToast {
  message: string;
  tone: 'success' | 'error';
  seed: number | null;
}

/**
 * Controller for the ship-exterior launch feedback toast.
 *
 * Owns a single signal slot for the active toast and a self-clearing timer.
 * Plain class (no Angular DI) so it can be unit-tested without TestBed.
 */
export class LaunchToastController {
  private static readonly DEFAULT_TIMEOUT_MS = 3200;

  private readonly toast = signal<LaunchFeedbackToast | null>(null);
  private timeoutId: number | null = null;

  /** Read-only view of the active toast (or null when not visible). */
  readonly current: Signal<LaunchFeedbackToast | null> = this.toast.asReadonly();

  constructor(private readonly timeoutMs: number = LaunchToastController.DEFAULT_TIMEOUT_MS) {}

  /** Shows a toast, replacing any existing one and resetting the auto-dismiss timer. */
  set(message: string, tone: 'success' | 'error', seed: number | null): void {
    this.toast.set({ message, tone, seed });
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = window.setTimeout(() => {
      this.toast.set(null);
      this.timeoutId = null;
    }, this.timeoutMs);
  }

  /** Immediately clears the toast (does not affect the timer beyond clearing). */
  clear(): void {
    this.toast.set(null);
  }

  /** Cancels any pending auto-dismiss timer. Call from ngOnDestroy. */
  dispose(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
