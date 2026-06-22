#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'e2e', 'tests');

const PARTITIONS = [
  {
    name: 'auth-route',
    patterns: [
      /^login\.spec\.ts$/,
      /^registration\.spec\.ts$/,
      /^registration-auto-login-failure\.spec\.ts$/,
      /^locale-auth-flow\.spec\.ts$/,
    ],
  },
  {
    name: 'viewer-3d',
    patterns: [/^viewer.*\.spec\.ts$/, /^planet-view-zoom\.spec\.ts$/, /^ship-exterior-.*\.spec\.ts$/],
  },
  {
    name: 'stateful-gameplay',
    patterns: [
      /^character-.*\.spec\.ts$/,
      /^first-target-.*\.spec\.ts$/,
      /^guarded-left-menu-pin-cycle\.spec\.ts$/,
      /^locale-opening-mission-flow\.spec\.ts$/,
      /^login-after-first-target-completed\.spec\.ts$/,
      /^market-hub-.*\.spec\.ts$/,
      /^mission-board\.spec\.ts$/,
      /^print-queue\.spec\.ts$/,
      /^repair-retrofit\.spec\.ts$/,
    ],
  },
];

const specFiles = fs
  .readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const unassigned = [];
const overlaps = [];
const grouped = new Map(PARTITIONS.map((partition) => [partition.name, []]));

function countTestsInSpec(fileName) {
  const filePath = path.join(testsDir, fileName);
  const content = fs.readFileSync(filePath, 'utf8');

  // Count Playwright test declarations while excluding test.describe(...) and friends.
  const base = content.match(/\btest\s*\(/g) ?? [];
  const modifiers = content.match(/\btest\.(only|skip|fixme|fail)\s*\(/g) ?? [];
  return base.length + modifiers.length;
}

for (const file of specFiles) {
  const matches = PARTITIONS.filter((partition) => partition.patterns.some((pattern) => pattern.test(file))).map(
    (partition) => partition.name,
  );

  if (matches.length === 0) {
    unassigned.push(file);
    continue;
  }

  if (matches.length > 1) {
    overlaps.push({ file, matches });
    continue;
  }

  grouped.get(matches[0]).push(file);
}

if (unassigned.length > 0 || overlaps.length > 0) {
  console.error('E2E partition gate failed.');

  if (unassigned.length > 0) {
    console.error('\nUnassigned specs (must match exactly one partition):');
    for (const file of unassigned) {
      console.error(`  - ${file}`);
    }
  }

  if (overlaps.length > 0) {
    console.error('\nOverlapping specs (matched more than one partition):');
    for (const overlap of overlaps) {
      console.error(`  - ${overlap.file} -> ${overlap.matches.join(', ')}`);
    }
  }

  process.exit(1);
}

console.log('E2E partition gate passed.');
let totalSpecs = 0;
let totalTests = 0;
for (const partition of PARTITIONS) {
  const files = grouped.get(partition.name);
  const testCount = files.reduce((sum, file) => sum + countTestsInSpec(file), 0);
  totalSpecs += files.length;
  totalTests += testCount;

  console.log(`\n[${partition.name}] ${files.length} spec(s), ${testCount} test(s)`);
  for (const file of files) {
    console.log(`  - ${file}`);
  }
}

console.log(`\nTotals: ${totalSpecs} spec(s), ${totalTests} test(s)`);
