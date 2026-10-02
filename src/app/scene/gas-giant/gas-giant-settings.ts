import { Injectable, signal } from '@angular/core';
import type { GasGiantPalette, GasGiantProfileOverrides } from '../../model/planet/gas-giant-profile';
import { type GasGiantClassificationMode, parseGasGiantClassificationMode } from './gas-giant-classifier';

export type GasGiantPaletteChoice = GasGiantPalette | 'seeded';
export type GasGiantRingChoice = 'seeded' | 'on' | 'off';

/** Dev-facing look overrides shared by the splash and the planet view. */
@Injectable({ providedIn: 'root' })
export class GasGiantSettings {
  /** Seeded from `?gasGiants=all|none` so any fixture can be previewed as a giant. */
  readonly classification = signal<GasGiantClassificationMode>(
    parseGasGiantClassificationMode(typeof window === 'undefined' ? '' : window.location.search),
  );
  readonly palette = signal<GasGiantPaletteChoice>('seeded');
  readonly rings = signal<GasGiantRingChoice>('seeded');
}

export function toProfileOverrides(
  palette: GasGiantPaletteChoice,
  rings: GasGiantRingChoice,
): GasGiantProfileOverrides {
  return {
    ...(palette === 'seeded' ? {} : { palette }),
    ...(rings === 'seeded' ? {} : { rings: rings === 'on' }),
  };
}
