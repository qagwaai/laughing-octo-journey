import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockMissionService, createMockSessionService, createMockSocketService } from '../../testing';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import { CELESTIAL_BODY_LIST_REQUEST_EVENT, CELESTIAL_BODY_LIST_RESPONSE_EVENT } from '../model/celestial-body-list';
import {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
} from '../model/market-list';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import { SHIP_LIST_BY_OWNER_REQUEST_EVENT, SHIP_LIST_BY_OWNER_RESPONSE_EVENT } from '../model/ship-list-by-owner';
import { MissionService } from '../services/mission.service';
import { SessionService } from '../services/session.service';
import { ShipExteriorAsteroidStateService } from '../services/ship-exterior-asteroid-state.service';
import { ShipExteriorMissionStateService } from '../services/ship-exterior-mission-state.service';
import { SocketService } from '../services/socket.service';
import { FloatingDebrisStateService } from '../services/floating-debris-state.service';
import { appLogger } from '../services/logger';
import ShipExteriorViewScene from './ship-exterior-view';

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName?: string };
  joinShip?: {
    id: string;
    model?: string;
    inventory?: Array<{ id: string; itemType: string; displayName?: string; launchable?: boolean; tier?: number }>;
    spatial?: { solarSystemId?: string; positionKm: { x: number; y: number; z: number } };
  };
  firstTargetMissionStatus?: string;
}

function createSocketMock() {
  return {
    ...createMockSocketService(),
    launchItem: jasmine.createSpy('launchItem'),
    upsertCelestialBody: jasmine.createSpy('upsertCelestialBody'),
    upsertItem: jasmine.createSpy('upsertItem'),
    listNearbyDeployedItems: jasmine.createSpy('listNearbyDeployedItems').and.returnValue(() => undefined),
  };
}

type MockSocketWithLaunch = ReturnType<typeof createSocketMock>;

