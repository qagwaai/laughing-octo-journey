import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  EventEmitter,
  inject,
  input,
  OnDestroy,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { CanvasTexture, Vector3 } from 'three';
import type { PlanetBakeResult } from '../planet/planet-bake';
import {
  PLANET_VIEW_STAR_LIGHT_INTENSITY,
  resolveStarFillColor,
  resolveStarLights,
  STAR_LIGHT_DECAY,
  STAR_LIGHT_DISTANCE,
} from './star-lighting';
import type { ViewerBody } from '../../model/solar-system-get';
import { PlanetTextureCache } from '../planet/planet-texture-cache';
import { PlanetCloudLayer } from '../planet/planet-cloud-layer';
import { resolveBodyColor } from './viewer-formatters';

interface OrbitControlsLike {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
  spherical?: { radius: number };
}

interface LocalBody {
  body: ViewerBody;
  id: string;
  displayName: string;
  bodyType: string;
  color: string;
  radius: number;
  position: [number, number, number];
  orbitRadius: number;
}

interface StarMarker {
  id: string;
  displayName: string;
  color: string;
  position: [number, number, number];
  radius: number;
  glowSize: number;
  body: ViewerBody;
}

const PLANET_FOCUS_RADIUS_UNIT = 2.2;
const PLANET_MIN_CAMERA_DISTANCE = 4.2;
const PLANET_BASE_MOON_ORBIT = 4.5;
const PLANET_VIEW_REFERENCE_DIAMETER_M = 12_742_000;
const PLANET_VIEW_MAX_CAMERA_DISTANCE = 80;
const PLANET_VIEW_MIN_DISTANCE_CLAMP_MIN = 3.2;
const PLANET_VIEW_MIN_DISTANCE_CLAMP_MAX = 14;
const PLANET_VIEW_MAX_DISTANCE_CLAMP_MIN = 40;
const PLANET_VIEW_MAX_DISTANCE_CLAMP_MAX = 180;
const PLANET_VIEW_MIN_MAX_GAP = 8;
const PLANET_VIEW_MOON_FALLBACK_BASE_RADIUS_KM = 1150;
const PLANET_VIEW_MOON_FALLBACK_DISTANCE_KM = 2_000_000;
const PLANET_VIEW_MOON_FALLBACK_MIN_RADIUS_KM = 700;
const PLANET_VIEW_MOON_FALLBACK_MAX_RADIUS_KM = 3200;

