import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, input, Output, signal } from '@angular/core';
import { NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import {
  isStarBody,
  resolveBodyColor,
  resolveBodySceneRadius,
  resolveBodyScenePosition,
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

/**
 * Pure mapping from raw {@link ViewerBody} entries to the lightweight `RenderedBody`
 * shape used by the scene template. Exposed for unit tests so the scene component
 * itself (which depends on `NgtStore` at change detection) does not need to mount.
 */
export function mapBodiesToRendered(bodies: ViewerBody[]): RenderedBody[] {
  return bodies.map((body) => ({
    source: body,
    id: body.id,
    bodyType: body.bodyType,
    displayName: body.displayName,
    color: resolveBodyColor(body),
    radius: resolveBodySceneRadius(body),
    position: resolveBodyScenePosition(body),
    isStar: isStarBody(body),
  }));
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
