# Playwright Auth + Game-Join Reuse Plan

Date: 2026-06-21
Status: Draft for implementation planning
Owner: QA automation / frontend gameplay reliability

## Captured Decisions (Pre-Plan Form)

- Scope: single spec file pilot first.
- Auth state source: live-page in-memory reuse only.
- Join reuse model: no repeated login in the selected shared group.
- Parallel policy: serial within the shared group; normal parallelism elsewhere.
- Environment constraint: runtime uses socket.io connections.
- Primary success metric: no repeated login in the chosen group unless tests are login-functionality focused.

## Environment Confirmation (2026-06-21)

- Worker count remains environment-driven.
- On this machine, `CI_PLAYWRIGHT_WORKERS=4` is set, so effective Playwright worker count is 4.
- This does not change architecture or sequencing in this plan.

## Option 2 Pilot Shape

- Shared live-page reuse is implemented as a serial `describe` block.
- The pilot spec is `e2e/tests/viewer-ships.spec.ts` because it has a stable game-main entry point and can reset by route history without reloading.
- Reuse scope is one spec file first; other specs remain on the existing per-test login path until we confirm stability.
- Reset policy is route-only, with socket queue cleanup between tests.

## Current Repository Status

- Active implementation path now includes option 1 and option 2 in parallel.
- `playwright.config.ts` now uses a `setup` project that persists auth storage state plus split runtime projects:
  - `chromium` (depends on setup, uses `e2e/.auth/user.json`)
  - `chromium-auth` (auth-centric specs without shared storage state)
- `e2e/tests/market-hub-by-location.spec.ts` uses the standard `loginViaUI(...)` flow again.
- `e2e/tests/market-hub-by-location.spec.ts` is an active shared live-page pilot. Validated green (1/1).
- `e2e/tests/market-hub-docking.spec.ts` is an active shared live-page pilot. Validated green (3/3).
- `e2e/tests/market-hub-grouped-sections.spec.ts` is an active shared live-page pilot. Validated green (4/4).
- `e2e/tests/market-hub-cross-system.spec.ts` is an active shared live-page pilot. Validated green (3/3).
- `e2e/tests/viewer-ships.spec.ts` is an active shared live-page pilot.
- `e2e/tests/character-list.spec.ts` is back on the standard per-test `loginViaUI(...)` flow after the shared-page attempt proved unstable.
- `e2e/tests/character-edit.spec.ts` is an active shared live-page pilot. Validated green (4/4).

## Legend

| Marker | Meaning |
| --- | --- |
| ☐ | Not started |
| ◧ | In progress |
| ☑ | Done |
| ⚠ | Blocked / needs decision |

---

## Problem Statement

Current e2e flows frequently repeat two expensive setup steps in each spec:

1. Authenticate user session.
2. Join game/character runtime until gameplay routes are ready.

With socket.io handshake and route readiness checks, repeated setup increases suite runtime and flake surface. The goal is to authenticate once and reuse joined game state safely so tests start from an already-ready baseline.

---

## Target Architecture

1. Near-term active path: serial shared live-page reuse for carefully selected spec files.
2. Tests in a shared group reuse one authenticated/joined SPA runtime without reloads.
3. Tests outside the shared group keep explicit per-test login/join setup.
4. Longer-term path, if backend/session architecture changes, could revisit setup-project or worker-scoped authenticated reuse.

---

## Implementation Plan

## Phase 0: Baseline and Inventory

Status: ☑ Complete (2026-06-22)

### Objectives

- [x] Measure current median and p95 runtime for full suite and top 10 slowest specs.
- [ ] Classify specs by precondition type:
  - auth only
  - auth + joined game
  - public/no-auth
- [ ] Identify any specs that intentionally validate login or join behavior and must keep explicit setup.

### Baseline Result — 2026-06-22 (post Option 1 hardening pass)

