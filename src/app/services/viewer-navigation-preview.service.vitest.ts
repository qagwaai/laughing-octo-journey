import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  NavigationRouteEstimate,
  PairedNavigationEstimate,
  SolarSystemGetRequest,
  SolarSystemGetResponse,
  SupportedNavigationPositionState,
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

function supportedState(
  overrides: Partial<SupportedNavigationPositionState> = {},
): SupportedNavigationPositionState {
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

function pairedEstimate(
  overrides: Partial<PairedNavigationEstimate> = {},
): PairedNavigationEstimate {
  return {
    success: true,
    association: 'same-response-direct-endpoints',
    estimate: supportedEstimate(),
    ...overrides,
  };
}

describe('ViewerNavigationPreviewService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('uses the opt-in request and accepts only matching projected positions', () => {
    const getSolarSystem = vi.fn((_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
      callback(response(supportedState())),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
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
    const getSolarSystem = vi.fn((_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
      callback(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
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
    const getSolarSystem = vi.fn((_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
      callback(response(supportedState(), rejected)),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
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
      (_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) => callback(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
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
    const getSolarSystem = vi.fn((_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) => {
      callbacks.push(callback);
      return vi.fn();
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
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
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
    });

    const preview = TestBed.inject(ViewerNavigationPreviewService);
    preview.start(selection);
    vi.advanceTimersByTime(15_000);
    expect(cancel).toHaveBeenCalledOnce();
    expect(preview.preview()?.status).toBe('error');
  });

  it('fails closed for missing eligibility and non-finite projected coordinates', () => {
    let activeResponse = response(supportedState());
    const getSolarSystem = vi.fn((_request: SolarSystemGetRequest, callback: (response: SolarSystemGetResponse) => void) =>
      callback(activeResponse),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SolarSystemService, useValue: { getSolarSystem } },
        ViewerNavigationPreviewService,
      ],
    });
    const preview = TestBed.inject(ViewerNavigationPreviewService);

    activeResponse = response(supportedState({
      destination: { marketId: 'market-1', positionKm: { x: Number.NaN, y: 1, z: 2 } },
    }));
    preview.start(selection);
    expect(preview.preview()?.status).toBe('unsupported');

    activeResponse = response(supportedState());
    delete (activeResponse.navigationState as Partial<SupportedNavigationPositionState>).previewEligibility;
    preview.start(selection);
    expect(preview.preview()?.status).toBe('unsupported');
  });
});
