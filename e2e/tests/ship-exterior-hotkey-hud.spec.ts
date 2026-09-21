import { expect, test, type Page } from '@playwright/test';
import type { ShipExteriorBareSceneTestApi } from '../../src/app/scene/ship-exterior/ship-exterior-bare-scene-test-api';
import {
  configureShipExteriorHotkeyHudMock,
  SHIP_EXTERIOR_HOTKEY_HUD_LAUNCHABLE_DISPLAY_NAME,
} from '../fixtures/ship-exterior-hotkey-hud-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

declare global {
  interface Window {
    __shipExteriorBareSceneTestUtils?: ShipExteriorBareSceneTestApi;
  }
}

type HotkeyEntry = { key: string; action: string; state: 'available' | 'disabled' | 'pressed' };

const scene = (page: Page) => page.locator('.ship-exterior-bare-scene');
const flightToggle = (page: Page) => page.locator('.ship-exterior-bare-scene__flight-btn');
const pilotCanvas = (page: Page) => scene(page).locator('canvas.ship-scene-canvas');
const hotkeyRow = (page: Page) => page.locator('.ship-exterior-bare-scene__hotkeys');
const launchToast = (page: Page) => page.locator('.ship-exterior-bare-scene__toast');
const debugButton = (page: Page) => page.getByRole('button', { name: 'Debug' });
const debugDrawer = (page: Page) => page.getByRole('dialog', { name: 'Ship scene diagnostics' });

const EXPECTED_HOTKEY_ORDER = [
  'MOUSE HOVER',
  'RMB HOLD',
  'W',
  'A',
  'S',
  'D',
  'SPACE',
  'CTRL / C',
  'SHIFT',
  '1',
  '2',
  '3',
  '4',
  '5',
  'ESC',
  'Q',
  'E',
] as const;

/** Launch emissions observed by the socket mock, reset before each test. */
const launchRequests: Array<{ hotkey?: number; itemId?: string }> = [];

async function readHotkeyEntries(page: Page): Promise<HotkeyEntry[]> {
  return page.evaluate(() => {
    const row = document.querySelector('.ship-exterior-bare-scene__hotkeys');
    if (!row) {
      return [] as HotkeyEntry[];
    }
    return Array.from(row.querySelectorAll('.ship-exterior-bare-scene__hotkey')).map((entry) => ({
      key: entry.querySelector('.ship-exterior-bare-scene__hotkey-key')?.textContent?.trim() ?? '',
      action: entry.querySelector('.ship-exterior-bare-scene__hotkey-action')?.textContent?.trim() ?? '',
      state: entry.classList.contains('ship-exterior-bare-scene__hotkey--pressed')
        ? 'pressed'
        : entry.classList.contains('ship-exterior-bare-scene__hotkey--disabled')
          ? 'disabled'
          : 'available',
    })) as HotkeyEntry[];
  });
}

async function readHotkeyStates(page: Page, keys: readonly string[]): Promise<Record<string, string>> {
  const entries = await readHotkeyEntries(page);
  const states: Record<string, string> = {};
  for (const key of keys) {
    states[key] = entries.find((entry) => entry.key === key)?.state ?? 'missing';
  }
  return states;
}

function expectHotkeyStates(page: Page, expected: Record<string, string>) {
  return expect.poll(() => readHotkeyStates(page, Object.keys(expected)), { timeout: 5_000 }).toEqual(expected);
}

/**
 * Boots the ship exterior bare scene with a frozen clock.
 *
 * The clock is paused only after the scene has produced asteroid samples so the
 * cold-boot seeding is not starved, and so that the short hotkey press-flash
 * windows never expire mid-assertion.
 */
async function openHotkeyHudScene(page: Page, mock: SocketIOMock): Promise<void> {
  await page.clock.install();
  await mock.setup();
  configureShipExteriorHotkeyHudMock(mock, {
    onLaunchItemRequest: (request) => {
      launchRequests.push(request);
    },
  });

  await loginViaUI(page, mock);
  await new GameShellPage(page).joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });
  await expect(pilotCanvas(page)).toBeVisible();
  await expect(flightToggle(page)).toHaveText(/FLIGHT: CAPTURE \/\/ FREE/, { timeout: 15_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            Boolean(window.__shipExteriorBareSceneTestUtils?.snapshotActiveContext()) &&
            (window.__shipExteriorBareSceneTestUtils?.legacy.getAsteroidSamples().length ?? 0) > 0,
        ),
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
}

