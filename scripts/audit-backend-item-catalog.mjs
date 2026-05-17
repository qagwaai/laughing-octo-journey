import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src', 'app');
const SERVER_URL = process.env.CATALOG_SERVER_URL ?? 'http://localhost:3000';
const ITEMS_ENDPOINT = process.env.CATALOG_ITEMS_ENDPOINT ?? '/items';
const ITEM_TYPE_EQUIVALENCE = new Map([
  ['copper-ore', 'copper'],
  ['copper-raw-material', 'copper'],
  ['iron-ore', 'iron'],
  ['iron-raw-material', 'iron'],
]);

const EXCLUDED_SEGMENTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}coverage${path.sep}`,
  `${path.sep}playwright-report${path.sep}`,
  `${path.sep}test-results${path.sep}`,
  `${path.sep}testing${path.sep}`,
  `${path.sep}e2e${path.sep}`,
];

const EXCLUDED_SUFFIXES = ['.spec.ts', '.test.ts'];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_SEGMENTS.some((segment) => fullPath.includes(segment))) {
        continue;
      }
      yield* walk(fullPath);
      continue;
    }

    if (!entry.name.endsWith('.ts')) {
      continue;
    }

    if (EXCLUDED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      continue;
    }

    yield fullPath;
  }
}

function addMatch(results, itemType, filePath, source) {
  const normalized = itemType.trim().toLowerCase();
  if (!normalized) return;

  if (!results.has(normalized)) {
    results.set(normalized, []);
  }

  results.get(normalized).push({ filePath, source });
}

async function collectRequiredItemTypes() {
  const results = new Map();

  for await (const filePath of walk(SRC_DIR)) {
    const text = await fs.readFile(filePath, 'utf8');
    const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

    // Item constants used throughout domain logic.
    for (const match of text.matchAll(/\b[A-Z0-9_]*ITEM_TYPE\s*=\s*'([a-z0-9-]+)'/g)) {
      addMatch(results, match[1], rel, 'ITEM_TYPE constant');
    }

    // Strong indicator of runtime item-type requirements.
    for (const match of text.matchAll(/\bitemType\s*:\s*'([a-z0-9-]+)'/g)) {
      addMatch(results, match[1], rel, 'itemType literal');
    }

    // Fabrication recipes can accept alias material item types.
    for (const match of text.matchAll(/acceptedItemTypes\s*:\s*\[([^\]]+)\]/g)) {
      const arrayLiteral = match[1];
      for (const itemMatch of arrayLiteral.matchAll(/'([a-z0-9-]+)'/g)) {
        addMatch(results, itemMatch[1], rel, 'acceptedItemTypes literal');
      }
    }
  }

  return results;
}

async function fetchBackendItems() {
  const endpoint = `${SERVER_URL}${ITEMS_ENDPOINT}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch backend items from ${endpoint} (${response.status})`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];

  const itemTypes = new Set();
  for (const item of items) {
    const type = String(item?.itemType ?? '').trim().toLowerCase();
    if (type) {
      itemTypes.add(type);
    }
  }

  return {
    endpoint,
    count: items.length,
    itemTypes,
  };
}

function formatReferences(refs, max = 3) {
  const unique = [];
  const seen = new Set();
  for (const ref of refs) {
    const key = `${ref.filePath}:${ref.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ref);
  }
  return unique.slice(0, max).map((ref) => `${ref.filePath} (${ref.source})`);
}

function resolveEquivalentBackendType(itemType, backendItemTypes) {
  if (backendItemTypes.has(itemType)) {
    return itemType;
  }

  const mappedType = ITEM_TYPE_EQUIVALENCE.get(itemType);
  if (mappedType && backendItemTypes.has(mappedType)) {
    return mappedType;
  }

  // Generic fallback: treat "*-raw-material" as equivalent to base item when present.
  if (itemType.endsWith('-raw-material')) {
    const baseType = itemType.slice(0, -'-raw-material'.length);
    if (baseType && backendItemTypes.has(baseType)) {
      return baseType;
    }
  }

  return null;
}

async function main() {
  const expected = await collectRequiredItemTypes();
  const backend = await fetchBackendItems();

  const expectedTypes = [...expected.keys()].sort();
  const missing = expectedTypes.filter((itemType) => !backend.itemTypes.has(itemType));
  const reconciledMissing = expectedTypes.filter(
    (itemType) => !resolveEquivalentBackendType(itemType, backend.itemTypes),
  );
  const reconciledByEquivalence = missing.filter(
    (itemType) => !reconciledMissing.includes(itemType),
  );

  console.log(`Backend item endpoint: ${backend.endpoint}`);
  console.log(`Backend items returned: ${backend.count}`);
  console.log(`Frontend-required item types discovered: ${expectedTypes.length}`);
  console.log('');

  if (!reconciledMissing.length) {
    console.log('No missing item types detected.');
    process.exit(0);
  }

  if (reconciledByEquivalence.length) {
    console.log(`Reconciled by equivalence (${reconciledByEquivalence.length}):`);
    for (const itemType of reconciledByEquivalence) {
      const equivalentType = resolveEquivalentBackendType(itemType, backend.itemTypes);
      console.log(`- ${itemType} -> ${equivalentType}`);
    }
    console.log('');
  }

  console.log(`Missing item types after reconciliation (${reconciledMissing.length}):`);
  for (const itemType of reconciledMissing) {
    const refs = formatReferences(expected.get(itemType) ?? []);
    console.log(`- ${itemType}`);
    for (const ref of refs) {
      console.log(`  - ${ref}`);
    }
  }

  process.exit(2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
