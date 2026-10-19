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

Two-worker reliability trials leave the default at one worker. Run the full
suite locally with no retries and retain failure traces:

```powershell
npm run e2e -- --workers=2 --retries=0 --trace=retain-on-failure --reporter=line
```

The E2E Playwright workflow accepts manual `workers`, `retries`, and `backend_ref`
inputs. Select two workers, zero retries, and a fixed backend commit SHA for
comparable GitHub trials. Push runs still use one worker and one retry; workflow
runs retain failure traces even when retries are disabled. Record frontend and
backend revisions, Node/browser versions, total wall time, failures, and skips.
Compare at least three full runs per environment before considering a default
change. Do not increase timeouts or count retry-recovered tests as clean trials.

### Two-worker trial: 2026-10-19

Decision: keep one worker as the default. The first full two-worker run failed
in both environments, so the three-clean-run qualification was not completed.
No timeouts, assertions, retries, or production rendering behavior were changed
to make the trial pass.

The frontend trial revision was `ccbe8c33d2d02e4ed189b667146acd41dccf0f29`
(test/application code unchanged from `b89a3d1`). GitHub checked out backend
`13c1fd466f3e2ec602a5671d92df8be372491e75`. The local backend SHA was not verified.
Local execution reused the running dev server, used Node `24.14.0`, npm `11.18.0`,
and Chromium `153.0.8010.12`. GitHub used Node `20.19.0`, npm `10.8.2`, and the
same Chromium version reported by the trace's browser user agent.

| Execution                                                                                      | Workers | Passed | Failed | Skipped | Playwright wall time |
| ---------------------------------------------------------------------------------------------- | ------: | -----: | -----: | ------: | -------------------: |
| Full local suite                                                                               |       2 |    265 |      6 |       1 |             41.5 min |
| [Full GitHub suite](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39324414766) |       2 |    270 |      1 |       1 |             24.4 min |
| Focused local control                                                                          |       1 |      7 |      0 |       0 |              2.5 min |
| Focused local comparison                                                                       |       2 |      7 |      0 |       0 |              2.1 min |

All four executions disabled retries and retained failure traces. The full
local command is shown above. GitHub used:

```powershell
gh workflow run e2e-playwright.yml --repo qagwaai/laughing-octo-journey --ref trial/e2e-two-workers -f workers=2 -f retries=0 -f backend_ref=13c1fd466f3e2ec602a5671d92df8be372491e75
```

GitHub's debug-drawer layout check observed a 17-pixel horizontal shift between
its before/after samples. Local failures were the planet-detail right-click
exit timeout, the homeworld splash redirect timeout, third-party-blocked splash
readiness remaining in `loading`, a viewer zoom value changing from 100 to 39,
the rotate/zoom/pan interaction timeout, and the body-drag interaction/teardown
timeout. All seven affected tests passed in the subsequent focused controls:

```powershell
$selector = 'preserves planet details interaction and right-click exit flow|shows the scene.*nova-splash-homeworld|renders the splash planet with every third-party host blocked|consolidates information without hiding notes|keeps rotate, zoom, and pan usable|left-dragging a body rotates|opens an overlay debug drawer'
npx playwright test --project=chromium --no-deps --grep $selector --workers=1 --retries=0 --trace=retain-on-failure --reporter=line
npx playwright test --project=chromium --no-deps --grep $selector --workers=2 --retries=0 --trace=retain-on-failure --reporter=line
```

The earlier one-worker GitHub baseline passed 271 tests with one skip in
31.4 minutes. The two-worker run was about 22% faster, but failed. This is not
a controlled speed benchmark: the baseline used the normal retry/trace policy,
and local/GitHub Node versions and local backend provenance differ. The results
do not establish resource contention as the sole cause; the splash redirect
timeout also occurred in an earlier one-worker local run. Investigate layout,
readiness, camera-settling, and input-target timing before repeating full trials.
JUnit summary `durationSeconds` sums suite durations under parallel execution;
use Playwright's reported wall time, not that sum, for speed comparisons.

### Targeted failure investigation: 2026-10-19

- The viewer target label updates before the camera flight finishes. The flight
  disables orbit controls and publishes the new zoom only on completion. The
  failing wheel-isolation check captured zoom 100 during flight, then observed
  the completion value 39. Both affected viewer checks now wait for completion's
  zoom publication before testing input. Each rotate/zoom/pan gesture runs once;
  frame polling no longer repeats the input or adds an unconditional first gesture.
