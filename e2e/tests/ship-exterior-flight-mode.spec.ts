import { expect, test, type Page } from '@playwright/test';
import type { ShipExteriorBareSceneTestApi } from '../../src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api';
import type { ShipSceneRuntimeSnapshot } from '../../src/app/scene/ship-exterior/ship-scene-types';
import { configureFlightModeMock } from '../fixtures/ship-exterior-flight-mode-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const shipExteriorScene = (page: Page) => page.locator('.ship-exterior-bare-scene');
const flightToggle = (page: Page) => page.locator('.ship-exterior-bare-scene__flight-btn');
const pilotCanvas = (page: Page) => shipExteriorScene(page).locator('canvas.ship-scene-canvas');

declare global {
  interface Window {
    __shipExteriorBareSceneTestUtils?: ShipExteriorBareSceneTestApi;
  }
}

const COORDS_PATTERN = /COORD KM\s*\/\/\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;

async function readCoordZ(page: Page): Promise<number | null> {
  const text = (await shipExteriorScene(page).innerText()).trim();
  const match = text.match(COORDS_PATTERN);
  if (!match) {
    return null;
  }
  return Number(match[3]);
}

async function readCoords(page: Page): Promise<{ x: number; y: number; z: number } | null> {
  const text = (await shipExteriorScene(page).innerText()).trim();
  const match = text.match(COORDS_PATTERN);
  if (!match) {
    return null;
  }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    z: Number(match[3]),
  };
}

async function waitForFlightTelemetryReady(page: Page): Promise<void> {
  await expect.poll(() => readCoordZ(page), { timeout: 10_000 }).not.toBeNull();
}

async function openPilotSceneWithClock(page: Page): Promise<void> {
  await page.clock.install();
  const mock = new SocketIOMock(page);
  await mock.setup();
  configureFlightModeMock(mock);
  await loginViaUI(page, mock);
  await new GameShellPage(page).joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });
  await expect(pilotCanvas(page)).toBeVisible();
  await expect(flightToggle(page)).toHaveText(/FLIGHT: CAPTURE/);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__shipExteriorBareSceneTestUtils?.snapshotActiveContext())))
    .toBe(true);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}

async function readPilotSnapshot(page: Page): Promise<ShipSceneRuntimeSnapshot> {
  return page.evaluate(() => {
    const snapshot = window.__shipExteriorBareSceneTestUtils?.snapshotActiveContext();
    if (!snapshot) {
      throw new Error('Expected an initialized ship-exterior runtime snapshot.');
    }
    return snapshot;
  });
}

async function capturePilotPointer(page: Page): Promise<void> {
  await pilotCanvas(page).click({ position: { x: 20, y: 20 } });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector('.ship-exterior-bare-scene canvas.ship-scene-canvas');
        return canvas !== null && document.pointerLockElement === canvas;
      }),
    )
    .toBe(true);
}

async function steerByMouseDelta(page: Page, movementX: number, movementY: number): Promise<void> {
  // Real pointer lock gates steering; synthetic deltas avoid OS pointer acceleration
  // and dispatch once at the window input boundary rather than mutating ship state.
  await page.evaluate(
    (delta) => window.dispatchEvent(new MouseEvent('mousemove', delta)),
    { movementX, movementY },
  );
}

async function setKnownSteeringSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    const api = window.__shipExteriorBareSceneTestUtils;
    if (!api) {
      throw new Error('Expected the ship-exterior test API.');
    }
    api.setFlightInvertY(false);
    api.setFlightMouseSensitivityFromSliderValue(100);
  });
}

