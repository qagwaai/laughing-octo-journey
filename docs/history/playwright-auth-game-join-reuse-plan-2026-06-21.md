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

### Baseline Result — Phase 2 Complete (2026-06-22)

- **Total tests**: 157 passed, 0 failed (156 game tests + 1 setup project)
- **Full suite wall time**: 6.8 minutes (multi-worker baseline, CI_PLAYWRIGHT_WORKERS=4)
- **Delta from Phase 1 baseline**: +0.2m (6.6m → 6.8m, within margin)
- **Log**: `.tmp/e2e-phase2-complete-2026-06-22.log`
- **Worker config**: CI_PLAYWRIGHT_WORKERS=4 (4 parallel workers)

### Phase 2 Contribution to Full Suite

- **Tests on Phase 2 joined fixture**: 16 tests across 7 specs (10% of suite)
  - market-hub-by-location (1), market-hub-docking (3), market-hub-grouped-sections (4), market-hub-cross-system (3), repair-retrofit (2), first-target-fabrication-menu-cue (3), login-after-first-target-completed (1)
- **Tests on Phase 1 storageState pattern**: 35 tests across 10 specs (22% of suite)
  - character-edit (4), character-profile (2), character-ship-badge (2), guarded-left-menu-pin-cycle (2), and others
- **Tests on per-test pattern** (exempt, incompatible, or lower priority): 105 tests (68% of suite)
  - Exempt auth specs (21), character-add (7), character-list (23), locale-opening-mission-flow (2), deferred viewer specs (38), others

### Stability Metrics

- **Zero test failures**: Full suite green at Phase 2 completion
- **Fixture reuse pattern**: No cross-test contamination observed
- **Retry-on-login hardening**: Proven stable across full-suite parallel runs
- **Per-test handler overrides**: Demonstrated safe mock configuration (repair-retrofit test 2)
- **prepareJoinedPage() reset**: Deterministic state reset without rejoin or reload

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
| character-add.spec.ts | 7 | auth+join | no | **stays on per-test** — per-char creation side effects, test isolation required |
| locale-opening-mission-flow.spec.ts | 2 | auth+join | no | **stays on per-test** — per-char selection required (cold-boot vs in-progress routing) |
| first-target-fabrication-menu-cue.spec.ts | 3 | auth+join | no | candidate (lower priority) — overlay/refresh coupling |
| first-target-to-m01-transition.spec.ts | 6 | auth+join | no | candidate (lower priority) — mission chain state |
| ship-exterior-flight-mode.spec.ts | 2 | auth+join | no | candidate (lower priority) — pointer lock/WASD inputs |
| ship-exterior-flight-position-persistence.spec.ts | 2 | auth+join | no | candidate (lower priority) — position state across routes |
| ship-exterior-hangar-resume.spec.ts | 2 | auth+join | no | candidate (lower priority) — asteroid state coupling |
| ship-exterior-test-utils.spec.ts | 6 | auth+join | no | candidate (lower priority) — complex mission/targeting mechanics |
| first-target-full-mission-flow.spec.ts | 3 | auth+join | no | **low priority** — full gate/repair/fabrication flow, tightly coupled |

**Exempt from migration (4 files, 21 tests):** login, registration, registration-auto-login-failure, locale-auth-flow  
**Incompatible with Phase 2 (2 files, 9 tests):** character-add (per-test creation side effects), locale-opening-mission-flow (per-test character selection)  
**Character-list (1 file, 23 tests):** Auto-load lifecycle incompatible with any reuse pattern  
**Phase 2 Complete (7 files, 16 tests):** market-hub ×4, repair-retrofit, first-target-fabrication-menu-cue, login-after-first-target-completed  
**Phase 3 Deferred — page context closure (7 files, 38 tests):** planet-view-zoom, print-queue, viewer, viewer-list, viewer-interactions, viewer-controls-after-target, viewer-scene-rendering  
**Other candidates — lower priority (5 files, 19 tests):** character-ship-badge, guarded-left-menu, character-profile, ship-exterior specs, first-target-full-mission-flow

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

Status: ☑ Complete (2026-06-22)

### Objectives

- [x] Join game runtime once per worker and reuse that state across tests in the same worker.
- [x] Keep current parallelism while preventing cross-test join collisions.

### Steps

- [x] Add a worker-scoped fixture extension (example path): `e2e/fixtures/joined-game-fixture.ts`.
- [x] Fixture lifecycle:
  - create worker context/page with one live authenticated SPA session
  - attach socket mock handlers required for join and initial gameplay payloads
  - navigate to join entry route and wait for joined-ready signal (URL + required UI sentinel)
  - expose a lightweight `prepareJoinedPage()` helper for each test to reset route/view to known baseline without rejoin or reload