/**
 * Captures the canvas through a real left click so pointer lock (CAPTURE mode)
 * is granted by the browser rather than simulated.
 */
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
  await page.evaluate(() => document.dispatchEvent(new Event('pointerlockchange')));
  await page.clock.fastForward(16);
}

/**
 * Escape is reserved by the browser while pointer lock is held, so the release
 * is driven at the same window keydown boundary the component listens on. This
 * keeps the assertion about the app's own handler rather than browser policy.
 */
async function pressEscapeAtInputBoundary(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
  });
  await page.clock.fastForward(16);
}

test.describe('Ship Exterior — hotkey HUD', () => {
  test.beforeEach(() => {
    launchRequests.length = 0;
  });

  test('reflects FREE/CAPTURE availability, press feedback, and launch slot payloads in one clipped row', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    await openHotkeyHudScene(page, mock);

    // --- Row composition: fixed set, stable order, and no flight-toggle key. ---
    await expect(hotkeyRow(page)).toBeVisible();
    const initialEntries = await readHotkeyEntries(page);
    expect(initialEntries.map((entry) => entry.key)).toEqual([...EXPECTED_HOTKEY_ORDER]);
    expect(initialEntries.map((entry) => entry.key)).not.toContain('F');

    // --- FREE mode: mouse entries usable, ESC unusable, movement usable. ---
    await expectHotkeyStates(page, {
      'MOUSE HOVER': 'available',
      'RMB HOLD': 'available',
      ESC: 'disabled',
      W: 'available',
      A: 'available',
      S: 'available',
      D: 'available',
      SPACE: 'available',
      'CTRL / C': 'available',
      SHIFT: 'available',
    });

    // --- KeyF is retired: it neither appears nor toggles flight mode. ---
    await page.keyboard.press('KeyF');
    await expect(flightToggle(page)).toHaveText(/FLIGHT: CAPTURE \/\/ FREE/);
    expect((await readHotkeyEntries(page)).map((entry) => entry.key)).toEqual([...EXPECTED_HOTKEY_ORDER]);
    expect(
      await page.evaluate(() => window.__shipExteriorBareSceneTestUtils?.snapshotActiveContext()?.flightModeEnabled),
    ).toBe(true);

    // --- Movement and boost report a pressed state while held. ---
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Shift');
    await page.clock.fastForward(16);
    try {
      await expectHotkeyStates(page, { W: 'pressed', SHIFT: 'pressed', S: 'available', A: 'available' });
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('Shift');
      await page.clock.fastForward(16);
    }
    await expectHotkeyStates(page, { W: 'available', SHIFT: 'available' });

    // --- RMB reports pressed only while the right button is held on the canvas. ---
    const canvasBox = await pilotCanvas(page).boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.move(canvasBox!.x + 20, canvasBox!.y + 20);
    await page.mouse.down({ button: 'right' });
    await page.clock.fastForward(16);
    try {
      await expectHotkeyStates(page, { 'RMB HOLD': 'pressed', 'MOUSE HOVER': 'available' });
    } finally {
      await page.mouse.up({ button: 'right' });
      await page.clock.fastForward(16);
    }
    await expectHotkeyStates(page, { 'RMB HOLD': 'available' });

    // --- Launch slots: payload names on filled slots, Empty on the rest. ---
    const slotActions = (await readHotkeyEntries(page))
      .filter((entry) => ['1', '2', '3', '4', '5'].includes(entry.key))
      .map((entry) => entry.action);
    expect(slotActions).toEqual([
      `Launch ${SHIP_EXTERIOR_HOTKEY_HUD_LAUNCHABLE_DISPLAY_NAME}`,
      'Empty',
      'Empty',
      'Empty',
      'Empty',
    ]);
    await expectHotkeyStates(page, { '1': 'disabled', '2': 'disabled', '5': 'disabled' });

    // --- With a valid target, only the slot holding a payload becomes usable. ---
    await page.evaluate(() => {
      const api = window.__shipExteriorBareSceneTestUtils;
      const sample = api?.legacy.getAsteroidSamples()[0];
      if (!api || !sample || !api.legacy.forceTargetAsteroid(sample.id)) {
        throw new Error('Expected the ship-exterior test API to target an asteroid.');
      }
    });
    await page.clock.fastForward(16);
    await debugButton(page).evaluate((button: HTMLButtonElement) => button.click());
    await page.clock.fastForward(1);
    await expect(debugButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(debugDrawer(page)).toBeFocused();
    await expect(debugDrawer(page)).toContainText(/TARGET: (?!none)\S+/);
    await debugDrawer(page)
      .getByRole('button', { name: 'Close' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await page.clock.fastForward(1);
    await expect(debugDrawer(page)).toBeHidden();
    await expectHotkeyStates(page, {
      '1': 'available',
      '2': 'disabled',
      '3': 'disabled',
      '4': 'disabled',
      '5': 'disabled',
    });

    // --- An empty Digit slot must not fall back to slot 1. ---
    await page.keyboard.press('Digit3');
    await page.clock.fastForward(16);
    await expect(launchToast(page)).toHaveText(/hotkey 3 has no launchable item assigned/);
    expect(launchRequests).toEqual([]);
    await expectHotkeyStates(page, { '3': 'disabled', '1': 'available' });

    // --- CAPTURE mode flips the mouse entries off and turns ESC on. ---
    await capturePilotPointer(page);
    await expect(flightToggle(page)).toHaveText(/FLIGHT: CAPTURE \/\/ LOCKED/);
    await expectHotkeyStates(page, {
      'MOUSE HOVER': 'disabled',
      'RMB HOLD': 'disabled',
      ESC: 'available',
      W: 'available',
    });

    // --- Escape flashes pressed while it releases capture, then settles back. ---
    await pressEscapeAtInputBoundary(page);
    await expectHotkeyStates(page, { ESC: 'pressed' });
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null), { timeout: 5_000 }).toBe(true);
    await page.clock.fastForward(500);
    await page.clock.fastForward(16);
    await expectHotkeyStates(page, {
      ESC: 'disabled',
      'MOUSE HOVER': 'available',
      'RMB HOLD': 'available',
    });

    // --- Layout: a single fixed-height clipped row that cannot scroll sideways. ---
    const layout = await page.evaluate(() => {
      const row = document.querySelector('.ship-exterior-bare-scene__hotkeys') as HTMLElement | null;
      if (!row) {
        throw new Error('Expected the ship-exterior hotkey row.');
      }
      const style = getComputedStyle(row);
      const entries = Array.from(row.querySelectorAll<HTMLElement>('.ship-exterior-bare-scene__hotkey'));
      return {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        flexWrap: style.flexWrap,
        heightPx: Math.round(row.getBoundingClientRect().height),
        // Entries must keep their intrinsic width so overflow is clipped rather
        // than squeezed into an unreadable second-guessable layout.
        entryFlexShrink: entries.map((entry) => getComputedStyle(entry).flexShrink),
        distinctEntryTops: new Set(entries.map((entry) => Math.round(entry.getBoundingClientRect().top))).size,
        verticalOverflowPx: row.scrollHeight - row.clientHeight,
        entryCount: entries.length,
      };
    });

    expect(layout.entryCount).toBe(EXPECTED_HOTKEY_ORDER.length);
    // overflow-x: hidden is what makes the row non-scrollable for the user.
    expect(layout.overflowX).toBe('hidden');
    expect(layout.overflowY).toBe('hidden');
    expect(layout.flexWrap).toBe('nowrap');
    expect(layout.heightPx).toBe(40);
    expect(layout.distinctEntryTops).toBe(1);
    expect(layout.verticalOverflowPx).toBeLessThanOrEqual(1);
    expect(new Set(layout.entryFlexShrink)).toEqual(new Set(['0']));
  });
});
