import { Router } from '@angular/router';

export function resolveNavigationState<T extends object>(router: Router): T {
  return (
    (router.getCurrentNavigation()?.extras.state as T | undefined) ??
    (history.state as T | undefined) ??
    ({} as T)
  );
}
