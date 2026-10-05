import type { ViewerBody } from '../../model/solar-system-get';
import { resolveCatalogRadiusKm } from '../../model/physical-catalog';
import { Euler, Quaternion, Vector3 } from 'three';

/** Display-only +90 degree X rotation; never use this for API coordinates. */
export function resolveViewerDisplayVector(
  vector: { x: number; y: number; z: number },
): [number, number, number] {
  return [vector.x, vector.z === 0 ? 0 : -vector.z, vector.y];
}

export function resolveOrbitRotationEuler(orbital: ViewerBody['orbitalElements']): [number, number, number] {
  const radians = (degrees: number | undefined) => ((degrees ?? 0) * Math.PI) / 180;
  const xAxis = new Vector3(1, 0, 0);
  const zAxis = new Vector3(0, 0, 1);
  const rotation = new Quaternion().setFromAxisAngle(xAxis, Math.PI / 2);
  rotation
    .multiply(new Quaternion().setFromAxisAngle(zAxis, radians(orbital?.longitudeOfAscendingNodeDeg)))
    .multiply(new Quaternion().setFromAxisAngle(xAxis, radians(orbital?.inclinationDeg)))
    .multiply(new Quaternion().setFromAxisAngle(zAxis, radians(orbital?.argumentOfPeriapsisDeg)));
  const euler = new Euler().setFromQuaternion(rotation, 'XYZ');
  return [euler.x, euler.y, euler.z];
}

/** Hybrid scaling constants for the Viewer system scene. */
export const VIEWER_SCENE_STAR_BASE_RADIUS = 0.28;
export const VIEWER_SCENE_STAR_MAX_RADIUS = 0.45;
export const VIEWER_SCENE_STAR_MIN_RADIUS = 0.18;
export const VIEWER_SCENE_PLANET_BASE_RADIUS = 0.14;
export const VIEWER_SCENE_PLANET_MAX_RADIUS = 0.46;
export const VIEWER_SCENE_PLANET_MIN_RADIUS = 0.05;
export const VIEWER_SCENE_MOON_BASE_RADIUS = 0.055;
export const VIEWER_SCENE_MOON_MAX_RADIUS = 0.2;
export const VIEWER_SCENE_MOON_MIN_RADIUS = 0.03;
export const VIEWER_SCENE_DEFAULT_PLANET_COLOR = '#9bb1c9';
export const VIEWER_SCENE_DEFAULT_STAR_COLOR = '#ffedbc';
export const VIEWER_SCENE_MARKET_STATION_COLOR = '#22c55e';
export const VIEWER_SCENE_MARKET_ORBIT_COLOR = '#86efac';
export const VIEWER_SCENE_GATE_COLOR = '#38bdf8';
export const VIEWER_SCENE_GATE_ORBIT_COLOR = '#7dd3fc';
export const VIEWER_SCENE_ACTIVE_SHIP_COLOR = '#fbbf24';
export const VIEWER_SCENE_INACTIVE_SHIP_COLOR = '#3b82f6';
/** Color for ships whose spatial state is missing or invalid; rendered at a synthetic offset. */
export const VIEWER_SCENE_UNKNOWN_SHIP_COLOR = '#ef4444';
/** Scene-space offset used for ships with unknown/invalid spatial state, so they remain visible. */
export const VIEWER_SCENE_UNKNOWN_SHIP_POSITION: [number, number, number] = [8, 0, 0];
export const VIEWER_SCENE_DISTANCE_LOG_BASE = 6;
export const VIEWER_SCENE_DISTANCE_REFERENCE_KM = 1_000_000; // 1 Mkm reference for log scaling.
export const VIEWER_SCENE_DISTANCE_UNIT = 5;
export type ViewerDistanceMode = 'proportional' | 'compressed';
export const VIEWER_SCENE_KM_PER_AU = 149_597_870.7;
export const VIEWER_SCENE_UNITS_PER_AU = 5;
export const VIEWER_SCENE_ANCHORED_ORBIT_SCALE = 0.24;
export const VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_X = 0.12;
export const VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_Z = 0.1;
export const VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X = 0.55;
export const VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z = 0.45;
/** Zoom-based scaling: scale factors for dynamic body radius adjustment. */
export const VIEWER_SCENE_ZOOM_SCALE_MIN = 0.4; // At max zoom (0%): scale to 40% of base radius
export const VIEWER_SCENE_ZOOM_SCALE_MAX = 1.0; // At min zoom (100%): keep 100% of base radius

