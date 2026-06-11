import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchToastController } from './launch-toast-controller';

describe('LaunchToastController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with null toast', () => {
    const controller = new LaunchToastController();
    expect(controller.current()).toBeNull();
  });

  it('set() shows the toast and auto-dismisses after the timeout', () => {
    const controller = new LaunchToastController(1000);
    controller.set('Hello', 'success', 42);
    expect(controller.current()).toEqual({ message: 'Hello', tone: 'success', seed: 42 });
    vi.advanceTimersByTime(999);
    expect(controller.current()).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(controller.current()).toBeNull();
  });

  it('repeated set() resets the auto-dismiss timer', () => {
    const controller = new LaunchToastController(1000);
    controller.set('first', 'success', null);
    vi.advanceTimersByTime(900);
    controller.set('second', 'error', null);
    vi.advanceTimersByTime(900);
    expect(controller.current()?.message).toBe('second');
    vi.advanceTimersByTime(200);
    expect(controller.current()).toBeNull();
  });

  it('clear() clears immediately', () => {
    const controller = new LaunchToastController(1000);
    controller.set('x', 'success', null);
    controller.clear();
    expect(controller.current()).toBeNull();
  });

  it('dispose() cancels the auto-dismiss timer', () => {
    const controller = new LaunchToastController(1000);
    controller.set('x', 'success', null);
    controller.dispose();
    vi.advanceTimersByTime(2000);
    // dispose() does not clear the toast itself, only the timer
    expect(controller.current()?.message).toBe('x');
  });
});
