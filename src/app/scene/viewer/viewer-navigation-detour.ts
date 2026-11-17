import { Vector3, type Camera } from 'three';
import type { SupportedNavigationPositionState } from '../../model/solar-system-get';
import { resolveScenePositionFromSpatialKm, type ViewerDistanceMode } from './viewer-formatters';

export type NavigationScenePoint = [number, number, number];
export type NavigationGeometryState = Pick<
  SupportedNavigationPositionState,
  'departure' | 'destination' | 'candidates'
>;

export type NavigationDetour =
  | { status: 'direct' | 'detour'; points: NavigationScenePoint[] }
  | { status: 'unavailable'; reason: 'ENDPOINT_OVERLAPS_CANDIDATE' | 'DETOUR_UNAVAILABLE' };

export const NAVIGATION_CANDIDATE_MARKER_RADIUS = 0.22;
export const NAVIGATION_DETOUR_MARGIN = 0.18;

const EXCLUSION_RADIUS = NAVIGATION_CANDIDATE_MARKER_RADIUS + NAVIGATION_DETOUR_MARGIN;
const GEOMETRY_EPSILON = 1e-8;
const MAX_ARC_STEP_RADIANS = Math.PI / 36;
const LEG_CURVE_STEPS = 32;
// Chords of the sampled arc must also stay outside the visual exclusion circle.
const MIN_PATH_RADIUS = EXCLUSION_RADIUS / Math.cos(MAX_ARC_STEP_RADIANS / 2) + GEOMETRY_EPSILON;

interface Point2 {
  x: number;
  y: number;
}

interface TangentPoint {
  point: Point2;
}

interface CandidatePath {
  points: Point2[];
  length: number;
}

function subtract(left: Point2, right: Point2): Point2 {
  return { x: left.x - right.x, y: left.y - right.y };
}

function dot(left: Point2, right: Point2): number {
  return left.x * right.x + left.y * right.y;
}

function length(point: Point2): number {
  return Math.hypot(point.x, point.y);
}

function distance(left: Point2, right: Point2): number {
  return length(subtract(left, right));
}

function counterClockwiseTangent(point: Point2, center: Point2): Point2 {
  const radius = subtract(point, center);
  return { x: -radius.y, y: radius.x };
}

function tangentPoints(point: Point2, center: Point2, radius: number): TangentPoint[] {
  const vector = subtract(point, center);
  const distanceSquared = dot(vector, vector);
  const radiusSquared = radius * radius;
  if (distanceSquared <= radiusSquared) return [];

  const tangentScale = (radius * Math.sqrt(distanceSquared - radiusSquared)) / distanceSquared;
  const baseScale = radiusSquared / distanceSquared;
  const perpendicular = { x: -vector.y, y: vector.x };
  return [-1, 1].map((sign) => ({
    point: {
      x: center.x + baseScale * vector.x + sign * tangentScale * perpendicular.x,
      y: center.y + baseScale * vector.y + sign * tangentScale * perpendicular.y,
    },
  }));
}

function ccwSweep(from: number, to: number): number {
  const fullTurn = Math.PI * 2;
  return (((to - from) % fullTurn) + fullTurn) % fullTurn;
}

function sampleTangentLeg(start: Point2, end: Point2, center: Point2, tangentAt: 'start' | 'end'): Point2[] {
  const tangentPoint = tangentAt === 'start' ? start : end;
  const radial = subtract(tangentPoint, center);
  const radialLength = length(radial);
  const bow = distance(start, end) * 0.12;
  const offset = { x: (radial.x * bow) / radialLength, y: (radial.y * bow) / radialLength };
  const delta = subtract(end, start);
  // Keep the arc-side control on its tangent; bow the other control away from the marker.
  const control1 = {
    x: start.x + delta.x / 3 + (tangentAt === 'end' ? offset.x : 0),
    y: start.y + delta.y / 3 + (tangentAt === 'end' ? offset.y : 0),
  };
  const control2 = {
    x: start.x + (delta.x * 2) / 3 + (tangentAt === 'start' ? offset.x : 0),
    y: start.y + (delta.y * 2) / 3 + (tangentAt === 'start' ? offset.y : 0),
  };
  const points = [start];
  for (let step = 1; step <= LEG_CURVE_STEPS; step++) {
    const t = step / LEG_CURVE_STEPS;
    const u = 1 - t;
    points.push({
      x: u ** 3 * start.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * end.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * end.y,
    });
  }
  return points;
}

