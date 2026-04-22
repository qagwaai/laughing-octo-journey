import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import CharacterListPage from './page/character/character-list';
import CharacterSetupPage from './page/character/character-setup';
import CharacterProfilePage from './page/game/character-profile';
import DroneViewSpecsPage from './page/game/drone-view-specs';
import DroneHangarPage from './page/game/drone-hangar';
import FabricationLabPage from './page/game/fabrication-lab';
import GameJoinPage from './page/game/game-join';
import LogoutPage from './page/game/logout';
import MarketHubPage from './page/game/market-hub';
import ColdBootScanPage from './page/opening/cold-boot-scan';
import RepairRetrofitPage from './page/game/repair-retrofit';
import StellarInitiationPage from './page/game/stellar-initiation';
import DroneViewSpecs from './scene/drone-view-specs';
import ColdBootOpeningPage from './page/opening/cold-boot';
import ColdBootHudScene from './scene/hud/cold-boot-hud-scene';

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
	{
		path: 'opening-cold-boot',
		component: ColdBootHudScene,
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
	{
		path: 'opening-cold-boot',
		outlet: 'left',
		component: ColdBootOpeningPage,
		canActivate: [authGuard],
	},
	{
		path: 'stellar-initiation',
		outlet: 'left',
		component: StellarInitiationPage,
		canActivate: [authGuard],
	},
	{
		path: 'character-profile',
		outlet: 'left',
		component: CharacterProfilePage,
		canActivate: [authGuard],
	},
	{
		path: 'drone-hangar',
		outlet: 'left',
		component: DroneHangarPage,
		canActivate: [authGuard],
	},
	{
		path: 'repair-retrofit',
		outlet: 'left',
		component: RepairRetrofitPage,
		canActivate: [authGuard],
	},
	{
		path: 'market-hub',
		outlet: 'left',
		component: MarketHubPage,
		canActivate: [authGuard],
	},
	{
		path: 'fabrication-lab',
		outlet: 'left',
		component: FabricationLabPage,
		canActivate: [authGuard],
	},
	{
		path: 'logout',
		outlet: 'left',
		component: LogoutPage,
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
	{
		path: 'opening-cold-boot-scan',
		outlet: 'right',
		component: ColdBootScanPage,
		canActivate: [authGuard],
	},
];

export default routes;