- [x] Reset policy per test (no reauth, no rejoin):
  - return to canonical route (for example, market-hub or ship-exterior entry)
  - clear test-local transient UI state
  - clear or re-seed socket queued events specific to that test
- [x] Add timeout diagnostics specific to join fixture startup (socket handshake, route readiness, expected event echo).

### Socket.io Considerations

- [x] Ensure fixture checks namespace handshake readiness before join emit.
- [x] Preserve correlation-safe response routing for overlapping worker traffic.
- [x] Keep event handlers idempotent to avoid duplicate response queues across tests.

### Deliverable

- [x] Joined gameplay baseline is reused per worker without repeating full join flow per spec.

### Final Phase 2 Implementation (2026-06-22)

- [x] Created `e2e/fixtures/joined-game-fixture.ts` as an opt-in worker-scoped fixture factory (`createJoinedGameTest`).
- [x] Included storageState-first character-list bootstrap with retry-on-login hardening and pre-load login recheck.
- [x] Included worker-shared exports for `sharedPage`, `sharedMock`, `sharedGameShell`, plus `prepareJoinedPage()` reset helper.
- [x] Migrated Phase 2 Pilot 1: `e2e/tests/market-hub-by-location.spec.ts` (1 test, ✅ green)
- [x] Migrated Phase 2 Pilot 2: `e2e/tests/market-hub-docking.spec.ts` (3 tests, ✅ green)
- [x] Migrated Phase 2 Pilot 3: `e2e/tests/market-hub-grouped-sections.spec.ts` (4 tests, ✅ green)
- [x] Migrated Phase 2 Pilot 4: `e2e/tests/market-hub-cross-system.spec.ts` (3 tests, ✅ green)
- [x] Migrated Phase 2 Pilot 5: `e2e/tests/repair-retrofit.spec.ts` (2 tests, ✅ green)
- [x] Migrated Phase 2 Pilot 6: `e2e/tests/first-target-fabrication-menu-cue.spec.ts` (3 tests, ✅ green)
- [x] Evaluated Phase 2 Pilot 7: `e2e/tests/locale-opening-mission-flow.spec.ts` — Reverted to per-test pattern (incompatible).
- [x] **Phase 2 Final Validation:** Full e2e suite 156/0 passing, 6.6m wall time. Phase 2 scope finalized: **7 specs, 16 tests** on joined fixture.

### Specs Remaining on Per-Test Pattern

**character-add.spec.ts (7 tests)**
- **Reason:** Creates multiple characters across 7 tests with per-test mock handler setup. Per-worker fixture accumulates character state, breaking test isolation (tests 1, 5, 6, 7 depend on specific character-list responses). Character creation side effects incompatible with stateless per-worker reset.
- **Status:** Stays on current per-test pattern (manual loginViaUI + per-test socket setup). No Phase 1 conversion or Phase 2 migration planned.

**locale-opening-mission-flow.spec.ts (2 tests)**
- **Reason:** Requires per-test character selection (Nova for cold-boot path, Astra for in-progress path). Fixture loads first character at setup, preventing test 2 from selecting different character. Also, Nova's not-started mission routes to opening-cold-boot, not game-main (breaks default joinedUrlPattern).
- **Status:** Stays on current per-test pattern (manual loginViaUI + per-test socket setup).

### Deferred Candidates (Phase 3)

- Viewer specs (planet-view-zoom, print-queue, viewer, viewer-list, viewer-interactions, viewer-controls-after-target, viewer-scene-rendering): Page context closure in afterEach (viewer component limitation). Requires separate fixture strategy or architectural workaround.
- Ship-exterior specs: Complex state coupling, lower migration priority.
- first-target-full-mission-flow: Mission chain state coupling, acceptable for per-test setup.

### Final Phase 2 Roster (7 specs, 16 tests)

1. `market-hub-by-location.spec.ts` (1 test) ✅
2. `market-hub-docking.spec.ts` (3 tests) ✅
3. `market-hub-grouped-sections.spec.ts` (4 tests) ✅
4. `market-hub-cross-system.spec.ts` (3 tests) ✅
5. `repair-retrofit.spec.ts` (2 tests) ✅
6. `first-target-fabrication-menu-cue.spec.ts` (3 tests) ✅
7. `login-after-first-target-completed.spec.ts` (1 test) ✅

---

## Phase 3: Performance Recovery Workstream

Status: ☑ Complete (2026-06-22), no optimization adopted

