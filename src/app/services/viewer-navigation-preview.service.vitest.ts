import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  NavigationRouteEstimate,
  PairedNavigationEstimate,
  SolarSystemGetRequest,
  SolarSystemGetResponse,
  SupportedNavigationPositionState,
  SupportedNavigationPrediction,
} from '../model/solar-system-get';
import { SolarSystemService } from './solar-system.service';
import { ViewerNavigationPreviewService, type NavigationPreviewSelection } from './viewer-navigation-preview.service';

const selection: NavigationPreviewSelection = {
  playerName: 'Pilot',
  sessionKey: 'session-key',
  characterId: 'character-1',
  solarSystemId: 'sol',
  shipId: 'ship-1',
  shipName: 'Scout',
  shipEpochMs: 1_794_694_161_611,
  shipPositionKm: { x: 1, y: 2, z: 3 },
  destinationMarketId: 'market-1',
  destinationName: 'Port Meridian',
};

function supportedState(overrides: Partial<SupportedNavigationPositionState> = {}): SupportedNavigationPositionState {
  return {
    status: 'supported',
    solarSystemId: 'sol',
    coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
    epochMs: 1_794_694_161_611,
    departure: { shipId: 'ship-1', positionKm: { x: 1, y: 2, z: 3 } },
    destination: { marketId: 'market-1', positionKm: { x: 4, y: 5, z: 6 } },
    candidates: [],
    previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
    ...overrides,
  };
}

function response(
  navigationState: SolarSystemGetResponse['navigationState'],
  navigationEstimate: SolarSystemGetResponse['navigationEstimate'] = pairedEstimate(),
): SolarSystemGetResponse {
  return {
    success: true,
    message: '',
    correlationId: 'navigation-test',
    requestIdentity: { operation: 'solar-system-get', entityType: 'solar-system', containerId: 'sol' },
    solarSystemId: 'sol',
    bodies: [],
    navigationState,
    navigationEstimate,
  };
}

function supportedEstimate(overrides: Partial<Extract<NavigationRouteEstimate, { status: 'supported' }>> = {}) {
  return {
    status: 'supported' as const,
    solarSystemId: 'sol',
    departure: { shipId: 'ship-1' },
    destination: { marketId: 'market-1' },
    coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
    referenceEpochMs: 1_794_694_161_611,
    positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
    estimationModelId: 'frozen-endpoints-constant-speed-v1',
    distanceKm: 5,
    classification: 'hypothetical-not-eta' as const,
    assumptions: {
      endpointsFrozen: true as const,
      constantScenarioSpeed: true as const,
      accelerationBrakingOmitted: true as const,
      assistSpeedChangesOmitted: true as const,
      movementDuringTripOmitted: true as const,
    },
    warnings: ['CLEARANCE_UNVERIFIED'] as ['CLEARANCE_UNVERIFIED'],
    duration: { status: 'unavailable' as const, reason: 'SCENARIO_SPEED_NOT_SUPPLIED' as const },
    ...overrides,
  };
}

function pairedEstimate(overrides: Partial<PairedNavigationEstimate> = {}): PairedNavigationEstimate {
  return {
    success: true,
    association: 'same-response-direct-endpoints',
    estimate: supportedEstimate(),
    ...overrides,
  };
}

