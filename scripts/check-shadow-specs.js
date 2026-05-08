#!/usr/bin/env node
/**
 * check-shadow-specs.js
 *
 * Ensures every src/app/**\/*.spec.ts (except *.integration.spec.ts) imports
 * the production file at the same path (e.g. market-hub.spec.ts must contain
 * an import from './market-hub').
 *
 * Files in KNOWN_SHADOW_SPECS are EXISTING violations being tracked for Phase B
 * conversion (see TEST_QUALITY_REVIEW.md). Violations in that list produce a
 * warning but do NOT fail the build. Any NEW shadow spec outside the list WILL
 * fail the build.
 *
 * Remove entries from KNOWN_SHADOW_SPECS as they are converted in Phase B.
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// ---------------------------------------------------------------------------
// Known violations — all 30 shadow specs identified in TEST_QUALITY_REVIEW.md
// Remove entries as they are converted to real TestBed specs in Phase B.
// ---------------------------------------------------------------------------
const KNOWN_SHADOW_SPECS = new Set([
  // --- Phase B conversion backlog (see TEST_QUALITY_REVIEW.md) ---
  'src/app/app.component.spec.ts',
  'src/app/routed-scene.spec.ts',
  'src/app/page/game/repair-retrofit.spec.ts',
  'src/app/page/game/repair-retrofit-item-detail.spec.ts',
  'src/app/page/game/repair-retrofit-items.spec.ts',
  'src/app/page/game/repair-retrofit-ship-detail.spec.ts',
  'src/app/page/opening/cold-boot.spec.ts',
  'src/app/scene/ship-exterior-view.spec.ts',
  'src/app/scene/ship-view-specs.spec.ts',
  'src/app/scene/hud/cold-boot-hud-scene.spec.ts',
  'src/app/scene/hud/hud-overlay.spec.ts',
  'src/app/component/button.spec.ts',
  'src/app/component/current.spec.ts',
  'src/app/services/mission-flow.integration.spec.ts',
]);

// ---------------------------------------------------------------------------

const root = path.resolve(__dirname, '..');

// Normalize path to forward-slash relative form (e.g. 'src/app/page/...')
function normalize(p) {
  return p.replace(/\\/g, '/');
}

const specFiles = globSync('src/app/**/*.spec.ts', { cwd: root }).map(normalize);

const newViolations = [];
const knownViolations = [];

for (const rel of specFiles) {
  // Skip integration specs — they intentionally don't map 1:1 to a single SUT
  if (rel.endsWith('.integration.spec.ts')) {
    continue;
  }

  const specPath = path.join(root, rel);
  const content = fs.readFileSync(specPath, 'utf8');

  // Derive the expected SUT base name (strip .spec.ts → e.g. 'market-hub')
  const baseName = path.basename(rel, '.spec.ts');

  // A spec is considered valid if it imports from './<baseName>' (any quotes,
  // any extension, any members). We allow both single and double quotes.
  const sutImportPattern = new RegExp(`from ['"]\\.\\/` + escapeRegex(baseName) + `['"/]`);

  if (!sutImportPattern.test(content)) {
    const entry = { file: rel, baseName };
    if (KNOWN_SHADOW_SPECS.has(rel)) {
      knownViolations.push(entry);
    } else {
      newViolations.push(entry);
    }
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

if (knownViolations.length > 0) {
  console.warn(`${YELLOW}${BOLD}Shadow spec warnings (known — Phase B backlog):${RESET}`);
  knownViolations.forEach(({ file }) => console.warn(`  ${YELLOW}⚠${RESET}  ${file}`));
  console.warn(
    `${YELLOW}  ${knownViolations.length} known shadow spec(s). Convert via Phase B in TODO.md.${RESET}\n`,
  );
}

if (newViolations.length > 0) {
  console.error(`${RED}${BOLD}Shadow spec errors (NEW violations — build blocked):${RESET}`);
  newViolations.forEach(({ file, baseName }) =>
    console.error(
      `  ${RED}✖${RESET}  ${file}\n     Must import from './${baseName}'. ` +
        `Add to KNOWN_SHADOW_SPECS only if intentionally deferring.`,
    ),
  );
  console.error(`\n${RED}${BOLD}${newViolations.length} new shadow spec(s) detected. Fix before committing.${RESET}`);
  process.exit(1);
}

if (knownViolations.length === 0 && newViolations.length === 0) {
  console.log(`${GREEN}✔ No shadow specs found — all specs import their SUT.${RESET}`);
}
