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

### Opt-in phased worker trial

The phased runner isolates tests tagged `@single-worker` before starting the
remaining suite with two workers. Only the touch-accessible planet close-up is
initially tagged. This is suite-level isolation, unlike a serial describe or a
one-worker project that can still compete with another project.

```powershell
npm run e2e:phased -- --list
npm run test:e2e:phased
npm run e2e:phased
```

The first command lists both partitions without executing tests. The second
checks sequencing and failure propagation, including a real synthetic
Playwright failure followed by a successful second phase and merged reports.
The full trial always uses zero retries and retained failure traces:

1. `--grep=@single-worker --workers=1`
2. `--grep-invert=@single-worker --workers=2`

Each Playwright process exits before the next starts. Authentication setup runs
normally in both invocations. The verified partition contains 2 executions in
the first phase and 271 in the second: 271 distinct application tests, plus
setup twice, for 273 executions rather than 272. No application tests overlap
or are omitted; the existing skipped test remains in the second phase.

Both phases run even if the first reports test failures. Any failed phase or
report merge makes the command fail. Interrupted/failed child startup or missing
blob reports are explicit errors. Each trial retains its separate artifact,
JUnit, and blob trees under `test-results/phased/run-*`; the latest completed
trial's phase exit codes and wall times are in
`test-results/phased/execution.json`. Merged HTML and JUnit retain the normal
`playwright-report` and `test-results/playwright-junit.xml` locations for CI.
The merged execution count includes both setups. Use the execution metadata,
not the sum of JUnit suite durations, for wall-clock comparisons.

The same runner is available through the workflow's opt-in `phased` input:

```powershell
gh workflow run e2e-playwright.yml --repo qagwaai/laughing-octo-journey --ref trial/e2e-two-workers -f phased=true -f backend_ref=13c1fd466f3e2ec602a5671d92df8be372491e75
```

Phased mode fixes workers to 1 then 2 and retries to 0 regardless of the ordinary
worker/retry inputs. Leave `test_grep` empty; a conflicting selector is rejected
rather than silently ignored. Normal local and CI defaults remain unchanged.
This hybrid trial does not qualify the entire suite for two-worker execution.
Full local and GitHub phased validation is required before adopting it.

#### First full phased comparison: 2026-10-20

Frontend `49fc81ec8ebf876c4b7dee762980ce3169b5862d` was tested with
`npm run e2e:phased` locally and the dispatch command above in GitHub.
Both used zero retries, unchanged assertions/deadlines, and the verified
273-execution partition. GitHub kept the approved temporary Ubuntu 22 runner
and pinned backend SHA; the local backend revision remains unverified.

| Environment | Phase | Passed | Failed | Skipped | Runner wall time |
| ----------- | ----- | -----: | -----: | ------: | ---------------: |
| Local | Isolated, one worker | 2 | 0 | 0 | 52.7 s |
| Local | Remainder, two workers | 265 | 5 | 1 | 53.9 min |
| GitHub | Isolated, one worker | 2 | 0 | 0 | 52.5 s |
| GitHub | Remainder, two workers | 270 | 0 | 1 | 24.5 min |

[GitHub run 39420300987](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39420300987)
passed: **272 passed, 1 skipped**, 25.4 minutes including report merging.
Local execution failed: **267 passed, 5 failed, 1 skipped**, 54.8 minutes
including merging. Both report merges succeeded; the local command correctly
returned exit code 1. No tests were left unrun. Separate phase JUnit/blob reports,
merged JUnit, execution metadata, and local failure traces were archived outside
the repository. The GitHub merged report also retained both setup executions.

The isolated touch planet test passed in both environments. The five local
failures were all in the two-worker remainder:

- Splash homeworld initial navigation: the URL was still
  `/?splashPlanet=nova-splash-homeworld` at the existing 4.5-second redirect
  assertion.
- Splash icy-moon selection without clouds/rig reload: exceeded the existing
  60-second total test budget.
- Standard station model close-up: status remained `loading` after returning
  to the system viewer; the 30-second readiness assertion failed within the
  120-second test budget, and context teardown also exceeded that budget.
- Low station model close-up: exceeded the existing 120-second test budget.
- Touch station close-up/back buttons: exceeded the existing 60-second budget.

These observations are not a proven common root cause. The phased harness
works and the initial isolated candidate passed, but isolating that test alone
does not establish local reliability for the remainder. Do not broaden tags,
weaken checks, raise deadlines, or repeat full trials without investigating
these failures first. Keep one-worker defaults and the phased runner opt-in;
the three-clean-full-runs-per-environment criterion remains unmet.

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

