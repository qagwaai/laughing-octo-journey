# Plan: Vitest Migration (2026-06-11)

## Decisions
- Full migration replacing Karma/Jasmine for unit, component, and integration tests under `src/`.
- Use `@analogjs/vitest-angular` as the Angular test environment bridge.
- Rewrite spies/mocks to Vitest APIs (`vi.fn`, `vi.spyOn`) and remove Jasmine-specific constructs.
- Use V8 coverage via `@vitest/coverage-v8`.
- Enforce hard gates between phases; no phase advances without gate pass criteria.
- Give special attention to Angular Three components due to rendering/runtime complexity.

## Current Baseline
- Source specs: 133 under `src/`.
- Current passing tests: 1266.
- E2E specs: 32 Playwright specs remain unchanged.
- Coverage thresholds: statements 80, branches 75, functions 80, lines 85.

## Phases

### Phase 0: Baseline Capture and Gate 0
Objective: lock baseline quality and migration scope before tooling changes.

Actions:
- Capture baseline test count, pass count, and runtime from current Karma/Jasmine runs.
- Capture current coverage summary and verify threshold policy (80/75/80/85).
- Inventory spec categories: service/model, component/page, Angular Three-heavy, integration.
- Record known flaky tests and current skip/focus state; remove accidental focus markers.
- Save migration tracker checklist with per-spec ownership and status fields.

GATE 0 (Hard):
- Baseline metrics documented and committed in planning notes.
- Zero accidental focused tests (`fit`, `fdescribe`) in source.
- Scope confirmed: `src/` tests migrate; 32 e2e specs excluded.

### Phase 1: Scaffold Vitest Tooling and Gate 1
Objective: install and wire core Vitest toolchain without removing Karma yet.

Actions:
- Add packages:
  - `vitest`
  - `@analogjs/vitest-angular`
  - `@vitest/coverage-v8`
  - `jsdom`
- Create Vitest config (`vitest.config.ts`) with Angular plugin/preset, JSDOM environment, and coverage provider `v8`.
- Add scripts to `package.json`:
  - `test:vitest` (single run)
  - `test:vitest:watch`
  - `test:vitest:coverage`
- Keep existing Karma scripts active during transition.

GATE 1 (Hard):
- Dependencies install cleanly.
- Vitest command boots and discovers tests.
- Legacy Karma path still runnable (parallel migration window).

### Phase 2: Test Setup Foundation and Gate 2
Objective: establish stable Angular test runtime initialization.

Actions:
- Add `src/testing/vitest-setup.ts`.
- Initialize Angular testing integration with `zone.js/testing` as required.
- Configure deterministic `TestBed` lifecycle reset between tests to prevent cross-test contamination.
- Configure global test hygiene defaults (fake timers policy, cleanup hooks, clear/reset mocks where needed).
- Add a smoke spec proving TestBed + component compile + async path work under Vitest.

GATE 2 (Hard):
- Smoke test passes consistently on repeated runs.
- No global setup errors in Vitest bootstrap.
- TestBed reset behavior validated (no leakage in targeted check).

### Phase 3: Service/Model Migration Patterns and Gate 3
Objective: migrate low-risk specs first and establish repeatable rewrite rules.

Actions:
- Migrate service/model specs in batches using codemod + manual cleanup.
- Replace Jasmine APIs and matchers with Vitest equivalents.
- Standardize spy rewrite patterns:
  - `jasmine.createSpy` -> `vi.fn`
  - `spyOn(obj, 'm')` -> `vi.spyOn(obj, 'm')`
  - `and.returnValue(x)` -> `mockReturnValue(x)`
  - `and.callFake(fn)` -> `mockImplementation(fn)`
- Replace Jasmine clock usage with Vitest timers where applicable.
- Validate async expectations (`expect(...).resolves/rejects`, `await` discipline).

GATE 3 (Hard):
- All service/model specs migrated and green in Vitest.
- No remaining `jasmine.` API usage in migrated files.
- Test count parity maintained for migrated subset.

### Phase 4: Component/Page Migration and Gate 4
Objective: migrate Angular UI-heavy specs while preserving behavior.

Actions:
- Migrate standalone component/page specs in incremental feature batches.
- Verify `TestBed` imports/providers align with standalone patterns.
- Ensure DOM assertions use stable selectors and robust async waits.
- Replace brittle timing assumptions with deterministic flush/timer handling.
- Preserve i18n-sensitive assertions where applicable.

GATE 4 (Hard):
- Component/page suites pass in Vitest for migrated set.
- No regression in assertion intent (behavior parity review complete).
- Flake rate not worse than baseline for migrated suites.

### Phase 5: Angular Three High-Risk Handling and Gate 5
Objective: de-risk rendering and runtime constraints in Angular Three tests.

Actions:
- Identify Angular Three-dependent specs and classify by rendering depth.
- Introduce targeted mocks/fakes for WebGL/canvas/environment gaps in JSDOM.
- Prefer seam-level tests for scene logic when full render is unstable.
- Keep high-value behavior assertions (inputs, events, state transitions) over pixel-level checks.
- Add explicit notes for any test strategy shift caused by environment limitations.

