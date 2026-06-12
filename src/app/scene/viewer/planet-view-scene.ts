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
import { CanvasTexture, Vector3 } from 'three';
import type { ViewerBody } from '../../model/solar-system-get';
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
        ? clamp(
            Math.log10(1 + orbitalDistanceKm) / Math.log10(1 + PLANET_VIEW_MOON_FALLBACK_DISTANCE_KM),
            0,
            1,
          )
        : 0.5;

    const radiusFromDistanceKm =
      PLANET_VIEW_MOON_FALLBACK_BASE_RADIUS_KM + normalizedDistance * 1200;

    const jitter = ((resolveStableHash(body.id) % 23) - 11) / 100;
    const variedRadiusKm = radiusFromDistanceKm * (1 + jitter);
    return clamp(
      variedRadiusKm,
      PLANET_VIEW_MOON_FALLBACK_MIN_RADIUS_KM,
      PLANET_VIEW_MOON_FALLBACK_MAX_RADIUS_KM,
    );
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

export function resolveStarMarker(selected: ViewerBody, allBodies: ViewerBody[], maxOrbitRadius: number): StarMarker | null {
  const nearestStar = allBodies.find((body) => body.bodyType === 'star');
  if (!nearestStar) {
    return null;
  }

  const markerDistance = Math.max(maxOrbitRadius * 2.2, 28);
  const dx = nearestStar.spatial.positionKm.x - selected.spatial.positionKm.x;
  const dz = nearestStar.spatial.positionKm.z - selected.spatial.positionKm.z;
  const planarLength = Math.hypot(dx, dz);
  const nx = planarLength > 0 ? dx / planarLength : -0.66;
  const nz = planarLength > 0 ? dz / planarLength : -0.75;

  return {
    id: nearestStar.id,
    displayName: nearestStar.displayName || nearestStar.id,
    color: resolveBodyColor(nearestStar),
    position: [nx * markerDistance, Math.max(2.2, maxOrbitRadius * 0.14), nz * markerDistance],
    radius: 0.66,
    glowSize: Math.max(maxOrbitRadius * 0.9, 7),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return [Number.isNaN(r) ? 128 : r, Number.isNaN(g) ? 128 : g, Number.isNaN(b) ? 128 : b];
}

export function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function createProceduralTexture(baseHex: string, seed: number, type: 'planet' | 'moon'): CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const baseRgb = hexToRgb(baseHex);
  const darkFactor = type === 'moon' ? 0.55 : 0.45;
  const darkRgb: [number, number, number] = [
    Math.round(baseRgb[0] * darkFactor),
    Math.round(baseRgb[1] * darkFactor),
    Math.round(baseRgb[2] * darkFactor),
  ];

  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, lerpColor(baseRgb, darkRgb, 0.2));
  grad.addColorStop(0.5, lerpColor(baseRgb, darkRgb, 0.0));
  grad.addColorStop(1, lerpColor(baseRgb, darkRgb, 0.35));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Horizontal bands (atmospheric / surface bands)
  const bandCount = type === 'planet' ? 14 : 8;
  for (let i = 0; i < bandCount; i++) {
    const s = (seed * 31 + i * 53) % 1000;
    const y = (s / 1000) * size;
    const h = 6 + ((seed + i * 19) % (type === 'planet' ? 38 : 22));
    const t = 0.12 + ((seed * 7 + i * 11) % 100) / 280;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = lerpColor(baseRgb, [255, 255, 255], t);
    ctx.fillRect(0, y, size, h);
  }
  ctx.globalAlpha = 1.0;

  // Polar cap
  if (type === 'planet') {
    const capGrad = ctx.createLinearGradient(0, 0, 0, size * 0.18);
    capGrad.addColorStop(0, 'rgba(240,248,255,0.55)');
    capGrad.addColorStop(1, 'rgba(240,248,255,0)');
    ctx.fillStyle = capGrad;
    ctx.fillRect(0, 0, size, size * 0.18);
  }

  const texture = new CanvasTexture(canvas);
  return texture;
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
  imports: [NgtArgs, NgtsOrbitControls],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanetViewScene {
  private store = injectStore();
  private orbitControlsRef = viewChild(NgtsOrbitControls);

  bodies = input<ViewerBody[]>([]);
  selectedBodyId = input<string | null>(null);
  zoomLevel = input<number>(18);

  @Output() selectedBodyChange = new EventEmitter<ViewerBody>();
  @Output() exitRequested = new EventEmitter<void>();

  protected readonly resolveBodyColor = resolveBodyColor;

  protected hoveredBodyId = signal<string | null>(null);
  private needsCameraSnap = signal(true);

  protected textures = computed(() => {
    const selected = this.bodies().find((b) => b.id === this.selectedBodyId());
    const planetColor = selected ? resolveBodyColor(selected) : '#5577aa';
    const seed = selected ? selected.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 42;
    const moons = this.bodies().filter(
      (b) => b.orbitalElements?.anchorBodyId === selected?.id && b.bodyType !== 'star',
    );
    const moonColor = moons[0] ? resolveBodyColor(moons[0]) : '#aabbcc';
    const starBody = this.bodies().find((b) => b.bodyType === 'star');
    const starColor = starBody ? resolveBodyColor(starBody) : '#ffedbc';
    return {
      planet: createProceduralTexture(planetColor, seed, 'planet'),
      moon: createProceduralTexture(moonColor, seed + 7, 'moon'),
      starGlow: createStarGlowTexture(starColor),
    };
  });

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

  protected starMarker = computed<StarMarker | null>(() => {
    const selected = this.selectedBody();
    if (!selected) {
      return null;
    }

    return resolveStarMarker(selected, this.bodies(), this.maxOrbitRadius());
  });

  protected minCameraDistance = computed<number>(() => {
    return resolvePlanetViewCameraDistanceRange(this.selectedBody()).min;
  });

  protected maxCameraDistance = computed<number>(() => resolvePlanetViewCameraDistanceRange(this.selectedBody()).max);

  constructor() {
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
    event: { button?: number; nativeEvent?: { button?: number; preventDefault?: () => void }; stopPropagation?: () => void },
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

  private isRightButton(event: { button?: number; buttons?: number; nativeEvent?: { button?: number; buttons?: number } }): boolean {
    const button = event.button ?? event.nativeEvent?.button;
    const buttons = event.buttons ?? event.nativeEvent?.buttons;
    return button === 2 || (button === undefined && typeof buttons === 'number' && (buttons & 2) === 2);
  }
}
