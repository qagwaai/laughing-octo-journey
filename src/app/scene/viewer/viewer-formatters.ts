import { Euler, Quaternion, Vector3 } from 'three';
import type { ViewerBody } from '../../model/solar-system-get';

/** Hybrid scaling constants for the Viewer system scene. */
export const VIEWER_SCENE_STAR_BASE_RADIUS = 0.28;
export const VIEWER_SCENE_STAR_MAX_RADIUS = 0.45;
export const VIEWER_SCENE_STAR_MIN_RADIUS = 0.18;
export const VIEWER_SCENE_PLANET_BASE_RADIUS = 0.14;
export const VIEWER_SCENE_PLANET_MAX_RADIUS = 0.46;
export const VIEWER_SCENE_PLANET_MIN_RADIUS = 0.05;
export const VIEWER_SCENE_DEFAULT_PLANET_COLOR = '#9bb1c9';
export const VIEWER_SCENE_DEFAULT_STAR_COLOR = '#ffedbc';
export const VIEWER_SCENE_DISTANCE_LOG_BASE = 6;
export const VIEWER_SCENE_DISTANCE_REFERENCE_KM = 1_000_000; // 1 Mkm reference for log scaling.
export const VIEWER_SCENE_DISTANCE_UNIT = 5;
export const VIEWER_SCENE_ANCHORED_ORBIT_SCALE = 0.24;
export const VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_X = 0.12;
export const VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_Z = 0.1;
export const VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X = 0.55;
export const VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z = 0.45;

/**
 * Converts a world-space distance in kilometers into the viewer scene distance scale.
 */
export function resolveSceneDistanceFromKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }
  if (distanceKm < VIEWER_SCENE_DISTANCE_REFERENCE_KM) {
    const linear = (distanceKm / VIEWER_SCENE_DISTANCE_REFERENCE_KM) * VIEWER_SCENE_DISTANCE_UNIT;
    return Math.max(0.08, +linear.toFixed(3));
  }

  const ratio =
    Math.log(distanceKm / VIEWER_SCENE_DISTANCE_REFERENCE_KM) /
    Math.log(VIEWER_SCENE_DISTANCE_LOG_BASE);
  return +((1 + ratio) * VIEWER_SCENE_DISTANCE_UNIT).toFixed(3);
}

/**
 * Returns true when the body should be rendered as a star (lit/glowing).
 */
export function isStarBody(body: ViewerBody): boolean {
  return body.bodyType === 'star';
}

/**
 * Resolves a hex color for a body, falling back to defaults by body type.
 */
export function resolveBodyColor(body: ViewerBody): string {
  const explicit = body.visualization?.colorHex?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  return isStarBody(body) ? VIEWER_SCENE_DEFAULT_STAR_COLOR : VIEWER_SCENE_DEFAULT_PLANET_COLOR;
}

/**
 * Hybrid star radius from luminosity (clamped); falls back to base when missing.
 */
export function resolveStarSceneRadius(luminositySolar: number | undefined): number {
  if (typeof luminositySolar !== 'number' || !Number.isFinite(luminositySolar) || luminositySolar <= 0) {
    return VIEWER_SCENE_STAR_BASE_RADIUS;
  }
  const scaled = VIEWER_SCENE_STAR_BASE_RADIUS * Math.sqrt(luminositySolar);
  return Math.max(VIEWER_SCENE_STAR_MIN_RADIUS, Math.min(VIEWER_SCENE_STAR_MAX_RADIUS, scaled));
}

/**
 * Hybrid planet radius from physical diameter (log-inflated, clamped).
 */
export function resolvePlanetSceneRadius(diameterM: number | undefined): number {
  if (typeof diameterM !== 'number' || !Number.isFinite(diameterM) || diameterM <= 0) {
    return VIEWER_SCENE_PLANET_BASE_RADIUS;
  }
  const earthDiameterM = 12_742_000;
  const ratio = diameterM / earthDiameterM;
  const scaled = VIEWER_SCENE_PLANET_BASE_RADIUS * Math.cbrt(Math.max(0.05, ratio));
  return Math.max(VIEWER_SCENE_PLANET_MIN_RADIUS, Math.min(VIEWER_SCENE_PLANET_MAX_RADIUS, scaled));
}

/**
 * Resolves a body's render radius using star/planet rules.
 */
