import { expect, test, type Page } from '@playwright/test';
import type { Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three';
import type { MarketSummary } from '../../src/app/model/market-list';
import type { PairedNavigationEstimate, SolarSystemGetRequest, ViewerBody } from '../../src/app/model/solar-system-get';
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

test('plans and selects calculated routes with advisory markers', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { mock } = await setupViewerSceneTest(page);
  const candidate: ViewerBody = {
    id: 'sol-mars',
    bodyType: 'planet',
    displayName: 'Mars',
    surfaceArchetype: 'rocky',
    state: 'unscanned',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 100000000, y: 0, z: 0 }, epochMs: 1 },
  };
  const departure = ACTIVE_SHIP.spatial.positionKm;
  const destination = { x: 150000000, y: 0, z: 0 };
  const searchStartEpochMs = ACTIVE_SHIP.spatial.epochMs + 3_600_000;
  const cruiseSpeed = 12466.489225;
  const au = 149597870.7;
  const directDistance = 14959787071;
  const directDuration = Math.round((1000 * directDistance) / cruiseSpeed);
  let batchFailure: 'source_changed' | 'direct_numeric_failure' | null = null;
  const requestedModes: string[] = [];
  const previewRequests: SolarSystemGetRequest[] = [];
  const assessment = {
    level: 'warning',
    surveyStatus: 'incomplete',
    unresolvedBodyIds: ['sol-luna', 'sol-phobos'],
    unresolvedAssessments: [
      { bodyId: 'sol-luna', legIndex: 1, epochMs: 1715000000000, positionKm: departure, reason: 'profile_unavailable' },
      {
        bodyId: 'sol-phobos',
        legIndex: 1,
        epochMs: 1715000000000,
        positionKm: departure,
        reason: 'profile_unavailable',
      },
    ],
    markers: ['surface', 'atmosphere'].map((hazardType) => ({
      bodyId: 'sol-mars',
      hazardType,
      level: 'warning',
      explanation: 'Advisory warning',
      legIndex: 1,
      epochMs: 1715000000000,
      positionKm: { x: 100000000, y: 0, z: 0 },
      routeFraction: 0.5,
      distanceAlongLegKm: 500000,
      warningRadiusKm: 1000,
      approximation: 'coarse-spherical-moving-body-envelope-on-straight-leg',
      uncertainty: 'advisory-only-not-a-physical-clearance-guarantee',
    })),
  };
  mock.on('solar-system-get-request', (payload) => {
    const request = payload as SolarSystemGetRequest;
    const response = solarSystemGetResponse([candidate, marsStation]);
    if (!request.navigation) return { event: 'solar-system-get-response', data: response };
    previewRequests.push(request);
    return {
      event: 'solar-system-get-response',
      data: {
        ...response,
        navigationState: {
          status: 'supported',
          solarSystemId: 'sol',
          coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
          epochMs: ACTIVE_SHIP.spatial.epochMs,
          departure: { shipId: ACTIVE_SHIP.id, positionKm: departure },
          destination: { marketId: marsStation.id, positionKm: destination },
          candidates: [],
          previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
        },
        navigationEstimate: pairedDistanceEstimate(marsStation.id, 100000000),
      },
    };
  });
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(marsStation)] },
  }));
  mock.on('navigation-route-edge-batch-request', (payload) => {
    const request = payload as {
      correlationId: string;
      profileId: 'stellar-sol-station-100au-v1';
      navigationMode: 'ship-drive-normal' | 'bounded-preview-100au';
      jobs: Array<{
        jobId: string;
        prefixBodyIds: string[];
        prefixSides: Array<-1 | 1>;
        target: { kind: 'body' | 'market'; id: string };
        targetSide?: -1 | 1;
      }>;
    };
    requestedModes.push(request.navigationMode);
    if (batchFailure) {
      return {
        event: 'navigation-route-edge-batch-response',
        data: {
          success: false,
          message: 'Replan required',
          correlationId: request.correlationId,
          requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
          failure: { reason: batchFailure, message: 'Replan required' },
          batch: {
            status: 'failed',
            capture: null,
            clock: null,
            directReference: null,
            jobs: [],
            bounds: null,
            hazardSurvey: null,
            numericPrecision: null,
            completion: null,
          },
        },
      };
    }
    const previewOnly = request.navigationMode === 'bounded-preview-100au';
    const driveProfile = { id: 'drive', name: 'Drive', rangeAu: 2, cruiseSpeedAuPerHour: 1, fuelCostPerAu: 1 };
    const driveEligibility = previewOnly
      ? { status: 'not-applicable', reason: 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE', flightAuthorized: false }
      : { status: 'eligible', reason: 'WITHIN_SHIP_LEG_RANGE', flightAuthorized: false };
    const jobs = request.jobs.map((job) => {
      const bodyIds = job.target.kind === 'body' ? [...job.prefixBodyIds, job.target.id] : job.prefixBodyIds;
      const sides = job.target.kind === 'body' ? [...job.prefixSides, job.targetSide!] : job.prefixSides;
      const ids = [ACTIVE_SHIP.id, ...bodyIds, ...(job.target.kind === 'market' ? [job.target.id] : [])];
      let legStart = searchStartEpochMs;
      let position = departure;
      const legs = Array.from({ length: job.prefixBodyIds.length + 1 }, (_, index) => {
        const endpoint =
          job.target.kind === 'market' && job.prefixBodyIds.length === 0
            ? { x: departure.x + directDistance, y: departure.y, z: departure.z }
            : { x: (index + 1) * 200000000, y: 0, z: 0 };
        const distanceKm = Math.hypot(endpoint.x - position.x, endpoint.y - position.y, endpoint.z - position.z);
        const durationMs = Math.round((1000 * distanceKm) / cruiseSpeed);
        const leg = {
          legIndex: index + 1,
          fromBodyOrShipId: ids[index],
          toBodyOrMarketId: ids[index + 1],
          startPositionKm: position,
          endPositionKm: endpoint,
          departureEpochMs: legStart,
          arrivalEpochMs: legStart + durationMs,
          distanceKm,
          durationMs,
          fuelUnits: distanceKm / au,
          withinHopLimit: true,
          ...(!previewOnly ? { withinShipLegRange: distanceKm <= 2 * au, shipLegRangeKm: 2 * au } : {}),
          ...(index < bodyIds.length
            ? {
                encounter: {
                  bodyId: bodyIds[index],
                  side: sides[index],
                  encounterEpochMs: legStart + durationMs,
                  bodyCenterPositionKm: { ...endpoint, y: -10000 },
                  waypointPositionKm: endpoint,
                  offsetKm: { x: 0, y: 10000, z: 0 },
                  coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
                  positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
                  sourceRevision: 'b'.repeat(64),
                },
              }
            : {}),
        };
        position = endpoint;
        legStart += durationMs;
        return leg;
      });
      const exceeds = !previewOnly && legs.some((leg) => leg.distanceKm > 2 * au);
      return {
        success: true,
        jobId: job.jobId,
        prefixBodyIds: job.prefixBodyIds,
        prefixSides: job.prefixSides,
        sideHistory: bodyIds.map((bodyId, index) => ({ encounterIndex: index + 1, bodyId, side: sides[index] })),
        target: job.target,
        ...(job.target.kind === 'body' ? { targetSide: job.targetSide } : {}),
        eligible: !exceeds && legs.reduce((sum, leg) => sum + leg.distanceKm, 0) <= 100 * au,
        eligibilityReason: exceeds
          ? 'OUTSIDE_SHIP_LEG_RANGE'
          : legs.reduce((sum, leg) => sum + leg.distanceKm, 0) > 100 * au
            ? 'OUTSIDE_TOTAL_PATH_LIMIT'
            : 'WITHIN_PHASE3_BOUNDS',
        navigationMode: request.navigationMode,
        flightAuthorized: false,
        driveEligibility: exceeds
          ? {
              status: 'ineligible',
              reason: 'OUTSIDE_SHIP_LEG_RANGE',
              flightAuthorized: false,
            }
          : driveEligibility,
        totalDistanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
        totalDurationMs: legs.reduce((sum, leg) => sum + leg.durationMs, 0),
        fuelUnits: legs.reduce((sum, leg) => sum + leg.fuelUnits, 0),
        hazardAssessment: assessment,
        legs,
      };
    });
    return {
      event: 'navigation-route-edge-batch-response',
      data: {
        success: true,
        message: 'ok',
        correlationId: request.correlationId,
        requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
        batch: {
          status: 'supported',
          capture: {
            bootstrapId: 'capture',
            planningRevision: 'a'.repeat(64),
            shipId: ACTIVE_SHIP.id,
            shipRevision: 'c'.repeat(64),
            destinationMarketId: marsStation.id,
            candidateBodyIds: [candidate.id],
            shipPositionEpochMs: ACTIVE_SHIP.spatial.epochMs,
            departurePositionKm: departure,
            coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
            positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
            sourceRevision: 'b'.repeat(64),
            clockGeneration: 1,
            clockLineage: 'clock',
            searchStartEpochMs,
            profileId: request.profileId,
            profileVersion: 'v1',
            navigationMode: request.navigationMode,
            driveProfile,
            driveProfileRevision: 'd'.repeat(64),
            flightAuthorized: false,
          },
          clock: {
            status: 'supported',
            epochMs: searchStartEpochMs + requestedModes.length * 1000,
            timeScaleId: 'stellar:unix-ms-uniform:v1',
            running: true,
            generation: 1,
            lineage: 'clock',
            durability: 'durable-mongo-game-state',
          },
          bounds: {
            profileId: request.profileId,
            maxEligiblePathKm: 14959787070,
            maxLegDistanceKm: null,
            candidateDiscovery: 'automatic',
            candidateBodyCount: 1,
            maxEncounters: 5,
            maxLegs: 6,
            fuelUnitsPerAu: 1,
            cruiseSpeedKmPerSec: cruiseSpeed,
            maxJobs: 32,
            maxLogicalLegs: 192,
            maxTimeoutMs: 30000,
          },
          directReference: {
            status: 'supported',
            kind: 'direct-reference',
            departureEpochMs: searchStartEpochMs,
            arrivalEpochMs: searchStartEpochMs + directDuration,
            target: { kind: 'market', id: marsStation.id },
            departurePositionKm: departure,
            destinationPositionKm: { x: departure.x + directDistance, y: departure.y, z: departure.z },
            distanceKm: directDistance,
            durationMs: directDuration,
            fuelUnits: directDistance / au,
            eligible: false,
            eligibilityReason: previewOnly ? 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT' : 'OUTSIDE_SHIP_LEG_RANGE',
            navigationMode: request.navigationMode,
            flightAuthorized: false,
            driveEligibility: previewOnly
              ? driveEligibility
              : {
                  status: 'ineligible',
                  reason: 'OUTSIDE_SHIP_LEG_RANGE',
                  flightAuthorized: false,
                },
            hazardAssessment: assessment,
          },
          jobs,
          hazardSurvey: {
            surveyId: 'sol-hazard-survey-v1',
            status: 'incomplete',
            approximation: 'coarse-spherical-moving-body-warning-envelope',
            inventoryBodyIds: ['sol-mars'],
            profiles: [],
          },
          numericPrecision: {
            epochUnit: 'uniform-game-millisecond',
            positionUnit: 'kilometre',
            distanceUnit: 'kilometre',
            durationUnit: 'game-millisecond',
            fuelUnit: 'prototype-fuel-unit-per-AU',
            distanceRounding: 'IEEE-754-binary64-full-precision-response',
            epochRounding: 'Math.round-nearest-millisecond',
            finiteValueRequirement: 'all-output-numbers-must-be-finite',
          },
          completion: {
            mode: 'complete',
            submittedJobCount: request.jobs.length,
            completedJobCount: jobs.length,
            failedJobCount: 0,
            logicalLegCount: jobs.reduce((sum, job) => sum + job.prefixBodyIds.length + 1, 0),
          },
        },
      },
    };
  });
  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  await page.getByRole('button', { name: 'Plan route to Mars Orbital Market.' }).click();
  const search = page.getByTestId('navigation-route-search');
  const panel = page.getByTestId('navigation-preview');
  await expect(panel.getByLabel('Optional celestial candidate')).toHaveCount(0);
  await expect(panel.getByTestId('navigation-prediction')).toHaveCount(0);
  const ignoreLimits = search.getByLabel('Ignore drive limits (preview only)');
  await expect(ignoreLimits).not.toBeChecked();
  await expect(search.getByText('Ship drive range applies to each leg.', { exact: false })).toBeVisible();
  await expect(panel.getByTestId('navigation-direct-distance')).toBeVisible();
  await expect(panel.getByText('This snapshot does not estimate travel time.', { exact: true })).toBeVisible();
  await search.getByRole('button', { name: 'Plan Route', exact: true }).click();
  await expect(search.getByRole('button', { name: 'Direct reference', exact: true })).toBeVisible();
  await expect(search.getByText('Outside this ship’s per-leg drive range')).toBeVisible();
  await expect(panel.getByTestId('navigation-direct-distance')).toHaveCount(0);
  await expect(panel.getByText('Calculated time and fuel are game estimates', { exact: false })).toBeVisible();
  await expect(panel.getByText('It does not calculate clearance, travel time', { exact: false })).toHaveCount(0);
  await expect(panel.getByTestId('navigation-clearance-warning')).toBeVisible();
  await ignoreLimits.check();
  await expect(search.getByText('Ship drive eligibility is not checked.', { exact: false })).toBeVisible();
  await expect(search.getByText('Outside the 100 AU route limit')).toBeVisible();
  await expect(search.getByRole('combobox', { name: 'Order by' })).toHaveCount(0);
  const rows = search.locator('.navigation-route-choice');
  await expect(rows.locator('> button')).toHaveText([
    /Flybys:\s*Mars \(−\)/,
    /Flybys:\s*Mars \(\+\)/,
    'Direct reference',
  ]);
  for (const width of [540, 400, 280]) {
    await panel.evaluate((element, value) => {
      element.style.width = `${value}px`;
    }, width);
    const layout = await rows.evaluateAll((elements) =>
      elements.map((row) => {
        const cells = [
          ...row.querySelectorAll<HTMLElement>(
            '.navigation-route-choice__distance, .navigation-route-choice__time, .navigation-route-choice__fuel',
          ),
        ];
        return {
          left: cells.map((cell) => cell.getBoundingClientRect().left),
          overflow: [...row.querySelectorAll<HTMLElement>(':scope > *')].some(
            (cell) => cell.scrollWidth > cell.clientWidth + 1,
          ),
          rowOverflow: row.scrollWidth > row.clientWidth + 1,
        };
      }),
    );
    expect(layout).toHaveLength(3);
    for (const row of layout) {
      expect(row.left).toHaveLength(3);
      row.left.forEach((left, index) => expect(Math.abs(left - layout[0].left[index])).toBeLessThan(1));
      expect(row.overflow || row.rowOverflow).toBe(false);
    }
  }
  await panel.evaluate((element) => {
    element.style.width = '';
  });
  expect(requestedModes).toContain('ship-drive-normal');
  expect(requestedModes).toContain('bounded-preview-100au');
  await search.getByRole('button', { name: 'Flybys: Mars (−)' }).click();
  await expect(search.getByRole('button', { name: 'Flybys: Mars (−)' })).toHaveAttribute('aria-pressed', 'true');
  expect(previewRequests).toHaveLength(1);
  expect(previewRequests[0].navigation?.candidateBodyId).toBeUndefined();
  expect(previewRequests[0].navigationPrediction).toBeUndefined();
  await expect(search.getByText('Dotted links connect to stored Viewer snapshots', { exact: false })).toBeVisible();
  await expect(page.getByText('Mars at encounter · T+3.3 h')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector('app-viewer-scene-page ngt-canvas');
        if (!canvas || !window.ng) return false;
        const component = window.ng.getComponent(canvas) as { store: { snapshot: { scene: Scene } } };
        const scene = component.store.snapshot.scene;
        const marker = scene.getObjectByName('navigation-route-ghost-1-sol-mars');
        const link = scene.getObjectByName('navigation-route-ghost-link-1') as import('three').Line | undefined;
        const curve = scene.getObjectByName('navigation-route-illustration') as import('three').Line | undefined;
        const linkPoints = link?.geometry.getAttribute('position');
        return (
          !!scene.getObjectByName('navigation-route-direct-reference') &&
          !!scene.getObjectByName('navigation-route-selected') &&
          !!curve &&
          curve.geometry.drawRange.count === curve.geometry.getAttribute('position').count &&
          !!linkPoints &&
          Math.abs(linkPoints.getX(0) - (100000000 / 149597870.7) * 5) < 0.00001 &&
          Math.abs(linkPoints.getX(1) - (200000000 / 149597870.7) * 5) < 0.00001 &&
          !!marker &&
          Math.abs(marker.position.x - (200000000 / 149597870.7) * 5) < 0.00001 &&
          Math.abs(marker.position.z - (-10000 / 149597870.7) * 5) < 0.00001
        );
      }),
    )
    .toBe(true);
  await search.getByRole('button', { name: 'Mars: Atmosphere' }).click();
  await expect(search.getByText('Mars: Atmosphere — Advisory warning')).toBeVisible();
  await expect(search.getByText('Survey incomplete')).toBeVisible();
  await expect(search.getByRole('button', { name: 'sol-luna: Hazard assessment unresolved' })).toBeHidden();
  await search.getByText('2 unresolved assessments').click();
  await expect(search.getByRole('button', { name: 'sol-luna: Hazard assessment unresolved' })).toBeVisible();
  const warningBadge = page.getByRole('button', { name: /2 nearby warnings: Mars: Surface.*Mars: Atmosphere/ });
  await expect(warningBadge).toBeVisible();
  await expect(warningBadge).toHaveCSS('background-color', 'rgb(229, 163, 35)');
  await warningBadge.click({ timeout: 5000 });
  await expect(search.getByRole('status').filter({ hasText: '2 nearby warnings' })).toContainText(
    'Mars: Surface — Advisory warning',
  );
  await expect(search.getByRole('status').filter({ hasText: '2 nearby warnings' })).toContainText(
    'Mars: Atmosphere — Advisory warning',
  );
  await search.getByRole('button', { name: 'Mars: Surface' }).click();
  await expect(search.getByRole('status')).toHaveText('Mars: Surface — Advisory warning');
  await warningBadge.focus();
  await page.keyboard.press('Enter');
  await expect(search.getByRole('status').filter({ hasText: '2 nearby warnings' })).toContainText(
    'Mars: Surface — Advisory warning',
  );
  await expect(search.getByRole('status').filter({ hasText: '2 nearby warnings' })).toContainText(
    'Mars: Atmosphere — Advisory warning',
  );
  await expect(page.getByRole('button', { name: /unresolved assessments \(midpoint/ })).toHaveCount(0);
  await page.getByTestId('viewer-group-planets').uncheck();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector('app-viewer-scene-page ngt-canvas');
        if (!canvas || !window.ng) return false;
        const component = window.ng.getComponent(canvas) as { store: { snapshot: { scene: Scene } } };
        const scene = component.store.snapshot.scene;
        return (
          !!scene.getObjectByName('navigation-route-ghost-1-sol-mars') &&
          !scene.getObjectByName('navigation-route-ghost-link-1')
        );
      }),
    )
    .toBe(true);
  await search.getByRole('button', { name: 'Direct reference', exact: true }).click();
  await expect(page.getByText(/at encounter · T\+3.3 h/)).toHaveCount(0);
  await ignoreLimits.uncheck();
  await expect(search.getByText('Outside this ship’s per-leg drive range')).toBeVisible();
  await page.clock.install();
  for (const reason of ['source_changed', 'direct_numeric_failure'] as const) {
    batchFailure = reason;
    await search.getByRole('button', { name: 'Plan Route', exact: true }).click();
    await expect(search.getByRole('alert')).toContainText(reason);
    await expect(search.locator('.navigation-route-choice')).toHaveCount(0);
    await expect(panel.getByTestId('navigation-direct-distance')).toBeVisible();
    await expect(panel.getByText('This snapshot does not estimate travel time.', { exact: true })).toBeVisible();
    await expect(panel.getByText('Calculated time and fuel are game estimates', { exact: false })).toHaveCount(0);
    const requestCount = requestedModes.length;
    await page.clock.fastForward(60_000);
    expect(requestedModes).toHaveLength(requestCount);
    await expect(search.getByRole('button', { name: 'Plan Route', exact: true })).toBeEnabled();
  }
});

