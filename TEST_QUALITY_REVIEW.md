# Test Coverage & Quality Review

_Date: 2026-05-07_  
_Scope: maintainability of automated tests across `src/app` and `e2e/`_  
_Method: full unit + e2e test runs, coverage extraction, per-spec inspection of imports/assertions/mocks._

---

## 1. Headline Numbers

| Metric | Value | Policy Floor | Status |
| --- | ---: | ---: | --- |
| Unit tests | **1199 / 1199 pass** | — | ✅ |
| Playwright e2e tests | **68 / 68 pass** (~29 s, 10 workers) | — | ✅ |
| Statements | 86.02 % (1594 / 1853) | 80 % | ✅ on instrumented set |
| Branches | **74.06 %** (657 / 887) | **75 %** | ⚠️ below floor |
| Functions | 84.12 % (355 / 422) | 80 % | ✅ |
| Lines | 87.20 % (1526 / 1750) | 85 % | ✅ |
| Spec LOC / Source LOC | 19 029 / 15 586 | — | ratio 1.22 (high) |

> **Caveat that dominates this review:** the coverage denominators above only count source files that are actually imported by a `.spec.ts`. Roughly **half of the production code in `page/`, `scene/`, and the `component/` THREE.js wrappers is never imported by any spec** (see §3) and is therefore silently excluded from the coverage report. The real, project-wide coverage is materially lower than 86 %.

---

## 2. Per-Folder Coverage (instrumented files only)

| Folder | Statements | Branches | Functions | Lines | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| [src/app/component](src/app/component) | 71.4 % | **51.0 %** | **53.8 %** | 76.4 % | 9 files instrumented; THREE wrappers under-tested |
| [src/app/guards](src/app/guards) | 100 % | 100 % | 100 % | 100 % | `auth.guard.ts` only |
| [src/app/i18n](src/app/i18n) | 54.5 % | **38.2 %** | 70 % | 54.5 % | `locale.ts` selector branches |
| [src/app/i18n/locales](src/app/i18n/locales) | 100 % | n/a | n/a | 100 % | static catalogs |
| [src/app/mission](src/app/mission) | 94.9 % | 79.0 % | 94.3 % | 95.0 % | strong |
| [src/app/model](src/app/model) | 96.7 % | 83.6 % | 100 % | 97.2 % | strongest tier |
| [src/app/page/game](src/app/page/game) | **9.1 %** | **7.7 %** | **16.7 %** | **10.5 %** | only `repair-retrofit-state.ts` instrumented (1 of ~14) |
| [src/app/services](src/app/services) | 88.1 % | 76.1 % | 88.8 % | 88.1 % | solid |

**Folders with effectively zero unit-coverage** (no source file imported by any spec, so absent from the report entirely):

- [src/app/page/character](src/app/page/character)
- [src/app/page/public](src/app/page/public)
- [src/app/page/opening](src/app/page/opening)
- [src/app/scene](src/app/scene) and [src/app/scene/hud](src/app/scene/hud)
- The 13 game-page components other than `repair-retrofit-state.ts`
- [src/app/app.component.ts](src/app/app.component.ts) and [src/app/routed-scene.ts](src/app/routed-scene.ts) (the specs that exist do `TestBed`-instantiate, so these may be partially instrumented — but absence from the report suggests not)

---

## 3. The "Shadow Spec" Anti-Pattern (highest-priority finding)

A grep across all spec files in `src/app/page/`, `src/app/scene/`, `src/app/services/`, and `src/app/component/` for an import of the matching production file finds **30 spec files that never import their subject under test (SUT)**. They begin with `export {};` and re-implement the component's behavior inline against fake `Signal`/`SocketService`/`SessionService` mocks.

Affected files (10 386 LOC — **≈55 % of all spec code**):

