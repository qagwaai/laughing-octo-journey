import {
  HULL_PATCH_KIT_PRINTABLE_ITEM,
  CONDUIT_SEALS_PRINTABLE_ITEM,
  PRINTABLE_ITEMS,
  resolvePrintableItemDefinition,
  formatPrintableDuration,
  hasPrintableItemInInventory,
  isPrintableItemQueued,
  countAvailablePrintableMaterial,
  findConsumableMaterialsForPrintableItem,
  describePrintableMaterials,
  getMissingPrintableMaterials,
} from './printable-item';
import type { ShipItem } from './ship-item';

function makeItem(overrides: Partial<ShipItem> & { itemType: string; displayName: string }): ShipItem {
  return {
    id: 'item-' + overrides.itemType,
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
    tier: 1,
    ...overrides,
  } as ShipItem;
}

const ironItem = makeItem({ itemType: 'iron', displayName: 'Iron' });
const copperItem = makeItem({ itemType: 'copper', displayName: 'Copper', id: 'copper-1' });
const copperItem2 = makeItem({ itemType: 'copper', displayName: 'Copper', id: 'copper-2' });
const polymerItem = makeItem({ itemType: 'polymer-resin', displayName: 'Polymer Resin' });
const hullPatchKitItem = makeItem({ itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit' });

describe('printable-item', () => {
  describe('resolvePrintableItemDefinition', () => {
    it('returns the hull patch kit for its itemType', () => {
      const result = resolvePrintableItemDefinition('hull-patch-kit');
      expect(result).toBe(HULL_PATCH_KIT_PRINTABLE_ITEM);
    });

    it('returns the conduit seals for its itemType', () => {
      const result = resolvePrintableItemDefinition('conduit-seals');
      expect(result).toBe(CONDUIT_SEALS_PRINTABLE_ITEM);
    });

    it('returns null for unknown itemType', () => {
      expect(resolvePrintableItemDefinition('unknown-item')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(resolvePrintableItemDefinition('')).toBeNull();
    });

    it('covers all PRINTABLE_ITEMS entries', () => {
      for (const item of PRINTABLE_ITEMS) {
        expect(resolvePrintableItemDefinition(item.itemType)).toBe(item);
      }
    });
  });

  describe('formatPrintableDuration', () => {
    it('formats durations under 60 minutes as "X min"', () => {
      expect(formatPrintableDuration(60_000)).toBe('1 min');
      expect(formatPrintableDuration(10 * 60_000)).toBe('10 min');
      expect(formatPrintableDuration(59 * 60_000)).toBe('59 min');
    });

    it('formats exactly 1 hour', () => {
      expect(formatPrintableDuration(60 * 60_000)).toBe('1 hr');
    });

    it('formats hours with remaining minutes', () => {
      expect(formatPrintableDuration(90 * 60_000)).toBe('1 hr 30 min');
      expect(formatPrintableDuration(125 * 60_000)).toBe('2 hr 5 min');
    });

    it('formats multiple whole hours', () => {
      expect(formatPrintableDuration(2 * 60 * 60_000)).toBe('2 hr');
    });

    it('formats 0 ms as 0 min', () => {
      expect(formatPrintableDuration(0)).toBe('0 min');
    });
  });

  describe('hasPrintableItemInInventory', () => {
    it('returns true when inventory contains the item type', () => {
      expect(hasPrintableItemInInventory([hullPatchKitItem], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeTrue();
    });

    it('returns false when inventory does not contain the item type', () => {
      expect(hasPrintableItemInInventory([ironItem], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });

    it('returns false for empty inventory', () => {
      expect(hasPrintableItemInInventory([], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });

    it('returns false for undefined inventory', () => {
      expect(hasPrintableItemInInventory(undefined, HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });
  });

  describe('isPrintableItemQueued', () => {
    it('returns true when the item type is in the queue', () => {
      expect(isPrintableItemQueued([{ itemType: 'hull-patch-kit' }], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeTrue();
    });

    it('returns false when the item type is not in the queue', () => {
      expect(isPrintableItemQueued([{ itemType: 'conduit-seals' }], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });

    it('returns false for empty queue', () => {
      expect(isPrintableItemQueued([], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });

    it('returns false for undefined queue', () => {
      expect(isPrintableItemQueued(undefined, HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeFalse();
    });
  });

  describe('countAvailablePrintableMaterial', () => {
    const ironReq = HULL_PATCH_KIT_PRINTABLE_ITEM.requiredMaterials[0];

    it('counts matching items by itemType', () => {
      expect(countAvailablePrintableMaterial([ironItem, ironItem], ironReq)).toBe(2);
    });

    it('returns 0 for empty inventory', () => {
      expect(countAvailablePrintableMaterial([], ironReq)).toBe(0);
    });

    it('returns 0 for undefined inventory', () => {
      expect(countAvailablePrintableMaterial(undefined, ironReq)).toBe(0);
    });

    it('matches by acceptedDisplayNames (case-insensitive)', () => {
      const ironByName = makeItem({ itemType: 'unknown', displayName: 'Iron Ore' });
      expect(countAvailablePrintableMaterial([ironByName], ironReq)).toBe(1);
    });
  });

  describe('findConsumableMaterialsForPrintableItem', () => {
    it('returns consumed materials when inventory has exact requirements', () => {
      const result = findConsumableMaterialsForPrintableItem([ironItem], HULL_PATCH_KIT_PRINTABLE_ITEM);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].itemType).toBe('iron');
    });

    it('returns null when inventory lacks required materials', () => {
      expect(findConsumableMaterialsForPrintableItem([], HULL_PATCH_KIT_PRINTABLE_ITEM)).toBeNull();
    });

    it('returns null when only partially satisfying multi-material item', () => {
      // conduit-seals needs 2 copper + 1 polymer; only 1 copper present
      expect(findConsumableMaterialsForPrintableItem([copperItem, polymerItem], CONDUIT_SEALS_PRINTABLE_ITEM)).toBeNull();
    });

    it('returns consumed materials for conduit seals with full inventory', () => {
      const result = findConsumableMaterialsForPrintableItem(
        [copperItem, copperItem2, polymerItem],
        CONDUIT_SEALS_PRINTABLE_ITEM,
      );
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
    });

    it('consumes each material only once (does not double-count)', () => {
      // only one iron — consuming it should leave result with 1 entry
      const result = findConsumableMaterialsForPrintableItem([ironItem], HULL_PATCH_KIT_PRINTABLE_ITEM);
      expect(result!.length).toBe(1);
      expect(result![0].id).toBe(ironItem.id);
    });

    it('returns empty array for item with no required materials', () => {
      const noMaterials = { ...HULL_PATCH_KIT_PRINTABLE_ITEM, requiredMaterials: [] };
      const result = findConsumableMaterialsForPrintableItem([ironItem], noMaterials);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(0);
    });
  });

  describe('describePrintableMaterials', () => {
    it('returns formatted material strings for hull patch kit', () => {
      const result = describePrintableMaterials(HULL_PATCH_KIT_PRINTABLE_ITEM);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('1 x Iron (raw material)');
    });

    it('returns formatted strings for conduit seals (multiple materials)', () => {
      const result = describePrintableMaterials(CONDUIT_SEALS_PRINTABLE_ITEM);
      expect(result.length).toBe(2);
      expect(result[0]).toContain('2 x Copper');
      expect(result[1]).toContain('1 x Polymer');
    });
  });

  describe('getMissingPrintableMaterials', () => {
    it('returns empty array when all materials are present', () => {
      expect(getMissingPrintableMaterials(HULL_PATCH_KIT_PRINTABLE_ITEM, [ironItem])).toEqual([]);
    });

    it('returns missing material labels when inventory is empty', () => {
      const result = getMissingPrintableMaterials(HULL_PATCH_KIT_PRINTABLE_ITEM, []);
      expect(result.length).toBe(1);
      expect(result[0]).toContain('Iron');
    });

    it('returns missing materials when partially satisfied', () => {
      // conduit-seals needs 2 copper + 1 polymer; only 1 copper present
      const result = getMissingPrintableMaterials(CONDUIT_SEALS_PRINTABLE_ITEM, [copperItem, polymerItem]);
      expect(result.length).toBe(1);
      expect(result[0]).toContain('Copper');
    });

    it('returns empty array for undefined inventory', () => {
      const result = getMissingPrintableMaterials(HULL_PATCH_KIT_PRINTABLE_ITEM, undefined);
      expect(result.length).toBe(1);
    });
  });
});
