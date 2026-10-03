import { describe, expect, it } from 'vitest';
import {
  flareActivityScale,
  flareEnvelope,
  STAR_DEFAULT_FLARE_ACTIVITY,
  STAR_MAX_ACTIVE_FLARES,
  StarFlareScheduler,
} from './star-flares';

function run(scheduler: StarFlareScheduler, seconds: number, step = 0.05): number {
  let peak = 0;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    peak = Math.max(peak, scheduler.advance(step).length);
  }
  return peak;
}

describe('flareEnvelope', () => {
  it('rises quickly, decays slowly and is zero at both ends', () => {
    expect(flareEnvelope(0)).toBe(0);
    expect(flareEnvelope(1)).toBe(0);
    expect(flareEnvelope(0.15)).toBeCloseTo(1, 5);
    expect(flareEnvelope(0.1)).toBeGreaterThan(flareEnvelope(0.9));
  });
});

describe('flareActivityScale', () => {
  it('keeps the class rate at the default and clamps the range', () => {
    expect(flareActivityScale(STAR_DEFAULT_FLARE_ACTIVITY)).toBe(1);
    expect(flareActivityScale(-10)).toBe(0);
    expect(flareActivityScale(500)).toBeCloseTo(100 / STAR_DEFAULT_FLARE_ACTIVITY);
  });
});

describe('StarFlareScheduler', () => {
  it('is deterministic for a seed', () => {
    const a = new StarFlareScheduler(42, 6);
    const b = new StarFlareScheduler(42, 6);
    run(a, 20);
    run(b, 20);
    expect(a.samples).toEqual(b.samples);
  });

  it('produces events at an active rate and caps concurrent events', () => {
    const scheduler = new StarFlareScheduler(7, 30);
    scheduler.setActivity(100);
    const peak = run(scheduler, 60);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(STAR_MAX_ACTIVE_FLARES);
  });

  it('stops new events at zero activity', () => {
    const scheduler = new StarFlareScheduler(7, 30);
    scheduler.setActivity(0);
    expect(run(scheduler, 60)).toBe(0);
  });

  it('keeps sample directions on the unit sphere and envelopes in range', () => {
    const scheduler = new StarFlareScheduler(3, 30);
    for (let index = 0; index < 400; index++) {
      for (const sample of scheduler.advance(0.05)) {
        expect(Math.hypot(...sample.direction)).toBeCloseTo(1, 5);
        expect(sample.envelope).toBeGreaterThanOrEqual(0);
        expect(sample.envelope).toBeLessThanOrEqual(1);
      }
    }
  });
});
