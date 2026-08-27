import { expect, test } from '@playwright/test';
import { getCanvasFrameSignature, setupViewer } from '../fixtures/viewer-controls-after-target-scenario';
import { ViewerPage } from '../page-objects/viewer.page';

async function waitForFrameChange(options: {
  runInteraction: () => Promise<void>;
  readFrame: () => Promise<string>;
  baselineFrame: string;
  timeoutMs?: number;
}) {
  const timeout = options.timeoutMs ?? 8_000;
  await expect
    .poll(
      async () => {
        await options.runInteraction();
        const nextFrame = await options.readFrame();
        return nextFrame !== options.baselineFrame;
      },
      {
        timeout,
        intervals: [180, 260, 360],
      },
    )
    .toBe(true);
}

test.describe('Viewer controls after target completion', () => {
  test('keeps rotate, zoom, and pan usable after target-fly settles', async ({ page }) => {
    await setupViewer(page);

    const viewerPage = new ViewerPage(page);
    const canvas = viewerPage.sceneCanvas;

    const targetEarthButton = page
      .locator('tr', { hasText: 'Earth' })
      .first()
      .locator('button.details-target-btn')
      .first();
    await expect(targetEarthButton).toBeVisible({ timeout: 10_000 });
    await viewerPage.expectSceneLoaded();

    const preTargetFrame = await getCanvasFrameSignature(canvas);
    expect(preTargetFrame.length).toBeGreaterThan(500);

    await targetEarthButton.click();
    await expect(targetEarthButton).toHaveAttribute('aria-pressed', 'true');

    await waitForFrameChange({
      runInteraction: async () => {
        await page.mouse.move(2, 2);
      },
      readFrame: async () => getCanvasFrameSignature(canvas),
      baselineFrame: preTargetFrame,
      timeoutMs: 12_000,
    });

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

    await waitForFrameChange({
      runInteraction: async () => {
        await page.mouse.move(centerX, centerY);
        await page.mouse.down({ button: 'left' });
        await page.mouse.move(centerX + 120, centerY + 30, { steps: 12 });
        await page.mouse.up({ button: 'left' });
      },
      readFrame: async () => getCanvasFrameSignature(canvas),
      baselineFrame: initialFrame,
    });

    const afterRotateFrame = await getCanvasFrameSignature(canvas);
    expect(afterRotateFrame).not.toBe(initialFrame);

    await page.mouse.wheel(0, -800);

    await waitForFrameChange({
      runInteraction: async () => {
        await page.mouse.wheel(0, -800);
      },
      readFrame: async () => getCanvasFrameSignature(canvas),
      baselineFrame: afterRotateFrame,
    });

    const afterZoomFrame = await getCanvasFrameSignature(canvas);
    expect(afterZoomFrame).not.toBe(afterRotateFrame);

    const panX = (bounds?.x ?? 0) + 24;
    const panY = (bounds?.y ?? 0) + 24;
    await page.mouse.move(panX, panY);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(panX + 120, panY + 26, { steps: 10 });
    await page.mouse.up({ button: 'right' });
    await page.keyboard.press('Escape');

    await waitForFrameChange({
      runInteraction: async () => {
        await page.mouse.move(panX, panY);
        await page.mouse.down({ button: 'right' });
        await page.mouse.move(panX + 120, panY + 26, { steps: 10 });
        await page.mouse.up({ button: 'right' });
        await page.keyboard.press('Escape');
      },
      readFrame: async () => getCanvasFrameSignature(canvas),
      baselineFrame: afterZoomFrame,
    });

    const afterPanFrame = await getCanvasFrameSignature(canvas);
    expect(afterPanFrame).not.toBe(afterZoomFrame);

    await new ViewerPage(page).expectSceneLoaded();
  });
});
