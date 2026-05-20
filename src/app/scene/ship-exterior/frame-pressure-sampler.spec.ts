import { FramePressureSampler } from './frame-pressure-sampler';

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
  });
});