```
src/app/page/game/character-profile.spec.ts
src/app/page/game/fabrication-lab.spec.ts
src/app/page/game/game-join.spec.ts
src/app/page/game/game-main.spec.ts
src/app/page/game/item-view-specs.spec.ts
src/app/page/game/logout.spec.ts
src/app/page/game/market-hub.spec.ts          (972 LOC, 18 tests)
src/app/page/game/mission-board.spec.ts       (20 tests)
src/app/page/game/print-queue.spec.ts
src/app/page/game/repair-retrofit.spec.ts
src/app/page/game/repair-retrofit-item-detail.spec.ts
src/app/page/game/repair-retrofit-items.spec.ts
src/app/page/game/repair-retrofit-ship-detail.spec.ts
src/app/page/game/ship-hangar.spec.ts         (582 LOC, 15 tests)
src/app/page/game/ship-view-inventory.spec.ts
src/app/page/game/ship-view-specs.spec.ts
src/app/page/game/stellar-initiation.spec.ts
src/app/page/character/character-list.spec.ts (763 LOC, 25 tests)
src/app/page/character/character-setup.spec.ts
src/app/page/public/intro.spec.ts
src/app/page/public/login.spec.ts
src/app/page/public/registration.spec.ts
src/app/page/opening/cold-boot.spec.ts
src/app/scene/ship-exterior-view.spec.ts
src/app/scene/ship-view-specs.spec.ts
src/app/scene/hud/cold-boot-hud-scene.spec.ts
src/app/scene/hud/hud-overlay.spec.ts
src/app/component/button.spec.ts
src/app/component/current.spec.ts
src/app/services/mission-flow.integration.spec.ts
```

### Why this matters

1. **Tests pass while production code is broken.** A typo or regression in [src/app/page/game/market-hub.ts](src/app/page/game/market-hub.ts) cannot fail [src/app/page/game/market-hub.spec.ts](src/app/page/game/market-hub.spec.ts), because the spec's 972 lines of mock implementation are independent of the file they purport to cover.
2. **Coverage is misleading.** Karma + `@angular/build:karma` only instruments files reached transitively from a spec import. Because these specs import only `model/*` types, the matching components never enter the coverage denominator — pushing the headline number from a real ~50 % up to the displayed 86 %.
3. **Refactor cost is paid twice.** Every behavior change to a component requires a parallel rewrite in the shadow spec. Drift accumulates silently.
4. **Confidence inversion.** The longest specs (e.g. `market-hub.spec.ts` at 972 LOC) test the spec author's mental model of the component, not the component itself. The Playwright suite is the only thing that touches the actual rendered template.

### Treat shadow specs as the highest-value remediation target.

---

## 4. Other Quality Issues

### 4.1 Branch coverage gap (74.06 %)

Even on the instrumented subset, branches are 0.94 pp below the policy floor. Hot spots:

- [src/app/component/asteroid.ts](src/app/component/asteroid.ts), [src/app/component/expendable-dart-drone.ts](src/app/component/expendable-dart-drone.ts), [src/app/component/character-ship-badge.ts](src/app/component/character-ship-badge.ts) — guard branches on optional inputs untested.
- [src/app/i18n/locale.ts](src/app/i18n/locale.ts) — only 38 % branch; locale fallback paths uncovered.
- [src/app/services/mission.service.ts](src/app/services/mission.service.ts) — error/timeout branches partially covered (related to TODO item "`requestId` correlation").

### 4.2 Test-helper duplication

- The `function createSignal<T>(...)` helper is **redefined verbatim in 21 spec files**.
- A `MockSocketService` / `MockSessionService` interface block is duplicated across **13 spec files**, each diverging slightly from the real `SocketService` / `SessionService` contract.

This duplication amplifies the shadow-spec problem: each spec invents its own approximation of the runtime contract, none of which is centrally validated against the real services.

### 4.3 Pyramid balance vs. policy

[docs/testing-policy.md](docs/testing-policy.md) calls for a 70 / 20 / 10 split (unit / integration / e2e). The current actual mix:

- Unit (model, service, mission, guard, true component tests): healthy.
- **Integration: only 2 dedicated files** (`character-ship-badge.integration.spec.ts`, `mission-flow.integration.spec.ts`), and the latter is itself a shadow spec. The "integration" tier is effectively missing — its role is being filled, badly, by the shadow specs.
- e2e: 68 tests, well within the 4–8-per-area target across ~10 feature areas.

### 4.4 Real component tests that work — use as a template

These specs correctly drive the SUT through `TestBed` and produce real coverage; they should be the model for replacing the shadow specs:

- [src/app/component/cube.spec.ts](src/app/component/cube.spec.ts) — clean DI of a `BEFORE_RENDER_FN` token to fake angular-three's render loop.
- [src/app/component/character-ship-badge.spec.ts](src/app/component/character-ship-badge.spec.ts) and its `.integration.spec.ts` sibling.
- [src/app/services/mission.service.spec.ts](src/app/services/mission.service.spec.ts), [src/app/services/socket.service.spec.ts](src/app/services/socket.service.spec.ts).
- [src/app/app.component.spec.ts](src/app/app.component.spec.ts), [src/app/guards/auth.guard.spec.ts](src/app/guards/auth.guard.spec.ts).