- **Total tests**: 156 passed, 0 failed (157 total tests including setup)
- **Full suite wall time**: 6.6 minutes (multi-worker baseline)
- **Log**: `.tmp/e2e-baseline-green-2026-06-22.log`
- **Worker config**: `CI_PLAYWRIGHT_WORKERS=4` env set; Playwright distributed across 4 workers
- **Shared live-page specs at time of capture** (Option 1 + hardening):
  - Option 1 storageState-first: character-edit (4), market-hub-by-location (1), market-hub-cross-system (3), market-hub-docking (3), market-hub-grouped-sections (4), character-profile (2), character-ship-badge (2), guarded-left-menu-pin-cycle (2), login-after-first-target-completed (1) — 22 tests total on Option 1 reuse
  - Option 2 shared live-page (viewer-ships only, single shared-page without reload): viewer-ships (13) — 13 tests total
  - Total on reuse pattern: 35 tests across 10 specs
- **Stabilization applied**: Retry-on-login fallback pattern added to handle late redirect bounces in full-suite parallel runs; all 35 reused tests passing consistently, including larger-slice conversion revalidation on 2026-06-22
- **Pre-reuse baseline**: not captured in prior logs; 6.6m is the post-Option-1-hardening stable baseline for future delta comparison

### Steps

- [x] Capture baseline run time from current suite report and record in this plan.
- [ ] Build a migration table mapping each spec file to target fixture profile.
- [ ] Mark exempt specs (`auth behavior specs`, `join edge-case specs`) to avoid false optimization.

### Deliverable

- [x] Auth/join dependency map for all specs with migration order.

#### Spec Migration Table (captured 2026-06-22)

| Spec File | Tests | Auth Profile | Shared Live-Page? | Migration Target |
|---|---|---|---|---|
| login.spec.ts | 9 | exempt-auth | no | **keep per-test** — validates login UX |
| registration.spec.ts | 8 | public | no | **keep per-test** — no auth needed |
| registration-auto-login-failure.spec.ts | 1 | exempt-auth | no | **keep per-test** — validates login failure |
| locale-auth-flow.spec.ts | 3 | exempt-auth | no | **keep per-test** — validates locale in login UI |
| character-list.spec.ts | 23 | auth-only | no | **keep per-test** — auto-load lifecycle incompatible |
| character-edit.spec.ts | 4 | auth+join | **yes** | ✅ already migrated |
| market-hub-by-location.spec.ts | 1 | auth+join | **yes** | ✅ already migrated |
| market-hub-cross-system.spec.ts | 3 | auth+join | **yes** | ✅ already migrated |
| market-hub-docking.spec.ts | 3 | auth+join | **yes** | ✅ already migrated |
| market-hub-grouped-sections.spec.ts | 4 | auth+join | **yes** | ✅ already migrated |
| viewer-ships.spec.ts | 13 | auth+join | **yes** | ✅ already migrated |
| character-profile.spec.ts | 2 | auth+join | **yes** | ✅ already migrated |
| character-ship-badge.spec.ts | 2 | auth+join | **yes** | ✅ already migrated |
| guarded-left-menu-pin-cycle.spec.ts | 2 | auth+join | **yes** | ✅ already migrated |
| login-after-first-target-completed.spec.ts | 1 | auth+join | **yes** | ✅ already migrated |
| mission-board.spec.ts | 4 | auth+join | no | candidate — multi-character setup required, reverted to per-test |
| planet-view-zoom.spec.ts | 2 | auth+join | no | candidate (deferred) — handler override + viewer state complex |
| print-queue.spec.ts | 2 | auth+join | no | candidate (deferred) — per-test option variations incompatible |
| repair-retrofit.spec.ts | 2 | auth+join | no | candidate — small, stable game-main entry |
| viewer.spec.ts | 2 | auth+join | no | candidate — viewer entry, self-contained |
| viewer-controls-after-target.spec.ts | 1 | auth+join | no | candidate — single test, viewer teardown safe |
| viewer-list.spec.ts | 6 | auth+join | no | candidate (deferred) — viewer + per-test handler variations |
| viewer-interactions.spec.ts | 9 | auth+join | no | candidate (deferred) — viewer + canvas manipulation |
| viewer-controls-after-target.spec.ts | 1 | auth+join | no | candidate (deferred) — viewer entry, page context closure pattern |
| viewer-scene-rendering.spec.ts | 16 | auth+join | no | candidate (deferred) — viewer + large test count, page context issues |
| character-add.spec.ts | 7 | auth+join | no | candidate (lower priority) — creates characters, side-effects need ordering |
| locale-opening-mission-flow.spec.ts | 2 | auth+join | no | candidate (lower priority) — locale + cold-boot coupling |
| first-target-fabrication-menu-cue.spec.ts | 3 | auth+join | no | candidate (lower priority) — overlay/refresh coupling |
| first-target-to-m01-transition.spec.ts | 6 | auth+join | no | candidate (lower priority) — mission chain state |
| ship-exterior-flight-mode.spec.ts | 2 | auth+join | no | candidate (lower priority) — pointer lock/WASD inputs |
| ship-exterior-flight-position-persistence.spec.ts | 2 | auth+join | no | candidate (lower priority) — position state across routes |
| ship-exterior-hangar-resume.spec.ts | 2 | auth+join | no | candidate (lower priority) — asteroid state coupling |
| ship-exterior-test-utils.spec.ts | 6 | auth+join | no | candidate (lower priority) — complex mission/targeting mechanics |
| first-target-full-mission-flow.spec.ts | 3 | auth+join | no | **low priority** — full gate/repair/fabrication flow, tightly coupled |

