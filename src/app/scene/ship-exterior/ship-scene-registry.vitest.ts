import { describe, expect, it } from 'vitest';
import { ShipSceneRegistry } from './ship-scene-registry';
import { buildShipSceneContextKey } from './ship-scene-types';

function createKey(shipId: string): string {
  return buildShipSceneContextKey({
    playerName: 'player-one',
    characterId: 'char-a',
    shipId,
  });
}

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
    const key = createKey('ship-a');

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

  it('enforces active context resume and inactive context pause invariants', () => {
    const registry = new ShipSceneRegistry();
    const aKey = createKey('ship-a');
    const bKey = createKey('ship-b');

    const a = registry.getOrCreateContext(aKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    const b = registry.getOrCreateContext(bKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-b',
    });

    registry.activate(aKey);
    expect(a.isPaused()).toBe(false);
    expect(b.isPaused()).toBe(true);

    registry.activate(bKey);
    expect(a.isPaused()).toBe(true);
    expect(b.isPaused()).toBe(false);

    registry.enforceActivePauseInvariants();
    expect(a.isPaused()).toBe(true);
    expect(b.isPaused()).toBe(false);
  });

  it('deactivateAll pauses all contexts and clears active selection', () => {
    const registry = new ShipSceneRegistry();
    const aKey = createKey('ship-a');
    const bKey = createKey('ship-b');

    const a = registry.getOrCreateContext(aKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    const b = registry.getOrCreateContext(bKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-b',
    });

    registry.activate(aKey);
    registry.deactivateAll();

    expect(registry.getActiveContextKey()).toBeNull();
    expect(a.isPaused()).toBe(true);
    expect(b.isPaused()).toBe(true);
  });

  it('removeContext promotes a new active context when removing the current active context', () => {
    const registry = new ShipSceneRegistry();
    const aKey = createKey('ship-a');
    const bKey = createKey('ship-b');

    registry.getOrCreateContext(aKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    registry.getOrCreateContext(bKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-b',
    });

    registry.activate(aKey);
    const removed = registry.removeContext(aKey);

    expect(removed).toBe(true);
    expect(registry.getContext(aKey)).toBeNull();
    expect(registry.getActiveContextKey()).toBe(bKey);
  });

  it('keeps starfield signatures stable across A -> B -> A activation', () => {
    const registry = new ShipSceneRegistry();
    const aKey = createKey('ship-a');
    const bKey = createKey('ship-b');

    const a = registry.getOrCreateContext(aKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-a',
    });

    const b = registry.getOrCreateContext(bKey, {
      playerName: 'player-one',
      characterId: 'char-a',
      shipId: 'ship-b',
    });

    registry.activate(aKey);
    const aSignatureFirst = a.getStarfieldSignature();

    registry.activate(bKey);
    const bSignature = b.getStarfieldSignature();

    registry.activate(aKey);
    const aSignatureSecond = a.getStarfieldSignature();

    expect(aSignatureSecond).toBe(aSignatureFirst);
    expect(bSignature).not.toBe(aSignatureFirst);
  });
});
