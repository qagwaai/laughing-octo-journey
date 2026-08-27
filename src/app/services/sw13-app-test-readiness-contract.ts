export type ShipHangarLoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface ShipHangarRouteContext {
  playerName: string | null;
  characterId: string | null;
  shipId: string | null;
}

export interface ShipHangarLastSuccessfulLoad {
  requestGeneration: number;
  shipCount: number;
  loadedAtEpochMs: number;
}

export interface ShipHangarReadinessSnapshot {
  state: ShipHangarLoadState;
  requestGeneration: number;
  shipCount: number;
  error: string | null;
  routeContext: ShipHangarRouteContext;
  lastSuccessfulLoad: ShipHangarLastSuccessfulLoad | null;
  updatedAtEpochMs: number;
}

export interface Sw13AppTestReadinessSnapshot {
  version: 'sw13.v1';
  hangar: ShipHangarReadinessSnapshot;
}

export interface Sw13AppTestReadinessApi {
  readonly version: 'sw13.v1';
  getSnapshot: () => Sw13AppTestReadinessSnapshot;
}

declare global {
  interface Window {
    __sw13AppTestReadiness?: Sw13AppTestReadinessApi;
  }
}

const EMPTY_HANGAR_SNAPSHOT: ShipHangarReadinessSnapshot = {
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
};

let readinessSnapshot: Sw13AppTestReadinessSnapshot = {
  version: 'sw13.v1',
  hangar: EMPTY_HANGAR_SNAPSHOT,
};

function cloneSnapshot(snapshot: Sw13AppTestReadinessSnapshot): Sw13AppTestReadinessSnapshot {
  return {
    version: snapshot.version,
    hangar: {
      state: snapshot.hangar.state,
      requestGeneration: snapshot.hangar.requestGeneration,
      shipCount: snapshot.hangar.shipCount,
      error: snapshot.hangar.error,
      routeContext: {
        playerName: snapshot.hangar.routeContext.playerName,
        characterId: snapshot.hangar.routeContext.characterId,
        shipId: snapshot.hangar.routeContext.shipId,
      },
      lastSuccessfulLoad: snapshot.hangar.lastSuccessfulLoad
        ? {
            requestGeneration: snapshot.hangar.lastSuccessfulLoad.requestGeneration,
            shipCount: snapshot.hangar.lastSuccessfulLoad.shipCount,
            loadedAtEpochMs: snapshot.hangar.lastSuccessfulLoad.loadedAtEpochMs,
          }
        : null,
      updatedAtEpochMs: snapshot.hangar.updatedAtEpochMs,
    },
  };
}

export function getSw13AppTestReadinessSnapshot(): Sw13AppTestReadinessSnapshot {
  return cloneSnapshot(readinessSnapshot);
}

export function readSw13AppTestReadinessFromWindow(): Sw13AppTestReadinessSnapshot | null {
  if (typeof window === 'undefined' || !window.__sw13AppTestReadiness) {
    return null;
  }

  return window.__sw13AppTestReadiness.getSnapshot();
}

export function updateShipHangarReadinessSnapshot(snapshot: ShipHangarReadinessSnapshot): void {
  readinessSnapshot = {
    version: 'sw13.v1',
    hangar: {
      state: snapshot.state,
      requestGeneration: snapshot.requestGeneration,
      shipCount: snapshot.shipCount,
      error: snapshot.error,
      routeContext: {
        playerName: snapshot.routeContext.playerName,
        characterId: snapshot.routeContext.characterId,
        shipId: snapshot.routeContext.shipId,
      },
      lastSuccessfulLoad: snapshot.lastSuccessfulLoad
        ? {
            requestGeneration: snapshot.lastSuccessfulLoad.requestGeneration,
            shipCount: snapshot.lastSuccessfulLoad.shipCount,
            loadedAtEpochMs: snapshot.lastSuccessfulLoad.loadedAtEpochMs,
          }
        : null,
      updatedAtEpochMs: snapshot.updatedAtEpochMs,
    },
  };
}

export function registerSw13AppTestReadinessApi(enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') {
    return;
  }

  window.__sw13AppTestReadiness = {
    version: 'sw13.v1',
    getSnapshot: () => getSw13AppTestReadinessSnapshot(),
  };
}

export function unregisterSw13AppTestReadinessApi(): void {
  if (typeof window === 'undefined') {
    return;
  }

  delete window.__sw13AppTestReadiness;
}