test('handles unavailable route replies without confusing correlation or transport state', async ({ page }) => {
  const { mock } = await setupViewerSceneTest(page);
  const routeRequests: string[] = [];
  mock.on('solar-system-get-request', (payload) => {
    const request = payload as SolarSystemGetRequest;
    const response = solarSystemGetResponse([marsStation]);
    return {
      event: 'solar-system-get-response',
      data: {
        ...response,
        ...(request.navigation ? {
          navigationState: {
            status: 'supported',
            solarSystemId: 'sol',
            coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
            epochMs: ACTIVE_SHIP.spatial.epochMs,
            departure: { shipId: ACTIVE_SHIP.id, positionKm: ACTIVE_SHIP.spatial.positionKm },
            destination: { marketId: marsStation.id, positionKm: { x: 150000000, y: 0, z: 0 } },
            candidates: [],
            previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
          },
          navigationEstimate: pairedDistanceEstimate(marsStation.id, 100000000),
        } : {}),
      },
    };
  });
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(marsStation)] },
  }));
  mock.on('navigation-route-edge-batch-request', (payload) => {
    const request = payload as { correlationId: string };
    routeRequests.push(request.correlationId);
    // Push directly so the fixture does not add missing correlation metadata.
    mock.push('navigation-route-edge-batch-response', {
      success: false,
      message: 'Game unavailable',
      availability: 'unavailable',
      reason: 'startup_not_verified',
      ...(routeRequests.length > 1 ? { correlationId: request.correlationId } : {}),
      ...(routeRequests.length > 2 ? {
        requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      } : {}),
    });
    return null;
  });

  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  await page.getByRole('button', { name: 'Plan route to Mars Orbital Market.' }).click();
  const search = page.getByTestId('navigation-route-search');
  const plan = search.getByRole('button', { name: 'Plan Route', exact: true });
  await expect(plan).toBeEnabled();
  await page.clock.install();
  await plan.click();
  await expect.poll(() => routeRequests.length).toBe(1);
  await expect(plan).toBeDisabled();
  await expect(search.getByRole('alert')).toHaveCount(0);
  await page.clock.fastForward(30_000);
  await expect(search.getByRole('alert')).toContainText('DIRECT_REFERENCE_UNAVAILABLE');
  await expect(plan).toBeEnabled();

  await plan.click();
  await expect.poll(() => routeRequests.length).toBe(2);
  await expect(search.getByRole('alert')).toContainText('startup_not_verified');
  await expect(search.getByRole('alert')).toContainText('Game unavailable');
  await expect(search.getByRole('alert')).not.toContainText('INVALID_RESPONSE');
  await expect(search.locator('.navigation-route-choice')).toHaveCount(0);
  await expect(plan).toBeEnabled();
  mock.push('navigation-route-edge-batch-response', {
    success: false,
    message: 'Game unavailable',
    availability: 'unavailable',
    reason: 'startup_not_verified',
    correlationId: routeRequests[0],
  });
  await page.clock.fastForward(60_000);
  await expect(search.getByRole('alert')).toContainText('startup_not_verified');
  expect(routeRequests).toHaveLength(2);
  await expect(page.getByTestId('navigation-preview')).toBeVisible();
  await plan.click();
  await expect.poll(() => routeRequests.length).toBe(3);
  await expect(search.getByRole('alert')).toContainText('startup_not_verified');
  await expect(plan).toBeEnabled();
});

