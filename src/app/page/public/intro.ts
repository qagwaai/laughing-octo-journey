import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { appLogger } from '../../services/logger';
import {
  EXOPLANET_DATA_CREDITS,
  SECONDARY_EXOPLANET_DATA_CREDITS,
  SOLAR_SYSTEM_DATA_CREDITS,
} from './astronomy-data-credits';

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
  protected readonly solarSystemDataCredits = SOLAR_SYSTEM_DATA_CREDITS;
  protected readonly exoplanetDataCredits = EXOPLANET_DATA_CREDITS;
  protected readonly secondaryExoplanetDataCredits = SECONDARY_EXOPLANET_DATA_CREDITS;
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private readonly transition = afterNextRender(() => {
    if (this.activatedRoute.outlet !== 'primary') {
      return;
    }
    // Allow the shared canvas to remount after leaving the bare ship scene.
    void this.router
      .navigate([{ outlets: { primary: ['splash'] } }], {
        preserveFragment: true,
        replaceUrl: true,
      })
      .catch((error: unknown) => appLogger.error('Could not open the splash scene.', error));
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
