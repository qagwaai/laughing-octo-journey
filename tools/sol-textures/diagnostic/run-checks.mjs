import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  if (!['--output', '--url'].includes(name) || !process.argv[index + 1]) {
    throw new Error('Usage: node run-checks.mjs --output <new external folder> [--url http://127.0.0.1:43187]');
  }
  args.set(name, process.argv[index + 1]);
}
if (!args.has('--output')) throw new Error('--output required');
const output = path.resolve(args.get('--output'));
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const relative = path.relative(repository, output);
if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
  throw new Error('Diagnostic artifacts must be outside the repository');
}
const url = args.get('--url') ?? 'http://127.0.0.1:43187';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error('Only an explicit loopback HTTP URL is supported');
await fs.mkdir(output, { recursive: false });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.diagnostics));
  const report = await page.evaluate(() => window.diagnostics.run());
  const gpu = await page.evaluate(() => {
    const gl = window.diagnostics.renderer.getContext();
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'Unavailable';
  });
  report.environment = { browser: await browser.version(), gpu, softwareRasterizerRequested: true };
  for (const body of ['earth', 'luna', 'mars']) {
    for (const view of ['front', 'seam', 'north', 'south']) {
      for (const mode of ['albedo', 'gray-relief']) {
        await page.evaluate((options) => window.diagnostics.render(options), { body, tier: 'standard', view, mode });
        await page.locator('#canvas').screenshot({ path: path.join(output, `${body}-${view}-${mode}.png`) });
      }
    }
    for (const segments of [72, 288]) {
      await page.evaluate((options) => window.diagnostics.render(options), {
        body,
        tier: 'standard',
        view: 'north',
        mode: 'gray-relief',
        segments,
      });
      await page
        .locator('#canvas')
        .screenshot({ path: path.join(output, `${body}-north-relief-${segments}-segments.png`) });
    }
  }
  for (const prefix of ['earth-0', 'earth-1', 'earth-2', 'luna-0', 'luna-1', 'luna-2', 'mars-0', 'mars-1', 'mars-2']) {
    await page.locator(`#${prefix}`).screenshot({ path: path.join(output, `${prefix}-landmark.png`) });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile(path.join(output, 'gpu-checks.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        status: report.status,
        renderCases: report.renderCases,
        gpu,
        screenshotFiles: 39,
        output,
        limitations: report.limitations,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
