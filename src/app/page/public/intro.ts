import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';

@Component({
  selector: 'app-intro-page',
  templateUrl: './intro.html',
  styleUrls: ['./intro.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Public intro landing page that routes users to registration or login.
 */
export default class IntroPage implements OnInit, OnDestroy {
  private static readonly KNOT_NAVIGATION_DELAY_MS = 5000;
  protected readonly t = locale;
  private router = inject(Router);
  private knotNavigationTimerId: number | null = null;

  ngOnInit(): void {
    this.knotNavigationTimerId = window.setTimeout(() => {
      this.router.navigate([{ outlets: { primary: ['knot'], left: ['intro'], right: null } }], {
        preserveFragment: true,
      });
      this.knotNavigationTimerId = null;
    }, IntroPage.KNOT_NAVIGATION_DELAY_MS);
  }

  /**
   * Routes to the registration outlet.
   */
  navigateToRegistration(): void {
    this.router.navigate([{ outlets: { left: ['registration'] } }], { preserveFragment: true });
  }

  /**
   * Routes to the login outlet.
   */
  navigateToLogin(): void {
    this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
  }

  ngOnDestroy(): void {
    if (this.knotNavigationTimerId === null) {
      return;
    }
    clearTimeout(this.knotNavigationTimerId);
    this.knotNavigationTimerId = null;
  }
}
