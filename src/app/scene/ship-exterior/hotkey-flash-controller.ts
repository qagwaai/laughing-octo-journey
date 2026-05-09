import { signal, type Signal } from '@angular/core';

/** Hotkey slot identifier for launch hotkey flash UI. */
export type HotkeySlot = 1 | 2 | 3 | 4 | 5;

/**
 * Tracks the transient "flashing" state of launch hotkeys so the HUD can
 * indicate a successful keypress for a short visual window. Each hotkey has
 * an independent timer; re-triggering a hotkey resets its own timer.
 */
export class HotkeyFlashController {
  private static readonly DEFAULT_FLASH_MS = 220;

  private readonly launching = signal<ReadonlySet<HotkeySlot>>(new Set());
  private readonly timeouts = new Map<HotkeySlot, number>();

  /** Read-only set of hotkeys currently flashing. */
  readonly active: Signal<ReadonlySet<HotkeySlot>> = this.launching.asReadonly();

  constructor(private readonly flashMs: number = HotkeyFlashController.DEFAULT_FLASH_MS) {}

  /** Begins a flash window for the given hotkey, resetting any prior window. */
  trigger(hotkey: HotkeySlot): void {
    this.launching.update((current) => {
      const next = new Set(current);
      next.add(hotkey);
      return next;
    });

    const existing = this.timeouts.get(hotkey);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timeoutId = window.setTimeout(() => {
      this.launching.update((current) => {
        const next = new Set(current);
        next.delete(hotkey);
        return next;
      });
      this.timeouts.delete(hotkey);
    }, this.flashMs);

    this.timeouts.set(hotkey, timeoutId);
  }

  /** Cancels every pending flash timer. Call from ngOnDestroy. */
  dispose(): void {
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts.clear();
  }
}