/** Creates a minimal valid AsteroidScanSample for use in tests. */
function makeSample(id: string, overrides: Partial<AsteroidScanSample> = {}): AsteroidScanSample {
  return {
    id,
    serverCelestialBodyId: null,
    meshProfileKey: null,
    position: [0, 0, 0],
    basePosition: [0, 0, 0],
    scanProgress: 0,
    scanned: false,
    revealedMaterial: null,
    revealedKinematics: null,
    capturedKinematics: {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 1000,
      estimatedDiameterM: 10,
    },
    solarSystemLocation: { positionKm: { x: 0, y: 0, z: 0 } },
    clusterCenterKm: { x: 0, y: 0, z: 0 },
    motionPhase: 0,
    motionRate: 0.1,
    motionRadius: 0.05,
    bobAmplitude: 0.02,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function setup(state?: NavigationState) {
  const mockRouter = {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
  };
  const mockSocket = createSocketMock();
  const mockSession = createMockSessionService('test-session-key');
  const mockMission = createMockMissionService();
  const mockAsteroidState = {
    loadSamples: jasmine.createSpy('loadSamples').and.returnValue(null),
    saveSamples: jasmine.createSpy('saveSamples'),
    clearSamples: jasmine.createSpy('clearSamples'),
  };
  const mockMissionState = {
    loadState: jasmine.createSpy('loadState').and.returnValue(null),
    saveState: jasmine.createSpy('saveState'),
    clearState: jasmine.createSpy('clearState'),
    lastSaved: () => null,
  };

  TestBed.configureTestingModule({
    imports: [ShipExteriorViewScene],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: SocketService, useValue: mockSocket },
      { provide: SessionService, useValue: mockSession },
      { provide: MissionService, useValue: mockMission },
      { provide: ShipExteriorAsteroidStateService, useValue: mockAsteroidState },
      { provide: ShipExteriorMissionStateService, useValue: mockMissionState },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  TestBed.overrideComponent(ShipExteriorViewScene, { set: { imports: [], template: '' } });

  const fixture = TestBed.createComponent(ShipExteriorViewScene);
  fixture.detectChanges();

  return { component: fixture.componentInstance, fixture, mockSocket, mockSession, mockMission };
}

// ---------------------------------------------------------------------------
// describe('ShipExteriorViewScene')
// ---------------------------------------------------------------------------

describe('ShipExteriorViewScene', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (window as any).__shipExteriorTestUtils;
  });

  it('should expose default solar distance and scene position when navigation state is empty', () => {
    const { component } = setup();

    expect(component.shipSunDistanceKm()).toBeGreaterThan(0);
    expect(component.sunScenePosition().length).toBe(3);
  });

  it('should initialize shipSunDistanceKm from navigation ship spatial coordinates', () => {
    const { component } = setup({
      joinShip: {
        id: 's-distance',
        model: 'Scavenger Pod',
        spatial: {
          solarSystemId: 'sol',
          positionKm: { x: 3, y: 4, z: 12 },
        },
      },
    });

    expect(component.shipSunDistanceKm()).toBe(13);
  });

  it('should expose mission objective text when firstTargetMissionStatus is provided in navigation state', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'c-1', characterName: 'Nova Prime' },
      firstTargetMissionStatus: 'active',
    });

    expect(component.missionObjectiveText().length).toBeGreaterThan(0);
  });

  it('should enable targeting for Scavenger Pod with expendable-dart-drone inventory', () => {
    setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a')]);
    const result = api.forceTargetAsteroid('sample-a');

    expect(result).toBe(true);
    expect(api.getTargetedAsteroidId()).toBe('sample-a');
  });

  it('should scan every loaded asteroid to hero tier for dev testing', () => {
    const { component } = setup({
      joinShip: {
        id: 's-hero-all',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-hero-all', itemType: 'expendable-dart-drone' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a'), makeSample('sample-b')]);

    component.scanAllAsteroidsToHeroForTest();

    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    expect(samples.every((sample) => sample.scanned && sample.scanProgress === 100)).toBeTrue();
    expect(component.resolveAsteroidRenderTier('sample-a')).toBe('hero');
    expect(component.resolveAsteroidRenderTier('sample-b')).toBe('hero');
  });

  it('should scan every loaded asteroid to hero tier for dev testing after first-target completion without dart inventory', () => {
    const { component } = setup({
      joinShip: {
        id: 's-hero-all-complete',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-mining-laser', itemType: 'basic-mining-laser' }],
      },
      firstTargetMissionStatus: 'completed',
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-c'), makeSample('sample-d')]);

    component.scanAllAsteroidsToHeroForTest();

    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    expect(samples.every((sample) => sample.scanned && sample.scanProgress === 100)).toBeTrue();
    expect(component.resolveAsteroidRenderTier('sample-c')).toBe('hero');
    expect(component.resolveAsteroidRenderTier('sample-d')).toBe('hero');
  });

  it('should disable targeting for wrong model even with expendable-dart-drone inventory', () => {
    const { component } = setup({
      joinShip: {
        id: 's-2',
        model: 'Expendable Dart Ship',
        inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone' }],
      },
    });
    const api = (window as any).__shipExteriorTestUtils;
    const sampleId = api.getAsteroidSamples()[0]?.id as string | undefined;
    const result = sampleId ? api.forceTargetAsteroid(sampleId) : false;

    expect(result).toBe(false);
    expect(api.getTargetedAsteroidId()).toBeNull();
  });

  it('should disable targeting for Scavenger Pod without expendable-dart-drone inventory', () => {
    const { component } = setup({
      joinShip: {
        id: 's-3',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-2', itemType: 'basic-mining-laser' }],
      },
    });
    const api = (window as any).__shipExteriorTestUtils;
    const sampleId = api.getAsteroidSamples()[0]?.id as string | undefined;
    const result = sampleId ? api.forceTargetAsteroid(sampleId) : false;

    expect(result).toBe(false);
    expect(api.getTargetedAsteroidId()).toBeNull();
  });

  it('logs a contract warning when expendable dart drone is present but not launchable', () => {
    const warnSpy = spyOn(appLogger, 'warn');

    setup({
      joinShip: {
        id: 's-4',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-dart-1', itemType: 'expendable-dart-drone', launchable: false }],
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[ship-exterior-contract] Expendable Dart Drone present but no launchable drone available.',
      jasmine.objectContaining({
        source: 'navigation-state',
        shipId: 's-4',
        droneCount: 1,
      }),
    );
  });

  it('does not warn missing dart drone when a dart was just consumed by launch', () => {
    const warnSpy = spyOn(appLogger, 'warn');

    const { mockSocket } = setup({
      joinShip: {
        id: 's-5',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-dart-2', itemType: 'expendable-dart-drone', launchable: true }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.simulateLaunchItemResponse({
      success: true,
      message: 'ok',
      playerName: 'Pilot',
      correlationId: 'corr-1',
      requestIdentity: {
        operation: 'launch-item',
        entityType: 'ship-item',
        containerId: 's-5',
      },
      characterId: 'char-1',
      shipId: 's-5',
      targetCelestialBodyId: 'cb-1',
      hotkey: 1,
      itemId: 'i-dart-2',
      itemType: 'expendable-dart-drone',
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pilot',
      characterId: 'char-1',
      ships: [
        {
          id: 's-5',
          model: 'Scavenger Pod',
          inventory: [],
        },
      ],
    });

    const missingDroneWarningCalls = warnSpy.calls
      .allArgs()
      .filter((args) => args[0] === '[ship-exterior-contract] Scavenger Pod inventory missing Expendable Dart Drone.');
    expect(missingDroneWarningCalls.length).toBe(0);

    const emptyInventoryWarningCalls = warnSpy.calls
      .allArgs()
      .filter((args) => args[0] === '[ship-exterior-contract] Ship list response contains ship with empty inventory payload.');
    expect(emptyInventoryWarningCalls.length).toBe(0);
  });

  it('does not warn empty-inventory payload for explicit empty inventory array', () => {
    const warnSpy = spyOn(appLogger, 'warn');

    const { mockSocket } = setup({
      joinShip: {
        id: 's-6',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-dart-3', itemType: 'expendable-dart-drone', launchable: true }],
      },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pilot',
      characterId: 'char-1',
      ships: [
        {
          id: 's-6',
          model: 'Scavenger Pod',
          inventory: [],
        },
      ],
    });

    const emptyInventoryWarningCalls = warnSpy.calls
      .allArgs()
      .filter((args) => args[0] === '[ship-exterior-contract] Ship list response contains ship with empty inventory payload.');
    expect(emptyInventoryWarningCalls.length).toBe(0);
  });

  it('warns empty-inventory payload when legacy inventoryRefIds are present', () => {
    const warnSpy = spyOn(appLogger, 'warn');

    setup({
      joinShip: {
        id: 's-6b',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-dart-6b', itemType: 'expendable-dart-drone', launchable: true }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.simulateShipListTargetingCapabilityUpdate([
      {
        id: 's-6b',
        model: 'Scavenger Pod',
        inventory: [],
        inventoryRefIds: ['s-6b-dart-ref'],
      },
    ]);

    expect(warnSpy).toHaveBeenCalledWith(
      '[ship-exterior-contract] Ship list response contains ship with empty inventory payload.',
      jasmine.objectContaining({
        source: 'ship-list-response',
        shipId: 's-6b',
        inventoryRefIdsCount: 1,
      }),
    );
  });

  it('does not warn missing dart drone once first-target neutralize step is completed', () => {
    const warnSpy = spyOn(appLogger, 'warn');

    const { mockSocket } = setup({
      joinShip: {
        id: 's-7',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-dart-7', itemType: 'expendable-dart-drone', launchable: true }],
      },
      missionContext: {
        missionId: 'first-target',
      } as any,
    } as any);

    const api = (window as any).__shipExteriorTestUtils;
    api.setMissionGateState({
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab (requires 1 iron).',
      updatedAt: new Date().toISOString(),
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'active' },
        { key: 'repair_scavenger_pod', status: 'locked' },
      ],
    } as any);

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pilot',
      characterId: 'char-1',
      ships: [
        {
          id: 's-7',
          model: 'Scavenger Pod',
          inventory: [{ id: 'i-sensor', itemType: 'sensor-array', launchable: false }],
        },
      ],
    });

    const missingDroneWarningCalls = warnSpy.calls
      .allArgs()
      .filter((args) => args[0] === '[ship-exterior-contract] Scavenger Pod inventory missing Expendable Dart Drone.');
    expect(missingDroneWarningCalls.length).toBe(0);
  });

  it('should lock a single target after right-click hold when targeting is enabled', () => {
    const { fixture } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a2'), makeSample('sample-a4')]);
    fixture.detectChanges();

    api.forceTargetAsteroid('sample-a2');
    expect(api.getTargetedAsteroidId()).toBe('sample-a2');

    api.forceTargetAsteroid('sample-a4');
    expect(api.getTargetedAsteroidId()).toBe('sample-a4');
  });

  it('should not lock target when targeting is disabled', () => {
    const { fixture } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-1', itemType: 'basic-mining-laser' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a3')]);
    fixture.detectChanges();
    const result = api.forceTargetAsteroid('sample-a3');

    expect(result).toBe(false);
    expect(api.getTargetedAsteroidId()).toBeNull();
  });

  it('should resolve Sol sun config for sol solar system', () => {
    const { component } = setup({
      joinShip: { id: 's-1', spatial: { solarSystemId: 'sol', positionKm: { x: 0, y: 0, z: 0 } } },
    });
    expect(component.sunConfig()).toEqual(jasmine.objectContaining({ color: '#f5ff6b', radius: 1 }));
  });

  it('should fall back to Sol sun config for unknown solar systems', () => {
    const { component } = setup({
      joinShip: { id: 's-2', spatial: { solarSystemId: 'unknown-system', positionKm: { x: 0, y: 0, z: 0 } } },
    });
    expect(component.sunConfig()).toEqual(jasmine.objectContaining({ color: '#f5ff6b', radius: 1 }));
  });

  it('should place sun very far opposite ship location vector for asteroid belt distances', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        spatial: { solarSystemId: 'sol', positionKm: { x: 395000000, y: 1500000, z: -12000000 } },
      },
    });

    const [sunX, sunY, sunZ] = component.sunScenePosition();
    const sunDistance = Math.hypot(sunX, sunY, sunZ);
    expect(sunDistance).toBeGreaterThan(56);
    expect(sunDistance).toBeLessThanOrEqual(120);
    expect(Math.sign(sunX)).toBe(-1);
    expect(Math.sign(sunZ)).toBe(1);
  });

  it('should compute a low-intensity directional sun light in asteroid belt range', () => {
    const { component } = setup({
      joinShip: { id: 's-1', spatial: { solarSystemId: 'sol', positionKm: { x: 420000000, y: 0, z: 0 } } },
    });

    const intensity = component.solarDirectionalLightIntensity();
    expect(intensity).toBeGreaterThanOrEqual(0.02);
    expect(intensity).toBeLessThan(0.16);
    expect(intensity).toBeGreaterThan(0.05);
  });

  it('hydrates contract-backed gates, stations, and encounter ships from market route feed', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: {
        id: 'ship-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone', launchable: true }],
      },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [
        {
          id: 'ship-1',
          model: 'Scavenger Pod',
          inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone', launchable: true }],
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 100_000_000, y: 0, z: 0 },
            epochMs: 1,
          },
        },
      ],
    });

    const marketRequest = mockSocket.emittedEvents.find((entry) => entry.event === MARKET_LIST_BY_LOCATION_REQUEST_EVENT);
    expect(marketRequest).toBeDefined();

    triggerMatchingMarketListByLocationResponse(mockSocket, {
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 100_000_000, y: 0, z: 0 },
      distanceAu: 0.35,
      markets: [
        {
          marketId: 'market-1',
          solarSystemId: 'sol',
          marketName: 'Ceres Exchange',
          siteType: 'station',
          siteName: 'Ceres Main',
          isStarterMarket: true,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 100_010_000, y: 0, z: 0 },
            epochMs: 1,
          },
          trajectory: null,
          distanceAu: 0.01,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 0,
          restockIntervalMinutes: 60,
          route: {
            kind: 'gate-route',
            hops: 1,
            gates: [
              {
                gateId: 'gate-sol-ceres',
                sourceSystemId: 'sol',
                destSystemId: 'ceres',
                traversalCostAu: 0.5,
                traversalTimeHours: 1,
                spatial: {
                  solarSystemId: 'sol',
                  frame: 'barycentric',
                  positionKm: { x: 100_020_000, y: 0, z: 0 },
                  epochMs: 1,
                },
                descriptor: {
                  descriptorId: 'gates-ring-gate',
                  schemaVersion: 'sw-13-m0-v1',
                  domain: 'gates',
                  objectFamily: 'ring-gate',
                  roleCue: 'navigation',
                  factionCue: 'neutral',
                  fallbackTier: 'standard',
                  displayLabel: 'Sol-Ceres Gate',
                  silhouetteProfile: 'ring',
                  materialProfile: 'infrastructure',
                  emissiveProfile: 'navigation',
                },
                approachMetadata: {
                  approachCue: 'direct-centerline',
                  landmarkFraming: 'full-ring',
                  navBeaconCue: 'continuous',
                  hazardCue: 'low',
                  warningEscalation: 'none',
                  recommendedStandOffKm: 1400,
                  approachWindowKm: { min: 1000, max: 2200 },
                },
              },
            ],
            stations: [
              {
                marketId: 'station-sol-main',
                solarSystemId: 'sol',
                marketName: 'Sol Main Exchange',
                siteType: 'station',
                siteName: 'Sol Main',
                spatial: {
                  solarSystemId: 'sol',
                  frame: 'barycentric',
                  positionKm: { x: 100_030_000, y: 0, z: 0 },
                  epochMs: 1,
                },
                descriptor: {
                  descriptorId: 'stations-trade-hub',
                  schemaVersion: 'sw-13-m0-v1',
                  domain: 'stations',
                  objectFamily: 'trade-hub',
                  roleCue: 'landmark',
                  factionCue: 'neutral',
                  fallbackTier: 'standard',
                  displayLabel: 'Sol Main Station',
                  silhouetteProfile: 'hub',
                  materialProfile: 'industrial',
                  emissiveProfile: 'station',
                },
              },
            ],
            encounterShips: [
              {
                shipId: 'encounter-ship-1',
                shipName: 'Corsair',
                model: 'Raider',
                tier: 2,
                ownership: {
                  ownerType: 'npc-pirate',
                  npcId: 'npc-corsair',
                  factionId: 'faction-pirate',
                },
                spatial: {
                  solarSystemId: 'sol',
                  frame: 'barycentric',
                  positionKm: { x: 100_040_000, y: 0, z: 0 },
                  epochMs: 1,
                },
                descriptor: {
                  descriptorId: 'ships-frigate',
                  schemaVersion: 'sw-13-m0-v1',
                  domain: 'ships',
                  objectFamily: 'frigate',
                  roleCue: 'threat',
                  factionCue: 'pirate',
                  fallbackTier: 'standard',
                  displayLabel: 'Corsair',
                  silhouetteProfile: 'frigate',
                  materialProfile: 'military',
                  emissiveProfile: 'combat',
                },
              },
            ],
          },
        },
      ],
      isDocked: false,
      dockedMarketId: null,
    });

    const api = (window as any).__shipExteriorTestUtils;
    expect(api.getRouteFeedCounts()).toEqual({ gates: 1, stations: 1, encounterShips: 1 });
  });

  it('should expose five hotkey slots sorted alphabetically and capped to first five launchables', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [
          { id: 'i6', itemType: 'zeta-tool', displayName: 'Zeta Tool', launchable: true },
          { id: 'i1', itemType: 'alpha-tool', displayName: 'Alpha Tool', launchable: true },
          { id: 'i4', itemType: 'delta-tool', displayName: 'Delta Tool', launchable: true },
          { id: 'i3', itemType: 'gamma-tool', displayName: 'Gamma Tool', launchable: true },
          { id: 'i2', itemType: 'beta-tool', displayName: 'Beta Tool', launchable: true },
          { id: 'i5', itemType: 'epsilon-tool', displayName: 'Epsilon Tool', launchable: true },
          { id: 'ix', itemType: 'locked-tool', displayName: 'Locked Tool', launchable: false },
        ],
      },
    });

    // Set a target with a serverCelestialBodyId so hotkeys are enabled
    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a2', { serverCelestialBodyId: 'server-cb-1' })]);
    api.setTargetedAsteroidId('sample-a2');
    fixture.detectChanges();

    const slots = api.getLaunchHotkeySlots() as Array<{ label: string; enabled: boolean }>;
    expect(slots.map((slot) => slot.label)).toEqual([
      'Alpha Tool',
      'Beta Tool',
      'Delta Tool',
      'Epsilon Tool',
      'Gamma Tool',
    ]);
    expect(slots.every((slot) => slot.enabled)).toBe(true);
  });

  it('should show empty slots when fewer than five launchables exist', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [
          { id: 'i1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone', launchable: true },
          { id: 'i2', itemType: 'survey-probe', displayName: 'Survey Probe', launchable: true },
        ],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    const slots = api.getLaunchHotkeySlots() as Array<{ label: string; enabled: boolean }>;
    expect(slots.map((slot) => slot.label)).toEqual(['Expendabl...', 'Survey Probe', 'empty', 'empty', 'empty']);
    expect(slots.every((slot) => !slot.enabled)).toBe(true);
  });

  it('should ignore hotkeys until an asteroid target exists', () => {
    const { component, fixture, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [
          { id: 'i-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone', launchable: true },
        ],
      },
    });
    mockSocket.connected = true;

    // No target yet — keydown should not trigger launch
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(mockSocket.launchItem).not.toHaveBeenCalled();

    // Set a target with serverCelestialBodyId so hotkeys become enabled
    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a4', { serverCelestialBodyId: 'server-cb-4' })]);
    api.forceTargetAsteroid('sample-a4');
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(mockSocket.launchItem).toHaveBeenCalledTimes(1);
  });

  it('should support both top-row and numpad hotkeys', () => {
    const { component, fixture, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: {
        id: 's-1',
        model: 'Scavenger Pod',
        inventory: [
          { id: 'i-1', itemType: 'alpha-drone', displayName: 'Alpha Drone', launchable: true },
          { id: 'i-2', itemType: 'beta-drone', displayName: 'Beta Drone', launchable: true },
        ],
      },
    });
    mockSocket.connected = true;

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a5', { serverCelestialBodyId: 'server-cb-5' })]);
    api.setTargetedAsteroidId('sample-a5');
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad1' }));

    expect(mockSocket.launchItem).toHaveBeenCalledTimes(2);
    const calls = mockSocket.launchItem.calls.allArgs();
    expect(calls[0][0]).toEqual(jasmine.objectContaining({ hotkey: 2 }));
    expect(calls[1][0]).toEqual(jasmine.objectContaining({ hotkey: 1 }));
  });

  it('should remove destroyed target immediately on target-destroyed launch response', () => {
    const { component, fixture, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: {
        id: 'ship-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone', launchable: true }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a3'), makeSample('sample-a1')]);
    api.setTargetedAsteroidId('sample-a3');
    fixture.detectChanges();

    api.simulateLaunchItemResponse({
      success: true,
      message: 'Launch successful: target destroyed and materials yielded',
      correlationId: '00000000-0000-4000-8000-000000000005',
      requestIdentity: { operation: 'test-op', entityType: 'test-entity', containerId: 'test-container' },
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'sample-a3',
      hotkey: 1,
      itemId: 'i-1',
      itemType: 'expendable-dart-drone',
      resolution: {
        outcome: 'target-destroyed',
        targetDestroyed: true,
        yieldedMaterials: [],
        yieldedItems: [],
        launchSeed: 123456789,
      },
    });

    expect((api.getAsteroidSamples() as AsteroidScanSample[]).some((s) => s.id === 'sample-a3')).toBe(false);
    expect(api.getTargetedAsteroidId()).toBeNull();
    expect(api.getActiveScanAsteroidId()).toBeNull();
    expect(component.activeLaunchToast()).toEqual(jasmine.objectContaining({ tone: 'success' }));
  });

  it('should immediately add raw iron to active ship inventory on successful Iron asteroid launch', () => {
    const { component, fixture, mockSocket, mockSession } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: {
        id: 'ship-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone', launchable: true }],
      },
    });

    mockSession.setActiveShip({
      id: 'ship-1',
      name: 'Starter Pod',
      model: 'Scavenger Pod',
      tier: 1,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: Date.now(),
      },
      inventory: [{ id: 'i-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone' } as any],
    } as any);

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([
      makeSample('sample-a3', {
        serverCelestialBodyId: 'sample-a3',
        revealedMaterial: { material: 'Iron', rarity: 'Common', textureColor: '#8f99a7' },
        scanned: true,
      }),
    ]);
    api.setTargetedAsteroidId('sample-a3');
    fixture.detectChanges();

    api.simulateLaunchItemResponse({
      success: true,
      message: 'Target destroyed',
      correlationId: '00000000-0000-4000-8000-000000000005',
      requestIdentity: { operation: 'test-op', entityType: 'test-entity', containerId: 'test-container' },
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'sample-a3',
      hotkey: 1,
      itemId: 'i-1',
      itemType: 'expendable-dart-drone',
      resolution: {
        outcome: 'target-destroyed',
        targetDestroyed: true,
        yieldedMaterials: [{ material: 'Iron', rarity: 'Common', quantity: 3 }],
        yieldedItems: [],
        launchSeed: 123,
      },
    });

    const updatedInventory = mockSession.activeShip()?.inventory ?? [];
    const rawIronItems = updatedInventory.filter((item) => item.itemType === 'iron');
    expect(rawIronItems.length).toBe(1);
    expect(rawIronItems[0]?.displayName).toBe('Iron');
    expect(mockSocket.upsertItem).toHaveBeenCalled();
  });

  it('should keep target when no-effect and set success toast', () => {
    const { component, fixture, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a2')]);
    api.setTargetedAsteroidId('sample-a2');
    fixture.detectChanges();

    api.simulateLaunchItemResponse({
      success: true,
      message: 'Launch completed with no effect',
      correlationId: '00000000-0000-4000-8000-000000000005',
      requestIdentity: { operation: 'test-op', entityType: 'test-entity', containerId: 'test-container' },
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'sample-a2',
      hotkey: 1,
      itemId: 'i-1',
      itemType: 'basic-mining-laser',
      resolution: {
        outcome: 'no-effect',
        targetDestroyed: false,
        yieldedMaterials: [],
        yieldedItems: [],
        launchSeed: 222,
      },
    });

    expect((api.getAsteroidSamples() as AsteroidScanSample[]).some((s) => s.id === 'sample-a2')).toBe(true);
    expect(api.getTargetedAsteroidId()).toBe('sample-a2');
    expect(component.activeLaunchToast()?.tone).toBe('success');
  });

  it('should set error toast on failed launch response', () => {
    const { component, fixture, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    fixture.detectChanges();

    const api = (window as any).__shipExteriorTestUtils;
    api.simulateLaunchItemResponse({
      success: false,
      message: 'Launch item is not launchable',
      correlationId: '00000000-0000-4000-8000-000000000005',
      requestIdentity: { operation: 'test-op', entityType: 'test-entity', containerId: 'test-container' },
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'sample-a4',
      hotkey: 1,
      itemId: 'i-1',
      itemType: 'basic-tool',
    });

    expect(component.activeLaunchToast()).toEqual(
      jasmine.objectContaining({ tone: 'error', message: 'Launch item is not launchable' }),
    );
  });

  it('should trim character name with surrounding spaces', () => {
    const { component } = setup({
      joinCharacter: { id: 'c-1', characterName: '  Echo  ' },
    });
    const api = (window as any).__shipExteriorTestUtils;
    expect(api.getCharacterName()).toBe('Echo');
  });

  it('should fallback character name to Unbound when blank', () => {
    const { component } = setup({
      joinCharacter: { id: 'c-2', characterName: '   ' },
    });
    const api = (window as any).__shipExteriorTestUtils;
    expect(api.getCharacterName()).toBe('Unbound');
  });

  it('should seed asteroid samples via socket on initialization', () => {
    const { component, mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    // Trigger ship list response with no ships (causes fallback seeding)
    triggerMatchingShipListResponse(mockSocket, {
      success: false,
      message: 'no ships',
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [],
    });

    const api = (window as any).__shipExteriorTestUtils;
    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    expect(samples.length).toBeGreaterThanOrEqual(5);
  });

  it('should progress active asteroid scan one step per tick', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 'scanner-ship-1',
        model: 'Scavenger Pod',
        inventory: [{ id: 'sensor-1', itemType: 'sensor-array' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a2'), makeSample('sample-a1')]);
    fixture.detectChanges();

    api.hoverAsteroid('sample-a2');
    const samples = api.tickScanTicks(3);

    const target = samples.find((s: AsteroidScanSample) => s.id === 'sample-a2');
    expect(target?.scanProgress).toBeGreaterThan(0);
    expect(target?.scanned).toBe(false);
  });

  it('should complete asteroid scan after one hundred ticks', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 'scanner-ship-2',
        model: 'Scavenger Pod',
        inventory: [{ id: 'sensor-2', itemType: 'sensor-array' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a4')]);
    fixture.detectChanges();

    api.hoverAsteroid('sample-a4');
    const samples = api.tickScanTicks(100);

    const target = samples.find((s: AsteroidScanSample) => s.id === 'sample-a4');
    expect(target?.scanProgress).toBe(100);
    expect(target?.scanned).toBe(true);
  });

  it('should use the highest installed sensor-array tier for scan speed', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 'scanner-ship-tiered',
        model: 'Scavenger Pod',
        inventory: [
          { id: 'sensor-low', itemType: 'sensor-array', tier: 1 },
          { id: 'sensor-high', itemType: 'sensor-array', tier: 20 },
        ],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-tiered')]);
    fixture.detectChanges();

    api.hoverAsteroid('sample-tiered');
    const samples = api.tickScanTicks(24);

    const target = samples.find((sample: AsteroidScanSample) => sample.id === 'sample-tiered');
    expect(target?.scanProgress).toBe(100);
    expect(target?.scanned).toBe(true);
    expect(api.getActiveSensorArrayTier()).toBe(20);
  });

  it('should reset scan progress when cursor leaves active asteroid', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 'scanner-ship-3',
        model: 'Scavenger Pod',
        inventory: [{ id: 'sensor-3', itemType: 'sensor-array' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a1')]);
    fixture.detectChanges();

    api.hoverAsteroid('sample-a1');
    api.tickScanTicks(1);
    api.unhoverAsteroid('sample-a1');

    expect(api.getActiveScanAsteroidId()).toBeNull();
    const sample = (api.getAsteroidSamples() as AsteroidScanSample[]).find((s) => s.id === 'sample-a1');
    expect(sample?.scanProgress).toBe(0);
  });

  it('should reset previous asteroid progress when switching hover targets', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 'scanner-ship-4',
        model: 'Scavenger Pod',
        inventory: [{ id: 'sensor-4', itemType: 'sensor-array' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a1'), makeSample('sample-a3')]);
    fixture.detectChanges();

    api.hoverAsteroid('sample-a1');
    api.tickScanTicks(12);
    api.hoverAsteroid('sample-a3');

    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    const previous = samples.find((s) => s.id === 'sample-a1');
    const active = samples.find((s) => s.id === 'sample-a3');
    expect(previous?.scanProgress).toBe(0);
    expect(api.getActiveScanAsteroidId()).toBe('sample-a3');
    expect(active?.scanProgress).toBe(0);
  });

  it('should report complete status when all asteroid scans finish', () => {
    const { component, fixture } = setup();

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([
      makeSample('sample-a1', { scanProgress: 100, scanned: true }),
      makeSample('sample-a2', { scanProgress: 100, scanned: true }),
      makeSample('sample-a3', { scanProgress: 100, scanned: true }),
      makeSample('sample-a4', { scanProgress: 100, scanned: true }),
      makeSample('sample-a5', { scanProgress: 100, scanned: true }),
    ]);
    fixture.detectChanges();

    expect(api.getScanStatusLine()).toBe('SCAN COMPLETE // ALL 5 SAMPLES CATALOGUED');
  });

  it('should block hover scanning and show an error toast when no sensor-array is installed', () => {
    const { component, fixture } = setup({
      joinShip: {
        id: 'scanner-ship-5',
        model: 'Scavenger Pod',
        inventory: [{ id: 'tool-1', itemType: 'basic-mining-laser' }],
      },
    });

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a1')]);
    fixture.detectChanges();

    api.hoverAsteroid('sample-a1');
    api.tickScanTicks(5);

    expect(api.getActiveScanAsteroidId()).toBeNull();
    expect((api.getAsteroidSamples() as AsteroidScanSample[])[0]?.scanProgress).toBe(0);
    expect(api.getActiveLaunchToast()?.message).toContain('Sensor array unavailable');
    expect(api.getActiveLaunchToast()?.tone).toBe('error');
  });

  it('should suppress hover scanning while flight mode is enabled', () => {
    const { component, fixture } = setup();

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([makeSample('sample-a1')]);
    fixture.detectChanges();

    component.setFlightModeEnabled(true);

    api.hoverAsteroid('sample-a1');
    api.tickScanTicks(8);

    expect(api.getActiveScanAsteroidId()).toBeNull();
    expect((api.getAsteroidSamples() as AsteroidScanSample[])[0]?.scanProgress).toBe(0);
  });

  it('should update ship location using quantized flight checkpoints', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        spatial: { solarSystemId: 'sol', positionKm: { x: 0, y: 0, z: 0 } },
      },
    });

    component.setFlightModeEnabled(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let index = 0; index < 6; index += 1) {
      (component as any)['flightController']['tickFlight']();
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    const api = (window as any).__shipExteriorTestUtils;
    const location = api.getActiveShipLocationKm() as { x: number; y: number; z: number } | null;
    expect(location).not.toBeNull();
    expect(Math.abs(location!.z)).toBeGreaterThan(0);
    expect(Math.abs(location!.z % 10)).toBe(0);
  });

  it('should disable flight mode when pointer lock is released', () => {
    const { component } = setup({
      joinShip: {
        id: 's-1',
        spatial: { solarSystemId: 'sol', positionKm: { x: 0, y: 0, z: 0 } },
      },
    });

    component.setFlightModeEnabled(true);

    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      value: null,
    });
    document.dispatchEvent(new Event('pointerlockchange'));

    expect(component.flightModeEnabled()).toBeFalse();
    expect(component.flightPointerLocked()).toBeFalse();
  });

  it('should expose SW-13B metadata lines for the focused asteroid sample', () => {
    const { fixture } = setup();

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([
      makeSample('sample-a1', {
        sw13bSeedId: 'sw13b-m0b-B-iron-001',
        sw13bGeneratorVersion: 'sw13b-codegen-v1',
        sw13bParameterBundleHash: 'sha256:abc123',
        sw13bProfilePreset: 'baseline',
        sw13bTargetSurfaces: ['SV', 'SEV'],
        sw13bValidationStatus: 'validated',
      }),
    ]);
    api.setTargetedAsteroidId('sample-a1');
    fixture.detectChanges();

    const sw13 = api.getSw13DebugText() as {
      seed: string;
      tier: string;
      generator: string;
      bundleHash: string;
      profilePreset: string;
      surfaces: string;
      validation: string;
    };
    expect(sw13.seed).toBe('SW13 SEED // sw13b-m0b-B-iron-001');
    expect(sw13.tier).toBe('SW13 TIER // B');
    expect(sw13.generator).toBe('SW13 GEN // sw13b-codegen-v1');
    expect(sw13.bundleHash).toBe('SW13 BUNDLE // sha256:abc123');
    expect(sw13.profilePreset).toBe('SW13 PROFILE // baseline');
    expect(sw13.surfaces).toBe('SW13 SURFACES // SV,SEV');
    expect(sw13.validation).toBe('SW13 VALIDATION // validated');
  });

  it('should report SW-13B parity counts across generated asteroid samples', () => {
    const { fixture } = setup();

    const api = (window as any).__shipExteriorTestUtils;
    api.setAsteroidSamples([
      makeSample('sample-a1', {
        sw13bSeedId: 'sw13b-m0b-B-iron-001',
        sw13bGeneratorVersion: 'sw13b-codegen-v1',
        sw13bParameterBundleHash: 'sha256:h1',
        sw13bProfilePreset: 'baseline',
        sw13bTargetSurfaces: ['SV', 'SEV'],
        sw13bValidationStatus: 'validated',
      }),
      makeSample('sample-a2', {
        sw13bSeedId: 'sw13b-m0b-H-iron-002',
        sw13bGeneratorVersion: 'sw13b-codegen-v1',
        sw13bParameterBundleHash: 'sha256:h2',
        sw13bProfilePreset: 'hero',
        sw13bTargetSurfaces: ['SV'],
        sw13bValidationStatus: 'validated',
      }),
      makeSample('sample-a3'),
    ]);
    fixture.detectChanges();

    const sw13 = api.getSw13DebugText() as { paritySummary: string };
    expect(sw13.paritySummary).toBe(
      'SW13 PARITY // TOTAL 3 // B 1 // H 1 // SV 2 // SEV 1 // META 2/3',
    );
  });
});

