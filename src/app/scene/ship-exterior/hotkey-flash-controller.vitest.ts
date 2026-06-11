import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotkeyFlashController } from './hotkey-flash-controller';

describe('HotkeyFlashController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with empty active set', () => {
    const controller = new HotkeyFlashController();
    expect(controller.active().size).toBe(0);
  });

  it('trigger() adds a hotkey then clears after the flash window', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(2);
    expect(controller.active().has(2)).toBe(true);
    vi.advanceTimersByTime(150);
    expect(controller.active().has(2)).toBe(false);
  });

  it('triggers are independent per hotkey', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(1);
    vi.advanceTimersByTime(50);
    controller.trigger(3);
    expect(controller.active().has(1)).toBe(true);
    expect(controller.active().has(3)).toBe(true);
    vi.advanceTimersByTime(60);
    expect(controller.active().has(1)).toBe(false);
    expect(controller.active().has(3)).toBe(true);
    vi.advanceTimersByTime(60);
    expect(controller.active().has(3)).toBe(false);
  });

  it('re-triggering same hotkey extends its window', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(4);
    vi.advanceTimersByTime(80);
    controller.trigger(4);
    vi.advanceTimersByTime(80);
    expect(controller.active().has(4)).toBe(true);
    vi.advanceTimersByTime(50);
    expect(controller.active().has(4)).toBe(false);
  });

  it('dispose() cancels every pending timer', () => {
    const controller = new HotkeyFlashController(100);
    controller.trigger(1);
    controller.trigger(2);
    controller.dispose();
    expect(controller.active().has(1)).toBe(true);
    vi.advanceTimersByTime(500);
    // dispose only cancels timers; the active set is preserved as last-seen.
    expect(controller.active().has(1)).toBe(true);
    expect(controller.active().has(2)).toBe(true);
  });
});
