import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { phases, runPhases, runTrial } from './run-e2e-phased.mjs';

test('runs disjoint one-worker and two-worker phases sequentially with independent reports', () => {
  const calls = [];
  const results = runPhases((args, env) => {
    calls.push({ args, env });
    return 0;
  }, 'output');
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => result.exitCode),
    [0, 0],
  );
  assert.deepEqual(
    phases.map((phase) => phase.selector),
    ['--grep=@single-worker', '--grep-invert=@single-worker'],
  );
  for (const [index, call] of calls.entries()) {
    assert.ok(call.args.includes(`--workers=${index + 1}`));
    assert.ok(call.args.includes('--retries=0'));
    assert.ok(call.args.includes('--trace=retain-on-failure'));
    assert.equal(call.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE, path.join('output', phases[index].name, 'junit.xml'));
  }
  assert.notEqual(calls[0].env.PLAYWRIGHT_BLOB_OUTPUT_DIR, calls[1].env.PLAYWRIGHT_BLOB_OUTPUT_DIR);
});

test('retains a failed first phase and still executes the second phase', () => {
  let calls = 0;
  const results = runPhases(() => (calls++ === 0 ? 1 : 0), 'output');
  assert.equal(calls, 2);
  assert.deepEqual(
    results.map((result) => result.exitCode),
    [1, 0],
  );
});

test('retains a failed second phase', () => {
  let calls = 0;
  const results = runPhases(() => (calls++ === 0 ? 0 : 1), 'output');
  assert.deepEqual(
    results.map((result) => result.exitCode),
    [0, 1],
  );
});

test('merges real reports and exits unsuccessfully when only the first phase fails', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'e2e-phased-harness-'));
  try {
    const config = path.join(directory, 'playwright.config.cjs');
    const cli = path.join(path.dirname(createRequire(import.meta.url).resolve('playwright/package.json')), 'cli.js');
    const testModule = createRequire(import.meta.url).resolve('@playwright/test');
    writeFileSync(config, `module.exports = { testDir: __dirname };`);
    writeFileSync(
      path.join(directory, 'harness.spec.cjs'),
      `const { test, expect } = require(${JSON.stringify(testModule)});
test('first phase fails', { tag: '@single-worker' }, () => expect(1).toBe(2));
test('second phase passes', () => expect(1).toBe(1));
`,
    );
    const junit = path.join(directory, 'merged.xml');
    const summary = runTrial(
      (args, env) => {
        const command = [...args];
        if (args[0] === 'test') command.push(`--config=${config}`);
        const result = spawnSync(process.execPath, [cli, ...command], {
          env: {
            ...process.env,
            ...env,
            PLAYWRIGHT_JUNIT_OUTPUT_FILE: args[0] === 'test' ? env.PLAYWRIGHT_JUNIT_OUTPUT_FILE : junit,
            PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(directory, 'html'),
          },
          encoding: 'utf8',
        });
        assert.ifError(result.error);
        assert.equal(result.signal, null);
        assert.ok(result.status !== null, result.stderr);
        return result.status;
      },
      path.join(directory, 'results'),
    );
    assert.deepEqual(
      summary.phases.map((phase) => phase.exitCode),
      [1, 0],
    );
    assert.equal(summary.mergeExitCode, 0);
    assert.equal(summary.exitCode, 1);
    const xml = readFileSync(junit, 'utf8');
    assert.match(xml, /tests="2"/);
    assert.match(xml, /failures="1"/);
    assert.match(xml, /first phase fails/);
    assert.match(xml, /second phase passes/);
    assert.equal(JSON.parse(readFileSync(path.join(directory, 'results', 'execution.json'), 'utf8')).exitCode, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
