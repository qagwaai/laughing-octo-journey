# Nx migration assessment and plan

**Assessment date:** 2026-10-25
**Repository:** `ngt-template` (`laughing-octo-journey`)
**CI provider:** GitHub Actions

## Executive recommendation

**Do not treat an Nx migration as an urgent fix or start by restructuring the
repository. Run a small, reversible Nx integration pilot first.**

Nx could add useful task orchestration and repeatable local/CI caching, and it
could provide affected-task selection if this repository grows into multiple
projects. The current workspace, however, declares just one Angular application
and has no Nx configuration or Nx dependency. With one project, most application
source changes still affect the same build and test targets; `nx affected` alone
is therefore unlikely to eliminate much work. A local cache also does not
survive a fresh GitHub Actions runner. Meaningful CI cache reuse would require a
remote cache or another persistent cache arrangement, with its own setup,
security, and maintenance considerations.

The strongest case for Nx would be a near-term plan to add projects or share
code across them, or measured repeated build/test work that a correctly
configured remote cache can reuse. If neither is true, retaining Angular CLI
and improving the existing GitHub Actions workflow may be simpler and deliver
more immediate value.

## Findings from this codebase

### Workspace and framework

- [`angular.json`](../angular.json) declares one project, `ngt-template`, of
  type `application`, rooted at the repository root with source in `src/`.
  There is no `nx.json`, `project.json`, or configured Nx dependency in
  [`package.json`](../package.json) / `package-lock.json`.
- This is an Angular 21 standalone application using Angular Three. Angular CLI
  owns the production build; `angular.json` also configures custom asset globs
  and a repository-local strict dev-server builder at
  `tools/strict-dev-server`.
- Tests are not a single Angular CLI target: Vitest uses
  `vitest.config.mts` and the Analog Angular plugin; Playwright has its own
  `playwright.config.ts`, setup project, and Chromium configuration. TypeScript
  checks, ESLint, formatting, and repository governance checks are separate
  scripts.
- [`package.json`](../package.json) pins Angular framework packages to
  `21.2.25`, Angular CLI to `21.2.26`, and `@angular/build` to `21.2.24`.
  Node/npm are pinned to Node `24.22.0` and npm `11.18.0`. Nx is not currently
  part of the dependency graph. The Nx and Angular plugin versions that can
  coexist with these exact versions must be verified in a pilot rather than
  assumed.

### Existing task orchestration and safeguards

- The npm script surface already provides build, serve, lint, app/spec
  typechecks, Vitest, Playwright, and focused E2E partitions. It also contains
  pre-command checks, notably the E2E partition gate before build and several
  governance/readiness gates before E2E.
- Preserve these checks if targets are introduced. In particular, replacing
  `npm run build` with a direct builder invocation must not skip the existing
  `prebuild` partition check. Likewise, serving the app must retain the
  fail-closed behavior of `tools/strict-dev-server`.
- [`vitest.config.mts`](../vitest.config.mts) configures Angular-aware
  transformation, aliases, jsdom, coverage thresholds, and test discovery.
  Any Nx test target must continue using this configuration and the existing
  Vitest runner rather than introducing Jest or silently changing test
  selection.
- The E2E suite is partitioned and has governance checks. The GitHub Actions
  Playwright workflow checks out the separate `qagwaai/solid-train` backend at
  `main`, starts MongoDB and that server, then runs the frontend suite. That
  backend is not a project in this repository's workspace and its moving
  `main` revision is an external input to E2E results.

### GitHub Actions and likely optimization limits

- `.github/workflows/unit-vitest.yml` runs the Vitest suite on pull requests
  and pushes to `main`.
- `.github/workflows/e2e-playwright.yml` runs on pushes to `main` and manual
  dispatch, not pull requests. It installs dependencies and browsers, starts
  MongoDB and the separately checked-out backend, and uploads reports.
- `.github/workflows/sw-08-contract-safety-gate.yml` and
  `.github/workflows/security-hygiene.yml` enforce contract and dependency /
  secret checks. These checks have different inputs and should not be skipped
  merely because an application project is unaffected.
- The workflows inspected do not currently run a consolidated PR build,
  lint, and typecheck gate. Confirm whether that is intentional before adding
  Nx targets to CI; Nx should not obscure a decision about which checks are
  required.