export interface PlanetViewCameraDistanceRange {
  min: number;
  max: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveEstimatedDiameterM(body: ViewerBody | null): number | null {
  const diameterM = body?.physicalCatalog?.estimatedDiameterM;
  if (typeof diameterM !== 'number' || !Number.isFinite(diameterM) || diameterM <= 0) {
    return null;
  }
  return diameterM;
}

function resolveStableHash(value: string): number {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

/**
 * Resolves camera distance range for planet details scene from selected-body size.
 * The range is clamped to preserve stable UX while remaining data-driven.
 */
export function resolvePlanetViewCameraDistanceRange(selectedBody: ViewerBody | null): PlanetViewCameraDistanceRange {
  const diameterM = resolveEstimatedDiameterM(selectedBody);
  if (!diameterM) {
    return {
      min: PLANET_MIN_CAMERA_DISTANCE,
      max: PLANET_VIEW_MAX_CAMERA_DISTANCE,
    };
  }

  const ratio = diameterM / PLANET_VIEW_REFERENCE_DIAMETER_M;
  const scale = Math.cbrt(Math.max(0.05, ratio));

  const minDistance = clamp(
    PLANET_MIN_CAMERA_DISTANCE * scale,
    PLANET_VIEW_MIN_DISTANCE_CLAMP_MIN,
    PLANET_VIEW_MIN_DISTANCE_CLAMP_MAX,
  );

  let maxDistance = clamp(
    PLANET_VIEW_MAX_CAMERA_DISTANCE * scale,
    PLANET_VIEW_MAX_DISTANCE_CLAMP_MIN,
    PLANET_VIEW_MAX_DISTANCE_CLAMP_MAX,
  );
  if (maxDistance < minDistance + PLANET_VIEW_MIN_MAX_GAP) {
    maxDistance = minDistance + PLANET_VIEW_MIN_MAX_GAP;
  }

  return {
    min: +minDistance.toFixed(3),
    max: +maxDistance.toFixed(3),
  };
}

export function resolvePlanetViewBodyRadiusKm(body: ViewerBody, relativeDistanceKm?: number): number {
  const explicitRadius = body.physicalCatalog?.radiusKm;
  if (typeof explicitRadius === 'number' && Number.isFinite(explicitRadius) && explicitRadius > 0) {
    return explicitRadius;
  }

  const diameterM = body.physicalCatalog?.estimatedDiameterM;
  if (typeof diameterM === 'number' && Number.isFinite(diameterM) && diameterM > 0) {
    return diameterM / 2000;
  }

  if (body.bodyType === 'moon') {
    const orbitalDistanceKm =
      typeof relativeDistanceKm === 'number' && Number.isFinite(relativeDistanceKm) && relativeDistanceKm > 0
        ? relativeDistanceKm
        : body.orbitalElements?.semiMajorAxisKm;

    const normalizedDistance =
      typeof orbitalDistanceKm === 'number' && Number.isFinite(orbitalDistanceKm) && orbitalDistanceKm > 0
        ? clamp(Math.log10(1 + orbitalDistanceKm) / Math.log10(1 + PLANET_VIEW_MOON_FALLBACK_DISTANCE_KM), 0, 1)
        : 0.5;

    const radiusFromDistanceKm = PLANET_VIEW_MOON_FALLBACK_BASE_RADIUS_KM + normalizedDistance * 1200;

    const jitter = ((resolveStableHash(body.id) % 23) - 11) / 100;
    const variedRadiusKm = radiusFromDistanceKm * (1 + jitter);
    return clamp(variedRadiusKm, PLANET_VIEW_MOON_FALLBACK_MIN_RADIUS_KM, PLANET_VIEW_MOON_FALLBACK_MAX_RADIUS_KM);
  }
  return 6200;
}

function resolveBodyRadiusUnits(bodyRadiusKm: number, referenceRadiusKm: number): number {
  const ratio = bodyRadiusKm / Math.max(referenceRadiusKm, 1);
  const scaled = PLANET_FOCUS_RADIUS_UNIT * Math.cbrt(Math.max(0.03, ratio));
  return Math.max(0.35, Math.min(3.8, scaled));
}

function resolveRelativeDistanceKm(selected: ViewerBody, candidate: ViewerBody): number {
  const orbitalDistance = candidate.orbitalElements?.semiMajorAxisKm;
  if (typeof orbitalDistance === 'number' && Number.isFinite(orbitalDistance) && orbitalDistance > 0) {
    return orbitalDistance;
  }

  const dx = candidate.spatial.positionKm.x - selected.spatial.positionKm.x;
  const dy = candidate.spatial.positionKm.y - selected.spatial.positionKm.y;
  const dz = candidate.spatial.positionKm.z - selected.spatial.positionKm.z;
  const distance = Math.hypot(dx, dy, dz);
  return Number.isFinite(distance) && distance > 0 ? distance : 1;
}

export function resolveOrbitRadiusUnits(distanceKm: number): number {
  const logDistance = Math.log10(1 + distanceKm);
  const unitRadius = PLANET_BASE_MOON_ORBIT + logDistance * 2.3;
  return Math.max(PLANET_BASE_MOON_ORBIT, Math.min(42, unitRadius));
}

export function resolveOrbitAngleRad(body: ViewerBody): number {
  const anomalyDeg = body.orbitalElements?.meanAnomalyAtEpochDeg;
  if (typeof anomalyDeg === 'number' && Number.isFinite(anomalyDeg)) {
    return (anomalyDeg * Math.PI) / 180;
  }

  const hash = resolveStableHash(body.id);
  return (hash % 360) * (Math.PI / 180);
}

/**
 * Places every star in the system around the focused planet.
 *
 * A system can be a binary, and previously only the first star was found, so a
 * companion neither appeared nor contributed light. Stars sharing a position
 * are fanned apart so they do not stack into a single sprite.
 */
export function resolveStarMarkers(
  selected: ViewerBody,
  allBodies: ViewerBody[],
  maxOrbitRadius: number,
): StarMarker[] {
  const stars = allBodies.filter((body) => body.bodyType === 'star');
  if (stars.length === 0) {
    return [];
  }

  const markerDistance = Math.max(maxOrbitRadius * 2.2, 28);

  return stars.map((star, index) => {
    const dx = star.spatial.positionKm.x - selected.spatial.positionKm.x;
    const dz = star.spatial.positionKm.z - selected.spatial.positionKm.z;
    const planarLength = Math.hypot(dx, dz);
    // Companions are often catalogued at the same point as the primary, so a
    // degenerate direction is fanned by index rather than collapsed.
    const fallbackAngle = -2.29 + index * 0.9;
    const nx = planarLength > 0 ? dx / planarLength : Math.cos(fallbackAngle);
    const nz = planarLength > 0 ? dz / planarLength : Math.sin(fallbackAngle);

    return {
      id: star.id,
      displayName: star.displayName || star.id,
      color: resolveBodyColor(star),
      position: [nx * markerDistance, Math.max(2.2, maxOrbitRadius * 0.14), nz * markerDistance] as [
        number,
        number,
        number,
      ],
      radius: 0.66,
      glowSize: Math.max(maxOrbitRadius * 0.9, 7),
      body: star,
    };
  });
}

export function resolveStarMarker(
  selected: ViewerBody,
  allBodies: ViewerBody[],
  maxOrbitRadius: number,
): StarMarker | null {
  return resolveStarMarkers(selected, allBodies, maxOrbitRadius)[0] ?? null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return [Number.isNaN(r) ? 128 : r, Number.isNaN(g) ? 128 : g, Number.isNaN(b) ? 128 : b];
}

export function createStarGlowTexture(hex: string): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const [r, g, b] = hexToRgb(hex);
  const cx = size / 2;
  const cy = size / 2;

  // Outer soft halo
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
  halo.addColorStop(0, `rgba(${r},${g},${b},1)`);
  halo.addColorStop(0.18, `rgba(${r},${g},${b},0.92)`);
  halo.addColorStop(0.42, `rgba(${r},${g},${b},0.38)`);
  halo.addColorStop(0.72, `rgba(${r},${g},${b},0.08)`);
  halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.22);
  core.addColorStop(0, `rgba(255,255,240,1)`);
  core.addColorStop(0.6, `rgba(${r},${g},${b},0.7)`);
  core.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  return texture;
}