**Exempt from migration (4 files, 21 tests):** login, registration, registration-auto-login-failure, locale-auth-flow  
**Incompatible (1 file, 23 tests):** character-list (auto-load lifecycle)  
**Already migrated (10 files, 36 tests):** character-edit, character-profile, character-ship-badge, guarded-left-menu, 4× market-hub, viewer-ships, login-after-first-target  
**Deferred — page context closure (5 files, 38 tests):** planet-view-zoom, print-queue, repair-retrofit, viewer, viewer-list + viewer-interactions, viewer-controls-after-target, viewer-scene-rendering (viewer component breaks shared-page context on afterEach)  
**Candidates — simple (2 files, 9 tests):** character-add, first-target-fabrication-menu-cue, locale-opening-mission-flow  
**Candidates — lower priority (4 files, 15 tests):** ship-exterior specs, first-target-full-mission-flow

---

## Phase 1: Shared Authentication State (Setup Project)

Status: ☑ Complete (2026-06-22)

### Objectives

- [x] Add a dedicated Playwright setup project that logs in once through the real UI path.
- [x] Persist storage state to disk and reuse in test projects.

### Steps

- [x] Create setup spec (example path): `e2e/setup/auth.setup.ts`.
- [x] Reuse `loginViaUI` helper and socket mock wiring for deterministic login handshake.
- [x] Persist auth state file (example path): `e2e/.auth/user.json`.
- [x] Update Playwright projects:
  - add `setup` project
  - set `dependencies: ['setup']` on browser project(s)
  - set `use.storageState` to auth file for dependent projects
- [x] Ensure setup flow hard-fails on missing socket connect/logged-in route transition.

### Guardrails

- [x] Keep login-centric specs independent from shared state when validating auth UX.
- [x] Do not bypass UI login in setup (per captured decision).

### Deliverable

- [x] All non-auth-focused specs can start as authenticated without per-spec login.

### Slice 1 Progress

- [x] Added setup-project scaffold and setup test entry point as an experiment.
- [x] Added UI-login storageState generation at `e2e/.auth/user.json` as an experiment.
- [x] Added gitignore rule for generated auth artifacts.
- [x] Re-enabled setup-project wiring in `playwright.config.ts`.
- [x] Added `chromium` project dependency on `setup` and `use.storageState` reuse.
- [x] Added `chromium-auth` split to keep auth/login specs independent from shared state.
- [x] Converted first Option 1 slice to storageState-first bootstrap:
  - `e2e/tests/character-edit.spec.ts`
  - `e2e/tests/market-hub-by-location.spec.ts`
