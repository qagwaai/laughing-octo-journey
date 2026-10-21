import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';

async function expectSplit(page: Page, leftPercent: number, railWidth: number): Promise<void> {
  const separator = page.getByRole('separator', { name: 'Resize left and right panes' });
  await expect(separator).toHaveAttribute('aria-valuenow', String(leftPercent));
  const dimensions = await page.evaluate(() => {
    const left = document.getElementById('app-left-panel')!.getBoundingClientRect();
    const right = document.getElementById('app-right-panel')!.getBoundingClientRect();
    const rail = document.querySelector('.splitter')!.getBoundingClientRect();
    return { left: left.width, right: right.width, rail: rail.width, x: rail.x, viewport: innerWidth };
  });
  expect(dimensions.rail).toBe(railWidth);
  const usableWidth = dimensions.viewport - railWidth;
  expect(dimensions.left).toBeCloseTo((usableWidth * leftPercent) / 100, 0);
  expect(dimensions.right).toBeCloseTo((usableWidth * (100 - leftPercent)) / 100, 0);
  expect(dimensions.x).toBeGreaterThanOrEqual(0);
  expect(dimensions.x + dimensions.rail).toBeLessThanOrEqual(dimensions.viewport);
  for (const name of ['Show all left', 'Reset split to 50/50', 'Show all right']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
}

for (const mobile of [false, true]) {
  test.describe(mobile ? 'Touch splitter' : 'Desktop splitter', () => {
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 };
    const railWidth = mobile ? 48 : 32;
    test.use({ viewport, hasTouch: mobile, isMobile: mobile, storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
      await new SocketIOMock(page).setup();
      await page.goto('/splash(left:login)');
      await expect(page.getByRole('separator')).toBeVisible();
    });

    test('maximizes both panes, restores 50/50, and keeps controls on-screen after resize', async ({ page }) => {
      await expectSplit(page, 50, railWidth);
      for (const [name, width, hiddenId] of [
        ['Show all left', 100, 'app-right-panel'],
        ['Show all right', 0, 'app-left-panel'],
      ] as const) {
        const button = page.getByRole('button', { name, exact: true });
        if (mobile) await button.tap();
        else await button.click();
        await expectSplit(page, width, railWidth);
        await expect(page.locator(`#${hiddenId}`)).toHaveAttribute('inert', '');
        await expect(page.locator(`#${hiddenId}`)).toHaveAttribute('aria-hidden', 'true');
        await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1000, height: 700 });
        await expectSplit(page, width, railWidth);
        if (!mobile) {
          await page.setViewportSize({ width: 390, height: 844 });
          await expectSplit(page, width, 48);
        }
        await page.setViewportSize(viewport);
        await page.getByRole('button', { name: 'Reset split to 50/50', exact: true }).click();
        await expectSplit(page, 50, railWidth);
        await expect(page.locator(`#${hiddenId}`)).not.toHaveAttribute('inert');
      }
      if (mobile) {
        for (const button of await page.locator('.splitter-controls button').all()) {
          const box = await button.boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('drags back from both edges using the full rail hit target', async ({ page, context }) => {
      const stats = page.locator('app-root > .stats');
      await stats.waitFor({ state: 'attached' });
      await stats.evaluate((element) => {
        element.style.display = 'block';
      });
      for (const [name, direction] of [
        ['Show all right', 1],
        ['Show all left', -1],
      ] as const) {
        await page.getByRole('button', { name, exact: true }).click();
        const separator = page.getByRole('separator');
        const box = (await separator.boundingBox())!;
        const x = box.x + (direction === 1 ? box.width - 4 : 4);
        const y = 240;
        const endX = x + direction * 100;
        if (mobile) {
          const session = await context.newCDPSession(page);
          try {
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: endX, y }] });
            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } finally {
            await session.detach();
          }
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(endX, y, { steps: 5 });
          await page.mouse.up();
        }
        const initial = direction === 1 ? 0 : 100;
        const expected = initial + (direction * 10000) / (viewport.width - railWidth);
        await expect.poll(async () => Number(await separator.getAttribute('aria-valuenow'))).toBeCloseTo(expected, 1);
        await expect(page.locator('app-root')).not.toHaveClass(/resizing/);
        await expect(page.locator('#app-left-panel')).not.toHaveAttribute('inert');
        await expect(page.locator('#app-right-panel')).not.toHaveAttribute('inert');
      }
    });

    test('supports keyboard resizing and double-click reset', async ({ page }) => {
      const separator = page.getByRole('separator');
      await separator.focus();
      await separator.press('Home');
      await expectSplit(page, 0, railWidth);
      await separator.press('ArrowRight');
      await expectSplit(page, 5, railWidth);
      await separator.press('End');
      await expectSplit(page, 100, railWidth);
      await separator.press('ArrowLeft');
      await expectSplit(page, 95, railWidth);
      await separator.dblclick({ position: { x: railWidth / 2, y: 240 } });
      await expectSplit(page, 50, railWidth);
    });
  });
}