function buildCounterClockwisePath(start: Point2, end: Point2, center: Point2, radius: number): CandidatePath | null {
  const startTangents = tangentPoints(start, center, radius);
  const endTangents = tangentPoints(end, center, radius);
  let best: CandidatePath | null = null;

  for (const startTangent of startTangents) {
    const startDirection = subtract(startTangent.point, start);
    if (dot(startDirection, counterClockwiseTangent(startTangent.point, center)) <= GEOMETRY_EPSILON) continue;

    for (const endTangent of endTangents) {
      const endDirection = subtract(end, endTangent.point);
      if (dot(endDirection, counterClockwiseTangent(endTangent.point, center)) <= GEOMETRY_EPSILON) continue;

      const startAngle = Math.atan2(startTangent.point.y - center.y, startTangent.point.x - center.x);
      const endAngle = Math.atan2(endTangent.point.y - center.y, endTangent.point.x - center.x);
      const sweep = ccwSweep(startAngle, endAngle);
      if (sweep <= GEOMETRY_EPSILON) continue;

      const arcSteps = Math.max(1, Math.ceil(sweep / MAX_ARC_STEP_RADIANS));
      const points = sampleTangentLeg(start, startTangent.point, center, 'end');
      for (let step = 1; step <= arcSteps; step++) {
        const angle = startAngle + (sweep * step) / arcSteps;
        points.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        });
      }
      points.push(...sampleTangentLeg(endTangent.point, end, center, 'start').slice(1));

      const pathLength = points.slice(1).reduce((total, point, index) => total + distance(points[index]!, point), 0);
      if (!best || pathLength < best.length - GEOMETRY_EPSILON) {
        best = { points, length: pathLength };
      }
    }
  }

  return best;
}

function segmentDistanceToPoint(start: Point2, end: Point2, point: Point2): number {
  const segment = subtract(end, start);
  const segmentLengthSquared = dot(segment, segment);
  if (segmentLengthSquared <= GEOMETRY_EPSILON) return distance(start, point);
  const projection = Math.max(0, Math.min(1, dot(subtract(point, start), segment) / segmentLengthSquared));
  return distance({ x: start.x + segment.x * projection, y: start.y + segment.y * projection }, point);
}

function routeClearsCandidate(points: Point2[], center: Point2): boolean {
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end || segmentDistanceToPoint(start, end, center) < EXCLUSION_RADIUS - 1e-6) return false;
  }
  return true;
}

function withInterpolatedHeight(points: Point2[], startY: number, endY: number): NavigationScenePoint[] {
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return previous ? distance(previous, point) : 0;
  });
  const totalLength = segmentLengths.reduce((total, segmentLength) => total + segmentLength, 0);
  if (!Number.isFinite(totalLength) || totalLength <= GEOMETRY_EPSILON) return [];

  let traversed = 0;
  return points.map((point, index) => {
    if (index > 0) traversed += segmentLengths[index - 1] ?? 0;
    const progress = traversed / totalLength;
    return [point.x, startY + (endY - startY) * progress, point.y];
  });
}

