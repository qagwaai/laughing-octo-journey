import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import routes from './routed.routes';

@Component({ template: '' })
class RouteStub {}

describe('routed.routes', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('redirects the empty path directly to the splash with the public intro panel', () => {
    const rootRoute = routes.find((route) => route.path === '');

    expect(rootRoute).toEqual({
      path: '',
      redirectTo: expect.any(Function),
      pathMatch: 'full',
    });
  });
  it('preserves the splash selection and fragment on the root redirect', async () => {
    const rootRoute = routes.find((route) => route.path === '');
    if (!rootRoute) throw new Error('Missing root redirect.');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          rootRoute,
          { path: 'splash', component: RouteStub },
          { path: 'intro', outlet: 'left', component: RouteStub },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?splashPlanet=nova-splash-homeworld#preview');
    expect(router.url).toBe('/splash(left:intro)?splashPlanet=nova-splash-homeworld#preview');
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
