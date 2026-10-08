import { describe, expect, it } from 'vitest';
import { selectRenderQuality } from './render-quality';
import { selectMiningQuality } from './mining-splash-state';

describe('shared render quality policy', () => {
  it.each([
    { width: 1440, cores: 8, saveData: false, expected: 'standard' },
    { width: 767, cores: 8, saveData: false, expected: 'low' },
    { width: 768, cores: 8, saveData: false, expected: 'standard' },
    { width: 1440, cores: 4, saveData: false, expected: 'low' },
    { width: 1440, cores: 5, saveData: false, expected: 'standard' },
    { width: 1440, cores: 8, saveData: true, expected: 'low' },
  ])('selects $expected for width=$width cores=$cores saveData=$saveData', ({ width, cores, saveData, expected }) => {
    expect(selectRenderQuality(width, cores, saveData)).toBe(expected);
    expect(selectMiningQuality(width, cores, saveData)).toBe(expected);
  });

  it('preserves the splash selector as the same pure function', () => {
    expect(selectMiningQuality).toBe(selectRenderQuality);
  });
});
