// FramePressureSampler.ts
// Lightweight rolling average frame-pressure sampler for ShipExteriorViewScene (Phase 3)

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

  reset(): void {
    this.samples.length = 0;
    this.sum = 0;
  }
}