export function buildNavigationDetour(
  state: NavigationGeometryState,
  distanceMode: ViewerDistanceMode,
): NavigationDetour {
  const start = resolveScenePositionFromSpatialKm(state.departure.positionKm, distanceMode);
  const end = resolveScenePositionFromSpatialKm(state.destination.positionKm, distanceMode);
  if (![...start, ...end].every(Number.isFinite)) {
    return { status: 'unavailable', reason: 'DETOUR_UNAVAILABLE' };
  }

  const candidate = state.candidates[0];
  if (!candidate) return { status: 'direct', points: [start, end] };

  const centerPosition = resolveScenePositionFromSpatialKm(candidate.positionKm, distanceMode);
  if (![...centerPosition].every(Number.isFinite)) {
    return { status: 'unavailable', reason: 'DETOUR_UNAVAILABLE' };
  }

  // The Viewer rotates canonical X-Y into scene X-Z; scene Y is height.
  const start2 = { x: start[0], y: start[2] };
  const end2 = { x: end[0], y: end[2] };
  const center = { x: centerPosition[0], y: centerPosition[2] };
  if (distance(start2, end2) <= GEOMETRY_EPSILON) {
    return { status: 'unavailable', reason: 'DETOUR_UNAVAILABLE' };
  }
  const closestEndpointDistance = Math.min(distance(start2, center), distance(end2, center));
  if (closestEndpointDistance <= MIN_PATH_RADIUS) {
    return { status: 'unavailable', reason: 'ENDPOINT_OVERLAPS_CANDIDATE' };
  }

  const visualRadius = Math.max(EXCLUSION_RADIUS, closestEndpointDistance * 0.3);
  const pathRadius = visualRadius / Math.cos(MAX_ARC_STEP_RADIANS / 2) + GEOMETRY_EPSILON;
  const path = buildCounterClockwisePath(start2, end2, center, pathRadius);
  if (!path || !routeClearsCandidate(path.points, center)) {
    return { status: 'unavailable', reason: 'DETOUR_UNAVAILABLE' };
  }

  const points = withInterpolatedHeight(path.points, start[1], end[1]);
  if (
    points.length < 3 ||
    points.some((point) => !point.every(Number.isFinite)) ||
    points[0]?.some((coordinate, index) => Math.abs(coordinate - start[index]!) > GEOMETRY_EPSILON) ||
    points[points.length - 1]?.some((coordinate, index) => Math.abs(coordinate - end[index]!) > GEOMETRY_EPSILON)
  ) {
    return { status: 'unavailable', reason: 'DETOUR_UNAVAILABLE' };
  }

  return { status: 'detour', points };
}

export function navigationRouteClearsScreenMarker(
  points: NavigationScenePoint[],
  center: NavigationScenePoint,
  camera: Camera,
  viewport: { width: number; height: number },
): boolean {
  if (points.length < 2 || viewport.width <= 0 || viewport.height <= 0) return false;
  camera.updateMatrixWorld();
  const project = (point: Vector3) => {
    point.project(camera);
    return {
      x: (point.x * viewport.width) / 2,
      y: (point.y * viewport.height) / 2,
      z: point.z,
    };
  };
  const axes: NavigationScenePoint[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const vertices = axes.map(([x, y, z]) =>
    project(
      new Vector3(
        center[0] + x * NAVIGATION_CANDIDATE_MARKER_RADIUS,
        center[1] + y * NAVIGATION_CANDIDATE_MARKER_RADIUS,
        center[2] + z * NAVIGATION_CANDIDATE_MARKER_RADIUS,
      ),
    ),
  );
  const route = points.map((point) => project(new Vector3(...point)));
  if (
    [...vertices, ...route].some(
      (point) => ![point.x, point.y, point.z].every(Number.isFinite) || point.z < -1 || point.z > 1,
    )
  )
    return false;

  const pixelMargin = 3;
  const minX = Math.min(...vertices.map((point) => point.x)) - pixelMargin;
  const maxX = Math.max(...vertices.map((point) => point.x)) + pixelMargin;
  const minY = Math.min(...vertices.map((point) => point.y)) - pixelMargin;
  const maxY = Math.max(...vertices.map((point) => point.y)) + pixelMargin;
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1]!;
    const end = route[index]!;
    let enter = 0;
    let exit = 1;
    const slabs: [number, number, number, number][] = [
      [start.x, end.x - start.x, minX, maxX],
      [start.y, end.y - start.y, minY, maxY],
    ];
    for (const [origin, delta, min, max] of slabs) {
      if (Math.abs(delta) <= GEOMETRY_EPSILON) {
        if (origin < min || origin > max) {
          enter = 2;
          break;
        }
      } else {
        const from = (min - origin) / delta;
        const to = (max - origin) / delta;
        enter = Math.max(enter, Math.min(from, to));
        exit = Math.min(exit, Math.max(from, to));
      }
    }
    if (enter <= exit) return false;
  }
  return true;
}
