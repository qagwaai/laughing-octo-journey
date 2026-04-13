import { Routes } from '@angular/router';

const routes: Routes = [
	{
		path: 'knot',
		loadComponent: () => import('./scene/knot'),
	},
	{
		path: 'scene-graph',
		loadComponent: () => import('./scene/scene-graph'),
	},
	{ path: '', redirectTo: 'knot', pathMatch: 'full' },
];

export default routes;