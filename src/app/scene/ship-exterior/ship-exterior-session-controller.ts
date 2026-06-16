import { signal, type Signal } from '@angular/core';

/**
 * Owns the transient lifecycle state for the ship-exterior scene: scan-loop
 * scheduling, debounced post-launch refreshes, and right-click target holds.
 */
export class ShipExteriorSessionController {
  private scanIntervalId: number | null = null;
  private targetHoldTimeoutId: number | null = null;
  private postLaunchRefreshTimeoutId: number | null = null;

  private readonly targetHoldCandidate = signal<string | null>(null);

  readonly targetHoldCandidateId: Signal<string | null> = this.targetHoldCandidate.asReadonly();

  startScanLoop(tickScene: () => void, intervalMs: number): void {
    this.clearScanLoop();
    this.scanIntervalId = window.setInterval(tickScene, intervalMs);
  }
  
  stopScanLoop(): void {
    this.clearScanLoop();
  }

  queuePostLaunchRefresh(refresh: () => void, debounceMs: number): void {
    if (this.postLaunchRefreshTimeoutId !== null) {
      clearTimeout(this.postLaunchRefreshTimeoutId);
    }

    this.postLaunchRefreshTimeoutId = window.setTimeout(() => {
      this.postLaunchRefreshTimeoutId = null;
      refresh();
    }, debounceMs);
  }

  beginTargetHold(asteroidId: string, onConfirm: () => void, holdMs: number): void {
    this.clearTargetHoldTimer();
    this.targetHoldCandidate.set(asteroidId);
    this.targetHoldTimeoutId = window.setTimeout(() => {
      if (this.targetHoldCandidate() === asteroidId) {
        onConfirm();
      }
      this.clearTargetHoldTimer();
    }, holdMs);
  }

  clearTargetHoldTimer(): void {
    if (this.targetHoldTimeoutId !== null) {
      clearTimeout(this.targetHoldTimeoutId);
      this.targetHoldTimeoutId = null;
    }
    this.targetHoldCandidate.set(null);
  }

  dispose(): void {
    this.clearTargetHoldTimer();
    this.clearScanLoop();
    if (this.postLaunchRefreshTimeoutId !== null) {
      clearTimeout(this.postLaunchRefreshTimeoutId);
      this.postLaunchRefreshTimeoutId = null;
    }
  }

  private clearScanLoop(): void {
    if (this.scanIntervalId !== null) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
  }
}