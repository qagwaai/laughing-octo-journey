import { describe, expect, it } from 'vitest';
import routes from './routed.routes';

describe('routed.routes', () => {
  it('redirects the empty path to the public intro entry point', () => {
    const rootRoute = routes.find((route) => route.path === '');

    expect(rootRoute).toEqual({
      path: '',
      redirectTo: '/intro(left:intro)',
      pathMatch: 'full',
    });
  });
});
