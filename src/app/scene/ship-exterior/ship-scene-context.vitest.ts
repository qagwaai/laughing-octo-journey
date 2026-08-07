import { describe, expect, it } from 'vitest';
import { ShipSceneContext } from './ship-scene-context';

describe('ShipSceneContext', () => {
  it('tracks pause and resume state before rendering is initialized', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.isPaused()).toBe(true);

    context.resume();
    expect(context.isPaused()).toBe(false);

    context.pause();
    expect(context.isPaused()).toBe(true);
  });

  it('merges partial state updates', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
      world: { shipPosition: { x: 0, y: 0, z: 0 } },
    });

    context.setState({ world: { shipPosition: { x: 9, y: 8, z: 7 } } });

    expect(context.getState().world?.shipPosition).toEqual({ x: 9, y: 8, z: 7 });
  });

  it('stores mission state inside the ship-local context', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    context.setMissionGateState({
      missionId: 'first-target',
      characterId: 'char',
      activeObjectiveText: 'Objective: Identify an Iron asteroid via full scan.',
      updatedAt: '2026-04-28T00:00:00.000Z',
      steps: [
        {
          key: 'identify_iron_asteroid',
          status: 'active',
        },
      ],
    });

    expect(context.getMissionGateState()).toEqual({
      missionId: 'first-target',
      characterId: 'char',
      activeObjectiveText: 'Objective: Identify an Iron asteroid via full scan.',
      updatedAt: '2026-04-28T00:00:00.000Z',
      steps: [
        {
          key: 'identify_iron_asteroid',
          status: 'active',
        },
      ],
    });
  });

  it('does not increment rendered frame count while paused or without rendering state', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.getRenderedFrameCount()).toBe(0);

    context.renderFrame();
    expect(context.getRenderedFrameCount()).toBe(0);

    context.resume();
    context.renderFrame();
    expect(context.getRenderedFrameCount()).toBe(0);
  });

  it('uses deterministic starfield signatures per ship id', () => {
    const first = new ShipSceneContext('player::char::ship-a', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship-a',
    });

    const sameShipAgain = new ShipSceneContext('player::char::ship-a', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship-a',
    });

    const differentShip = new ShipSceneContext('player::char::ship-b', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship-b',
    });

    expect(first.getStarfieldSignature()).toBe(sameShipAgain.getStarfieldSignature());
    expect(first.getStarfieldSignature()).not.toBe(differentShip.getStarfieldSignature());
  });

  it('stores asteroid samples and target state in the ship-local context', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.getTargetedAsteroidId()).toBeNull();
    expect(context.getAsteroidSamples().map((sample) => sample.id)).toEqual(['sample-iron-1']);

    context.setAsteroidSamples([
      {
        id: 'sample-alpha',
        serverCelestialBodyId: 'cb-sample-alpha',
        scanned: false,
        scanProgress: 0,
        revealedMaterial: { material: 'Iron', rarity: 'Common' },
      },
      {
        id: 'sample-beta',
        serverCelestialBodyId: null,
        scanned: true,
        scanProgress: 100,
        revealedMaterial: { material: 'Nickel', rarity: 'Rare' },
      },
    ]);
    context.setTargetedAsteroidId('sample-beta');

    expect(context.getTargetedAsteroidId()).toBe('sample-beta');
    expect(context.getAsteroidSamples().map((sample) => sample.id)).toEqual(['sample-alpha', 'sample-beta']);
    expect(context.getAsteroidSamples().find((sample) => sample.id === 'sample-alpha')?.serverCelestialBodyId).toBe(
      'cb-sample-alpha',
    );
  });

  it('keeps asteroid layout signatures ship-local and deterministic', () => {
    const first = new ShipSceneContext('player::char::ship-a', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship-a',
    });
    const second = new ShipSceneContext('player::char::ship-b', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship-b',
    });

    expect(first.getAsteroidLayoutSignature()).toBe(first.getAsteroidLayoutSignature());
    expect(first.getAsteroidLayoutSignature()).not.toBe(second.getAsteroidLayoutSignature());
  });
});
