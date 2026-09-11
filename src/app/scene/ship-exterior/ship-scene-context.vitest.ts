import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { type AsteroidOrbitProfile, resolveAsteroidOrbitOffset, ShipSceneContext } from './ship-scene-context';

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
      { id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null },
      { id: 'sample-beta', scanned: false, scanProgress: 0, revealedMaterial: null },
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
    context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);
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
    context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);
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

  describe('asteroid spin', () => {
    const createContext = () =>
      new ShipSceneContext('player::char::ship', {
        playerName: 'player',
        characterId: 'char',
        shipId: 'ship',
      });

    const createdMeshFor = (context: ShipSceneContext, id: string): THREE.Mesh =>
      (context as any).createAsteroidMesh({
        id,
        position: [0, 0, 0],
        radius: 1,
        detail: 0,
        scale: 1,
        color: 0x888888,
        emissive: 0x000000,
        emissiveIntensity: 0,
        isTargeted: false,
        isHovered: false,
      });

    it('gives each created asteroid mesh a deterministic 3-axis spin profile', () => {
      const context = createContext();

      const alpha = createdMeshFor(context, 'sample-alpha');
      const alphaAgain = createdMeshFor(context, 'sample-alpha');
      const beta = createdMeshFor(context, 'sample-beta');

      const spinOf = (mesh: THREE.Mesh) => (mesh.userData as any).spinProfile.spin as [number, number, number];

      expect(spinOf(alpha)).toEqual(spinOf(alphaAgain));
      expect(spinOf(alpha)).not.toEqual(spinOf(beta));

      for (const axis of spinOf(alpha)) {
        expect(Math.abs(axis)).toBeGreaterThanOrEqual(0.05);
        expect(Math.abs(axis)).toBeLessThanOrEqual(0.5);
      }
    });

    it('starts asteroids at a deterministic random orientation instead of aligned at zero', () => {
      const context = createContext();

      const alpha = createdMeshFor(context, 'sample-alpha');
      const beta = createdMeshFor(context, 'sample-beta');

      const orientationOf = (mesh: THREE.Mesh) => [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];

      expect(orientationOf(alpha)).not.toEqual([0, 0, 0]);
      expect(orientationOf(alpha)).not.toEqual(orientationOf(beta));
    });

    it('advances idle asteroid rotation on all three axes during rendering', () => {
      const context = createContext();
      context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);

      const mesh = createdMeshFor(context, 'sample-alpha');
      mesh.rotation.set(0, 0, 0);
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      const [spinX, spinY, spinZ] = (mesh.userData as any).spinProfile.spin as [number, number, number];

      (context as any).advanceAsteroidSpin();

      const frame = 1 / 60;
      expect(mesh.rotation.x).toBeCloseTo(spinX * frame);
      expect(mesh.rotation.y).toBeCloseTo(spinY * frame);
      expect(mesh.rotation.z).toBeCloseTo(spinZ * frame);
    });

    it('uses revealed kinematics instead of the idle spin once an asteroid is scanned', () => {
      const context = createContext();
      context.setAsteroidSamples([
        {
          id: 'sample-alpha',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'iron', rarity: 'common' },
          revealedKinematics: {
            velocityKmPerSec: { x: 0, y: 0, z: 0 },
            angularVelocityRadPerSec: { x: 0.01, y: 0.02, z: 0.03 },
          } as never,
        },
      ]);

      const mesh = createdMeshFor(context, 'sample-alpha');
      mesh.rotation.set(0, 0, 0);
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      (context as any).advanceAsteroidSpin();

      const scale = (1 / 60) * 20;
      expect(mesh.rotation.x).toBeCloseTo(0.01 * scale);
      expect(mesh.rotation.y).toBeCloseTo(0.02 * scale);
      expect(mesh.rotation.z).toBeCloseTo(0.03 * scale);
    });

    it('rotates asteroids as part of renderFrame', () => {
      const context = createContext();
      context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);

      const mesh = createdMeshFor(context, 'sample-alpha');
      mesh.rotation.set(0, 0, 0);

      (context as any).renderingState = {
        isPausedLocal: false,
        cube: new THREE.Object3D(),
        asteroidGroup: { children: [mesh] },
        orbitControls: { update: vi.fn(), setEnabled: vi.fn(), setTarget: vi.fn() },
        renderer: { render: vi.fn() },
        scene: {},
        camera: {},
      };
      (context as any).syncDebrisVisuals = vi.fn();
      (context as any).syncScannableDebrisHoverScanShell = vi.fn();
      (context as any).syncRouteFeedVisuals = vi.fn();
      (context as any).syncAsteroidVisuals = vi.fn();
      (context as any).syncScannableShipHoverScanShell = vi.fn();
      (context as any).paused = false;

      context.renderFrame();

      expect(context.getRenderedFrameCount()).toBe(1);
      expect(mesh.rotation.x).not.toBe(0);
      expect(mesh.rotation.y).not.toBe(0);
      expect(mesh.rotation.z).not.toBe(0);
    });

    it('counter-rotates hover scan overlays so rings stay world aligned', () => {
      const context = createContext();
      context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);

      const mesh = createdMeshFor(context, 'sample-alpha');
      const overlay = new THREE.Group();
      mesh.add(overlay);
      (mesh.userData as any).hoverScanGroup = overlay;
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      (context as any).advanceAsteroidSpin();

      const composed = mesh.quaternion.clone().multiply(overlay.quaternion);
      expect(composed.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
    });
  });

  describe('asteroid orbit', () => {
    const createContext = () =>
      new ShipSceneContext('player::char::ship', {
        playerName: 'player',
        characterId: 'char',
        shipId: 'ship',
      });

    const createdMeshFor = (
      context: ShipSceneContext,
      id: string,
      position: [number, number, number] = [0, 0, 0],
      overrides: Partial<{ isTargeted: boolean; isHovered: boolean }> = {},
    ): THREE.Mesh =>
      (context as any).createAsteroidMesh({
        id,
        position,
        radius: 1,
        detail: 0,
        scale: 1,
        color: 0x888888,
        emissive: 0x000000,
        emissiveIntensity: 0,
        isTargeted: false,
        isHovered: false,
        ...overrides,
      });

    const orbitProfileOf = (mesh: THREE.Mesh) => (mesh.userData as any).orbitProfile as AsteroidOrbitProfile;

    it('gives each created asteroid mesh a deterministic orbit profile', () => {
      const context = createContext();

      const alpha = createdMeshFor(context, 'sample-alpha');
      const alphaAgain = createdMeshFor(context, 'sample-alpha');
      const beta = createdMeshFor(context, 'sample-beta');

      expect(orbitProfileOf(alpha)).toEqual(orbitProfileOf(alphaAgain));
      expect(orbitProfileOf(alpha)).not.toEqual(orbitProfileOf(beta));
    });

    it('keeps orbit amplitudes within the configured drift band', () => {
      const context = createContext();

      for (const id of ['sample-alpha', 'sample-beta', 'sample-gamma', 'sample-delta']) {
        const { amplitude, rate } = orbitProfileOf(createdMeshFor(context, id));

        // X and Z drift across the full band; Y is deliberately flattened to read as orbital.
        expect(amplitude[0]).toBeGreaterThanOrEqual(0.3);
        expect(amplitude[0]).toBeLessThanOrEqual(0.8);
        expect(amplitude[2]).toBeGreaterThanOrEqual(0.3);
        expect(amplitude[2]).toBeLessThanOrEqual(0.8);
        expect(amplitude[1]).toBeGreaterThanOrEqual(0.3 * 0.45);
        expect(amplitude[1]).toBeLessThanOrEqual(0.8 * 0.45);

        for (const axisRate of rate) {
          expect(axisRate).toBeGreaterThanOrEqual(0.05);
          expect(axisRate).toBeLessThanOrEqual(0.18);
        }
      }
    });

    it('uses independent axis frequencies so the drift does not repeat on a single period', () => {
      const context = createContext();
      const { rate } = orbitProfileOf(createdMeshFor(context, 'sample-alpha'));

      expect(rate[0]).not.toBe(rate[1]);
      expect(rate[1]).not.toBe(rate[2]);
      expect(rate[0]).not.toBe(rate[2]);
    });

    it('records the laid-out position as the orbit base when applying visuals', () => {
      const context = createContext();

      const mesh = createdMeshFor(context, 'sample-alpha', [1.5, -2.5, 3.5]);

      expect((mesh.userData as any).orbitBasePosition).toEqual([1.5, -2.5, 3.5]);
    });

    it('offsets asteroids from their base position during rendering', () => {
      const context = createContext();
      context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);

      const mesh = createdMeshFor(context, 'sample-alpha', [4, 0, 2]);
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      (context as any).advanceAsteroidOrbit();

      const expected = resolveAsteroidOrbitOffset(orbitProfileOf(mesh), 1 / 60);
      expect(mesh.position.x).toBeCloseTo(4 + expected[0]);
      expect(mesh.position.y).toBeCloseTo(0 + expected[1]);
      expect(mesh.position.z).toBeCloseTo(2 + expected[2]);
    });

    it('re-derives position from the base each frame instead of accumulating drift', () => {
      const context = createContext();
      context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);

      const mesh = createdMeshFor(context, 'sample-alpha', [4, 0, 2]);
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      (context as any).advanceAsteroidOrbit();
      (context as any).advanceAsteroidOrbit();
      (context as any).advanceAsteroidOrbit();

      // Absolute sample at t=3 frames, not the sum of three per-frame offsets.
      const expected = resolveAsteroidOrbitOffset(orbitProfileOf(mesh), 3 / 60);
      expect(mesh.position.x).toBeCloseTo(4 + expected[0]);
      expect(mesh.position.y).toBeCloseTo(0 + expected[1]);
      expect(mesh.position.z).toBeCloseTo(2 + expected[2]);
    });

    it('stays within the drift band no matter how long the scene has been running', () => {
      const context = createContext();
      const mesh = createdMeshFor(context, 'sample-alpha', [4, 0, 2]);
      const { amplitude } = orbitProfileOf(mesh);

      for (const elapsedSeconds of [0, 12.5, 400, 9_999]) {
        const [x, y, z] = resolveAsteroidOrbitOffset(orbitProfileOf(mesh), elapsedSeconds);
        expect(Math.abs(x)).toBeLessThanOrEqual(amplitude[0] + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(amplitude[1] + 1e-9);
        expect(Math.abs(z)).toBeLessThanOrEqual(amplitude[2] + 1e-9);
      }
    });

    it('keeps targeted and scanned asteroids orbiting so the player must track them', () => {
      const context = createContext();
      context.setAsteroidSamples([
        {
          id: 'sample-alpha',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'iron', rarity: 'common' },
        },
      ]);
      context.setTargetedAsteroidId('sample-alpha');

      const mesh = createdMeshFor(context, 'sample-alpha', [4, 0, 2], { isTargeted: true });
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      (context as any).advanceAsteroidOrbit();

      expect([mesh.position.x, mesh.position.y, mesh.position.z]).not.toEqual([4, 0, 2]);
    });

    it('moves asteroid position as part of renderFrame', () => {
      const context = createContext();
      context.setAsteroidSamples([{ id: 'sample-alpha', scanned: false, scanProgress: 0, revealedMaterial: null }]);

      const mesh = createdMeshFor(context, 'sample-alpha', [4, 0, 2]);

      (context as any).renderingState = {
        isPausedLocal: false,
        cube: new THREE.Object3D(),
        asteroidGroup: { children: [mesh] },
        orbitControls: { update: vi.fn(), setEnabled: vi.fn(), setTarget: vi.fn() },
        renderer: { render: vi.fn() },
        scene: {},
        camera: {},
      };
      (context as any).syncDebrisVisuals = vi.fn();
      (context as any).syncScannableDebrisHoverScanShell = vi.fn();
      (context as any).syncRouteFeedVisuals = vi.fn();
      (context as any).syncAsteroidVisuals = vi.fn();
      (context as any).syncScannableShipHoverScanShell = vi.fn();
      (context as any).paused = false;

      context.renderFrame();

      expect(context.getRenderedFrameCount()).toBe(1);
      expect([mesh.position.x, mesh.position.y, mesh.position.z]).not.toEqual([4, 0, 2]);
    });

    it('leaves meshes untouched when no orbit base has been recorded', () => {
      const context = createContext();

      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial());
      mesh.name = 'sample-orphan';
      mesh.position.set(1, 2, 3);
      (context as any).renderingState = { asteroidGroup: { children: [mesh] } };

      (context as any).advanceAsteroidOrbit();

      expect([mesh.position.x, mesh.position.y, mesh.position.z]).toEqual([1, 2, 3]);
    });
  });
});