- Nx task caching can restore task outputs when declared inputs match; Nx
  affected selection chooses tasks based on configured project/task inputs.
  With one app, affected selection has limited granularity unless targets are
  deliberately separated and their inputs modeled accurately. Do not assume
  that adding Nx automatically makes the existing full Vitest suite
  file-selective.
- E2E results depend on a live backend and MongoDB. Nx's own cache guidance
  says tasks with external/backend-dependent results should not be cached
  unless those dependencies are represented in the task hash. Keep E2E
  uncached in the initial pilot.

## Benefits, costs, and decision

| Area                  | Potential benefit here                                                                                                                                           | Cost / limitation                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer workflow    | One task graph and consistent task commands; inspectable task dependencies; potential local cache hits.                                                          | Adds Nx configuration and CLI/plugin dependencies to a workspace whose existing npm scripts already cover its one app.                                                                                           |
| GitHub Actions        | Remote cache may avoid repeating identical build/test work across clean runners. Affected targets can skip work when a change truly does not touch their inputs. | Local cache alone is ephemeral on hosted runners. Remote cache requires setup, credentials/policy review, and correct hashing. One app means most app-code changes still affect app tasks.                       |
| Angular compatibility | Nx has documented Angular workspace integration and can orchestrate Angular CLI build targets.                                                                   | Exact Nx/plugin compatibility with Angular CLI/build 21.2.x, the custom dev-server builder, Angular Three, and this test toolchain is not established by repository evidence. Validate before migrating targets. |
| Future growth         | A later backend/frontend/shared-library workspace could benefit from project dependency graphs and affected execution.                                           | Moving the separately maintained Forge repository into this workspace would be a separate architectural/repository decision, not a prerequisite for trying Nx.                                                   |

**Go/no-go:** proceed with the pilot below only if the team wants to evaluate
repeatable cache savings or anticipates additional workspace projects. Keep the
current Angular CLI setup if the pilot shows no meaningful reuse, requires
fragile workarounds, or adds more CI maintenance than it removes.

## Proposed phased plan

### Phase 0 — Capture a baseline

1. Record current GitHub Actions durations and runner minutes for the Vitest,
   contract, security, and E2E workflows over a representative set of runs.
   Separate dependency installation, browser installation, and actual test
   time where the workflow exposes them.
2. Record the normal local commands, current task outputs, and any existing
   cache behavior. Use the same Node/npm pins and runner class for comparisons.
3. Decide which checks are required on pull requests. Do not change CI trigger
   policy as an incidental part of the Nx pilot.

**Exit criterion:** a comparable baseline exists; no Nx migration has started
until CI owners agree which measurements matter.

### Phase 1 — In-place compatibility spike

1. Create a short-lived branch and use the official Nx Angular adoption path
   for an existing Angular CLI workspace. Determine the compatible Nx and
   `@nx/angular` versions against the pinned Angular 21.2.x packages before
   committing dependency updates.
2. Keep the existing root layout, npm, lockfile, Angular CLI configuration,
   and app source in place. Do not move files into `apps/` or `libs/`, split
   application code, replace Vitest/Playwright, or migrate the Forge backend.
3. Confirm Nx discovers exactly the intended Angular app and inspect the
   resolved build, serve, and custom builder targets. Verify that production
   assets, budgets, environment replacements, and the strict dev-server
   failure behavior remain unchanged.
4. Run the existing commands before and after the spike and compare results.
   Resolve peer-dependency conflicts and custom-builder incompatibilities
   before enabling Nx in CI.

**Exit criterion:** clean `npm ci`; compatible Nx/plugin dependency graph;
unchanged build output behavior and dev-server safeguards; existing tests and
governance gates pass.

### Phase 2 — Model targets and cache safely

1. Define explicit Nx targets for the existing build, lint, app/spec
   typechecks, Vitest, and needed E2E partitions. Initially delegate to the
   existing tools/configuration instead of replacing them with new executors.
2. Preserve prebuild, pretest, and E2E partition/readiness/governance checks.
   Where npm lifecycle hooks are not invoked by an Nx executor, wire the
   checks explicitly and test that bypassing the npm alias cannot skip them.
3. Declare complete inputs and outputs. Include lockfile, TypeScript,
   Angular/Vite/Playwright config, scripts, governance gates, and relevant
   environment values where they affect results. Do not mark a task cacheable
   until its output is deterministic for those inputs.
