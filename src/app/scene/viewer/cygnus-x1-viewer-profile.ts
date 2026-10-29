import type { ViewerBody } from '../../model/solar-system-get';

export const CYGNUS_X1_BLACK_HOLE_IDENTITY = {
  namespace: 'cygnus-x1',
  key: 'black-hole',
} as const;

export const CYGNUS_X1_COMPANION_IDENTITY = {
  namespace: 'cygnus-x1',
  key: 'hd226868',
} as const;

export const CYGNUS_X1_PRESENTATION_POSITIONS = {
  blackHole: [-2.5, 0, 0],
  companion: [2.5, 0, 0],
} as const;

function hasIdentity(body: ViewerBody, identity: { namespace: string; key: string }): boolean {
  return body.catalogIdentity?.namespace === identity.namespace && body.catalogIdentity.key === identity.key;
}

/** Only the permanent catalog pair selects the Cygnus X-1 black-hole profile. */
export function isCygnusX1BlackHole(body: ViewerBody): boolean {
  return (
    hasIdentity(body, CYGNUS_X1_BLACK_HOLE_IDENTITY) &&
    body.bodyType === 'black-hole' &&
    body.surfaceArchetype === 'black-hole'
  );
}

/** HYG identifiers, entity IDs and display names are not companion aliases. */
export function isCygnusX1Companion(body: ViewerBody): boolean {
  return (
    hasIdentity(body, CYGNUS_X1_COMPANION_IDENTITY) && body.bodyType === 'star' && body.surfaceArchetype === 'star'
  );
}

/**
 * These seed-time zero positions are authored system-origin placeholders. Return
 * a separate display layout only when both catalog bodies still have that exact
 * placeholder; never alter their canonical spatial snapshots or orbital data.
 */
export function resolveCygnusX1PresentationLayout(
  bodies: readonly ViewerBody[],
): ReadonlyMap<ViewerBody, [number, number, number]> {
  const blackHole = bodies.find(isCygnusX1BlackHole);
  const companion = bodies.find(isCygnusX1Companion);
  if (!blackHole || !companion || !isSystemOriginPlaceholder(blackHole) || !isSystemOriginPlaceholder(companion)) {
    return new Map();
  }
  return new Map([
    [blackHole, [...CYGNUS_X1_PRESENTATION_POSITIONS.blackHole]],
    [companion, [...CYGNUS_X1_PRESENTATION_POSITIONS.companion]],
  ]);
}

function isSystemOriginPlaceholder(body: ViewerBody): boolean {
  const position = body.spatial.positionKm;
  return body.spatial.frame === 'barycentric' && position.x === 0 && position.y === 0 && position.z === 0;
}
