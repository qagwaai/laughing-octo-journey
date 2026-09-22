import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../i18n/locale';

/**
 * Dismiss control for right-outlet overlay pages.
 *
 * Closing clears the `right` outlet and pins `primary` to the ship exterior scene, so the
 * overlay always resolves back to the main game view. When the ship exterior is already the
 * active primary route the router reuses it, so the scene is not remounted.
 */
@Component({
  selector: 'app-overlay-close-button',
  templateUrl: './overlay-close-button.html',
  styleUrls: ['./overlay-close-button.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayCloseButton {
  protected readonly t = locale;
  private readonly router = inject(Router);

  protected close(): void {
    this.router.navigate([{ outlets: { primary: ['ship-exterior-view'], right: null } }], {
      preserveFragment: true,
      replaceUrl: true,
    });
  }
}
