import type { ViewerBody } from '../../model/solar-system-get';

/** Hybrid scaling constants for the Viewer system scene. */
export const VIEWER_SCENE_STAR_BASE_RADIUS = 1.5;
export const VIEWER_SCENE_STAR_MAX_RADIUS = 5;
export const VIEWER_SCENE_STAR_MIN_RADIUS = 0.6;
export const VIEWER_SCENE_PLANET_BASE_RADIUS = 0.25;
export const VIEWER_SCENE_PLANET_MAX_RADIUS = 0.9;
export const VIEWER_SCENE_PLANET_MIN_RADIUS = 0.12;
export const VIEWER_SCENE_DEFAULT_PLANET_COLOR = '#9bb1c9';
export const VIEWER_SCENE_DEFAULT_STAR_COLOR = '#ffedbc';
export const VIEWER_SCENE_DISTANCE_LOG_BASE = 10;
export const VIEWER_SCENE_DISTANCE_REFERENCE_KM = 1_000_000; // 1 Mkm reference for log scaling.
export const VIEWER_SCENE_DISTANCE_UNIT = 4;

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

  const { x, y, z } = body.spatial.positionKm;
  const magnitudeKm = Math.hypot(x, y, z);
  if (magnitudeKm <= 0) {
    return [0, 0, 0];
  }

  const ratio =
    Math.log(Math.max(VIEWER_SCENE_DISTANCE_REFERENCE_KM, magnitudeKm) / VIEWER_SCENE_DISTANCE_REFERENCE_KM) /
    Math.log(VIEWER_SCENE_DISTANCE_LOG_BASE);
  const scaled = (1 + ratio) * VIEWER_SCENE_DISTANCE_UNIT;

  const dx = x / magnitudeKm;
  const dy = y / magnitudeKm;
  const dz = z / magnitudeKm;

  return [+(dx * scaled).toFixed(3), +(dy * scaled).toFixed(3), +(dz * scaled).toFixed(3)];
}
