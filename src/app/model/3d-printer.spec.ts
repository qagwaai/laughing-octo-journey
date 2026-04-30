import {
  THREE_D_PRINTER_ITEM_TYPE,
  THREE_D_PRINTER_TIER,
  isThreeDPrinter,
  create3DPrinter,
  coerce3DPrinter,
} from './3d-printer';
import type { ShipItem } from './ship-item';

function makeShipItem(overrides: Partial<ShipItem> = {}): ShipItem {
  return {
    id: 'item-1',
    itemType: 'some-item',
    displayName: 'Some Item',
    tier: 1,
    launchable: false,
    state: 'contained',
    damageStatus: 'intact',
    container: null,
    owningPlayerId: null,
    owningCharacterId: null,
    kinematics: null,
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ShipItem;
}

describe('3d-printer model', () => {
  describe('isThreeDPrinter', () => {
    it('returns true for a valid 3D printer item', () => {
      const item = makeShipItem({ itemType: THREE_D_PRINTER_ITEM_TYPE, tier: THREE_D_PRINTER_TIER });
      expect(isThreeDPrinter(item)).toBeTrue();
    });

    it('returns false when itemType does not match', () => {
      const item = makeShipItem({ itemType: 'laser-cutter', tier: THREE_D_PRINTER_TIER });
      expect(isThreeDPrinter(item)).toBeFalse();
    });

    it('returns false when tier does not match', () => {
      const item = makeShipItem({ itemType: THREE_D_PRINTER_ITEM_TYPE, tier: 2 });
      expect(isThreeDPrinter(item)).toBeFalse();
    });
  });

  describe('create3DPrinter', () => {
    it('creates an item with the correct itemType and tier', () => {
      const printer = create3DPrinter();
      expect(printer.itemType).toBe(THREE_D_PRINTER_ITEM_TYPE);
      expect(printer.tier).toBe(THREE_D_PRINTER_TIER);
    });

    it('creates an item that is not launchable', () => {
      expect(create3DPrinter().launchable).toBeFalse();
    });

    it('creates an item with a generated UUID id', () => {
      const printer = create3DPrinter();
      expect(typeof printer.id).toBe('string');
      expect(printer.id.length).toBeGreaterThan(0);
    });

    it('creates a unique id on each call', () => {
      expect(create3DPrinter().id).not.toBe(create3DPrinter().id);
    });

    it('creates an item in contained state with intact damage status', () => {
      const printer = create3DPrinter();
      expect(printer.state).toBe('contained');
      expect(printer.damageStatus).toBe('intact');
    });
  });

  describe('coerce3DPrinter', () => {
    it('returns a ThreeDPrinter for valid raw input', () => {
      const raw = {
        id: 'p-1',
        itemType: THREE_D_PRINTER_ITEM_TYPE,
        displayName: '3D Printer',
        tier: THREE_D_PRINTER_TIER,
        launchable: false,
        state: 'contained',
        damageStatus: 'intact',
        container: null,
        owningPlayerId: null,
        owningCharacterId: null,
        kinematics: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const result = coerce3DPrinter(raw);
      expect(result).not.toBeNull();
      expect(result!.itemType).toBe(THREE_D_PRINTER_ITEM_TYPE);
    });

    it('returns null for null input', () => {
      expect(coerce3DPrinter(null)).toBeNull();
    });

    it('returns null when itemType does not match', () => {
      const raw = {
        id: 'p-2',
        itemType: 'laser-cutter',
        displayName: 'Laser Cutter',
        tier: THREE_D_PRINTER_TIER,
        launchable: false,
        state: 'contained',
        damageStatus: 'intact',
        container: null,
        owningPlayerId: null,
        owningCharacterId: null,
        kinematics: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      expect(coerce3DPrinter(raw)).toBeNull();
    });

    it('returns null when tier does not match', () => {
      const raw = {
        id: 'p-3',
        itemType: THREE_D_PRINTER_ITEM_TYPE,
        displayName: '3D Printer',
        tier: 2,
        launchable: false,
        state: 'contained',
        damageStatus: 'intact',
        container: null,
        owningPlayerId: null,
        owningCharacterId: null,
        kinematics: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      expect(coerce3DPrinter(raw)).toBeNull();
    });
  });
});
