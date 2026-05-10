import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, input, Output, signal } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Euler, Quaternion, Vector3 } from 'three';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import {
  isStarBody,
  resolveBodyColor,
  resolveBodySceneRadius,
  resolveBodyScenePosition,
  resolveBodyOrbitalPositionRelativeToAnchor,
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
}

interface OrbitEllipse {
  id: string;
  center: [number, number, number];
  radiusX: number;
  radiusZ: number;
  rotation: [number, number, number];
  opacity: number;
}

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
    if (anchorId && positionCache.has(anchorId)) {
      const anchorPos = positionCache.get(anchorId)!;
      // Recalculate with anchor position
      const orbitalPos = resolveBodyOrbitalPositionRelativeToAnchor(body, anchorPos);
      if (orbitalPos) {
        position = orbitalPos;
        positionCache.set(body.id, position);
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
  bodies = input<ViewerBody[]>([]);
  summary = input<SolarSystemSummary | null>(null);
  @Output() hoveredBodyChange = new EventEmitter<ViewerBody | null>();

  protected readonly rendered = computed<RenderedBody[]>(() => mapBodiesToRendered(this.bodies()));

  protected readonly stars = computed(() => this.rendered().filter((b: RenderedBody) => b.isStar));
  protected readonly nonStars = computed(() => this.rendered().filter((b: RenderedBody) => !b.isStar));
  protected readonly orbitEllipses = computed<OrbitEllipse[]>(() => {
    const byId = new Map<string, RenderedBody>(this.rendered().map((body) => [body.id, body]));
    const hoveredId = this.hoveredBodyId();

    // If nothing is hovered, show no orbits
    if (!hoveredId) {
      return [];
    }

    // Build the set of visible orbit body IDs based on hierarchical relationships
    const visibleOrbitBodyIds = new Set<string>();
    
    // Add the hovered body itself (to show its own orbit)
    visibleOrbitBodyIds.add(hoveredId);

    const hoveredBody = byId.get(hoveredId);
    
    // Add the hovered body's parent (to show its contextual orbit around the star/parent)
    const hoveredParentId = hoveredBody?.source.orbitalElements?.anchorBodyId;
    if (hoveredParentId && byId.has(hoveredParentId)) {
      visibleOrbitBodyIds.add(hoveredParentId);
    }

    // Add all children of the hovered body (moons orbiting a planet, planets orbiting a star)
    for (const candidate of this.nonStars()) {
      if (candidate.source.orbitalElements?.anchorBodyId === hoveredId) {
        visibleOrbitBodyIds.add(candidate.id);
      }
    }

    return this.nonStars()
      .map((body): OrbitEllipse | null => {
        if (!visibleOrbitBodyIds.has(body.id)) {
          return null;
        }

        const orbital = body.source.orbitalElements;
        const semiMajorAxisKm = orbital?.semiMajorAxisKm;
        if (typeof semiMajorAxisKm !== 'number' || !Number.isFinite(semiMajorAxisKm) || semiMajorAxisKm <= 0) {
          return null;
        }

        const eRaw = orbital?.eccentricity;
        const eccentricity = typeof eRaw === 'number' && Number.isFinite(eRaw) ? Math.min(Math.max(eRaw, 0), 0.98) : 0;
        const radiusX = Math.max(0.55, resolveSceneDistanceFromKm(semiMajorAxisKm));
        const radiusZ = Math.max(0.45, +(radiusX * Math.sqrt(1 - eccentricity * eccentricity)).toFixed(3));

        const anchorId = orbital?.anchorBodyId;
        const anchorPosition = anchorId && byId.has(anchorId) ? byId.get(anchorId)!.position : [0, 0, 0];

        return {
          id: body.id,
          center: [anchorPosition[0], anchorPosition[1], anchorPosition[2]],
          radiusX,
          radiusZ,
          rotation: resolveOrbitRotationEuler(orbital),
          opacity: hoveredId === body.id ? 0.9 : 0.22,
        };
      })
      .filter((orbit): orbit is OrbitEllipse => orbit !== null);
  });

  // Hovered body tracking
  protected hoveredBodyId = signal<string | null>(null);

  onBodyPointerOver(body: ViewerBody) {
    this.hoveredBodyId.set(body.id);
    this.hoveredBodyChange.emit(body);
  }
  onBodyPointerOut(id: string) {
    if (this.hoveredBodyId() === id) {
      this.hoveredBodyId.set(null);
      this.hoveredBodyChange.emit(null);
    }
  }
}
