import type { SolarSystemSummary } from '../solar-system-list';

/** UI-only catalog entry; selecting it asks solar-system-get to seed the system on demand. */
export const CYGNUS_X1_SYSTEM_SELECTION: SolarSystemSummary = {
  id: 'cygnus-x1',
  displayName: 'Cygnus X-1',
  source: 'curated',
  distanceParsec: null,
  positionPc: null,
};
