export const FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS = 24;
export type AsteroidDetailCapMultiplier = 0.5 | 1;
export type FramePressureHealth = 'neutral' | 'green' | 'amber';

export function resolveAsteroidDetailCapMultiplier(averageFrameTimeMs: number | null): AsteroidDetailCapMultiplier {
  return averageFrameTimeMs !== null && averageFrameTimeMs > FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS ? 0.5 : 1;
}

export function resolveFramePressureHealth(
  status: 'paused' | 'sampling' | 'current',
  averageFrameTimeMs: number | null,
): FramePressureHealth {
  if (status !== 'current' || averageFrameTimeMs === null) {
    return 'neutral';
  }
  return resolveAsteroidDetailCapMultiplier(averageFrameTimeMs) === 1 ? 'green' : 'amber';
}

export class FramePressureSampler {
  private readonly windowSize: number;
  private readonly samples: number[] = [];
  private sum = 0;

  constructor(windowSize: number = 30) {
    this.windowSize = windowSize;
  }

  addSample(delta: number): void {
    this.samples.push(delta);
    this.sum += delta;
    if (this.samples.length > this.windowSize) {
      this.sum -= this.samples.shift()!;
    }
  }

  getAverage(): number {
    if (this.samples.length === 0) return 0;
    return this.sum / this.samples.length;
  }

  getSampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples.length = 0;
    this.sum = 0;
  }
}