test('blocks route planning for an ineligible navigation preview', async ({ page }) => {
  const { mock } = await setupViewerSceneTest(page);
  let routeRequests = 0;
  mock.on('solar-system-get-request', (payload) => {
    const request = payload as SolarSystemGetRequest;
    const response = solarSystemGetResponse([marsStation]);
    if (!request.navigation) return { event: 'solar-system-get-response', data: response };
    return {
      event: 'solar-system-get-response',
      data: {
        ...response,
        navigationState: {
          status: 'supported',
          solarSystemId: 'sol',
          coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
          epochMs: ACTIVE_SHIP.spatial.epochMs,
          departure: { shipId: ACTIVE_SHIP.id, positionKm: ACTIVE_SHIP.spatial.positionKm },
          destination: { marketId: marsStation.id, positionKm: { x: 150000000, y: 0, z: 0 } },
          candidates: [],
          previewEligibility: { status: 'ineligible', reason: 'KNOWN_INVALID_DESTINATION' },
        },
      },
    };
  });
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(marsStation)] },
  }));
  mock.on('navigation-route-edge-batch-request', () => {
    routeRequests += 1;
    return null;
  });
  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  await page.getByRole('button', { name: 'Plan route to Mars Orbital Market.' }).click();
  await expect(page.getByTestId('navigation-preview-ineligible')).toContainText('KNOWN_INVALID_DESTINATION');
  await expect(page.getByTestId('navigation-route-search').getByRole('button', { name: 'Plan Route' })).toBeDisabled();
  expect(routeRequests).toBe(0);
});