// ---------------------------------------------------------------------------
// describe('ColdBootScanScene in-progress seeding')
// ---------------------------------------------------------------------------

describe('ColdBootScanScene in-progress seeding', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (window as any).__shipExteriorTestUtils;
  });

  it('should request celestial bodies after ship list response (default resume seeding path)', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod', spatial: { positionKm: { x: 1e8, y: 0, z: 0 } } }],
    });

    const cbRequest = mockSocket.emittedEvents.find((e) => e.event === CELESTIAL_BODY_LIST_REQUEST_EVENT);
    expect(cbRequest).toBeDefined();
  });

  it('should not request celestial bodies for fresh-seed (AVAILABLE status) path', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
      firstTargetMissionStatus: 'available',
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod', spatial: { positionKm: { x: 1e8, y: 0, z: 0 } } }],
    });

    const cbRequest = mockSocket.emittedEvents.find((e) => e.event === CELESTIAL_BODY_LIST_REQUEST_EVENT);
    expect(cbRequest).toBeUndefined();
  });

  it('should fall back to random seeding when auth context is missing', () => {
    setup();
    // No playerName, characterId, or session key — falls back immediately

    mockSocket_triggerIfRegistered((window as any).__shipExteriorTestUtils, SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: false,
      message: 'no auth',
      ships: [],
    });

    // The fallback samples are produced synchronously before socket calls
    // (component has no auth context, so it seeds fallback immediately)
    // Check that asteroidSamples is populated after init
    const api = (window as any).__shipExteriorTestUtils;
    expect((api.getAsteroidSamples() as AsteroidScanSample[]).length).toBeGreaterThanOrEqual(5);
  });

  it('should fall back to random seeding when ship has no location', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod' }], // no spatial
    });

    const api = (window as any).__shipExteriorTestUtils;
    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    expect(samples.length).toBeGreaterThanOrEqual(5);
    expect(samples.every((s) => !s.scanned)).toBe(true);
  });

  it('should mark fetched celestial bodies as already-scanned in the merged set', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod', spatial: { positionKm: { x: 1e8, y: 0, z: 0 } } }],
    });

    const existingBody = {
      id: 'cb-1',
      catalogId: 'cat-1',
      sourceScanId: '',
      createdByCharacterId: 'char-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spatial: { solarSystemId: 'sol', positionKm: { x: 1e8, y: 0, z: 0 } },
      observability: { scanState: 'scanned' as const },
      composition: { rarity: 'Rare' as const, material: 'Nickel-Iron', textureColor: '#8df7b2' },
      state: 'active' as const,
      distanceKm: 1.5,
    };

    triggerMatchingCelestialBodyListResponse(mockSocket, {
      celestialBodies: [existingBody],
    });

    const api = (window as any).__shipExteriorTestUtils;
    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    const scannedSamples = samples.filter((s) => s.scanned);
    expect(scannedSamples.length).toBeGreaterThanOrEqual(1);
    expect(scannedSamples[0].revealedMaterial).toEqual(jasmine.objectContaining({ material: 'Nickel-Iron' }));
  });

  it('should leave top-up asteroids as unscanned fresh samples', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod', spatial: { positionKm: { x: 1e8, y: 0, z: 0 } } }],
    });

    const existingBody = {
      id: 'cb-1',
      catalogId: 'cat-1',
      sourceScanId: '',
      createdByCharacterId: 'char-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spatial: { solarSystemId: 'sol', positionKm: { x: 1e8, y: 0, z: 0 } },
      observability: { scanState: 'scanned' as const },
      composition: { rarity: 'Common' as const, material: 'Silicate', textureColor: '#aabbcc' },
      state: 'active' as const,
      distanceKm: 0.5,
    };

    triggerMatchingCelestialBodyListResponse(mockSocket, {
      celestialBodies: [existingBody],
    });

    const api = (window as any).__shipExteriorTestUtils;
    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    expect(samples[0].scanned).toBe(true);
    const topUp = samples.slice(1);
    expect(topUp.length).toBeGreaterThan(0);
    expect(topUp.every((s) => !s.scanned && s.scanProgress === 0)).toBe(true);
  });

  it('should produce at least as many samples as existing bodies when random target is smaller', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod', spatial: { positionKm: { x: 1e8, y: 0, z: 0 } } }],
    });

    const manyBodies = Array.from({ length: 8 }, (_, i) => ({
      id: `cb-${i}`,
      catalogId: `cat-${i}`,
      sourceScanId: '',
      createdByCharacterId: 'char-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spatial: { solarSystemId: 'sol', positionKm: { x: 1e8 + i * 1000, y: 0, z: 0 } },
      observability: { scanState: 'scanned' as const },
      composition: { rarity: 'Common' as const, material: 'Rock', textureColor: '#aaa' },
      state: 'active' as const,
      distanceKm: i,
    }));

    triggerMatchingCelestialBodyListResponse(mockSocket, {
      celestialBodies: manyBodies,
    });

    // total = max(existingBodies.length=8, randomTarget>=5) >= 8
    const api = (window as any).__shipExteriorTestUtils;
    expect((api.getAsteroidSamples() as AsteroidScanSample[]).length).toBeGreaterThanOrEqual(8);
  });

  it('should include all unscanned top-up samples when random target exceeds existing count', () => {
    const { mockSocket } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    triggerMatchingShipListResponse(mockSocket, {
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [{ id: 'ship-1', model: 'Scavenger Pod', spatial: { positionKm: { x: 1e8, y: 0, z: 0 } } }],
    });

    triggerMatchingCelestialBodyListResponse(mockSocket, {
      celestialBodies: [
        {
          id: 'cb-1',
          catalogId: 'cat-1',
          sourceScanId: '',
          createdByCharacterId: 'char-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          spatial: { solarSystemId: 'sol', positionKm: { x: 1e8, y: 0, z: 0 } },
          observability: { scanState: 'scanned' as const },
          composition: { rarity: 'Common' as const, material: 'Rock', textureColor: '#aaa' },
          state: 'active' as const,
          distanceKm: 1,
        },
      ],
    });

    const api = (window as any).__shipExteriorTestUtils;
    const samples = api.getAsteroidSamples() as AsteroidScanSample[];
    // 1 existing body + ≥4 random top-up (randomTarget ≥ 5)
    expect(samples.length).toBeGreaterThanOrEqual(5);
    expect(samples.filter((s) => !s.scanned).length).toBeGreaterThanOrEqual(4);
  });
});

