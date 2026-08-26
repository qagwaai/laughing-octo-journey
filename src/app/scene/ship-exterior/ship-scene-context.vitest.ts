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

  it('stores route feeds inside the ship-local context', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.hasRouteFeeds()).toBe(false);
    expect(context.getRouteFeedCounts()).toBeNull();

    context.setRouteFeeds({
      gates: [{ gateId: 'gate-1' } as never],
      stations: [{ marketId: 'station-1' } as never],
      encounterShips: [{ shipId: 'ship-1' } as never],
    });

    expect(context.hasRouteFeeds()).toBe(true);
    expect(context.getRouteFeedCounts()).toEqual({
      gates: 1,
      stations: 1,
      encounterShips: 1,
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
    expect(context.getHoveredAsteroidId()).toBeNull();
    expect(context.getAsteroidSamples()).toEqual([]);

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
    context.setHoveredAsteroidId('sample-alpha');

    expect(context.getTargetedAsteroidId()).toBe('sample-beta');
    expect(context.getHoveredAsteroidId()).toBe('sample-alpha');
    expect(context.getTargetHoldCandidateId()).toBeNull();
    expect(context.getAsteroidSamples().map((sample) => sample.id)).toEqual(['sample-alpha', 'sample-beta']);
    expect(context.getAsteroidSamples().find((sample) => sample.id === 'sample-alpha')?.serverCelestialBodyId).toBe(
      'cb-sample-alpha',
    );

    context.setTargetHoldCandidateId('sample-alpha');
    expect(context.getTargetHoldCandidateId()).toBe('sample-alpha');
  });

  it('keeps hold candidate state distinct from the confirmed target state', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    context.setAsteroidSamples([
      { id: 'sample-alpha', scanned: false, scanProgress: 0 },
      { id: 'sample-beta', scanned: false, scanProgress: 0 },
    ]);
    context.setTargetHoldCandidateId('sample-alpha');
    context.setTargetedAsteroidId('sample-beta');

    expect(context.getTargetHoldCandidateId()).toBe('sample-alpha');
    expect(context.getTargetedAsteroidId()).toBe('sample-beta');
  });

  it('stores debris items inside the ship-local context', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.getDebrisItems()).toEqual([]);

    context.setDebrisItems([
      {
        id: 'debris-1',
        itemType: 'cargo-canister',
        displayName: 'Cargo Canister',
        positionKm: { x: 1, y: 2, z: 3 },
        externalObjectDescriptor: {
          descriptorId: 'debris-cargo-canister-test',
          schemaVersion: 'sw-13-m0-v1',
          domain: 'debris',
          objectFamily: 'cargo-canister',
          roleCue: 'salvage',
          factionCue: 'unattributed',
          fallbackTier: 'standard',
          displayLabel: 'Cargo Canister',
          silhouetteProfile: 'cargo-canister',
          materialProfile: 'cargo-canister',
          emissiveProfile: 'low',
        },
      },
    ]);

    expect(context.getDebrisItems()).toEqual([
      {
        id: 'debris-1',
        itemType: 'cargo-canister',
        displayName: 'Cargo Canister',
        positionKm: { x: 1, y: 2, z: 3 },
        externalObjectDescriptor: {
          descriptorId: 'debris-cargo-canister-test',
          schemaVersion: 'sw-13-m0-v1',
          domain: 'debris',
          objectFamily: 'cargo-canister',
          roleCue: 'salvage',
          factionCue: 'unattributed',
          fallbackTier: 'standard',
          displayLabel: 'Cargo Canister',
          silhouetteProfile: 'cargo-canister',
          materialProfile: 'cargo-canister',
          emissiveProfile: 'low',
        },
      },
    ]);
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