### 4.5 e2e suite — healthy

- 68 tests pass in 28.8 s on 10 workers; no flakes observed in this run.
- Deterministic via [e2e/fixtures/socket-mock.ts](e2e/fixtures/socket-mock.ts), aligned with [docs/server-message-contracts.md](docs/server-message-contracts.md).
- Page-object layer in [e2e/page-objects](e2e/page-objects) is consistent and small.
- Risk: the e2e suite is currently the *only* layer exercising real Angular components for `page/game/*`, `page/character/*`, `page/public/*`, `page/opening/*`, and `scene/*`. If shadow specs remain, every regression in those areas must be caught e2e — which is slower, more brittle, and harder to triage.

### 4.6 Documentation drift

- [TODO.md](TODO.md) "Testing & Validation Checklist" cites "26 unit tests" and "2 e2e tests"; actual is 1199 and 68.
- [docs/operational-testing-checklist.md](docs/operational-testing-checklist.md) still contains only the placeholder example entry — no real cycle has been recorded.

### 4.7 Build hygiene

- A scratch file `c:\Development\Projects\Github\laughing-octo-journey\.cov-extract.cjs` was generated during this review — should be removed (or git-ignored) before commit.

---

## 5. Strengths Worth Preserving

- **`model/` and `mission/` tiers are exemplary.** 95–97 % statements, branches above floor, tests directly drive the SUT.
- **Socket-service spec is thorough** (600 LOC, exercises connection/retry paths).
- **Playwright suite is fast, deterministic, and contract-aligned.**
- **Single source of truth for socket events** in `src/app/model/*` event-name constants — referenced by both production and tests.
- **Test naming** consistently mirrors filenames; one-to-one spec/source mapping is easy to navigate.

---

## 6. Risk-Ranked Recommendations

| # | Risk | Recommendation | Effort |
| ---: | --- | --- | --- |
| 1 | **Critical** | Convert the 30 shadow specs to real `TestBed` component tests that import the SUT. Start with `market-hub`, `mission-board`, `ship-hangar`, `character-list` (highest-LOC, highest-traffic). | L (per spec) |
| 2 | High | Extract a shared `src/testing/` helper module (`createSignal`, `MockSocketService`, `MockSessionService`, `MockMissionService`) typed against the real service interfaces. Delete 21 × 13 duplicated definitions. | M |
| 3 | High | Republish coverage with the shadow specs converted; expect headline numbers to drop, then drive them back up against the real production code. Re-baseline the policy floors only after that. | M |
| 4 | Medium | Add explicit "no shadow spec" guard: a CI check that asserts every `*.spec.ts` (other than `*.integration.spec.ts`) imports the file at the matching path. | S |
| 5 | Medium | Bring branch coverage above 75 % in `component/`, `i18n/locale.ts`, and `services/mission.service.ts`. | M |
| 6 | Medium | Add a real "service integration" tier (e.g. `mission-flow.integration.spec.ts` wired to the real `MissionService` + a fake `SocketService`) to cover the policy 20 % integration band. | M |
| 7 | Low | Remove `.cov-extract.cjs`; add `coverage/` confirmation to `.gitignore` if not already. | S |
| 8 | Low | Update [TODO.md](TODO.md) test counts; fill in the first real entry in [docs/operational-testing-checklist.md](docs/operational-testing-checklist.md). | S |

---

## 7. Reproduction

```bash
npm run test:ci                                          # Karma + coverage
PLAYWRIGHT_HTML_OPEN=never npx playwright test --reporter=line   # e2e
```

Coverage HTML lives at [coverage/ngt-template/index.html](coverage/ngt-template/index.html). To audit shadow specs:

```bash
for f in src/app/page/**/*.spec.ts src/app/scene/**/*.spec.ts \
         src/app/component/*.spec.ts src/app/services/*.spec.ts \
         src/app/mission/*.spec.ts; do
  n=$(basename "$f" .spec.ts); n=${n%.integration}
  grep -Eq "from ['\"]\\./$n['\"]" "$f" || echo "NO-SUT $f"
done
```
