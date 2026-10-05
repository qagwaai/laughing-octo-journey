import { expect, test } from '@playwright/test';
import { getCanvasFrameSignature, setupViewer } from '../fixtures/viewer-controls-after-target-scenario';
import { ViewerPage } from '../page-objects/viewer.page';
import type { Camera, Object3D } from 'three';

async function waitForFrameChange(options: {
  runInteraction: () => Promise<void>;
  readFrame: () => Promise<string>;
  baselineFrame: string;
  timeoutMs?: number;
}) {
  // This polls for a *rendered* frame to change. Under CI's software renderer
  // (SwiftShader, no GPU) each frame plus canvas readback is far slower than on
  // a GPU dev machine, so this budget is environment-bound rather than arbitrary.
  const timeout = options.timeoutMs ?? 20_000;
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
  test('switches proportional and compressed distances while keeping the selected planet centered', async ({ page }) => {
    await setupViewer(page);
    const overlay = page.getByTestId('viewer-distance-mode');
    await expect(overlay).toContainText('Proportional distances');
    const target = page.locator('tr', { hasText: 'Earth' }).first().locator('button.details-target-btn');
    await target.click();
    const readTarget = () => page.evaluate(() => {
      const canvas = document.querySelector('ngt-canvas');
      if (!canvas) return null;
      const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
      const snapshot = (ng.getComponent(canvas) as {
        store: { snapshot: { scene: Object3D | null; camera: Camera } };
      }).store.snapshot;
      if (!snapshot.scene) return null;
      let earth: Object3D | undefined;
      snapshot.scene.traverse((object) => { if (object.name === 'Earth' && object.type === 'Mesh') earth = object; });
      if (!earth) return null;
      const screen = earth.position.clone().project(snapshot.camera);
      return { radius: earth.position.length(), centered: Math.hypot(screen.x, screen.y) < 0.02 };
    });
    await expect.poll(async () => (await readTarget())?.centered).toBe(true);
    const proportional = (await readTarget())!.radius;
    expect(proportional).toBeCloseTo(5, 5);
    await page.getByTestId('viewer-distance-toggle').click();
    await expect(overlay).toContainText('Compressed overview');
    await expect.poll(async () => {
      const result = await readTarget();
      return !!result && result.radius > 18 && result.centered;
    }).toBe(true);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('viewer-distance-toggle').click();
    await expect.poll(async () => {
      const result = await readTarget();
      return !!result && Math.abs(result.radius - proportional) < 1e-8 && result.centered;
    }).toBe(true);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
  });

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
      timeoutMs: 24_000,
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
