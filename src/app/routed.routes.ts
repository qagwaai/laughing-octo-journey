import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import CharacterListPage from './page/character/character-list';
import CharacterSetupPage from './page/character/character-setup';
import CharacterProfilePage from './page/game/character-profile';
import MissionBoardPage from './page/game/mission-board';
import ShipViewSpecsPage from './page/game/ship-view-specs';
import ShipHangarPage from './page/game/ship-hangar';
import ShipViewInventoryPage from './page/game/ship-view-inventory';
import FabricationLabPage from './page/game/fabrication-lab';
import GameMainPage from './page/game/game-main';
import GameJoinPage from './page/game/game-join';
import LogoutPage from './page/game/logout';
import MarketHubPage from './page/game/market-hub';
import ColdBootScanPage from './page/opening/cold-boot-scan';
import RepairRetrofitPage from './page/game/repair-retrofit';
import StellarInitiationPage from './page/game/stellar-initiation';
import ColdBootScanScene from './scene/cold-boot-scan';
import ShipViewSpecs from './scene/ship-view-specs';
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
		path: 'ship-view-specs',
		component: ShipViewSpecs,
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
		path: 'mission-board',
		outlet: 'left',
		component: MissionBoardPage,
		canActivate: [authGuard],
	},
	{
		path: 'ship-hangar',
		outlet: 'left',
		component: ShipHangarPage,
		canActivate: [authGuard],
	},
	{
		path: 'ship-view-inventory',
		outlet: 'left',
		component: ShipViewInventoryPage,
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
		path: 'game-main',
		outlet: 'left',
		component: GameMainPage,
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
		path: 'ship-view-specs',
		outlet: 'right',
		component: ShipViewSpecsPage,
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