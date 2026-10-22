# Game settings and performance graphs (2026-10-22)

## Delivered behavior

- Added **Settings** immediately above **Logout** in the operations menu, using
  a gear icon instead of a two-letter abbreviation.
- Added a small, muted gear at the upper-right of the left pane on public pages,
  including intro, login, and registration. Authentication is not required.
- Settings opens only in the left outlet. Opening it does not replace or restart
  the current right-pane scene.
- Public Settings shows a **Back** button instead of the game menu and character
  badge. The button returns to the originating public URL, including its fragment.
  Direct logged-out visits to Settings return to login when Back is selected.
- Settings remains accessible when other operations-menu items are disabled,
  such as on the character list.
- Added the checkbox **Show 3d performance graphs**, with English and Italian text.
  This is a normal user feature, not a developer-only control.

## Setting lifetime

| Event                                 | Result                        |
| ------------------------------------- | ----------------------------- |
| Initial page load                     | Off                           |
| Enable or disable the checkbox        | Applied immediately           |
| Navigate between pages or scenes      | Preserve the choice           |
| Log in                                | Preserve the pre-login choice |
| Replace the authenticated session key | Preserve the choice           |
| Log out                               | Reset to off                  |
| Refresh the browser page              | Reset to off                  |

The preference is held only in memory. It is not saved to browser storage or sent
to the backend. Preserving the choice through login is the final behavior; it
supersedes the initial implementation that reset the setting at login.

## Implementation

- [Settings page](../src/app/page/game/settings.ts) uses the existing operations
  page styling and the left outlet's public `settings` route.
- [RenderStatsService](../src/app/services/render-stats.service.ts) owns shared
  reactive state. Its linked signal preserves the selected value when a session
  key becomes available and resets it when the session becomes unauthenticated.
- [AppComponent](../src/app/app.component.ts) exposes the public gear and binds
  graph visibility to the shared state. This replaces the old imperative DOM
  visibility updates and navigation timer.
- [Global graph styles](../src/styles.css) handle stats-gl nodes created outside
  Angular style encapsulation. Graphs do not intercept pointer input. When a
  nested scene supplies graphs, the background app-canvas graphs are hidden to
  avoid overlapping overlays.
- Coverage includes the main Angular Three canvas, solar-system viewer, planet
  closeups, station closeups, character bust previews, and the separate
  ship-exterior renderer. The ship-exterior FPS/CPU graphs are created on demand
  and disposed when disabled or when the component is destroyed.
- No dependencies or backend contracts were changed.

## Validation evidence

Commands below use PowerShell paths. Playwright selectors use filenames because
its CLI treats test arguments as regular expressions.

| Command                                                                                                                                                                                                                   | Result                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                                                                                                                                                           | Passed after public Settings access and template changes                                                               |
| `npm run test:spec -- src\app\app.component.vitest.ts src\app\page\game\settings.vitest.ts src\app\routed.routes.vitest.ts src\app\services\render-stats.service.vitest.ts src\app\component\guarded-left-menu.vitest.ts` | Passed: 39 tests before the final login-lifetime adjustment                                                            |
| `npm run test:spec -- src\app\services\render-stats.service.vitest.ts src\app\page\game\settings.vitest.ts`                                                                                                               | Passed: 5 tests after the final login-lifetime adjustment                                                              |
| `npm run typecheck`                                                                                                                                                                                                       | Passed after the final login-lifetime adjustment                                                                       |
| `npx playwright test viewer-settings.spec.ts --reporter=line --workers=1`                                                                                                                                                 | Public access, nested viewer, and ship-exterior cases passed; splash case timed out during scene loading               |
| `npx playwright test viewer-settings.spec.ts --grep 'without replacing the splash scene' --reporter=line --workers=1`                                                                                                     | Passed on isolated rerun, including auth setup                                                                         |
| `npx playwright test viewer-settings.spec.ts --grep 'preserves the graph setting through login' --reporter=line --workers=1`                                                                                              | Passed after the final adjustment, including auth setup; verifies pre-login choice survives login and resets on logout |
| `npx eslint src\app\services\render-stats.service.ts src\app\services\render-stats.service.vitest.ts e2e\tests\viewer-settings.spec.ts`                                                                                   | Passed after the final adjustment; other touched TypeScript files were linted earlier                                  |
| `git --no-pager diff --check`                                                                                                                                                                                             | Passed                                                                                                                 |

The full repository test suites were not run. An earlier attempt to run the
existing menu pin-cycle suite failed in its game-join bootstrap before reaching
Settings; that suite was left unchanged. Dedicated Settings browser tests use
mocked login and do not depend on that bootstrap.

## Session handoff

Implementation, tests, localization, and documentation are left in the working
tree for the user to review, commit, and push. No commit or push was performed.