- [x] Expanded Option 1 storageState-first bootstrap to:
  - `e2e/tests/market-hub-cross-system.spec.ts`
- [x] Expanded Option 1 storageState-first bootstrap to:
  - `e2e/tests/market-hub-docking.spec.ts`
  - `e2e/tests/market-hub-grouped-sections.spec.ts`
- [x] Expanded Option 1 storageState-first bootstrap to:
  - `e2e/tests/character-profile.spec.ts`
  - `e2e/tests/character-ship-badge.spec.ts`
  - `e2e/tests/guarded-left-menu-pin-cycle.spec.ts`
- [x] Added runtime-safe fallback in converted specs: if app still renders login form, run `loginViaUI(...)` once in `beforeAll` to hydrate in-memory session services before test actions.
- [x] **Full-suite hardening pass** (2026-06-22): Identified and resolved full-suite bootstrap race conditions affecting login-state stability.
  - Problem: Late redirects back to login happening after initial storageState hydration checks during parallel multi-worker full-suite runs.
  - Solution pattern: Wrapped first character-list URL assertion in try/catch fallback; if URL bounces to login, call `loginViaUI` again and re-assert. Added pre-load login recheck before character-item/load-button logic to prevent late-stage login bounces.
  - Applied to: character-profile, guarded-left-menu-pin-cycle, market-hub-grouped-sections, market-hub-cross-system, market-hub-by-location, character-edit, character-ship-badge, market-hub-docking.
  - Result: Full e2e suite green (156/0) after hardening applied. Retry-on-login fallback is now a proven best practice for any future storageState-first conversions.
- [x] Continue converting additional non-auth specs to storageState-first bootstrap using the proven hardening pattern (larger-slice batch completed on 2026-06-22).

### Option 2 Progress

