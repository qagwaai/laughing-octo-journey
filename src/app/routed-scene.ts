import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingScene } from './scene/loading-scene.component';

@Component({
	selector: 'app-routed-scene',
	template: `
		@defer (prefetch on idle) {
			<router-outlet />
		} @placeholder (minimum 5s) {
			<app-loading-scene />
		}
		
	`,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterOutlet,
        LoadingScene
	],
})
export class RoutedScene {
	constructor() {}
}