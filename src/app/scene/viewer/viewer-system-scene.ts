import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  EventEmitter,
  input,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Euler, Quaternion, Vector3 } from 'three';
import { isValidShipSpatial } from '../../model/math/spatial';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { coerceShipModel, type ShipSummary } from '../../model/ship-list';
import {
  VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X,
  VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z,
  VIEWER_SCENE_ACTIVE_SHIP_COLOR,
  VIEWER_SCENE_INACTIVE_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_POSITION,
  resolveAnchoredOrbitSceneProfile,
  isGateBody,
  isStarBody,
  isMarketStationBody,
  resolveBodyColor,
  resolveBodySceneRadius,
  resolveBodyScenePosition,
  resolveBodyOrbitalPositionRelativeToAnchor,
  resolveOrbitColor,
  resolveSceneDistanceFromKm,
} from './viewer-formatters';
import { ViewerShipMesh } from './viewer-ship-mesh';
import { resolveDescriptorRenderProfile } from './viewer-descriptor-selectors';

export interface ViewerSystemSceneInputs {
  bodies: ViewerBody[];
  summary: SolarSystemSummary | null;
  targetBodyId?: string | null;
  ships?: ShipSummary[];
  activeShipId?: string | null;
}

interface RenderedBody {
  source: ViewerBody;
  id: string;
  bodyType: string;
  displayName: string;
  color: string;
  radius: number;
  position: [number, number, number];
  isStar: boolean;
  isMarketStation: boolean;
  isGate: boolean;
  geometrySegments: number;
  materialColor: string;
  materialEmissive: string;
  materialEmissiveIntensity: number;
  materialRoughness: number;
  materialMetalness: number;
}

interface RenderedShip {
  id: string;
  model: string;
  displayName: string;
  color: string;
  position: [number, number, number];
  isActive: boolean;
  isUnknownSpatial: boolean;
}

interface OrbitEllipse {
  id: string;
  center: [number, number, number];
  radiusX: number;
  radiusZ: number;
  rotation: [number, number, number];
  opacity: number;
  color: string;
  isMarketStation: boolean;
}

interface CameraTween {
  kind: 'default' | 'target-fly';
  elapsedSec: number;
  durationSec: number;
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
}

interface OrbitControlsLike {
  enabled?: boolean;
  minDistance?: number;
  maxDistance?: number;
  target: Vector3;
  update: () => void;
}

export interface ViewerSceneCameraDistanceRange {
  min: number;
  max: number;
}

const VIEWER_DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3.5, 28];
const VIEWER_CAMERA_TWEEN_DURATION_SEC = 0.45;
const VIEWER_TARGET_FLY_DURATION_SEC = 3.5;
const VIEWER_TARGET_FLY_COMPLETION_T = 0.985;
const VIEWER_CAMERA_DISTANCE_MIN_FLOOR = 0.5;
const VIEWER_CAMERA_DISTANCE_MAX_FLOOR = 42;
const VIEWER_CAMERA_DISTANCE_MAX_CEILING = 180;
const VIEWER_CAMERA_DISTANCE_MIN_MAX_GAP = 12;
const VIEWER_LOCAL_ASTEROID_VIEW_ZOOM_THRESHOLD = 22;
const VIEWER_LOCAL_ASTEROID_VIEW_RANGE_KM = 30_000;
const VIEWER_LOCAL_ASTEROID_VIEW_SCALE = 0.00006;

