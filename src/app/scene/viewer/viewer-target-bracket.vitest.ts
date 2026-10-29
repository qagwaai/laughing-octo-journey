import { describe, expect, it } from 'vitest';
import { createViewerTargetBracketGeometry } from './viewer-target-bracket';

describe('createViewerTargetBracketGeometry', () => {
  it('creates one indexed mesh geometry for eight red corner segments', () => {
    const geometry = createViewerTargetBracketGeometry();
    geometry.computeBoundingBox();

    expect(geometry.getAttribute('position').count).toBe(8 * 24);
    expect(geometry.getIndex()?.count).toBe(8 * 36);
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-1.3225);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-1.3225);
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-0.0225);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(1.3225);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(1.3225);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(0.0225);
    geometry.dispose();
  });
});