/** Utility: trigger a socket event only if the listener is registered (avoids false failures). */
function mockSocket_triggerIfRegistered(_api: unknown, _event: string, _data: unknown): void {
  // no-op: used only where needed; the real trigger happens via mockSocket.triggerEvent
}

function triggerMatchingShipListResponse(mockSocket: MockSocketWithLaunch, overrides: Record<string, unknown>): void {
  const request = [...mockSocket.emittedEvents]
    .reverse()
    .find((entry) => entry.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
    | { correlationId?: string; requestIdentity?: unknown }
    | undefined;

  mockSocket.triggerEvent(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
    success: true,
    message: '',
    correlationId: request?.correlationId,
    requestIdentity: request?.requestIdentity,
    ...overrides,
  });
}

function triggerMatchingCelestialBodyListResponse(
  mockSocket: MockSocketWithLaunch,
  overrides: Record<string, unknown>,
): void {
  const request = [...mockSocket.emittedEvents]
    .reverse()
    .find((entry) => entry.event === CELESTIAL_BODY_LIST_REQUEST_EVENT)?.data as
    | { correlationId?: string; requestIdentity?: unknown }
    | undefined;

  mockSocket.triggerEvent(CELESTIAL_BODY_LIST_RESPONSE_EVENT, {
    success: true,
    message: '',
    correlationId: request?.correlationId,
    requestIdentity: request?.requestIdentity,
    ...overrides,
  });
}

