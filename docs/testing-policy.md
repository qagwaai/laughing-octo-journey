# Testing Policy

## Purpose

Define a pragmatic, repeatable testing target for this repository so the team catches regressions early without over-investing in low-value tests.

## Scope

This policy applies to the full repository, including:

- mission flows and mission gate progression
- gameplay services and sync paths
- page-level rendering and interaction behavior
- end-to-end user journeys

## Target Matrix

| Layer                          | Goal                                         |                       Target Range | Minimum Coverage Intent                                     |
| ------------------------------ | -------------------------------------------- | ---------------------------------: | ----------------------------------------------------------- |
| Unit (reducers/models/helpers) | Validate logic quickly                       | 20-35 tests per major feature area | Transition rules, edge cases, status mapping                |
| Service integration            | Validate service contracts and sync behavior |  8-15 tests per major feature area | Service-to-service and socket/API contract correctness      |
| Component/page integration     | Validate UI-service wiring                   |  6-12 tests per major feature area | Rendering, state reconciliation, user-triggered transitions |
| Playwright e2e                 | Validate user-visible regression alarms      |   4-8 tests per major feature area | Happy path, stale-state recovery, wrong-sequence guards     |
| Feature total                  | Practical confidence envelope                | 38-70 tests per major feature area | Balanced confidence with maintainable runtime               |

## Recommended Mix

- 70% unit tests
- 20% integration tests
- 10% Playwright e2e tests

## Stop-Rule

Stop adding routine tests when all criteria below are true:

1. Happy path is covered at all three levels:
   - unit
   - integration
   - Playwright
2. At least three guardrail scenarios are covered:
   - wrong event order
   - stale local state reconciliation
   - backend state mismatch handling
3. Every escaped production bug has a permanent regression test.
4. Flake rate remains below 2% for two consecutive weeks.
5. CI runtime remains acceptable for team cadence.
6. Coverage floors are maintained:
   - unit test coverage >= 80%
   - branches >= 75%
   - functions >= 80%
   - lines >= 85%

## Add-Test Rule

Add new tests only when one of the following is true:

1. New behavior was introduced.
2. A new bug class was discovered.
3. A high-risk refactor changed control flow, state merge logic, or contracts.

## PR Checklist

For test-sensitive pull requests, verify:

- [ ] Which layer(s) changed: unit, integration, component, e2e
- [ ] Affected transitions and contracts are covered
- [ ] At least one negative-path assertion exists when risk increased
- [ ] Existing tests were updated if contracts or flow changed
- [ ] No brittle timing assumptions were introduced in Playwright
- [ ] Stateful gameplay specs that use Ship Hangar surfaces assert readiness via sw13.v1 contract (for example waitForLoadedReadiness)
- [ ] If SW-13 stabilization scope is touched, governance adoption evidence is added or updated in docs/planning/sw-13-closure/sw-13-governance-adoption-log-2026-07-20.md
- [ ] CI remains green and runtime remains reasonable

Suggested validation command for SW-13 stabilization scope:

- `npm run sw13:adoption:check`

## SW-13 Readiness Gate

Stateful gameplay governance for SW-13 uses an automated gate:

- Command: npm run e2e:readiness:check
- Hooked into: pree2e and pree2e:spec
- Rule: Any stateful gameplay e2e spec that touches Ship Hangar surfaces must include a deterministic readiness assertion through the sw13.v1 contract.

## Current Practical Baseline

For major feature areas in this repository, the pragmatic target is:

- 40-60 well-chosen tests, with emphasis on scenario quality over raw count.

Beyond that range, prioritize only high-risk additions tied to new behavior, defects, or refactors.

## Operational Compliance

Use the companion checklist to verify policy items that require time-window evidence (for example flake rate and escaped-bug mapping):

- [Operational Testing Checklist](docs/operational-testing-checklist.md)

## Portable WebGL correctness baseline

Playwright uses Chromium with explicit SwiftShader software WebGL in both local
runs and GitHub Actions. One worker is the default to reduce CPU and WebGL context
contention. `CI_PLAYWRIGHT_WORKERS`, `PLAYWRIGHT_WORKERS`, and `CI_NODE_TOTAL`
(in that precedence order) retain their existing worker overrides. The launch
flags also apply to headed/debug runs so those reproduce the same correctness
baseline; they do not change the application's runtime renderer.

The `--enable-unsafe-swiftshader` flag opts the test browser into software WebGL;
use this harness for trusted application/test content, not general web browsing.
GitHub Actions installs the lockfile-selected Playwright Chromium with
`npx playwright install --with-deps chromium`. No extra browser engine or system
Chrome dependency is required.

Viewer catalog tests assert WebGL2/standard-tier capacity, actual material texture
dimensions, exact same-origin requests, controlled quality-policy inputs, and
state-based readiness. Missing WebGL is a test failure, not a successful skip.
Keep failure screenshots/traces and the existing CI retry for diagnosis; retries
do not replace deterministic assertions or establish a flake-rate target.

Run the focused baseline with:

```powershell
npm run e2e:spec -- viewer-planet-surfaces.spec.ts
```

Software-rendered correctness tests do not establish hardware frame rates, actual
GPU residency, cold-network performance, or final visual acceptance. Those require
separate documented real-device/browser validation. A passing local headless run
also does not prove that the Linux GitHub Actions run has passed.

Splash reload checks pin representative terran, gas-giant and star identities
instead of randomly changing shader workloads. Real GLB reload readiness has a
scoped 30-second terminal-state wait; an error still fails the check. Thin/thick
cloud-motion checks install Playwright Clock before navigation, pause after
readiness, and advance ten 50-ms frames before and during orbit interaction.
Use a fixed clock origin and a pause deadline beyond the test timeout, not a
near-future `Date.now()` read from a separate browser round trip.
Multiple `fastForward()` calls respect the production per-frame delta clamp;
one large jump would not represent the same animation time. Advance a frame
after pointer events so Angular can publish the orbit state while timers are
paused. Do not translate a motion assertion into a minimum wall-clock FPS.

Validation on 2026-10-09:

- `npm run e2e:spec -- mining-splash.spec.ts viewer-planet-surfaces.spec.ts --workers=1 --retries=0`
  passed all 34 tests including setup under headless SwiftShader (8.4 minutes).
  The earlier combined run passed 33 and exposed the near-future `pauseAt`
  timestamp race; the fixed-origin deadline resolves that test-harness error.
- Targeted ESLint and direct strict TypeScript compilation of both changed specs
  passed. Project-wide E2E typechecking remains blocked by the existing
  `ignoreDeprecations: "6.0"` configuration and unrelated E2E type errors.
- The full repository E2E suite and Linux Actions execution were not rerun.
  Production splash loading, rotation and controls were not changed.
