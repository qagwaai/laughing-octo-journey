import { describe, expect, it, vi } from 'vitest';
import { ShipDamageController } from './ship-damage-controller';
import { resolveShipDamageProfileFromPreset } from '../../model/ship-damage';
import type { ShipDamageProfile } from '../../model/ship-damage';
import type { ShipSummary } from '../../model/ship-list';

describe('ShipDamageController', () => {
  const validProfile: ShipDamageProfile = resolveShipDamageProfileFromPreset(
    'cold-boot-starter-damaged',
  ) as ShipDamageProfile;

  it('starts with null when no ship and no preset', () => {
    const controller = new ShipDamageController(undefined);
    expect(controller.current()).toBeNull();
  });

  it('initializes from a ship summary with explicit damage profile', () => {
    const ship = { damageProfile: validProfile } as unknown as ShipSummary;
    const controller = new ShipDamageController(undefined, ship);
    expect(controller.current()?.summary).toBe(validProfile.summary);
  });

  it('falls back to mission preset when ship has no damage profile', () => {
    const ship = {} as unknown as ShipSummary;
    const controller = new ShipDamageController('cold-boot-starter-damaged', ship);
    expect(controller.current()?.summary).toBe(validProfile.summary);
  });

  it('resolveFromShipSummary updates the active profile', () => {
    const controller = new ShipDamageController(undefined);
    expect(controller.current()).toBeNull();

    controller.resolveFromShipSummary({ damageProfile: validProfile } as unknown as ShipSummary);
    expect(controller.current()?.summary).toBe(validProfile.summary);

    controller.resolveFromShipSummary(undefined);
    expect(controller.current()).toBeNull();
  });
});
