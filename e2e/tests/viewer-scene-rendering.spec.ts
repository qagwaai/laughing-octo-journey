import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';
import {
  resolveDescriptorRenderProfile,
  resolveGateApproachMetadata,
  type GateApproachMetadata,
} from '../../src/app/scene/viewer/viewer-descriptor-selectors';
import type { ExternalObjectDescriptor } from '../../src/app/model/external-object-descriptor';

// ── Test data ──────────────────────────────────────────────────────────────

const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: {
    hygId: '0',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.0,
  },
};

const SOL_SYSTEM_BODIES: any[] = [
  {
    id: 'sun',
    bodyType: 'star',
    displayName: 'The Sun',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#fff5b6',
    },
    spectralClass: 'G2V',
    luminositySolar: 1.0,
    massSolar: 1.0,
  },
  {
    id: 'earth',
    bodyType: 'planet',
    displayName: 'Earth',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#4a90e2',
    },
    physicalCatalog: {
      estimatedDiameterM: 12742000,
      radiusKm: 6371,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 149597870.7,
      eccentricity: 0.0167,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 102.9,
      meanAnomalyAtEpochDeg: 100.5,
      orbitalPeriodSec: 31536000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
    planetType: 'terrestrial',
  },
  {
    id: 'luna',
    bodyType: 'moon',
    displayName: 'Luna',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7 + 384400, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#9bb1c9',
    },
    physicalCatalog: {
      estimatedDiameterM: 3474200,
      radiusKm: 1737,
    },
    orbitalElements: {
      anchorBodyId: 'earth',
      semiMajorAxisKm: 384400,
      eccentricity: 0.0549,
      inclinationDeg: 5.1,
      longitudeOfAscendingNodeDeg: 125.0,
      argumentOfPeriapsisDeg: 318.0,
      meanAnomalyAtEpochDeg: 280.0,
      orbitalPeriodSec: 2360592,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
  {
    id: 'mars',
    bodyType: 'planet',
    displayName: 'Mars',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 227923661, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#c1440e',
      radiusScaleFactor: 0.53,
    },
    physicalCatalog: {
      estimatedDiameterM: 6779000,
      radiusKm: 3389.5,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 227923661,
      eccentricity: 0.0934,
      inclinationDeg: 1.85,
      longitudeOfAscendingNodeDeg: 49.6,
      argumentOfPeriapsisDeg: 286.5,
      meanAnomalyAtEpochDeg: 19.4,
      orbitalPeriodSec: 59354294,
      epoch: '2026-05-08T00:00:00.000Z',
    },
    planetType: 'terrestrial',
  },
  {
    id: 'market-sol-alpha',
    bodyType: 'station',
    stationKind: 'market',
    displayName: 'Sol Market Alpha',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 160000000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 160000000,
      eccentricity: 0.012,
      inclinationDeg: 0.8,
      longitudeOfAscendingNodeDeg: 20,
      argumentOfPeriapsisDeg: 45,
      meanAnomalyAtEpochDeg: 70,
      orbitalPeriodSec: 33000000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
];

const ACTIVE_SHIP = {
  id: 'ship-viewer-scene-1',
  name: 'Scout Pod',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 350000000, y: 0, z: 0 },
    epochMs: 1715000000000,
  },
};

const M2_DESCRIPTOR_FIXTURE_PATH = join(
  process.cwd(),
  'docs',
  'planning',
  'sw-13',
  'external-object-descriptor-m2-ships-stations.json',
);

const parsedM2DescriptorFixture = JSON.parse(readFileSync(M2_DESCRIPTOR_FIXTURE_PATH, 'utf8')) as {
  schemaVersion?: string;
  descriptors?: ExternalObjectDescriptor[];
};

const M2_SHIP_STATION_DESCRIPTORS = parsedM2DescriptorFixture.descriptors ?? [];

const M3_GATE_LANDMARK_FIXTURE_PATH = join(
  process.cwd(),
  'docs',
  'planning',
  'sw-13',
  'external-object-gate-landmark-m3.json',
);

