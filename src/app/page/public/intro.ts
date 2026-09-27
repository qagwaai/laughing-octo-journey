import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { appLogger } from '../../services/logger';

@Component({
  selector: 'app-intro-page',
  templateUrl: './intro.html',
  styleUrls: ['./intro.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Public intro landing page that routes users to registration or login.
 */
export default class IntroPage {
  protected readonly t = locale;
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private readonly transition = afterNextRender(() => {
    if (this.activatedRoute.outlet !== 'primary') {
      return;
    }
    // Allow the shared canvas to remount after leaving the bare ship scene.
    void this.router
      .navigate([{ outlets: { primary: ['knot'] } }], {
        preserveFragment: true,
        replaceUrl: true,
      })
      .catch((error: unknown) => appLogger.error('Could not open the mining splash scene.', error));
  });

  /**
   * Routes to the registration outlet.
   */
  navigateToRegistration(): void {
    this.transition.destroy();
    this.router.navigate([{ outlets: { left: ['registration'] } }], { preserveFragment: true });
  }

  /**
   * Routes to the login outlet.
   */
  navigateToLogin(): void {
    this.transition.destroy();
    this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
  }
}