function predictedResponse(speed = 150): SolarSystemGetResponse {
  const state = supportedState({
    destination: { marketId: 'market-1', hostBodyId: 'pluto', positionKm: { x: 4, y: 5, z: 6 } },
    candidates: [{ bodyId: 'moon-1', positionKm: { x: 2, y: 8, z: 3 } }],
    provenance: {
      evaluationModelId: 'sol-catalog-kepler-position-v1',
      sourceRevision: 'a'.repeat(64),
      positionToleranceKm: 0.001,
    },
  });
  const prediction: SupportedNavigationPrediction = {
    status: 'supported',
    solarSystemId: 'sol',
    coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
    positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
    predictionModelId: 'constant-speed-straight-legs-moving-targets-v1',
    timeScaleId: 'stellar:unix-ms-uniform:v1',
    sourceRevision: 'a'.repeat(64),
    classification: 'illustrative-not-eta',
    scenarioCruiseSpeedKmPerSec: speed,
    speedProvenance: 'caller-supplied-scenario',
    departure: { ...state.departure, epochMs: state.epochMs },
    encounter: {
      bodyId: 'moon-1',
      epochMs: state.epochMs + 1000,
      positionKm: { x: 12, y: 8, z: 3 },
      convergence: { iterations: 3, residualMs: 0.5 },
    },
    arrival: {
      marketId: 'market-1',
      hostBodyId: 'pluto',
      epochMs: state.epochMs + 2000,
      positionKm: { x: 14, y: 15, z: 6 },
      hostPositionKm: { x: 14, y: 14, z: 6 },
      convergence: { iterations: 4, residualMs: 0.1 },
    },
    assumptions: {
      legDistanceStraightLine: true,
      constantScenarioSpeed: true,
      accelerationBrakingOmitted: true,
      gravityAndAssistEffectsOmitted: true,
      departureFixedAtNavigationEpoch: true,
      encounterAtBodyCenter: true,
    },
    warnings: ['CLEARANCE_UNVERIFIED'],
  };
  return {
    ...response(state),
    navigationPrediction: { success: true, association: 'same-response-navigation-sources', prediction },
  };
}