function triggerMatchingMarketListByLocationResponse(
  mockSocket: MockSocketWithLaunch,
  overrides: Record<string, unknown>,
): void {
  const request = [...mockSocket.emittedEvents]
    .reverse()
    .find((entry) => entry.event === MARKET_LIST_BY_LOCATION_REQUEST_EVENT)?.data as
    | { correlationId?: string; requestIdentity?: unknown }
    | undefined;

  mockSocket.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
    success: true,
    message: '',
    correlationId: request?.correlationId,
    requestIdentity: request?.requestIdentity,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// describe('ShipExteriorViewScene - subscription cleanup (ngOnDestroy)')
// ---------------------------------------------------------------------------

describe('ShipExteriorViewScene - subscription cleanup (ngOnDestroy)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (window as any).__shipExteriorTestUtils;
  });

  it('should call all three unsubscribe functions when they are assigned', () => {
    const { component, fixture } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    const unsubShip = jasmine.createSpy('unsubscribeShipListResponse');
    const unsubCelestial = jasmine.createSpy('unsubscribeCelestialBodyListResponse');
    const unsubLaunch = jasmine.createSpy('unsubscribeLaunchItemResponse');

    component['unsubscribeShipListResponse'] = unsubShip;
    component['unsubscribeCelestialBodyListResponse'] = unsubCelestial;
    component['unsubscribeLaunchItemResponse'] = unsubLaunch;

    fixture.destroy();

    expect(unsubShip).toHaveBeenCalledTimes(1);
    expect(unsubCelestial).toHaveBeenCalledTimes(1);
    expect(unsubLaunch).toHaveBeenCalledTimes(1);
  });

  it('should not throw when unsubscribe functions have not been assigned', () => {
    const { component, fixture } = setup();

    component['unsubscribeShipListResponse'] = undefined;
    component['unsubscribeCelestialBodyListResponse'] = undefined;
    component['unsubscribeLaunchItemResponse'] = undefined;

    expect(() => fixture.destroy()).not.toThrow();
  });

  it('should call unsubscribe functions each time destroy is called', () => {
    const { component } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
      joinShip: { id: 'ship-1', model: 'Scavenger Pod', inventory: [] },
    });

    const unsubShip = jasmine.createSpy('unsubscribeShipListResponse');
    component['unsubscribeShipListResponse'] = unsubShip;
    component['ngOnDestroy']();

    // Reassign after first destroy and call again directly
    component['unsubscribeShipListResponse'] = unsubShip;
    component['ngOnDestroy']();

    expect(unsubShip).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// describe('ShipExteriorViewScene - backend status reset guard')
