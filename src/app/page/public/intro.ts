import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';

@Component({
	selector: 'app-intro-page',
	templateUrl: './intro.html',
	styleUrls: ['./intro.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class IntroPage {
	protected readonly t = locale;
	private router = inject(Router);

	navigateToRegistration(): void {
		this.router.navigate([{ outlets: { left: ['registration'] } }], { preserveFragment: true });
	}

	navigateToLogin(): void {
		this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
	}
}
