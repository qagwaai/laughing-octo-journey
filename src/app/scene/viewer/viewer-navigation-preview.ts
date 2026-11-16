import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { NgtsHTML } from 'angular-three-soba/misc';
import { BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three';
import type { SupportedNavigationPositionState } from '../../model/solar-system-get';
import { resolveScenePositionFromSpatialKm, type ViewerDistanceMode } from './viewer-formatters';
import {
  NAVIGATION_CANDIDATE_MARKER_RADIUS,
  navigationRouteClearsScreenMarker,
  type NavigationScenePoint,
} from './viewer-navigation-detour';

const DRAW_DURATION_SECONDS = 8;

@Component({
  selector: 'app-viewer-navigation-preview',
  imports: [NgtArgs, NgtsHTML],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (directReference(); as line) {
      <ngt-primitive *args="[line]" />
    }
    @if (route(); as line) {
      <ngt-primitive *args="[line]" />
    }
    @if (destination(); as marker) {
      <ngt-group [position]="marker" [name]="destinationLabel()">
        <ngt-mesh [renderOrder]="1000">
          <ngt-octahedron-geometry *args="[markerRadius, 0]" />
          <ngt-mesh-basic-material [color]="'#f7d36b'" [depthTest]="false" />
        </ngt-mesh>
        <ngts-html>
          <div [htmlContent]="{ pointerEvents: 'none', zIndexRange: [1, 1] }">
            <span
              style="display: block; transform: translate(10px, -100%); color: #f7d36b; background: #101827; padding: 2px 4px; max-width: 16rem"
            >
              {{ destinationLabel() }}
            </span>
          </div>
        </ngts-html>
      </ngt-group>
    }
    @if (candidate(); as marker) {
      <ngt-group [position]="marker" [name]="candidateLabel()">
        <ngt-mesh [renderOrder]="1000">
          <ngt-octahedron-geometry *args="[markerRadius, 0]" />
          <ngt-mesh-basic-material [color]="'#ff8eaf'" [wireframe]="true" [depthTest]="false" />
        </ngt-mesh>
        <ngts-html>
          <div [htmlContent]="{ pointerEvents: 'none', zIndexRange: [1, 1] }">
            <span
              style="display: block; transform: translate(10px, 10px); color: #ff8eaf; background: #101827; padding: 2px 4px; max-width: 16rem"
            >
              {{ candidateLabel() }}
            </span>
          </div>
        </ngts-html>
      </ngt-group>
    }
  `,
})
export class ViewerNavigationPreview {
  state = input.required<SupportedNavigationPositionState>();
  routePoints = input<NavigationScenePoint[] | null>(null);
  distanceMode = input<ViewerDistanceMode>('proportional');
  destinationLabel = input.required<string>();
  candidateLabel = input('');
  detourUnavailableChange = output<boolean>();
  protected readonly markerRadius = NAVIGATION_CANDIDATE_MARKER_RADIUS;
  private screenDetourUnavailable = false;
  private readonly store = injectStore();

  protected readonly destination = computed(() =>
    resolveScenePositionFromSpatialKm(this.state().destination.positionKm, this.distanceMode()),
  );
  protected readonly candidate = computed(() => {
    const position = this.state().candidates[0]?.positionKm;
    return position ? resolveScenePositionFromSpatialKm(position, this.distanceMode()) : null;
  });
  protected readonly route = signal<Line | null>(null);
  protected readonly directReference = signal<Line | null>(null);
  private elapsed = 0;
  private renderedPoints: NavigationScenePoint[] = [];

  constructor() {
    effect((onCleanup) => {
      const state = this.state();
      const mode = this.distanceMode();
      this.directReference.set(null);
      if (!state.candidates.length) return;
      const start = new Vector3(...resolveScenePositionFromSpatialKm(state.departure.positionKm, mode));
      const end = new Vector3(...resolveScenePositionFromSpatialKm(state.destination.positionKm, mode));
      const distance = start.distanceTo(end);
      const geometry = new BufferGeometry().setFromPoints([start, end]);
      const material = new LineDashedMaterial({
        color: '#8695a8',
        transparent: true,
        opacity: 0.6,
        dashSize: (distance * 0.6) / 48,
        gapSize: (distance * 0.4) / 48,
        depthTest: false,
      });
      const line = new Line(geometry, material);
      line.computeLineDistances();
      line.name = 'navigation-preview-direct-reference';
      line.renderOrder = 998;
      this.directReference.set(line);
      onCleanup(() => {
        geometry.dispose();
        material.dispose();
      });
    });
    effect((onCleanup) => {
      const points = this.routePoints();
      this.route.set(null);
      this.updateScreenAvailability(false);
      if (!points || points.length < 2) return;

      const vertices = points.map((point) => new Vector3(...point));
      const totalLength = vertices.slice(1).reduce((sum, point, index) => sum + point.distanceTo(vertices[index]!), 0);
      const samples = [vertices[0]!];
      for (let index = 1; index < vertices.length; index++) {
        const start = vertices[index - 1]!;
        const end = vertices[index]!;
        const steps = totalLength > 0 ? Math.max(1, Math.ceil((96 * start.distanceTo(end)) / totalLength)) : 1;
        for (let step = 1; step <= steps; step++) {
          samples.push(start.clone().lerp(end, step / steps));
        }
      }
      const geometry = new BufferGeometry();
      geometry.setFromPoints(samples);
      const position = geometry.getAttribute('position');
      this.renderedPoints = Array.from({ length: position.count }, (_, index) => [
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ]);
      const dashSize = this.candidate()
        ? Math.min((totalLength * 0.75) / 96, NAVIGATION_CANDIDATE_MARKER_RADIUS * 1.5)
        : (totalLength * 0.6) / 48;
      const material = new LineDashedMaterial({
        color: '#8ed8ff',
        dashSize,
        gapSize: this.candidate() ? dashSize / 3 : (totalLength * 0.4) / 48,
        depthTest: false,
      });
      const line = new Line(geometry, material);
      line.computeLineDistances();
      line.name = 'navigation-preview-route';
      line.renderOrder = 999;
      line.visible = !this.candidate();
      this.elapsed = 0;
      this.route.set(line);
      onCleanup(() => {
        geometry.dispose();
        material.dispose();
      });
    });

    beforeRender(({ delta }) => {
      const line = this.route();
      if (!line) return;
      const candidate = this.candidate();
      const camera = this.store.camera();
      const unavailable =
        !!candidate &&
        (!camera || !navigationRouteClearsScreenMarker(this.renderedPoints, candidate, camera, this.store.size()));
      line.visible = !unavailable;
      this.updateScreenAvailability(unavailable);
      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.elapsed = (this.elapsed + delta) % DRAW_DURATION_SECONDS;
      const position = line.geometry.getAttribute('position');
      const count = reduceMotion ? position.count : Math.ceil((this.elapsed / DRAW_DURATION_SECONDS) * position.count);
      line.geometry.setDrawRange(0, count);
    });
  }

  private updateScreenAvailability(unavailable: boolean): void {
    if (this.screenDetourUnavailable === unavailable) return;
    this.screenDetourUnavailable = unavailable;
    this.detourUnavailableChange.emit(unavailable);
  }
}
