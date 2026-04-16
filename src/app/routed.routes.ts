import { Routes } from '@angular/router';

const routes: Routes = [
	// Primary outlet routes (right panel - canvas content)
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
	{
		path: 'registration',
		loadComponent: () => import('./page/registration'),
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
	{
		path: 'intro',
		outlet: 'left',
		loadComponent: () => import('./page/intro'),
	},
	{
		path: 'registration',
		outlet: 'left',
		loadComponent: () => import('./page/registration'),
	},
	{ path: '', redirectTo: '/knot(left:intro)', pathMatch: 'full' },
];

export default routes;