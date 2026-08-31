import { AsteroidScanController } from './asteroid-scan-controller';
import type { ShipSceneAsteroidSample } from './ship-scene-types';

describe('AsteroidScanController', () => {
  const createSample = (overrides: Partial<ShipSceneAsteroidSample> = {}): ShipSceneAsteroidSample => ({
    id: 'asteroid-1',
    serverCelestialBodyId: null,
    scanned: false,
    scanProgress: 0,
    revealedMaterial: { material: 'Iron', rarity: 'Common' },
    revealedKinematics: null,
    solarSystemLocation: {
      positionKm: { x: 1, y: 2, z: 3 },
    },
    clusterCenterKm: { x: 0, y: 0, z: 0 },
    ...overrides,
  });

  let controller: AsteroidScanController;
  let activeContext: { contextKey: string; getScannableSamples: () => readonly ShipSceneAsteroidSample[] };
  let completed: Array<{ contextKey: string; sampleId: string }>;

  beforeEach(() => {
    vi.useFakeTimers();
    completed = [];
    activeContext = {
      contextKey: 'context-1',
      getScannableSamples: () => [createSample()],
    };
    controller = new AsteroidScanController({
      getActiveContext: () => activeContext,
      getContext: (contextKey) => (contextKey === activeContext.contextKey ? activeContext : null),
      onScanComplete: (contextKey, sampleId) => {
        completed.push({ contextKey, sampleId });
      },
      resolveHoldMs: () => 10_000,
    });
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
  });

  it('fires after the configured hover hold', () => {
    controller.beginHoverScan('asteroid-1');
    expect(completed).toEqual([]);

    vi.advanceTimersByTime(10_000);

    expect(completed).toEqual([{ contextKey: 'context-1', sampleId: 'asteroid-1' }]);
  });

  it('cancels the timer when a different asteroid is hovered', () => {
    controller.beginHoverScan('asteroid-1');
    controller.syncFromHover('context-1', 'asteroid-2');

    vi.advanceTimersByTime(10_000);

    expect(completed).toEqual([]);
  });

  it('ignores scanned samples', () => {
    activeContext = {
      contextKey: 'context-1',
      getScannableSamples: () => [createSample({ scanned: true })],
    };
    controller = new AsteroidScanController({
      getActiveContext: () => activeContext,
      getContext: (contextKey) => (contextKey === activeContext.contextKey ? activeContext : null),
      onScanComplete: (contextKey, sampleId) => {
        completed.push({ contextKey, sampleId });
      },
      resolveHoldMs: () => 10_000,
    });

    controller.beginHoverScan('asteroid-1');
    vi.advanceTimersByTime(10_000);

    expect(completed).toEqual([]);
  });

  it('clears on hover loss', () => {
    controller.beginHoverScan('asteroid-1');
    controller.syncFromHover('context-1', null);

    vi.advanceTimersByTime(10_000);

    expect(completed).toEqual([]);
  });
});