test.describe('Ship Exterior — flight mode smoke', () => {
  test('steers yaw and pitch without orbiting or translating, and ignores unlocked mouse steering', async ({ page }) => {
    await openPilotSceneWithClock(page);
    await setKnownSteeringSettings(page);
    await capturePilotPointer(page);
    const before = await readPilotSnapshot(page);
    expect(before.cameraPosition).toEqual({ x: 0, y: 0, z: 0 });
    expect(before.flightWorldRotation.x).toBeCloseTo(0, 4);
    expect(before.flightWorldRotation.y).toBeCloseTo(0, 4);
    expect(before.flightWorldRotation.z).toBeCloseTo(0, 4);

    await steerByMouseDelta(page, -50, -30);
    await page.clock.fastForward(100);
    const steered = await readPilotSnapshot(page);
    expect(steered.flightWorldRotation.x).toBeCloseTo(-0.3, 4);
    expect(steered.flightWorldRotation.y).toBeCloseTo(-0.5, 4);
    expect(steered.flightWorldRotation.z).toBeCloseTo(0, 4);
    expect(steered.cameraPosition).toEqual(before.cameraPosition);
    expect(steered.flightCurrentLocationKm).toEqual(before.flightCurrentLocationKm);
    expect(steered.renderedFrameCount).toBeGreaterThan(before.renderedFrameCount);

    await page.evaluate(() => document.exitPointerLock());
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    await steerByMouseDelta(page, 100, 100);
    await page.clock.fastForward(100);
    const unlocked = await readPilotSnapshot(page);
    expect(unlocked.flightWorldRotation).toEqual(steered.flightWorldRotation);
    expect(unlocked.cameraPosition).toEqual(before.cameraPosition);
    expect(unlocked.flightCurrentLocationKm).toEqual(before.flightCurrentLocationKm);
  });

  test('moves forward, reverse, strafe, and vertically along the steered ship axes', async ({ page }) => {
    await openPilotSceneWithClock(page);
    await setKnownSteeringSettings(page);
    await capturePilotPointer(page);
    await steerByMouseDelta(page, -50, -30);
    const steered = await readPilotSnapshot(page);
    expect(steered.flightWorldRotation.x).toBeCloseTo(-0.3, 4);
    expect(steered.flightWorldRotation.y).toBeCloseTo(-0.5, 4);

    // Independent expected axes for yaw=0.5, pitch=0.3, roll=0 (YXZ).
    const forward = [-Math.sin(0.5) * Math.cos(0.3), Math.sin(0.3), -Math.cos(0.5) * Math.cos(0.3)];
    const right = [Math.cos(0.5), 0, -Math.sin(0.5)];
    const up = [Math.sin(0.5) * Math.sin(0.3), Math.cos(0.3), Math.cos(0.5) * Math.sin(0.3)];
    const movements = [
      { key: 'KeyW', axis: forward, sign: 1 },
      { key: 'KeyS', axis: forward, sign: -1 },
      { key: 'KeyD', axis: right, sign: 1 },
      { key: 'KeyA', axis: right, sign: -1 },
      { key: 'Space', axis: up, sign: 1 },
      { key: 'ControlLeft', axis: up, sign: -1 },
    ];
    for (const { key, axis, sign } of movements) {
      await test.step(`${key} follows the ship-local axis`, async () => {
        const before = await readPilotSnapshot(page);
        await page.keyboard.down(key);
        try {
          // fastForward need not execute every timer tick: direction, not elapsed
          // distance, is the invariant under test.
          await page.clock.fastForward(100);
        } finally {
          await page.keyboard.up(key);
        }
        const after = await readPilotSnapshot(page);
        const delta = [
          after.flightCurrentLocationKm.x - before.flightCurrentLocationKm.x,
          after.flightCurrentLocationKm.y - before.flightCurrentLocationKm.y,
          after.flightCurrentLocationKm.z - before.flightCurrentLocationKm.z,
        ];
        const length = Math.hypot(...delta);
        expect(length).toBeGreaterThan(0.000001);
        delta.forEach((value, index) => expect(value / length).toBeCloseTo(axis[index] * sign, 3));
        expect(after.cameraPosition).toEqual(steered.cameraPosition);
        expect(after.flightWorldRotation).toEqual(steered.flightWorldRotation);
        await page.clock.fastForward(100);
        const released = await readPilotSnapshot(page);
        expect(released.flightCurrentLocationKm).toEqual(after.flightCurrentLocationKm);
        expect(released.flightSpeedKmPerSec).toBe(0);
      });
    }
    await page.evaluate(() => document.exitPointerLock());
  });

  test('releases capture and held movement on blur, and only recaptures on a canvas click', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    configureFlightModeMock(mock);
    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });
    await expect(shipExteriorScene(page)).toBeVisible();
    await waitForFlightTelemetryReady(page);
    await page.clock.install();

    const canvas = shipExteriorScene(page).locator('canvas.ship-scene-canvas');
    await canvas.click({ position: { x: 20, y: 20 } });
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement?.classList.contains('ship-scene-canvas') ?? false))
      .toBe(true);
    const initialCoords = await readCoords(page);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Shift');
    try {
      await page.clock.fastForward(100);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
      await page.clock.fastForward(200);
      const stoppedCoords = await readCoords(page);
      expect(stoppedCoords).not.toBeNull();
      expect(stoppedCoords).not.toEqual(initialCoords);

      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.clock.fastForward(1000);
      expect(await readCoords(page)).toEqual(stoppedCoords);
      await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('Shift');
    }

    await flightToggle(page).click();
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    await canvas.click({ position: { x: 20, y: 20 } });
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement?.classList.contains('ship-scene-canvas') ?? false))
      .toBe(true);
    await page.evaluate(() => document.exitPointerLock());
  });

  test('integrates WASD movement with always-active pilot controls', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    configureFlightModeMock(mock);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });

    const toggle = flightToggle(page);
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);
    await expect(toggle).toHaveText(/FLIGHT: CAPTURE/);
    const coordsBeforeEnable = await readCoords(page);
    expect(coordsBeforeEnable).not.toBeNull();

    // Pilot movement is enabled as soon as the exterior scene is ready.
    await expect.poll(() => readCoords(page)).toEqual(coordsBeforeEnable);

    // --- Hold W then S; they should drive Z in opposite directions. ---
    const zBaseline = coordsBeforeEnable?.z ?? 0;

    await page.keyboard.down('KeyW');
    let zAfterW: number | null = null;
    try {
      await expect
        .poll(
          async () => {
            const z = await readCoordZ(page);
            if (z === null || z === zBaseline) {
              return false;
            }
            zAfterW = z;
            return true;
          },
          { timeout: 5_000 },
        )
        .toBe(true);
    } finally {
      await page.keyboard.up('KeyW');
    }

    expect(zAfterW).not.toBeNull();
    if (zAfterW === null) {
      throw new Error('Expected W movement to update Z telemetry.');
    }
    expect(zAfterW).not.toBe(zBaseline);
    const wDelta = zAfterW - zBaseline;

    await page.keyboard.down('KeyS');
    try {
      await expect
        .poll(
          async () => {
            const z = await readCoordZ(page);
            if (z === null) {
              return false;
            }
            return wDelta > 0 ? z < zAfterW : z > zAfterW;
          },
          { timeout: 5_000 },
        )
        .toBe(true);
    } finally {
      await page.keyboard.up('KeyS');
    }

    // The status control must not restore the retired orbit camera.
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT: CAPTURE/);

    // Keyboard activation does not acquire pointer lock.
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement === null), { timeout: 5_000 })
      .toBe(true);
  });

  test('Escape releases an actually captured canvas without losing heading or automatically recapturing', async ({ page }) => {
    await openPilotSceneWithClock(page);
    await setKnownSteeringSettings(page);
    await capturePilotPointer(page);
    await steerByMouseDelta(page, -50, -30);
    const beforeEscape = await readPilotSnapshot(page);
    expect(beforeEscape.flightWorldRotation.y).toBeCloseTo(-0.5, 4);

    await page.keyboard.down('KeyW');
    await page.keyboard.down('Shift');
    try {
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
      await page.clock.fastForward(100);
      const stopped = await readPilotSnapshot(page);
      expect(stopped.flightSpeedKmPerSec).toBe(0);
      expect(stopped.flightCurrentLocationKm).toEqual(beforeEscape.flightCurrentLocationKm);
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('Shift');
    }
    await expect(flightToggle(page)).toHaveText(/FLIGHT: CAPTURE/);
    await steerByMouseDelta(page, 80, 60);
    await page.clock.fastForward(1000);
    const afterEscape = await readPilotSnapshot(page);
    expect(afterEscape.flightWorldRotation).toEqual(beforeEscape.flightWorldRotation);
    expect(afterEscape.cameraPosition).toEqual(beforeEscape.cameraPosition);
    expect(afterEscape.flightCurrentLocationKm).toEqual(beforeEscape.flightCurrentLocationKm);
    expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  });
});
