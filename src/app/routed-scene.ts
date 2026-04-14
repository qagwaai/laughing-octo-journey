import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { CurrentRoute } from './component/current';
import { LoadingScene } from './scene/loading-scene.component';

@Component({
	selector: 'app-routed-scene',
	template: `
		@defer (prefetch on idle) {
    		<app-current [position]="[0, 0, -10]" [text]="currentRoute()" />
			<router-outlet />
		} @placeholder (minimum 5s) {
			<app-loading-scene />
		}
		
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CurrentRoute,
		RouterOutlet,
        LoadingScene
	],
})
export class RoutedScene {
	protected readonly Math = Math;

	private router = inject(Router);
	protected currentRoute = toSignal(
		this.router.events.pipe(
			filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
			map((ev) => ev.urlAfterRedirects.split('/routed').at(-1) as string),
			startWith(this.router.url.split('/routed').at(-1) as string),
		),
		{ initialValue: '/scene-graph' },
	);

	constructor() {
	}
}