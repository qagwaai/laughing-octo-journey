import { expect, test, type Page } from '@playwright/test';
import type { Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three';
import type { MarketSummary } from '../../src/app/model/market-list';
import type {
  PairedNavigationEstimate,
  PairedNavigationPrediction,
  SolarSystemGetRequest,
  SupportedNavigationPositionState,
  ViewerBody,
} from '../../src/app/model/solar-system-get';
import { resolveScenePositionFromSpatialKm } from '../../src/app/scene/viewer/viewer-formatters';
import { ACTIVE_SHIP, setupViewerSceneTest, solarSystemGetResponse } from '../fixtures/viewer-scene-rendering-scenario';
import { expectStationHabitatMotion } from '../helpers/station-habitat-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

const marsStation: ViewerBody = {
  id: 'sol-mars-orbit',
  bodyType: 'station',
  stationKind: 'market',
  displayName: 'Mars Orbital Market',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
};

function pairedDistanceEstimate(destinationMarketId: string, distanceKm: number): PairedNavigationEstimate {
  return {
    success: true,
    association: 'same-response-direct-endpoints',
    estimate: {
      status: 'supported',
      solarSystemId: 'sol',
      departure: { shipId: ACTIVE_SHIP.id },
      destination: { marketId: destinationMarketId },
      coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
      referenceEpochMs: ACTIVE_SHIP.spatial.epochMs,
      positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
      estimationModelId: 'frozen-endpoints-constant-speed-v1',
      distanceKm,
      classification: 'hypothetical-not-eta',
      assumptions: {
        endpointsFrozen: true,
        constantScenarioSpeed: true,
        accelerationBrakingOmitted: true,
        assistSpeedChangesOmitted: true,
        movementDuringTripOmitted: true,
      },
      warnings: ['CLEARANCE_UNVERIFIED'],
      duration: { status: 'unavailable', reason: 'SCENARIO_SPEED_NOT_SUPPLIED' },
    },
  };
}

test('previews navigation detours around the projected candidate marker in both distance modes', async ({ page }) => {
  const { mock } = await setupViewerSceneTest(page);
  const candidate: ViewerBody = {
    id: 'sol-mars',
    bodyType: 'planet',
    displayName: 'Mars',
    surfaceArchetype: 'rocky',
    state: 'unscanned',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 100_000_000, y: 0, z: 0 }, epochMs: 1 },
  };
  const requests: Array<{ shipId: string; destinationMarketId: string; candidateBodyId?: string }> = [];
  const estimateOptions: unknown[] = [];
  let candidatePosition = { x: 150_000_000, y: 100_000_000, z: 0 };
  let replacementRequest: { correlationId: string; requestIdentity: unknown } | undefined;
  mock.on('solar-system-get-request', (request) => {
    const incoming = request as {
      navigation?: (typeof requests)[number];
      navigationEstimate?: { scenarioCruiseSpeedKmPerSec?: number };
      correlationId: string;
      requestIdentity: unknown;
    };
    const navigation = incoming.navigation;
    const response = solarSystemGetResponse([candidate, marsStation, genericStation]);
    if (!navigation) return { event: 'solar-system-get-response', data: response };
    requests.push(navigation);
    estimateOptions.push(incoming.navigationEstimate);
    if (navigation.destinationMarketId === genericStation.id) {
      replacementRequest = incoming;
      return null;
    }
    const destinationPosition = { x: 200_000_000, y: 50_000_000, z: 0 };
    return {
      event: 'solar-system-get-response',
      data: {
        ...response,
        navigationState: {
          status: 'supported',
          solarSystemId: 'sol',
          coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
          epochMs: ACTIVE_SHIP.spatial.epochMs,
          departure: { shipId: navigation.shipId, positionKm: ACTIVE_SHIP.spatial.positionKm },
          destination: { marketId: navigation.destinationMarketId, positionKm: destinationPosition },
          candidates: navigation.candidateBodyId
            ? [{ bodyId: navigation.candidateBodyId, positionKm: candidatePosition }]
            : [],
          previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
        },
        navigationEstimate: pairedDistanceEstimate(
          navigation.destinationMarketId,
          Math.hypot(
            destinationPosition.x - ACTIVE_SHIP.spatial.positionKm.x,
            destinationPosition.y - ACTIVE_SHIP.spatial.positionKm.y,
            destinationPosition.z - ACTIVE_SHIP.spatial.positionKm.z,
          ),
        ),
      },
    };
  });
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(marsStation), stationMarket(genericStation)] },
  }));
  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();

  await page.getByRole('button', { name: 'Plan route to Mars Orbital Market.' }).click();
  const panel = page.getByTestId('navigation-preview');
  await expect(panel.getByText('Clearance is unknown; no safety claim is made.')).toBeVisible();
  await expect(panel.getByText('Projected at epoch 1715000000000 ms')).toBeVisible();
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('158,113,883.008 km');
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('not distance flown');
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('no scenario speed was supplied');
  await expect(panel.locator('svg polyline')).toHaveCount(1);
  await panel.getByLabel('Optional celestial candidate').selectOption('sol-mars');
  await expect(panel.getByTestId('navigation-candidate-disclaimer')).toBeVisible();
  await expect(panel.getByLabel('Optional celestial candidate')).toHaveValue('sol-mars');
  await expect(panel.locator('svg rect.viewer-navigation-preview__candidate-marker')).toHaveCount(1);
  await expect(panel.locator('svg polyline')).toHaveCount(1);
  const destinationLabel = 'Projected destination: Mars Orbital Market — 1715000000000 ms';
  const candidateLabel = 'Projected candidate body: Mars — 1715000000000 ms';
  await expect(page.getByText(destinationLabel, { exact: true })).toBeVisible();
  await expect(page.getByText(candidateLabel, { exact: true })).toBeVisible();
  const readProjection = () =>
    page.evaluate(
      ({ destinationLabel, candidateLabel }) => {
        const canvas = document.querySelector('app-viewer-scene-page ngt-canvas');
        if (!canvas || !window.ng) return null;
        const component = window.ng.getComponent(canvas) as {
          store: { snapshot: { scene: Scene; camera: PerspectiveCamera; size: { width: number; height: number } } };
        };
        const scene = component.store.snapshot.scene;
        const destination = scene.getObjectByName(destinationLabel);
        const candidate = scene.getObjectByName(candidateLabel);
        const route = scene.getObjectByName('navigation-preview-route') as import('three').Line | undefined;
        if (!destination || !candidate || !route) return null;
        const positions = route.geometry.getAttribute('position');
        const last = positions.count - 1;
        const { camera, size } = component.store.snapshot;
        camera.updateMatrixWorld();
        const screen = (point: import('three').Vector3) => {
          point.project(camera);
          return [(point.x * size.width) / 2, (point.y * size.height) / 2];
        };
        const mesh = candidate.children.find((child) => (child as Mesh).isMesh) as Mesh;
        const markerVertices = mesh.geometry.getAttribute('position');
        const markerScreen = Array.from({ length: markerVertices.count }, (_, index) =>
          screen(
            mesh.localToWorld(
              mesh.position
                .clone()
                .set(markerVertices.getX(index), markerVertices.getY(index), markerVertices.getZ(index)),
            ),
          ),
        );
        return {
          destination: destination.position.toArray(),
          candidate: candidate.position.toArray(),
          endpoint: [positions.getX(last), positions.getY(last), positions.getZ(last)],
          points: Array.from({ length: positions.count }, (_, index) => [
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index),
          ]),
          visible: route.visible,
          screenPoints: Array.from({ length: positions.count }, (_, index) =>
            screen(
              route.localToWorld(
                route.position.clone().set(positions.getX(index), positions.getY(index), positions.getZ(index)),
              ),
            ),
          ),
          screenBounds: {
            minX: Math.min(...markerScreen.map((point) => point[0]!)),
            maxX: Math.max(...markerScreen.map((point) => point[0]!)),
            minY: Math.min(...markerScreen.map((point) => point[1]!)),
            maxY: Math.max(...markerScreen.map((point) => point[1]!)),
          },
        };
      },
      { destinationLabel, candidateLabel },
    );
  const routePresent = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('app-viewer-scene-page ngt-canvas');
      if (!canvas || !window.ng) return false;
      const component = window.ng.getComponent(canvas) as { store: { snapshot: { scene: Scene } } };
      return !!component.store.snapshot.scene.getObjectByName('navigation-preview-route');
    });
  const destinationKm = { x: 200_000_000, y: 50_000_000, z: 0 };
  const candidateKm = { x: 150_000_000, y: 100_000_000, z: 0 };
  for (const mode of ['proportional', 'compressed'] as const) {
    if (mode === 'compressed') {
      await page.getByTestId('viewer-distance-mode').locator('summary').click();
      await page.getByTestId('viewer-distance-toggle').click();
    }
    const expectedDestination = resolveScenePositionFromSpatialKm(destinationKm, mode);
    const expectedCandidate = resolveScenePositionFromSpatialKm(candidateKm, mode);
    await expect
      .poll(async () => {
        const projection = await readProjection();
        if (!projection) return false;
        return (
          projection.destination.every((value, index) => Math.abs(value - expectedDestination[index]) < 0.0001) &&
          projection.candidate.every((value, index) => Math.abs(value - expectedCandidate[index]) < 0.0001) &&
          projection.endpoint.every((value, index) => Math.abs(value - expectedDestination[index]) < 0.0001)
        );
      })
      .toBe(true);
    await expect(panel.getByTestId('navigation-direct-distance')).toContainText('158,113,883.008 km');
    const projection = await readProjection();
    expect(projection).not.toBeNull();
    if (!projection) throw new Error('Projected detour was not rendered.');
    if (projection.visible) {
      for (let index = 1; index < projection.screenPoints.length; index++) {
        const start = projection.screenPoints[index - 1]!;
        const end = projection.screenPoints[index]!;
        for (let sample = 0; sample <= 100; sample++) {
          const x = start[0]! + ((end[0]! - start[0]!) * sample) / 100;
          const y = start[1]! + ((end[1]! - start[1]!) * sample) / 100;
          const bound = projection.screenBounds;
          expect(x < bound.minX - 2 || x > bound.maxX + 2 || y < bound.minY - 2 || y > bound.maxY + 2).toBe(true);
        }
      }
    } else {
      await expect(page.getByTestId('navigation-detour-3d-unavailable')).toBeVisible();
    }
    const plot = await panel.locator('svg').evaluate((svg) => {
      const line = svg.querySelector('polyline');
      const departure = svg.querySelector('circle.viewer-navigation-preview__departure');
      const destination = svg.querySelector('circle.viewer-navigation-preview__destination');
      const marker = svg.querySelector('rect');
      if (!line || !departure || !destination || !marker) throw new Error('Missing navigation plot geometry.');
      return {
        points: line
          .getAttribute('points')!
          .split(' ')
          .map((point) => point.split(',').map(Number)),
        departure: [Number(departure.getAttribute('cx')), Number(departure.getAttribute('cy'))],
        destination: [Number(destination.getAttribute('cx')), Number(destination.getAttribute('cy'))],
        center: [
          Number(marker.getAttribute('x')) + Number(marker.getAttribute('width')) / 2,
          Number(marker.getAttribute('y')) + Number(marker.getAttribute('height')) / 2,
        ],
        radius: Number(marker.getAttribute('width')) / Math.SQRT2,
      };
    });
    expect(plot.points.length).toBeGreaterThan(3);
    const first = projection.points[0]!;
    const last = projection.points.at(-1)!;
    const scale = (plot.destination[0]! - plot.departure[0]!) / (last[0]! - first[0]!);
    for (const point of plot.points) {
      expect(
        projection.points.some(
          (vertex) =>
            Math.abs(plot.departure[0]! + (vertex[0]! - first[0]!) * scale - point[0]!) < 0.001 &&
            Math.abs(plot.departure[1]! - (vertex[2]! - first[2]!) * scale - point[1]!) < 0.001,
        ),
      ).toBe(true);
    }
    for (let index = 1; index < plot.points.length; index++) {
      const start = plot.points[index - 1]!;
      const end = plot.points[index]!;
      const dx = end[0]! - start[0]!;
      const dy = end[1]! - start[1]!;
      const fraction = Math.max(
        0,
        Math.min(1, ((plot.center[0]! - start[0]!) * dx + (plot.center[1]! - start[1]!) * dy) / (dx * dx + dy * dy)),
      );
      expect(
        Math.hypot(plot.center[0]! - start[0]! - fraction * dx, plot.center[1]! - start[1]! - fraction * dy),
      ).toBeGreaterThan(plot.radius);
    }
    await test
      .info()
      .attach(`candidate-detour-${mode}`, { body: await panel.locator('svg').screenshot(), contentType: 'image/png' });
  }
  await page.getByTestId('viewer-group-planets').uncheck();
  await page.getByTestId('viewer-group-stations').uncheck();
  await expect(
    panel.getByText('The planets object group is hidden; the projected marker is shown separately.'),
  ).toBeVisible();
  await expect(
    panel.getByText('The stations object group is hidden; the projected marker is shown separately.'),
  ).toBeVisible();
  await expect.poll(async () => (await readProjection()) !== null).toBe(true);
  await page.getByTestId('viewer-group-planets').check();
  await page.getByTestId('viewer-group-stations').check();
  expect(requests).toEqual([
    { shipId: ACTIVE_SHIP.id, destinationMarketId: marsStation.id },
    { shipId: ACTIVE_SHIP.id, destinationMarketId: marsStation.id, candidateBodyId: candidate.id },
  ]);
  await panel.getByLabel('Optional celestial candidate').selectOption('');
  await expect(panel.locator('svg rect.viewer-navigation-preview__candidate-marker')).toHaveCount(0);
  await expect
    .poll(async () => (await panel.locator('svg polyline').getAttribute('points'))?.split(' ').length)
    .toBe(2);
  candidatePosition = { ...ACTIVE_SHIP.spatial.positionKm };
  await panel.getByLabel('Optional celestial candidate').selectOption('sol-mars');
  await expect(panel.getByTestId('navigation-detour-unavailable')).toBeVisible();
  await expect(panel.locator('svg polyline')).toHaveCount(0);
  await expect(panel.locator('svg line.viewer-navigation-preview__direct-reference')).toHaveCount(1);
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('158,113,883.008 km');
  await expect.poll(routePresent).toBe(false);
  await page.getByRole('button', { name: 'Plan route to Other Mars Station.' }).click();
  await expect(panel.getByTestId('navigation-preview-loading')).toBeVisible();
  await expect(page.getByText(destinationLabel, { exact: true })).toHaveCount(0);
  await expect(page.getByText(candidateLabel, { exact: true })).toHaveCount(0);
  await expect.poll(routePresent).toBe(false);
  await expect.poll(() => replacementRequest !== undefined).toBe(true);
  if (!replacementRequest) throw new Error('Replacement navigation request was not received.');
  mock.push('solar-system-get-response', {
    ...solarSystemGetResponse([candidate, marsStation, genericStation]),
    correlationId: replacementRequest.correlationId,
    requestIdentity: replacementRequest.requestIdentity,
    navigationState: {
      status: 'supported',
      solarSystemId: 'sol',
      coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
      epochMs: ACTIVE_SHIP.spatial.epochMs,
      departure: { shipId: ACTIVE_SHIP.id, positionKm: ACTIVE_SHIP.spatial.positionKm },
      destination: { marketId: genericStation.id, positionKm: { x: 100_000_000, y: 0, z: 0 } },
      candidates: [],
      previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
    },
    navigationEstimate: pairedDistanceEstimate(genericStation.id, 250_000_000),
  });
  const replacementLabel = 'Projected destination: Other Mars Station — 1715000000000 ms';
  await expect(page.getByText(replacementLabel, { exact: true })).toBeVisible();
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('250,000,000.000 km');
  await expect(panel.getByLabel('Optional celestial candidate')).toHaveValue('');
  expect(estimateOptions).toEqual([{}, {}, {}, {}, {}]);
  await panel.getByRole('button', { name: 'Clear route preview' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByText(replacementLabel, { exact: true })).toHaveCount(0);
  await expect.poll(routePresent).toBe(false);
});
test('calculates navigation predictions with explicit speed, pending feedback and independent future markers', async ({
  page,
}, testInfo) => {
  const { mock } = await setupViewerSceneTest(page);
  const candidate: ViewerBody = {
    id: 'sol-luna',
    bodyType: 'moon',
    displayName: 'Luna',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 1, z: 0 }, epochMs: 1 },
  };
  const destinationPosition = { x: 200_000_000, y: 50_000_000, z: 0 };
  const t0 = ACTIVE_SHIP.spatial.epochMs;
  const revision = 'a'.repeat(64);
  let pending: { request: SolarSystemGetRequest; state: SupportedNavigationPositionState } | undefined;
  const predictionRequests: SolarSystemGetRequest[] = [];
  mock.on('solar-system-get-request', (payload) => {
    const request = payload as SolarSystemGetRequest;
    const n = request.navigation;
    if (!n) return { event: 'solar-system-get-response', data: solarSystemGetResponse([candidate, marsStation]) };
    const state: SupportedNavigationPositionState = {
      status: 'supported',
      solarSystemId: 'sol',
      coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
      epochMs: t0,
      departure: { shipId: ACTIVE_SHIP.id, positionKm: ACTIVE_SHIP.spatial.positionKm },
      destination: { marketId: marsStation.id, hostBodyId: 'sol-mars', positionKm: destinationPosition },
      candidates: n.candidateBodyId
        ? [{ bodyId: n.candidateBodyId, positionKm: { x: 150_000_000, y: 100_000_000, z: 0 } }]
        : [],
      provenance: {
        evaluationModelId: 'sol-catalog-kepler-position-v1',
        sourceRevision: revision,
        positionToleranceKm: 0.001,
      },
      previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
    };
    if (request.navigationPrediction) {
      predictionRequests.push(request);
      pending = { request, state };
      return null;
    }
    return {
      event: 'solar-system-get-response',
      data: {
        ...solarSystemGetResponse([candidate, marsStation]),
        navigationState: state,
        navigationEstimate: pairedDistanceEstimate(marsStation.id, 158_113_883.008),
      },
    };
  });
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(marsStation)] },
  }));
  const respond = (rejection?: boolean) => {
    if (!pending) throw new Error('Expected pending prediction request.');
    const { request, state } = pending;
    const speed = request.navigationPrediction!.scenarioCruiseSpeedKmPerSec;
    const prediction: PairedNavigationPrediction = rejection
      ? {
          success: false,
          association: 'same-response-navigation-sources',
          prediction: {
            status: 'unsupported',
            reason: 'PREDICTION_HORIZON_EXCEEDED',
            message: 'Prediction horizon exceeded.',
          },
        }
      : {
          success: true,
          association: 'same-response-navigation-sources',
          prediction: {
            status: 'supported',
            solarSystemId: 'sol',
            coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
            positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
            predictionModelId: 'constant-speed-straight-legs-moving-targets-v1',
            timeScaleId: 'stellar:unix-ms-uniform:v1',
            sourceRevision: revision,
            classification: 'illustrative-not-eta',
            scenarioCruiseSpeedKmPerSec: speed,
            speedProvenance: 'caller-supplied-scenario',
            departure: { ...state.departure, epochMs: t0 },
            encounter: {
              bodyId: candidate.id,
              epochMs: t0 + 1_000_000,
              positionKm: { x: 100_000_000 + speed * 1000, y: 150_000_000, z: 0 },
              convergence: { iterations: 3, residualMs: 0.2 },
            },
            arrival: {
              marketId: marsStation.id,
              hostBodyId: 'sol-mars',
              epochMs: t0 + 2_000_000,
              positionKm: { x: 200_000_000, y: 80_000_000 + speed * 1000, z: 0 },
              hostPositionKm: { x: 199_999_000, y: 80_000_000 + speed * 1000, z: 0 },
              convergence: { iterations: 4, residualMs: 0.3 },
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
          },
        };
    mock.push('solar-system-get-response', {
      ...solarSystemGetResponse([candidate, marsStation]),
      correlationId: request.correlationId,
      requestIdentity: request.requestIdentity,
      navigationState: state,
      navigationEstimate: pairedDistanceEstimate(marsStation.id, 158_113_883.008),
      navigationPrediction: prediction,
    });
  };
  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  await page.getByRole('button', { name: 'Plan route to Mars Orbital Market.' }).click();
  const panel = page.getByTestId('navigation-preview');
  const speed = panel.getByLabel('Scenario speed (km/s)');
  const calculate = panel.getByRole('button', { name: 'Calculate prediction', exact: true });
  await expect(speed).toHaveValue('');
  await expect(calculate).toBeDisabled();
  await panel.getByLabel('Optional celestial candidate').selectOption(candidate.id);
  await expect(speed).toHaveValue('');
  await speed.fill('10');
  await expect(calculate).toBeDisabled();
  await speed.fill('150');
  await calculate.click();
  await expect(panel.getByTestId('navigation-prediction-loading')).toBeVisible();
  await expect(panel.getByRole('progressbar')).toBeVisible();
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('158,113,883.008 km');
  await expect.poll(() => pending !== undefined).toBe(true);
  respond();
  await expect(panel.getByTestId('navigation-prediction-ready')).toBeVisible();
  await expect(panel.getByTestId('navigation-prediction-ready')).toContainText('not physical UTC or ETA');
  await panel.getByText('Exact epochs and model details', { exact: true }).click();
  await expect(panel.getByTestId('navigation-prediction-ready')).toContainText(`${t0 + 1_000_000} ms`);
  const readGeometry = () =>
    page.evaluate(() => {
      const element = document.querySelector('app-viewer-scene-page ngt-canvas');
      const component =
        element && (window.ng?.getComponent(element) as { store: { snapshot: { scene: Scene } } } | null);
      const scene = component?.store.snapshot.scene;
      const line = scene?.getObjectByName('navigation-prediction-route') as import('three').Line | undefined;
      const positions = line?.geometry.getAttribute('position');
      return {
        hasOldSweep: !!scene?.getObjectByName('navigation-preview-route'),
        hasDirectReference: !!scene?.getObjectByName('navigation-preview-direct-reference'),
        first: positions ? [positions.getX(0), positions.getY(0), positions.getZ(0)] : null,
        last: positions
          ? [
              positions.getX(positions.count - 1),
              positions.getY(positions.count - 1),
              positions.getZ(positions.count - 1),
            ]
          : null,
      };
    });
  for (const mode of ['proportional', 'compressed'] as const) {
    if (mode === 'compressed') {
      await page.getByTestId('viewer-distance-mode').locator('summary').click();
      await page.getByTestId('viewer-distance-toggle').click();
    }
    const start = resolveScenePositionFromSpatialKm(ACTIVE_SHIP.spatial.positionKm, mode);
    const end = resolveScenePositionFromSpatialKm({ x: 200_000_000, y: 80_150_000, z: 0 }, mode);
    await expect
      .poll(async () => {
        const current = await readGeometry();
        return (
          !!current.first &&
          !!current.last &&
          current.first.every((value, i) => Math.abs(value - start[i]!) < 0.0001) &&
          current.last.every((value, i) => Math.abs(value - end[i]!) < 0.0001)
        );
      })
      .toBe(true);
    const geometry = await readGeometry();
    expect(geometry.hasOldSweep).toBe(false);
    expect(geometry.hasDirectReference).toBe(true);
    for (let i = 0; i < 3; i++) {
      expect(geometry.first![i]).toBeCloseTo(start[i]!, 4);
      expect(geometry.last![i]).toBeCloseTo(end[i]!, 4);
    }
    await expect(panel.locator('svg .viewer-navigation-prediction__candidate')).toHaveCount(1);
    await expect(panel.locator('svg .viewer-navigation-prediction__arrival')).toHaveCount(1);
    await panel.locator('svg').scrollIntoViewIfNeeded();
    await testInfo.attach(`prediction-${mode}`, { body: await panel.screenshot(), contentType: 'image/png' });
  }
  for (const value of ['120', '10000']) {
    pending = undefined;
    await speed.fill(value);
    await expect(panel.getByTestId('navigation-prediction-ready')).toHaveCount(0);
    await calculate.click();
    await expect.poll(() => pending !== undefined).toBe(true);
    respond();
    await expect(panel.getByTestId('navigation-prediction-ready')).toBeVisible();
    await expect(panel.getByTestId('navigation-direct-distance')).toContainText('158,113,883.008 km');
  }
  pending = undefined;
  await calculate.click();
  await expect.poll(() => pending !== undefined).toBe(true);
  respond(true);
  await expect(panel.getByTestId('navigation-prediction-error')).toContainText('PREDICTION_HORIZON_EXCEEDED');
  await expect(panel.getByTestId('navigation-prediction-ready')).toHaveCount(0);
  await expect(panel.locator('svg .viewer-navigation-prediction__route')).toHaveCount(0);
  await panel.getByTestId('navigation-prediction-error').scrollIntoViewIfNeeded();
  await testInfo.attach('prediction-rejected', { body: await panel.screenshot(), contentType: 'image/png' });
  await panel.getByRole('button', { name: 'Clear prediction', exact: true }).click();
  await expect(speed).toHaveValue('');
  await expect(panel.locator('svg polyline')).toHaveCount(1);
  expect(predictionRequests.every((request) => JSON.stringify(request.navigationEstimate) === '{}')).toBe(true);
  pending = undefined;
  await speed.fill('150');
  await calculate.click();
  await expect.poll(() => pending !== undefined).toBe(true);
  await speed.fill('120');
  respond();
  await expect(panel.getByTestId('navigation-prediction-ready')).toHaveCount(0);
  await expect(panel.getByTestId('navigation-prediction-loading')).toHaveCount(0);
  mock.push('invalid-session', { message: 'Session expired.' });
  await expect(panel.getByTestId('navigation-preview-error')).toContainText('INVALID_SESSION');
});
const genericStation: ViewerBody = {
  ...marsStation,
  id: 'another-mars-station',
  displayName: 'Other Mars Station',
  spatial: { ...marsStation.spatial, positionKm: { x: 149597870, y: 0, z: 0 } },
};

