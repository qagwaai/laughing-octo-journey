# Testronaut UI Testing Assessment

**Research date:** 2026-10-27  
**Question:** Does the current UI architecture benefit from adding Testronaut component tests alongside Vitest and Playwright?

## Recommendation

**There is a conditional benefit, but this should be a small pilot rather than a new blanket test requirement.** The most useful gap is testing an isolated Angular component in a real browser: browser-rendered markup, accessible roles and names, actual DOM events, and component behavior without booting a full routed user journey.

The repository already has substantial Vitest coverage for models, services, components, and pages, plus Playwright end-to-end coverage. Testronaut would therefore complement existing tests only when it verifies browser-facing component behavior that is currently awkward to validate in Vitest or expensive to reach through a full E2E setup. It should not replace either existing layer or result in the same assertions being repeated at all three layers.

## What Testronaut provides

This assessment refers to the Angular component-testing tool documented at [testronaut.dev](https://testronaut.dev/), using `@testronaut/angular`. Its documented pattern uses a Playwright test and mounts an Angular component in the browser with `inPage(() => mount(Component))`. The test can then use normal Playwright locators and expectations.

Testronaut's documented Angular approach extracts browser-side code into a generated entry point and serves it using a configurable test server that runs through the application's build toolchain. This can exercise the component with the app's Angular build configuration rather than relying solely on a simulated DOM.

| Existing layer                        | What it is good at here                                                                             | What it does not primarily establish                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Vitest with Angular TestBed and jsdom | Fast logic, input/output behavior, service wiring, and focused component/page assertions            | Browser layout, real-browser event behavior, or browser rendering fidelity                       |
| Playwright E2E                        | Actual user journeys through routes, app services, socket fixtures, and rendered pages              | Cheap, isolated feedback for a component when route/auth/backend setup is unnecessary            |
| Testronaut component test             | Actual-browser interaction with a mounted component, using Playwright's locator and assertion style | Full routing, application workflow, or backend contract correctness unless deliberately included |

This is not a new browser engine or a replacement for Playwright. It is a component-isolation approach built on Playwright and can occupy the space between the current jsdom tests and full-app E2E tests.

## Fit with this repository

### Good architectural fit

- The application uses Angular standalone components and Angular CLI builds, which align with the Angular component mount approach shown in Testronaut's documentation.
- Playwright is already installed and used by the E2E suite. The team would reuse familiar browser locators and assertions rather than adopt an unrelated browser automation API.
- Many component and page tests already use Angular TestBed in Vitest. This provides existing examples for supplying mock services and component dependencies when mounting a component in isolation.
- The app has independently testable UI pieces, including overlays, controls, badges, and forms. Those are more natural candidates than full gameplay scenes or routes.

### Integration work and compatibility risks

- There is no Testronaut dependency or test configuration in the repository today.
- The existing Playwright configuration starts `npm start`, and the Angular `serve` target uses the repository-specific `tools/strict-dev-server` wrapper. Testronaut's documented Angular setup uses a test-server command and generated test entry point. A separate Testronaut Playwright configuration and Angular serve/build configuration will likely be needed; the stock example should not be assumed to work unchanged with this custom server.
- Component isolation still requires correct Angular providers, imports, and test doubles. Components tightly coupled to socket lifecycle, application routing, global state, or 3D rendering may need substantial setup and may not be good pilot candidates.
- The application includes Angular Three and WebGL-heavy UI. A browser component harness may add little for scenes whose important behavior already depends on the full rendering/runtime setup; retain focused E2E or scene-specific tests for those cases.
- The Testronaut pages reviewed advertise Angular support but do not state a tested Angular 21 compatibility matrix. Compatibility with this repository's Angular 21 toolchain, custom serve builder, and test setup must be established experimentally.
- Browser component tests add browser startup and maintenance cost. If the test merely repeats a behavior already covered clearly by a fast Vitest test and a stable E2E test, its marginal value is low.

## Where an additional component layer is valuable

Consider Testronaut when a failure or regression is about the browser-facing component itself, for example:

- Angular template bindings, conditional rendering, or input-to-view behavior that a class-level assertion does not prove.
- A user's click, keyboard interaction, focus behavior, or accessible role/name on a component.
- Browser-specific rendering or DOM behavior that jsdom does not model faithfully.
- A component interaction that is expensive to reach through login, routing, socket setup, or a long E2E journey, but can be mounted with a small set of explicit providers.

Do not add it just to increase test count. Keep pure business rules and state transitions in Vitest; keep user journeys, route integration, socket behavior, and application-wide rendering in Playwright E2E. A component test is most valuable when it catches a distinct class of UI regression or makes a high-value assertion materially faster and easier to diagnose.

## Suggested pilot

1. **Start with one conventional, non-WebGL component** that already has meaningful UI behavior and existing Vitest coverage. `OverlayCloseButton` is a possible candidate because its current Vitest tests assert its rendered label and click behavior with Angular TestBed; first check that the proposed browser assertions do not simply duplicate an existing E2E scenario.
2. **Use a separate Testronaut Playwright config and test-server target** so the current E2E setup remains unchanged. Confirm that the generated entry point is built and served correctly through the app's Angular configuration and `strict-dev-server` wrapper.
3. **Test only browser-specific value:** mount the component with explicit service/router doubles, interact through accessible Playwright locators, and assert visible/accessible outcomes and any browser behavior that jsdom cannot establish.
4. **Evaluate before expanding:** confirm compatibility with Angular 21, successful local/CI execution, acceptable runtime and flake behavior, and a clear test-maintenance advantage over the existing layers. If the setup is cumbersome or assertions overlap existing coverage, stop after the spike.

A successful pilot would justify adding a few targeted component tests for similarly isolated UI. It would not justify migrating existing Vitest tests wholesale or duplicating the full E2E suite at component scope.

## Sources and repository references

### Testronaut documentation

- [Testronaut home](https://testronaut.dev/) — describes real-browser testing powered by Playwright and Angular as the initial framework focus.
- [Getting started with Angular](https://testronaut.dev/docs/getting-started/angular/) — demonstrates mounting an Angular component and interacting with it using Playwright.
- [How it works](https://testronaut.dev/docs/how-it-works/) — describes extracted browser code, the generated entry point, and the configurable test server.
- [Why Testronaut](https://testronaut.dev/docs/why-testronaut/) — explains the intended distinction between full-page E2E and isolated component tests.
- Pages accessed on 2026-10-27.

### Repository evidence

- [package.json](../package.json) — Angular 21, `@playwright/test`, Vitest scripts, and no existing Testronaut dependency.
- [vitest.config.mts](../vitest.config.mts) — Vitest runs with jsdom and the Angular Vite plugin.
- [playwright.config.ts](../playwright.config.ts) — Playwright E2E projects, browser settings, and the `npm start` web server.
- [angular.json](../angular.json) — Angular application build and custom serve target.
- [tools/strict-dev-server/index.js](../tools/strict-dev-server/index.js) — wrapper around Angular's dev-server builder.
- [docs/testing-policy.md](./testing-policy.md) — existing testing layers and guidance for balancing component/page integration with E2E.
- [src/app/component/overlay-close-button.vitest.ts](../src/app/component/overlay-close-button.vitest.ts) — example of an Angular component fixture and DOM interaction under Vitest.
- [e2e/tests/market-hub-by-location.spec.ts](../e2e/tests/market-hub-by-location.spec.ts) — example of Playwright tests covering a routed app flow and user-visible outcomes.

## Scope note

The assessment is about Testronaut's Playwright-based Angular component-testing project at `testronaut.dev`. A similarly named site at `docs.testronaut.app` describes an AI-driven browser-mission tool and is not the component-testing product assessed here.
