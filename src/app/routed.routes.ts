import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import CharacterListPage from './page/character/character-list';
import CharacterSetupPage from './page/character/character-setup';
import DroneViewSpecsPage from './page/game/drone-view-specs';
import GameJoinPage from './page/game/game-join';
import DroneViewSpecs from './scene/drone-view-specs';

const routes: Routes = [
	// Primary outlet routes (right panel - canvas content)
	{
		path: 'intro',
		loadComponent: () => import('./page/public/intro'),
	},
	{
		path: 'knot',
		loadComponent: () => import('./scene/knot')
	},
	{
		path: 'scene-graph',
		loadComponent: () => import('./scene/scene-graph'),
		canActivate: [authGuard],
	},
	{
		path: 'registration',
		loadComponent: () => import('./page/public/registration'),
	},
	{
		path: 'login',
		loadComponent: () => import('./page/public/login'),
	},
	{
		path: 'character-setup',
		component: CharacterSetupPage,
		canActivate: [authGuard],
	},
	{
		path: 'character-list',
		component: CharacterListPage,
		canActivate: [authGuard],
	},
	{
		path: 'game-join',
		component: GameJoinPage,
		canActivate: [authGuard],
	},
	{
		path: 'drone-view-specs',
		component: DroneViewSpecs,
		canActivate: [authGuard],
	},
	// Auxiliary outlet routes (left panel)
	{
		path: 'controls',
		outlet: 'left',
		loadComponent: () => import('./page/public/intro'),
	},
	{
		path: 'menu',
		outlet: 'left',
		loadComponent: () => import('./page/public/intro'),
	},
	{
		path: 'intro',
		outlet: 'left',
		loadComponent: () => import('./page/public/intro'),
	},
	{
		path: 'registration',
		outlet: 'left',
		loadComponent: () => import('./page/public/registration'),
	},
	{
		path: 'login',
		outlet: 'left',
		loadComponent: () => import('./page/public/login'),
	},
	{
		path: 'character-setup',
		outlet: 'left',
		component: CharacterSetupPage,
		canActivate: [authGuard],
	},
	{
		path: 'character-list',
		outlet: 'left',
		component: CharacterListPage,
		canActivate: [authGuard],
	},
	{
		path: 'game-join',
		outlet: 'left',
		component: GameJoinPage,
		canActivate: [authGuard],
	},
	{ path: '', redirectTo: '/knot(left:intro)', pathMatch: 'full' },
	// Right panel – Angular page routes (replaces ngt-canvas when active)
	{
		path: 'drone-view-specs',
		outlet: 'right',
		component: DroneViewSpecsPage,
		canActivate: [authGuard],
	},
];

export default routes;