function stationMarket(body: ViewerBody): MarketSummary {
  const orbit = body.orbitalElements;
  const anchorBodyId = orbit?.anchorBodyId;
  if (orbit && !anchorBodyId) throw new Error('Station market orbit must have an anchor body.');
  return {
    marketId: body.id,
    solarSystemId: body.spatial.solarSystemId,
    marketName: body.displayName,
    siteType: 'station',
    siteName: body.displayName,
    spatial: { ...body.spatial, frame: 'barycentric' },
    trajectory: orbit && anchorBodyId ? { kind: 'orbital-elements', orbit: { ...orbit, anchorBodyId } } : undefined,
    priceMultiplier: 1,
    driftPercentPerHour: 0,
    restockIntervalMinutes: 60,
  };
}

async function openSystem(page: Page, bodies: ViewerBody[] = [], station = marsStation) {
  const { mock } = await setupViewerSceneTest(page);
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solarSystemGetResponse(bodies),
  }));
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(station), stationMarket(genericStation)] },
  }));
  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  return { mock, viewer };
}

async function readScene(page: Page) {
  return page.evaluate(() => {
    const api = window.ng;
    if (!api) throw new Error('Angular debug API is unavailable.');
    const canvas = document.querySelector('app-viewer-scene-page ngt-canvas, app-station-view-page ngt-canvas');
    if (!canvas) throw new Error('Viewer canvas is missing.');
    const component = api.getComponent(canvas) as { store: { snapshot: { scene: Scene; camera: PerspectiveCamera } } };
    const { scene, camera } = component.store.snapshot;
    let models = 0;
    let triangles = 0;
    let hoveredHighlight = false;
    let stationHeightPixels = 0;
    let stationCentered = false;
    const projection: { stationScreen: { x: number; y: number } | null } = { stationScreen: null };
    scene.traverse((object) => {
      if (object.name === 'dedicated-station-model') {
        models++;
        const center = object.getWorldPosition(object.position.clone()).project(camera);
        const bounds = canvas.getBoundingClientRect();
        stationCentered = Math.hypot(center.x, center.y) < 0.02;
        projection.stationScreen = {
          x: bounds.x + ((center.x + 1) * bounds.width) / 2,
          y: bounds.y + ((1 - center.y) * bounds.height) / 2,
        };
        object.traverse((child) => {
          const mesh = child as Mesh;
          if (mesh.isMesh && mesh.geometry) {
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox;
            if (box) {
              const heights: number[] = [];
              for (const x of [box.min.x, box.max.x]) {
                for (const y of [box.min.y, box.max.y]) {
                  for (const z of [box.min.z, box.max.z]) {
                    heights.push(mesh.position.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera).y);
                  }
                }
              }
              stationHeightPixels = Math.max(
                stationHeightPixels,
                ((Math.max(...heights) - Math.min(...heights)) * bounds.height) / 2,
              );
            }
            triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
            const material = mesh.material as MeshStandardMaterial;
            if (material.emissive?.getHexString() === '8f0000') hoveredHighlight = true;
          }
        });
      }
    });
    return {
      models,
      triangles,
      genericPresent: !!scene.getObjectByName('Other Mars Station'),
      marsGenericPresent: !!scene.getObjectByName('Mars Orbital Market'),
      camera: camera.position.toArray(),
      cameraNear: camera.near,
      stationScreen: projection.stationScreen,
      hoveredHighlight,
      stationHeightPixels,
      stationCentered,
    };
  });
}

