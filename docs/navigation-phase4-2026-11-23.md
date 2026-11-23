# Ship navigation: Phase 4 planning and progress

Date: 2026-11-23
Status: Session closed by owner on 2026-11-23. P4-01 and its presentation cleanup
accepted within the documented scope and validation limits. Owner handles
commits and pushes in both repositories; no live-data changes approved.

## Goal

Resolve the foundations needed to extend the implemented Phase 3 route planner:
consistent departure time and position, intentional starter placement,
authoritative drive progression, qualified hazard coverage, and dependable
position lifecycles. Use evidence and owner decisions to authorize small,
testable implementation slices.

This document starts from the
[current Phase 3 handoff](./ship-navigation-2026-11-14.md#phase-3-frontend-closeout-2026-11-23).
The [historical Phase 3 plan](./ship-navigation-phase3-plan-2026-11-21.md)
and [implementation prompt](./ship-navigation-phase3-implementation-prompt.md)
are background, not instructions to replay earlier proposals.

## Ownership and approval boundaries

- Nova owns frontend search, ranking, presentation and Viewer geometry in
  `laughing-octo-journey`.
- Forge owns backend authority, data, calculations and OpenAPI in `solid-train`.
  Each agent works only in its own repository and maintains its own operational
  ledger. Exchange findings through the linked sessions.
- The integration authority is the served
  [OpenAPI](http://localhost:3000/openapi.yaml), its referenced schemas, and the
  [API documentation](http://localhost:3000/docs/). Report missing semantics as a
  contract gap; implementation or handoff prose cannot replace the contract.
- Planning approval does not authorize implementation, live writes, seeding,
  migration, repair, relocation, retimestamping, server restart, commit or push.
  Obtain separate approval for the relevant scope.
- Preserve Phase 2 compatibility and current accepted Phase 3 behavior unless a
  change is explicitly approved. Do not silently clamp speed or infer capabilities.
- Planning eligibility is not flight authorization or physical clearance.
- Global coordinate redesign, detailed crash recovery, transfer journals,
  applied gravity benefits and interstellar transforms are not prerequisites.

## Evidence baseline

The initial read-only review was completed by Forge as `REVIEW-001`, attempt 2,
on 2026-11-23. Nova received the substantive findings and independently checked
the served solar-system OpenAPI module and route request/response schemas.
Those endpoints returned HTTP 200. No live ship records or authenticated
gameplay operations were inspected during this review.

Forge reported backend HEAD
`83bfe4891a8c2ecd698e2680b35d4bffc6f2488c` on `main`, initially clean and unchanged
after review, with only its local communication ledger untracked. Nova's frontend
baseline was HEAD `bf061ab`, with no tracked application changes.

Backend implementation findings below are attributed to Forge; Nova did not
independently inspect backend source. No tests were run for this assessment.
Test results in the Phase 3 handoff are historical evidence, not Phase 4 validation.

### Confirmed current contract and frontend behavior

- Operation: `POST /socket/navigation-route-edge-batch`.
- Current chosen planner profile: `stellar-sol-station-100au-v1`. Omitted profile
  retains legacy compatibility; it is not the current product recommendation.
- `ship-drive-normal` checks each calculated leg against captured
  `driveProfile.rangeAu`. There is no separate drive-imposed whole-route range.
- `bounded-preview-100au` ignores ship range, requires the 100 AU profile, and
  remains a planning preview. Both modes return `flightAuthorized: false`.
- Route speed is fixed at 12,466.489225 km/s and fuel at 1 prototype unit/AU.
  Captured profile speed and fuel fields do not establish progression in these
  calculations.
- Backend batch limits are 32 jobs and 192 logical legs. The frontend owns its
  512-dispatched-job and 30-second search budgets.
- Current frontend choices include at most five complete alternatives, including
  the supported direct reference. Accepted display behavior and limits remain
  documented in the Phase 3 handoff.
- The response capture description says pinned values, including the clock,
  are revalidated. Forge reports a mismatch between that wording and current
  evaluation behavior; item P4-01 tracks the resolution.

## Ordered work and progress

Statuses: **Not started**, **Investigating**, **Awaiting decision**, **Approved**,
**Implementing**, **Validating**, **Done**, or **Blocked**.
An item is Done only when its approved outcome is implemented where required,
validated, and recorded below. Initial findings are not completed implementation.

| Priority / ID | Work item                                              | Lead         | Status            | Gate                                                                         |
| ------------- | ------------------------------------------------------ | ------------ | ----------------- | ---------------------------------------------------------------------------- |
| 1 / P4-01     | Departure position, epoch and continuation consistency | Forge + Nova | Done              | Owner accepted bounded implementation and presentation; limitations retained |
| 2 / P4-02     | Cold Boot and Sol-origin placement                     | Forge + Nova | Awaiting decision | Establish intended starter location and existing-ship policy                 |
| 3 / P4-03     | Authoritative drive assignment and progression         | Forge + Nova | Awaiting decision | Approve capability authority and lifecycle, not just presets                 |
| 4 / P4-04     | Sol survey completeness and qualification              | Forge        | Investigating     | Inventory gaps and agree completion/acceptance criteria                      |
| 5 / P4-05     | Continuing ship-position lifecycle                     | Forge + Nova | Not started       | Scope attachment, placement and invalidation behavior                        |
| 6 / P4-06     | Representative validation and performance              | Forge + Nova | Not started       | Approve scenarios, authorized access and measurable targets                  |
| 7 / P4-07     | Flight execution and resource rules                    | Forge + Nova | Not started       | Separate product and execution-contract approval                             |

This order guides discussion, not automatic execution. P4-01 informs timed-route
validation and continuing-position work. P4-02 and P4-03 can be designed separately
once their scopes are approved. Contract-compliant live scenarios depend on the
relevant departure, drive and survey decisions; performance measurements may
proceed independently if approved. P4-07 is not authorized by completion of the
planning items.

### P4-01: departure position, epoch and continuation consistency

**Initial finding (resolved by IMPLEMENT-001/ADOPT-001):** Forge reported that navigation state/capture pin the saved ship
position and epoch, while direct references and edge jobs start at that saved
position using separately read current game-clock epochs. Continuation reportedly
checks clock generation/lineage but not captured `clockEpochMs`. Contract wording
about pinned clock revalidation therefore needs reconciliation.

**Accepted owner direction:** use the saved
coordinates as the current game position and assume the planned journey begins
when the search starts. Pin that departure for the entire search; later legs
use their calculated times. Do not propagate an old snapshot or rewrite its
stored epoch. The backend capture point and exact contract semantics were agreed
in DESIGN-004 and implemented in IMPLEMENT-001/ADOPT-001.

Planning does not start travel. The owner expects a later explicit Start Travel
action on a chosen route. Its authorization, actual departure time and any
revalidation/recalculation are separate execution-design decisions, not approved
by the planning-time assumption.

**Decisions to capture:**

- [x] Capture the owner's position/time direction: saved position, search-start
      departure and one pinned departure throughout the search.
- [x] Reach owner/Nova/Forge agreement on exact capture semantics and distinguish
      capture fields from historical saved-state metadata.
- [x] Define normal clock advancement versus generation/lineage changes and
      which changes invalidate a capture.
- [x] Specify continuation/source consistency and explicit failure behavior.
- [x] Approve the contract and implementation slice before editing.

**Acceptance evidence:**

- [x] Served OpenAPI and referenced schemas define the corrected capture/timing rule.
- [x] Focused checks cover direct, multi-leg and multi-batch calculations sharing the intended departure;
      ordinary elapsed real time between batches does not silently shift it.
- [x] Focused tests cover clock changes, source changes and unchanged saved state.
- [x] Frontend capture validation and mocked display consume the corrected contract.
- [x] Owner accepts the integrated result and presentation cleanup for session
      closeout; bounded signed-in preview evidence and limitations recorded below.

#### Owner discussion: 2026-11-23

- Scope remains planning-contract clarification only. The current player
  presentation is the starting point and will evolve; no UI redesign is approved.
- Docked ships are intended to follow their station. How the backend establishes
  docking and resolves that current position needs explicit review; do not assume
  a historical saved snapshot or purchase lineage implements that lifecycle.
  Forge should identify whether this is a dependency or a separate limitation.
- The owner has not chosen a rule for relevant changes during a planning search.
  Source-change invalidation remains open; in-flight events are a different case.
- Solar storms and tier-dependent navigation responses are initial future ideas:
  a sufficiently capable navigation computer might replan during travel, while
  Tier 1 might notify the captain/pilot and leave the response to them.
  These are not approved hazard, tier, notification or automation requirements.
- Save/resume semantics and pausing need future discussion. Do not infer either
  from existing behavior or expand this slice to implement them.

#### Forge design review: DESIGN-001

Forge agrees with using saved coordinates, a single search-start epoch and
consistent replay of direct, prefix and continuation jobs. Its proposed capture
point is one authoritative backend clock read when a valid bootstrap is
established, not the browser click timestamp.

Proposed field meanings, pending exact contract review and not implemented:

- `clockEpochMs` identifies search-start game time.
- `departureEpochMs` equals that search-start time.
- A distinct `shipPositionEpochMs` preserves the saved coordinate snapshot epoch.
- The stored position and its epoch remain unchanged. Association with current
  planning time is a game convention, not physical propagation.

Forge reports the current evaluator rereads the clock for jobs/direct results,
and the current continuation path does not compare the request candidate pool
with the captured pool. It proposes consuming the pinned epoch and enforcing
candidate-pool consistency. Normal clock advancement should not invalidate the
capture; generation/lineage changes should. Exact schema compatibility and error
behavior require contract review before implementation.

The owner approved invalidation on relevant captured source, ship, ownership,
drive, destination, profile, mode or candidate-pool changes. A fresh bootstrap
is required and the UI waits for another explicit Plan Route action; no automatic
retry. Ordinary clock advancement keeps the pinned departure valid; a clock
generation/lineage reset invalidates it.

Dock-following is an intended but unimplemented position producer. Forge reports
current docking status/purchase placement establishes a snapshot, not continuing
attachment. The owner accepted retaining that explicit limitation for this slice;
station-following remains separate work.

Bootstrap captures are server-held and not restart-persistent. Lost captures
must fail explicitly and require a fresh bootstrap. This proposal establishes no
durable capture or crash-recovery guarantee. Start Travel, save behavior, pausing
and in-flight responses remain deferred.

Suggested later slice: clarify the contract first; capture and reuse one epoch;
guard candidate-pool consistency; test direct/job/continuation timing, relevant
changes and absence of persisted ship mutation. No implementation authorized.
Forge reports unchanged backend HEAD and only its local ledger untracked; no
tests run for this design review.

#### Celestial-motion discussion

The owner raised whether celestial bodies currently move with the game clock and
whether station-following is consequently simpler than assumed. Do not equate
absence of persisted position updates with absence of time-based position
evaluation, or equate either with Viewer animation.

Before expanding scope, distinguish stored snapshots, positions evaluated at a
requested game epoch, and displayed positions. Forge will clarify current backend
behavior and API support read-only. Determine whether station-following can reuse
an existing evaluator, and separately identify attachment/offset lifecycle gaps.
A world-wide position-update loop, live migration or movement implementation is
not approved by this discussion.

**Required future discussion: celestial movement across the application.**
The owner explicitly wants this addressed, not lost behind the current
route-consistency slice. Broader adoption of game-clock-based celestial positions
may affect Viewer presentation, stations and docked ships, proximity/docking,
market distances, mission geometry, navigation captures and cached snapshots.
These are areas to assess, not confirmed defects or approved changes.

Review which consumers need current, captured or predicted positions; how they
share basis and epoch; and how moving positions affect source revisions and
invalidation. Keep raw stored snapshots distinct from derived poses so later
motion support does not silently change existing coordinate semantics. Consider
these dependencies in new designs without requiring a world-tick implementation
now. Scope, rollout, compatibility and validation require separate agreement.

#### Forge clarification: DESIGN-002

Forge reports that celestial bodies have time-dependent orbital models, but
stored coordinates do not continuously advance with the shared game clock.
Ordinary solar-system reads return snapshots and may seed records. Certified Sol
navigation can evaluate supported catalog bodies at requested epochs without
persisting their motion. The Sun remains the fixed Sol model root; these
capabilities must not be generalized to unsupported/manual bodies or all systems.

Time sources are not universally synchronized: seeding/purchase use wall time;
ordinary station materialization uses the host's saved epoch; current navigation
state uses the ship's saved epoch. A suitable evaluator supplied with game-clock
time yields time-dependent orbital phase, but this is not proof every consumer
already uses that clock.

**Additional route consistency gap, reported by Forge:** Phase 3 market-target
evaluation moves the station's host to arrival time but retains a station offset
from the saved-epoch state. It does not reevaluate the station's own orbit at
arrival. The direct-reference destination vector reportedly remains the saved
position even though distance is solved against the moving-host/frozen-offset
target, and a source fallback can use a saved host on evaluation failure.
Nova has not independently inspected backend implementation. The served
edge-batch contract does not clearly qualify these associations. Phase 2's
future-station prediction promise must not be assumed to cover Phase 3.

Track this alongside P4-01 before claiming timed-route endpoint consistency:

- [x] Owner direction: evaluate both host and station orbit at calculated arrival
      time and return that same solved endpoint.
- [ ] Define returned endpoint/epoch association and explicit unsupported or
      failed evaluation behavior; no undocumented saved-position fallback.
- [ ] Review direct-reference geometry/distance and selected-route display against
      that contract, with focused tests after separate implementation approval.

**Station-following options:** Forge recommends discussing durable attachment
with on-demand derived pose: verified host/station pose at one game epoch plus a
defined station-relative ship offset. This need not require a world-wide write
loop. Alternatives are periodic materialization or a hybrid with transition
snapshots/cache. Neither geometry reuse nor `status=docked`, purchase lineage or
proximity establishes a durable attachment.

Owner decisions remain: which consumers require current derived pose, attachment
and termination actions, and offset/frame rules. No motion, docking lifecycle or
world-clock redesign is approved. Forge reports no served durable
station-following contract; no live records or frontend files were inspected.

The owner selected on-demand pose as the station-following design direction.
Discuss route departure and destination timing first; attachment lifecycle
follows as a separate slice. Implementation remains unapproved.

#### Route-consistency proposal: DESIGN-003

Forge proposes a coherent timed-route contract:

- Capture saved ship vector/snapshot epoch separately from one backend
  search-start game epoch. Use the same departure for direct results and every
  replayed path; chain later legs to exact returned endpoints and arrival times.
- Solve market arrival against the full certified host parent chain and station
  orbit at candidate epochs. Reevaluate the full target at the rounded arrival
  and return that endpoint; distance, fuel and range derive from the same geometry.
- Keep integer duration equal to arrival minus departure. Verify fixed-speed
  consistency within documented solver/rounding residual, not exact unrounded
  equality.
- Reuse appropriate certified Phase 2 target geometry without changing Phase 2
  behavior. Preserve current mode/profile/range, prototype costs and advisory
  hazard semantics.
- Validate captured candidates and source dependencies. Ordinary clock advance
  does not retime or invalidate; relevant input or clock-lineage/generation changes
  invalidate and require explicit Plan Route.
- Use typed unsupported/source/numerical failures instead of saved-host fallback
  or partial success. Do not claim read/hash checks provide atomic snapshots or
  detect changes away and back between checks.

**Compatibility finding:** current capture/direct-reference schemas are
closed. Existing `departureEpochMs` has saved-snapshot semantics in implementation,
and direct references lack departure/arrival epochs. Adding fields/reasons or
changing endpoint semantics is not automatically compatible. Forge recommends
a separately selectable versioned contract with explicit snapshot/search-start
fields and direct timestamps. The owner instead selected a coordinated in-place
breaking correction: move Forge forward and have Nova adopt the corrected
contract, without parallel old-client compatibility or version management.
The owner coordinates deployment. Exact contract and implementation approval
remain separate; do not change unrelated operations merely to remove compatibility.

**Approved failure-policy direction:** a valid direct reference is required.
If it cannot be solved, return an explicit typed failure rather than a silent
null or an alternatives-only successful result. Requiredness is not eligibility:
a supported outside-range direct reference remains valid comparison evidence.
Exact failure taxonomy and batch/search behavior belong in the corrected contract.

Proposed validation covers pinned epochs across jobs/continuations, unchanged
saved state, nonzero station-orbit counterexamples, rounded endpoint/time/cost
consistency, typed failures, source/candidate/clock changes and legacy regressions.
No tests, schema or application changes were performed for DESIGN-003.

#### Final contract proposal: DESIGN-004

This proposal supersedes earlier field-name and side-by-side version suggestions.
It is ready for technical contract review and scoped owner implementation approval,
not yet an implemented or served contract.

**Operation and requests**

- Retain the existing endpoint, Socket.IO events, request operation
  `navigation-route-edge-batch.v1` and response request identity. Correct the
  contract in place; owner coordinates deployment.
- Bootstrap omits both `bootstrapId` and `planningRevision`; continuation requires
  their matching opaque pair and consistent selection/profile/mode.
- Require unique job IDs, aligned prefix sides, destination matching, and captured
  candidate membership. Candidate pools are canonical sets; reject duplicates
  and changed continuation sets. Omission on continuation uses the captured pool.

**Capture and timing**

- Rename capture `departureEpochMs` to `shipPositionEpochMs`: original saved
  position snapshot epoch.
- Rename capture `clockEpochMs` to `searchStartEpochMs`: one authoritative
  backend game-clock reading when bootstrap is established.
- Keep exact saved `departurePositionKm` and existing capture revisions/identity/
  drive/profile/model fields. Planning does not move or retimestamp the ship.
- `batch.clock` reports validated current response time without retiming capture.
  Generation/lineage changes invalidate; ordinary advancement does not.
- Direct references add required departure/arrival epochs. Departure equals the
  captured search start; returned destination is the full certified station pose
  at its own rounded arrival. Every market-target leg uses that same evaluator
  at its own arrival, not the direct route's arrival.
- Each path starts at the captured vector/time and chains exact prior returned
  endpoint/arrival. Distance uses returned endpoints; fuel/range/hazards use that
  geometry; duration equals integer arrival minus departure; totals sum legs.
- Verify each leg's fixed-speed timing residual after rounding:
  `abs(departureEpochMs + 1000 * distanceKm / 12466.489225 - arrivalEpochMs) <= 1 ms`.
  Reevaluate target geometry at rounded arrival; reject nonfinite or unresolved
  numerical output.

**Failures and completion**

- Successful batches always contain a valid direct reference, including
  supported-but-ineligible outside-range references.
- Required direct failure at bootstrap or continuation fails the entire batch.
  Common authentication/capture/source/clock/drive mismatches also fail the batch.
  Do not accept retained alternatives from that failed search.
- Proposed failed batch has `status: 'failed'`, empty `jobs`, and null `capture`,
  `clock`, `directReference`, `bounds`, `hazardSurvey`, `numericPrecision` and
  `completion`. Top-level `success: false` includes a typed failure and sanitized
  nonempty message; no fabricated metadata or partial usable results.
- Define and explicitly map the closed operation failure reasons in OpenAPI.
  Forge proposed request/authentication, unsupported position/target, clock,
  capture/source/drive, direct-target/source/numerical and read/evaluation reasons.
  Exact emitted mappings require review; an enum name such as `capture_expired`
  does not authorize a new TTL or persistence mechanism.
- Per-job failure contains no legs. Proposed job-only reasons:
  `OUT_OF_DOMAIN`, `ENCOUNTER_UNAVAILABLE`, `TARGET_UNSUPPORTED`, `NUMERIC_FAILURE`.
  Common source/capture failures remain batch-level.
- Completion includes mode, submitted/successful/failed job counts and logical-leg
  count. Return unique terminal records in request order; missing requested IDs
  mean unfinished work. Document count definitions and request-limit accounting
  exactly in the schemas.
- Mode is `complete` when every requested job has a terminal result, including
  failures. Timeout/interruption/budget labels require observed unfinished work,
  not a timeout hint or failed job. Batch status is `supported` only when complete
  with no failed jobs, otherwise `incomplete`.
- Nova may show complete alternatives from an incomplete successful batch with
  explicit incomplete/failure disclosure. Stale/common failure discards the search
  and offers manual Plan Route; no automatic retry.

**Implementation gate and validation**

Forge first proposes/updates the exact OpenAPI, closed schemas, examples and
reason mappings, then reuses suitable certified target geometry, pins replay
time and enforces source/pool checks. Review the corrected served contract before
Nova adopts it; unavailable or insufficient served detail blocks adoption.
No implicit server restart is authorized. Owner controls deployment and restart.

Proposed backend checks, not run:

- `node --test test\navigation-route-edge-batch.test.js test\navigation-prediction.test.js test\navigation-position-contract.test.js`
- `npm run typecheck`
- `npx --no-install swagger-cli validate api\openapi.yaml`, if locally available.

Focused regressions must expose old per-job clock reads, frozen nonzero station
offsets, inconsistent direct endpoints, unchanged saved state, required direct
failure, typed numerical/source failures, clock/reset/candidate/input changes and
unchanged planner/range behavior. Nova adds focused contract/behavior checks for
the changed fields and timing residual, direct/stale failures, manual replan,
incomplete display and ineligible references. Run Angular build for affected
template/type changes and appropriate deterministic Playwright checks.

Station-following attachment, broader celestial movement, Start Travel and
save/pause behavior remain outside this slice.

#### Implementation authorization: 2026-11-23

The owner approved the bounded route-consistency slice. Implement Forge's
corrected backend contract and evaluator first, allowing technical findings to
be resolved before Nova adopts. Pause at backend contract readiness, request the
owner's restart, then inspect the served OpenAPI and referenced schemas before
frontend implementation. Pause again after integrated validation.

Authorized checks: focused backend numerical/contract regressions and schema
validation; frontend Vitest, build/typecheck and deterministic mocked Playwright
for affected behavior. No live seeding/migration, ship relocation, server restart,
commit or push is authorized.

The owner reports Forge is running and will restart it when prompted; Nova's
development server at `http://localhost:4200` watches changes. Reuse it for browser
checks rather than starting another server. A watch server is not evidence of a
successful compiler check: run targeted validation and a real Angular build after
affected type/template changes. Do not repeatedly build unchanged code.

The owner can log in to a session-attached browser for later verification.
Arrange the exact live scenario and side-effect authorization separately; this
offer does not authorize credential discovery or gameplay reads that seed data.
Defer Prettier until session end as requested.

### P4-02: Cold Boot and Sol-origin placement

**Finding:** Forge reports the starter ship is saved at Sol `(0,0,0)`, numerically
the certified system-root Sun position, without navigation placement lineage.
A legacy asteroid-belt anchor fallback is `(414012000,0,0)` km; the belt is not in
the assembled Sol catalog body list. These code findings do not establish live
ship locations or prove a valid belt start.

Nova also found that the frontend
[ship spatial validator](../src/app/model/math/spatial.ts) rejects positions less
than 1 km from system zero, and the
[Viewer renderer](../src/app/scene/viewer/viewer-system-scene.ts) shows such ships
at a synthetic unknown-position marker. A render fallback is not a saved position.

Sun-centered Sol zero is intentional. It must not be confused with a universe-wide
system location, a ship's physical start, or a scene-space offset.

**Decisions and acceptance evidence:**

- [ ] Define the intended Cold Boot belt start, basis, epoch and mission-relative
      geometry while preserving its existing sequence.
- [ ] Distinguish new-character placement from purchased ships.
- [ ] Inspect relevant live rows only through separately authorized access.
- [ ] Agree whether existing origin-position ships need action; do not silently
      relocate, relabel or retimestamp them.
- [ ] Validate that saved, navigation and displayed positions tell a consistent
      story, including explicit unavailable states.

### P4-03: authoritative drive assignment and progression

**Finding:** Forge found no gameplay drive-profile assignment/upgrade lifecycle.
Starter and current tier-1 market ships lack profiles; tier updates do not
automatically update `driveProfile`. Missing/invalid normal-mode profiles fail
explicitly. Route speed/fuel remain fixed prototypes.

The frontend [drive helper](../src/app/model/math/drive-profile.ts) resolves
explicit profiles, then model/tier presets. The
[market page](../src/app/page/game/market-hub.ts) uses these for travel estimates
and direct-distance range labels, whereas the planner consumes backend-captured
range for each leg. These are not an approved unified progression model.

**Decisions and acceptance evidence:**

- [ ] Define installed-drive authority versus ship tier/model and inventory.
- [ ] Approve progression/balance separately from existing prototype values.
- [ ] Define acquisition, upgrade, replacement and legacy/unavailable-profile rules.
- [ ] Decide whether and how profile speed/fuel affect navigation estimates.
- [ ] Define capture invalidation when the authoritative drive changes.
- [ ] Align market estimates, route eligibility and capability labels with the
      served contract; preserve the distinction between direct and multi-leg range.
- [ ] Validate representative profiles and unavailable/changed-drive cases.

### P4-04: Sol survey completeness and qualification

**Finding:** Forge reports advisory survey membership covers catalog stars,
planets, moons and dwarf planets, not asteroid populations or comets. Assessment
uses coarse envelopes and midpoint-time checks and can return unresolved inputs.
Hazard assessment and planner eligibility are separate.

The Phase 3 handoff records a live Mars example with 378 unresolved assessments
on its direct reference. That observation does not establish a complete survey
or representative performance. The original complete-survey requirement remains
an acceptance gap to resolve explicitly, not silently redefine as satisfied.

**Decisions and acceptance evidence:**

- [ ] Inventory missing profiles, missing poses and unresolved computation
      separately; record provenance and known absence versus missing research.
- [ ] Agree required inventory and completion criteria, including the Sun and
      applicable surfaces, atmospheres and rings.
- [ ] Review approximation limitations and whether they meet the intended advisory
      use; do not describe `clear-within-survey` as physical safety.
- [ ] Obtain separate approval for any research-driven generation or live backfill.
- [ ] Validate moving hazards, incomplete data and useful warning presentation.

### P4-05: continuing ship-position lifecycle

**Finding:** Supported purchases can receive durable station-placement lineage;
unsupported purchase fallback snapshots do not establish equivalent certification.
Historical placement is not proof of continuing station attachment.

**Decisions and acceptance evidence:**

- [ ] Define station-following versus fixed game-position behavior and its epoch.
- [ ] Scope a genuine docking/attachment lifecycle rather than infer it from
      proximity or historical purchase lineage.
- [ ] Define outside-station purchase geometry, ship/station dimensions, spacing,
      occupancy/concurrency handling and explicit unavailable outcomes.
- [ ] Define invalidation on movement, transfer and relevant updates.
- [ ] Preserve Cold Boot's separate flow and avoid mandatory journal/crash-recovery
      expansion without demonstrated need and separate approval.

### P4-06: representative validation and performance

**Finding:** Forge reports synchronous evaluation of supplied jobs; `timeoutMs`
does not interrupt evaluation, and completion mode is assigned after evaluation
based on job failures. Neither the client deadline nor the current schema
establishes backend cancellation or a measured service-level guarantee.

**Decisions and acceptance evidence:**

- [ ] Define truthful timeout, interruption, failure and completion semantics.
- [ ] Agree measurable latency/workload targets before claiming responsiveness.
- [ ] Measure batch CPU, event-loop impact, hazard workload and representative
      concurrency; retain the client deadline without claiming server cancellation.
- [ ] Validate authorized journeys across starts, stations and drive profiles,
      including outside-range direct references and incomplete surveys.
- [ ] Evaluate route diversity, multi-encounter depth and bounded-search disclosure.
- [ ] Record focused backend checks, frontend Vitest and relevant Playwright
      evidence. Run the Angular build for template/type changes.
- [ ] Separate observed live evidence, mocked regression tests and benchmarks.

### P4-07: flight execution and resource rules

Current planning results do not authorize or move a ship.

- [ ] Obtain separate approval for departure authorization and route revalidation.
- [ ] Define movement, arrival, interruption and ownership/position changes.
- [ ] Define actual fuel consumption and any life-support constraints.
- [ ] Publish an execution contract and validate it separately from route preview.
- [ ] Keep applied gravity benefits and interstellar behavior separately scoped.

## Decision log

Record explicit owner decisions here before treating a proposal as approved.

| ID    | Date       | Decision                                                                                              | Scope / consequence                                                                                                                   |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| D4-01 | 2026-11-23 | Start this planning document from the reviewed priority list                                          | Documentation and progress tracking only; no implementation approval                                                                  |
| D4-02 | 2026-11-23 | Use saved coordinates as current position; plan from search start and pin departure across batches    | Owner direction; exact backend capture and continuation contract await three-party agreement                                          |
| D4-03 | 2026-11-23 | Keep the first slice limited to planning-contract clarification                                       | Start Travel, saves, pausing and in-flight storm/tier behavior require later discussion; docked ships should follow stations          |
| D4-04 | 2026-11-23 | Capture departure with one backend clock read when a valid bootstrap is established                   | Separate saved-position snapshot epoch from planning time; exact schema design still subject to review                                |
| D4-05 | 2026-11-23 | Relevant captured-input changes invalidate planning; require explicit Plan Route again                | No automatic retry; ordinary clock advance preserves pinned departure, generation/lineage reset invalidates                           |
| D4-06 | 2026-11-23 | Keep station-following separate and retain its explicit limitation in saved-position planning         | Discuss celestial time/position behavior before expanding position-producer scope                                                     |
| D4-07 | 2026-11-23 | Phase 3 station destinations use full host and station pose at arrival and return the solved endpoint | Design route timing/geometry consistency first; no implementation approval                                                            |
| D4-08 | 2026-11-23 | Explore persisted attachment with on-demand station-following pose                                    | Attachment lifecycle and consumer design follow route consistency as separate work                                                    |
| D4-09 | 2026-11-23 | Explicitly retain application-wide celestial movement as a required future discussion                 | Assess affected consumers and shared position/time semantics; no implementation or scope expansion approved                           |
| D4-10 | 2026-11-23 | Correct the current route contract in place; Forge moves forward and Nova adopts                      | Owner coordinates deployment; no parallel-version/old-client compatibility work required; implementation still awaits scoped approval |
| D4-11 | 2026-11-23 | Require a solvable direct reference; fail explicitly if unavailable                                   | Outside-range supported direct references remain valid; no alternatives-only success or silent null                                   |
| D4-12 | 2026-11-23 | Approve bounded route-consistency implementation: Forge first, then Nova adoption                     | Backend readiness/owner restart/served-contract review gate; focused automated validation; final integrated review                    |

## Work and validation log

Append an entry for each approved slice. Include work-item ID, approval reference,
modified files, exact validation commands/results, remaining blockers and next gate.
Do not mark historical checks as new validation.

| Date       | Item                 | Progress / evidence                                                                                                                                                                                                 | Next gate                                                                       |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2026-11-23 | REVIEW-001           | Forge completed read-only orientation; Nova checked served contract and frontend status. No application tests or live-data reads performed.                                                                         | Owner discussion, beginning with P4-01                                          |
| 2026-11-23 | Planning             | Created this document with initial findings, ordered work, decision gates and acceptance checklists.                                                                                                                | Approve a bounded planning/design task                                          |
| 2026-11-23 | P4-01                | Owner answered a structured departure questionnaire; recorded direction and deferred topics. No implementation authorized.                                                                                          | Forge design review, then resolve remaining owner decisions                     |
| 2026-11-23 | DESIGN-001           | Forge agrees on pinned departure and proposes explicit snapshot/search epoch fields, source invalidation and candidate-pool guard.                                                                                  | Owner agreement on capture point, invalidation UX and dock-following limitation |
| 2026-11-23 | DESIGN-002           | Forge distinguishes stored snapshots from orbital evaluation and recommends discussing on-demand station pose. Reports a Phase 3 station-offset/direct-endpoint contract gap.                                       | Decide target-time geometry scope and station-following design direction        |
| 2026-11-23 | DESIGN-003           | Forge proposes coherent full-target timed geometry and separately versioned contract with focused regression checks.                                                                                                | Owner compatibility/deployment and direct-reference failure policy decisions    |
| 2026-11-23 | DESIGN-004           | Forge supplies in-place contract/adoption proposal with pinned time, solved endpoints, required direct, typed failures and truthful completion. No tests or API edits performed.                                    | Technical contract review and owner-scoped implementation approval              |
| 2026-11-23 | P4-01 implementation | Owner approved backend-first implementation and subsequent Nova adoption; excludes broader movement/attachment/travel work.                                                                                         | Forge contract-ready report, then owner restart and served-contract review      |
| 2026-11-23 | IMPLEMENT-001        | Forge reports corrected contract/evaluator on disk: pinned capture time, full station arrival pose, coherent direct/leg geometry, source/pool guards, typed failures and truthful completion. No restart performed. | Owner restart; verify running handler and served schemas before Nova adoption   |
| 2026-11-23 | Nova adoption        | Owner confirmed backend restart and authorized invalid unauthenticated probe. Corrected served schemas and failed-batch runtime path verified; models/guards/fixtures/dialog updated. Focused checks below passed.  | Owner integrated review; optional separately authorized signed-in validation    |

### Backend contract-ready validation: IMPLEMENT-001

Forge reported these final checks; Nova has not independently run backend tests:

- `node --test test\navigation-route-edge-batch.test.js test\navigation-prediction.test.js test\navigation-position-contract.test.js test\socket-handler-registry.test.js`: passed, 46 tests.
- `npm run typecheck`: passed.
- `node -e "require('@apidevtools/swagger-parser').validate('api/openapi.yaml').then(() => console.log('OpenAPI valid')).catch(e => { console.error(e); process.exitCode = 1; })"`: passed.
- `.\node_modules\.bin\eslint.cmd src\handlers\context\navigation-route-edge-batch-service.js src\handlers\context\navigation-state-service.js src\handlers\navigation-route-edge-batch-message-handler.js src\handlers\socket-handler-registry.js test\navigation-route-edge-batch.test.js test\socket-handler-registry.test.js`: passed.
- `git --no-pager diff --check`: passed.
- Earlier `npx --no-install swagger-cli validate api\openapi.yaml` failed because
  the local executable was missing. Existing Swagger Parser validated successfully;
  no dependency was installed. Initial partial-edit failures were resolved.

Forge reports ten directly related tracked files changed across OpenAPI/schemas,
handoff, evaluator/state/handler/registry and tests, plus its local ledger.
Backend HEAD unchanged; no restart, commit, push, live-data change or Prettier.

Current implementation processes all jobs synchronously: completion mode is
`complete`, batch status becomes `incomplete` for terminal job failures, and
`timeoutMs` remains a hint rather than an enforced server deadline. Captures
remain in-process; source rereads are not atomic or ABA-proof. No performance
benchmark or deployment coherence is established by the tests.

Disk-served schemas may already be new while the running handler is old.
Do not treat HTTP 200 or updated documentation as proof of the corrected runtime.
Nova adoption remains blocked until the owner deliberately restarts and the
contract/runtime gate is verified.

### Nova adoption validation

The owner subsequently confirmed restart. Nova fetched the served root and
solar-system OpenAPI plus route request/response schemas (HTTP 200) and verified
the renamed capture fields, required direct timestamps, failures and completion
definitions. The authorized invalid unauthenticated Socket.IO request returned
`unauthorized` with null failed-batch metadata and no jobs; Ajv validation against
the served response schema passed. Referenced schemas were fetched unauthenticated.
Ajv warned that external `date-time` formats were ignored; this does not prove
date-format validation or full successful-route runtime coherence.

Exact frontend checks:

- `npm run test:spec -- src\app\services\navigation-route-search.service.vitest.ts src\app\services\navigation-route-selection.vitest.ts src\app\scene\viewer\viewer-route-hazard-clusters.vitest.ts`: passed, 51 tests.
- `npm run build`: passed, including Angular templates.
- `npm run typecheck`: passed for app, specs and e2e after final changes.
- `.\node_modules\.bin\eslint.cmd src\app\model\navigation-route-search.ts src\app\services\navigation-route-search.service.ts src\app\services\navigation-route-search.service.vitest.ts src\app\services\navigation-route-selection.vitest.ts src\app\i18n\locales\en.ts src\app\i18n\locales\it.ts e2e\tests\viewer-station-model.spec.ts`: passed.
- `npx --no-install playwright test viewer-station-model.spec.ts -g 'plans and selects calculated routes|blocks route planning for an ineligible navigation preview' --reporter=line`: passed, three tests including mocked setup.
- `git --no-pager diff --check`: passed.

An initial Playwright selector using the backslash-qualified spec path reported
no tests; selecting the filename succeeded. The successful browser run emitted
a port-4200-in-use startup warning. The tests passed against the reachable
frontend, subsequently confirmed HTTP 200; no manual server restart was performed.

Tests verify the exact 1-ms residual boundary, captured departure across advancing
clock responses, geometry/cost consistency, changed captures, required-direct/
stale failures without automatic retry, truthful completion counts and unfinished
IDs, plus updated overlays and manual-replan behavior. Floating-point distance/
fuel comparisons permit only a small machine-precision tolerance, not a gameplay
distance margin. They do not independently certify celestial poses.

No new live ship read, login, gameplay action, migration, commit/push or performance
benchmark. No full-suite claim. Prettier is still deferred. Owner integrated review
is pending; optional signed-in live verification requires a separately agreed
scenario and side-effect authorization.

### Bounded signed-in review: LIVE-001

On 2026-11-23 the owner logged into the shared integrated browser and navigated
to Sol. A selectable form authorized the existing active ship to Mars Orbital
Market: one normal-mode search and one preview-mode search, with UI and sanitized
navigation timing/geometry inspection. No purchases, flight controls, movement,
drive changes, seeding/repair, relocation, restart or credential access authorized.

**Normal mode:** the UI explicitly reported `drive_profile_unavailable`:
the owned ship has no valid `driveProfile.rangeAu`. No choices were accepted,
and manual Plan Route remained enabled. The displayed T1 model/tier is not proof
of an authoritative usable drive. This is evidence for P4-03, not permission to
assign a fallback or repair the ship.

**Preview mode:** changing Ignore drive limits started the existing preview
search automatically; no second Plan Route click was issued. Final client state
was ready/incomplete with 512 completed jobs, zero rejected jobs and zero
unfinished submitted jobs. Five choices were displayed: direct, Mars minus/plus,
Phobos plus and Earth plus. The incomplete label correctly distinguishes a
client-budget-limited exploration from exhaustive search or server failure.

The passive WebSocket observer attached after that search had already begun:

- Observed seven successful supported batches, totaling 203 successful jobs.
  All observed completion modes were complete with zero failed jobs. This is
  partial transport coverage, not a claim to have observed all 512 responses.
- Across those seven responses the captured saved vector/epoch, search-start
  epoch, bootstrap ID and planning revision remained unchanged. Every observed
  direct and first job leg started at that captured origin/time; later leg
  endpoints/times chained exactly.
- Saved epoch was `1794694161611`; pinned search start was `1795379238259`.
  Observed response clock advanced from `1795379249201` to `1795379255175`
  without retiming the capture.
- Independently recomputed Euclidean distances matched the returned distances
  in the observed jobs. Maximum observed leg timing residual was
  `0.494140625 ms`, below the required 1 ms; integer durations and chains matched.
- Direct distance was `15611901.723408457 km`, duration `1252309 ms`,
  fuel `0.10435911721441674`, and timing residual `0.406494140625 ms`.
  The UI rounded these to 15,611,901.723 km / 0.348 h / 0.104 Fuel.
- Read-only inspection of the five final client choices independently checked
  endpoint distances, duration differences, fuel per AU and route leg totals;
  all checked invariants passed. No authentication fields were read or returned.
- Selecting Phobos plus changed the selected choice and displayed its encounter
  ghost at `T+20.9 min`. The UI explicitly reported that its illustrative curve
  was unavailable; this was not treated as a calculated-route failure.
- Survey remained incomplete: 378 unresolved assessments for direct and 756
  for the selected two-leg Phobos choice, with explicit surface/atmosphere
  advisories. All observed captures had `flightAuthorized: false`.

**Presentation finding:** the same route panel still displays the separate
historical Phase 2 geometric preview below the calculated choices: projected at
saved epoch `1794694161611`, hypothetical endpoint distance 0.000 km, and text
that it does not estimate travel time/fuel. Alongside the new nonzero calculated
distance/time/fuel this is confusing. The template renders those snapshot fields
independently of calculated-search state. Separate/hide or clearly label the
two read models before claiming the combined presentation is accepted; no UI
implementation is authorized by this review.

This also illustrates the deferred dock-following limitation: a docked label
does not make a historical saved vector follow the station at search time.
No independent celestial ephemeris/station-orbit oracle, source-reset test,
normal-mode successful route, complete physical survey, exhaustive search,
performance benchmark or actual travel was verified live.

The normal-mode observer ran, but its final UI extraction used an incorrect
component selector and timed out, losing its response summary. Normal-mode
evidence above is the visible error, not a retained wire validation. The preview
observer used the planning heading instead and detached in its cleanup. No
repeat normal/preview search was issued to repair instrumentation coverage.

Only this progress document and Nova's local ledger were edited for LIVE-001.
No application correction, gameplay mutation action, server restart, commit/
push or Prettier was performed. Backend-internal side effects of authenticated
planning were not independently audited. Forge receives an informational
summary and remains paused; owner acceptance and next scope are still required.

### Calculated-route presentation cleanup: UI-001

After LIVE-001, the owner approved hiding the obsolete snapshot-distance block
when calculated choices are available and clarifying the nearby disclaimer.

- Reuse the existing ready-state `routeChoices` computed value: hide the old
  distance/estimate-unavailable block whenever at least one calculated choice
  exists, including a supported but ineligible direct reference.
- Preserve the historical block before planning, after search failure and in
  selections without calculated planning. No Phase 2 operation or renderer changed.
- Show an English/Italian calculated-route disclaimer that acknowledges game
  time/fuel estimates while retaining the unvalidated flight/clearance warning.
  Existing station-access, docking, survey and clearance warnings remain.
- Existing mocked navigation test now checks the fallback before calculation,
  its removal after calculated direct results, the clarified disclaimer and
  clearance warning, and fallback restoration after source/direct failure.

Validation:

- `npm run build`: passed, including Angular template compilation.
- `npm run typecheck:e2e`: passed.
- `.\node_modules\.bin\eslint.cmd src\app\i18n\locales\en.ts src\app\i18n\locales\it.ts e2e\tests\viewer-station-model.spec.ts`: passed.
- `npx --no-install playwright test viewer-station-model.spec.ts -g 'plans and selects calculated routes|blocks route planning for an ineligible navigation preview|clears the previous A-to-B preview' --reporter=line`: passed, four tests including setup.
- `git --no-pager diff --check`: passed.

The initial broader `npx --no-install playwright test viewer-station-model.spec.ts --reporter=line`
run had six passes and four failures in unrelated station targeting/close-up
tests: their `button.details-target-btn` selectors also match Plan Route buttons.
Those selectors were not changed by this cleanup and were left untouched.
The affected navigation flows passed both runs.

The owner watcher reloaded the shared page and cleared its in-memory preview;
the subsequent read-only check found no preview panel. No additional signed-in
route request was issued to reconstruct it. The changed presentation is verified
by deterministic mocked browser tests, not a second live route. No backend
change, repair, restart, commit/push or Prettier; owner acceptance of P4-01 remains.

### Owner acceptance and session closeout: CLOSE-001

The owner confirmed the updated presentation was looking good and requested
session closure on 2026-11-23. P4-01 and UI-001 are accepted for their bounded
planning/contract/presentation scope, not as flight certification or completion
of the remaining Phase 4 items. The owner will commit and push both repositories;
neither agent is authorized to do so.

Current implementation and live review are documented above and in the leading
Phase 4 checkpoint of the navigation handoff. Retain these next-session boundaries:

1. P4-02: discuss intended starter placement and existing-ship lineage/policy;
   Sol Sun zero is intentional, not permission to relocate ships.
2. P4-03: the reviewed active ship lacks a valid authoritative drive range;
   successful normal-mode live planning remains unverified. Define assignment
   and progression rather than silently using a frontend preset.
3. P4-04: survey coverage remains incomplete and advisory, separate from route
   eligibility and physical clearance.
4. P4-05 and the required application-wide celestial-motion discussion: distinguish
   stored snapshots, derived current-at-clock poses and predicted poses; define
   station-following/attachment and affected Viewer/market/mission/cache consumers.
5. P4-06/P4-07: separately approve representative performance/complete numerical
   certification and Start Travel/resources/revalidation. Saves, pausing and
   in-flight replanning remain future discussion, not current features.

No next item starts automatically. The known broader Playwright station-target
selector failures remain documented, not silently repaired in this session.
The signed-in shared browser and owner-owned frontend/backend services are not
closed or restarted by Nova.

Deferred session-end Prettier completed on the ten non-ignored session-touched
files: both navigation documents, the station-model browser spec, both locales,
the route model/template, route-search service/spec and selection spec. The local
Git-ignored ledger was skipped by the repository's existing formatter ignore rules.
No unrelated files or formatter configuration were changed.

Post-format checks:

- `npm run build`: passed, including Angular templates and the partition gate.
- `npm run typecheck`: passed app/spec/e2e.
- `.\node_modules\.bin\eslint.cmd src\app\model\navigation-route-search.ts src\app\services\navigation-route-search.service.ts src\app\services\navigation-route-search.service.vitest.ts src\app\services\navigation-route-selection.vitest.ts src\app\i18n\locales\en.ts src\app\i18n\locales\it.ts e2e\tests\viewer-station-model.spec.ts`: passed.
- `npm run test:spec -- src\app\services\navigation-route-search.service.vitest.ts src\app\services\navigation-route-selection.vitest.ts src\app\scene\viewer\viewer-route-hazard-clusters.vitest.ts`: passed, 51 tests.
- `npx --no-install playwright test viewer-station-model.spec.ts -g 'plans and selects calculated routes|blocks route planning for an ineligible navigation preview|clears the previous A-to-B preview' --reporter=line`: passed, four tests including mocked setup.
- `git --no-pager diff --check`: passed.

Forge's substantive COMPLETE CLOSE-001 attempt 2 was received after its ACK
(reported ACK message ID `f58deb32-535a-4af1-9ecb-2fbfd7357f12`). Forge reports its
backend handoff/local ledger updated and deferred session-file formatting complete,
without new implementation, live actions, restart, commit/push or dependency install.
Ten tracked backend session files remain modified plus its untracked local ledger;
reported HEAD is unchanged at `83bfe4891a8c2ecd698e2680b35d4bffc6f2488c`.

Reported final backend checks:

- `node --test test\navigation-route-edge-batch.test.js test\navigation-prediction.test.js test\navigation-position-contract.test.js test\socket-handler-registry.test.js`: passed, 46/46.
- `npm run typecheck`: passed.
- `node -e "require('@apidevtools/swagger-parser').validate('api/openapi.yaml').then(() => console.log('OpenAPI valid')).catch(e => { console.error(e); process.exitCode = 1; })"`: passed.
- `.\node_modules\.bin\eslint.cmd src\handlers\context\navigation-route-edge-batch-service.js src\handlers\context\navigation-state-service.js src\handlers\navigation-route-edge-batch-message-handler.js src\handlers\socket-handler-registry.js test\navigation-route-edge-batch.test.js test\socket-handler-registry.test.js`: passed.
- `.\node_modules\.bin\prettier.cmd --check api\openapi\solarsystem\openapi.yaml api\schemas\navigation-route-edge-batch-request.schema.json api\schemas\navigation-route-edge-batch-response.schema.json docs\ship-navigation-phase3-session-handoff-2026-11-23.md src\handlers\context\navigation-route-edge-batch-service.js src\handlers\context\navigation-state-service.js src\handlers\navigation-route-edge-batch-message-handler.js src\handlers\socket-handler-registry.js test\navigation-route-edge-batch.test.js test\socket-handler-registry.test.js .vscode\linked-navigation-state.md`: passed.
- `git --no-pager diff --check`: passed.

These are Forge's attestations, not independent backend workspace checks by Nova.
Nova verified its own workspace and recorded the reported completion. Both agents
are paused; session closeout is complete and the owner handles commits/pushes in
both repositories. No next queue, backend access, deployment or ACK loop. Preserve
the documented live/ephemeris/normal-drive/survey/performance limitations and
unrelated broader-test failures.

## Linked-session recovery

Current session links are operational references, not API authority:

- [Nova](agent-host-session://ahp-session/b4a25d45-eec0-4f00-95af-17df714ff556)
- [Forge](agent-host-session://ahp-session/a76b34c8-0a18-479d-aea0-254e1705b5a2)

Use stable task IDs and attempt numbers, explicit recipient acknowledgement,
substantive completion and parent review. A transport result of `processing` is
not an acknowledgement or completion. On a routing error, reconcile the known
session and pending messages before any retry; do not create replacement workers
or execute duplicate tasks blindly.

Keep detailed message IDs and transient state in each workspace's local ledger.
Those ledgers are not a guaranteed delivery mechanism or substitute for this
reviewable plan. No next round starts merely because a peer finished its turn.