- Ship layout bands are now read atomically in one browser evaluation. The
  debug-drawer test waits for actual pane/drawer transitions rather than sleeping
  250 ms. Exact before/after position and size assertions remain unchanged. These
  remove sampling hazards but do not prove the original 17-pixel shift's cause;
  a standalone CSS/focus experiment did not reproduce it.
- The blocked-host splash failure spent about 14 seconds fetching the 7.8 MB
  standard GLB before decoding/rendering, nearly consuming its 15-second ready
  assertion. No request failed; resource delay does not establish a renderer bug.
- The planet right-click flow exhausted the overall test budget while waiting
  for the viewer URL after the click. The body-drag trace completed its no-target
  assertion, but exhausted its overall test/teardown budget. Neither trace proves
  a deterministic input bug. Do not describe the teardown timeout as a browser crash.
- A focused two-worker, zero-retry stress run repeated all seven cases three
  times: 20 passed, one failed in 6.1 minutes. The unchanged homeworld redirect
  check failed once at its original 4.5-second threshold; its GLB request took
  about 12.5 seconds. Camera/layout checks passed all three repetitions. This is
  not a clean qualification run, and slow GLB timing alone does not explain the
  redirect delay. Loading/redirect thresholds and all production code remain
  unchanged at that stage. No full-suite trial was repeated.

The first focused GitHub execution,
[run 39333829818](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39333829818),
passed seven tests including setup and failed the ship drawer focus assertion
(1.8 minutes). Opening/closing the drawer used a zero-delay timer, which does
not guarantee Angular has committed its `inert`/visibility bindings. Focus now
runs after Angular's next render, checks that the drawer still has the requested
open/closed state, and uses `preventScroll` so focus does not move the scene.
The regression check also exercises three keyboard open/Escape-close cycles
and requires focus restoration each time. Six local repetitions at two workers,
zero retries, passed in 1.1 minutes; the Angular build and targeted ESLint passed.
This is the only production behavior change in this investigation.

After the focus fix, [GitHub run 39334654599](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39334654599)
passed all eight tests (the seven investigated cases plus authentication setup)
in 2.3 minutes with two workers and zero retries. It tested frontend
`979ad20d4e9c5d1df677d43aa3a3ff10e9e16b71` and the same pinned backend SHA.
The local splash redirect failure and load-sensitive full-suite timeouts remain
unresolved; one focused GitHub pass does not qualify two workers as the default.

Direct strict TypeScript checking of the two edited E2E specs reported existing
errors in unchanged code: nullable flight coordinates/expect narrowing in the
flight-mode spec and a required `window.ng` cast in the viewer-controls spec.
These were not changed as part of the timing/focus fix.

Manual workflow input `test_grep` accepts a test-title regex for bounded
investigation; leaving it empty retains full-suite execution. Match the seven
cases with the selector above. Focused green runs do not establish full-suite
two-worker reliability.

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

Scene coordinate and camera-centering assertions must use Three.js
`getWorldPosition()` with a cloned vector, not a mesh's local `position`.
Viewer body meshes can be nested under positioned groups; local coordinates
can be zero even when the rendered body is correctly positioned. Retain the
expected coordinate values and centering tolerances when checking world space.

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

Mobile splash gesture checks use a touch-enabled mobile context, maximize the
scene with the visible pane control, and hit-test gesture coordinates against
the canvas before sending touch input. The full canvas bounding box also extends
behind the pane splitter and overlay controls, so its center is not necessarily
an interactive scene point. Keep orbit/pinch visual-change checks and verify
that reduced motion returns to the still state after each gesture.

Validation on 2026-10-09:

- `npm run e2e:spec -- splash.spec.ts viewer-planet-surfaces.spec.ts --workers=1 --retries=0`
  passed all 34 tests including setup under headless SwiftShader (8.4 minutes).
  The earlier combined run passed 33 and exposed the near-future `pauseAt`
  timestamp race; the fixed-origin deadline resolves that test-harness error.
- Targeted ESLint and direct strict TypeScript compilation of both changed specs
  passed. Project-wide E2E typechecking remains blocked by the existing
  `ignoreDeprecations: "6.0"` configuration and unrelated E2E type errors.
- The full repository E2E suite and Linux Actions execution were not rerun.
  Production splash loading, rotation and controls were not changed.
