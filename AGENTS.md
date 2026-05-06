# AI Project Guide (AGENTS)

This file is a quick, high-signal reference for AI assistants working in this repository.

## Project Snapshot

- Name: `ngt-template` (workspace folder: `laughing-octo-journey`)
- Stack: Angular standalone components + TypeScript + Angular Three
- Runtime: Browser SPA with left/right outlet routing patterns
- Real-time transport: `socket.io-client`
- Unit/component test runner: Karma + Jasmine
- End-to-end test runner: Playwright

## Critical Testing Note

- Jest is NOT used in this project.
- Do not add Jest configs, Jest APIs, or Jest-specific assumptions.
- For unit/component/integration tests, use Jasmine syntax and run through Angular/Karma.

## Common Commands

Install dependencies:

```bash
npm install
```

Run app locally:

```bash
npm start
```

Build app:

```bash
npm run build
```

Build in watch mode:

```bash
npm run watch
```

Run Angular/Karma tests once:

```bash
npm test
```

Run Angular/Karma tests in watch mode:

```bash
npm run test:watch
```

Run Angular/Karma tests with coverage (CI style):

```bash
npm run test:ci
```

Run Angular/Karma tests in debug mode:

```bash
npm run test:debug
```

Run all Playwright e2e tests:

```bash
npm run e2e
```

Run Playwright in UI mode:

```bash
npm run e2e:ui
```

Run Playwright in debug mode:

```bash
npm run e2e:debug
```

Open Playwright report:

```bash
npm run e2e:report
```

Install Playwright browsers:

```bash
npm run e2e:install
```

Run a single Angular spec file:

```bash
npm test -- --include="**/market-hub.spec.ts"
```

Run selected Playwright specs:

```bash
npx playwright test e2e/tests/market-hub-by-location.spec.ts e2e/tests/market-hub-docking.spec.ts
```

Run a single Playwright spec and exit cleanly (no persistent "Serving HTML report" server):

```bash
npx playwright test e2e/tests/market-hub-by-location.spec.ts --reporter=line
```

Alternative (keep HTML reporter configured but disable auto-open for this run):

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/tests/market-hub-by-location.spec.ts
```

## High-Value Code Areas

- App shell and route entry:
  - `src/app/routed.routes.ts`
  - `src/app/routed-scene.ts`
- Game pages and workflows:
  - `src/app/page/game/`
- Character/auth flows:
  - `src/app/page/character/`
  - `src/app/page/public/`
- Socket event contracts/types:
  - `src/app/model/`
  - `docs/server-message-contracts.md`
- Localization:
  - `src/app/i18n/locales/en.ts`
  - `src/app/i18n/locales/it.ts`

## E2E Test Utilities

- Socket mocking fixture:
  - `e2e/fixtures/socket-mock.ts`
- Login helper:
  - `e2e/helpers/auth-helper.ts`
- Page objects:
  - `e2e/page-objects/`
- Test specs:
  - `e2e/tests/`

## Test Strategy Guidance

- Prefer focused tests for changed behavior first, then run broader suites.
- Keep Playwright tests deterministic by mocking socket traffic via `SocketIOMock`.
- Avoid brittle timing; use explicit waits on URL/state/locator expectations.
- Use coverage target context from `docs/testing-policy.md`.

## Coding Guidance for AI Changes

- Preserve existing Angular standalone patterns and signal/computed usage.
- Keep socket event names and payload contracts aligned with `src/app/model/*` types.
- Update docs when message contracts change.
- When changing i18n-driven UI text, update both `en.ts` and `it.ts`.
- Prefer minimal, targeted edits over broad refactors.

## TypeScript vs Angular Template Errors

`npx tsc --noEmit` only checks `.ts` files — it will **not** catch errors in Angular HTML
templates (e.g. accessing a removed property in a `.html` binding).

To surface template errors without starting the dev server, run:

```bash
npm run build 2>&1 | grep -E "error TS|Error"
```

This invokes the Angular compiler (`ngc`) which validates both `.ts` and `.html` template
bindings. Always use this (not `tsc --noEmit`) after editing templates or changing types
that are referenced in templates.

## Validation Checklist for AI

After edits, run at least one of:

1. Focused impacted tests (fast feedback)
2. `npm run test:ci` for broader regression confidence
3. Relevant Playwright specs for user-flow changes

After editing **templates or types used in templates**, also run:

```bash
npm run build 2>&1 | grep -E "error TS|Error"
```

If changing socket contracts, validate both:

1. Type-level correctness in models/pages
2. Behavior-level correctness in unit/e2e tests
