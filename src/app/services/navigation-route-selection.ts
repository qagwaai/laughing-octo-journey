import type { NavigationDirectReference, NavigationRouteSuccess } from '../model/navigation-route-search';

export type NavigationRouteChoice =
  | { kind: 'direct'; direct: NavigationDirectReference; reasons: NavigationSelectionReason[] }
  | { kind: 'route'; route: NavigationRouteSuccess; reasons: NavigationSelectionReason[] };

export type NavigationSelectionReason = 'direct' | 'shortest-examined' | 'low-cost' | 'different-flyby';

export function selectNavigationRoutes(
  direct: NavigationDirectReference | null,
  routes: NavigationRouteSuccess[],
): NavigationRouteChoice[] {
  const sorted = routes
    .filter((route) => route.eligible && route.target.kind === 'market' && route.prefixBodyIds.length > 0)
    .slice()
    .sort((a, b) => a.totalDistanceKm - b.totalDistanceKm || a.jobId.localeCompare(b.jobId));
  const choices: NavigationRouteChoice[] = direct ? [{ kind: 'direct', direct, reasons: ['direct'] }] : [];
  const shortest = sorted[0];
  if (direct?.eligible && (!shortest || direct.distanceKm <= shortest.totalDistanceKm)) {
    choices[0].reasons.push('shortest-examined');
  }

  const chosen = new Set<string>();
  const add = (route: NavigationRouteSuccess, reason: NavigationSelectionReason): void => {
    if (choices.length >= 5 || chosen.has(route.jobId)) return;
    const reasons: NavigationSelectionReason[] = [reason];
    if (route === shortest && !(direct?.eligible && direct.distanceKm <= route.totalDistanceKm)) {
      reasons.unshift('shortest-examined');
    }
    choices.push({ kind: 'route', route, reasons });
    chosen.add(route.jobId);
  };

  for (const route of sorted.slice(0, 2)) add(route, 'low-cost');
  const represented = new Set(
    choices.flatMap((choice) => (choice.kind === 'route' ? choice.route.prefixBodyIds : [])),
  );
  for (const route of sorted) {
    if (route.prefixBodyIds.some((bodyId) => !represented.has(bodyId))) {
      add(route, 'different-flyby');
      if (chosen.has(route.jobId)) route.prefixBodyIds.forEach((bodyId) => represented.add(bodyId));
    }
  }
  for (const route of sorted) add(route, 'low-cost');
  return choices;
}