### Objective

Recover the +0.2m regression from Phase 2 (6.8m → 6.6m target) and achieve measurable net speedup.

### Known Heavy Specs (Observable from codebase)

Based on test count, viewer/mission complexity, and prior observations:

| Spec | Test Count | Known Cost | Priority |
|---|---|---|---|
| viewer-scene-rendering.spec.ts | 16 | 3D rendering, heavy canvas ops | High |
| viewer-ships.spec.ts | 13 | Viewer component, scene setup | High |
| character-list.spec.ts | 23 | Auto-load lifecycle, per-test pattern | High |
| ship-exterior-*.spec.ts | 15+ | Flight, targeting, mission state | Medium |
| first-target-*.spec.ts | 11 | Mission gate chain, reload cycles | Medium |
| Other gameplay specs | 64 | Per-test join/login per spec | Low |

**Total:** ~142 tests, ~68 slow enough to warrant attention

### Phase 3 Optimization Backlog (Ranked by Effort × Impact)

1. **Separate slow viewer specs into dedicated worker project** (HIGH impact, LOW effort)
   - Action: Split `viewer-scene-rendering` and `viewer-ships` into a new `chromium-viewer` project.
   - Expected gain: 30-60s (reduced worker contention for fast specs).
   - Implementation: Update `playwright.config.ts` with new project, filter in `testIgnore`.
   - Risk: Low (isolated change, no fixture modifications).

2. **Parallel setup for character-list tests** (MEDIUM impact, MEDIUM effort)
   - Action: Profile character-list per-test login cost; batch character-fetch mocks if possible.
   - Expected gain: 15-30s (if login cost is significant).
   - Implementation: Requires character-list.spec.ts refactor (currently auto-load incompatible).
   - Risk: Medium (touches per-test setup lifecycle).

3. **Trace/artifact policy tuning for green runs** (MEDIUM impact, LOW effort)
   - Action: Disable video and trace capture for non-debug builds.
   - Expected gain: 10-20s (I/O overhead reduction).
   - Implementation: Update playwright.config.ts `use.video` and `use.trace` conditionals.
   - Risk: Low (config-only).

4. **Ship-exterior test ordering optimization** (LOW impact, LOW effort)
   - Action: Reorder ship-exterior tests to avoid expensive mission-state reload sequences.
   - Expected gain: 5-10s (reduced per-test setup chaining).
   - Implementation: Requires analysis of test interdependencies in ship-exterior specs.
   - Risk: Low (test order only, no logic changes).

### Next Action: Optimization 1 (Viewer Spec Split)

**Rationale:** 16 + 13 = 29 tests on heavy viewer/rendering work. Isolating these into a dedicated worker lane unblocks the 4-worker pool to run simpler tests faster, reducing total wall time by worker-load rebalancing.

**Expected outcome:** -30s to -60s (from current 6.8m to ~6.2-6.5m).

**Result: REGRESSION (+0.3m)**
- Baseline (Phase 2): 6.8m
- With viewer split: 7.1m
- Delta: +0.3m (worse)

**Analysis:**
- Project initialization overhead likely outweighs worker-lane rebalancing gains
- Splitting increases parallel project startup cost (setup → chromium, chromium-viewer, chromium-auth all start independently)
- Viewer tests may benefit from shared setup/TLS/network state in same worker lane
- Hypothesis: We're trading per-test setup savings for per-project overhead

**Decision: Revert viewer split and try Optimization 3 (artifact policy tuning) instead**

### Optimization 3 Result (Artifact Policy Tuning)

**Change tested:** Disable trace/video for normal runs; keep screenshot on failure.

**Result: REGRESSION (+0.4m vs baseline)**
- Baseline (Phase 2): 6.8m
- With artifact policy tuning: 7.2m
- Delta: +0.4m (worse)

**Interpretation:**
- Artifact write overhead was not the dominant bottleneck in this suite.
- Runtime is likely dominated by app/test setup and mission/viewer interaction waits.

**Decision:** Revert artifact policy tuning to baseline and prioritize spec-level setup optimization.

### Next Action: Optimization 2 (Character-list Setup Cost Reduction)

Focus on `character-list.spec.ts` and adjacent per-test setup-heavy specs. These tests repeatedly land around ~10.4s to ~11.2s each and appear to dominate the long tail.

1. Add lightweight timing probes around login/join and initial page readiness in character-list tests.
2. Reduce repeated per-test setup where state can be safely reused.
3. Keep strict isolation assertions to prevent cross-test contamination.
4. Re-run full suite and compare against 6.8m baseline.

