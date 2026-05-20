import {
  describeSummaryForSystems,
  mapOverallStatusToShipStatus,
  resolveOverallStatusFromSystems,
} from './repair-retrofit-state';
import { ShipSubsystemDamage } from '../../model/ship-damage';

describe('repair-retrofit-state helpers', () => {
  describe('mapOverallStatusToShipStatus', () => {
    it('maps intact to Operational', () => {
      expect(mapOverallStatusToShipStatus('intact')).toBe('Operational');
    });

    it('maps disabled and destroyed to Disabled', () => {
      expect(mapOverallStatusToShipStatus('disabled')).toBe('Disabled');
      expect(mapOverallStatusToShipStatus('destroyed')).toBe('Disabled');
    });

    it('maps damaged status to Damaged', () => {
      expect(mapOverallStatusToShipStatus('damaged')).toBe('Damaged');
    });
  });

  describe('resolveOverallStatusFromSystems', () => {
    it('returns intact when there are no damaged systems', () => {
      expect(resolveOverallStatusFromSystems([])).toBe('intact');
    });

    it('returns disabled when any subsystem is critical', () => {
      const systems: ShipSubsystemDamage[] = [
        { code: 'eng', severity: 'minor', label: 'Eng', summary: 'minor', repairPriority: 0 },
        { code: 'life-support', severity: 'critical', label: 'LS', summary: 'critical', repairPriority: 0 },
      ];
      expect(resolveOverallStatusFromSystems(systems)).toBe('disabled');
    });

    it('returns damaged when systems exist and none are critical', () => {
      const systems: ShipSubsystemDamage[] = [
        { code: 'comms', severity: 'major', label: 'Comms', summary: 'major', repairPriority: 0 },
        { code: 'sensor', severity: 'minor', label: 'Sensor', summary: 'minor', repairPriority: 0 },
      ];
      expect(resolveOverallStatusFromSystems(systems)).toBe('damaged');
    });
  });

  describe('describeSummaryForSystems', () => {
    it('returns nominal summary when no systems remain', () => {
      expect(describeSummaryForSystems([])).toContain('stabilized and nominal');
    });

    it('describes critical subsystem count with singular/plural wording', () => {
      const oneCritical: ShipSubsystemDamage[] = [
        { code: 'eng', severity: 'critical', label: 'Eng', summary: 'crit', repairPriority: 0 }
      ];
      const twoCritical: ShipSubsystemDamage[] = [
        { code: 'eng', severity: 'critical', label: 'Eng', summary: 'crit', repairPriority: 0 },
        { code: 'life-support', severity: 'critical', label: 'LS', summary: 'crit', repairPriority: 0 },
      ];

      expect(describeSummaryForSystems(oneCritical)).toBe('Critical damage remains in 1 subsystem.');
      expect(describeSummaryForSystems(twoCritical)).toBe('Critical damage remains in 2 subsystems.');
    });

    it('describes major subsystem count when no critical systems remain', () => {
      const oneMajor: ShipSubsystemDamage[] = [
        { code: 'sensor', severity: 'major', label: 'Sen', summary: 'maj', repairPriority: 0 }
      ];
      const twoMajor: ShipSubsystemDamage[] = [
        { code: 'sensor', severity: 'major', label: 'Sen', summary: 'maj', repairPriority: 0 },
        { code: 'power', severity: 'major', label: 'Pow', summary: 'maj', repairPriority: 0 },
      ];

      expect(describeSummaryForSystems(oneMajor)).toBe('Major damage remains in 1 subsystem.');
      expect(describeSummaryForSystems(twoMajor)).toBe('Major damage remains in 2 subsystems.');
    });

    it('falls back to minor-damage summary when neither critical nor major remain', () => {
      const systems: ShipSubsystemDamage[] = [
        { code: 'sensor', severity: 'minor', label: 'Sen', summary: 'min', repairPriority: 0 },
        { code: 'cooling', severity: 'minor', label: 'Coo', summary: 'min', repairPriority: 0 },
      ];

      expect(describeSummaryForSystems(systems)).toContain('Minor damage remains');
    });
  });
});
