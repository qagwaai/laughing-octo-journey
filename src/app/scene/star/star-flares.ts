/**
 * Schedules flare and prominence events for a star.
 *
 * Pure and seeded, so tests can step it frame by frame. Events arrive as a
 * Poisson process at the profile's rate, scaled by the activity control. Each
 * event brightens a patch of the photosphere and raises a prominence loop.
 * The renderer only reads `samples`.
 */
import { createSeededRng } from '../../model/planet/planet-seed';

export const STAR_MAX_ACTIVE_FLARES = 4;
/** Activity percent that keeps the class's seeded flare rate. */
export const STAR_DEFAULT_FLARE_ACTIVITY = 60;
const MIN_DURATION_SECONDS = 6;
const MAX_DURATION_SECONDS = 14;
/** The first event is pulled forward so a short visit still sees one. */
const FIRST_EVENT_MAX_DELAY_SECONDS = 5;
/** Fraction of an event spent rising; the rest is a slower decay. */
const RISE_FRACTION = 0.15;

export interface StarFlareSample {
  /** Unit direction in the star's local frame. */
  direction: readonly [number, number, number];
  /** 0..1 relative loop size. */
  size: number;
  /** 0..1 brightness envelope at the current time. */
  envelope: number;
}

interface ActiveFlare {
  direction: readonly [number, number, number];
  size: number;
  age: number;
  duration: number;
}

export function flareActivityScale(percent: number): number {
  return Math.max(0, Math.min(100, percent)) / STAR_DEFAULT_FLARE_ACTIVITY;
}

/** Fast rise, slow decay, zero at both ends. */
export function flareEnvelope(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < RISE_FRACTION) {
    const t = progress / RISE_FRACTION;
    return t * t * (3 - 2 * t);
  }
  const t = (progress - RISE_FRACTION) / (1 - RISE_FRACTION);
  return (1 - t) * (1 - t);
}

export class StarFlareScheduler {
  private readonly random: () => number;
  private readonly active: ActiveFlare[] = [];
  private activity = 1;
  private untilNext: number;
  private current: StarFlareSample[] = [];

  constructor(
    seed: number,
    private readonly flaresPerMinute: number,
  ) {
    this.random = createSeededRng(seed ^ 0x5f1a7e);
    this.untilNext = Math.min(this.drawInterval(), this.random() * FIRST_EVENT_MAX_DELAY_SECONDS);
  }

  get samples(): readonly StarFlareSample[] {
    return this.current;
  }

  /** 0-100; 60 keeps the seeded rate and 0 stops new events. */
  setActivity(percent: number): void {
    const previous = this.activity;
    this.activity = flareActivityScale(percent);
    if (previous <= 0 && this.activity > 0) this.untilNext = this.drawInterval();
  }

  advance(delta: number): readonly StarFlareSample[] {
    const step = Math.min(Math.max(delta, 0), 0.25);
    for (const flare of this.active) flare.age += step;
    for (let index = this.active.length - 1; index >= 0; index--) {
      if (this.active[index].age >= this.active[index].duration) this.active.splice(index, 1);
    }

    if (this.ratePerSecond() > 0) {
      this.untilNext -= step;
      if (this.untilNext <= 0) {
        if (this.active.length < STAR_MAX_ACTIVE_FLARES) this.active.push(this.spawn());
        this.untilNext = this.drawInterval();
      }
    }

    this.current = this.active.map((flare) => ({
      direction: flare.direction,
      size: flare.size,
      envelope: flareEnvelope(flare.age / flare.duration),
    }));
    return this.current;
  }

  private ratePerSecond(): number {
    return (this.flaresPerMinute * this.activity) / 60;
  }

  private drawInterval(): number {
    const rate = this.ratePerSecond();
    if (rate <= 0) return Number.POSITIVE_INFINITY;
    return -Math.log(1 - this.random() * 0.999) / rate;
  }

  private spawn(): ActiveFlare {
    const latitude = (this.random() * 2 - 1) * 0.75;
    const longitude = this.random() * Math.PI * 2;
    const cosLat = Math.cos(latitude);
    return {
      direction: [cosLat * Math.cos(longitude), Math.sin(latitude), cosLat * Math.sin(longitude)],
      size: 0.35 + this.random() * 0.65,
      age: 0,
      duration: MIN_DURATION_SECONDS + this.random() * (MAX_DURATION_SECONDS - MIN_DURATION_SECONDS),
    };
  }
}
