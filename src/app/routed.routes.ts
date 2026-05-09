import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

const primaryRoutes: Routes = [
  // Primary outlet routes (right panel - canvas scenes)
  {
    path: 'intro',
    loadComponent: () => import('./page/public/intro'),
  },
  {
    path: 'knot',
    loadComponent: () => import('./scene/knot'),
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
    loadComponent: () => import('./page/character/character-setup'),
    canActivate: [authGuard],
  },
  {
    path: 'character-list',
    loadComponent: () => import('./page/character/character-list'),
    canActivate: [authGuard],
  },
  {
    path: 'game-join',
    loadComponent: () => import('./page/game/game-join'),
    canActivate: [authGuard],
  },
  {
    path: 'ship-view-specs',
    loadComponent: () => import('./scene/ship-view-specs'),
    canActivate: [authGuard],
  },
  {
    path: 'opening-cold-boot',
    loadComponent: () => import('./scene/hud/cold-boot-hud-scene'),
    canActivate: [authGuard],
  },
];

const leftOutletRoutes: Routes = [
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
    loadComponent: () => import('./page/character/character-setup'),
    canActivate: [authGuard],
  },
  {
    path: 'character-list',
    outlet: 'left',
    loadComponent: () => import('./page/character/character-list'),
    canActivate: [authGuard],
  },
  {
    path: 'game-join',
    outlet: 'left',
    loadComponent: () => import('./page/game/game-join'),
    canActivate: [authGuard],
  },
  {
    path: 'opening-cold-boot',
    outlet: 'left',
    loadComponent: () => import('./page/opening/cold-boot'),
    canActivate: [authGuard],
  },
  {
    path: 'stellar-initiation',
    outlet: 'left',
    loadComponent: () => import('./page/game/stellar-initiation'),
    canActivate: [authGuard],
  },
  {
    path: 'character-profile',
    outlet: 'left',
    loadComponent: () => import('./page/game/character-profile'),
    canActivate: [authGuard],
  },
  {
    path: 'mission-board',
    outlet: 'left',
    loadComponent: () => import('./page/game/mission-board'),
    canActivate: [authGuard],
  },
  {
    path: 'ship-hangar',
    outlet: 'left',
    loadComponent: () => import('./page/game/ship-hangar'),
    canActivate: [authGuard],
  },
  {
    path: 'ship-view-inventory',
    outlet: 'left',
    loadComponent: () => import('./page/game/ship-view-inventory'),
    canActivate: [authGuard],
  },
  {
    path: 'repair-retrofit',
    outlet: 'left',
    loadComponent: () => import('./page/game/repair-retrofit'),
    canActivate: [authGuard],
  },
  {
    path: 'market-hub',
    outlet: 'left',
    loadComponent: () => import('./page/game/market-hub'),
    canActivate: [authGuard],
  },
  {
    path: 'fabrication-lab',
    outlet: 'left',
    loadComponent: () => import('./page/game/fabrication-lab'),
    canActivate: [authGuard],
  },
  {
    path: 'game-main',
    outlet: 'left',
    loadComponent: () => import('./page/game/game-main'),
    canActivate: [authGuard],
  },
  {
    path: 'logout',
    outlet: 'left',
    loadComponent: () => import('./page/game/logout'),
    canActivate: [authGuard],
  },
];

const rightOutletRoutes: Routes = [
  // Right panel – Angular page routes (replaces ngt-canvas when active)
  {
    path: 'ship-view-specs',
    outlet: 'right',
    loadComponent: () => import('./page/game/ship-view-specs'),
    canActivate: [authGuard],
  },
  {
    path: 'item-view-specs',
    outlet: 'right',
    loadComponent: () => import('./page/game/item-view-specs'),
    canActivate: [authGuard],
  },
  {
    path: 'opening-cold-boot-scan',
    outlet: 'right',
    loadComponent: () => import('./page/opening/cold-boot-scan'),
    canActivate: [authGuard],
  },
  {
    path: 'ship-exterior-view',
    outlet: 'right',
    loadComponent: () => import('./scene/ship-exterior-view'),
    canActivate: [authGuard],
  },
  {
    path: 'repair-retrofit-items',
    outlet: 'right',
    loadComponent: () => import('./page/game/repair-retrofit-items'),
    canActivate: [authGuard],
  },
  {
    path: 'repair-retrofit-ship-detail',
    outlet: 'right',
    loadComponent: () => import('./page/game/repair-retrofit-ship-detail'),
    canActivate: [authGuard],
  },
  {
    path: 'repair-retrofit-system-detail',
    outlet: 'right',
    loadComponent: () => import('./page/game/repair-retrofit-system-detail'),
    canActivate: [authGuard],
  },
  {
    path: 'repair-retrofit-item-detail',
    outlet: 'right',
    loadComponent: () => import('./page/game/repair-retrofit-item-detail'),
    canActivate: [authGuard],
  },
  {
    path: 'print-queue',
    outlet: 'right',
    loadComponent: () => import('./page/game/print-queue'),
    canActivate: [authGuard],
  },
];

const routes: Routes = [
  ...primaryRoutes,
  ...leftOutletRoutes,
  { path: '', redirectTo: '/knot(left:intro)', pathMatch: 'full' },
  ...rightOutletRoutes,
];

export default routes;