function degToRad(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isAsteroidBody(body: ViewerBody): boolean {
  return body.bodyType?.trim().toLowerCase() === 'asteroid';
}

function resolveLocalAsteroidProjectionWeight(zoomLevel: number | undefined): number {
  if (typeof zoomLevel !== 'number' || !Number.isFinite(zoomLevel)) {
    return 0;
  }

  if (zoomLevel >= VIEWER_LOCAL_ASTEROID_VIEW_ZOOM_THRESHOLD) {
    return 0;
  }

  return clamp(1 - zoomLevel / VIEWER_LOCAL_ASTEROID_VIEW_ZOOM_THRESHOLD, 0, 1);
}

function resolveScenePositionFromSpatialKm(positionKm: { x: number; y: number; z: number }): [number, number, number] {
  const magnitudeKm = Math.hypot(positionKm.x, positionKm.y, positionKm.z);
  if (magnitudeKm <= 0) {
    return [0, 0, 0];
  }

  const scaled = resolveSceneDistanceFromKm(magnitudeKm);
  return [
    +((positionKm.x / magnitudeKm) * scaled).toFixed(3),
    +((positionKm.y / magnitudeKm) * scaled).toFixed(3),
    +((positionKm.z / magnitudeKm) * scaled).toFixed(3),
  ];
}

function resolveRenderedExtent(rendered: RenderedBody[]): number {
  let maxExtent = 0;
  for (const body of rendered) {
    const bodyDistance = Math.hypot(body.position[0], body.position[1], body.position[2]);
    maxExtent = Math.max(maxExtent, bodyDistance + body.radius);
  }

  return Math.max(maxExtent, 24);
}

function resolveDefaultMaterialColor(body: ViewerBody, isGate: boolean, isMarketStation: boolean): string {
  if (body.bodyType === 'planet') {
    return '#ffffff';
  }
  if (isGate) {
    return '#7dd3fc';
  }
  if (isMarketStation) {
    return '#22c55e';
  }
  return resolveBodyColor(body);
}

function resolveDefaultMaterialEmissive(body: ViewerBody, isGate: boolean, isMarketStation: boolean): string {
  if (body.bodyType === 'planet') {
    return '#aab8d0';
  }
  if (isGate) {
    return '#0c4a6e';
  }
  if (isMarketStation) {
    return '#14532d';
  }
  return '#000000';
}

function resolveDefaultMaterialEmissiveIntensity(body: ViewerBody, isGate: boolean, isMarketStation: boolean): number {
  if (body.bodyType === 'planet') {
    return 0.2;
  }
  if (isGate) {
    return 0.22;
  }
  if (isMarketStation) {
    return 0.2;
  }
  return 0;
}

export function resolveViewerSceneCameraDistanceRange(bodies: ViewerBody[]): ViewerSceneCameraDistanceRange {
  const extent = resolveRenderedExtent(mapBodiesToRendered(bodies));
  // Min is always the planet-detail floor — allow zooming right up to bodies.
  const minDistance = VIEWER_CAMERA_DISTANCE_MIN_FLOOR;

  let maxDistance = clamp(extent * 2.25 + 18, VIEWER_CAMERA_DISTANCE_MAX_FLOOR, VIEWER_CAMERA_DISTANCE_MAX_CEILING);
  if (maxDistance < minDistance + VIEWER_CAMERA_DISTANCE_MIN_MAX_GAP) {
    maxDistance = minDistance + VIEWER_CAMERA_DISTANCE_MIN_MAX_GAP;
  }

  return {
    min: +minDistance.toFixed(3),
    max: +maxDistance.toFixed(3),
  };
}

function resolveZoomDistance(zoomLevel: number, bodies: ViewerBody[]): number {
  const { min, max } = resolveViewerSceneCameraDistanceRange(bodies);
  const normalized = clamp(zoomLevel, 0, 100) / 100;
  // Logarithmic mapping: evenly distributes zoom across planet-detail to full-system scale.
  return min * Math.pow(max / min, normalized);
}

function resolveZoomPercent(distance: number, bodies: ViewerBody[]): number {
  const { min, max } = resolveViewerSceneCameraDistanceRange(bodies);
  if (max <= min || min <= 0) {
    return 0;
  }

  // Inverse log: normalized = log(distance/min) / log(max/min)
  const ratio = Math.log(clamp(distance, min, max) / min) / Math.log(max / min);
  return clamp(ratio * 100, 0, 100);
}

/**
 * Resolves orbit ring orientation using explicit transform composition:
 * base (XY->XZ) then node, inclination, periapsis within the scene frame.
 */
function resolveOrbitRotationEuler(orbital: ViewerBody['orbitalElements']): [number, number, number] {
  const ascendingNode = degToRad(orbital?.longitudeOfAscendingNodeDeg);
  const inclination = degToRad(orbital?.inclinationDeg);
  const argumentOfPeriapsis = degToRad(orbital?.argumentOfPeriapsisDeg);

  const yAxis = new Vector3(0, 1, 0);
  const xAxis = new Vector3(1, 0, 0);

  const qBase = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0, 'XYZ'));
  const qNode = new Quaternion().setFromAxisAngle(yAxis, ascendingNode);
  const qInclination = new Quaternion().setFromAxisAngle(xAxis, inclination);
  const qPeriapsis = new Quaternion().setFromAxisAngle(yAxis, argumentOfPeriapsis);

  // Apply base plane first (XY -> XZ), then orbital orientation.
  // This ensures node/periapsis rotate within the reference plane and
  // inclination is the term that controls out-of-plane tilt.
  const orbitQ = qNode.clone().multiply(qInclination).multiply(qPeriapsis).multiply(qBase);
  const orbitEuler = new Euler().setFromQuaternion(orbitQ, 'XYZ');
  return [orbitEuler.x, orbitEuler.y, orbitEuler.z];
}