export interface AnchoredOrbitSceneProfile {
  scale: number;
  minRadiusX: number;
  minRadiusZ: number;
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * Calculates the zoom-based scale factor for body radii.
 * Linear interpolation: at zoom 0% (max in), scale = 0.4; at zoom 100% (max out), scale = 1.0.
 * @param zoomLevel 0-100, where 0 is maximum zoom (closest) and 100 is minimum zoom (farthest).
 */
export function resolveZoomScaleFactor(zoomLevel: number | undefined): number {
  if (typeof zoomLevel !== 'number' || !Number.isFinite(zoomLevel)) {
    return VIEWER_SCENE_ZOOM_SCALE_MAX;
  }
  const normalized = Math.max(0, Math.min(1, zoomLevel / 100));
  // Linear interpolation: (1 - normalized) because zoom 0 = max in, zoom 100 = max out
  return VIEWER_SCENE_ZOOM_SCALE_MIN + (1 - normalized) * (VIEWER_SCENE_ZOOM_SCALE_MAX - VIEWER_SCENE_ZOOM_SCALE_MIN);
}

/**
 * Converts a world-space distance in kilometers into the viewer scene distance scale.
 */
export function resolveSceneDistanceFromKm(distanceKm: number, mode: ViewerDistanceMode = 'compressed'): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }
  if (mode === 'proportional') {
    return (distanceKm / VIEWER_SCENE_KM_PER_AU) * VIEWER_SCENE_UNITS_PER_AU;
  }
  if (distanceKm < VIEWER_SCENE_DISTANCE_REFERENCE_KM) {
    const linear = (distanceKm / VIEWER_SCENE_DISTANCE_REFERENCE_KM) * VIEWER_SCENE_DISTANCE_UNIT;
    return Math.max(0.08, +linear.toFixed(3));
  }

  const ratio = Math.log(distanceKm / VIEWER_SCENE_DISTANCE_REFERENCE_KM) / Math.log(VIEWER_SCENE_DISTANCE_LOG_BASE);
  return +((1 + ratio) * VIEWER_SCENE_DISTANCE_UNIT).toFixed(3);
}

/**
 * Returns true when the body should be rendered as a star (lit/glowing).
 */
export function isStarBody(body: ViewerBody): boolean {
  return normalizeToken(body.bodyType) === 'star';
}

/**
 * Returns true when the body is a moon.
 */
export function isMoonBody(body: ViewerBody): boolean {
  return normalizeToken(body.bodyType) === 'moon';
}

/**
 * Returns true when the body is a station-backed market node.
 */
export function isMarketStationBody(body: ViewerBody): boolean {
  const descriptor = body.externalObjectDescriptor;
  if (descriptor?.domain === 'stations' && descriptor.objectFamily === 'trade-hub') {
    return true;
  }
  return normalizeToken(body.bodyType) === 'station' && normalizeToken(body.stationKind) === 'market';
}

/**
 * Returns true when the body is represented by the SW-13 gate descriptor family.
 */
export function isGateBody(body: ViewerBody): boolean {
  const descriptor = body.externalObjectDescriptor;
  if (descriptor?.domain === 'gates') {
    return true;
  }
  const bodyType = normalizeToken(body.bodyType);
  return bodyType === 'gate' || bodyType === 'jump-gate' || bodyType === 'jumpgate';
}

/**
 * Resolves a hex color for a body, falling back to defaults by body type.
 */
export function resolveBodyColor(body: ViewerBody): string {
  const explicit = body.visualization?.colorHex?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  if (isMarketStationBody(body)) {
    return VIEWER_SCENE_MARKET_STATION_COLOR;
  }
  if (isGateBody(body)) {
    return VIEWER_SCENE_GATE_COLOR;
  }
  return isStarBody(body) ? VIEWER_SCENE_DEFAULT_STAR_COLOR : VIEWER_SCENE_DEFAULT_PLANET_COLOR;
}

/**
 * Resolves orbit line color with market stations rendered in light green.
 */
export function resolveOrbitColor(body: ViewerBody): string {
  if (isMarketStationBody(body)) {
    return VIEWER_SCENE_MARKET_ORBIT_COLOR;
  }
  if (isGateBody(body)) {
    return VIEWER_SCENE_GATE_ORBIT_COLOR;
  }
  return '#ffffff';
}

/**
 * Returns the scene-space orbit profile for anchored bodies.
 * Market stations use the primary-orbit scale so their orbits remain visible.
 */
export function resolveAnchoredOrbitSceneProfile(body: ViewerBody): AnchoredOrbitSceneProfile {
  if (isMarketStationBody(body)) {
    return {
      scale: 1,
      minRadiusX: VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X,
      minRadiusZ: VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z,
    };
  }

  return {
    scale: VIEWER_SCENE_ANCHORED_ORBIT_SCALE,
    minRadiusX: VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_X,
    minRadiusZ: VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_Z,
  };
}

/**
 * Hybrid star radius from luminosity (clamped); falls back to base when missing.
 */
