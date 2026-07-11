import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getSw13AppTestReadinessSnapshot,
  readSw13AppTestReadinessFromWindow,
  registerSw13AppTestReadinessApi,
  unregisterSw13AppTestReadinessApi,
  updateShipHangarReadinessSnapshot,
  type ShipHangarReadinessSnapshot,
} from './sw13-app-test-readiness-contract';

function resetSnapshot(): void {
  updateShipHangarReadinessSnapshot({
    state: 'idle',
    requestGeneration: 0,
    shipCount: 0,
    error: null,
    routeContext: {
      playerName: null,
      characterId: null,
      shipId: null,
    },
    lastSuccessfulLoad: null,
    updatedAtEpochMs: 0,
  });
}

describe('sw13 app test readiness contract', () => {
  beforeEach(() => {
    unregisterSw13AppTestReadinessApi();
    resetSnapshot();
  });

  afterEach(() => {
    unregisterSw13AppTestReadinessApi();
    resetSnapshot();
  });

  it('registers a read-only sw13.v1 window contract only when enabled', () => {
    registerSw13AppTestReadinessApi(false);

    expect(readSw13AppTestReadinessFromWindow()).toBeNull();

    registerSw13AppTestReadinessApi(true);

    expect(window.__sw13AppTestReadiness?.version).toBe('sw13.v1');
    expect(Object.keys(window.__sw13AppTestReadiness ?? {})).toEqual(['version', 'getSnapshot']);
  });

  it('serializes hangar readiness snapshots as defensive copies', () => {
    const snapshot: ShipHangarReadinessSnapshot = {
      state: 'loaded',
      requestGeneration: 3,
      shipCount: 2,
      error: null,
      routeContext: {
        playerName: 'Pioneer',
        characterId: 'c-1',
        shipId: 's-1',
      },
      lastSuccessfulLoad: {
        requestGeneration: 3,
        shipCount: 2,
        loadedAtEpochMs: 1000,
      },
      updatedAtEpochMs: 1001,
    };

    updateShipHangarReadinessSnapshot(snapshot);
    snapshot.routeContext.playerName = 'Mutated';
    snapshot.lastSuccessfulLoad!.shipCount = 99;

    const firstRead = getSw13AppTestReadinessSnapshot();
    expect(firstRead).toEqual({
      version: 'sw13.v1',
      hangar: {
        state: 'loaded',
        requestGeneration: 3,
        shipCount: 2,
        error: null,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 's-1',
        },
        lastSuccessfulLoad: {
          requestGeneration: 3,
          shipCount: 2,
          loadedAtEpochMs: 1000,
        },
        updatedAtEpochMs: 1001,
      },
    });

    firstRead.hangar.routeContext.shipId = 'mutated-read';
    firstRead.hangar.lastSuccessfulLoad!.loadedAtEpochMs = 9999;

    expect(getSw13AppTestReadinessSnapshot().hangar.routeContext.shipId).toBe('s-1');
    expect(getSw13AppTestReadinessSnapshot().hangar.lastSuccessfulLoad?.loadedAtEpochMs).toBe(1000);
  });
});