/**
 * Pure mapping from raw {@link ViewerBody} entries to the lightweight `RenderedBody`
 * shape used by the scene template. Exposed for unit tests so the scene component
 * itself (which depends on `NgtStore` at change detection) does not need to mount.
 *
 * Handles hierarchical positioning: first pass calculates star/primary positions,
 * second pass uses parent positions for anchored bodies (moons around planets, etc).
 * @param zoomLevel Optional zoom level (0-100) for dynamic radius scaling
 */
export function mapBodiesToRendered(
  bodies: ViewerBody[],
  zoomLevel?: number,
  targetBodyId?: string | null,
  ships: ShipSummary[] = [],
): RenderedBody[] {
  const positionCache = new Map<string, [number, number, number]>();

  // First pass: calculate positions for stars and non-anchored bodies
  const firstPass = bodies.map((body) => {
    const position = resolveBodyScenePosition(body);
    positionCache.set(body.id, position);
    return position;
  });

  // Second pass: recalculate anchored bodies using parent positions
  const rendered = bodies.map((body, idx) => {
    let position = firstPass[idx];

    // If body has an anchor, recalculate position relative to anchor
    const anchorId = body.orbitalElements?.anchorBodyId;
    if (anchorId) {
      if (positionCache.has(anchorId)) {
        const anchorPos = positionCache.get(anchorId)!;
        const orbitalPos = resolveBodyOrbitalPositionRelativeToAnchor(body, anchorPos);
        if (orbitalPos) {
          position = orbitalPos;
          positionCache.set(body.id, position);
        }
      }
    }

    const isGate = isGateBody(body);
    const isMarketStation = isMarketStationBody(body);
    const descriptorProfile = resolveDescriptorRenderProfile(body.externalObjectDescriptor);
    const defaultMaterialColor = resolveDefaultMaterialColor(body, isGate, isMarketStation);

    return {
      source: body,
      id: body.id,
      bodyType: body.bodyType,
      displayName: body.displayName || body.id,
      color: descriptorProfile?.color ?? resolveBodyColor(body),
      radius: +(resolveBodySceneRadius(body, zoomLevel) * (descriptorProfile?.radiusScale ?? 1)).toFixed(4),
      position,
      isStar: isStarBody(body),
      isMarketStation,
      isGate,
      geometrySegments: descriptorProfile?.geometrySegments ?? 32,
      materialColor: descriptorProfile?.color ?? defaultMaterialColor,
      materialEmissive: descriptorProfile?.emissive ?? resolveDefaultMaterialEmissive(body, isGate, isMarketStation),
      materialEmissiveIntensity:
        descriptorProfile?.emissiveIntensity ?? resolveDefaultMaterialEmissiveIntensity(body, isGate, isMarketStation),
      materialRoughness: descriptorProfile?.roughness ?? 0.8,
      materialMetalness: descriptorProfile?.metalness ?? 0.05,
    };
  });

  const localProjectionWeight = resolveLocalAsteroidProjectionWeight(zoomLevel);
  if (!targetBodyId || localProjectionWeight <= 0) {
    return rendered;
  }

  const targetBody = bodies.find((body) => body.id === targetBodyId);
  const targetRendered = rendered.find((body) => body.id === targetBodyId);
  const targetShip = ships.find((ship) => ship.id === targetBodyId && isValidShipSpatial(ship.spatial));

  let targetPositionKm: { x: number; y: number; z: number } | null = null;
  let targetPositionScene: [number, number, number] | null = null;

  if (targetBody && targetRendered && isAsteroidBody(targetBody)) {
    targetPositionKm = targetBody.spatial.positionKm;
    targetPositionScene = targetRendered.position;
  } else if (targetShip && isValidShipSpatial(targetShip.spatial)) {
    targetPositionKm = targetShip.spatial.positionKm;
    targetPositionScene = resolveScenePositionFromSpatialKm(targetShip.spatial.positionKm);
  }

  if (!targetPositionKm || !targetPositionScene) {
    return rendered;
  }

  return rendered.map((candidate) => {
    if ((targetBody && candidate.id === targetBodyId) || !isAsteroidBody(candidate.source)) {
      return candidate;
    }

    const candidatePosKm = candidate.source.spatial.positionKm;
    const dxKm = candidatePosKm.x - targetPositionKm.x;
    const dyKm = candidatePosKm.y - targetPositionKm.y;
    const dzKm = candidatePosKm.z - targetPositionKm.z;
    const localDistanceKm = Math.hypot(dxKm, dyKm, dzKm);
    if (!Number.isFinite(localDistanceKm) || localDistanceKm <= 0 || localDistanceKm > VIEWER_LOCAL_ASTEROID_VIEW_RANGE_KM) {
      return candidate;
    }

    const localScale = VIEWER_LOCAL_ASTEROID_VIEW_SCALE * localProjectionWeight;
    const localPosition: [number, number, number] = [
      +(targetPositionScene[0] + dxKm * localScale).toFixed(3),
      +(targetPositionScene[1] + dyKm * localScale).toFixed(3),
      +(targetPositionScene[2] + dzKm * localScale).toFixed(3),
    ];

    return {
      ...candidate,
      position: localPosition,
    };
  });
}