4. Start with caching for deterministic build and unit-test targets. Keep
   E2E non-cacheable while it relies on a live MongoDB instance and a backend
   checked out from moving `main`. Keep contract and security checks governed
   by their own workflow conditions and inputs.
5. Confirm that the test targets retain the exact existing Vitest config,
   spec discovery, coverage thresholds, Playwright setup dependencies,
   artifacts, and CI reporter behavior.

**Exit criterion:** repeated local runs produce valid cache hits only for
unchanged deterministic tasks; changed task inputs invalidate the right
targets; no test or safety gate is skipped.

### Phase 3 — GitHub Actions pilot and measurement

1. Add Nx only to the relevant existing GitHub Actions job(s), initially
   keeping the existing workflow boundaries, GitHub-hosted runners, npm
   install, and required checks.
2. Measure local-cache behavior separately from CI cache behavior. Hosted
   runners are clean; CI reuse requires an explicitly approved remote cache
   or persistent cache mechanism. Review token access, fork PR behavior,
   cache poisoning boundaries, retention, and vendor/plan implications before
   enabling remote writes.
3. Trial `nx affected` with explicit PR base/head SHAs and inspect its task
   graph on representative code, test-only, workflow, docs, and contract
   changes. Make sure changes to shared/root configuration invalidate the
   appropriate targets. Do not use affected selection to skip security,
   contract, or other repository-wide policy checks.
4. Compare median wall time and runner minutes over at least 10 comparable
   runs where practical, and record cache-hit rates, failures, and maintenance
   overhead. Include cold-cache runs; warm-cache-only measurements overstate
   gains.

**Proposed decision threshold:** adopt Nx for CI only if correctness and
required-check coverage are unchanged and the measurements show repeatable,
material savings (suggested initial bar: at least 20% reduction in the
targeted build/unit-test job's median duration) or a clear project-growth
benefit that the team values more than the added maintenance. Revisit the bar
if workflow timings show that setup, browser install, or E2E dominates instead.

### Phase 4 — Roll out or roll back

- If the pilot meets the agreed bar, document supported Nx commands, keep the
  npm aliases used by contributors where practical, and expand CI adoption
  gradually. Add projects or libraries only when there is a concrete sharing
  or ownership need.
- If it does not meet the bar, remove only the pilot's Nx dependency/config
  changes and retain any independently useful baseline measurements. Do not
  combine rollback with unrelated Angular, Vitest, test partition, or
  repository-structure changes.

## Risks and controls

- **False cache hits:** define and review task inputs, outputs, environment
  dependencies, and target dependencies; test invalidation deliberately.
- **Skipped safeguards:** keep governance scripts as explicit task
  prerequisites and retain repository-wide CI checks regardless of affected
  project selection.
- **Angular/custom builder incompatibility:** prove the exact Angular 21.2.x
  dependency combination and strict dev-server behavior during the spike.
- **E2E cache staleness:** keep E2E uncached until backend revision and other
  external inputs are deterministic and represented in hashing.
- **Remote-cache trust and access:** decide policy before sharing cache writes,
  especially for pull requests from forks. Do not put cache credentials in
  source or expose write credentials to untrusted jobs.
- **Overstated affected-task savings:** measure task selection for this
  one-project graph; do not describe project-level affected execution as
  per-file test selection.
- **Scope creep:** app/library extraction and consolidation with
  `qagwaai/solid-train` are explicitly out of scope for the initial pilot.

## Research references

- Repository workspace: [`angular.json`](../angular.json),
  [`package.json`](../package.json), [`vitest.config.mts`](../vitest.config.mts),
  [`playwright.config.ts`](../playwright.config.ts), and
  [`.github/workflows/`](../.github/workflows/).
- Repository testing guidance: [`docs/testing-policy.md`](./testing-policy.md)
  and [`AGENTS.md`](../AGENTS.md).
- Nx, _Building and Testing Angular Apps in Nx_:
  <https://nx.dev/docs/getting-started/tutorials/angular-monorepo-tutorial>
- Nx, _Cache Task Results_ (including its warning about caching
  backend-dependent E2E tasks):
  <https://nx.dev/docs/features/cache-task-results>
- Nx, _Run Only Tasks Affected by a PR_ (including task input requirements):
  <https://nx.dev/docs/features/ci-features/affected>

This is a codebase-based assessment and adoption plan, not a completed Nx
migration or a verified compatibility matrix. The exact Nx / Angular plugin
version pair and remote-cache option remain validation decisions for the
pilot.
