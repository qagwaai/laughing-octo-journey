import { describe, expect, it } from 'vitest';
import { ShipSceneRegistry } from './ship-scene-registry';
import { buildShipSceneContextKey } from './ship-scene-types';

describe('ShipSceneRegistry', () => {
  it('preserves A runtime state across A -> B -> A activation while B mutates only B-owned state', () => {
    const registry = new ShipSceneRegistry();

    const aKey = buildShipSceneContextKey({
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    const bKey = buildShipSceneContextKey({
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-b',
    });

    const a = registry.getOrCreateContext(aKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
      world: { shipPosition: { x: 10, y: 0, z: 0 } },
    });

    const b = registry.getOrCreateContext(bKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-b',
      world: { shipPosition: { x: -10, y: 0, z: 0 } },
    });

    registry.activate(aKey);
    a.setState({ world: { shipPosition: { x: 42, y: 1, z: -3 } } });
    const aStateBeforeSwitch = structuredClone(a.getState());

    registry.activate(bKey);
    b.setState({ world: { shipPosition: { x: -84, y: 2, z: 6 } } });

    registry.activate(aKey);

    expect(registry.getActiveContextKey()).toBe(aKey);
    expect(a.getState()).toEqual(aStateBeforeSwitch);
    expect(b.getState().world?.shipPosition).toEqual({ x: -84, y: 2, z: 6 });
    expect(a.getState().world?.shipPosition).toEqual({ x: 42, y: 1, z: -3 });
  });

  it('keeps context identity stable across repeated activation switches', () => {
    const registry = new ShipSceneRegistry();
    const key = buildShipSceneContextKey({
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    const first = registry.getOrCreateContext(key, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    registry.activate(key);
    registry.activate(key);

    const second = registry.getOrCreateContext(key, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    expect(second).toBe(first);
  });
});
