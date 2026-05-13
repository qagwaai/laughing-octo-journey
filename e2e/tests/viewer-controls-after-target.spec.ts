import { expect, test, type Locator, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

const CHARACTER = {
  id: 'char-vw-controls-1',
  characterName: 'Control Probe',
  level: 2,
  missions: [{ missionId: 'first-target', status: 'completed' }],
};

const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  isMultiStar: false,
  starCount: 1,
  distanceParsec: 0,
  primaryStar: { hygId: '0', spectralClass: 'G2V', colorHex: '#fff5b6', luminositySolar: 1, massSolar: 1 },
};

const SOL_SYSTEM_RESPONSE = {
  success: true,
  message: 'ok',
  playerName: TEST_PLAYER,
  solarSystemId: 'sol',
  solarSystem: SOL_SUMMARY,
  stars: [
    {
      id: 'sun',
      bodyType: 'star',
      displayName: 'Sol',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#fff5b6' },
      spectralClass: 'G2V',
      luminositySolar: 1,
    },
  ],
  bodies: [
    {
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 149_597_870, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#3399ff' },
      physicalCatalog: { estimatedDiameterM: 12_742_000 },
      orbitalElements: {
        anchorBodyId: 'sun',
        semiMajorAxisKm: 149_597_870,
        eccentricity: 0.0167,
        inclinationDeg: 0,
        longitudeOfAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 102.9,
        meanAnomalyAtEpochDeg: 100.5,
      },
    },
    {
      id: 'mars',
      bodyType: 'planet',
      displayName: 'Mars',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 227_923_661, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#c1440e' },
      physicalCatalog: { estimatedDiameterM: 6_792_000 },
    },
  ],
};

async function getCanvasFrameSignature(canvas: Locator): Promise<string> {
  const image = await canvas.screenshot();
  return image.toString('base64');
}

async function setupViewer(page: Page): Promise<void> {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [CHARACTER],
    },
  }));

  mock.on('game-join-request', () => null);
  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: 'ok',
      playerName: TEST_PLAYER,
      solarSystems: [SOL_SUMMARY],
    },
  }));

  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: SOL_SYSTEM_RESPONSE,
  }));

  await loginViaUI(page, mock);

  await page.locator('.character-item button.join-link').first().click();
  await expect(page).toHaveURL(/left:game-main/);

  const viewerButton = page.locator('button[aria-label="Viewer"]').first();
  await expect(viewerButton).toBeVisible({ timeout: 10_000 });
  await viewerButton.click();
  await expect(page).toHaveURL(/left:viewer/);

  await page.locator('.solar-system-item__button', { hasText: 'Sol' }).first().click();
  await expect(page).toHaveURL(/left:solar-system-details/);
  await expect(page).toHaveURL(/right:viewer-scene/);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('Viewer controls after target completion', () => {
  test('keeps rotate, zoom, and pan usable after target-fly settles', async ({ page }) => {
    await setupViewer(page);

    const targetEarthButton = page
      .locator('tr', { hasText: 'Earth' })
      .first()
      .locator('button.details-target-btn')
      .first();
    await expect(targetEarthButton).toBeVisible({ timeout: 10_000 });
    await targetEarthButton.click();
    await expect(targetEarthButton).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(4_200);

    const canvas = page.locator('canvas').first();
    const initialFrame = await getCanvasFrameSignature(canvas);
    expect(initialFrame.length).toBeGreaterThan(500);

    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    const centerX = (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2;
    const centerY = (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(centerX + 120, centerY + 30, { steps: 12 });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(450);
    const afterRotateFrame = await getCanvasFrameSignature(canvas);
    expect(afterRotateFrame).not.toBe(initialFrame);

    await page.mouse.wheel(0, -800);
    await page.waitForTimeout(450);
    const afterZoomFrame = await getCanvasFrameSignature(canvas);
    expect(afterZoomFrame).not.toBe(afterRotateFrame);

    const panX = (bounds?.x ?? 0) + 24;
    const panY = (bounds?.y ?? 0) + 24;
    await page.mouse.move(panX, panY);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(panX + 120, panY + 26, { steps: 10 });
    await page.mouse.up({ button: 'right' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);

    const afterPanFrame = await getCanvasFrameSignature(canvas);
    expect(afterPanFrame).not.toBe(afterZoomFrame);

    await expect(page).toHaveURL(/right:viewer-scene/);
    await expect(page.locator('[data-testid="viewer-scene-error"]')).toHaveCount(0);
  });
});