// ---------------------------------------------------------------------------

describe('ShipExteriorViewScene - backend status reset guard', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (window as any).__shipExteriorTestUtils;
  });

  it('should not reset local gate progress when backend returns AVAILABLE and partial progress exists', async () => {
    const { mockMission } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    const api = (window as any).__shipExteriorTestUtils;

    const partialProgressState: ShipExteriorMissionGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective',
      updatedAt: new Date().toISOString(),
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'active' },
        { key: 'repair_scavenger_pod', status: 'locked' },
      ],
    };
    api.setMissionGateState(partialProgressState);

    mockMission.listMissions.and.resolveTo({
      status: 'loaded',
      missions: [{ missionId: 'first-target', status: 'available' }],
    });

    await api.refreshMissionGateStateFromBackend();

    expect(api.getMissionGateState()).toEqual(partialProgressState);
  });

  it('should reset to initial gate state when AVAILABLE status arrives and there is no local progress yet', async () => {
    const { mockMission } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    const api = (window as any).__shipExteriorTestUtils;

    const freshState: ShipExteriorMissionGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective',
      updatedAt: new Date().toISOString(),
      steps: [
        { key: 'identify_iron_asteroid', status: 'active' },
        { key: 'neutralize_identified_asteroid', status: 'locked' },
        { key: 'manufacture_hull_patch_kit', status: 'locked' },
        { key: 'repair_scavenger_pod', status: 'locked' },
      ],
    };
    api.setMissionGateState(freshState);

    mockMission.listMissions.and.resolveTo({
      status: 'loaded',
      missions: [{ missionId: 'first-target', status: 'available' }],
    });

    await api.refreshMissionGateStateFromBackend();

    const updated = api.getMissionGateState();
    expect(updated?.steps[0].status).toBe('active');
    expect(updated?.steps[1].status).toBe('locked');
  });

  it('should reset stale fully-completed gate state when backend reports AVAILABLE without statusDetail', async () => {
    const { mockMission } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    const api = (window as any).__shipExteriorTestUtils;

    const allCompletedState: ShipExteriorMissionGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective',
      updatedAt: new Date().toISOString(),
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'completed' },
        { key: 'repair_scavenger_pod', status: 'completed' },
      ],
    };
    api.setMissionGateState(allCompletedState);

    mockMission.listMissions.and.resolveTo({
      status: 'loaded',
      missions: [{ missionId: 'first-target', status: 'available' }],
    });

    await api.refreshMissionGateStateFromBackend();

    const updated = api.getMissionGateState();
    expect(updated?.steps[0].status).toBe('active');
    expect(updated?.steps[1].status).toBe('locked');
  });

  it('should preserve fully-completed local gate state when backend reports ACTIVE without statusDetail', async () => {
    const { mockMission } = setup({
      playerName: 'Pioneer',
      joinCharacter: { id: 'char-1' },
    });
    const api = (window as any).__shipExteriorTestUtils;

    const allCompletedState: ShipExteriorMissionGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Mission objectives complete. Await further directives.',
      updatedAt: new Date().toISOString(),
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'completed' },
        { key: 'repair_scavenger_pod', status: 'completed' },
      ],
    };
    api.setMissionGateState(allCompletedState);

    mockMission.listMissions.and.resolveTo({
      status: 'loaded',
      missions: [{ missionId: 'first-target', status: 'active' }],
    });

    await api.refreshMissionGateStateFromBackend();

    expect(api.getMissionGateState()).toEqual(allCompletedState);
  });
});

// ---------------------------------------------------------------------------
// describe('ShipExteriorViewScene - tractor beam')
// ---------------------------------------------------------------------------