describe('ViewerNavigationPreviewService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it.each([120, 150, 10000])('pairs a prediction at %s km/s without passing speed to the direct estimate', (speed) => {
    const activeResponse = predictedResponse(speed);
    const getSolarSystem = vi.fn((_request: SolarSystemGetRequest, cb: (response: SolarSystemGetResponse) => void) =>
      cb(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }],
    });
    const service = TestBed.inject(ViewerNavigationPreviewService);
    service.start({ ...selection, candidateBodyId: 'moon-1' });
    expect(service.prediction().status).toBe('idle');
    service.calculatePrediction(speed);
    expect(getSolarSystem).toHaveBeenLastCalledWith(
      expect.objectContaining({
        navigationPrediction: { scenarioCruiseSpeedKmPerSec: speed },
        navigationEstimate: {},
        requestIdentity: { operation: 'solar-system-get', entityType: 'solar-system', containerId: 'sol' },
      }),
      expect.any(Function),
    );
    expect(service.prediction()).toEqual({
      status: 'ready',
      prediction: activeResponse.navigationPrediction?.prediction,
    });
    expect(service.preview()).toMatchObject({ status: 'ready', estimate: { status: 'ready', distanceKm: 5 } });
  });

  it.each([
    'revision',
    'basis',
    'model',
    'timeScale',
    'departure',
    'candidate',
    'host',
    'epochOrder',
    'horizon',
    'coordinates',
    'convergence',
    'assumptions',
    'speed',
  ])('rejects a mismatched/invalid prediction (%s) while retaining the same-response preview', (mismatch) => {
    const activeResponse = predictedResponse();
    const p = activeResponse.navigationPrediction!.prediction;
    if (p.status !== 'supported') throw new Error('Expected supported fixture');
    switch (mismatch) {
      case 'revision':
        p.sourceRevision = 'b'.repeat(64);
        break;
      case 'basis':
        delete (p as Partial<SupportedNavigationPrediction>).coordinateBasisId;
        break;
      case 'model':
        delete (p as Partial<SupportedNavigationPrediction>).positionEvaluationModelId;
        break;
      case 'timeScale':
        delete (p as Partial<SupportedNavigationPrediction>).timeScaleId;
        break;
      case 'departure':
        p.departure.positionKm = { x: 999, y: 2, z: 3 };
        break;
      case 'candidate':
        p.encounter.bodyId = 'different';
        break;
      case 'host':
        p.arrival.hostBodyId = 'different';
        break;
      case 'epochOrder':
        p.arrival.epochMs = p.departure.epochMs - 1;
        break;
      case 'horizon':
        p.arrival.epochMs = p.departure.epochMs + 315_576_000_001;
        break;
      case 'coordinates':
        p.encounter.positionKm.x = NaN;
        break;
      case 'convergence':
        p.arrival.convergence.residualMs = 2;
        break;
      case 'assumptions':
        delete (p as Partial<SupportedNavigationPrediction>).assumptions;
        break;
      case 'speed':
        p.scenarioCruiseSpeedKmPerSec = 120;
        break;
    }
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SolarSystemService,
          useValue: {
            getSolarSystem: (_request: SolarSystemGetRequest, cb: (r: SolarSystemGetResponse) => void) =>
              cb(activeResponse),
          },
        },
      ],
    });
    const service = TestBed.inject(ViewerNavigationPreviewService);
    service.start({ ...selection, candidateBodyId: 'moon-1' });
    service.calculatePrediction(150);
    expect(service.prediction()).toMatchObject({ status: 'unavailable', reason: 'PAIRED_PREDICTION_INVALID' });
    expect(service.preview()?.status).toBe('ready');
  });

  it('clears superseded predictions on edit, timeout, clear and invalid-session without accepting late replies', () => {
    vi.useFakeTimers();
    const callbacks: Array<(r: SolarSystemGetResponse) => void> = [];
    const cancel = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SolarSystemService,
          useValue: {
            getSolarSystem: (_request: SolarSystemGetRequest, cb: (r: SolarSystemGetResponse) => void) => {
              callbacks.push(cb);
              return cancel;
            },
          },
        },
      ],
    });
    const service = TestBed.inject(ViewerNavigationPreviewService);
    service.start({ ...selection, candidateBodyId: 'moon-1' });
    callbacks[0](predictedResponse());
    service.calculatePrediction(150);
    expect(service.prediction().status).toBe('loading');
    expect(service.preview()?.status).toBe('ready');
    service.clearPrediction();
    callbacks[1](predictedResponse());
    expect(service.prediction().status).toBe('idle');
    service.calculatePrediction(150);
    vi.advanceTimersByTime(15_000);
    expect(service.prediction()).toMatchObject({ status: 'unavailable', reason: 'PREDICTION_TIMEOUT' });
    callbacks[2](predictedResponse());
    expect(service.prediction().status).toBe('unavailable');
    service.calculatePrediction(150);
    service.invalidateSession();
    callbacks[3](predictedResponse());
    expect(service.preview()).toMatchObject({ status: 'error', reason: 'INVALID_SESSION' });
    expect(service.prediction().status).toBe('idle');
    expect(cancel).toHaveBeenCalled();
  });

  it('replaces an older success with a nested rejection and retains only its paired baseline', () => {
    let activeResponse = predictedResponse();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SolarSystemService,
          useValue: {
            getSolarSystem: (_request: SolarSystemGetRequest, cb: (r: SolarSystemGetResponse) => void) =>
              cb(activeResponse),
          },
        },
      ],
    });
    const service = TestBed.inject(ViewerNavigationPreviewService);
    service.start({ ...selection, candidateBodyId: 'moon-1' });
    service.calculatePrediction(150);
    expect(service.prediction().status).toBe('ready');
    activeResponse = {
      ...predictedResponse(),
      navigationPrediction: {
        success: false,
        association: 'same-response-navigation-sources',
        prediction: {
          status: 'unsupported',
          reason: 'PREDICTION_HORIZON_EXCEEDED',
          message: 'Prediction horizon exceeded.',
        },
      },
    };
    service.calculatePrediction(150);
    expect(service.prediction()).toEqual({
      status: 'unavailable',
      reason: 'PREDICTION_HORIZON_EXCEEDED',
      message: 'Prediction horizon exceeded.',
    });
    expect(service.preview()).toMatchObject({ status: 'ready', estimate: { status: 'ready', distanceKm: 5 } });
  });

  it('uses the opt-in request and accepts only matching projected positions', () => {
    const getSolarSystem = vi.fn(
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
        callback(response(supportedState())),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);

    expect(getSolarSystem).toHaveBeenCalledWith(
      expect.objectContaining({
        solarSystemId: 'sol',
        navigation: { shipId: 'ship-1', destinationMarketId: 'market-1' },
        navigationEstimate: {},
      }),
      expect.any(Function),
    );
    const state = preview.preview();
    expect(state?.status).toBe('ready');
    if (state?.status === 'ready') {
      expect(state.state.epochMs).toBe(1_794_694_161_611);
      expect(state.estimate).toEqual({ status: 'ready', distanceKm: 5 });
    }
  });

  it('keeps one optional candidate separate and rejects mismatched or ineligible responses', () => {
    let activeResponse = response(
      supportedState({
        candidates: [{ bodyId: 'moon-1', positionKm: { x: 2, y: 8, z: 3 } }],
      }),
    );
    const getSolarSystem = vi.fn(
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
        callback(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);
    preview.selectCandidate('moon-1');
    expect(getSolarSystem).toHaveBeenLastCalledWith(
      expect.objectContaining({
        navigation: { shipId: 'ship-1', destinationMarketId: 'market-1', candidateBodyId: 'moon-1' },
        navigationEstimate: {},
      }),
      expect.any(Function),
    );
    expect(preview.preview()?.status).toBe('ready');

    preview.selectCandidate('other-moon');
    expect(preview.preview()?.status).toBe('unsupported');

    activeResponse = response(
      supportedState({
        previewEligibility: { status: 'ineligible', reason: 'KNOWN_INVALID_DESTINATION' },
      }),
    );
    preview.start(selection);
    expect(preview.preview()?.status).toBe('ineligible');
  });

  it('keeps the paired estimate unavailable without discarding a supported preview', () => {
    const rejected = pairedEstimate({
      success: false,
      estimate: { status: 'failed', reason: 'ESTIMATE_NUMERIC_INVALID', message: 'Estimate failed.' },
    });
    const getSolarSystem = vi.fn(
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
        callback(response(supportedState(), rejected)),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);
    expect(preview.preview()).toMatchObject({
      status: 'ready',
      estimate: { status: 'unavailable', reason: 'ESTIMATE_NUMERIC_INVALID' },
    });
  });

  it('rejects a paired estimate whose epoch does not match the preview state', () => {
    let activeResponse = response(
      supportedState(),
      pairedEstimate({ estimate: supportedEstimate({ referenceEpochMs: 1_794_694_161_612 }) }),
    );
    const getSolarSystem = vi.fn(
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
        callback(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);
    expect(preview.preview()).toMatchObject({
      status: 'ready',
      estimate: { status: 'unavailable', reason: 'PAIRED_ESTIMATE_INVALID' },
    });
  });

  it('ignores a delayed response after the selection has been replaced', () => {
    const callbacks: Array<(response: SolarSystemGetResponse) => void> = [];
    const getSolarSystem = vi.fn(
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) => {
        callbacks.push(callback);
        return vi.fn();
      },
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);
    preview.start({ ...selection, destinationMarketId: 'market-2', destinationName: 'Port Two' });
    callbacks[0](response(supportedState()));
    expect(preview.preview()?.status).toBe('loading');

    callbacks[1](
      response(
        supportedState({
          destination: { marketId: 'market-2', positionKm: { x: 8, y: 9, z: 10 } },
        }),
      ),
    );
    expect(preview.preview()?.status).toBe('ready');
  });

  it('cancels a request and reports an error when the server does not respond', () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const getSolarSystem = vi.fn(() => cancel);
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);
    vi.advanceTimersByTime(15_000);
    expect(cancel).toHaveBeenCalledOnce();
    expect(preview.preview()?.status).toBe('error');
  });

  it('fails closed for missing eligibility and non-finite projected coordinates', () => {
    let activeResponse = response(supportedState());
    const getSolarSystem = vi.fn(
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
        callback(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SolarSystemService, useValue: { getSolarSystem } }, ViewerNavigationPreviewService],
    });
    const preview = TestBed.inject(ViewerNavigationPreviewService);

    activeResponse = response(
      supportedState({
        destination: { marketId: 'market-1', positionKm: { x: Number.NaN, y: 1, z: 2 } },
      }),
    );
    preview.start(selection);
    expect(preview.preview()?.status).toBe('unsupported');

    activeResponse = response(supportedState());
    delete (activeResponse.navigationState as Partial<SupportedNavigationPositionState>).previewEligibility;
    preview.start(selection);
    expect(preview.preview()?.status).toBe('unsupported');
  });
});