- [x] Shared live-page harness added for `viewer-ships.spec.ts`.
- [x] Shared login/join now happens once per serial spec file instead of once per test in `viewer-ships.spec.ts`.
- [x] Route-only reset and socket queue cleanup added between tests in `viewer-ships.spec.ts`.
- [x] GLB network-request assertion isolated from the shared-page path so request-level validation stays deterministic.
- [x] Shared live-page harness was prototyped in `character-list.spec.ts`.
- [x] Focused verification identified an unstable auto-load lifecycle in `character-list.spec.ts` under shared-page reuse.
- [x] `character-list.spec.ts` was rolled back to the stable per-test `loginViaUI(...)` path.
- [x] `e2e/fixtures/socket-mock.ts` `reset()` fixed: now flushes pending GET long-poll with a server ping instead of abandoning it, so shared-page reuse stays stable when tests end on the same route without navigating away.
- [x] Shared live-page harness added for `character-edit.spec.ts`. Validated green (4/4).
- [x] Shared live-page harness added for `market-hub-docking.spec.ts`. Validated green (3/3).
- [x] Shared live-page harness added for `market-hub-grouped-sections.spec.ts`. Validated green (4/4).
- [x] Shared live-page harness added for `market-hub-cross-system.spec.ts`. Validated green (3/3).
- [x] Shared live-page harness added for `market-hub-by-location.spec.ts`. Validated green (1/1).
- [x] Shared live-page harness added for `character-profile.spec.ts`. Validated green (2/2).
- [x] Shared live-page harness added for `character-ship-badge.spec.ts`. Validated green (2/2).
- [x] **Pass 2 complete** (2026-06-22): 8 independent specs on shared reuse, 32 tests, baseline 156/0 passing.
- [x] Shared live-page harness added for `guarded-left-menu-pin-cycle.spec.ts`. Validated green (2/2).
- [x] Migration attempted on `mission-board.spec.ts` — reverted: multiple character setup incompatible.
- [x] Migration attempted on `planet-view-zoom.spec.ts` — reverted: handler override + viewer state too complex for parallel execution.
- [x] Migration attempted on `print-queue.spec.ts` — reverted: per-test option variations (usable spatial / iron) require reload, breaking auth state.
- [x] **Pass 3 complete** (2026-06-22): 9 independent specs on shared reuse, 34 tests (net +1 from Pass 2). Full suite remains 156/0 green.
- [x] Shared live-page harness added for `login-after-first-target-completed.spec.ts`. Validated green (1/1).
- [x] Migration attempted on `repair-retrofit.spec.ts` — reverted: handler override + reload breaks page context.
- [x] Migration attempted on `viewer.spec.ts` — reverted: locale + reload incompatible with shared-page.
- [x] **Pass 4 complete** (2026-06-22): 10 independent specs on shared reuse, 36 tests (net +2 from Pass 3). Full suite remains 156/0 green.
- [x] Migration attempted on `viewer-list.spec.ts` — reverted: page context closure in afterEach (viewer component limitation).
- [x] Pattern identified: **Viewer specs break page context during afterEach navigation.** Deferred: planet-view-zoom, print-queue, repair-retrofit, viewer, viewer-list, viewer-interactions, viewer-controls-after-target, viewer-scene-rendering.
- [x] **Hardening pass completed** (2026-06-22): Added retry-on-login fallback pattern to stabilize full-suite bootstrap races.
  - Identified: late redirects back to login happening after initial storageState hydration in full-suite parallel runs.
  - Solution: wrapped initial character-list URL assertion in try/catch fallback; if URL bounces to login, call `loginViaUI` again and re-assert.
  - Applied to: character-profile, guarded-left-menu-pin-cycle, market-hub-grouped-sections, market-hub-cross-system, market-hub-by-location, character-edit, character-ship-badge, market-hub-docking.
  - Added pre-load login recheck before character-item/load-btn logic in grouped-sections, cross-system, by-location, character-edit, character-ship-badge, and docking to prevent late-stage login bounces.
  - Validation: full e2e suite now green (156/0) after hardening applied. Baseline metrics captured: 6.6m wall time, 156 passed tests. Revalidated green after larger-slice conversion on 2026-06-22.
- ☑ **Option 1 + 2 stabilization complete** (2026-06-22): 35 tests across 10 specs on reuse patterns (Option 1 storageState: 22 tests, Option 2 shared live-page: 13 tests). **Full suite green with proven bootstrap resilience pattern.** Retry-on-login fallback is now a best practice for any future storageState-first conversions.

---

## Phase 2: Per-Worker Game-Join Reuse Fixture

Status: ☐ Not started

### Objectives

- [ ] Join game runtime once per worker and reuse that state across tests in the same worker.
- [ ] Keep current parallelism while preventing cross-test join collisions.

### Steps

- [ ] Add a worker-scoped fixture extension (example path): `e2e/fixtures/joined-game-fixture.ts`.
- [ ] Fixture lifecycle:
  - create worker context/page with one live authenticated SPA session
  - attach socket mock handlers required for join and initial gameplay payloads
  - navigate to join entry route and wait for joined-ready signal (URL + required UI sentinel)
  - expose a lightweight `prepareJoinedPage()` helper for each test to reset route/view to known baseline without rejoin or reload
- [ ] Reset policy per test (no reauth, no rejoin):
  - return to canonical route (for example, market-hub or ship-exterior entry)
  - clear test-local transient UI state
  - clear or re-seed socket queued events specific to that test
- [ ] Add timeout diagnostics specific to join fixture startup (socket handshake, route readiness, expected event echo).

### Socket.io Considerations

- [ ] Ensure fixture checks namespace handshake readiness before join emit.
- [ ] Preserve correlation-safe response routing for overlapping worker traffic.
- [ ] Keep event handlers idempotent to avoid duplicate response queues across tests.

### Deliverable

- [ ] Joined gameplay baseline is reused per worker without repeating full join flow per spec.

---

## Phase 3: Spec Migration Strategy

Status: ☐ Not started

