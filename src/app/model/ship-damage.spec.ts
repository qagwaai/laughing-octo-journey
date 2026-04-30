import {
  SHIP_DAMAGE_SEVERITIES,
  SHIP_DAMAGE_OVERALL_STATUSES,
  coerceShipDamageProfile,
  createColdBootStarterShipDamageProfile,
  resolveShipDamageProfileFromPreset,
} from './ship-damage';

describe('ship-damage coercion', () => {
  describe('coerceShipDamageProfile', () => {
    it('returns null for null input', () => {
      expect(coerceShipDamageProfile(null)).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(coerceShipDamageProfile('string')).toBeNull();
      expect(coerceShipDamageProfile(42)).toBeNull();
      expect(coerceShipDamageProfile([])).toBeNull();
    });

    it('returns null when overallStatus is missing', () => {
      expect(coerceShipDamageProfile({ summary: 'ok', systems: [] })).toBeNull();
    });

    it('returns null when overallStatus is invalid', () => {
      expect(coerceShipDamageProfile({ overallStatus: 'exploded', summary: 'ok', systems: [] })).toBeNull();
    });

    it('returns null when summary is missing', () => {
      expect(coerceShipDamageProfile({ overallStatus: 'damaged', systems: [] })).toBeNull();
    });

    it('returns null when summary is empty string', () => {
      expect(coerceShipDamageProfile({ overallStatus: 'damaged', summary: '   ', systems: [] })).toBeNull();
    });

    it('coerces a valid profile with all fields', () => {
      const result = coerceShipDamageProfile({
        overallStatus: 'damaged',
        summary: 'Hull breach',
        origin: 'combat',
        updatedAt: '2026-01-01T00:00:00.000Z',
        systems: [
          {
            code: 'hull',
            label: 'Hull',
            severity: 'critical',
            summary: 'Breach detected',
            repairPriority: 1,
          },
        ],
      });

      expect(result).not.toBeNull();
      expect(result!.overallStatus).toBe('damaged');
      expect(result!.summary).toBe('Hull breach');
      expect(result!.origin).toBe('combat');
      expect(result!.systems.length).toBe(1);
      expect(result!.systems[0].code).toBe('hull');
      expect(result!.systems[0].severity).toBe('critical');
    });

    it('defaults origin to "unknown" for unrecognised value', () => {
      const result = coerceShipDamageProfile({
        overallStatus: 'intact',
        summary: 'All clear',
        origin: 'alien',
        systems: [],
      });
      expect(result!.origin).toBe('unknown');
    });

    it('accepts all valid overallStatus values', () => {
      for (const status of SHIP_DAMAGE_OVERALL_STATUSES) {
        const result = coerceShipDamageProfile({ overallStatus: status, summary: 'test', systems: [] });
        expect(result!.overallStatus).toBe(status);
      }
    });

    it('normalises overallStatus to lowercase', () => {
      const result = coerceShipDamageProfile({ overallStatus: 'DAMAGED', summary: 'test', systems: [] });
      expect(result!.overallStatus).toBe('damaged');
    });

    it('filters out invalid system entries', () => {
      const result = coerceShipDamageProfile({
        overallStatus: 'damaged',
        summary: 'Multiple issues',
        systems: [
          { code: 'hull', label: 'Hull', severity: 'critical', summary: 'Breach', repairPriority: 1 },
          { code: '', label: 'Bad', severity: 'minor', summary: 'Invalid — missing code', repairPriority: 2 },
          null,
          42,
        ],
      });
      expect(result!.systems.length).toBe(1);
    });

    it('defaults systems to empty array when not an array', () => {
      const result = coerceShipDamageProfile({ overallStatus: 'intact', summary: 'ok', systems: null });
      expect(result!.systems).toEqual([]);
    });

    it('uses provided updatedAt when valid', () => {
      const ts = '2025-06-15T12:00:00.000Z';
      const result = coerceShipDamageProfile({ overallStatus: 'intact', summary: 'ok', systems: [], updatedAt: ts });
      expect(result!.updatedAt).toBe(ts);
    });

    it('generates updatedAt when not provided', () => {
      const result = coerceShipDamageProfile({ overallStatus: 'intact', summary: 'ok', systems: [] });
      expect(result!.updatedAt).toBeTruthy();
      expect(typeof result!.updatedAt).toBe('string');
    });

    it('uses repairPriority 0 when not an integer', () => {
      const result = coerceShipDamageProfile({
        overallStatus: 'damaged',
        summary: 'test',
        systems: [{ code: 'x', label: 'X', severity: 'minor', summary: 'ok', repairPriority: 1.5 }],
      });
      expect(result!.systems[0].repairPriority).toBe(0);
    });

    it('accepts all valid severity values', () => {
      for (const severity of SHIP_DAMAGE_SEVERITIES) {
        const result = coerceShipDamageProfile({
          overallStatus: 'damaged',
          summary: 'test',
          systems: [{ code: 's', label: 'S', severity, summary: 'ok', repairPriority: 1 }],
        });
        expect(result!.systems[0].severity).toBe(severity);
      }
    });

    it('returns null for system with invalid severity', () => {
      const result = coerceShipDamageProfile({
        overallStatus: 'damaged',
        summary: 'test',
        systems: [{ code: 's', label: 'S', severity: 'catastrophic', summary: 'ok', repairPriority: 1 }],
      });
      expect(result!.systems.length).toBe(0);
    });
  });

  describe('createColdBootStarterShipDamageProfile', () => {
    it('returns a profile with overallStatus damaged', () => {
      const profile = createColdBootStarterShipDamageProfile();
      expect(profile.overallStatus).toBe('damaged');
      expect(profile.origin).toBe('cold-boot-scripted');
    });

    it('returns exactly 3 systems', () => {
      const profile = createColdBootStarterShipDamageProfile();
      expect(profile.systems.length).toBe(3);
    });

    it('uses provided nowIso for updatedAt', () => {
      const ts = '2026-04-30T00:00:00.000Z';
      const profile = createColdBootStarterShipDamageProfile(ts);
      expect(profile.updatedAt).toBe(ts);
    });

    it('sets propulsion-manifold as critical with repairPriority 1', () => {
      const profile = createColdBootStarterShipDamageProfile();
      const propulsion = profile.systems.find((s) => s.code === 'propulsion-manifold');
      expect(propulsion).toBeDefined();
      expect(propulsion!.severity).toBe('critical');
      expect(propulsion!.repairPriority).toBe(1);
    });
  });

  describe('resolveShipDamageProfileFromPreset', () => {
    it('returns a damage profile for cold-boot-starter-damaged', () => {
      const result = resolveShipDamageProfileFromPreset('cold-boot-starter-damaged');
      expect(result).not.toBeNull();
      expect(result!.overallStatus).toBe('damaged');
    });

    it('returns null for undefined preset', () => {
      expect(resolveShipDamageProfileFromPreset(undefined)).toBeNull();
    });
  });
});