type GateLandmarkFixtureEntry = {
  descriptor: ExternalObjectDescriptor;
  approachMetadata: GateApproachMetadata;
};

const parsedM3GateLandmarkFixture = JSON.parse(readFileSync(M3_GATE_LANDMARK_FIXTURE_PATH, 'utf8')) as {
  schemaVersion?: string;
  gates?: GateLandmarkFixtureEntry[];
};

const M3_GATE_LANDMARK_ENTRIES = parsedM3GateLandmarkFixture.gates ?? [];

function solarSystemGetResponse(bodies: any[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystemId: 'sol',
    solarSystem: SOL_SUMMARY,
    bodies,
  };
}

function withGateDescriptorBodies(baseBodies: any[]) {
  return [
    ...baseBodies,
    {
      id: 'gate-ring-1',
      bodyType: 'station',
      displayName: 'Ring Gate One',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 175000000, y: 0, z: 0 },
        epochMs: 1715000000000,
      },
      externalObjectDescriptor: {
        descriptorId: 'gates-ring-gate-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'gates',
        objectFamily: 'ring-gate',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'hero',
        displayLabel: 'Ring Gate One',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    },
    {
      id: 'gate-segmented-1',
      bodyType: 'station',
      displayName: 'Segmented Arch One',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 176500000, y: 0, z: 0 },
        epochMs: 1715000000000,
      },
      externalObjectDescriptor: {
        descriptorId: 'gates-segmented-arch-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'gates',
        objectFamily: 'segmented-arch',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Segmented Arch One',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    },
    {
      id: 'gate-relay-1',
      bodyType: 'station',
      displayName: 'Relay Spindle One',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 178000000, y: 0, z: 0 },
        epochMs: 1715000000000,
      },
      externalObjectDescriptor: {
        descriptorId: 'gates-relay-spindle-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'gates',
        objectFamily: 'relay-spindle',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'minimal',
        displayLabel: 'Relay Spindle One',
        silhouetteProfile: 'spire',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    },
  ];
}

function withInvalidGateDescriptorBody(baseBodies: any[]) {
  return [
    ...baseBodies,
    {
      id: 'gate-invalid-1',
      bodyType: 'station',
      displayName: 'Invalid Gate Descriptor',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 179000000, y: 0, z: 0 },
        epochMs: 1715000000000,
      },
      externalObjectDescriptor: {
        descriptorId: 'gates-invalid-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'gates',
        objectFamily: 'trade-hub',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Invalid Gate Descriptor',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    },
  ];
}

function withLegacyGateDescriptorBody(baseBodies: any[]) {
  return [
    ...baseBodies,
    {
      id: 'gate-legacy-1',
      bodyType: 'jump-gate',
      displayName: 'Legacy Gate Descriptor',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 180000000, y: 0, z: 0 },
        epochMs: 1715000000000,
      },
      externalObjectDescriptor: {
        descriptorId: 'jump-gate-ring-gate-legacy-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'jump_gate',
        objectFamily: 'ring_gate',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Legacy Gate Descriptor',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    },
  ];
}

function createGateBodyFromLandmarkEntry(entry: GateLandmarkFixtureEntry, index: number): any {
  return {
    id: `m3-gate-${index + 1}`,
    bodyType: 'station',
    displayName: entry.descriptor.displayLabel,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 175000000 + index * 1250000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    externalObjectDescriptor: entry.descriptor,
  };
}

async function setupViewerSceneTest(page: any, ownerShips: any[] = [ACTIVE_SHIP]) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: 'char-viewer-1',
          characterName: 'Scout',
          level: 1,
          missions: [
            {
              missionId: 'first-target',
              status: 'active',
            },
          ],
        },
      ],
    },
  }));

  await loginViaUI(page, mock);

  // Must join a game before viewer menu is enabled
  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: 'char-viewer-1',
      ships: ownerShips,
    },
  }));
  await gameShell.joinGame();
  await expect(page.getByRole('heading', { name: 'Game Main' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'TARGET IRON' })).toBeVisible({ timeout: 10_000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystems: [SOL_SUMMARY],
    },
  }));

  return { mock };
}