test('clears the previous A-to-B preview when changing destinations', async ({ page }) => {
  const { mock } = await setupViewerSceneTest(page);
  let replacementRequest: SolarSystemGetRequest | undefined;
  mock.on('solar-system-get-request', (payload) => {
    const request = payload as SolarSystemGetRequest;
    const response = solarSystemGetResponse([marsStation, genericStation]);
    if (!request.navigation) return { event: 'solar-system-get-response', data: response };
    if (request.navigation.destinationMarketId === genericStation.id) {
      replacementRequest = request;
      return null;
    }
    return {
      event: 'solar-system-get-response',
      data: {
        ...response,
        navigationState: {
          status: 'supported',
          solarSystemId: 'sol',
          coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
          epochMs: ACTIVE_SHIP.spatial.epochMs,
          departure: { shipId: ACTIVE_SHIP.id, positionKm: ACTIVE_SHIP.spatial.positionKm },
          destination: { marketId: marsStation.id, positionKm: { x: 200_000_000, y: 50_000_000, z: 0 } },
          candidates: [],
          previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
        },
        navigationEstimate: pairedDistanceEstimate(marsStation.id, 158_113_883.008),
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
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText('158,113,883.008 km');
  await expect(panel.getByTestId('navigation-direct-distance')).toContainText(
    'This snapshot does not estimate travel time.',
  );
  const destinationLabel = 'Projected destination: Mars Orbital Market — 1715000000000 ms';
  await expect(page.getByText(destinationLabel, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plan route to Other Mars Station.' }).click();
  await expect(panel.getByTestId('navigation-preview-loading')).toBeVisible();
  await expect(page.getByText(destinationLabel, { exact: true })).toHaveCount(0);
  await expect.poll(() => replacementRequest !== undefined).toBe(true);
  if (!replacementRequest) throw new Error('Replacement navigation request was not received.');
  mock.push('solar-system-get-response', {
    ...solarSystemGetResponse([marsStation, genericStation]),
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
  await panel.getByRole('button', { name: 'Clear route preview' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByText(replacementLabel, { exact: true })).toHaveCount(0);
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