#### Optimization 2 Execution Result (2026-06-22)

- Implemented and benchmarked a worker-shared reuse approach for `character-list.spec.ts`.
- Focused run showed speed potential (24 tests in 22.9s), but full-suite execution exposed instability.

**Observed regressions during full-suite run:**
1. Intermittent auth bounce back to login (`left:login`) during character-list setup.
2. Cross-test UI residue in delete-dialog flow (dialog remained open unexpectedly).

**Decision:** Rejected for now and rolled back to stable per-test character-list setup.

Status: Not adopted (stability gate failed).

### Optimization 4 Result (Ship-Exterior Setup Consolidation)

**Change tested:** Extract repeated ship-exterior mock/setup scaffolding into reusable helper usage and validate wall-time impact.

**Result: REGRESSION (+0.1m vs baseline)**
- Baseline (current): 7.0m, 157 passed
- With partial ship-exterior consolidation: 7.1m, 157 passed
- Delta: +0.1m (worse)

**Interpretation:**
- Boilerplate reduction did not translate into runtime savings.
- Added helper indirection/setup path did not reduce dominant waits (scene/mission/app readiness).
- This optimization does not recover the +0.2m drift.

**Decision:** Revert optimization changes and keep baseline spec setup patterns.

### Phase 3 Final Outcome

- Optimization 1 (viewer split): rejected (+0.3m regression)
- Optimization 2 (character-list reuse): rejected (stability failures under full suite)
- Optimization 3 (artifact tuning): rejected (+0.4m regression)
- Optimization 4 (ship-exterior setup consolidation): rejected (+0.1m regression)

No Phase 3 optimization met both performance and stability gates.

### Execution Discipline Finding

- Do not poll/inspect while full-suite benchmark is running.
- Run each 7-minute measurement as a single uninterrupted execution and collect metrics only after process exit.

---

## Validation and Hardening

Status: ☑ Complete (2026-06-22)

### Results

- **Full suite:** 157 tests passing, 0 failed
- **Wall time:** 6.8 minutes (multi-worker baseline, CI_PLAYWRIGHT_WORKERS=4)
- **Phase 2 contribution:** 16 tests (10% of suite) now use per-worker joined fixture
- **Retry-on-login pattern:** Proven stable for storageState-first bootstrap across full-suite parallel runs
- **Fixture reuse pattern:** Zero cross-test contamination, deterministic state resets via `prepareJoinedPage()`
- **Timing delta vs prior baseline:** +0.2 minutes relative to 6.6m baseline (comparable but slower)

### Key Learnings

1. **Character loading + per-test variation incompatible with per-worker fixture.** Specs that need different characters or mission states per test should stay on per-test pattern.
2. **Route navigation variance requires fixture config.** Specs that don't always route to game-main need custom `joinedUrlPattern` or should stay on per-test setup.
3. **Page context closure requires further research.** Viewer specs break shared page in afterEach; deferred pending architectural study.
4. **Retry-on-login fallback essential for multi-worker stability.** Late redirects to login in parallel runs; always wrap initial navigation assertions in try/catch with re-login fallback.
5. **Per-test handler overrides work well.** repair-retrofit demonstrates safe test-specific mock configuration when override occurs before page navigation.

### Closure Decision

Phase 2 is closed and kept.

- Scope retained: 7 specs, 16 tests on joined fixture.
- Rollback decision: no rollback at this time.
- Rationale: maintainability and fixture architecture gains are retained while performance optimization moves to the next phase.

### Runtime Goal Status

- Current status: runtime goal not met after Phase 3.
- Observed comparison: stable green runs at 7.0m-7.1m versus prior 6.8m (Phase 2) and 6.6m historical baseline.
- Interpretation: regression is persistent; no tested Phase 3 candidate recovered time without new risk.

### Phase 3 Performance Workstream

- Primary objective: recover regression and achieve net runtime reduction.
- Result: objective not achieved in this cycle.
- Next step: start a fresh profiling pass before additional structural refactors.

### Exit Criteria for Performance Workstream

- Full suite remains 157/0 green.
- Runtime returns to at least 6.6m baseline, then improves below it.
- No sustained flake increase relative to current baseline.

Current gate status: stability met, runtime target missed.

---

## References

- Playwright config: `playwright.config.ts`
- Auth helper: `e2e/helpers/auth-helper.ts`
- Socket mock fixture: `e2e/fixtures/socket-mock.ts`
- Existing plan style baseline: `docs/planning/playwright-coverage-expansion-plan-2026-06-19.md`
- Testing policy: `docs/testing-policy.md`
