import { Router } from '@angular/router';
import { resolveNavigationState } from './navigation-state';

describe('resolveNavigationState', () => {
  const originalHistoryState = history.state;

  afterEach(() => {
    history.replaceState(originalHistoryState ?? {}, '', location.href);
  });

  it('prefers current navigation extras state when available', () => {
    history.replaceState({ source: 'history' }, '', location.href);
    const router = {
      getCurrentNavigation: () => ({ extras: { state: { source: 'navigation', count: 1 } } }),
    } as unknown as Router;

    const resolved = resolveNavigationState<{ source: string; count?: number }>(router);

    expect(resolved).toEqual({ source: 'navigation', count: 1 });
  });

  it('falls back to history state when current navigation state is unavailable', () => {
    history.replaceState({ source: 'history', count: 2 }, '', location.href);
    const router = {
      getCurrentNavigation: () => undefined,
    } as unknown as Router;

    const resolved = resolveNavigationState<{ source: string; count?: number }>(router);

    expect(resolved).toEqual({ source: 'history', count: 2 });
  });

  it('returns an empty object when neither source provides data', () => {
    history.replaceState({}, '', location.href);
    const router = {
      getCurrentNavigation: () => undefined,
    } as unknown as Router;

    const resolved = resolveNavigationState<Record<string, unknown>>(router);

    expect(resolved).toEqual({});
  });
});