GATE 5 (Hard):
- Angular Three-related specs are either migrated or explicitly triaged with approved mitigation.
- No silent test drops; every excluded case has a rationale and tracked follow-up.
- Critical scene behavior remains covered by passing tests.

### Phase 6: Integration Migration and Gate 6
Objective: migrate integration specs and resolve module graph fragility.

Actions:
- Migrate integration-level specs (multi-service/component orchestration).
- Audit for circular import exposure that may surface differently under Vitest module loading.
- Refactor imports where needed to break cycles and avoid side-effect initialization races.
- Validate mocking boundaries for HTTP, router, and socket interactions.

GATE 6 (Hard):
- Integration suite passes under Vitest.
- Circular import checks completed; no unresolved cycle-related failures.
- Runtime side-effect order issues addressed and documented.

### Phase 7: Coverage and CI Cutover, Remove Karma/Jasmine, Gate 7
Objective: make Vitest the default path in local/CI and retire legacy stack.

Actions:
- Switch CI/unit pipelines to Vitest commands.
- Enforce V8 coverage thresholds: 80/75/80/85.
- Remove Karma/Jasmine config and dependencies after Vitest parity is proven.
- Delete obsolete bootstrap files tied only to Karma/Jasmine.
- Ensure reports are generated in CI-friendly formats as required.

GATE 7 (Hard):
- CI green on Vitest-only unit pipeline.
- Coverage thresholds met or exceeded.
- Karma/Jasmine dependencies removed with no residual script references.

### Phase 8: Docs and Cleanup, Gate 8
Objective: complete migration with clear team guidance and maintenance safeguards.

Actions:
- Update contributor/testing docs to Vitest-first workflows.
- Add migration notes for common rewrite patterns and pitfalls.
- Remove stale comments, TODOs, and dead helper code from transition period.
- Confirm e2e scope remains unchanged (32 specs).
- Archive migration tracker as completed with final metrics.

GATE 8 (Hard):
- Documentation reflects final Vitest workflow.
- No deprecated Karma/Jasmine instructions remain.
- Final migration report signed off with baseline vs post-migration comparison.

## Key Files to Modify
- `package.json` (scripts, dependencies/devDependencies).
- `vitest.config.ts` (new Vitest configuration).
- `src/testing/vitest-setup.ts` (new global test setup).
- `tsconfig.spec.json` and/or test tsconfig wiring if needed for Vitest types.
- Legacy files targeted for removal at cutover:
  - `karma.conf.js`
  - Jasmine/Karma bootstrap references in test setup paths.
- CI workflow files that currently call Karma/Jasmine test scripts.
- Testing docs under `README.md` and `docs/` as part of final cleanup.

## Exclusions
- Playwright e2e suite (32 specs) is out of scope and remains unchanged.
- Backend/OpenAPI contract work is out of scope for this migration.
- Feature refactors unrelated to test runner migration are excluded unless required to resolve test environment incompatibility.

## API Cheatsheet

| Jasmine API / Pattern | Vitest API / Pattern | Notes |
|---|---|---|
| `jasmine.createSpy()` | `vi.fn()` | Base function spy/mock |
| `jasmine.createSpyObj('X', ['a'])` | `vi.mocked({ a: vi.fn() })` or typed object with `vi.fn()` | Prefer explicit typed mock objects |
| `spyOn(obj, 'm')` | `vi.spyOn(obj, 'm')` | Same intent |
| `.and.returnValue(v)` | `.mockReturnValue(v)` | Sync return |
| `.and.returnValues(a, b)` | `.mockReturnValueOnce(a).mockReturnValueOnce(b)` | Sequence returns |
| `.and.callFake(fn)` | `.mockImplementation(fn)` | Custom implementation |
| `.and.callThrough()` | default spy behavior or wrap with `mockImplementation` as needed | Use carefully with side effects |
| `spy.calls.count()` | `spy.mock.calls.length` | Call count |
| `spy.calls.argsFor(i)` | `spy.mock.calls[i]` | Call args by index |
| `expect(spy).toHaveBeenCalled()` | `expect(spy).toHaveBeenCalled()` | Same matcher |
| `expect(spy).toHaveBeenCalledWith(x)` | `expect(spy).toHaveBeenCalledWith(x)` | Same matcher |
| `expect(x).toEqual(y)` | `expect(x).toEqual(y)` | Same matcher |
| `expect(x).toBeTruthy()` | `expect(x).toBeTruthy()` | Same matcher |
| `jasmine.any(Type)` | `expect.any(Type)` | Asymmetric matcher |
| `jasmine.objectContaining({ a: 1 })` | `expect.objectContaining({ a: 1 })` | Partial object matcher |
| `jasmine.arrayContaining([x])` | `expect.arrayContaining([x])` | Partial array matcher |
| `done` callback style | async/await preferred; `await expect(p).resolves...` | Prefer promise-based tests |
| `jasmine.clock().install()` | `vi.useFakeTimers()` | Fake timers enable |
| `jasmine.clock().tick(ms)` | `vi.advanceTimersByTime(ms)` | Advance timers |
| `jasmine.clock().uninstall()` | `vi.useRealTimers()` | Restore real timers |
| global cleanup ad hoc | `afterEach(() => vi.restoreAllMocks())` | Recommended hygiene |