/**
 * Pure helper that maps ship summaries to viewer-ready render descriptors.
 *
 * - Ships with invalid spatial (null / malformed / sun-origin) are routed to a
 *   synthetic offset and flagged via `isUnknownSpatial: true` with a distinct
 *   color so they remain visible while lazy repair runs upstream.
 * - Otherwise the position is projected from km to scene units along the unit
 *   vector of the spatial position using the same log-distance scaling as the
 *   bodies (see `resolveSceneDistanceFromKm`).
 */
export function mapShipsToRendered(ships: ShipSummary[], activeShipId: string | null): RenderedShip[] {
  return ships.map((ship): RenderedShip => {
    const isActive = activeShipId !== null && ship.id === activeShipId;
    const model = coerceShipModel(ship.model);
    if (!isValidShipSpatial(ship.spatial)) {
      return {
        id: ship.id,
        model,
        displayName: ship.name?.trim() || ship.id,
        color: VIEWER_SCENE_UNKNOWN_SHIP_COLOR,
        position: [...VIEWER_SCENE_UNKNOWN_SHIP_POSITION] as [number, number, number],
        isActive,
        isUnknownSpatial: true,
      };
    }
    const pos = ship.spatial.positionKm;
    const magnitudeKm = Math.hypot(pos.x, pos.y, pos.z);
    const scaled = resolveSceneDistanceFromKm(magnitudeKm);
    const scenePos: [number, number, number] = [
      +((pos.x / magnitudeKm) * scaled).toFixed(3),
      +((pos.y / magnitudeKm) * scaled).toFixed(3),
      +((pos.z / magnitudeKm) * scaled).toFixed(3),
    ];
    return {
      id: ship.id,
      model,
      displayName: ship.name?.trim() || ship.id,
      color: isActive ? VIEWER_SCENE_ACTIVE_SHIP_COLOR : VIEWER_SCENE_INACTIVE_SHIP_COLOR,
      position: scenePos,
      isActive,
      isUnknownSpatial: false,
    };
  });
}

/**
 * Resolve a target id to a scene-space position.
 *
 * Target ids primarily refer to celestial bodies, but the details panel can
 * also emit ship ids. This helper enables camera fly-to for both paths.
 */
