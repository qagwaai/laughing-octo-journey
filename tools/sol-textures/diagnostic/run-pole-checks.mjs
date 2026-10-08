import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = path.resolve(process.argv[2] ?? '');
const experiments = process.argv[3] === '--experiments';
if (process.argv[3] && !experiments) throw new Error('Unknown option');
if (!process.argv[2]) throw new Error('Usage: node run-pole-checks.mjs <new external evidence folder> [--experiments]');
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const relative = path.relative(repository, output);
if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error('Use external output');
await fs.mkdir(output);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:43187', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.diagnostics));
  const cases = [];
  for (const body of ['luna', 'mars']) {
    for (const tier of experiments ? ['low', 'standard'] : ['standard']) {
      for (const variant of experiments ? ['baseline', 'geodesic', 'transition'] : ['selected']) {
        for (const view of experiments ? ['north', 'south', 'front', 'seam'] : ['north', 'south']) {
          for (const mode of experiments
            ? ['gray-relief', 'relief']
            : ['albedo', 'gray', 'flat-normal', 'gray-relief']) {
            for (const filtering of ['mipmapped', 'nearest']) {
              if (experiments && ['front', 'seam'].includes(view) && filtering === 'nearest') continue;
              const options = {
                body,
                tier,
                variant,
                view,
                mode,
                filtering,
                segments: 288,
                ...(view === 'north' || view === 'south'
                  ? {
                      coordinates: [0, view === 'north' ? 90 : -90],
                      fov: 4,
                    }
                  : {}),
              };
              const result = await page.evaluate((options) => window.diagnostics.render(options), options);
              await page.locator('#canvas').screenshot({
                path: path.join(
                  output,
                  experiments
                    ? `${body}-${tier}-${variant}-${view}-${mode}-${filtering}.png`
                    : `${body}-${view}-${mode}-${filtering}.png`,
                ),
              });
              cases.push({ ...options, centerUv: result.centerUv });
            }
          }
        }
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile(
    path.join(output, 'render-cases.json'),
    JSON.stringify(
      {
        browser: await browser.version(),
        cases,
        errors,
        note: 'Diagnostic comparisons only. No promotion; experimental normal changes are confined to the polar cap.',
      },
      null,
      2,
    ),
  );
  console.log(`PASS: ${cases.length} polar control cases captured without console/page errors`);
} finally {
  await browser.close();
}
