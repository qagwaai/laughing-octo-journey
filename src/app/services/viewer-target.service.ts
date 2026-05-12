import { Injectable, signal } from '@angular/core';

/**
 * Shared service that bridges the left-pane solar system details list and the
 * right-pane Viewer scene. The details page writes a body id; the scene reacts
 * by panning the camera to that body and applying a highlight ring.
 */
@Injectable({ providedIn: 'root' })
export class ViewerTargetService {
  /** The id of the body currently targeted from the details list. */
  readonly targetBodyId = signal<string | null>(null);

  target(id: string): void {
    this.targetBodyId.set(id);
  }

  clearTarget(): void {
    this.targetBodyId.set(null);
  }
}
