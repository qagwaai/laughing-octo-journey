import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
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

  it('tracks scannable ship samples and hover state in the ship-local context', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.getHoveredScannableShipId()).toBeNull();
    expect(context.getScannableShipSamples().map((sample) => sample.id)).toContain('jaxs-ship');

    context.setHoveredScannableShipId('jaxs-ship');
    expect(context.getHoveredScannableShipId()).toBe('jaxs-ship');

    context.setScannableShipSamples([
      {
        id: 'jaxs-ship',
        displayName: 'Jax Ship',
        modelAssetPath: 'models/Jaxs_Ship_texture.glb',
        scanned: true,
        scanProgress: 100,
      },
    ]);

    expect(context.getScannableShipSamples()).toEqual([
      {
        id: 'jaxs-ship',
        displayName: 'Jax Ship',
        modelAssetPath: 'models/Jaxs_Ship_texture.glb',
        scanned: true,
        scanProgress: 100,
      },
    ]);
  });

  it('tracks scannable debris samples and hover state in the ship-local context', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });

    expect(context.getHoveredScannableDebrisId()).toBeNull();
    expect(context.getScannableDebrisSamples()).toEqual([]);

    context.setScannableDebrisSamples([
      {
        id: 'debris-1',
        displayName: 'Cargo Canister',
        itemType: 'cargo-canister',
        scanned: false,
        scanProgress: 0,
      },
    ]);
    context.setHoveredScannableDebrisId('debris-1');

    expect(context.getHoveredScannableDebrisId()).toBe('debris-1');
    expect(context.getScannableDebrisSamples()).toEqual([
      {
        id: 'debris-1',
        displayName: 'Cargo Canister',
        itemType: 'cargo-canister',
        scanned: false,
        scanProgress: 0,
      },
    ]);
  });

  it('resolves ship hover targets from pointer raycasting', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });
    context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0 }]);
    context.setHoveredAsteroidId('sample-alpha');

    const shipNode = new THREE.Object3D();
    shipNode.userData['scannableShipId'] = 'jaxs-ship';
    const intersectObjects = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ object: shipNode }]);
    (context as any).hoverRaycaster = {
      setFromCamera: vi.fn(),
      intersectObjects,
    };
    (context as any).renderingState = {
      canvas: {
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      },
      camera: {},
      asteroidGroup: { children: [] },
      debrisGroup: { children: [] },
      shipGroup: { children: [shipNode] },
    };

    const hoveredTarget = (context as any).updateHoveredScanTargetFromPointer(50, 50);

    expect(hoveredTarget).toEqual({ kind: 'ship', id: 'jaxs-ship' });
    expect(context.getHoveredScannableShipId()).toBe('jaxs-ship');
    expect(context.getHoveredAsteroidId()).toBeNull();
    expect(intersectObjects).toHaveBeenNthCalledWith(1, [], false);
    expect(intersectObjects).toHaveBeenNthCalledWith(2, [], true);
    expect(intersectObjects).toHaveBeenNthCalledWith(3, [shipNode], true);
  });

  it('resolves debris hover targets from pointer raycasting', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });
    context.setScannableDebrisSamples([
      {
        id: 'debris-1',
        displayName: 'Cargo Canister',
        itemType: 'cargo-canister',
        scanned: false,
        scanProgress: 0,
      },
    ]);
    context.setHoveredScannableShipId('jaxs-ship');

    const debrisNode = new THREE.Object3D();
    debrisNode.userData['scannableDebrisId'] = 'debris-1';
    const intersectObjects = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ object: debrisNode }])
      .mockReturnValueOnce([]);
    (context as any).hoverRaycaster = {
      setFromCamera: vi.fn(),
      intersectObjects,
    };
    (context as any).renderingState = {
      canvas: {
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      },
      camera: {},
      asteroidGroup: { children: [] },
      debrisGroup: { children: [debrisNode] },
      shipGroup: { children: [] },
    };

    const hoveredTarget = (context as any).updateHoveredScanTargetFromPointer(50, 50);

    expect(hoveredTarget).toEqual({ kind: 'debris', id: 'debris-1' });
    expect(context.getHoveredScannableDebrisId()).toBe('debris-1');
    expect(context.getHoveredScannableShipId()).toBeNull();
  });

  it('prefers asteroid hover targets over ship targets when both are intersected', () => {
    const context = new ShipSceneContext('player::char::ship', {
      playerName: 'player',
      characterId: 'char',
      shipId: 'ship',
    });
    context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0 }]);
    context.setHoveredScannableShipId('jaxs-ship');

    const asteroidMesh = new THREE.Mesh();
    asteroidMesh.name = 'sample-alpha';
    const shipNode = new THREE.Object3D();
    shipNode.userData['scannableShipId'] = 'jaxs-ship';
    const intersectObjects = vi
      .fn()
      .mockReturnValueOnce([{ object: asteroidMesh }])
      .mockReturnValueOnce([{ object: shipNode }]);
    (context as any).hoverRaycaster = {
      setFromCamera: vi.fn(),
      intersectObjects,
    };
    (context as any).renderingState = {
      canvas: {
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      },
      camera: {},
      asteroidGroup: { children: [asteroidMesh] },
      shipGroup: { children: [shipNode] },
    };

    const hoveredTarget = (context as any).updateHoveredScanTargetFromPointer(25, 25);

    expect(hoveredTarget).toEqual({ kind: 'asteroid', id: 'sample-alpha' });
    expect(context.getHoveredAsteroidId()).toBe('sample-alpha');
    expect(context.getHoveredScannableShipId()).toBeNull();
    expect(intersectObjects).toHaveBeenCalledTimes(1);
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