export function resolveBodySceneRadius(body: ViewerBody): number {
  if (isStarBody(body)) {
    return resolveStarSceneRadius(body.luminositySolar);
  }
  return resolvePlanetSceneRadius(body.physicalCatalog?.estimatedDiameterM);
}

/**
 * Maps a body's `spatial.positionKm` into a hybrid (log-distance) scene position
 * with the system barycenter at the scene origin. Stars stay at the origin.
 */
export function resolveBodyScenePosition(body: ViewerBody): [number, number, number] {
  if (isStarBody(body)) {
    return [0, 0, 0];
  }

  // Try orbital-element-based position first (more accurate to orbital plane).
  // Bodies with anchorBodyId are skipped here and resolved in the second pass
  // relative to their parent's scene position.
  const orbitalPos = resolveBodyOrbitalPosition(body, [0, 0, 0]);
  if (orbitalPos) {
    return orbitalPos;
  }

  // Fallback to spatial position if orbital elements unavailable
  const { x, y, z } = body.spatial.positionKm;
  const magnitudeKm = Math.hypot(x, y, z);
  if (magnitudeKm <= 0) {
    return [0, 0, 0];
  }

  const scaled = resolveSceneDistanceFromKm(magnitudeKm);

  const dx = x / magnitudeKm;
  const dy = y / magnitudeKm;
  const dz = z / magnitudeKm;

  return [+(dx * scaled).toFixed(3), +(dy * scaled).toFixed(3), +(dz * scaled).toFixed(3)];
}

/**
 * Calculates a body's position on its orbital ellipse using orbital elements
 * and mean anomaly. Applies orbital plane rotation to place the body correctly.
 * Returns null if orbital elements are incomplete.
 */
export function resolveBodyOrbitalPositionRelativeToAnchor(body: ViewerBody, anchorPosition: [number, number, number]): [number, number, number] | null {
  const orbital = body.orbitalElements;
  const anchorId = orbital?.anchorBodyId;
  
  // Need valid semi-major axis
  const semiMajorAxisKm = orbital?.semiMajorAxisKm;
  if (typeof semiMajorAxisKm !== 'number' || !Number.isFinite(semiMajorAxisKm) || semiMajorAxisKm <= 0) {
    return null;
  }

  // If no anchor, this body orbits the origin; otherwise it orbits another body
  const isChildBody = typeof anchorId === 'string' && anchorId.length > 0;
  if (!isChildBody) {
    // Non-anchored bodies use spatial position
    return null;
  }

  // Clamp eccentricity
  const eRaw = orbital?.eccentricity;
  const e = typeof eRaw === 'number' && Number.isFinite(eRaw) ? Math.min(Math.max(eRaw, 0), 0.99) : 0;
  
  // Child-body orbits (moons around planets) use a compressed scene scale.
  const scaledOrbitRadius = resolveSceneDistanceFromKm(semiMajorAxisKm) * VIEWER_SCENE_ANCHORED_ORBIT_SCALE;
  const radiusX = Math.max(VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_X, +scaledOrbitRadius.toFixed(3));
  const radiusZ = Math.max(
    VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_Z,
    +(radiusX * Math.sqrt(1 - e * e)).toFixed(3),
  );

  // Get mean anomaly (default to 0 if not available)
  const meanAnomalyDeg = orbital?.meanAnomalyAtEpochDeg ?? 0;
  const meanAnomaly = (meanAnomalyDeg * Math.PI) / 180;

  // Position on ellipse in local XY. qBase later rotates XY -> XZ,
  // matching the orbit ring mesh construction.
  const posX = radiusX * Math.cos(meanAnomaly);
  const posY = radiusZ * Math.sin(meanAnomaly);
  const posZ = 0;

  // Construct orbital rotation (same as orbit ring)
  const ascendingNode = ((orbital?.longitudeOfAscendingNodeDeg ?? 0) * Math.PI) / 180;
  const inclination = ((orbital?.inclinationDeg ?? 0) * Math.PI) / 180;
  const argumentOfPeriapsis = ((orbital?.argumentOfPeriapsisDeg ?? 0) * Math.PI) / 180;

  const yAxis = new Vector3(0, 1, 0);
  const xAxis = new Vector3(1, 0, 0);

  const qBase = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0, 'XYZ'));
  const qNode = new Quaternion().setFromAxisAngle(yAxis, ascendingNode);
  const qInclination = new Quaternion().setFromAxisAngle(xAxis, inclination);
  const qPeriapsis = new Quaternion().setFromAxisAngle(yAxis, argumentOfPeriapsis);

  const orbitQ = qNode.clone().multiply(qInclination).multiply(qPeriapsis).multiply(qBase);

  // Apply rotation to position
  const posVector = new Vector3(posX, posY, posZ);
  posVector.applyQuaternion(orbitQ);

  // Translate by anchor position
  const finalX = +(anchorPosition[0] + posVector.x).toFixed(3);
  const finalY = +(anchorPosition[1] + posVector.y).toFixed(3);
  const finalZ = +(anchorPosition[2] + posVector.z).toFixed(3);

  return [finalX, finalY, finalZ];
}

