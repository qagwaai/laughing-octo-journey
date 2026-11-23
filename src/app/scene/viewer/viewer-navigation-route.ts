import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, effect, input, output, signal } from '@angular/core';
import { beforeRender, injectStore, NgtArgs } from 'angular-three';
import { NgtsHTML } from 'angular-three-soba/misc';
import { BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three';
import { getActiveLocaleCode, locale } from '../../i18n/locale';
import type { NavigationHazardAssessment } from '../../model/navigation-route-search';
import type { ViewerBody } from '../../model/solar-system-get';
import type { NavigationRouteChoice } from '../../services/navigation-route-selection';
import type { PlanetSurfaceResult } from '../planet/catalog-surface-loader';
import { resolveScenePositionFromSpatialKm, type ViewerDistanceMode } from './viewer-formatters';
import { buildCalculatedRouteIllustration, NAVIGATION_CANDIDATE_MARKER_RADIUS } from './viewer-navigation-detour';
import { clusterRouteHazards, type RouteHazardCluster, type RouteHazardMarker } from './viewer-route-hazard-clusters';

interface RouteDisplayBody {
  id: string;
  source: ViewerBody;
  displayName: string;
  position: [number, number, number];
  radius: number;
  materialColor: string;
}

function encounterElapsed(durationMs: number): string {
  const [value, unit] = durationMs < 60_000
    ? [durationMs / 1000, 's']
    : durationMs < 3_600_000
      ? [durationMs / 60_000, 'min']
      : [durationMs / 3_600_000, 'h'];
  return `${new Intl.NumberFormat(getActiveLocaleCode(), { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

@Component({
  selector: 'app-viewer-navigation-route',
  imports: [NgtArgs, NgtsHTML],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .route-warning {
      position: relative;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      border: 2px solid #ffd06a;
      border-radius: 50%;
      background: #e5a323;
      color: #281a05;
      box-shadow: 0 2px 6px #000b;
      cursor: pointer;
      transform: translate(-50%, -50%);
    }
    .route-warning:focus-visible { outline: 2px solid white; outline-offset: 3px; }
    .route-warning__count {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 17px;
      padding: 1px 3px;
      border-radius: 1em;
      background: #281a05;
      color: white;
      font: bold 11px sans-serif;
    }
  `],
  template: `
    @if (directLine(); as line) { <ngt-primitive *args="[line]" /> }
    @if (selectedLine(); as line) { <ngt-primitive *args="[line]" /> }
    @if (illustration(); as line) { <ngt-primitive *args="[line]" /> }
    @for (line of ghostLinks(); track line.uuid) { <ngt-primitive *args="[line]" /> }
    @for (marker of encounterMarkers(); track marker.id) {
      <ngt-group [position]="marker.position" [name]="marker.id">
        <ngt-mesh [renderOrder]="1000">
          <ngt-sphere-geometry *args="[marker.radius, 32, 24]" />
          <ngt-mesh-basic-material [color]="marker.color" [map]="marker.texture" [transparent]="true" [opacity]="0.55" [depthWrite]="false" [depthTest]="false" />
        </ngt-mesh>
        <ngts-html>
          <div [htmlContent]="{ pointerEvents: 'none', zIndexRange: [1, 1] }">
            <span style="display: block; white-space: nowrap; color: #c7a6ff; transform: translate(10px, 10px); background: #101827; padding: 2px 4px">{{ marker.label }}</span>
          </div>
        </ngts-html>
      </ngt-group>
    }
    @for (marker of markers(); track marker.key) {
      <ngt-group [position]="marker.position" [name]="'navigation-route-warning-' + marker.key">
        <ngts-html>
          <div [htmlContent]="{ pointerEvents: 'auto', zIndexRange: [1, 1] }">
            <button type="button" class="route-warning" (click)="selectMarker($event, marker)"
              [attr.aria-label]="markerMessage(marker)" [attr.title]="markerMessage(marker)">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2 19 18H1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M10 7v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <circle cx="10" cy="15" r="1" fill="currentColor" />
              </svg>
              @if (marker.messages.length > 1) {
              <span class="route-warning__count" aria-hidden="true">{{ marker.messages.length }}</span>
              }
            </button>
          </div>
        </ngts-html>
      </ngt-group>
    }
  `,
})
export class ViewerNavigationRoute {
  choices = input.required<NavigationRouteChoice[]>();
  selected = input.required<number>();
  distanceMode = input.required<ViewerDistanceMode>();
  bodies = input.required<RouteDisplayBody[]>();
  surfaces = input.required<ReadonlyMap<string, PlanetSurfaceResult>>();
  markerSelected = output<string>();
  illustrationUnavailableChange = output<boolean>();
  protected readonly directLine = signal<Line | null>(null);
  protected readonly selectedLine = signal<Line | null>(null);
  protected readonly illustration = signal<Line | null>(null);
  protected readonly ghostLinks = signal<Line[]>([]);
  protected readonly encounterMarkers = signal<{
    id: string;
    position: [number, number, number];
    label: string;
    radius: number;
    color: string;
    texture: PlanetSurfaceResult['albedo'] | null;
  }[]>([]);
  protected readonly markers = signal<RouteHazardCluster[]>([]);
  private readonly store = injectStore();
  private hazardMarkers: RouteHazardMarker[] = [];
  private markerSignature = '';
  private elapsed = 0;

