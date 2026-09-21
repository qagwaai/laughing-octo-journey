import { describe, expect, it } from 'vitest';
import {
  FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS,
  FramePressureSampler,
  resolveAsteroidDetailCapMultiplier,
  resolveFramePressureHealth,
} from './frame-pressure-sampler';

describe('FramePressureSampler', () => {
  it('returns zero average before any samples are added', () => {
    const sampler = new FramePressureSampler(3);

    expect(sampler.getAverage()).toBe(0);
  });

  it('computes a rolling average across samples', () => {
    const sampler = new FramePressureSampler(3);

    sampler.addSample(10);
    sampler.addSample(20);
    sampler.addSample(30);

    expect(sampler.getAverage()).toBe(20);
  });

  it('drops the oldest sample once the window is exceeded', () => {
    const sampler = new FramePressureSampler(2);

    sampler.addSample(10);
    sampler.addSample(20);
    sampler.addSample(40);

    expect(sampler.getAverage()).toBe(30);
  });

  it('can be reset', () => {
    const sampler = new FramePressureSampler(2);

    sampler.addSample(10);
    sampler.addSample(20);
    sampler.reset();

    expect(sampler.getAverage()).toBe(0);
    expect(sampler.getSampleCount()).toBe(0);
  });

  it('reports the number of fresh rolling samples', () => {
    const sampler = new FramePressureSampler(2);

    sampler.addSample(10);
    sampler.addSample(20);
    sampler.addSample(40);

    expect(sampler.getSampleCount()).toBe(2);
  });

  it('reduces detail only above the shared 24 ms policy threshold', () => {
    expect(resolveAsteroidDetailCapMultiplier(null)).toBe(1);
    expect(resolveAsteroidDetailCapMultiplier(FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS)).toBe(1);
    expect(resolveAsteroidDetailCapMultiplier(FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS + 0.01)).toBe(0.5);
  });

  it('uses the shared threshold for health and stays neutral without current samples', () => {
    expect(resolveFramePressureHealth('paused', 12)).toBe('neutral');
    expect(resolveFramePressureHealth('sampling', null)).toBe('neutral');
    expect(resolveFramePressureHealth('current', FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS)).toBe('green');
    expect(resolveFramePressureHealth('current', FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS + 0.01)).toBe('amber');
  });
});