/**
 * Calculates a body's position on its orbital ellipse using orbital elements
 * and mean anomaly. Applies orbital plane rotation to place the body correctly.
 * Returns null if orbital elements are incomplete.
 *
 * Bodies with orbital elements but no explicit anchor orbit the system origin (primary star).
 * Bodies WITH an anchorBodyId are intentionally skipped here — they are resolved in a
 * second pass via resolveBodyOrbitalPositionRelativeToAnchor with the anchor's scene position.
 */
function resolveBodyOrbitalPosition(body: ViewerBody, anchorPosition: [number, number, number]): [number, number, number] | null {
  const orbital = body.orbitalElements;

  // Bodies with an explicit anchor are handled in the second pass relative to their parent.
  // Only position unanchored bodies (e.g. planets orbiting the primary star) here.
  const anchorId = orbital?.anchorBodyId;
  if (typeof anchorId === 'string' && anchorId.length > 0) {
    return null;
  }
  
  // Need valid semi-major axis (this is the key indicator of orbital data)
  const semiMajorAxisKm = orbital?.semiMajorAxisKm;
  if (typeof semiMajorAxisKm !== 'number' || !Number.isFinite(semiMajorAxisKm) || semiMajorAxisKm <= 0) {
    return null;
  }

  // Clamp eccentricity
  const eRaw = orbital?.eccentricity;
  const e = typeof eRaw === 'number' && Number.isFinite(eRaw) ? Math.min(Math.max(eRaw, 0), 0.99) : 0;
  
  // Calculate semi-minor axis
  const radiusX = Math.max(VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X, resolveSceneDistanceFromKm(semiMajorAxisKm));
  const radiusZ = Math.max(VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z, +(radiusX * Math.sqrt(1 - e * e)).toFixed(3));

  // Get mean anomaly (default to 0 if not available)
  const meanAnomalyDeg = orbital?.meanAnomalyAtEpochDeg ?? 0;
  const meanAnomaly = (meanAnomalyDeg * Math.PI) / 180;

  // Position on ellipse in local XY. qBase later rotates XY -> XZ,
  // matching the orbit ring mesh construction.
  const posX = radiusX * Math.cos(meanAnomaly);
  const posY = radiusZ * Math.sin(meanAnomaly);
  const posZ = 0;

  // Construct orbital rotation
  const ascendingNode = ((orbital?.longitudeOfAscendingNodeDeg ?? 0) * Math.PI) / 180;
  const inclination = ((orbital?.inclinationDeg ?? 0) * Math.PI) / 180;
  const argumentOfPeriapsis = ((orbital?.argumentOfPeriapsisDeg ?? 0) * Math.PI) / 180;

  const yAxis = new Vector3(0, 1, 0);
  const xAxis = new Vector3(1, 0, 0);

  const qBase = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0, 'XYZ'));
  const qNode = new Quaternion().setFromAxisAngle(yAxis, ascendingNode);
  const qInclination = new Quaternion().setFromAxisAngle(xAxis, inclination);
  const qPeriapsis = new Quaternion().setFromAxisAngle(yAxis, argumentOfPeriapsis);

  const orbitQ = qNode.clone().multiply(qInclination).multiply(qPeriapsis).multiply(qBase);

  // Apply rotation to position
  const posVector = new Vector3(posX, posY, posZ);
  posVector.applyQuaternion(orbitQ);

  // Translate by anchor position
  const finalX = +(anchorPosition[0] + posVector.x).toFixed(3);
  const finalY = +(anchorPosition[1] + posVector.y).toFixed(3);
  const finalZ = +(anchorPosition[2] + posVector.z).toFixed(3);

  return [finalX, finalY, finalZ];
}