  constructor() {
    effect((onCleanup) => {
      const choices = this.choices();
      const selected = choices[this.selected()];
      const direct = choices.find((choice) => choice.kind === 'direct');
      const mode = this.distanceMode();
      const bodies = this.bodies();
      const surfaces = this.surfaces();
      const lines: Line[] = [];
      const makeLine = (positions: { x: number; y: number; z: number }[], color: string, name: string): Line => {
        const points = positions.map((point) => new Vector3(...resolveScenePositionFromSpatialKm(point, mode)));
        const length = points.slice(1).reduce((sum, point, index) => sum + point.distanceTo(points[index]), 0);
        const geometry = new BufferGeometry().setFromPoints(points);
        const material = new LineDashedMaterial({
          color,
          dashSize: Math.max(length / 80, 0.00001),
          gapSize: Math.max(length / 120, 0.00001),
          depthTest: false,
        });
        const line = new Line(geometry, material);
        line.computeLineDistances();
        line.name = name;
        line.renderOrder = 999;
        lines.push(line);
        return line;
      };
      this.directLine.set(
        direct?.kind === 'direct'
          ? makeLine(
              [direct.direct.departurePositionKm, direct.direct.destinationPositionKm],
              '#8695a8',
              'navigation-route-direct-reference',
            )
          : null,
      );
      this.selectedLine.set(
        selected?.kind === 'route' && selected.route.legs.length
          ? makeLine(
              [selected.route.legs[0].startPositionKm, ...selected.route.legs.map((leg) => leg.endPositionKm)],
              '#74f5c2',
              'navigation-route-selected',
            )
          : null,
      );
      const routeLegs = selected?.kind === 'route' ? selected.route.legs : [];
      const links: Line[] = [];
      this.encounterMarkers.set(routeLegs.flatMap((leg) => {
        const encounter = leg.encounter;
        if (!encounter) return [];
        const body = bodies.find((item) => item.id === encounter.bodyId);
        const position = resolveScenePositionFromSpatialKm(encounter.bodyCenterPositionKm, mode);
        if (body && !body.source.placeholder) {
          const start = new Vector3(...body.position);
          const end = new Vector3(...position);
          const length = start.distanceTo(end);
          if (length > 0.00001) {
            const geometry = new BufferGeometry().setFromPoints([start, end]);
            const material = new LineDashedMaterial({
              color: '#c7a6ff', transparent: true, opacity: 0.35,
              dashSize: length / 100, gapSize: length / 100, depthTest: false, depthWrite: false,
            });
            const link = new Line(geometry, material);
            link.name = `navigation-route-ghost-link-${leg.legIndex}`;
            link.renderOrder = 998;
            link.computeLineDistances();
            links.push(link);
            lines.push(link);
          }
        }
        const texture = surfaces.get(encounter.bodyId)?.albedo ?? null;
        return [{
          id: `navigation-route-ghost-${leg.legIndex}-${encounter.bodyId}`,
          position,
          label: locale.game.viewer.navigationRouteEncounter
            .replace('{body}', body?.displayName ?? encounter.bodyId)
            .replace('{elapsed}', encounterElapsed(encounter.encounterEpochMs - routeLegs[0]!.departureEpochMs)),
          radius: Math.max(body?.radius ?? 0, 0.12),
          color: texture ? '#ffffff' : body?.materialColor ?? '#c7a6ff',
          texture,
        }];
      }));
      this.ghostLinks.set(links);
      const illustrationPoints = routeLegs.length ? buildCalculatedRouteIllustration(routeLegs, mode) : null;
      this.illustrationUnavailableChange.emit(routeLegs.length > 0 && !illustrationPoints);
      this.elapsed = 0;
      if (illustrationPoints) {
        const geometry = new BufferGeometry().setFromPoints(illustrationPoints.map((point) => new Vector3(...point)));
        const material = new LineDashedMaterial({
          color: '#8ed8ff',
          dashSize: NAVIGATION_CANDIDATE_MARKER_RADIUS * 1.5,
          gapSize: NAVIGATION_CANDIDATE_MARKER_RADIUS * 0.5,
          depthTest: false,
        });
        const line = new Line(geometry, material);
        line.name = 'navigation-route-illustration';
        line.renderOrder = 1000;
        line.computeLineDistances();
        lines.push(line);
        this.illustration.set(line);
      } else {
        this.illustration.set(null);
      }
      const assessment: NavigationHazardAssessment | undefined =
        selected?.kind === 'route' ? selected.route.hazardAssessment : selected?.direct.hazardAssessment;
      this.hazardMarkers = (assessment?.markers ?? []).map((marker) => {
        const body = bodies.find((item) => item.id === marker.bodyId);
        const type = marker.hazardType === 'surface' ? locale.game.viewer.navigationRouteSurface :
          marker.hazardType === 'atmosphere' ? locale.game.viewer.navigationRouteAtmosphere :
          locale.game.viewer.navigationRouteRing;
        return {
          position: resolveScenePositionFromSpatialKm(marker.positionKm, mode),
          message: `${body?.displayName ?? marker.bodyId}: ${type} — ${marker.explanation}`,
        };
      });
      this.markerSignature = '';
      this.markers.set([]);
      onCleanup(() => {
        for (const line of lines) {
          line.geometry.dispose();
          (line.material as LineDashedMaterial).dispose();
        }
      });
    });
    beforeRender(({ delta }) => {
      const camera = this.store.camera();
      if (camera) {
        const clusters = clusterRouteHazards(this.hazardMarkers, camera, this.store.size());
        const signature = clusters.map((cluster) => cluster.key).join('|');
        if (signature !== this.markerSignature) {
          this.markerSignature = signature;
          this.markers.set(clusters);
        }
      }
      const line = this.illustration();
      if (!line) return;
      const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.elapsed = (this.elapsed + delta) % 8;
      const count = line.geometry.getAttribute('position').count;
      line.geometry.setDrawRange(0, reducedMotion ? count : Math.ceil((this.elapsed / 8) * count));
    });
  }

  protected markerMessage(marker: RouteHazardCluster): string {
    const messages = marker.messages.join('; ');
    return marker.messages.length > 1
      ? `${locale.game.viewer.navigationRouteNearbyWarnings.replace('{count}', marker.messages.length.toString())}: ${messages}`
      : messages;
  }

  protected selectMarker(event: Event, marker: RouteHazardCluster): void {
    event.stopPropagation();
    this.markerSelected.emit(this.markerMessage(marker));
  }
}
