import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import {
  assignAsteroidRenderTiers,
  DEFAULT_ASTEROID_TIER_CAPS,
  DEFAULT_ASTEROID_TIER_DISTANCES,
  resolveAsteroidTierDetailOverride,
  type AsteroidTierContext,
} from './asteroid-tier-selection';

function makeSample(
  id: string,
  position: [number, number, number],
  scanned = true,
): AsteroidScanSample {
  return {
    id,
    serverCelestialBodyId: null,
    position,
    basePosition: position,
    scanProgress: scanned ? 100 : 0,
    scanned,
    revealedMaterial: null,
    revealedKinematics: null,
    capturedKinematics: {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 1000,
      estimatedDiameterM: 10,
    },
    solarSystemLocation: { positionKm: { x: 0, y: 0, z: 0 } },
    clusterCenterKm: { x: 0, y: 0, z: 0 },
    motionPhase: 0,
    motionRate: 0,
    motionRadius: 0,
    bobAmplitude: 0,
  };
}

function baseContext(overrides: Partial<AsteroidTierContext> = {}): AsteroidTierContext {
  return {
    cameraPosition: [0, 0, 0],
    targetedAsteroidId: null,
    activeScanAsteroidId: null,
    scannedOnlyHero: true,
    ...overrides,
  };
}

describe('assignAsteroidRenderTiers', () => {
  it('returns empty map for empty samples', () => {
    const tiers = assignAsteroidRenderTiers([], baseContext());
    expect(tiers.size).toBe(0);
  });

  it('forces targeted and active-scan asteroids to hero tier when scanned', () => {
    const samples = [
      makeSample('far-target', [0, 0, 100]),
      makeSample('far-scan', [0, 0, -100]),
      makeSample('close', [0, 0, 1]),
    ];

    const tiers = assignAsteroidRenderTiers(
      samples,
      baseContext({ targetedAsteroidId: 'far-target', activeScanAsteroidId: 'far-scan' }),
    );

    expect(tiers.get('far-target')).toBe('hero');
    expect(tiers.get('far-scan')).toBe('hero');
  });

  it('respects scannedOnlyHero constraint', () => {
    const samples = [makeSample('close-unscanned', [0, 0, 1], false)];
    const tiers = assignAsteroidRenderTiers(samples, baseContext({ scannedOnlyHero: true }));
    expect(tiers.get('close-unscanned')).not.toBe('hero');
  });

  it('respects hero cap and downgrades excess close asteroids to near tier', () => {
    const samples = [
      makeSample('a', [0, 0, 1]),
      makeSample('b', [0, 0, 2]),
      makeSample('c', [0, 0, 3]),
      makeSample('d', [0, 0, 4]),
      makeSample('e', [0, 0, 5]),
    ];

    const tiers = assignAsteroidRenderTiers(samples, baseContext(), {
      heroMax: 2,
      nearMax: 8,
    });

    const heroCount = Array.from(tiers.values()).filter((tier) => tier === 'hero').length;
    expect(heroCount).toBe(2);
  });

  it('assigns background tier beyond near distance threshold', () => {
    const samples = [makeSample('far', [0, 0, 100])];
    const tiers = assignAsteroidRenderTiers(samples, baseContext());
    expect(tiers.get('far')).toBe('background');
  });

  it('uses default caps and distances when not overridden', () => {
    const samples = Array.from({ length: 20 }, (_, i) => makeSample(`a${i}`, [0, 0, i + 1]));
    const tiers = assignAsteroidRenderTiers(samples, baseContext());

    const heroCount = Array.from(tiers.values()).filter((tier) => tier === 'hero').length;
    const nearCount = Array.from(tiers.values()).filter((tier) => tier === 'near').length;

    expect(heroCount).toBeLessThanOrEqual(DEFAULT_ASTEROID_TIER_CAPS.heroMax);
    expect(nearCount).toBeLessThanOrEqual(DEFAULT_ASTEROID_TIER_CAPS.nearMax);
    expect(DEFAULT_ASTEROID_TIER_DISTANCES.heroMaxDistance).toBeGreaterThan(0);
  });

  it('reduces near tier capacity when capMultiplier drops below 1', () => {
    const samples = Array.from({ length: 12 }, (_, i) => makeSample(`a${i}`, [0, 0, i + 1]));
    const fullTiers = assignAsteroidRenderTiers(samples, baseContext(), DEFAULT_ASTEROID_TIER_CAPS, DEFAULT_ASTEROID_TIER_DISTANCES, {
      capMultiplier: 1,
    });
    const reducedTiers = assignAsteroidRenderTiers(samples, baseContext(), DEFAULT_ASTEROID_TIER_CAPS, DEFAULT_ASTEROID_TIER_DISTANCES, {
      capMultiplier: 0.25,
    });

    const fullNearCount = Array.from(fullTiers.values()).filter((tier) => tier === 'near').length;
    const reducedNearCount = Array.from(reducedTiers.values()).filter((tier) => tier === 'near').length;

    expect(reducedNearCount).toBeLessThan(fullNearCount);
    expect(Array.from(reducedTiers.values()).filter((tier) => tier === 'hero').length).toBe(
      Array.from(fullTiers.values()).filter((tier) => tier === 'hero').length,
    );
  });
});

describe('resolveAsteroidTierDetailOverride', () => {
  it('returns null for unscanned regardless of tier', () => {
    expect(resolveAsteroidTierDetailOverride('hero', false)).toBeNull();
    expect(resolveAsteroidTierDetailOverride('near', false)).toBeNull();
    expect(resolveAsteroidTierDetailOverride('background', false)).toBeNull();
  });

  it('returns null for hero tier when scanned (no override)', () => {
    expect(resolveAsteroidTierDetailOverride('hero', true)).toBeNull();
  });

  it('returns 1 for near tier when scanned', () => {
    expect(resolveAsteroidTierDetailOverride('near', true)).toBe(1);
  });

  it('returns 1 for background tier when scanned', () => {
    expect(resolveAsteroidTierDetailOverride('background', true)).toBe(1);
  });
});
