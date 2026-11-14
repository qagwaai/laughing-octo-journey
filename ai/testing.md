# Testing Architecture

## Overview

The project uses Vitest for unit/component/integration tests and Playwright for end-to-end tests. Jest is NOT used.

## Test Configuration

### Vitest (`vitest.config.mts`)

- Framework: Vitest 4.1.8 with `@analogjs/vitest-angular`
- TypeScript config: `tsconfig.spec.json`
- Test files: `**/*.vitest.ts` alongside source files
- Coverage: Enabled via `--coverage` flag

### Playwright (`playwright.config.ts`)

- Framework: Playwright 1.59.1
- Test files: `e2e/tests/*.spec.ts`
- Reporter: HTML (auto-opens on failure), line reporter for CLI
- Browsers: Configured via `npm run e2e:install`

## Running Tests

### Vitest (Unit/Component)

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:ci       # CI mode with coverage
npm run test:debug    # Debug mode
npm run test:spec -- src/app/page/game/market-hub.vitest.ts  # Single file
```

### Playwright (E2E)

```bash
npm run e2e                      # Run all specs
npm run e2e:ui                   # UI mode
npm run e2e:debug                # Debug mode
npx playwright test e2e/tests/market-hub-by-location.spec.ts --reporter=line  # Single spec
```

## E2E Test Structure

```
e2e/
  fixtures/
    socket-mock.ts    # SocketIOMock - intercepts socket events in browser
  helpers/
    auth-helper.ts    # Login helper for test authentication
  page-objects/
    # Page object models for each major page/scene
  tests/
    # Test specifications
```

## Socket Mocking

The `SocketIOMock` fixture (`e2e/fixtures/socket-mock.ts`) is critical for deterministic E2E tests:

- Intercepts socket emit/on in the browser context
- Allows scripted request-response simulation
- Prevents tests from depending on actual backend availability
- Used via Playwright's `addInitScript` to inject before page load

## Remembered Login Handle

Login and Register share the `auth.rememberedPlayerHandle` localStorage key through
[`remembered-player-handle.ts`](../src/app/model/remembered-player-handle.ts).
Login captures the checkbox choice and normalized handle at submission, then saves
or clears the handle only after a successful response. Failed responses must not
change the saved handle. Returning to Login prefills the saved handle, checks the
checkbox, and leaves the password empty.

Regression coverage:

- [`login.vitest.ts`](../src/app/page/public/login.vitest.ts): checkbox binding,
  save/clear only after success, submitted values retained while awaiting a response,
  failed-login preservation for both checkbox states, and prefill on return.
- [`login.spec.ts`](../e2e/tests/login.spec.ts): checkbox visibility/default state,
  remembered-handle prefill, checked state, empty password, and initial focus.
- [`registration.vitest.ts`](../src/app/page/public/registration.vitest.ts):
  existing registration behavior for the shared storage.

### Validation completed (2026-11-14)

- `npm run test:spec -- src\app\page\public\login.vitest.ts src\app\page\public\registration.vitest.ts`
  — passed, 51 tests.
- `npx eslint src\app\page\public\login.ts src\app\page\public\login.vitest.ts e2e\tests\login.spec.ts src\app\i18n\locales\en.ts src\app\i18n\locales\it.ts`
  — passed.
- `npm run build` — passed, including Angular template compilation.
- `npm run e2e:spec -- login.spec.ts --project=chromium-auth` — passed, 10 Chromium tests.
  Use the filename selector on Windows; a backslash-separated path was treated as
  a regular expression and matched no tests.
- Manual validation confirmed complete by the user.

## Test Policy (from `docs/testing-policy.md`)

- Coverage targets defined in policy document
- Prefer focused tests for changed behavior first, then broader suites
- Keep Playwright tests deterministic by mocking socket traffic
- Avoid brittle timing; use explicit waits on URL/state/locator expectations

## Type Checking

```bash
npm run typecheck              # TypeScript typecheck (TS files only)
npm run typecheck:templates    # Angular template typecheck (via build)
```

Important: `tsc --noEmit` does NOT catch Angular template errors. Use `npm run build` to validate template bindings.

## Linting & Formatting

```bash
npm run lint          # ESLint TypeScript
npm run lint:fix      # Auto-fix lint issues
npm run format:check  # HTML/CSS/JSON/Markdown formatting
npm run format:check:ts  # TS/JS formatting (broader scope)
```

## Test File Convention

- Vitest tests co-located with source: `component.ts` → `component.vitest.ts`
- E2E tests in `e2e/tests/` with descriptive names: `market-hub-by-location.spec.ts`
- Shadow specs used for components that need isolated test contexts
