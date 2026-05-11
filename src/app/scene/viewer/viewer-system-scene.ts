import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, ElementRef, EventEmitter, input, Output, signal, viewChild } from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Euler, Quaternion, Vector3 } from 'three';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import {
  VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_X,
  VIEWER_SCENE_ANCHORED_ORBIT_MIN_RADIUS_Z,
  VIEWER_SCENE_ANCHORED_ORBIT_SCALE,
  VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_X,
  VIEWER_SCENE_PRIMARY_ORBIT_MIN_RADIUS_Z,
  resolveAnchoredOrbitSceneProfile,
  isStarBody,
  isMarketStationBody,
  resolveBodyColor,
  resolveBodySceneRadius,
  resolveBodyScenePosition,
  resolveBodyOrbitalPositionRelativeToAnchor,
  resolveOrbitColor,
  resolveSceneDistanceFromKm,
} from './viewer-formatters';

export interface ViewerSystemSceneInputs {
  bodies: ViewerBody[];
  summary: SolarSystemSummary | null;
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
  elapsedSec: number;
  durationSec: number;
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
}

interface OrbitControlsLike {
  target: Vector3;
  update: () => void;
}

const VIEWER_DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3.5, 28];
const VIEWER_CAMERA_TWEEN_DURATION_SEC = 0.45;

function degToRad(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return (value * Math.PI) / 180;
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
 */
export function mapBodiesToRendered(bodies: ViewerBody[]): RenderedBody[] {
  const positionCache = new Map<string, [number, number, number]>();

  // First pass: calculate positions for stars and non-anchored bodies
  const firstPass = bodies.map((body) => {
    const position = resolveBodyScenePosition(body);
    positionCache.set(body.id, position);
    return position;
  });

  // Second pass: recalculate anchored bodies using parent positions
  return bodies.map((body, idx) => {
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

    return {
      source: body,
      id: body.id,
      bodyType: body.bodyType,
      displayName: body.displayName || body.id,
      color: resolveBodyColor(body),
      radius: resolveBodySceneRadius(body),
      position,
      isStar: isStarBody(body),
        isMarketStation: isMarketStationBody(body),
    };
  });
}

@Component({
  selector: 'app-viewer-system-scene',
  templateUrl: './viewer-system-scene.html',
  imports: [NgtArgs, NgtsOrbitControls],
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
  private orbitControlsRef = viewChild<ElementRef<OrbitControlsLike>>('orbitControls');

  private cameraTween: CameraTween | null = null;
  private planetViewRequestTimer: ReturnType<typeof setTimeout> | null = null;

  bodies = input<ViewerBody[]>([]);
  summary = input<SolarSystemSummary | null>(null);
  @Output() hoveredBodyChange = new EventEmitter<ViewerBody | null>();
  @Output() focusedPlanetChange = new EventEmitter<ViewerBody | null>();
  @Output() planetViewRequest = new EventEmitter<ViewerBody>();

  protected readonly rendered = computed<RenderedBody[]>(() => mapBodiesToRendered(this.bodies()));

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
  protected hoveredBodyId = signal<string | null>(null);

  constructor() {
    beforeRender(({ delta }) => {
      if (!this.cameraTween) {
        return;
      }

      const camera = this.store.camera();
      if (!camera) {
        this.cameraTween = null;
        return;
      }

      const controls = this.orbitControlsRef()?.nativeElement;
      this.cameraTween.elapsedSec += delta;
      const t = Math.min(1, this.cameraTween.elapsedSec / this.cameraTween.durationSec);
      const eased = t * t * (3 - 2 * t);

      camera.position.lerpVectors(this.cameraTween.fromPosition, this.cameraTween.toPosition, eased);

      if (controls?.target) {
        controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        controls.update();
      } else {
        const lookAtTarget = new Vector3().lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
        camera.lookAt(lookAtTarget);
      }

      if (t >= 1) {
        this.cameraTween = null;
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

  private clearPlanetFocus(): void {
    this.focusedPlanetId.set(null);
    this.focusedPlanetChange.emit(null);
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
  ): void {
    const camera = this.store.camera();
    if (!camera) {
      return;
    }

    const controls = this.orbitControlsRef()?.nativeElement;
    const fromPosition = camera.position.clone();
    const fromTarget = controls?.target?.clone() ?? new Vector3(0, 0, 0);
    const toTarget = new Vector3(target[0], target[1], target[2]);

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

    this.cameraTween = {
      elapsedSec: 0,
      durationSec: VIEWER_CAMERA_TWEEN_DURATION_SEC,
      fromPosition,
      toPosition,
      fromTarget,
      toTarget,
    };
  }

  ngOnDestroy(): void {
    if (this.planetViewRequestTimer) {
      clearTimeout(this.planetViewRequestTimer);
      this.planetViewRequestTimer = null;
    }
  }
}