@Component({
  selector: 'app-planet-view-scene',
  templateUrl: './planet-view-scene.html',
  imports: [NgtArgs, NgtsOrbitControls, PlanetCloudLayer],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanetViewScene implements OnDestroy {
  private store = injectStore();
  private readonly planetTextures = inject(PlanetTextureCache);

  /**
   * The star glow is a canvas sprite rather than a baked surface. It is cached
   * by colour so a recompute does not orphan the previous texture; the earlier
   * implementation allocated a fresh CanvasTexture on every recompute and never
   * released any of them. A binary system needs one entry per distinct colour.
   */
  private starGlowCache = new Map<string, CanvasTexture>();

  private starGlowFor(color: string): CanvasTexture {
    const cached = this.starGlowCache.get(color);
    if (cached) {
      return cached;
    }
    const texture = createStarGlowTexture(color);
    this.starGlowCache.set(color, texture);
    return texture;
  }

  ngOnDestroy(): void {
    for (const texture of this.starGlowCache.values()) texture.dispose();
    this.starGlowCache.clear();
  }
  private orbitControlsRef = viewChild(NgtsOrbitControls);

  bodies = input<ViewerBody[]>([]);
  selectedBodyId = input<string | null>(null);
  zoomLevel = input<number>(18);

  @Output() selectedBodyChange = new EventEmitter<ViewerBody>();
  @Output() exitRequested = new EventEmitter<void>();

  protected readonly resolveBodyColor = resolveBodyColor;

  protected hoveredBodyId = signal<string | null>(null);
  private needsCameraSnap = signal(true);

  /**
   * Baked surfaces for the focused body and its moons.
   *
   * The focused body asks for L1 and falls back to its L0 surface while that
   * bake is queued, so the planet is never untextured once anything is warm.
   * Moons stay at L0: they render far smaller here, and L1 for every moon would
   * cost roughly 21 MiB each.
   */
  protected readonly surfaces = computed<ReadonlyMap<string, PlanetBakeResult>>(() => {
    this.planetTextures.ready();

    const map = new Map<string, PlanetBakeResult>();
    const selected = this.selectedBody();
    if (selected) {
      const focused = this.planetTextures.get(selected, 'l1');
      if (focused) map.set(selected.id, focused);
    }
    for (const moon of this.moons()) {
      const baked = this.planetTextures.get(moon.body, 'l0');
      if (baked) map.set(moon.id, baked);
    }
    return map;
  });

  /** Textured bodies render white; three multiplies `map` by `color`. */
  protected resolveSurfaceTint(bodyId: string, hoverColor: string, baseColor: string): string {
    if (this.hoveredBodyId() === bodyId) return hoverColor;
    return this.surfaces().has(bodyId) ? '#ffffff' : baseColor;
  }

  protected selectedBody = computed<ViewerBody | null>(() => {
    const id = this.selectedBodyId();
    if (!id) {
      return null;
    }

    const all = this.bodies();
    return all.find((body) => body.id === id) ?? null;
  });

  protected selectedBodyRadiusUnits = computed<number>(() => {
    const selected = this.selectedBody();
    if (!selected) {
      return PLANET_FOCUS_RADIUS_UNIT;
    }

    const selectedRadiusKm = resolvePlanetViewBodyRadiusKm(selected);
    return resolveBodyRadiusUnits(selectedRadiusKm, selectedRadiusKm);
  });

  protected moons = computed<LocalBody[]>(() => {
    const selected = this.selectedBody();
    if (!selected) {
      return [];
    }

    const selectedRadiusKm = resolvePlanetViewBodyRadiusKm(selected);
    return this.bodies()
      .filter((body) => body.orbitalElements?.anchorBodyId === selected.id && body.bodyType !== 'star')
      .map((body) => {
        const distanceKm = resolveRelativeDistanceKm(selected, body);
        const orbitRadius = resolveOrbitRadiusUnits(distanceKm);
        const angle = resolveOrbitAngleRad(body);
        const bodyRadiusKm = resolvePlanetViewBodyRadiusKm(body, distanceKm);
        return {
          body,
          id: body.id,
          displayName: body.displayName || body.id,
          bodyType: body.bodyType,
          color: resolveBodyColor(body),
          radius: resolveBodyRadiusUnits(bodyRadiusKm, selectedRadiusKm),
          position: [Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius],
          orbitRadius,
        };
      });
  });

  protected maxOrbitRadius = computed<number>(() => {
    const moonOrbitRadius = this.moons().reduce((max, moon) => Math.max(max, moon.orbitRadius), 0);
    return Math.max(moonOrbitRadius, PLANET_BASE_MOON_ORBIT);
  });

  /**
   * Every star in the system, each with its own glow sprite and cast light.
   *
   * The light colour is tempered toward neutral while the sprite keeps the
   * star's true colour, so the star stays identifiable without its tint making
   * the focused planet's surface unreadable.
   */
  protected starMarkers = computed(() => {
    const selected = this.selectedBody();
    if (!selected) {
      return [];
    }

    const markers = resolveStarMarkers(selected, this.bodies(), this.maxOrbitRadius());
    const lights = resolveStarLights(
      markers.map((marker) => ({ id: marker.id, position: marker.position, body: marker.body })),
      PLANET_VIEW_STAR_LIGHT_INTENSITY,
    );

    return markers.map((marker, index) => ({
      ...marker,
      glow: this.starGlowFor(marker.color),
      lightColor: lights[index].color,
      lightIntensity: lights[index].intensity,
    }));
  });

  protected readonly starLightDistance = STAR_LIGHT_DISTANCE;
  protected readonly starLightDecay = STAR_LIGHT_DECAY;

  protected starFillColor = computed(() =>
    resolveStarFillColor(
      this.bodies()
        .filter((body) => body.bodyType === 'star')
        .map((body) => ({ id: body.id, position: [0, 0, 0] as [number, number, number], body })),
    ),
  );

  protected minCameraDistance = computed<number>(() => {
    return resolvePlanetViewCameraDistanceRange(this.selectedBody()).min;
  });

  protected maxCameraDistance = computed<number>(() => resolvePlanetViewCameraDistanceRange(this.selectedBody()).max);

  constructor() {
    // Focused body at L1, its moons at L0. Repeats are ignored by the cache.
    effect(() => {
      const renderer = this.store.snapshot.gl ?? null;
      const selected = this.selectedBody();
      if (selected) {
        this.planetTextures.request(selected, 'l1', renderer);
      }
      this.planetTextures.requestMany(
        this.moons().map((moon) => moon.body),
        'l0',
        renderer,
      );
    });

    effect(() => {
      this.selectedBodyId();
      this.needsCameraSnap.set(true);
    });

    beforeRender(() => {
      const camera = this.store.camera();
      const controls = this.orbitControlsRef()?.controls() as OrbitControlsLike | undefined;
      if (!camera || !controls?.target) {
        return;
      }

      const minDistance = this.minCameraDistance();
      const maxDistance = this.maxCameraDistance();
      const normalizedZoom = Math.max(0, Math.min(100, this.zoomLevel()));
      const targetDistance = minDistance + ((maxDistance - minDistance) * normalizedZoom) / 100;

      if (this.needsCameraSnap()) {
        // On snap: point camera from a default angle then let controls take over
        const direction = new Vector3(0.4, 0.22, 1).normalize();
        camera.position.copy(controls.target.clone().add(direction.multiplyScalar(targetDistance)));
        this.needsCameraSnap.set(false);
      }

      // Constrain both limits to targetDistance — OrbitControls then enforces this
      // radius on each update() instead of fighting direct camera.position writes.
      controls.minDistance = targetDistance;
      controls.maxDistance = targetDistance;
      controls.update();
    });
  }

  onBodyPointerOver(body: ViewerBody): void {
    this.hoveredBodyId.set(body.id);
  }

  onBodyPointerOut(bodyId: string): void {
    if (this.hoveredBodyId() === bodyId) {
      this.hoveredBodyId.set(null);
    }
  }

  onBodyPointerDown(
    event: {
      button?: number;
      nativeEvent?: { button?: number; preventDefault?: () => void };
      stopPropagation?: () => void;
    },
    body: ViewerBody,
  ): void {
    event.stopPropagation?.();

    if (this.isRightButton(event)) {
      event.nativeEvent?.preventDefault?.();
      return;
    }

    if (body.id !== this.selectedBodyId()) {
      this.selectedBodyChange.emit(body);
    }
  }

  onScenePointerDown(event: { button?: number; nativeEvent?: { button?: number; preventDefault?: () => void } }): void {
    if (!this.isRightButton(event)) {
      return;
    }

    event.nativeEvent?.preventDefault?.();
    this.exitRequested.emit();
  }

  private isRightButton(event: {
    button?: number;
    buttons?: number;
    nativeEvent?: { button?: number; buttons?: number };
  }): boolean {
    const button = event.button ?? event.nativeEvent?.button;
    const buttons = event.buttons ?? event.nativeEvent?.buttons;
    return button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
  }
}
