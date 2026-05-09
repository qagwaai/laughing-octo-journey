import {
  ASTRONOMICAL_UNIT_KM,
  DEFAULT_SUN_CONFIG,
  cloneForTest,
  formatClusterText,
  formatDiameterText,
  formatLocationText,
  formatMassText,
  formatOffsetText,
  formatSpinText,
  formatVelocityText,
  getLaunchableLabel,
  normalizeDirection,
  resolveHotkeyNumber,
  resolveSunConfigForSolarSystem,
} from './ship-exterior-formatters';
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import type { CelestialBodyLocation } from '../../model/math/celestial-body-location';
import type { ShipItem } from '../../model/ship-item';

describe('ship-exterior-formatters', () => {
  const kinematics: AsteroidKinematics = {
    velocityKmPerSec: { x: 3, y: 4, z: 0 },
    angularVelocityRadPerSec: { x: 0.001, y: 0.002, z: 0.002 },
    estimatedMassKg: 5e9,
    estimatedDiameterM: 2500,
  };

  it('formatVelocityText returns placeholder when null', () => {
    expect(formatVelocityText(null)).toBe('VEL: ---');
  });

  it('formatVelocityText computes magnitude with one decimal', () => {
    expect(formatVelocityText(kinematics)).toBe('VEL: 5.0 km/s');
  });

  it('formatSpinText returns placeholder when null', () => {
    expect(formatSpinText(null)).toBe('SPIN: ---');
  });

  it('formatSpinText computes magnitude with four decimals', () => {
    expect(formatSpinText(kinematics)).toMatch(/^SPIN: 0\.\d{4} rad\/s$/);
  });

  it('formatMassText scales to e9 / e12 / kg', () => {
    expect(formatMassText(null)).toBe('MASS: ---');
    expect(formatMassText({ ...kinematics, estimatedMassKg: 5e9 })).toBe('MASS: 5.00e9 kg');
    expect(formatMassText({ ...kinematics, estimatedMassKg: 2.5e12 })).toBe('MASS: 2.50e12 kg');
    expect(formatMassText({ ...kinematics, estimatedMassKg: 500 })).toBe('MASS: 500 kg');
  });

  it('formatDiameterText switches to km above 1000m', () => {
    expect(formatDiameterText(null)).toBe('DIAM: ---');
    expect(formatDiameterText({ ...kinematics, estimatedDiameterM: 500 })).toBe('DIAM: 500 m');
    expect(formatDiameterText({ ...kinematics, estimatedDiameterM: 2500 })).toBe('DIAM: 2.50 km');
  });

  it('formatLocationText / formatClusterText / formatOffsetText format coords', () => {
    const location: CelestialBodyLocation = {
      solarSystemId: 'sol',
      positionKm: { x: 1_000_000, y: 2_000_000, z: 3_000_000 },
    } as CelestialBodyLocation;
    expect(formatLocationText(null)).toBe('LOC(Mkm): ---');
    expect(formatLocationText(location)).toBe('LOC(Mkm): X 1.000 | Y 2.000 | Z 3.000');
    expect(formatClusterText(null)).toBe('CLUSTER(Mkm): ---');
    expect(formatClusterText({ x: 1_000_000, y: 0, z: 0 })).toBe('CLUSTER(Mkm): X 1.000 | Y 0.000 | Z 0.000');
    expect(formatOffsetText(null, null)).toBe('OFFSET(km): ---');
    const offset = formatOffsetText(location, { x: 0, y: 0, z: 0 });
    expect(offset).toContain('OFFSET(km):');
    expect(offset).toContain('R 3741657');
  });

  it('resolveSunConfigForSolarSystem falls back to default for unknown ids', () => {
    expect(resolveSunConfigForSolarSystem('SOL')).toEqual(jasmine.objectContaining({ color: '#f5ff6b', radius: 1 }));
    expect(resolveSunConfigForSolarSystem('unknown-system')).toEqual(DEFAULT_SUN_CONFIG);
  });

  it('normalizeDirection returns unit vector or fallback when zero magnitude', () => {
    const n = normalizeDirection({ x: 3, y: 0, z: 4 }, { x: 1, y: 0, z: 0 });
    expect(n.x).toBeCloseTo(0.6, 5);
    expect(n.z).toBeCloseTo(0.8, 5);
    const fallbackUsed = normalizeDirection({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(fallbackUsed).toEqual({ x: 0, y: 1, z: 0 });
    const finalFallback = normalizeDirection({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(finalFallback).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('getLaunchableLabel truncates long names with ellipsis', () => {
    const item = (overrides: Partial<ShipItem>): ShipItem => ({
      id: 'i1',
      itemType: 'expendable-dart-drone',
      displayName: 'Short',
      quantity: 1,
      launchable: true,
      ...overrides,
    } as ShipItem);
    expect(getLaunchableLabel(item({ displayName: 'Short' }))).toBe('Short');
    expect(getLaunchableLabel(item({ displayName: 'A really long display name' }))).toBe('A really ...');
    expect(getLaunchableLabel(item({ displayName: '', itemType: 'something' }))).toBe('something');
    expect(getLaunchableLabel(item({ displayName: '', itemType: '' }))).toBe('Unknown');
  });

  it('resolveHotkeyNumber maps top-row digits and numpad', () => {
    expect(resolveHotkeyNumber(new KeyboardEvent('keydown', { key: '3', code: 'Digit3' }))).toBe(3);
    expect(resolveHotkeyNumber(new KeyboardEvent('keydown', { key: '5', code: 'Digit5' }))).toBe(5);
    expect(resolveHotkeyNumber(new KeyboardEvent('keydown', { key: '0', code: 'Digit0' }))).toBeNull();
    expect(resolveHotkeyNumber(new KeyboardEvent('keydown', { key: 'Numpad2', code: 'Numpad2' }))).toBe(2);
    expect(resolveHotkeyNumber(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }))).toBeNull();
  });

  it('cloneForTest returns a JSON-deep clone', () => {
    const source = { a: 1, nested: { b: [1, 2, 3] } };
    const clone = cloneForTest(source);
    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect(clone.nested).not.toBe(source.nested);
  });

  it('exports astronomical unit constant', () => {
    expect(ASTRONOMICAL_UNIT_KM).toBeCloseTo(149_597_870.7, 3);
  });
});
