import { expect, test } from '@playwright/test';
import type { Camera, Object3D } from 'three';
import { getCanvasFrameSignature, setupViewer } from '../fixtures/viewer-controls-after-target-scenario';
import { ViewerPage } from '../page-objects/viewer.page';

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
  test('inspects a target in a persistent non-overlapping dock with scrollable sections', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1800, height: 900 });
    await setupViewer(page);
    const canvas = page.locator('.viewer-scene-viewport ngt-canvas');
    const inspector = page.getByTestId('viewer-body-inspector');
    await expect(inspector).toHaveCount(0);
    await page.locator('tr', { hasText: 'Earth' }).first().locator('button.details-target-btn').click();
    await page.mouse.move(2, 2);
    await expect(page.getByTestId('viewer-body-facts')).toContainText('12742000');
    const inspect = page.getByTestId('viewer-inspect-target');
    await inspect.click();
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole('heading')).toContainText('Earth');
    const canvasBounds = await canvas.boundingBox();
    const dockBounds = await inspector.boundingBox();
    if (!canvasBounds || !dockBounds) throw new Error('Inspector or canvas is missing layout bounds');
    expect(canvasBounds.x + canvasBounds.width).toBeLessThanOrEqual(dockBounds.x + 1);
    const infoBounds = await page.getByTestId('viewer-info-panel').boundingBox();
    if (!infoBounds) throw new Error('Viewer panel is missing layout bounds');
    expect(infoBounds.y).toBeGreaterThan(canvasBounds.y + canvasBounds.height / 2);
    await expect(inspector.getByTestId('viewer-inspector-physical')).toHaveAttribute('open', '');
    const orbit = inspector.getByTestId('viewer-inspector-orbit');
    await expect(orbit).toHaveAttribute('open', '');
    const position = inspector.getByTestId('viewer-inspector-position');
    await expect(position).toHaveAttribute('open', '');
    await position.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(position).not.toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(position).toHaveAttribute('open', '');
    const zoom = page.getByTestId('viewer-zoom-slider').locator('input');
    await expect(zoom).not.toHaveValue('100');
    const initialZoom = await zoom.inputValue();
    await page.setViewportSize({ width: 1800, height: 600 });
    const content = inspector.locator('.viewer-detail-pane__content');
    await content.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(zoom).toHaveValue(initialZoom);
    await expect(inspector).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('viewer-inspector-docked.png') });

    await page.locator('tr', { hasText: 'Mars' }).first().locator('button.details-target-btn').click();
    await expect(inspector.getByRole('heading')).toContainText('Earth');
    await inspect.click();
    await expect(inspector.getByRole('heading')).toContainText('Mars');
    await page.setViewportSize({ width: 1000, height: 800 });
    const narrowCanvas = await canvas.boundingBox();
    const narrowDock = await inspector.boundingBox();
    if (!narrowCanvas || !narrowDock) throw new Error('Narrow inspector or canvas is missing layout bounds');
    expect(narrowCanvas.y + narrowCanvas.height).toBeLessThanOrEqual(narrowDock.y + 1);
    expect(narrowDock.y + narrowDock.height).toBeLessThanOrEqual(800);
    await expect
      .poll(async () => (await canvas.locator('canvas').boundingBox())?.height)
      .toBe(narrowCanvas.height);
    await page.screenshot({ path: testInfo.outputPath('viewer-inspector-stacked.png') });
    await page.getByTestId('viewer-inspector-close').click();
    await expect(inspector).toHaveCount(0);
    await expect(inspect).toBeFocused();
    await expect(page.locator('tr', { hasText: 'Mars' }).first().locator('button.details-target-btn')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('consolidates information without hiding notes or intercepting scene zoom', async ({ page }, testInfo) => {
    await setupViewer(page);
    const panel = page.getByTestId('viewer-info-panel');
    const legend = panel.getByTestId('viewer-legend');
    const distances = panel.getByTestId('viewer-distance-mode');
    const notes = panel.getByTestId('viewer-display-notes');
    const sources = panel.getByTestId('viewer-surface-sources');
    const qa = panel.getByTestId('viewer-qa-panel');
    await expect(panel).toBeVisible();
    await expect(legend).toHaveAttribute('open', '');
    for (const disclosure of [distances, notes, sources, qa]) {
      await expect(disclosure).not.toHaveAttribute('open', '');
    }
    const notesBounds = await notes.boundingBox();
    const sourcesBounds = await sources.boundingBox();
    if (!notesBounds || !sourcesBounds) throw new Error('Viewer disclosure rows have no layout bounds');
    expect(Math.abs(sourcesBounds.y - (notesBounds.y + notesBounds.height))).toBeLessThanOrEqual(1);
    const slider = page.getByTestId('viewer-zoom-slider');
    await expect(slider).toBeVisible();
    await expect(panel.getByTestId('viewer-zoom-slider')).toHaveCount(0);

    await page.locator('tr', { hasText: 'Earth' }).first().locator('button.details-target-btn').click();
    await page.mouse.move(2, 2);
    await expect(panel.getByTestId('viewer-body-label')).toContainText('Earth');
    await expect(panel.getByTestId('viewer-body-label')).toContainText('Targeted');
    await page.screenshot({ path: testInfo.outputPath('viewer-panel-compact.png') });

    await notes.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(panel.getByTestId('viewer-orbit-guide-note')).toBeVisible();
    await sources.locator('summary').click();
    await expect(sources.getByText('Atmosphere appearance sources')).toBeVisible();
    await qa.locator('summary').click();
    await expect(qa.getByRole('checkbox', { name: 'Enable QA controls' })).toBeVisible();

    const zoom = slider.locator('input');
    const initialZoom = await zoom.inputValue();
    await panel.dispatchEvent('wheel', { deltaY: 100, bubbles: true });
    await expect(zoom).toHaveValue(initialZoom);

    await page.setViewportSize({ width: 800, height: 600 });
    const panelBounds = await panel.boundingBox();
    const sliderBounds = await slider.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(sliderBounds).not.toBeNull();
    if (!panelBounds || !sliderBounds) throw new Error('Viewer overlays have no layout bounds');
    expect(panelBounds.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds.y).toBeGreaterThanOrEqual(0);
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(600);
    expect(panelBounds.x + panelBounds.width).toBeLessThan(sliderBounds.x);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('viewer-panel-narrow-expanded.png') });
    await sources.locator('summary').click();
    await expect(sources).not.toHaveAttribute('open', '');
  });

  test('switches proportional and compressed distances while keeping the selected planet centered', async ({
    page,
  }) => {
    await setupViewer(page);
    const overlay = page.getByTestId('viewer-distance-mode');
    await expect(overlay).toContainText('Proportional distances');
    await overlay.locator('summary').click();
    const target = page.locator('tr', { hasText: 'Earth' }).first().locator('button.details-target-btn');
    await target.click();
    const readTarget = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('ngt-canvas');
        if (!canvas) return null;
        const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
        const snapshot = (
          ng.getComponent(canvas) as {
            store: { snapshot: { scene: Object3D | null; camera: Camera } };
          }
        ).store.snapshot;
        if (!snapshot.scene) return null;
        let earth: Object3D | undefined;
        snapshot.scene.traverse((object) => {
          if (object.name === 'Earth' && object.type === 'Mesh') earth = object;
        });
        if (!earth) return null;
        const position = earth.getWorldPosition(earth.position.clone());
        const screen = position.clone().project(snapshot.camera);
        return { radius: position.length(), centered: Math.hypot(screen.x, screen.y) < 0.02 };
      });
    await expect.poll(async () => (await readTarget())?.centered).toBe(true);
    const proportional = (await readTarget())!.radius;
    expect(proportional).toBeCloseTo(5, 5);
    await page.getByTestId('viewer-distance-toggle').click();
    await expect(overlay).toContainText('Compressed overview');
    await expect
      .poll(async () => {
        const result = await readTarget();
        return !!result && result.radius > 18 && result.centered;
      })
      .toBe(true);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('viewer-distance-toggle').click();
    await expect
      .poll(async () => {
        const result = await readTarget();
        return !!result && Math.abs(result.radius - proportional) < 1e-8 && result.centered;
      })
      .toBe(true);
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
