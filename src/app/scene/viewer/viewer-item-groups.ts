import type { ViewerBody } from '../../model/solar-system-get';

/** UI group keys, derived from existing Forge classification rather than a new wire field. */
export function viewerBodyGroup(body: ViewerBody): string {
  const type = body.bodyType.trim().toLowerCase();
  // Celestial asteroids must be opt-in even when no descriptor is supplied.
  if (type === 'asteroid') return 'asteroids';
  if (body.externalObjectDescriptor) return body.externalObjectDescriptor.domain;
  const groups: Record<string, string> = {
    star: 'stars',
    planet: 'planets',
    moon: 'moons',
    station: 'stations',
    gate: 'gates',
    'jump-gate': 'gates',
    jumpgate: 'gates',
    ship: 'ships',
  };
  return groups[type] ?? type;
}
