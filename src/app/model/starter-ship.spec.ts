import { DEFAULT_SHIP_MODEL, DEFAULT_SHIP_TIER } from './ship-list';
import { generateDeterministicStarterShipUpdate } from './starter-ship';

describe('starter-ship model', () => {
  it('creates a scavenger pod starter ship with canonical starter inventory', () => {
    const starter = generateDeterministicStarterShipUpdate('Pioneer', 'char-1', 'starter-char-1');

    expect(starter.id).toBe('starter-char-1');
    expect(starter.model).toBe(DEFAULT_SHIP_MODEL);
    expect(starter.tier).toBe(DEFAULT_SHIP_TIER);
    expect(Array.isArray(starter.inventory)).toBeTrue();
    expect(starter.inventory?.map((item) => item.itemType)).toEqual([
      'expendable-dart-drone',
      'sensor-array',
      'ship-tractor-beam',
    ]);
    expect(starter.spatial).toBeDefined();
    expect(starter.motion).toBeDefined();
  });
});