describe('ShipExteriorViewScene - tractor beam', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (window as any).__shipExteriorTestUtils;
  });

  function seedDebris(component: any, id: string, positionKm: { x: number; y: number; z: number }, displayName = 'Tractor Beam') {
    const stateService = component['floatingDebrisStateService'] as FloatingDebrisStateService;
    stateService.upsertLocal([
      { id, itemType: 'ship-tractor-beam', displayName, positionKm },
    ]);
    return stateService;
  }

  function shipNavState(positionKm = { x: 0, y: 0, z: 0 }): NavigationState {
    return {
      playerName: 'Pilot',
      joinCharacter: { id: 'char-1', characterName: 'Nova' },
      joinShip: {
        id: 'ship-1',
        model: 'Scavenger Pod',
        spatial: { solarSystemId: 'sol', positionKm },
      },
    };
  }

  function shipNavStateWithInventory(inventory: Array<Record<string, unknown>>, positionKm = { x: 0, y: 0, z: 0 }): NavigationState {
    const baseJoinShip = shipNavState(positionKm).joinShip!;
    return {
      ...shipNavState(positionKm),
      joinShip: {
        ...baseJoinShip,
        inventory: inventory as any,
      },
    };
  }

  it('beginTargetHold (asteroid path) syncs activeTarget and clears debris target', () => {
    const { component } = setup({
      ...shipNavState(),
      joinShip: {
        ...shipNavState().joinShip!,
        inventory: [{ id: 'sensor-20', itemType: 'sensor-array', tier: 20 }],
      },
    });
    component['targetedDebrisId'].set('debris-x');

    // Force the session controller's hold callback to run synchronously.
    spyOn(component['sessionController'], 'beginTargetHold').and.callFake(
      (_id: string, onConfirm: () => void, holdMs: number) => {
        expect(holdMs).toBe(2400);
        onConfirm();
      },
    );

    component['beginTargetHold']('asteroid-1');

    expect(component['targetedAsteroidId']()).toBe('asteroid-1');
    expect(component['targetedDebrisId']()).toBeNull();
    expect(component['activeTarget']()).toEqual({ kind: 'asteroid', id: 'asteroid-1' });
  });

  it('beginDebrisTargetHold syncs activeTarget and clears asteroid target', () => {
    const { component } = setup({
      ...shipNavState(),
      joinShip: {
        ...shipNavState().joinShip!,
        inventory: [{ id: 'sensor-12', itemType: 'sensor-array', tier: 12 }],
      },
    });
    component['targetedAsteroidId'].set('asteroid-x');

    spyOn(component['sessionController'], 'beginTargetHold').and.callFake(
      (_id: string, onConfirm: () => void, holdMs: number) => {
        expect(holdMs).toBe(5600);
        onConfirm();
      },
    );

    component['beginDebrisTargetHold']('debris-1');

    expect(component['targetedDebrisId']()).toBe('debris-1');
    expect(component['targetedAsteroidId']()).toBeNull();
    expect(component['activeTarget']()).toEqual({ kind: 'debris', id: 'debris-1' });
  });

  it('beginDebrisTargetHold surfaces the debris as the active hold candidate before lock', () => {
    const { component } = setup({
      ...shipNavState(),
      joinShip: {
        ...shipNavState().joinShip!,
        inventory: [{ id: 'sensor-12', itemType: 'sensor-array', tier: 12 }],
      },
    });

    spyOn(component['sessionController'], 'beginTargetHold').and.callFake(
      (id: string, _onConfirm: () => void, _holdMs: number) => {
        (component as any)['sessionController']['targetHoldCandidate'].set(id);
      },
    );

    component['beginDebrisTargetHold']('debris-1');

    expect(component['targetHoldCandidateId']()).toBe('debris-1');
  });

  it('beginTargetHold blocks asteroid targeting and toasts when no sensor array is installed', () => {
    const { component } = setup(shipNavState());
    const beginTargetHoldSpy = spyOn(component['sessionController'], 'beginTargetHold');

    component['beginTargetHold']('asteroid-1');

    expect(beginTargetHoldSpy).not.toHaveBeenCalled();
    expect(component['activeLaunchToast']()?.message).toContain('Sensor array unavailable');
    expect(component['activeLaunchToast']()?.tone).toBe('error');
  });

  it('beginDebrisTargetHold blocks debris targeting and toasts when no sensor array is installed', () => {
    const { component } = setup(shipNavState());
    const beginTargetHoldSpy = spyOn(component['sessionController'], 'beginTargetHold');

    component['beginDebrisTargetHold']('debris-1');

    expect(beginTargetHoldSpy).not.toHaveBeenCalled();
    expect(component['activeLaunchToast']()?.message).toContain('Sensor array unavailable');
    expect(component['activeLaunchToast']()?.tone).toBe('error');
  });

  it('tryActivateTractorBeam toasts and exits when no debris is targeted', () => {
    const { component, mockSocket } = setup(shipNavState());
    component['activeTarget'].set(null);

    component['tryActivateTractorBeam']();

    expect(mockSocket.upsertItem).not.toHaveBeenCalled();
    expect(component['activeLaunchToast']()?.message).toContain('Lock a debris target');
    expect(component['activeLaunchToast']()?.tone).toBe('error');
  });

  it('tryActivateTractorBeam refuses targets beyond tier-scaled range', () => {
    const { component, mockSocket } = setup(
      shipNavStateWithInventory([{ id: 'beam-1', itemType: 'ship-tractor-beam', tier: 1, damageStatus: 'intact' }]),
    );
    seedDebris(component, 'debris-far', { x: 10.5, y: 0, z: 0 });
    component['targetedDebrisId'].set('debris-far');
    component['activeTarget'].set({ kind: 'debris', id: 'debris-far' });

    component['tryActivateTractorBeam']();

    expect(mockSocket.upsertItem).not.toHaveBeenCalled();
    expect(component['activeLaunchToast']()?.message).toContain('Out of tractor range');
    expect(component['activeLaunchToast']()?.tone).toBe('error');
  });

  it('tryActivateTractorBeam uses the highest intact-only tractor beam tier for range', () => {
    const { component, mockSocket } = setup(
      shipNavStateWithInventory([
        { id: 'beam-disabled', itemType: 'ship-tractor-beam', tier: 20, damageStatus: 'disabled' },
        { id: 'beam-intact', itemType: 'ship-tractor-beam', tier: 12, damageStatus: 'intact' },
      ]),
    );
    seedDebris(component, 'debris-mid', { x: 20, y: 0, z: 0 });
    component['targetedDebrisId'].set('debris-mid');
    component['activeTarget'].set({ kind: 'debris', id: 'debris-mid' });

    component['tryActivateTractorBeam']();

    expect(component['activeTractorBeamCapabilities']()?.tier).toBe(12);
    expect(component['activeLaunchToast']()?.message).toContain('Out of tractor range');
    expect(mockSocket.upsertItem).not.toHaveBeenCalled();
  });

  it('tryActivateTractorBeam blocks when only non-intact tractor beams are installed', () => {
    const { component, mockSocket } = setup(
      shipNavStateWithInventory([{ id: 'beam-disabled', itemType: 'ship-tractor-beam', tier: 20, damageStatus: 'disabled' }]),
    );
    seedDebris(component, 'debris-near', { x: 5, y: 0, z: 0 });
    component['targetedDebrisId'].set('debris-near');
    component['activeTarget'].set({ kind: 'debris', id: 'debris-near' });

    component['tryActivateTractorBeam']();

    expect(component['activeLaunchToast']()?.message).toContain('Tractor beam unavailable');
    expect(component['activeLaunchToast']()?.tone).toBe('error');
    expect(component['tractorBeamCapabilityText']()).toBe('TRACTOR EQ: DAMAGED // REPAIR REQUIRED');
    expect(component['tractorBeamTimingText']()).toBe('TRACTOR PULL: REPAIR REQUIRED');
    expect(mockSocket.upsertItem).not.toHaveBeenCalled();
  });

  it('tryActivateTractorBeam waits for pull duration before committing upsertItem', () => {
    const { component, fixture, mockSocket } = setup(
      shipNavStateWithInventory([{ id: 'beam-20', itemType: 'ship-tractor-beam', tier: 20, damageStatus: 'intact' }]),
    );
    component['missionGateState'].set({
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab (requires 1 iron).',
      updatedAt: '2026-05-25T00:00:00.000Z',
      steps: [
        { key: 'identify_iron_asteroid', status: 'completed' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'active' },
        { key: 'repair_scavenger_pod', status: 'locked' },
      ],
    });
    const stateService = component['floatingDebrisStateService'] as FloatingDebrisStateService;
    stateService.clear();
    stateService.upsertLocal([
      {
        id: 'debris-near',
        itemType: 'ship-tractor-beam',
        displayName: 'Tractor Beam',
        positionKm: { x: 5, y: 0, z: 0 },
      },
    ]);
    component['targetedDebrisId'].set('debris-near');
    component['activeTarget'].set({ kind: 'debris', id: 'debris-near' });

    component['tryActivateTractorBeam']();

    // Debris should still exist during the pull animation.
    expect(stateService.getAll().find((d) => d.id === 'debris-near')).toBeDefined();
    expect(mockSocket.upsertItem).not.toHaveBeenCalled();

    const pullState = component['tractorBeamAnimationState']()!;
    component['tractorBeamAnimationState'].set({
      ...pullState,
      phaseStartedAtMs: Date.now() - 1100,
    });
    component['tickTractorBeamAnimation']();

    expect(mockSocket.upsertItem).not.toHaveBeenCalled();

    component['tractorBeamAnimationState'].set({
      ...component['tractorBeamAnimationState']()!,
      phaseStartedAtMs: Date.now() - 1300,
    });
    component['tickTractorBeamAnimation']();

    expect(mockSocket.upsertItem).toHaveBeenCalledTimes(1);
    const [request, callback] = mockSocket.upsertItem.calls.mostRecent().args;
    expect(request.item.id).toBe('debris-near');
    expect(request.item.itemType).toBe('ship-tractor-beam');
    expect(request.item.displayName).toBe('Tractor Beam');
    expect(request.item.state).toBe('contained');
    expect(request.item.container).toEqual({ containerType: 'ship', containerId: 'ship-1' });
    expect(request.item.owningPlayerId).toBe('Pilot');
    expect(request.item.owningCharacterId).toBe('char-1');
    expect(request.correlationSource).toBe('ship-exterior.tractor-beam');

    callback({ success: true, message: 'ok', correlationId: 'c-1' });
    fixture.detectChanges();

    expect(stateService.getAll().find((d) => d.id === 'debris-near')).toBeUndefined();
    expect(component['targetedDebrisId']()).toBeNull();
    expect(component['activeTarget']()).toBeNull();
    expect(component['activeLaunchToast']()?.message).toContain('Collected: Tractor Beam');
    expect(component['activeLaunchToast']()?.tone).toBe('success');
    expect(component['missionGateState']()?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe(
      'active',
    );
  });

  it('tryActivateTractorBeam reverses pull and keeps debris when the server rejects', () => {
    const { component, mockSocket } = setup(
      shipNavStateWithInventory([{ id: 'beam-20', itemType: 'ship-tractor-beam', tier: 20, damageStatus: 'intact' }]),
    );
    const stateService = seedDebris(component, 'debris-rb', { x: 1, y: 0, z: 0 }, 'Tractor Beam');
    component['targetedDebrisId'].set('debris-rb');
    component['activeTarget'].set({ kind: 'debris', id: 'debris-rb' });

    component['tryActivateTractorBeam']();
    const pullState = component['tractorBeamAnimationState']()!;
    component['tractorBeamAnimationState'].set({
      ...pullState,
      phaseStartedAtMs: Date.now() - 3500,
    });
    component['tickTractorBeamAnimation']();
    const [, callback] = mockSocket.upsertItem.calls.mostRecent().args;
    callback({ success: false, message: 'item not found', correlationId: 'c-2' });

    const reverseState = component['tractorBeamAnimationState']()!;
    component['tractorBeamAnimationState'].set({
      ...reverseState,
      phaseStartedAtMs: Date.now() - 800,
    });
    component['tickTractorBeamAnimation']();

    expect(stateService.getAll().find((d) => d.id === 'debris-rb')).toBeDefined();
    expect(component['activeLaunchToast']()?.message).toContain('Tractor beam failed: item not found');
    expect(component['activeLaunchToast']()?.tone).toBe('error');
  });

  it('onDebrisRightPointerDown ignores left-button events', () => {
    const { component } = setup(shipNavState());
    component['onDebrisRightPointerDown']({ id: 'debris-1', button: 0 });
    expect(component['activeTarget']()).toBeNull();
  });

  it('KeyE in flight mode does not trigger the tractor beam', () => {
    const { component, mockSocket } = setup(shipNavState({ x: 0, y: 0, z: 0 }));
    seedDebris(component, 'debris-flight', { x: 1, y: 0, z: 0 });
    component.setFlightModeEnabled(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));

    expect(mockSocket.upsertItem).not.toHaveBeenCalled();
  });

  it('onDebrisHoverChange sets hoveredDebrisId on hovering=true', () => {
    const { component } = setup(shipNavState());
    seedDebris(component, 'debris-h', { x: 2, y: 0, z: 0 });
    component['onDebrisHoverChange']({ id: 'debris-h', hovering: true });
    expect(component['hoveredDebrisId']()).toBe('debris-h');
    expect(component['showPropertiesPanel']()).toBeTrue();
    expect(component['showDebrisProperties']()).toBeTrue();
  });

  it('onDebrisHoverChange clears hoveredDebrisId only for the matching id', () => {
    const { component } = setup(shipNavState());
    component['hoveredDebrisId'].set('debris-a');
    component['onDebrisHoverChange']({ id: 'debris-b', hovering: false });
    expect(component['hoveredDebrisId']()).toBe('debris-a');
    component['onDebrisHoverChange']({ id: 'debris-a', hovering: false });
    expect(component['hoveredDebrisId']()).toBeNull();
  });

  it('debris properties text computeds reflect the hovered debris', () => {
    const { component } = setup(
      shipNavStateWithInventory(
        [{ id: 'beam-20', itemType: 'ship-tractor-beam', tier: 20, damageStatus: 'intact' }],
        { x: 0, y: 0, z: 0 },
      ),
    );
    const service = component['floatingDebrisStateService'] as FloatingDebrisStateService;
    service.upsertLocal([
      {
        id: 'debris-props',
        itemType: 'ship-tractor-beam',
        displayName: 'Tractor Beam',
        positionKm: { x: 3, y: 4, z: 0 },
        state: 'deployed',
        damageStatus: 'intact',
      },
    ]);
    component['onDebrisHoverChange']({ id: 'debris-props', hovering: true });
    expect(component['debrisPropertiesItemTypeText']()).toBe('ITEM TYPE: SHIP-TRACTOR-BEAM');
    expect(component['debrisPropertiesNameText']()).toBe('NAME: Tractor Beam');
    expect(component['debrisPropertiesPositionText']()).toBe('POS KM: X 3.0 Y 4.0 Z 0.0');
    expect(component['debrisPropertiesDistanceText']()).toBe('DIST KM: 5.0');
    expect(component['debrisPropertiesStateText']()).toBe('STATE: DEPLOYED // DAMAGE: INTACT');
    expect(component['showTractorBeamCapabilityDetails']()).toBeTrue();
    expect(component['tractorBeamCapabilityText']()).toBe('TRACTOR EQ: T20 // RANGE 25.0 KM');
    expect(component['tractorBeamTimingText']()).toBe('TRACTOR PULL: 1200 MS');
    expect(component['propertiesPanelTitle']()).toBe('TRACTOR BEAM // PROPERTIES');
  });

  it('debris properties fall back to --- when state/damage absent or ship pos unknown', () => {
    const { component } = setup(shipNavState());
    seedDebris(component, 'debris-fallback', { x: 1, y: 0, z: 0 });
    component['activeShipLocationKm'].set(null);
    component['onDebrisHoverChange']({ id: 'debris-fallback', hovering: true });
    expect(component['debrisPropertiesDistanceText']()).toBe('DIST KM: ---');
    expect(component['debrisPropertiesStateText']()).toBe('STATE: --- // DAMAGE: ---');
    expect(component['showTractorBeamCapabilityDetails']()).toBeTrue();
    expect(component['tractorBeamCapabilityText']()).toBe('TRACTOR EQ: T1 // RANGE 10.0 KM');
    expect(component['tractorBeamTimingText']()).toBe('TRACTOR PULL: 10000 MS');
  });

  it('debris properties show repair-required tractor details when only non-intact beams are installed', () => {
    const { component } = setup(
      shipNavStateWithInventory([{ id: 'beam-disabled', itemType: 'ship-tractor-beam', tier: 20, damageStatus: 'disabled' }]),
    );
    seedDebris(component, 'debris-disabled', { x: 1, y: 0, z: 0 }, 'Tractor Beam');

    component['onDebrisHoverChange']({ id: 'debris-disabled', hovering: true });

    expect(component['showTractorBeamCapabilityDetails']()).toBeTrue();
    expect(component['tractorBeamCapabilityText']()).toBe('TRACTOR EQ: DAMAGED // REPAIR REQUIRED');
    expect(component['tractorBeamTimingText']()).toBe('TRACTOR PULL: REPAIR REQUIRED');
  });
});
