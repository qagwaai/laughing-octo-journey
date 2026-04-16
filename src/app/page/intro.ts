import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'app-intro-page',
	templateUrl: './intro.html',
	styleUrls: ['./intro.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class IntroPage {
	protected projectName = 'Stellar';
	private router = inject(Router);

	navigateToRegistration(): void {
		this.router.navigate([{ outlets: { left: ['registration'] } }], { preserveFragment: true });
	}

	navigateToLogin(): void {
		this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
	}
}