### Full-suite qualification after timing/focus fixes: 2026-10-19

Qualification uses frontend `e344c5b7f8262c38f8b7aef5e049afd53f83c922`,
two workers, zero retries, and retained failure traces. Each environment attempts
up to three sequential full runs, stopping its sequence on the first failure.
GitHub continues to pin backend `13c1fd466f3e2ec602a5671d92df8be372491e75`;
the local backend revision remains unverified. Local execution reuses the running
dev server. The Node/browser versions are unchanged from the earlier trial.

| Execution                                                                                     | Passed | Failed | Skipped | Did not run | Playwright wall time |
| --------------------------------------------------------------------------------------------- | -----: | -----: | ------: | ----------: | -------------------: |
| Local attempt 1                                                                               |    257 |      6 |       1 |           8 |             46.9 min |
| [GitHub attempt 1](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39346300884) |    271 |      0 |       1 |           0 |             27.0 min |
| [GitHub attempt 2](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39349236233) |    269 |      2 |       1 |           0 |             29.4 min |

Local execution:

```powershell
npm run e2e -- --workers=2 --retries=0 --trace=retain-on-failure --reporter=line,junit
```

The local run failed and its remaining qualification attempts were not started.
JUnit, execution metadata, screenshots, and failure traces were archived outside
the repository. The six observed failures were:

- Two flight-position persistence cases timed out waiting for coordinates to
  settle after releasing forward input. These failures precede their persistence
  assertions; they do not establish lost backend coordinates.
- The homeworld splash initial redirect again missed its unchanged threshold.
- The post-target rotate/zoom/pan case exhausted its overall 60-second budget
  while waiting for a rendered frame change.
- The scavenger-pod asset case exhausted its test budget during shared-session
  setup, still on the character list instead of game-main. It did not reach its
  asset assertion.
- The direct station close-up case did not show the expected market heading
  within 15 seconds.

Both GitHub runs selected all 272 tests with `--workers=2 --retries=0`
and `--grep=.*`. Attempt 2 failed on the touch-accessible planet close-up's
60-second test budget and the splash quality-switch check: low-tier readiness
remained `loading` instead of `ready` at its 15-second assertion. The third
GitHub attempt was not started. The failure traces, JUnit, and both GitHub
summaries were archived outside the repository.

Qualification failed in both environments. The three-clean-run requirement
was not met, and the first green GitHub run does not override the later failure
or failed local qualification. Keep the one-worker default; do not weaken
assertions, extend timeouts, or add retries to qualify. The observations identify
remaining investigation targets, not a proven common root cause.

### Settling/readiness investigation: 2026-10-20

Saved qualification traces and a fresh eight-case local reproduction identified
avoidable harness work as well as a remaining two-worker capacity problem:

- Flight coordinates had already stopped changing after key release. The failed
  logout/login case obtained only two layout-dependent `innerText` samples before
  its five-second settling deadline. Sampling now uses `textContent` in one browser
  evaluation, retaining three equal samples, the existing polling intervals, the
  movement requirement, and the five-second budget. Persistence assertions and
  coordinate tolerances are unchanged.
- The isolated ship asset test lived inside a serial suite whose `beforeAll`
  opened another shared game/WebGL context. It now runs outside that suite, so
  its isolated context does not coexist with an unused shared one. Other serial
  tests retain their shared session and ordering.
- The viewer gesture check now reuses the changed screenshot returned by each
  successful frame poll rather than taking the same expensive screenshot again.
  Each gesture still runs once and must change actual rendered pixels.
- The tier-switch test now requests reduced motion, isolating asset switching
  from unrelated continuous drift/cloud animation. Both real GLB tiers, still
  image, diagnostics, and original readiness deadlines remain checked. Separate
  splash motion/orbit tests are unchanged. The CI trace showed successful asset
  responses, not a failed download; animation pressure is not proven to be its
  only cause.
- The root URL previously required a second, post-render navigation through a
  primary intro component before reaching splash. It now redirects directly to
  splash with the same left intro panel. A router regression also exposed that
  the old static redirect discarded query parameters/fragments; the new URL-tree
  redirect preserves them. Explicit `/intro` transitions retain their existing
  post-render remount behavior.
- The touch close-up CI trace showed lengthy ordinary actions (8.6 seconds for
  the distance-view switch, 10.6 seconds for the back tap), exhausting the total
  budget rather than establishing an incorrect target or intercepted tap.
  A local trace spent 13.7 seconds on the distance switch. Removing that switch
  is not valid: the target rows exist only in that mode. An intermediate
  experiment confirmed this and was reverted. The touch test remains unchanged.
