import {
  clampSensorArrayTier,
  resolveSensorArrayCapabilities,
  resolveTractorBeamCapabilities,
  SENSOR_ARRAY_MAX_TIER,
  SENSOR_ARRAY_MIN_TIER,
} from './item-tier-capabilities';

describe('item-tier-capabilities model', () => {
  describe('clampSensorArrayTier', () => {
    it('clamps values below min to tier 1', () => {
      expect(clampSensorArrayTier(0)).toBe(SENSOR_ARRAY_MIN_TIER);
      expect(clampSensorArrayTier(-5)).toBe(SENSOR_ARRAY_MIN_TIER);
    });

    it('clamps values above max to tier 20', () => {
      expect(clampSensorArrayTier(21)).toBe(SENSOR_ARRAY_MAX_TIER);
      expect(clampSensorArrayTier(999)).toBe(SENSOR_ARRAY_MAX_TIER);
    });

    it('normalizes non-finite values to tier 1', () => {
      expect(clampSensorArrayTier(Number.NaN)).toBe(SENSOR_ARRAY_MIN_TIER);
      expect(clampSensorArrayTier(Number.POSITIVE_INFINITY)).toBe(SENSOR_ARRAY_MIN_TIER);
    });
  });

  describe('resolveSensorArrayCapabilities', () => {
    it('keeps tier 1 scan duration aligned with current baseline', () => {
      const capabilities = resolveSensorArrayCapabilities(1);

      expect(capabilities.tier).toBe(1);
      expect(capabilities.scanDurationMs).toBe(10_000);
      expect(capabilities.scanTickMs).toBe(100);
      expect(capabilities.scanDetailBand).toBe('basic');
    });

    it('resolves cap-tier values for tier 20', () => {
      const capabilities = resolveSensorArrayCapabilities(20);

      expect(capabilities.tier).toBe(20);
      expect(capabilities.scanDurationMs).toBe(2_400);
      expect(capabilities.scanTickMs).toBe(100);
      expect(capabilities.scanDetailBand).toBe('apex');
    });

    it('clamps out-of-range requests before resolving capabilities', () => {
      expect(resolveSensorArrayCapabilities(-2).tier).toBe(1);
      expect(resolveSensorArrayCapabilities(99).tier).toBe(20);
    });

    it('reduces scan duration as tier increases', () => {
      const tier5 = resolveSensorArrayCapabilities(5);
      const tier10 = resolveSensorArrayCapabilities(10);
      const tier15 = resolveSensorArrayCapabilities(15);

      expect(tier10.scanDurationMs).toBeLessThan(tier5.scanDurationMs);
      expect(tier15.scanDurationMs).toBeLessThan(tier10.scanDurationMs);
    });
  });

  describe('resolveTractorBeamCapabilities', () => {
    it('keeps tier 1 tractor beam at the planned baseline', () => {
      const capabilities = resolveTractorBeamCapabilities(1);

      expect(capabilities.tier).toBe(1);
      expect(capabilities.maxRangeKm).toBe(10);
      expect(capabilities.pullDurationMs).toBe(10_000);
    });

    it('resolves cap-tier tractor beam values for tier 20', () => {
      const capabilities = resolveTractorBeamCapabilities(20);

      expect(capabilities.tier).toBe(20);
      expect(capabilities.maxRangeKm).toBe(25);
      expect(capabilities.pullDurationMs).toBe(1_200);
    });

    it('clamps out-of-range tractor beam requests before resolving capabilities', () => {
      expect(resolveTractorBeamCapabilities(-2).tier).toBe(1);
      expect(resolveTractorBeamCapabilities(99).tier).toBe(20);
    });

    it('increases range and reduces pull duration as tier increases', () => {
      const tier5 = resolveTractorBeamCapabilities(5);
      const tier10 = resolveTractorBeamCapabilities(10);
      const tier15 = resolveTractorBeamCapabilities(15);

      expect(tier10.maxRangeKm).toBeGreaterThan(tier5.maxRangeKm);
      expect(tier15.maxRangeKm).toBeGreaterThan(tier10.maxRangeKm);
      expect(tier10.pullDurationMs).toBeLessThan(tier5.pullDurationMs);
      expect(tier15.pullDurationMs).toBeLessThan(tier10.pullDurationMs);
    });
  });
});