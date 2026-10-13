import { describe, expect, it } from 'vitest';
import { createIoVolcanicCues } from './planet-volcanism-layer';

describe('Io volcanic presentation cues', () => {
  it('places deterministic surface cues at the requested scale', () => {
    const cues = createIoVolcanicCues(2, 'overview');
    expect(cues).toHaveLength(4);
    for (const cue of cues) {
      expect(Math.hypot(...cue.position)).toBeCloseTo(2.006, 6);
      expect(cue.plumeHeight).toBeGreaterThan(0);
      expect(cue.hotspotRadius).toBeGreaterThan(0);
    }
    expect(createIoVolcanicCues(2, 'overview')).toEqual(cues);
  });

  it('uses more plume and hotspot geometry for focused detail', () => {
    const overview = createIoVolcanicCues(1, 'overview');
    const detail = createIoVolcanicCues(1, 'detail');
    expect(detail[0].sphereSegments).toBeGreaterThan(overview[0].sphereSegments);
    expect(detail[0].plumeSegments).toBeGreaterThan(overview[0].plumeSegments);
    expect(detail[0].plumeHeight).toBe(overview[0].plumeHeight);
  });

  it('rejects invalid world radii', () => {
    expect(() => createIoVolcanicCues(0, 'overview')).toThrow(/positive and finite/);
    expect(() => createIoVolcanicCues(Number.NaN, 'detail')).toThrow(/positive and finite/);
  });
});
