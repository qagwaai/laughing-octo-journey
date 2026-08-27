import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShipExteriorSessionController } from './ship-exterior-session-controller';

describe('ShipExteriorSessionController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks a target hold candidate and resolves it when the timer expires', () => {
    vi.useFakeTimers();
    const controller = new ShipExteriorSessionController();
    const onConfirm = vi.fn();

    controller.beginTargetHold('asteroid-a', onConfirm, 500);

    expect(controller.targetHoldCandidateId()).toBe('asteroid-a');

    vi.advanceTimersByTime(500);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(controller.targetHoldCandidateId()).toBeNull();
  });

  it('clears a target hold candidate when cancelled before the timeout completes', () => {
    vi.useFakeTimers();
    const controller = new ShipExteriorSessionController();
    const onConfirm = vi.fn();

    controller.beginTargetHold('asteroid-b', onConfirm, 600);
    controller.clearTargetHoldTimer();

    expect(controller.targetHoldCandidateId()).toBeNull();

    vi.advanceTimersByTime(600);

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
