import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const url = process.argv[2];
const submissionPath = process.argv[3];
if (!url || !submissionPath) {
  throw new Error('Usage: node test-registration-review.mjs <loopback evidence URL> <prior review JSON>');
}
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('Only a local evidence server is allowed.');
}
const submission = JSON.parse(await readFile(submissionPath, 'utf8'));
const template = await readFile(new URL('./registration-review.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: template }));
  await page.goto(url);
  const ready = () => page.waitForFunction(() => !!images.albedo && !!images.relief);
  await ready();
  const upload = (report) =>
    page.locator('#import').setInputFiles({
      name: 'review.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(report)),
    });
  await upload(submission);
  await page.waitForFunction(() => byId('import-status').textContent || !byId('error').hidden);
  assert.equal(await page.locator('#error').isVisible(), false, await page.locator('#error').textContent());
  assert.equal(await page.locator('#rows tr').count(), submission.records.length);
  assert.deepEqual(await page.evaluate(() => records), submission.records);
  await upload(submission);
  await page.locator('#import-status').filter({ hasText: 'Imported 0' }).waitFor();
  const forged = structuredClone(submission);
  forged.records[0].normalDimensions = [1, 1];
  await upload(forged);
  await page.locator('#error').filter({ hasText: 'Import failed' }).waitFor();
  assert.equal(await page.locator('#rows tr').count(), submission.records.length);
  await page.locator('#rows tr').first().getByRole('button', { name: 'Reopen', exact: true }).click();
  await ready();
  assert.equal(await page.locator('#zoom').inputValue(), '4');
  assert.deepEqual(await page.evaluate(() => marks.albedo), submission.records[0].albedoPoint);
  const initial = await page.evaluate(() => measurement());
  await page.locator('#zoom').selectOption('8');
  assert.deepEqual(await page.evaluate(() => measurement()), initial);
  const marked = await page.evaluate(() => marks);
  const canvas = page.locator('#albedo');
  await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + 220, box.y + 220);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 240, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  assert.deepEqual(await page.evaluate(() => marks), marked, 'Panning must not change annotations');
  const panned = await page.evaluate(() => view);
  assert.notEqual(panned.x, (submission.records[0].albedoPoint[0] + submission.records[0].reliefPoint[0]) / 2);
  await page.mouse.move(box.x + 260, box.y + 260);
  assert.ok(
    await page.evaluate(() =>
      ['albedo', 'relief'].every((id) =>
        byId(`${id}-loupe`)
          .getContext('2d')
          .getImageData(0, 0, 192, 192)
          .data.some((v) => v !== 0),
      ),
    ),
  );
  const checkClick = async (id, x, y) => {
    const target = page.locator(`#${id}`);
    await target.scrollIntoViewIfNeeded();
    const geometry = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x + element.clientLeft,
        y: rect.y + element.clientTop,
        width: element.clientWidth,
        height: element.clientHeight,
      };
    });
    const expected = await page.evaluate(
      ([px, py]) => imagePoint([px, py]),
      [
        (Math.trunc(geometry.x + x * geometry.width) - geometry.x) / geometry.width,
        (Math.trunc(geometry.y + y * geometry.height) - geometry.y) / geometry.height,
      ],
    );
    await page.mouse.click(geometry.x + x * geometry.width, geometry.y + y * geometry.height);
    const actual = await page.evaluate((key) => marks[key], id);
    assert.ok(Math.abs(actual[0] - expected[0]) < 1e-5, JSON.stringify({ actual, expected, geometry }));
    assert.ok(Math.abs(actual[1] - expected[1]) < 1e-5, JSON.stringify({ actual, expected, geometry }));
  };
  await checkClick('albedo', 0.5, 0.5);
  await checkClick('relief', 0.5, 0.5);
  assert.ok(await page.evaluate(() => measurement().distanceNormalTexels < 0.01));
  await page.setViewportSize({ width: 600, height: 900 });
  await checkClick('albedo', 0.6, 0.4);
  await checkClick('relief', 0.6, 0.4);
  assert.ok(await page.evaluate(() => measurement().distanceNormalTexels < 0.01));
  await page.locator('#notes').fill('Synthetic recheck for coordinate validation only.');
  await page.locator('#save').click();
  assert.equal(await page.locator('#rows tr').count(), submission.records.length + 1);
  assert.deepEqual(await page.evaluate(() => records.slice(0, -1)), submission.records);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.deepEqual(exported.priorEvidence[submission.evidence.evidenceId], submission.evidence);
  assert.deepEqual(exported.records.slice(0, -1), submission.records);
  await page.reload();
  await ready();
  assert.equal(await page.locator('#rows tr').count(), submission.records.length + 1);
  const regions = await page.locator('#region option').count();
  for (let i = 0; i < regions; i++) {
    await page.locator('#region').selectOption(String(i));
    for (const tier of ['low', 'standard']) {
      await page.locator('#tier').selectOption(tier);
      await ready();
      assert.equal(await page.locator('#zoom').inputValue(), '1');
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    'PASS: imports, immutable prior records/provenance, rechecks, zoom/pan, magnifiers, responsive clicks, export, persistence, all 18 pairs.',
  );
} finally {
  await browser.close();
}
