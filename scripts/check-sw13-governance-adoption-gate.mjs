#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const ADOPTION_LOG_PATH = 'docs/planning/sw-13-closure/sw-13-governance-adoption-log-2026-07-20.md';

const STATEFUL_SPEC_PATTERNS = [
  /^e2e\/tests\/character-.*\.spec\.ts$/,
  /^e2e\/tests\/first-target-.*\.spec\.ts$/,
  /^e2e\/tests\/guarded-left-menu-pin-cycle\.spec\.ts$/,
  /^e2e\/tests\/locale-opening-mission-flow\.spec\.ts$/,
  /^e2e\/tests\/login-after-first-target-completed\.spec\.ts$/,
  /^e2e\/tests\/market-hub-.*\.spec\.ts$/,
  /^e2e\/tests\/mission-board\.spec\.ts$/,
  /^e2e\/tests\/print-queue\.spec\.ts$/,
  /^e2e\/tests\/repair-retrofit\.spec\.ts$/,
  /^e2e\/tests\/ship-exterior-.*\.spec\.ts$/,
];

const SW13_SCOPE_PATH_PATTERNS = [
  ...STATEFUL_SPEC_PATTERNS,
  /^e2e\/page-objects\/ship-hangar\.page\.ts$/,
  /^e2e\/page-objects\/game-shell\.page\.ts$/,
  /^src\/app\/page\/game\/ship-hangar\.vitest\.ts$/,
  /^src\/app\/page\/game\/ship-hangar\.ts$/,
  /^src\/app\/services\/ship\.service\.vitest\.ts$/,
  /^src\/app\/services\/ship\.service\.ts$/,
  /^scripts\/check-sw13-governance-adoption-gate\.mjs$/,
  /^scripts\/check-stateful-readiness-gate\.mjs$/,
  /^docs\/testing-policy\.md$/,
  /^README\.md$/,
  /^CONTRIBUTING\.md$/,
  /^\.github\/pull_request_template\.md$/,
  /^docs\/planning\/sw-13-closure\/sw-13-reviewer-governance-checklist-2026-07-16\.md$/,
  /^docs\/planning\/sw-13-closure\/sw-13-test-foundation-investment-plan-2026-07-11\.md$/,
  /^docs\/planning\/sw-13-closure\/sw-13-closure-status-2026-07-10\.md$/,
];

function normalizePath(input) {
  return input.replace(/\\/g, '/');
}

function runGitNameOnly(command) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => normalizePath(line));
  } catch {
    return [];
  }
}

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function collectAddedLinesFromDiff(filePath, isUntracked) {
  if (isUntracked) {
    try {
      return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    } catch {
      return [];
    }
  }

  const diffOutput = runCommand(`git diff --unified=0 HEAD -- "${filePath}"`);
  return diffOutput
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function parseMarkdownTableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }

  const cells = trimmed
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

  return cells.length >= 7 ? cells : null;
}

function isEvidenceRow(cells) {
  // Ignore header/separator rows.
  if (cells.every((cell) => cell === '---' || cell.length === 0)) {
    return false;
  }

  const requiredColumns = [3, 4, 5];
  return requiredColumns.every((index) => {
    const value = cells[index];
    return typeof value === 'string' && value.length > 0;
  });
}

function collectStructuredEvidenceRowsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => parseMarkdownTableCells(line))
      .filter((cells) => cells !== null)
      .filter((cells) => isEvidenceRow(cells));
  } catch {
    return [];
  }
}

function collectChangedFiles() {
  const workspaceChanges = runGitNameOnly('git diff --name-only --relative HEAD');
  const untracked = runGitNameOnly('git ls-files --others --exclude-standard');
  return Array.from(new Set([...workspaceChanges, ...untracked])).sort((a, b) => a.localeCompare(b));
}

function collectUntrackedFiles() {
  return new Set(runGitNameOnly('git ls-files --others --exclude-standard'));
}

function isSw13ScopePath(filePath) {
  return SW13_SCOPE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

const changedFiles = collectChangedFiles();
const untrackedFiles = collectUntrackedFiles();
const sw13ScopeChanges = changedFiles.filter((filePath) => isSw13ScopePath(filePath));
const sw13ScopeChangesExcludingAdoption = sw13ScopeChanges.filter((filePath) => filePath !== ADOPTION_LOG_PATH);
const isCi = String(process.env.CI ?? '')
  .trim()
  .toLowerCase() === 'true';

if (sw13ScopeChanges.length === 0) {
  console.log('SW-13 governance adoption gate passed (no SW-13 stabilization-scope file changes detected).');
  process.exit(0);
}

const adoptionLogTouched = changedFiles.some((filePath) => filePath === ADOPTION_LOG_PATH);

if (!adoptionLogTouched) {
  const existingEvidenceRows = collectStructuredEvidenceRowsFromFile(ADOPTION_LOG_PATH);
  if (!isCi && existingEvidenceRows.length > 0) {
    console.log(
      `SW-13 governance adoption gate passed (${sw13ScopeChanges.length} SW-13 stabilization-scope file change(s); existing structured adoption evidence rows detected).`,
    );
    process.exit(0);
  }

  console.error('SW-13 governance adoption gate failed.');
  console.error('Detected SW-13 stabilization-scope changes without adoption-log evidence update.');
  console.error('');
  console.error('Scope-triggering files:');
  for (const filePath of sw13ScopeChanges) {
    console.error(`  - ${filePath}`);
  }
  console.error('');
  console.error(`Required update: ${ADOPTION_LOG_PATH}`);
  if (!isCi) {
    console.error('Add or update an evidence row, or split non-SW-13 changes into a separate change set.');
  } else {
    console.error('CI mode requires a fresh adoption-log update in this diff for SW-13 stabilization-scope changes.');
  }
  process.exit(1);
}

if (sw13ScopeChangesExcludingAdoption.length > 0) {
  const addedLines = collectAddedLinesFromDiff(ADOPTION_LOG_PATH, untrackedFiles.has(ADOPTION_LOG_PATH));
  const addedEvidenceRows = addedLines
    .map((line) => parseMarkdownTableCells(line))
    .filter((cells) => cells !== null)
    .filter((cells) => isEvidenceRow(cells));

  if (addedEvidenceRows.length === 0) {
    console.error('SW-13 governance adoption gate failed.');
    console.error('Detected SW-13 stabilization-scope changes without a new structured adoption evidence row.');
    console.error('');
    console.error('Scope-triggering files:');
    for (const filePath of sw13ScopeChangesExcludingAdoption) {
      console.error(`  - ${filePath}`);
    }
    console.error('');
    console.error(`Required update: add a new evidence-table row in ${ADOPTION_LOG_PATH}`);
    console.error('Ensure Reviewer Checklist Confirmed, Focused Validation Commands Documented, and Readiness Assertions Confirmed columns are populated.');
    process.exit(1);
  }
}

console.log(
  `SW-13 governance adoption gate passed (${sw13ScopeChanges.length} SW-13 stabilization-scope file change(s); adoption log updated with structured evidence).`,
);
