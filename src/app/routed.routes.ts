import { Routes } from '@angular/router';

const routes: Routes = [
	{
		path: 'intro',
		loadComponent: () => import('./page/intro'),
	},
	{
		path: 'knot',
		loadComponent: () => import('./scene/knot'),
	},
	{
		path: 'scene-graph',
		loadComponent: () => import('./scene/scene-graph'),
	},
	{ path: '', redirectTo: 'intro', pathMatch: 'full' },
];

export default routes;