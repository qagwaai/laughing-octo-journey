import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether the primary scene (ship exterior) is visible or hidden by route overlays.
 * When rightOutletActive is true, the scene is hidden behind the right-pane page overlay.
 * When rightOutletActive is false, the scene is visible.
 */
@Injectable({
  providedIn: 'root',
})
export class SceneVisibilityService {
  private readonly rightOutletActive = signal(false);

  /**
   * Returns true when a right-outlet page is open (scene is hidden).
   * Returns false when no right-outlet page is open (scene is visible).
   */
  isSceneHidden = this.rightOutletActive.asReadonly();

  /**
   * Update the visibility state. Called by AppComponent when route changes.
   */
  setRightOutletActive(active: boolean): void {
    this.rightOutletActive.set(active);
  }
}
