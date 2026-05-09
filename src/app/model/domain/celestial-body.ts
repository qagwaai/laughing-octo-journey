import { Triple } from '../shared/triple';

/**
 * Core celestial body shape used by gameplay/domain projections.
 */
export interface CelestialBody {
  name: string;
  position: Triple;
}
