import type { SolarSystemGetSummary } from '../../src/app/model/solar-system-get';
import type { SolarSystemSummary } from '../../src/app/model/solar-system-list';

const SYSTEM_METADATA = {
  hygSystemId: null,
  isMultiStar: false,
  positionPc: null,
  distanceParsec: null,
  primaryStar: null,
  starCount: 0,
  generationSeed: null,
};

/** Synthetic test-only labels. No source catalog, names or assignments are modified. */
export const NAMING_SYSTEMS: SolarSystemSummary[] = [
  {
    ...SYSTEM_METADATA,
    id: 'synthetic-naming-null', displayName: 'TEST-001', settlementName: null,
    catalogName: null, aliases: [], source: 'curated',
  },
  {
    ...SYSTEM_METADATA,
    id: 'synthetic-naming-cjk', displayName: '星河 (TEST-002)', settlementName: '星河',
    catalogName: 'TEST-002', aliases: ['合成', 'Écho'], source: 'curated',
  },
  {
    ...SYSTEM_METADATA,
    id: 'synthetic-naming-arabic', displayName: 'اختبار (TEST-003)', settlementName: 'اختبار',
    catalogName: 'TEST-003', aliases: ['fixture.*'], source: 'curated',
  },
  {
    ...SYSTEM_METADATA,
    id: 'synthetic-naming-devanagari', displayName: 'परीक्षण (TEST-004)', settlementName: 'परीक्षण',
    catalogName: 'TEST-004', aliases: [], source: 'curated',
  },
  {
    ...SYSTEM_METADATA,
    id: 'synthetic-naming-null-aliases', displayName: 'TEST-005', settlementName: null,
    catalogName: 'TEST-005', aliases: ['synthetic historical label'], source: 'curated',
  },
];

/** Deliberately different get label proves details consumes get, not stale list state. */
export function namingGetSummary(system: SolarSystemSummary): SolarSystemGetSummary & { generationSeed: null } {
  return {
    ...system, displayName: `${system.displayName} / GET`,
    hygSystemId: null, isMultiStar: false, positionPc: null, distanceParsec: null,
    primaryStar: null, starCount: 0, generationSeed: null,
  };
}

/** Test server emulator only; mirrors documented literal matching, not frontend logic. */
export function matchesNamingQuery(system: SolarSystemSummary, query: string): boolean {
  const normalize = (text: string) => text.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
  return [system.id, system.displayName, system.settlementName, system.catalogName, ...system.aliases]
    .some((value) => value != null && normalize(value).includes(normalize(query)));
}