export function resolveTargetScenePosition(
  targetId: string,
  renderedBodies: ReadonlyArray<{ id: string; position: [number, number, number] }>,
  renderedShips: ReadonlyArray<{ id: string; position: [number, number, number] }>,
): [number, number, number] | null {
  const targetBody = renderedBodies.find((body) => body.id === targetId);
  if (targetBody) {
    return targetBody.position;
  }

  const targetShip = renderedShips.find((ship) => ship.id === targetId);
  if (targetShip) {
    return targetShip.position;
  }

  return null;
}

@Component({
  selector: 'app-viewer-system-scene',
  templateUrl: './viewer-system-scene.html',
  imports: [NgtArgs, NgtsOrbitControls, ViewerShipMesh],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Inner Angular Three scene that renders a solar system: stars rendered with
 * `MeshBasicMaterial` (self-lit) using their color/luminosity, and other bodies
 * rendered with `MeshStandardMaterial` lit by a point light at the system origin.
 *
 * Coordinates use the hybrid log-distance scaling defined in
 * [viewer-formatters.ts](./viewer-formatters.ts).
 */
export class ViewerSystemScene {
  private store = injectStore();
  private orbitControlsRef = viewChild(NgtsOrbitControls);

  private cameraTween: CameraTween | null = null;
  private planetViewRequestTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProcessedTargetBodyId: string | null = null;
  private persistentLookTarget = new Vector3(0, 0, 0);
  private settledCameraPosition: Vector3 | null = null;

  bodies = input<ViewerBody[]>([]);
  summary = input<SolarSystemSummary | null>(null);
  targetBodyId = input<string | null>(null);
  zoomLevel = input<number>(18);
  ships = input<ShipSummary[]>([]);
  activeShipId = input<string | null>(null);
  @Output() hoveredBodyChange = new EventEmitter<ViewerBody | null>();
  @Output() focusedPlanetChange = new EventEmitter<ViewerBody | null>();
  @Output() planetViewRequest = new EventEmitter<ViewerBody>();
  @Output() zoomLevelChange = new EventEmitter<number>();

  protected readonly rendered = computed<RenderedBody[]>(() =>
    mapBodiesToRendered(this.bodies(), this.zoomLevel(), this.targetBodyId(), this.ships()),
  );

  protected readonly renderedShips = computed<RenderedShip[]>(() => mapShipsToRendered(this.ships(), this.activeShipId()));

  protected readonly focusedPlanetId = signal<string | null>(null);

  protected readonly focusedBodyIds = computed<Set<string> | null>(() => {
    const focusedPlanetId = this.focusedPlanetId();
    if (!focusedPlanetId) {
      return null;
    }

    const ids = new Set<string>([focusedPlanetId]);
    for (const body of this.rendered()) {
      if (body.source.orbitalElements?.anchorBodyId === focusedPlanetId) {
        ids.add(body.id);
      }
    }
    return ids;
  });

  protected readonly stars = computed(() => (this.focusedPlanetId() ? [] : this.rendered().filter((b: RenderedBody) => b.isStar)));
  protected readonly nonStars = computed(() => {
    const focusIds = this.focusedBodyIds();
    const allNonStars = this.rendered().filter((b: RenderedBody) => !b.isStar);
    if (!focusIds) {
      return allNonStars;
    }
    return allNonStars.filter((body) => focusIds.has(body.id));
  });
  protected readonly orbitEllipses = computed<OrbitEllipse[]>(() => {
    const byId = new Map<string, RenderedBody>(this.rendered().map((body) => [body.id, body]));
    const hoveredId = this.hoveredBodyId();
    const focusedPlanetId = this.focusedPlanetId();
    const focusIds = this.focusedBodyIds();
    const hoveredBody = hoveredId ? byId.get(hoveredId) : undefined;
    const hoveredIsPlanet = hoveredBody?.bodyType === 'planet';

    // Build the set of highlighted orbit IDs (hovered body + its parent + its children)
    const highlightedIds = new Set<string>();
    if (hoveredId) {
      highlightedIds.add(hoveredId);
      const hoveredParentId = hoveredBody?.source.orbitalElements?.anchorBodyId;
      if (hoveredParentId && byId.has(hoveredParentId)) {
        highlightedIds.add(hoveredParentId);
      }
      for (const candidate of this.nonStars()) {
        if (candidate.source.orbitalElements?.anchorBodyId === hoveredId) {
          highlightedIds.add(candidate.id);
        }
      }
    }

    // All orbits always visible; highlighted ones get boosted opacity
    return this.nonStars()
      .map((body): OrbitEllipse | null => {
        if (focusIds && !focusIds.has(body.id)) {
          return null;
        }

        // Moon orbits are only shown when hovering a planet.
        if (body.bodyType === 'moon' && !hoveredIsPlanet && !focusedPlanetId) {
          return null;
        }

        const orbital = body.source.orbitalElements;
        const semiMajorAxisKm = orbital?.semiMajorAxisKm;
        if (typeof semiMajorAxisKm !== 'number' || !Number.isFinite(semiMajorAxisKm) || semiMajorAxisKm <= 0) {
          return null;
        }

        const eRaw = orbital?.eccentricity;
        const eccentricity = typeof eRaw === 'number' && Number.isFinite(eRaw) ? Math.min(Math.max(eRaw, 0), 0.98) : 0;
        const anchorId = orbital?.anchorBodyId;
        const isAnchoredOrbit = typeof anchorId === 'string' && anchorId.length > 0;
        const orbitProfile = isAnchoredOrbit ? resolveAnchoredOrbitSceneProfile(body.source) : null;
        const scaledRadius = isAnchoredOrbit
          ? resolveSceneDistanceFromKm(semiMajorAxisKm) * orbitProfile!.scale
          : resolveSceneDistanceFromKm(semiMajorAxisKm);
        const radiusX = Math.max(
          isAnchoredOrbit ? orbitProfile!.minRadiusX : VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X,
          +scaledRadius.toFixed(3),
        );
        const radiusZ = Math.max(
          isAnchoredOrbit ? orbitProfile!.minRadiusZ : VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z,
          +(radiusX * Math.sqrt(1 - eccentricity * eccentricity)).toFixed(3),
        );

        const anchorPosition = anchorId && byId.has(anchorId) ? byId.get(anchorId)!.position : [0, 0, 0];

        let opacity: number;
        if (focusedPlanetId) {
          opacity = body.id === focusedPlanetId ? 0.9 : 0.35;
        } else if (!hoveredId) {
          opacity = 0.18; // default always-on low opacity
        } else if (hoveredId === body.id) {
          opacity = 0.9;  // hovered body's own orbit
        } else if (highlightedIds.has(body.id)) {
          opacity = 0.35; // related orbits (parent/children)
        } else {
          opacity = 0.08; // unrelated orbits dimmed but still visible
        }

        const orbitOpacity = body.isMarketStation ? Math.max(opacity, hoveredId === body.id ? 1 : 0.72) : opacity;

        return {
          id: body.id,
          center: [anchorPosition[0], anchorPosition[1], anchorPosition[2]],
          radiusX,
          radiusZ,
          rotation: resolveOrbitRotationEuler(orbital),
          opacity: orbitOpacity,
            color: resolveOrbitColor(body.source),
          isMarketStation: body.isMarketStation,
        };
      })
      .filter((orbit): orbit is OrbitEllipse => orbit !== null);
  });

  // Hovered body tracking
  protected readonly targetedBodyId = signal<string | null>(null);
  protected readonly activeTargetFlightId = signal<string | null>(null);
  protected hoveredBodyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.targetBodyId();

      // Only react to actual target-id transitions.
      if (id === this.lastProcessedTargetBodyId) {
        return;
      }
      this.lastProcessedTargetBodyId = id;

      if (id) {
        this.targetedBodyId.set(id);
        this.flyToTargetBody(id);
      } else {
        this.activeTargetFlightId.set(null);
        this.targetedBodyId.set(null);
        // Clearing list-target state should not recenter the camera.
        // Keep current camera pose and only stop any active target flight.
        this.cameraTween = null;
        this.settledCameraPosition = null;
        this.setOrbitControlsEnabled(true);
      }
    });

    beforeRender(({ delta }) => {
      const camera = this.store.camera();
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;

      this.syncOrbitControlsTarget();

      if (camera && controls && !this.cameraTween) {
        const targetDistance = resolveZoomDistance(this.zoomLevel(), this.rendered().map((body) => body.source));
        controls.minDistance = targetDistance;
        controls.maxDistance = targetDistance;
        controls.update();
      }

      if (camera && !this.cameraTween && this.targetedBodyId() && this.settledCameraPosition) {
        // Preserve target composition only during brief handoffs where controls
        // are unavailable; otherwise orbit interactions must remain user-driven.
        if (!controls?.target) {
          const drift = camera.position.distanceTo(this.settledCameraPosition);
          if (drift > 0.001) {
            camera.position.copy(this.settledCameraPosition);
          }
          camera.lookAt(this.persistentLookTarget);
        }
      }

      if (!this.cameraTween) {
        return;
      }

      if (!camera) {
        this.cameraTween = null;
        return;
      }

      this.cameraTween.elapsedSec += delta;
      const t = Math.min(1, this.cameraTween.elapsedSec / this.cameraTween.durationSec);
      const eased = t * t * (3 - 2 * t);

      camera.position.lerpVectors(this.cameraTween.fromPosition, this.cameraTween.toPosition, eased);

      if (controls?.target) {
        controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        controls.update();
        this.persistentLookTarget.copy(controls.target);
      } else {
        const lookAtTarget = new Vector3().lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        camera.lookAt(lookAtTarget);
        this.persistentLookTarget.copy(lookAtTarget);
      }

      // For cinematic target flights, finish slightly before the exact endpoint
      // to avoid a visible final-frame perspective snap.
      if (this.cameraTween.kind === 'target-fly' && t >= VIEWER_TARGET_FLY_COMPLETION_T) {
        this.finalizeCameraTween();
        return;
      }

      if (t >= 1) {
        this.finalizeCameraTween();
      }
    });
  }

  onBodyPointerOver(body: ViewerBody) {
    this.hoveredBodyId.set(body.id);
    this.hoveredBodyChange.emit(body);
  }

  onBodyPointerDown(
    event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number; preventDefault?: () => void }; stopPropagation?: () => void },
    body: ViewerBody,
  ) {
    if (!this.isRightButton(event) || body.bodyType !== 'planet') {
      return;
    }

    event.stopPropagation?.();
    event.nativeEvent?.preventDefault?.();
    this.focusPlanet(body.id);

    if (this.planetViewRequestTimer) {
      clearTimeout(this.planetViewRequestTimer);
    }
    this.planetViewRequestTimer = setTimeout(() => {
      this.planetViewRequest.emit(body);
      this.planetViewRequestTimer = null;
    }, Math.round(VIEWER_CAMERA_TWEEN_DURATION_SEC * 1000));
  }

  onScenePointerDown(
    event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number; preventDefault?: () => void } },
  ) {
    if (this.isRightButton(event) && this.activeTargetFlightId()) {
      event.nativeEvent?.preventDefault?.();
      this.activeTargetFlightId.set(null);
      this.cameraTween = null;
      this.settledCameraPosition = null;
      this.setOrbitControlsEnabled(true);
      return;
    }

    if (!this.isRightButton(event) || !this.focusedPlanetId()) {
      return;
    }

    event.nativeEvent?.preventDefault?.();
    this.clearPlanetFocus();
  }

  onBodyPointerOut(id: string) {
    if (this.hoveredBodyId() === id) {
      this.hoveredBodyId.set(null);
      this.hoveredBodyChange.emit(null);
    }
  }

  private isRightButton(event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number } }): boolean {
    const button = event.button ?? event.nativeEvent?.button;
    const buttons = event.buttons ?? event.nativeEvent?.buttons;
    return button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
  }

  private focusPlanet(planetId: string): void {
    this.focusedPlanetId.set(planetId);

    const focused = this.rendered().find((body) => body.id === planetId);
    if (!focused) {
      this.focusedPlanetChange.emit(null);
      return;
    }

    this.focusedPlanetChange.emit(focused.source);

    const focusDistance = this.resolveFocusDistance(planetId);
    this.beginCameraTween(focused.position, focusDistance);
  }

  private flyToTargetBody(targetBodyId: string): void {
    const targetPosition = resolveTargetScenePosition(targetBodyId, this.rendered(), this.renderedShips());
    if (!targetPosition) {
      this.activeTargetFlightId.set(null);
      return;
    }

    const targetBody = this.rendered().find((body) => body.id === targetBodyId);
    const flyDistance = targetBody ? Math.max(3.5, Math.min(14, targetBody.radius * 16)) : 5;

    this.activeTargetFlightId.set(targetBodyId);
    this.beginCameraTween(targetPosition, flyDistance, undefined, VIEWER_TARGET_FLY_DURATION_SEC, 'target-fly');
  }

  private clearPlanetFocus(): void {
    this.focusedPlanetId.set(null);
    this.focusedPlanetChange.emit(null);
    this.settledCameraPosition = null;
    this.beginCameraTween([0, 0, 0], undefined, VIEWER_DEFAULT_CAMERA_POSITION);
  }

  private resolveFocusDistance(planetId: string): number {
    const planet = this.rendered().find((body) => body.id === planetId);
    if (!planet) {
      return 4;
    }

    let maxMoonDistance = 0;
    for (const body of this.rendered()) {
      if (body.source.orbitalElements?.anchorBodyId !== planetId) {
        continue;
      }
      const dx = body.position[0] - planet.position[0];
      const dy = body.position[1] - planet.position[1];
      const dz = body.position[2] - planet.position[2];
      maxMoonDistance = Math.max(maxMoonDistance, Math.hypot(dx, dy, dz));
    }

    if (maxMoonDistance > 0) {
      return Math.min(14, Math.max(3.2, maxMoonDistance * 3.4));
    }

    return Math.max(3.2, Math.min(8, planet.radius * 14));
  }

  private beginCameraTween(
    target: [number, number, number],
    distance: number | undefined,
    explicitPosition?: [number, number, number],
    durationSec: number = VIEWER_CAMERA_TWEEN_DURATION_SEC,
    kind: CameraTween['kind'] = 'default',
  ): void {
    const camera = this.store.camera();
    if (!camera) {
      return;
    }

    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    const fromPosition = camera.position.clone();
    const fromTarget = controls?.target?.clone() ?? this.persistentLookTarget.clone();
    const toTarget = new Vector3(target[0], target[1], target[2]);
    this.persistentLookTarget.copy(fromTarget);

    let toPosition: Vector3;
    if (explicitPosition) {
      toPosition = new Vector3(explicitPosition[0], explicitPosition[1], explicitPosition[2]);
    } else {
      const direction = fromPosition.clone().sub(fromTarget);
      if (direction.lengthSq() < 1e-6) {
        direction.set(0, 0.2, 1);
      }
      direction.normalize();
      toPosition = toTarget.clone().add(direction.multiplyScalar(distance ?? 6));
    }

    if (kind === 'target-fly') {
      this.setOrbitControlsEnabled(false);
    }

    this.cameraTween = {
      kind,
      elapsedSec: 0,
      durationSec,
      fromPosition,
      toPosition,
      fromTarget,
      toTarget,
    };
  }

  private finalizeCameraTween(): void {
    const tween = this.cameraTween;
    if (tween?.kind === 'target-fly') {
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
      this.persistentLookTarget.copy(tween.toTarget);
      if (controls?.target) {
        // Ensure controls resume from the same target the flight finished on.
        controls.target.copy(tween.toTarget);
        controls.update();
      }
      this.setOrbitControlsEnabled(true);
    }

    const camera = this.store.camera();
    if (camera) {
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
      const distance = controls?.target ? camera.position.distanceTo(controls.target) : camera.position.length();
      this.zoomLevelChange.emit(resolveZoomPercent(distance, this.rendered().map((body) => body.source)));
    }

    if (camera && tween?.kind === 'target-fly') {
      this.settledCameraPosition = camera.position.clone();
    } else if (tween?.kind !== 'target-fly') {
      this.settledCameraPosition = null;
    }

    this.activeTargetFlightId.set(null);
    this.cameraTween = null;
  }

  private setOrbitControlsEnabled(enabled: boolean): void {
    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    if (!controls) {
      return;
    }
    controls.enabled = enabled;
  }

  private syncOrbitControlsTarget(): void {
    const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
    if (!controls?.target) {
      return;
    }

    if (controls.target.distanceToSquared(this.persistentLookTarget) <= 1e-6) {
      return;
    }

    controls.target.copy(this.persistentLookTarget);
    controls.update();
  }

  ngOnDestroy(): void {
    if (this.planetViewRequestTimer) {
      clearTimeout(this.planetViewRequestTimer);
      this.planetViewRequestTimer = null;
    }
  }
}
