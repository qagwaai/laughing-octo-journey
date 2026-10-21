# Console cleanup and vertical slider modernization

Date: 2026-10-19

## Scope

Reduce routine console noise during login and menu navigation, while retaining
actionable diagnostics. Replace deprecated vertical slider styling without
changing zoom bindings or application contracts.

## Changes

- Removed routine socket connection success and redundant connection-attempt
  messages from [SocketService](../src/app/services/socket.service.ts).
  Connection state updates, connection guards, disconnect diagnostics, and error
  logging remain unchanged.
- Removed ship-context activation dumps, including the diagnostic-only context
  summary builder, from the
  [ship exterior component](../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts).
- Removed normal cold-boot debris and asteroid-seeding messages from the
  [debris controller](../src/app/scene/ship-exterior/floating-debris-controller.ts)
  and [bootstrap controller](../src/app/scene/ship-exterior/ship-exterior-bootstrap-controller.ts).
- Removed local celestial-body sweep completion and duplicate-request
  coalescing messages. Request coalescing and sweep behavior remain intact;
  missing-context and unsuccessful-response warnings remain enabled.
- Replaced `appearance: slider-vertical`, its prefixed equivalent, and the
  obsolete `writing-mode: bt-lr` with `writing-mode: vertical-lr` and
  `direction: rtl` in the
  [system viewer](../src/app/page/game/viewer-scene.css) and
  [planet viewer](../src/app/page/game/planet-view.css).
  Existing dimensions remain unchanged, with higher values at the top.
- Removed console-message-based socket readiness waits from the Italian-locale
  [viewer list](../e2e/tests/viewer-list.spec.ts) and
  [scene rendering](../e2e/tests/viewer-scene-rendering.spec.ts) tests.
  Both continue to await the authoritative `SocketIOMock.connected` signal.
- Added socket connection-guard assertions and browser regression coverage for
  both vertical slider styles.

## Validation

Commands were run during this session; results are not claims of a full-suite
pass.

| Command                                                                                                                                                                                                                                                                                                                                                        | Result                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:spec -- src\app\services\socket.service.vitest.ts src\app\scene\ship-exterior\floating-debris-controller.vitest.ts src\app\scene\ship-exterior\ship-exterior-bootstrap-controller.vitest.ts src\app\scene\ship-exterior\ship-exterior-bare-scene-test-api.vitest.ts`                                                                             | Passed: 4 files, 79 tests.                                                                                                                                                    |
| `npm run build`                                                                                                                                                                                                                                                                                                                                                | Passed, including the E2E partition prebuild gate and Angular template compilation. Run after the initial logging cleanup, before the slider CSS and final sweep-log removal. |
| `npx eslint src\app\services\socket.service.ts src\app\services\socket.service.vitest.ts src\app\scene\ship-exterior\floating-debris-controller.ts src\app\scene\ship-exterior\ship-exterior-bootstrap-controller.ts src\app\scene\ship-exterior\ship-exterior-bare-scene.component.ts e2e\tests\viewer-list.spec.ts e2e\tests\viewer-scene-rendering.spec.ts` | Passed after the initial logging cleanup.                                                                                                                                     |
| `npx playwright test 'viewer-(list                                                                                                                                                                                                                                                                                                                             | scene-rendering)\.spec\.ts' --grep 'Italian locale' --reporter=line`                                                                                                          | Passed: both locale flows and authentication setup, 3 tests total. |
| `npx prettier --check src\app\page\game\viewer-scene.css src\app\page\game\planet-view.css`                                                                                                                                                                                                                                                                    | Passed.                                                                                                                                                                       |
| `npx playwright test 'planet-view-zoom\.spec\.ts' --grep 'standard vertical slider' --workers=1 --reporter=line`                                                                                                                                                                                                                                               | Passed with the final isolated-control tests: both sliders and authentication setup, 3 tests total.                                                                           |
| `npx eslint e2e\tests\planet-view-zoom.spec.ts`                                                                                                                                                                                                                                                                                                                | Passed with the final slider tests.                                                                                                                                           |
| `npm run test:spec -- src\app\scene\ship-exterior\ship-exterior-bootstrap-controller.vitest.ts`                                                                                                                                                                                                                                                                | Passed after removing the final sweep messages: 15 tests.                                                                                                                     |
| `git --no-pager diff --check`                                                                                                                                                                                                                                                                                                                                  | Passed for the code changes before this documentation addition.                                                                                                               |

The final slider tests load the actual production CSS into isolated native range
controls. They verify vertical geometry, computed writing mode and direction,
Home/End and arrow-key values, dragging toward both ends, and absence of
`slider-vertical` console messages.

Initial full-scene slider tests timed out in the animated WebGL views, including
a serial retry and an animation-clock attempt. The full planet zoom spec run
was stopped after timeouts; it did not pass. The final isolated-control tests
avoid rendering load but do not establish full 3D-flow regression coverage.
An initial Playwright invocation using backslash-separated file selectors also
matched no tests; the regex-selector invocation above passed.

During the connected Chrome walkthrough, no new vertical slider deprecation
messages were observed after the CSS update. At the end of the walkthrough,
the user reported no further console messages of concern.

## Intentionally unresolved observations

- Angular `NG0955` reported duplicate key `sol-sun` at indexes 0 and 1 in the
  solar-system details table. This warning remains unsuppressed.
  The [details facade](../src/app/page/game/solar-system-details-facade.ts)
  concatenates `response.stars` and `response.bodies`; overlapping entries could
  produce the duplicate. Backend Forge ownership is suspected, not confirmed.
  Inspect the actual response and authoritative OpenAPI semantics before
  assigning the fix. No deduplication or index-based tracking workaround was
  added.
- Chrome's password autocomplete notice was observed separately and was not
  changed.
- Standard Vite and Angular development-mode messages were not suppressed.

## Suggested commit

`fix: reduce console noise and modernize vertical zoom sliders`

No commit or push was performed as part of this documentation step.
