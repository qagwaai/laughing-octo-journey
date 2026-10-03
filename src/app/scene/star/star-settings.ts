import { Injectable, signal } from '@angular/core';
import { SPLASH_STAR_CLASSES } from '../planet/splash-planet-rotation';
import { STAR_DEFAULT_FLARE_ACTIVITY } from './star-flares';

export type StarSpectralClassChoice = (typeof SPLASH_STAR_CLASSES)[number] | 'seeded';

/** Dev-facing star controls shared by the splash and the stellar viewer. */
@Injectable({ providedIn: 'root' })
export class StarSettings {
  /** 0-100; 60 keeps each class's seeded flare rate. */
  readonly flareActivity = signal(STAR_DEFAULT_FLARE_ACTIVITY);
  /** Splash only: swaps the splash star's class while keeping its per-body seed. */
  readonly spectralClass = signal<StarSpectralClassChoice>('seeded');
}

export function isStarSpectralClassChoice(value: string): value is StarSpectralClassChoice {
  return value === 'seeded' || (SPLASH_STAR_CLASSES as readonly string[]).includes(value);
}

export function resolveStarSpectralClassChoice(
  choice: StarSpectralClassChoice,
  seeded: string | null,
): string | null {
  return choice === 'seeded' ? seeded : choice;
}
