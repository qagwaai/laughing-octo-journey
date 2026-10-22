import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import routes from './routed.routes';

@Component({ template: '' })
class RouteStub {}

describe('routed.routes', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exposes Settings in the left outlet without requiring authentication', () => {
    const settingsRoutes = routes.filter((route) => route.path === 'settings');
    expect(settingsRoutes).toHaveLength(1);
    expect(settingsRoutes[0].outlet).toBe('left');
    expect(settingsRoutes[0].canActivate).toBeUndefined();
  });

  it('redirects the empty path to the public intro entry point', () => {
    const rootRoute = routes.find((route) => route.path === '');

    expect(rootRoute).toEqual({
      path: '',
      redirectTo: '/intro(left:intro)',
      pathMatch: 'full',
    });
  });
  it.each(['/knot', '/knot(left:intro//right:login)'])(
    'redirects %s without losing named outlets, query parameters, or fragment',
    async (path) => {
      const legacyRoute = routes.find((route) => route.path === 'knot');
      if (!legacyRoute) throw new Error('Missing legacy splash redirect.');
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            legacyRoute,
            { path: 'splash', component: RouteStub },
            { path: 'intro', outlet: 'left', component: RouteStub },
            { path: 'login', outlet: 'right', component: RouteStub },
          ]),
        ],
      });
      const router = TestBed.inject(Router);
      await router.navigateByUrl(`${path}?market=sol-mars-orbit&splashPlanet=sol-earth#preview`);
      expect(router.url).toBe(
        `${path.replace('/knot', '/splash')}?market=sol-mars-orbit&splashPlanet=sol-earth#preview`,
      );
    },
  );
});
