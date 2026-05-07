#!/usr/bin/env node
/**
 * migrate-testing-helpers.js
 *
 * One-shot migration script. For each spec file that has inline copies of
 * createSignal / MockSocketService / MockSessionService:
 *   1. Removes the local helper blocks.
 *   2. Inserts an import from the shared src/testing module.
 *
 * Run from the repo root: node scripts/migrate-testing-helpers.js
 * Safe to re-run — detects files already migrated and skips them.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Patterns to remove  (order matters: remove inner blocks before wrappers)
// ---------------------------------------------------------------------------

// createSignal function (4 lines)
const CREATE_SIGNAL_FN = /function createSignal<T>\(initial: T\) \{[\s\S]*?^\}\n?/m;

// WritableSignalLike type alias (1 line)
const WRITABLE_SIGNAL_TYPE = /^type WritableSignalLike<T> = \(\(\) => T\) & \{ set\(v: T\): void \};\n/m;

// interface MockSocketService + all its members (until closing brace)
const MOCK_SOCKET_INTERFACE = /^interface MockSocketService \{[\s\S]*?^\}\n?/m;

// createMockSocketService factory function
const CREATE_MOCK_SOCKET_FN = /^function createMockSocketService\(\): MockSocketService \{[\s\S]*?^\}\n?/m;

// interface MockSessionService + all its members
const MOCK_SESSION_INTERFACE = /^interface MockSessionService \{[\s\S]*?^\}\n?/m;

// createMockSessionService factory function (handles optional arg)
const CREATE_MOCK_SESSION_FN = /^function createMockSessionService\([^)]*\): MockSessionService \{[\s\S]*?^\}\n?/m;

// ---------------------------------------------------------------------------
// File list: which helpers each file needs stripped
// ---------------------------------------------------------------------------

const FILES = [
  // signal only
  {
    rel: 'src/app/page/game/fabrication-lab.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/character-profile.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/game-main.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/item-view-specs.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/print-queue.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/repair-retrofit.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/repair-retrofit-item-detail.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/repair-retrofit-items.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/repair-retrofit-ship-detail.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/ship-view-inventory.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/ship-view-specs.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/stellar-initiation.spec.ts',
    remove: ['signal'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/scene/ship-view-specs.spec.ts',
    remove: ['signal'],
    testingPath: '../../testing',
  },

  // signal + socket + session
  {
    rel: 'src/app/page/game/market-hub.spec.ts',
    remove: ['signal', 'writableSignalType', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/mission-board.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/ship-hangar.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/game/game-join.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/character/character-list.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/character/character-setup.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/public/login.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },
  {
    rel: 'src/app/page/public/registration.spec.ts',
    remove: ['signal', 'socket', 'session'],
    testingPath: '../../../testing',
  },

  // NOTE: mission.service.spec.ts uses a class-based MockSocketService provided
  // to TestBed (not the interface+factory pattern), so it is intentionally excluded.
];

// ---------------------------------------------------------------------------
// Helpers to detect which names are actually used in a file
// ---------------------------------------------------------------------------

function buildImportLine(used, testingPath) {
  const exports = [];
  if (used.has('signal') || used.has('writableSignalType')) {
    exports.push('createSignal');
    if (used.has('writableSignalType')) exports.push('type WritableSignalLike');
  }
  if (used.has('socket')) {
    exports.push('createMockSocketService', 'type MockSocketService');
  }
  if (used.has('session')) {
    exports.push('createMockSessionService', 'type MockSessionService');
  }
  return `import { ${exports.join(', ')} } from '${testingPath}';\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let changed = 0;
let skipped = 0;
let errors = 0;

for (const { rel, remove, testingPath } of FILES) {
  const absPath = path.join(root, rel);
  if (!fs.existsSync(absPath)) {
    console.warn(`WARN  file not found: ${rel}`);
    continue;
  }

  let src = fs.readFileSync(absPath, 'utf8');

  // Detect already-migrated
  if (src.includes(`from '${testingPath}'`) || src.includes(`from "${testingPath}"`)) {
    console.log(`SKIP  already migrated: ${rel}`);
    skipped++;
    continue;
  }

  const removeSet = new Set(remove);
  const usedHelpers = new Set(remove); // we know what to import based on what we remove

  // Apply removals
  const original = src;

  if (removeSet.has('signal')) src = src.replace(CREATE_SIGNAL_FN, '');
  if (removeSet.has('writableSignalType')) src = src.replace(WRITABLE_SIGNAL_TYPE, '');
  if (removeSet.has('socket')) {
    src = src.replace(MOCK_SOCKET_INTERFACE, '');
    src = src.replace(CREATE_MOCK_SOCKET_FN, '');
  }
  if (removeSet.has('session')) {
    src = src.replace(MOCK_SESSION_INTERFACE, '');
    src = src.replace(CREATE_MOCK_SESSION_FN, '');
  }

  // Collapse runs of 3+ blank lines down to 2 blank lines (cosmetic cleanup)
  src = src.replace(/\n{4,}/g, '\n\n\n');

  if (src === original) {
    console.warn(`WARN  no pattern matched in ${rel} — check the regex`);
    errors++;
    continue;
  }

  // Insert import line
  // Strategy: after the first `export {};` line (shadow specs), or after
  // any existing import block (real specs).
  const importLine = buildImportLine(usedHelpers, testingPath);

  if (src.startsWith('export {};')) {
    // Insert after `export {};\n`
    src = 'export {};\n\n' + importLine + src.slice('export {};\n'.length).replace(/^\n/, '');
  } else {
    // Find the end of the existing import block and insert after it
    const lastImportIdx = findLastImportEnd(src);
    if (lastImportIdx >= 0) {
      src = src.slice(0, lastImportIdx) + '\n' + importLine + src.slice(lastImportIdx);
    } else {
      src = importLine + src;
    }
  }

  fs.writeFileSync(absPath, src, 'utf8');
  console.log(`OK    migrated: ${rel}`);
  changed++;
}

console.log(`\nDone: ${changed} migrated, ${skipped} already done, ${errors} errors`);
if (errors > 0) process.exit(1);

// ---------------------------------------------------------------------------

function findLastImportEnd(src) {
  // Find the last `import ... from '...';` line and return the index after its newline
  let last = -1;
  const re = /^import .+;\n/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    last = m.index + m[0].length;
  }
  return last;
}