- The station-heading failure did not recur in the final focused comparisons.
  Its saved snapshot was still loading the system; later trace console evidence
  reached the expected aborted model request. No deterministic session/contract
  defect was established, so no speculative production session fix was made.

The initial unchanged two-worker reproduction passed six tests and failed
three (including setup in the total): flight settling, splash initial readiness,
and the isolated ship asset test's overall budget. After the final patch, run
the same eight cases in each environment with:

```powershell
$selector = 'opens the inspected planet with a tap|switches between the 154k|backend-persisted flight|keeps latest coordinates across repeated|nova-splash-homeworld|keeps rotate, zoom, and pan usable|rehydrates a direct close-up|viewer requests scavenger pod GLB'
npm run e2e:spec -- --grep $selector --workers=1 --retries=0 --trace=retain-on-failure --reporter=line,junit
npm run e2e:spec -- --grep $selector --workers=2 --retries=0 --trace=retain-on-failure --reporter=line,junit
```

Final local results, including authentication setup:

| Workers | Passed | Failed | Playwright wall time |
| ------- | -----: | -----: | -------------------: |
| 1       |      9 |      0 |              3.5 min |
| 2       |      8 |      1 |              3.1 min |

The remaining failure is the unchanged touch planet close-up's 60-second test
budget. The settling, redirect, tier-switch, viewer gesture, ship asset, and
station rehydration cases passed in both final comparisons. This is evidence
of improvement, not a clean two-worker qualification or proof that every
load-sensitive failure is fixed. An intermediate repeated stress run also
exhausted the repeated flight-navigation case's total budget after settling;
do not equate fixing its sampling overhead with full-flow reliability.

`npm run test:spec -- src\app\routed.routes.vitest.ts src\app\page\public\intro.vitest.ts`
passed all 53 tests. `npm run build` and targeted ESLint on the changed route,
route tests, and E2E specs passed. Traces/JUnit from both final comparisons were
archived outside the repository. Keep the one-worker default and the existing
timeouts/retry policy.

The complete affected ship specs also passed all 17 tests at two workers:

```powershell
npm run e2e:spec -- viewer-ships.spec.ts ship-exterior-flight-position-persistence.spec.ts --workers=2 --retries=0 --trace=retain-on-failure
```

That 2.7-minute run includes every shared-session ship case and all three
flight-persistence flows.

The first focused GitHub dispatch on patch `3731c91`,
[run 39415968495](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39415968495),
did not execute any tests: MongoDB 8.0 refused startup, explicitly reporting a
known incompatibility with Linux kernels 6.19 and newer. The runner also announced
the `ubuntu-latest` migration to Ubuntu 26. An attempted `ubuntu-24.04` pin also
failed before checkout in
[run 39416467746](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39416467746),
with the same MongoDB kernel error. Pinning the OS release alone did not avoid
the updated kernel.

The user approved a temporary `ubuntu-22.04` trial-workflow pin to obtain CI
evidence while keeping MongoDB 8.0 and the backend revision unchanged.
The [published Ubuntu 22 runner inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2204-Readme.md)
reports kernel `6.8.0-1064-azure`, outside the incompatibility described in
[MongoDB SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912).
Ubuntu 22 runners are already in their
[deprecation period](https://github.com/actions/runner-images/issues/14254);
this is a temporary validation environment, not a long-term runner recommendation
or a change to worker defaults. Remove the pin after an upstream-compatible
runner/MongoDB combination is available, before that runner's retirement.

With that approved pin, [GitHub run 39417151229](https://github.com/qagwaai/laughing-octo-journey/actions/runs/39417151229)
passed all nine focused tests, including setup, in 2.7 minutes on
`f02cdc3d01565f14c5ad9fd339180650f2b89b29`. The execution log confirms
`ubuntu-22.04`, two workers, zero retries, and the eight-case selector above.
MongoDB initialized successfully; the backend remained pinned to
`13c1fd466f3e2ec602a5671d92df8be372491e75`. Dispatch command:

```powershell
gh workflow run e2e-playwright.yml --repo qagwaai/laughing-octo-journey --ref trial/e2e-two-workers -f workers=2 -f retries=0 -f backend_ref=13c1fd466f3e2ec602a5671d92df8be372491e75 -f "test_grep=$selector"
```

Result: passed. The summary was archived outside the repository. This focused
pass uses a different runner image than the earlier full-suite trials and does
not resolve the remaining local two-worker touch timeout. No further full suite
was run, and the three-clean-full-runs-per-environment qualification remains unmet.

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
