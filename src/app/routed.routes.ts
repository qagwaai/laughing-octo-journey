import { Routes } from '@angular/router';

const routes: Routes = [
	// Primary outlet routes (right panel - canvas content)
	{
		path: 'intro',
		outlet: 'right',
		loadComponent: () => import('./page/intro'),
	},
	{
		path: 'knot',
		outlet: 'right',
		loadComponent: () => import('./scene/knot'),
	},
	{
		path: 'scene-graph',
		outlet: 'right',
		loadComponent: () => import('./scene/scene-graph'),
	},
	// Auxiliary outlet routes (left panel)
	{
		path: 'controls',
		outlet: 'left',
		loadComponent: () => import('./page/intro'),
	},
	{
		path: 'menu',
		outlet: 'left',
		loadComponent: () => import('./page/intro'),
	},
	{ path: '', redirectTo: 'intro', pathMatch: 'full' },
];

export default routes;