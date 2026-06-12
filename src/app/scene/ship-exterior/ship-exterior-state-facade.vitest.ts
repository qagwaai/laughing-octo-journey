import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShipItem } from '../../model/ship-item';
import type { ShipSummary } from '../../model/ship-list';
import {
  ShipExteriorStateFacade,
  type ShipExteriorStateFacadeDependencies,
} from './ship-exterior-state-facade';

describe('ShipExteriorStateFacade', () => {
  function createShip(id: string, inventory: ShipItem[]): ShipSummary {
    return {
      id,
      name: `ship-${id}`,
      model: 'light-freighter',
      tier: 1,
      inventory,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 1, y: 0, z: 0 },
        epochMs: 0,
      },
    };
  }

  function createItem(id: string, itemType: string, launchable = false): ShipItem {
    return {
      id,
      itemType,
      displayName: itemType,
      launchable,
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship', containerId: 'ship-1' },
      owningPlayerId: null,
      owningCharacterId: null,
      spatial: null,
      destroyedAt: null,
      destroyedReason: null,
      discoveredAt: null,
      discoveredByCharacterId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  function createHarness() {
    const state = {
      navigationShip: null as ShipSummary | null,
      sessionShip: null as ShipSummary | null,
      launchableInventory: [] as ShipItem[],
      hasDrone: false,
    };

    const deps: ShipExteriorStateFacadeDependencies = {
      getNavigationShip: () => state.navigationShip,
      setNavigationShip: (ship) => {
        state.navigationShip = ship;
      },
      getSessionShip: () => state.sessionShip,
      setSessionShip: (ship) => {
        state.sessionShip = ship;
      },
      resolveLaunchableInventory: (rawInventory) =>
        (Array.isArray(rawInventory) ? rawInventory : []).filter((item): item is ShipItem =>
          Boolean(item && typeof item === 'object' && (item as ShipItem).launchable),
        ),
      resolveTargetingCapabilityFromInventory: (inventory) =>
        inventory.some((item) => item.itemType === 'expendable-dart-drone'),
      setLaunchableInventory: (inventory) => {
        state.launchableInventory = inventory;
      },
      setHasExpendableDartDrone: (hasDrone) => {
        state.hasDrone = hasDrone;
      },
    };

    return {
      state,
      facade: new ShipExteriorStateFacade(deps),
    };
  }

  it('syncNavigationShipFromShipList updates navigation ship and launch state', () => {
    const { state, facade } = createHarness();
    const launchable = createItem('item-1', 'probe', true);
    const drone = createItem('item-2', 'expendable-dart-drone', true);
    const matchingShip = createShip('ship-1', [launchable, drone]);

    facade.syncNavigationShipFromShipList(matchingShip, [launchable, drone]);

    expect(state.navigationShip?.id).toBe('ship-1');
    expect(state.navigationShip?.inventory?.length).toBe(2);
    expect(state.launchableInventory.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    expect(state.hasDrone).toBe(true);
  });

  it('removeConsumedLaunchItems removes ids from navigation and session inventory', () => {
    const { state, facade } = createHarness();
    const keepItem = createItem('keep', 'ore', false);
    const consumeItem = createItem('consume', 'expendable-dart-drone', true);
    state.navigationShip = createShip('ship-1', [keepItem, consumeItem]);
    state.sessionShip = createShip('ship-1', [keepItem, consumeItem]);

    const result = facade.removeConsumedLaunchItems('ship-1', ['consume']);

    expect(result.didMutateNavigationInventory).toBe(true);
    expect(result.didMutateSessionInventory).toBe(true);
    expect(state.navigationShip?.inventory?.map((item: ShipItem) => item.id)).toEqual(['keep']);
    expect(state.sessionShip?.inventory?.map((item: ShipItem) => item.id)).toEqual(['keep']);
    expect(state.hasDrone).toBe(false);
  });

  it('appendLaunchRewardItems appends inventory and hydrates session from navigation fallback', () => {
    const { state, facade } = createHarness();
    const baseItem = createItem('base', 'ore', false);
    const rewardItem = createItem('reward', 'copper', false);
    state.navigationShip = createShip('ship-1', [baseItem]);
    state.sessionShip = null;

    const result = facade.appendLaunchRewardItems('ship-1', [rewardItem]);

    expect(result.didMutateNavigationInventory).toBe(true);
    expect(result.didMutateSessionInventory).toBe(true);
    expect(state.navigationShip?.inventory?.map((item: ShipItem) => item.id)).toEqual(['base', 'reward']);
    expect(state.sessionShip).not.toBeNull();
    const syncedSessionShip = state.sessionShip!;
    expect(syncedSessionShip.inventory?.map((item: ShipItem) => item.id)).toEqual(['base', 'reward']);
  });
});