test.describe('Station-specific viewer models', () => {
  test.setTimeout(120_000);

  test('frames an anchored market visibly with Mars and both moons present', async ({ page }, testInfo) => {
    const mars: ViewerBody = {
      id: 'sol-mars',
      bodyType: 'planet',
      displayName: 'Mars',
      surfaceArchetype: 'rocky',
      state: 'unscanned',
      physicalCatalog: { radiusKm: 3389.5 },
      spatial: { ...marsStation.spatial, positionKm: { x: 227923661, y: 0, z: 0 } },
    };
    const station: ViewerBody = {
      ...marsStation,
      spatial: { ...mars.spatial, positionKm: { x: 227923661, y: -3800, z: 0 } },
      orbitalElements: {
        anchorBodyId: mars.id,
        semiMajorAxisKm: 3800,
        eccentricity: 0.02,
        inclinationDeg: 0,
        longitudeOfAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 0,
        meanAnomalyAtEpochDeg: 92,
        orbitalPeriodSec: 130000,
        epoch: '2026-01-01T00:00:00.000Z',
      },
    };
    const moons: ViewerBody[] = [9376, 23463].map((offset, index) => ({
      id: `mars-moon-${index}`,
      bodyType: 'moon',
      displayName: index === 0 ? 'Phobos' : 'Deimos',
      surfaceArchetype: 'rocky-moon',
      state: 'unscanned',
      physicalCatalog: { radiusKm: index === 0 ? 11.3 : 6.2 },
      spatial: { ...mars.spatial, positionKm: { x: 227923661 + (index === 0 ? offset : -offset), y: 0, z: 0 } },
      orbitalElements: { ...station.orbitalElements!, anchorBodyId: mars.id, semiMajorAxisKm: offset },
    }));
    await openSystem(page, [mars, ...moons], station);
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    const target = page.locator('tr', { hasText: station.displayName }).locator('button.details-target-btn');
    await target.click();
    await expect(page.getByTestId('viewer-zoom-slider').locator('input')).toHaveValue('0', { timeout: 15_000 });
    await expect.poll(async () => (await readScene(page)).stationCentered).toBe(true);
    await expect.poll(async () => (await readScene(page)).stationHeightPixels).toBeGreaterThan(60);
    const panel = await page.getByTestId('viewer-info-panel').boundingBox();
    const center = (await readScene(page)).stationScreen;
    expect(panel).not.toBeNull();
    expect(center).not.toBeNull();
    expect(panel!.y).toBeGreaterThan(center!.y + (await readScene(page)).stationHeightPixels / 2 + 8);
    // Hover must reach the imported station, rather than the host or a moon.
    await expect
      .poll(async () => {
        const point = (await readScene(page)).stationScreen;
        if (!point) return false;
        await page.mouse.move(point.x, point.y);
        return readScene(page);
      })
      .toMatchObject({ hoveredHighlight: true });
    await page.getByTestId('viewer-inspect-target').click();
    await expect(page.getByTestId('viewer-body-inspector')).toBeVisible();
    await expect(page.getByTestId('viewer-inspector-orbit')).toContainText('sol-mars');
    const canvasHost = page.locator('app-viewer-scene-page ngt-canvas');
    await expect
      .poll(async () => {
        const host = await canvasHost.boundingBox();
        const canvas = await canvasHost.locator('canvas').boundingBox();
        return !!host && !!canvas && Math.abs(host.width - canvas.width) < 1;
      })
      .toBe(true);
    await expect.poll(async () => (await readScene(page)).stationCentered).toBe(true);
    await expect.poll(async () => (await readScene(page)).stationHeightPixels).toBeGreaterThan(60);
    const dockedPanel = await page.getByTestId('viewer-info-panel').boundingBox();
    const dockedStation = await readScene(page);
    expect(dockedPanel!.y).toBeGreaterThan(dockedStation.stationScreen!.y + dockedStation.stationHeightPixels / 2 + 8);
    expect((await readScene(page)).cameraNear).toBe(0.001);
    await page.screenshot({ path: testInfo.outputPath('station-target-framing.png') });
  });

  for (const quality of ['standard', 'low'] as const) {
    test(`uses the ${quality} model only for the registered station and opens its close-up`, async ({ page }) => {
      await page.addInitScript((quality) => {
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          configurable: true,
          value: quality === 'standard' ? 8 : 4,
        });
      }, quality);
      const requests: string[] = [];
      const errors: string[] = [];
      page.on('request', (request) => {
        if (/station-.*\.glb/.test(request.url())) requests.push(request.url());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await openSystem(page);
      const status = page.getByTestId('viewer-station-status');
      await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(status).toHaveAttribute('data-quality', quality);
      await expect
        .poll(() => readScene(page))
        .toMatchObject({
          models: 1,
          triangles: quality === 'standard' ? 139330 : 74695,
          genericPresent: true,
          marsGenericPresent: false,
        });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toContain(quality === 'standard' ? 'station-150k.glb' : 'station-75k.glb');
      await expectStationHabitatMotion(page, 'app-viewer-scene-page ngt-canvas');

      const otherTarget = page.locator('tr', { hasText: 'Other Mars Station' }).locator('button.details-target-btn');
      await otherTarget.click();
      await expect.poll(async () => (await readScene(page)).cameraNear).toBe(0.1);
      await page.getByTestId('viewer-inspect-target').click();
      await expect(page.getByTestId('viewer-inspector-closeup')).toHaveCount(0);
      await page.getByTestId('viewer-inspector-close').click();
      const marsTarget = page.locator('tr', { hasText: 'Mars Orbital Market' }).locator('button.details-target-btn');
      await marsTarget.click();
      await expect(marsTarget).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(async () => {
          const point = (await readScene(page)).stationScreen;
          if (!point) return false;
          await page.mouse.move(point.x, point.y);
          return (await readScene(page)).hoveredHighlight;
        })
        .toBe(true);
      const point = (await readScene(page)).stationScreen;
      if (!point) throw new Error('Station projection is missing.');
      await page.mouse.click(point.x, point.y);
      await expect(marsTarget).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('viewer-inspect-target').click();
      await page.getByTestId('viewer-inspector-closeup').click();
      await expect(page).toHaveURL(/right:station-view\/sol\/sol-mars-orbit/);
      const closeup = page.getByTestId('station-view-status');
      await expect(closeup).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(closeup).toHaveAttribute('data-quality', quality);
      await expect
        .poll(() => readScene(page))
        .toMatchObject({ models: 1, triangles: quality === 'standard' ? 139330 : 74695 });
      await expectStationHabitatMotion(page, 'app-station-view-page ngt-canvas');
      const before = (await readScene(page)).camera;
      const canvas = page.locator('app-station-view-page canvas').first();
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Station close-up canvas has no bounds.');
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 6 });
      await page.mouse.up();
      await expect.poll(async () => (await readScene(page)).camera).not.toEqual(before);
      const orbitPosition = (await readScene(page)).camera;
      await page.mouse.wheel(0, -200);
      await expect.poll(async () => (await readScene(page)).camera).not.toEqual(orbitPosition);
      await page.getByRole('button', { name: 'Back to system viewer' }).click();
      await expect(page).toHaveURL(/right:viewer-scene\/sol/);
      await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect.poll(() => readScene(page)).toMatchObject({ models: 1, genericPresent: true });
      expect(errors).toEqual([]);
    });
  }

  test('shows no replacement geometry while loading or after failure and retries the selected tier', async ({
    page,
  }) => {
    let releaseRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route('**/models/sol-mars-station-*.glb*', async (route) => {
      await pending;
      await route.abort('failed');
    });
    await openSystem(page);
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'loading');
    expect(await readScene(page)).toMatchObject({ models: 0, marsGenericPresent: false, genericPresent: true });
    releaseRequest();
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
    await expect(page.getByRole('alert')).toContainText('The station model could not be loaded.');
    expect(await readScene(page)).toMatchObject({ models: 0, marsGenericPresent: false, genericPresent: true });
    await page.unroute('**/models/sol-mars-station-*.glb*');
    await page.getByRole('button', { name: 'Retry station model' }).click();
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect.poll(() => readScene(page)).toMatchObject({ models: 1, genericPresent: true });
  });

  test('rehydrates a direct close-up from its market identifier, reports load failures, and rejects unknown stations', async ({
    page,
  }) => {
    const { mock } = await setupViewerSceneTest(page);
    const market = stationMarket(marsStation);
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: solarSystemGetResponse([]),
    }));
    mock.on('market-list-by-location-request', () => ({
      event: 'market-list-by-location-response',
      data: { success: true, markets: [market] },
    }));
    await page.route('**/models/sol-mars-station-*.glb*', (route) => route.abort('failed'));
    await page.goto('/splash(left:viewer//right:station-view/sol/sol-mars-orbit)');
    await expect(page.getByRole('heading', { name: 'Mars Orbital Market' })).toBeVisible();
    const status = page.getByTestId('station-view-status');
    await expect(status).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
    expect((await readScene(page)).models).toBe(0);
    await page.unroute('**/models/sol-mars-station-*.glb*');
    await page.getByRole('button', { name: 'Retry station model' }).click();
    await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect.poll(async () => (await readScene(page)).models).toBe(1);
    await page.goto('/splash(left:viewer//right:station-view/sol/another-mars-station)');
    await expect(page.getByTestId('station-view-error')).toContainText(
      'No dedicated model is available for this station.',
    );
    await expect(page.locator('app-station-view-page canvas')).toHaveCount(0);
  });
});

test.describe('Touch-accessible station close-ups', () => {
  test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });

  test('opens and leaves the station close-up using visible buttons', async ({ page }) => {
    await openSystem(page);
    await page.locator('tr', { hasText: 'Mars Orbital Market' }).locator('button.details-target-btn').tap();
    await expect(page.getByTestId('viewer-info-panel').getByRole('button', { name: 'Open close-up' })).toHaveCount(0);
    await page.getByTestId('viewer-inspect-target').tap();
    await page.getByRole('button', { name: 'Open close-up', exact: true }).tap();
    await expect(page).toHaveURL(/right:station-view\/sol\/sol-mars-orbit/);
    await expect(page.getByTestId('station-view-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Back to system viewer' }).tap();
    await new ViewerPage(page).expectSceneRoute();
  });
});
