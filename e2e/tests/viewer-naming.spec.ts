import { expect, test, type Locator, type Page } from '@playwright/test';
import { NAMING_SYSTEMS, matchesNamingQuery, namingGetSummary } from '../fixtures/solar-system-naming';
import { setupViewerListTest, solarSystemListResponse } from '../fixtures/viewer-list-scenario';
import { GameShellPage } from '../page-objects/game-shell.page';

async function selectedText(page: Page, label: Locator): Promise<string> {
  await label.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  // Selection is the browser's copy source; no application-specific serialization.
  return page.evaluate(() => window.getSelection()!.toString());
}

test.describe('multilingual naming consumer gate (synthetic, authenticated)', () => {
  test('list and get preserve exact labels, accessible text, wrapping and bidi isolation', async ({ page }) => {
    const { mock } = await setupViewerListTest(page, NAMING_SYSTEMS);
    mock.on('solar-system-get-request', (request) => {
      const id = (request as { solarSystemId: string }).solarSystemId;
      const system = NAMING_SYSTEMS.find((entry) => entry.id === id)!;
      return {
        event: 'solar-system-get-response',
        data: { success: true, message: '', solarSystemId: id, solarSystem: namingGetSummary(system), bodies: [] },
      };
    });
    await new GameShellPage(page).openViewer();
    for (const system of NAMING_SYSTEMS) {
      const item = page.locator(`[data-system-id="${system.id}"]`);
      const label = item.getByTestId('system-display-name');
      await expect(label).toHaveText(system.displayName);
      expect(await label.textContent()).toBe(system.displayName);
      await expect(item.getByTestId('system-catalog-name')).toHaveCount(0);
      await expect(item.getByRole('button')).toHaveAccessibleName(new RegExp(`^${system.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      expect(await selectedText(page, label)).toBe(system.displayName);
      await expect(label).toHaveAttribute('dir', 'auto');
      expect(await label.evaluate((node) => getComputedStyle(node).unicodeBidi)).toBe('isolate');
      // Narrow real layout, including an RTL ancestor: no inserted control characters,
      // clipping, ellipsis, or single-line overflow.
      const layout = await item.locator('app-solar-system-name').evaluate((node) => {
        const element = node as HTMLElement;
        element.style.flex = '0 0 90px';
        element.style.maxWidth = '90px';
        element.parentElement!.dir = 'rtl';
        return { width: element.clientWidth, scroll: element.scrollWidth, height: element.clientHeight,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight), text: element.textContent };
      });
      expect(layout.width).toBeLessThanOrEqual(90);
      expect(layout.scroll).toBeLessThanOrEqual(layout.width + 1);
      if (system.settlementName) expect(layout.height).toBeGreaterThan(layout.lineHeight);
      expect(layout.text).toBe(system.displayName);
      expect(layout.text).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/u);
    }

    // Actual narrow viewport as well as the constrained-label wrapping above.
    await page.setViewportSize({ width: 640, height: 900 });
    // Actual consuming details route, with independent get-response text.
    for (const system of NAMING_SYSTEMS) {
      await page.locator(`[data-system-id="${system.id}"] button`).click();
      const displayName = namingGetSummary(system).displayName;
      const accessibleName = system.catalogName ? `${displayName} ${system.catalogName}` : displayName;
      const heading = page.getByRole('heading', { level: 1, name: accessibleName, exact: true });
      await expect(heading).toBeVisible();
      const label = heading.getByTestId('system-display-name');
      expect(await label.textContent()).toBe(namingGetSummary(system).displayName);
      expect(await selectedText(page, label)).toBe(namingGetSummary(system).displayName);
      if (system.catalogName) {
        await expect(heading.getByTestId('system-catalog-name')).toHaveText(system.catalogName);
      } else {
        await expect(heading.getByTestId('system-catalog-name')).toHaveCount(0);
      }
      await expect(label).toHaveAttribute('dir', 'auto');
      expect(await label.evaluate((node) => getComputedStyle(node).unicodeBidi)).toBe('isolate');
      const bounds = await heading.locator('app-solar-system-name').evaluate((node) => {
        const element = node as HTMLElement;
        return { width: element.clientWidth, scroll: element.scrollWidth };
      });
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
      await page.getByRole('button', { name: '← Back to Systems', exact: true }).click();
      await expect(page.getByTestId('viewer-system-list')).toBeVisible();
    }
  });

  test('sends short CJK and exact mixed-script literal queries without folding or transliteration', async ({ page }) => {
    const { mock } = await setupViewerListTest(page, NAMING_SYSTEMS);
    const searches: string[] = [];
    mock.on('solar-system-list-request', (request) => {
      const search = (request as { search?: string }).search ?? '';
      searches.push(search);
      return {
        event: 'solar-system-list-response',
        data: solarSystemListResponse(NAMING_SYSTEMS.filter((system) => matchesNamingQuery(system, search))),
      };
    });
    await new GameShellPage(page).openViewer();
    await expect(page.locator('.solar-system-item')).toHaveCount(NAMING_SYSTEMS.length);
    for (const query of ['星', '星河', '合成', 'اختبار', 'परीक्षण', 'fixture.*', 'Écho', 'Echo', 'xing', '.*', '星河 (TEST-002)', '  اختبار  ', 'historical label']) {
      await page.getByTestId('viewer-search').fill(query);
      await expect.poll(() => searches.at(-1)).toBe(query);
      await expect(page.locator('.solar-system-item')).toHaveCount(
        NAMING_SYSTEMS.filter((system) => matchesNamingQuery(system, query)).length,
      );
      await expect(page.getByTestId('viewer-search')).toHaveValue(query);
      await expect(page.getByTestId('viewer-search-hint')).toHaveCount(0);
    }
  });

  test('native clipboard round trip (interactive desktop opt-in)', async ({ page }) => {
    test.skip(process.env['NAMING_NATIVE_CLIPBOARD'] !== '1', 'Native clipboard is not certified on this host; opt in on an interactive desktop.');
    await setupViewerListTest(page, NAMING_SYSTEMS);
    await new GameShellPage(page).openViewer();
    for (const system of NAMING_SYSTEMS) {
      const item = page.locator(`[data-system-id="${system.id}"]`);
      await item.getByRole('button').focus();
      await selectedText(page, item.getByTestId('system-display-name'));
      await page.keyboard.press('ControlOrMeta+c');
      const search = page.getByTestId('viewer-search');
      await search.fill('');
      await search.focus();
      await page.keyboard.press('ControlOrMeta+v');
      await expect(search).toHaveValue(system.displayName);
      await search.fill('');
    }
  });
});
