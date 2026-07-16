#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'e2e', 'tests');

const STATEFUL_PATTERNS = [
  /^character-.*\.spec\.ts$/,
  /^first-target-.*\.spec\.ts$/,
  /^guarded-left-menu-pin-cycle\.spec\.ts$/,
  /^locale-opening-mission-flow\.spec\.ts$/,
  /^login-after-first-target-completed\.spec\.ts$/,
  /^market-hub-.*\.spec\.ts$/,
  /^mission-board\.spec\.ts$/,
  /^print-queue\.spec\.ts$/,
  /^repair-retrofit\.spec\.ts$/,
];

const HANGAR_USAGE_PATTERNS = [
  /openShipHangar\s*\(/,
  /left:ship-hangar/,
  /ship-hangar/,
  /ShipHangarPage/,
  /openExteriorForShip\s*\(/,
  /openSpecsForShip\s*\(/,
];

const READINESS_PATTERNS = [/waitForLoadedReadiness\s*\(/, /getReadinessSnapshot\s*\(/, /__sw13AppTestReadiness/];

const specFiles = fs
  .readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const statefulSpecs = specFiles.filter((fileName) => STATEFUL_PATTERNS.some((pattern) => pattern.test(fileName)));

const violations = [];
for (const fileName of statefulSpecs) {
  const filePath = path.join(testsDir, fileName);
  const content = fs.readFileSync(filePath, 'utf8');

  const usesHangarSurface = HANGAR_USAGE_PATTERNS.some((pattern) => pattern.test(content));
  if (!usesHangarSurface) {
    continue;
  }

  const hasReadinessAssertion = READINESS_PATTERNS.some((pattern) => pattern.test(content));
  if (!hasReadinessAssertion) {
    violations.push(fileName);
  }
}

if (violations.length > 0) {
  console.error('Stateful readiness gate failed.');
  console.error('The following stateful specs use Ship Hangar surfaces but do not assert readiness contract usage:');
  for (const fileName of violations) {
    console.error(`  - ${fileName}`);
  }
  console.error('Add ShipHangarPage.waitForLoadedReadiness() (or equivalent readiness snapshot assertion) to each failing spec.');
  process.exit(1);
}

console.log(`Stateful readiness gate passed (${statefulSpecs.length} stateful specs scanned).`);