export function resolveStarSceneRadius(luminositySolar: number | null | undefined): number {
  if (typeof luminositySolar !== 'number' || !Number.isFinite(luminositySolar)) {
    return VIEWER_SCENE_STAR_BASE_RADIUS;
  }
  if (luminositySolar === 0) return VIEWER_SCENE_STAR_MIN_RADIUS;
  const scaled = VIEWER_SCENE_STAR_BASE_RADIUS * Math.sqrt(luminositySolar);
  return Math.max(VIEWER_SCENE_STAR_MIN_RADIUS, Math.min(VIEWER_SCENE_STAR_MAX_RADIUS, scaled));
}

/**
 * Hybrid planet radius from physical diameter (log-inflated, clamped).
 * If zoomLevel is provided, applies zoom-based scaling to shrink planets when zoomed in.
 */
export function resolvePlanetSceneRadius(diameterM: number | undefined, zoomLevel?: number): number {
  if (typeof diameterM !== 'number' || !Number.isFinite(diameterM) || diameterM <= 0) {
    const base = VIEWER_SCENE_PLANET_BASE_RADIUS;
    return base * resolveZoomScaleFactor(zoomLevel);
  }
  const earthDiameterM = 12_742_000;
  const ratio = diameterM / earthDiameterM;
  const scaled = VIEWER_SCENE_PLANET_BASE_RADIUS * Math.cbrt(Math.max(0.05, ratio));
  const clamped = Math.max(VIEWER_SCENE_PLANET_MIN_RADIUS, Math.min(VIEWER_SCENE_PLANET_MAX_RADIUS, scaled));
  return clamped * resolveZoomScaleFactor(zoomLevel);
}

/**
 * Hybrid moon radius from physical diameter (log-inflated, clamped).
 * Uses Moon's diameter as the reference baseline to preserve moon-to-moon variance.
 * If zoomLevel is provided, applies zoom-based scaling to shrink moons when zoomed in.
 */
export function resolveMoonSceneRadius(diameterM: number | undefined, zoomLevel?: number): number {
  if (typeof diameterM !== 'number' || !Number.isFinite(diameterM) || diameterM <= 0) {
    const base = VIEWER_SCENE_MOON_BASE_RADIUS;
    return base * resolveZoomScaleFactor(zoomLevel);
  }

  const moonDiameterM = 3_474_800;
  const ratio = diameterM / moonDiameterM;
  const scaled = VIEWER_SCENE_MOON_BASE_RADIUS * Math.cbrt(Math.max(0.05, ratio));
  const clamped = Math.max(VIEWER_SCENE_MOON_MIN_RADIUS, Math.min(VIEWER_SCENE_MOON_MAX_RADIUS, scaled));
  return clamped * resolveZoomScaleFactor(zoomLevel);
}

/**
 * Resolves a body's render radius using star/planet rules.
 * If zoomLevel is provided, applies zoom-based scaling for planets and moons.
 * Stars are not scaled (they remain fixed to provide visual anchor).
 */
export function resolveBodySceneRadius(body: ViewerBody, zoomLevel?: number): number {
  if (isStarBody(body)) {
    // Stars are not scaled by zoom—they provide a stable visual anchor
    return resolveStarSceneRadius(body.luminositySolar);
  }
  if (isMoonBody(body)) {
    const radiusKm = resolveCatalogRadiusKm(body.physicalCatalog, body.physical);
    return resolveMoonSceneRadius(radiusKm === null ? undefined : radiusKm * 2000, zoomLevel);
  }
  const radiusKm = resolveCatalogRadiusKm(body.physicalCatalog, body.physical);
  return resolvePlanetSceneRadius(radiusKm === null ? undefined : radiusKm * 2000, zoomLevel);
}

/**
 * Projects a stored system-origin snapshot into display space without modifying
 * canonical data. Compressed mode is retained as the helper's compatibility default.
 */
export function resolveBodyScenePosition(body: ViewerBody, mode: ViewerDistanceMode = 'compressed'): [number, number, number] {
  return resolveScenePositionFromSpatialKm(body.spatial.positionKm, mode);
}

export function resolveScenePositionFromSpatialKm(
  positionKm: { x: number; y: number; z: number },
  mode: ViewerDistanceMode = 'compressed',
): [number, number, number] {
  const { x, y, z } = positionKm;
  const magnitudeKm = Math.hypot(x, y, z);
  if (magnitudeKm <= 0) {
    return [0, 0, 0];
  }

  if (mode === 'proportional') {
    const scale = VIEWER_SCENE_UNITS_PER_AU / VIEWER_SCENE_KM_PER_AU;
    const [x, y, z] = resolveViewerDisplayVector(positionKm);
    return [x * scale, y * scale, z * scale];
  }
  const scaled = resolveSceneDistanceFromKm(magnitudeKm, mode);

  const [displayX, displayY, displayZ] = resolveViewerDisplayVector(positionKm);
  const dx = displayX / magnitudeKm;
  const dy = displayY / magnitudeKm;
  const dz = displayZ / magnitudeKm;

  return [+(dx * scaled).toFixed(3), +(dy * scaled).toFixed(3), +(dz * scaled).toFixed(3)];
}