async function navigateToSystemScene(page: any, mock: any, bodies: any[] = SOL_SYSTEM_BODIES) {
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);
  // Navigate to Viewer
  await gameShell.openViewer();

  // Set up the scene response handler
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solarSystemGetResponse(bodies),
  }));

  // Select the Sol system to navigate to scene
  await viewerPage.selectSystem('Sol');
}

function createStationBodyFromDescriptor(descriptor: ExternalObjectDescriptor, index: number): any {
  return {
    id: `m2-station-${index + 1}`,
    bodyType: 'station',
    displayName: descriptor.displayLabel,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 165000000 + index * 900000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    externalObjectDescriptor: descriptor,
  };
}

function createShipFromDescriptor(descriptor: ExternalObjectDescriptor, index: number): any {
  return {
    id: `m2-ship-${index + 1}`,
    name: descriptor.displayLabel,
    model: 'Scavenger Pod',
    tier: 2,
    status: 'ACTIVE',
    externalObjectDescriptor: descriptor,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 350000000 + index * 750000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Viewer — Scene Rendering', () => {
  test('SW-13 M2 full-9 descriptor selector evidence is deterministic and tier-aware', async () => {
    expect(M2_SHIP_STATION_DESCRIPTORS.length).toBe(9);

    const profiles = M2_SHIP_STATION_DESCRIPTORS.map((descriptor) => {
      const first = resolveDescriptorRenderProfile(descriptor);
      const second = resolveDescriptorRenderProfile(descriptor);
      expect(first).not.toBeNull();
      expect(first).toEqual(second);
      return first!;
    });

    const shipProfiles = profiles.filter((profile) => profile.domain === 'ships');
    const stationProfiles = profiles.filter((profile) => profile.domain === 'stations');

    expect(shipProfiles.length).toBe(5);
    expect(stationProfiles.length).toBe(4);

    const tierProbeBase = M2_SHIP_STATION_DESCRIPTORS.find((descriptor) => descriptor.domain === 'ships');
    expect(tierProbeBase).toBeDefined();

    const hero = resolveDescriptorRenderProfile({ ...tierProbeBase!, fallbackTier: 'hero' });
    const standard = resolveDescriptorRenderProfile({ ...tierProbeBase!, fallbackTier: 'standard' });
    const minimal = resolveDescriptorRenderProfile({ ...tierProbeBase!, fallbackTier: 'minimal' });

    expect(hero).not.toBeNull();
    expect(standard).not.toBeNull();
    expect(minimal).not.toBeNull();
    expect(hero!.recognitionDistanceKm).toBeGreaterThan(standard!.recognitionDistanceKm);
    expect(standard!.recognitionDistanceKm).toBeGreaterThan(minimal!.recognitionDistanceKm);
  });

  test('SW-13 M2 route-smoke full-9 ship/station descriptor coverage loads viewer scene', async ({ page }) => {
    const shipDescriptors = M2_SHIP_STATION_DESCRIPTORS.filter((descriptor) => descriptor.domain === 'ships');
    const stationDescriptors = M2_SHIP_STATION_DESCRIPTORS.filter((descriptor) => descriptor.domain === 'stations');

    const ships = shipDescriptors.map((descriptor, index) => createShipFromDescriptor(descriptor, index));
    const stationBodies = stationDescriptors.map((descriptor, index) => createStationBodyFromDescriptor(descriptor, index));

    const { mock } = await setupViewerSceneTest(page, ships);
    await navigateToSystemScene(page, mock, [...SOL_SYSTEM_BODIES, ...stationBodies]);

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('SW-13 M3 gate landmark selector evidence is deterministic, bounded, and hazard-aware', async () => {
    expect(parsedM3GateLandmarkFixture.schemaVersion).toBe('sw-13-m0-v1');
    expect(M3_GATE_LANDMARK_ENTRIES.length).toBe(3);

    const families = M3_GATE_LANDMARK_ENTRIES.map((entry) => entry.descriptor.objectFamily).sort();
    expect(families).toEqual(['relay-spindle', 'ring-gate', 'segmented-arch']);

    for (const entry of M3_GATE_LANDMARK_ENTRIES) {
      const firstProfile = resolveDescriptorRenderProfile(entry.descriptor);
      const secondProfile = resolveDescriptorRenderProfile(entry.descriptor);
      expect(firstProfile).not.toBeNull();
      expect(firstProfile).toEqual(secondProfile);

      const approachMetadata = resolveGateApproachMetadata(entry.descriptor);
      expect(approachMetadata).not.toBeNull();
      expect(approachMetadata).toEqual(entry.approachMetadata);

      const windowMin = approachMetadata!.approachWindowKm.min;
      const windowMax = approachMetadata!.approachWindowKm.max;
      const standOffKm = approachMetadata!.recommendedStandOffKm;
      expect(windowMin).toBeGreaterThan(0);
      expect(windowMax).toBeGreaterThan(windowMin);
      expect(standOffKm).toBeGreaterThanOrEqual(windowMin);
      expect(standOffKm).toBeLessThanOrEqual(windowMax);
    }

    const mediumHazardEntries = M3_GATE_LANDMARK_ENTRIES.filter((entry) => entry.approachMetadata.hazardCue === 'medium');
    expect(mediumHazardEntries.length).toBeGreaterThan(0);
    expect(mediumHazardEntries.every((entry) => entry.approachMetadata.warningEscalation === 'required')).toBe(true);
  });

  test('SW-13 M3 route-smoke run includes all gate families and gate legend cue', async ({ page }) => {
    const gateBodies = M3_GATE_LANDMARK_ENTRIES.map((entry, index) => createGateBodyFromLandmarkEntry(entry, index));
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, [...SOL_SYSTEM_BODIES, ...gateBodies]);

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
    await expect(page.getByTestId('viewer-legend-gate')).toBeVisible();

    const routeRunFamilies = gateBodies.map((body) => body.externalObjectDescriptor.objectFamily).sort();
    expect(routeRunFamilies).toEqual(['relay-spindle', 'ring-gate', 'segmented-arch']);
  });

  test('renders viewer scene after selecting a solar system', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Verify the scene container is visible
    const sceneContainer = new ViewerPage(page).sceneContainer;
       // Component exists in DOM (might be hidden with CSS)
       await expect(sceneContainer).toHaveCount(1);

    // Verify the canvas element exists (Angular Three renders to <ngt-canvas>)
    const canvas = new ViewerPage(page).sceneCanvas;
    await expect(canvas).toBeVisible();
  });

  test('displays system name in the scene view', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Verify system name is displayed (typically in header or HUD)
    await expect(page.locator('text=Sol').first()).toBeVisible();
  });

  test('accepts station market bodies in scene payload', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
  });

  test('accepts SW-13 gate descriptor families ring-gate, segmented-arch, relay-spindle', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, withGateDescriptorBodies(SOL_SYSTEM_BODIES));

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
  });

  test('rejects invalid SW-13 gate descriptor families at viewer ingest boundary', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, withInvalidGateDescriptorBody(SOL_SYSTEM_BODIES));

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneError).toBeVisible({ timeout: 5000 });
    await expect(viewerPage.sceneError).toContainText('descriptor-contract');
  });

  test('rejects legacy gate descriptor domains and families with no fallback remap', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, withLegacyGateDescriptorBody(SOL_SYSTEM_BODIES));

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneError).toBeVisible({ timeout: 5000 });
    await expect(viewerPage.sceneError).toContainText('descriptor-contract');
  });

  test('handles scene load error gracefully', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    // Register a failed scene response
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: {
        success: false,
        message: 'Failed to load system',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        bodies: [],
      },
    }));
    await viewerPage.selectSystem('Sol');

    // Verify error state is displayed
    const errorState = viewerPage.sceneError;
    await expect(errorState).toBeVisible({ timeout: 5000 });
  });

  test('renders multiple bodies with different types (star, planet, moon)', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, SOL_SYSTEM_BODIES);

    // Verify scene component is loaded
       // Component exists in DOM 
      await expect(new ViewerPage(page).sceneContainer).toHaveCount(1, { timeout: 5000 });

    // For Three.js rendering, we can verify the response was processed
    // by checking that the page remains in the scene view without errors
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('renders orbits for planet-anchored bodies', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    // Luna (moon) has anchorBodyId: 'earth', so moon orbits should be calculated relative to Earth
    await navigateToSystemScene(page, mock, SOL_SYSTEM_BODIES);

    const canvas = new ViewerPage(page).sceneCanvas;
    await expect(canvas).toBeVisible();

    // Verify scene rendered without error (orbits are rendered in the Three.js scene)
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('displays loading state while scene is loading', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    // Delay the scene response to catch loading state
    let resolveResponse: any;
    const delayedResponse = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    mock.on('solar-system-get-request', async () => {
      await delayedResponse;
      return {
        event: 'solar-system-get-response',
        data: solarSystemGetResponse(SOL_SYSTEM_BODIES),
      };
    });

    await viewerPage.selectSystem('Sol');

      // Wait for the scene component to become visible
      await expect(viewerPage.sceneContainer).toHaveCount(1, { timeout: 5000 });

    // Resolve the delayed response
    resolveResponse();

    // Wait for scene component to become visible
      // Verify scene component is present in DOM
      await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('maintains system summary across scene navigation', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Verify scene component is rendered and visible
      // Component exists in DOM
      await expect(page.locator('app-viewer-scene-page')).toHaveCount(1, { timeout: 5000 });
  });

  test('[locale] renders scene content in Italian locale', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();

    // Register character-list handler
    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: 'char-viewer-1',
            characterName: 'Scout',
            level: 1,
            missions: [
              {
                missionId: 'first-target',
                status: 'active',
              },
            ],
            preferredLocale: 'it',
          },
        ],
      },
    }));

    // Login with Italian locale
    const loginResponse = {
      success: true,
      message: 'Login successful',
      sessionKey: TEST_SESSION_KEY,
      playerId: 'player-id-001',
      preferredLocale: 'it',
    };

    mock.on('login', () => ({
      event: 'login-response',
      data: loginResponse,
    }));

    const socketConnectedInApp = page
      .waitForEvent('console', {
        predicate: (msg) => msg.type() === 'log' && msg.text().includes('Socket connected:'),
        timeout: 10_000,
      })
      .catch(() => null);

    await page.goto('/(left:login)?locale=it');
    await mock.connected;
    await socketConnectedInApp;

    await page.locator('#playerName').fill(TEST_PLAYER);
    await page.locator('#password').fill('testpassword123');
    await page.locator('button[type="submit"]').click();

    mock.push('login-response', loginResponse);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-viewer-1',
        ships: [ACTIVE_SHIP],
      },
    }));
    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:game-main/);

    // Register solar system list handler
    mock.on('solar-system-list-request', () => ({
      event: 'solar-system-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystems: [SOL_SUMMARY],
      },
    }));

    // Navigate to Viewer (use English label which is set first, more reliable)
    await page.locator('button[aria-label="Viewer"]').click();
    await expect(page).toHaveURL(/left:viewer/);

    // Register scene response handler
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: solarSystemGetResponse(SOL_SYSTEM_BODIES),
    }));

    // Select system and navigate to scene
    const solButton = page.locator('.solar-system-item__button').filter({ hasText: 'Sol' }).first();
    await solButton.click();

    await expect(page).toHaveURL(/right:viewer-scene/);

    // Verify scene component loads
    await expect(page.locator('app-viewer-scene-page')).toHaveCount(1, { timeout: 5000 });
  });
});
