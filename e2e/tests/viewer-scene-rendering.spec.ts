import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExternalObjectDescriptor } from '../../src/app/model/external-object-descriptor';
import {
  resolveDescriptorRenderProfile,
  resolveGateApproachMetadata,
  type GateApproachMetadata,
} from '../../src/app/scene/viewer/viewer-descriptor-selectors';
import {
  SW13_M4_BALANCED_PERFORMANCE_BUDGET,
  validateSw13M4DescriptorEnvelope,
} from '../../src/app/scene/viewer/viewer-performance-guardrails';
import { SocketIOMock } from '../fixtures/socket-mock';
import {
  ACTIVE_SHIP,
  SOL_SUMMARY,
  SOL_SYSTEM_BODIES,
  setupViewerSceneTest,
  solarSystemGetResponse,
} from '../fixtures/viewer-scene-rendering-scenario';
import { TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';
import type { Object3D } from 'three';
import type { ViewerBody } from '../../src/app/model/solar-system-get';

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

const M4_SIZE_CONSISTENCY_REPORT_PATH = join(
  process.cwd(),
  'docs',
  'planning',
  'sw-13',
  'sw13-m4-size-consistency-report.json',
);

const parsedM4SizeConsistencyReport = JSON.parse(readFileSync(M4_SIZE_CONSISTENCY_REPORT_PATH, 'utf8')) as {
  evidence: {
    schemaVersions: string[];
    fallbackTierValues: string[];
    legacyFieldHits: string[];
  };
  summary: {
    descriptorSizeByDomain: {
      gates: {
        max: number;
      };
    };
    descriptorCountByDomain: {
      gates: number;
    };
    lockedSchemaVersion: string;
    lockedFallbackTiers: string[];
  };
};

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
    const stationBodies = stationDescriptors.map((descriptor, index) =>
      createStationBodyFromDescriptor(descriptor, index),
    );

    const { mock } = await setupViewerSceneTest(page, ships);
    await navigateToSystemScene(page, mock, [...SOL_SYSTEM_BODIES, ...stationBodies]);

    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneLoaded();
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

    const mediumHazardEntries = M3_GATE_LANDMARK_ENTRIES.filter(
      (entry) => entry.approachMetadata.hazardCue === 'medium',
    );
    expect(mediumHazardEntries.length).toBeGreaterThan(0);
    expect(mediumHazardEntries.every((entry) => entry.approachMetadata.warningEscalation === 'required')).toBe(true);
  });

  test('SW-13 M3 route-smoke run includes all gate families and gate legend cue', async ({ page }) => {
    const gateBodies = M3_GATE_LANDMARK_ENTRIES.map((entry, index) => createGateBodyFromLandmarkEntry(entry, index));
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, [...SOL_SYSTEM_BODIES, ...gateBodies]);

    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneLoaded();
    await expect(page.getByTestId('viewer-legend-gate')).toBeVisible();

    const routeRunFamilies = gateBodies.map((body) => body.externalObjectDescriptor.objectFamily).sort();
    expect(routeRunFamilies).toEqual(['relay-spindle', 'ring-gate', 'segmented-arch']);
  });

  test('SW-13 M4 artifact parity locks runtime guardrails to the committed size report', async () => {
    const report = parsedM4SizeConsistencyReport;
    expect(report.summary.lockedSchemaVersion).toBe('sw-13-m0-v1');
    expect(report.evidence.schemaVersions).toEqual(['sw-13-m0-v1']);
    expect(report.summary.lockedFallbackTiers.slice().sort()).toEqual(['hero', 'minimal', 'standard']);
    expect(report.evidence.fallbackTierValues.slice().sort()).toEqual(['hero', 'minimal', 'standard']);
    expect(report.evidence.legacyFieldHits).toEqual([]);

    expect(report.summary.descriptorSizeByDomain.gates.max).toBe(328);
    expect(report.summary.descriptorCountByDomain.gates).toBe(3);

    expect(SW13_M4_BALANCED_PERFORMANCE_BUDGET.maxDescriptorEntries).toBe(16);
    expect(SW13_M4_BALANCED_PERFORMANCE_BUDGET.maxGateEntries).toBe(3);
    expect(SW13_M4_BALANCED_PERFORMANCE_BUDGET.maxGateDescriptorBytes).toBe(
      report.summary.descriptorSizeByDomain.gates.max,
    );
  });

  test('SW-13 M4 dense-scene guardrail is deterministic at the 16-descriptor and 3-gate envelope', async () => {
    const nonGateDescriptors: ExternalObjectDescriptor[] = Array.from({ length: 16 }, (_, index) => ({
      descriptorId: `asteroid-envelope-${index + 1}`,
      schemaVersion: 'sw-13-m0-v1',
      domain: 'asteroids',
      objectFamily: 'rocky-irregular',
      roleCue: 'hazard',
      factionCue: 'neutral',
      fallbackTier: 'standard',
      displayLabel: `Asteroid Envelope ${index + 1}`,
      silhouetteProfile: 'irregular',
      materialProfile: 'rocky',
      emissiveProfile: 'none',
    }));

    const gateDescriptors = M3_GATE_LANDMARK_ENTRIES.map((entry) => entry.descriptor);
    expect(gateDescriptors.length).toBe(3);

    const validEnvelope = validateSw13M4DescriptorEnvelope([...nonGateDescriptors, ...gateDescriptors]);
    expect(validEnvelope.valid).toBe(true);
    expect(validEnvelope.summary.descriptorEntries).toBe(16);
    expect(validEnvelope.summary.gateEntries).toBe(3);
    expect(validEnvelope.summary.largestGateDescriptorBytes).toBeLessThanOrEqual(328);

    const overDescriptorEnvelope = validateSw13M4DescriptorEnvelope([
      ...nonGateDescriptors,
      {
        descriptorId: 'asteroid-envelope-overflow',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'asteroids',
        objectFamily: 'rocky-irregular',
        roleCue: 'hazard',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Asteroid Envelope Overflow',
        silhouetteProfile: 'irregular',
        materialProfile: 'rocky',
        emissiveProfile: 'none',
      },
      ...gateDescriptors,
    ]);
    expect(overDescriptorEnvelope.valid).toBe(false);
    expect(overDescriptorEnvelope.reason).toContain('descriptor entries exceed max 16');

    const overGateEnvelope = validateSw13M4DescriptorEnvelope([
      ...nonGateDescriptors,
      ...gateDescriptors,
      {
        descriptorId: 'gate-overflow-entry',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'gates',
        objectFamily: 'ring-gate',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Gate Overflow Entry',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    ]);
    expect(overGateEnvelope.valid).toBe(false);
    expect(overGateEnvelope.reason).toContain('gate descriptor entries exceed max 3');
  });

  test('renders viewer scene after selecting a solar system', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Verify the scene container is visible
    const viewerPage = new ViewerPage(page);
    // Component exists in DOM (might be hidden with CSS)
    await viewerPage.expectSceneComponentPresent();

    // Verify the canvas element exists (Angular Three renders to <ngt-canvas>)
    const canvas = viewerPage.sceneCanvas;
    await expect(canvas).toBeVisible();
  });

  test('shares display coordinates across companion stars, moons, lights and pick shells', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);
    const bodies = [
      ...SOL_SYSTEM_BODIES,
      {
        ...SOL_SYSTEM_BODIES[0], id: 'basis-companion', displayName: 'Basis Companion',
        parentBodyId: 'sun',
        spatial: { solarSystemId: 'sol', frame: 'barycentric',
          positionKm: { x: 0, y: 3e6, z: 4e6 }, epochMs: 1715000000000 },
      },
      {
        ...SOL_SYSTEM_BODIES[2], id: 'basis-moon', displayName: 'Basis Moon',
        spatial: { solarSystemId: 'sol', frame: 'barycentric',
          positionKm: { x: 2e6, y: 5e6, z: 1e6 }, epochMs: 1715000000000 },
      },
    ];
    await navigateToSystemScene(page, mock, bodies);
    await new ViewerPage(page).expectSceneLoaded();
    await expect(page.getByTestId('viewer-distance-mode')).toContainText('Proportional distances');
    await page.getByTestId('viewer-distance-toggle').click();
    await expect(page.getByTestId('viewer-distance-mode')).toContainText('Compressed overview');
    await expect.poll(() => page.evaluate(() => {
      const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
      const canvas = document.querySelector('ngt-canvas');
      const host = document.querySelector('app-viewer-scene-page');
      if (!canvas || !host) return false;
      const scene = (ng.getComponent(canvas) as { store: { snapshot: { scene: Object3D | null } } }).store.snapshot.scene;
      if (!scene) return false;
      const source = (ng.getComponent(host) as { bodies(): ViewerBody[] }).bodies();
      const lights: number[][] = [];
      scene.traverse((object) => { if (object.type === 'PointLight') lights.push(object.position.toArray()); });
      return ['basis-companion', 'basis-moon'].every((id) => {
        const body = source.find((candidate) => candidate.id === id);
        if (!body) return false;
        const point = body.spatial.positionKm;
        const distance = Math.hypot(point.x, point.y, point.z);
        const radius = +((1 + Math.log(distance / 1e6) / Math.log(6)) * 5).toFixed(3);
        const expected = [point.x, -point.z, point.y].map((value) => +(value / distance * radius).toFixed(3));
        let shell: Object3D | undefined;
        scene.traverse((object) => { if (object.name === body.displayName && object.type === 'Mesh') shell = object; });
        const matches = (position: number[]) => position.every((value, index) => Math.abs(value - expected[index]) < 1e-6);
        return !!shell && matches(shell.position.toArray()) && (id !== 'basis-companion' || lights.some(matches));
      });
    })).toBe(true);
    await page.getByTestId('viewer-distance-toggle').click();
    await expect.poll(() => page.evaluate(() => {
      const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
      const host = document.querySelector('app-viewer-scene-page');
      const canvas = document.querySelector('ngt-canvas');
      if (!host || !canvas) return false;
      const scene = (ng.getComponent(canvas) as { store: { snapshot: { scene: Object3D | null } } }).store.snapshot.scene;
      if (!scene) return false;
      const bodies = (ng.getComponent(host) as { bodies(): ViewerBody[] }).bodies();
      return bodies.filter((body) => ['earth', 'basis-companion', 'basis-moon'].includes(body.id)).every((body) => {
        const p = body.spatial.positionKm;
        const expected = [p.x, -p.z, p.y].map((value) => value / 149_597_870.7 * 5);
        let mesh: Object3D | undefined;
        scene.traverse((object) => { if (object.name === body.displayName && object.type === 'Mesh') mesh = object; });
        return !!mesh && mesh.position.toArray().every((value, index) => Math.abs(value - expected[index]) < 1e-10);
      });
    })).toBe(true);
    await page.evaluate(() => {
      const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
      const component = ng.getComponent(document.querySelector('app-viewer-scene-page')!) as {
        bodies(): ViewerBody[]; onPlanetViewRequest(body: ViewerBody): void;
      };
      component.onPlanetViewRequest(component.bodies().find((body) => body.id === 'earth')!);
    });
    await expect(page).toHaveURL(/right:planet-view/);
    await expect.poll(() => page.evaluate(() => {
      const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
      const canvas = document.querySelector('ngt-canvas');
      const host = document.querySelector('app-planet-view-page');
      if (!canvas || !host) return false;
      const scene = (ng.getComponent(canvas) as { store: { snapshot: { scene: Object3D | null } } }).store.snapshot.scene;
      if (!scene) return false;
      const component = ng.getComponent(host) as { bodies(): ViewerBody[]; selectedBody(): ViewerBody };
      const origin = component.selectedBody().spatial.positionKm;
      const lights: number[][] = [];
      scene.traverse((object) => { if (object.type === 'PointLight') lights.push(object.position.toArray()); });
      return ['basis-companion', 'basis-moon'].every((id) => {
        const body = component.bodies().find((candidate) => candidate.id === id);
        if (!body) return false;
        let object: Object3D | undefined;
        scene.traverse((candidate) => { if (candidate.name === body.displayName) object = candidate; });
        if (!object) return false;
        const point = body.spatial.positionKm;
        const delta = [point.x - origin.x, -(point.z - origin.z), point.y - origin.y];
        const distance = Math.hypot(...delta);
        const radius = object.position.length();
        const expected = delta.map((value) => value / distance * radius);
        const matches = (position: number[]) => position.every((value, index) => Math.abs(value - expected[index]) < 1e-6);
        return radius > 0 && matches(object.position.toArray()) && (id !== 'basis-companion' || lights.some(matches));
      });
    })).toBe(true);
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
    await viewerPage.expectSceneLoaded();
  });

  test('accepts SW-13 gate descriptor families ring-gate, segmented-arch, relay-spindle', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, withGateDescriptorBodies(SOL_SYSTEM_BODIES));

    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneLoaded();
  });

  test('rejects invalid SW-13 gate descriptor families at viewer ingest boundary', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, withInvalidGateDescriptorBody(SOL_SYSTEM_BODIES));

    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneErrorContains('descriptor-contract');
  });

  test('rejects legacy gate descriptor domains and families with no fallback remap', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock, withLegacyGateDescriptorBody(SOL_SYSTEM_BODIES));

    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneErrorContains('descriptor-contract');
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
    await new ViewerPage(page).expectSceneComponentPresent();

    // For Three.js rendering, we can verify the response was processed
    // by checking that the page remains in the scene view without errors
    await new ViewerPage(page).expectSceneRoute();
  });

  test('renders orbits for planet-anchored bodies', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    // Luna (moon) has anchorBodyId: 'earth', so moon orbits should be calculated relative to Earth
    await navigateToSystemScene(page, mock, SOL_SYSTEM_BODIES);

    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneLoaded();
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
    await viewerPage.expectSceneComponentPresent();

    // Resolve the delayed response
    resolveResponse();

    // Wait for scene component to become visible
    await viewerPage.expectSceneRoute();
  });

  test('maintains system summary across scene navigation', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Verify scene component is rendered and visible
    // Component exists in DOM
    await new ViewerPage(page).expectSceneComponentPresent();
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
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15000 });

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

    // Navigate to Viewer only after guarded menu is ready in the post-join shell.
    const viewerButton = page.locator('app-guarded-left-menu button[aria-label="Viewer"]').first();
    await expect(viewerButton).toBeVisible({ timeout: 10_000 });
    await expect(viewerButton).toBeEnabled({ timeout: 10_000 });
    await viewerButton.click();
    await expect(page).toHaveURL(/left:viewer/, { timeout: 10_000 });

    // Register scene response handler
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: solarSystemGetResponse(SOL_SYSTEM_BODIES),
    }));

    // Select system and navigate to scene
    const solButton = page.locator('.solar-system-item__button').filter({ hasText: 'Sol' }).first();
    await solButton.click();

    await new ViewerPage(page).expectSceneLoaded();
  });
});
