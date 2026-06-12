import { describe, expect, it, vi } from 'vitest';
import { ConsumedItemShadowService } from './consumed-item-shadow.service';

describe('ConsumedItemShadowService', () => {
  const storageKey = 'consumed-item-log:Pioneer:char-1';

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores consumed ids once and avoids duplicates', () => {
    const service = new ConsumedItemShadowService();

    service.markConsumed('Pioneer', 'char-1', 'item-1');
    service.markConsumed('Pioneer', 'char-1', 'item-1');

    expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify(['item-1']));
  });

  it('ignores markConsumed when identity or item id is invalid', () => {
    const service = new ConsumedItemShadowService();

    service.markConsumed('', 'char-1', 'item-1');
    service.markConsumed('Pioneer', '', 'item-1');
    service.markConsumed('Pioneer', 'char-1', '   ');

    expect(window.localStorage.length).toBe(0);
  });

  it('returns a shallow copy when key cannot be built', () => {
    const service = new ConsumedItemShadowService();
    const inventory = [{ id: 'item-a', displayName: 'A', itemType: 'tool' } as any];

    const filtered = service.filterInventory('', 'char-1', inventory);

    expect(filtered).toEqual(inventory);
    expect(filtered).not.toBe(inventory);
  });

  it('keeps full inventory when there are no consumed ids', () => {
    const service = new ConsumedItemShadowService();
    const inventory = [{ id: 'item-a', displayName: 'A', itemType: 'tool' } as any];

    const filtered = service.filterInventory('Pioneer', 'char-1', inventory);

    expect(filtered).toEqual(inventory);
  });

  it('filters consumed items and logs backend persistence warning', () => {
    const service = new ConsumedItemShadowService();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem(storageKey, JSON.stringify(['item-a']));

    const filtered = service.checkInventoryForConsumedItems('Pioneer', 'char-1', [
      { id: 'item-a', displayName: 'Laser Drill', itemType: 'drill' } as any,
      { id: 'item-b', displayName: 'Shield Cell', itemType: 'shield' } as any,
    ]);

    expect(filtered).toEqual([{ id: 'item-b', displayName: 'Shield Cell', itemType: 'shield' }]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('Consumed item reappeared after repair: item-a');
  });

  it('tolerates malformed persisted data', () => {
    const service = new ConsumedItemShadowService();
    window.localStorage.setItem(storageKey, '{not-json');

    const filtered = service.filterInventory('Pioneer', 'char-1', [
      { id: 'item-a', displayName: 'Laser Drill', itemType: 'drill' } as any,
    ]);

    expect(filtered).toEqual([{ id: 'item-a', displayName: 'Laser Drill', itemType: 'drill' }]);
  });
});