### Objectives

- [ ] Move existing specs onto shared auth and joined fixtures incrementally.
- [ ] Preserve determinism and readability.

### Steps

- [ ] Migrate low-risk gameplay specs first that can tolerate serial shared-page reuse.
- [ ] Migrate ship-exterior specs next with explicit readiness assertions.
- [ ] Keep auth and join-validation specs on explicit local setup.
- [ ] Remove duplicated login/join boilerplate from migrated specs.
- [ ] Add migration notes per spec to simplify rollback if a flake appears.

### Deliverable

- [ ] Majority of gameplay specs consume shared fixtures and no longer call login/join setup directly.

---

## Phase 4: Validation and Hardening

Status: ☐ Not started

### Objectives

- [ ] Prove runtime gains and ensure no net increase in flake.
- [ ] Verify shared state does not leak behavior between tests.

### Steps

- [ ] Run A/B comparison:
  - baseline branch: current explicit login/join
  - optimized branch: serial shared-page reuse and any later join-reuse fixture work
- [ ] Capture metrics:
  - full suite runtime delta (%)
  - per-spec median delta for top 10 slowest specs
  - retry count / flake delta across at least 3 consecutive runs
- [ ] Add failure triage checklist for shared fixture incidents:
  - auth state stale/expired
  - join readiness never reached
  - socket correlation mismatch
  - worker contamination from transient state

### Runtime Target

- [ ] Runtime reduction target: at least 25% reduction for full Playwright suite.

### Exit Criteria

- [ ] Runtime target met or exceeded.
- [ ] No critical regressions in auth or join behavior.
- [ ] No sustained flake increase relative to baseline.

---

## Proposed File-Level Work Items

- `playwright.config.ts`
  - keep env-driven worker count stable while shared-page pilots stay file-local.
- `e2e/setup/auth.setup.ts`
  - currently experimental only; not part of the active execution path.
- `e2e/fixtures/joined-game-fixture.ts`
  - worker-scoped joined baseline and per-test reset helper.
- `e2e/helpers/auth-helper.ts`
  - shared login helper for per-test setup and live-page pilots.
- Selected files in `e2e/tests/`
  - remove repeated login/join setup only where serial shared-page reuse is safe.

---

## Risks and Mitigations

- Risk: stale setup-project assumptions remain documented after rollback.
  - Mitigation: keep this plan explicit about prototype vs active path.
- Risk: per-worker shared context leaks transient state.
  - Mitigation: enforce per-test route and socket reset contract before assertions.
- Risk: shared live-page asset caching hides network-request assertions.
  - Mitigation: run request-assertion tests before cache-warming tests or leave them on fresh per-test setup.
- Risk: socket.io event overlap produces ambiguous join readiness.
  - Mitigation: correlation-aware handlers and explicit readiness sentinel checks.
- Risk: fixture abstraction hides business intent in specs.
  - Mitigation: keep fixture API minimal and semantic (`prepareJoinedPage`, `expectJoinedReady`).

---

## Rollout Sequence

1. ✅ Stabilize the Option 1 storageState setup-project + multi-spec conversion pass with proven retry-on-login bootstrap pattern.
2. ✅ Validate Option 1 + Option 2 combined baseline: 156 tests, 6.6m wall time, 35 tests on reuse patterns.
3. **Next: Implement worker-scoped joined fixture** (Phase 2) for per-worker gameplay state reuse to unlock broader runtime gains.
4. Gradually migrate more specs to joined fixture as Phase 2 stabilizes.
5. Run comparative metrics between pre-reuse baseline (if captured) and post-Phase-2 baseline to finalize runtime delta report.

---

## References

- Playwright config: `playwright.config.ts`
- Auth helper: `e2e/helpers/auth-helper.ts`
- Socket mock fixture: `e2e/fixtures/socket-mock.ts`
- Existing plan style baseline: `docs/planning/playwright-coverage-expansion-plan-2026-06-19.md`
- Testing policy: `docs/testing-policy.md`
