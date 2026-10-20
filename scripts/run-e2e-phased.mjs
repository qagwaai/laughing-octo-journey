import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(path.dirname(createRequire(import.meta.url).resolve('playwright/package.json')), 'cli.js');
export const phases = [
  { name: 'single-worker', workers: 1, selector: '--grep=@single-worker' },
  { name: 'parallel', workers: 2, selector: '--grep-invert=@single-worker' },
];

function runCommand(args, env) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Playwright interrupted by ${result.signal}.`);
  if (result.status === null) throw new Error('Playwright did not return an exit status.');
  return result.status;
}

export function runPhases(run, directory) {
  const results = [];
  for (const phase of phases) {
    const phaseDirectory = path.join(directory, phase.name);
    const started = Date.now();
    console.log(`E2E_PHASE_START=${phase.name} WORKERS=${phase.workers} RETRIES=0`);
    const exitCode = run(
      [
        'test',
        phase.selector,
        `--workers=${phase.workers}`,
        '--retries=0',
        '--trace=retain-on-failure',
        '--reporter=line,junit,blob',
        `--output=${path.join(phaseDirectory, 'artifacts')}`,
      ],
      {
        PLAYWRIGHT_JUNIT_OUTPUT_FILE: path.join(phaseDirectory, 'junit.xml'),
        PLAYWRIGHT_BLOB_OUTPUT_DIR: path.join(phaseDirectory, 'blob'),
        PLAYWRIGHT_HTML_OPEN: 'never',
      },
    );
    results.push({ ...phase, exitCode, wallSeconds: (Date.now() - started) / 1000 });
    console.log(`E2E_PHASE_END=${phase.name} EXIT=${exitCode}`);
  }
  return results;
}

export function runTrial(run, outputRoot) {
  mkdirSync(outputRoot, { recursive: true });
  const directory = mkdtempSync(path.join(outputRoot, 'run-'));
  const started = Date.now();
  const results = runPhases(run, directory);
  const blobs = path.join(directory, 'merged-blobs');
  mkdirSync(blobs);
  for (const phase of phases) {
    const phaseBlobs = path.join(directory, phase.name, 'blob');
    const reports = readdirSync(phaseBlobs).filter((name) => name.endsWith('.zip'));
    if (reports.length !== 1) throw new Error(`Expected one blob report for ${phase.name}; found ${reports.length}.`);
    copyFileSync(path.join(phaseBlobs, reports[0]), path.join(blobs, `${phase.name}.zip`));
  }
  const mergeExitCode = run(['merge-reports', '--reporter=html,junit', blobs], {
    PLAYWRIGHT_JUNIT_OUTPUT_FILE: path.join(root, 'test-results', 'playwright-junit.xml'),
    PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(root, 'playwright-report'),
    PLAYWRIGHT_HTML_OPEN: 'never',
  });
  const exitCode = results.some((phase) => phase.exitCode !== 0) || mergeExitCode !== 0 ? 1 : 0;
  const summary = { phases: results, mergeExitCode, exitCode, wallSeconds: (Date.now() - started) / 1000, directory };
  writeFileSync(path.join(outputRoot, 'execution.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`E2E_PHASED_END EXIT=${exitCode} WALL_SECONDS=${summary.wallSeconds}`);
  return summary;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--list') {
    process.exitCode = phases.reduce(
      (code, phase) => Math.max(code, runCommand(['test', phase.selector, '--list'], {})),
      0,
    );
    return;
  }
  if (args.length) throw new Error('Usage: npm run e2e:phased -- [--list]. Phased trials always use zero retries.');
  process.exitCode = runTrial(runCommand, path.join(root, 'test-results', 'phased')).exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error('Phased E2E execution failed:', error);
    process.exitCode = 1;
  }
}
