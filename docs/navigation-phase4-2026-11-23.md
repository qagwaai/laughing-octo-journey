# Ship navigation: Phase 4 planning and progress

Date: 2026-11-23
Status: P4-01 and its presentation cleanup were accepted within the documented
scope and validation limits. Subsequent sessions and approved live operations
are recorded below. Owner handles commits and pushes in both repositories.

## Current session handoff (2026-11-26)

The owner considers validation sufficient for this session. The screenshot
provided during visual validation shows an illustrative geometric route preview
to Venus Orbital Market, with a direct reference and Venus, Luna and Earth
flyby choices. It shows a Luna encounter, an incomplete search, an incomplete
survey and unknown clearance. It is evidence of the displayed preview, not
proof of a complete search, safe or authorized flight, docking, a closest belt
station, or the backend behavior behind the display. The owner did not report
the other steps of the registration-to-route flow or First Target gameplay as
independently verified.

Frontend adaptation, exact offline checks and outstanding limitations are
recorded in [Frontend adaptation to the restarted server](#frontend-adaptation-to-the-restarted-server)
below. The older sections are chronological history, not current readiness
claims. No additional implementation, live-data operation, service control,
commit or push is authorized by this handoff.

**Forge closing update, reported by the owner:** Prettier was authorized and
Forge reports formatting its changed backend files and refreshing the generated
contract artifact. `npm run contract:gate` passed in hard-fail mode with zero
drift issues; the focused 13-file suite passed 82/82, typecheck and OpenAPI
validation passed, and changed-file ESLint reported zero errors and four
warnings. Forge reports no semantic wire-contract changes since its preceding
report. These backend checks were not independently rerun by Nova. Forge's
backend handoff is `docs\navigation-phase4-2026-11-26.md`.

The backend fixture results still do not establish MongoDB, live or end-to-end
readiness. Clock rollback, partial-field reconciliation, station availability
and frontend gameplay validation remain outstanding. Forge reports no service
control or live-data changes.

## Restart handoff: production-intent course correction (2026-11-26)

### Narrow visual-validation milestone (2026-11-26)

The owner chose a hard cutover with no legacy data or session support. The
immediate milestone is registration, login, new character creation, game entry,
and planning a route to the closest station in the asteroid belt. Planning is
not flight or docking; the station may be beyond the ship's engine range. Keep
existing asteroid behavior and do not add Cold Boot or First Target asteroid
seeding to this milestone. Make minimal coordinated changes and retain as many
negotiated contract changes as feasible, reviewing differences rather than
blindly replacing either side.

The owner controls service startup and shutdown. Data changes are permitted
when needed and the owner reports having backups; this is not a request to
reset or delete data. Forge's new session is investigating the smallest backend
slice and its actual implemented contract. Frontend integration must follow
implemented and documented behavior, not an illustrative response.

The Viewer already exposes an explicit ignore-drive-limits route preview using
`bounded-preview-100au` and `stellar-sol-station-100au-v1`; this does not
authorize flight. The closest-station identity and end-to-end availability
have not yet been established. In particular, verify preview with a newly
created ship lacking a drive profile rather than assuming it works.

**Forge correction (2026-11-26, 19:34):** An offline edge-batch handler test
passed for bounded preview without a drive profile using the original guard:
the capture has `driveProfile: null`, `driveProfileRevision: null`, and
`flightAuthorized: false`. Normal ship-drive mode still requires a valid
profile. The fixture supplies trusted placement and clock, so this does not
establish that a newly created ship satisfies persisted placement, live clock,
or full navigation admission. Forge ran the focused
`node --test --test-name-pattern='bounded preview succeeds when a new ship has no drive profile' test/navigation-route-edge-batch.test.js`
test successfully on the original guard; the 17/17 full edge suite passed with
an intermediate guard change and was not rerun after restoring the guard.

The bundled Sol catalog identifies `sol-ceres-exchange`, `sol-belt-02`,
`sol-belt-03`, and `sol-belt-04` as free-floating markets, not stations.
Navigation currently evaluates only bundled Sol orbital stations with verified
trajectories, so these markets are not supported station destinations. Catalog
entries do not prove persisted inventory. Market-list-by-location sorts direct
distance from the supplied position, but its handler does not accept a route
capture epoch; host snapshots and current context timing do not establish a
trustworthy nearest station at the same game-clock epoch. Do not fabricate a
target or claim automatic nearest selection works; adding a station or seeding
requires an owner decision.

**Owner decision:** Do not fix the belt-station issue for this milestone. The
owner will validate using a planned route; the supported destination and its
availability still need verification. Do not add belt stations, change market
navigation, or claim a nearest-belt-station result as part of this decision.

Forge reports its auth, join, and roster edits remain uncommitted and its hard
contract drift gate has four findings: `LoginResponse` no longer requires
`playerId` and `sessionKey` at the top level, instead requiring them
conditionally on success; `GameJoinResponse` changes `correlationId` and
`requestIdentity` from non-null to nullable for malformed-request failures.
The gate failure is not approval to change the baseline. Await Forge's final
readiness report before frontend integration. Offline tests and typecheck are
not Mongo-backed end-to-end or live integration proof. These are peer-reported
backend results, not independently verified frontend outcomes.

**Forge contract update (2026-11-26, 19:43):** The owner approved a targeted
baseline correction: login `playerId` and `sessionKey` are required on success
only and absent on failure. Forge reports that join responses are now emitted
only for correlatable requests; uncorrelatable join requests are logged without
a response. Auth requests with missing or invalid correlation are also logged
without a response; valid correlation is echoed exactly. Login success has
nonblank `playerId` and `sessionKey`. An in-memory `buildArtifact` /
`analyzeDrift` check reported zero findings against the selectively corrected
baseline; the hard gate was not run and its generated artifact/report remain
stale. Forge reports:

- `node --test test/auth-wire.test.js test/game-join-wire.test.js test/game-join-message-handler.test.js test/login-message-handler.test.js test/register-message-handler.test.js test/socket-handler-registry.test.js`
  — 30/30 passed.
- `npm run typecheck` — passed.
- `git --no-pager diff --check` — passed.

These are local, uncommitted backend changes and peer-reported offline results,
not live or Mongo-backed end-to-end readiness. Forge reports that a new starter
ship lacks trusted placement lineage, leaving navigation admission blocked or
unproven. Continue to await the final readiness report before integration.
The owner requested no Prettier until the end of the session.

**Forge source verification (2026-11-26, 19:56):** The current backend creates
the starter at Sol barycentric `(0,0,0)` with wall-clock `createdAt` as its
epoch, and First Target is initially available. Mission activation seeds ten
character-specific bodies only if none are found: IDs
`cb-<characterId>-first-target-a1` through `a10`, catalog IDs
`FIRST-TARGET-A1` through `A10`, and `sourceScanId` values `sample-a1` through
`sample-a10`. Their XY radial offsets are 250–610 km about the origin, with
wall-clock epochs. Writes use the database when configured, but live persistence
and readback have not been verified. This is neither a verified belt start nor
trusted station-purchase placement for navigation.

The owner authorized minimal coordinated belt placement for **new** starter
ships and newly generated First Target asteroids; existing data is unchanged.
No implementation or new OpenAPI is complete. A Ceres-adjacent source is under
consideration, not an implemented contract. The existing frontend's 6–20 km
horizontal, ±4 km vertical asteroid offsets are a geometry reference, not a
playability guarantee. The current 40 km query and independent scene placement
cannot simply be widened to consume the old distant field accurately.
Integration must prevent the frontend starter-position overwrite and automatic
asteroid regeneration/upserts, and render real server positions and identities.
Keep empty and failed queries distinct; validate scanning, Dart destruction,
and debris retrieval without inventing gameplay range rules.

Forge also reports the game clock is checkpointed on initialization and
shutdown, not periodically. A clock durability label alone does not establish a
durable creation-time checkpoint or admission after recovery. Placement,
clock/recovery, persisted station availability, the hard gate, and live
end-to-end readiness remain unverified. Await Forge's implemented contract and
final readiness report before frontend integration.

**Forge offline vertical-slice report (2026-11-26, 20:17):** Forge reports
registered handlers passed a persisted-like fixture from new character creation
through roster, join, First Target activation, 40 km field read, navigation
admission and bounded route preview. Relevant successful requests and responses
were checked against dereferenced local OpenAPI. This is not a real MongoDB,
live authentication, restart, gameplay or visual test; the fixture destination
does not establish that a station exists in persistent data.

The reported new-starter origin is deterministic from the character ID in the
Sol XY annulus at 2.1–3.3 AU, not Ceres- or station-anchored. The server stores
the sampled clock epoch and starter placement; navigation reports a
`starter-belt` source without fabricating a purchase or market ID. Mission
activation creates the ten existing First Target IDs near the original starter
position. Complete existing fields are not rewritten; missing or incomplete
fields after activation fail rather than regenerate. Activation precedes
separate, nontransactional field writes, so a failed creation can require
explicit reconciliation. A checkpoint is required at creation, but crash
rollback, fencing and durable recovery remain unproven.

**Contract blocker:** character-add failure handlers may omit `characterName`
and `characterId`, but the current response schema requires both. Do not invent
values or automatically retry an uncertain creation. Forge has been asked to
reconcile the actual handler and OpenAPI and report any required baseline
decision before frontend behavior changes. Empty and failed field reads must
remain distinct.

**Correction (2026-11-26, 20:18):** The owner authorized and Forge implemented
a narrow character-add schema and baseline correction. `success`, `message`,
`playerName`, `correlationId`, and `requestIdentity` remain required;
`characterName` and `characterId` are required for success but may be absent on
failure. The handler is unchanged and uncertain outcomes still require checking
the roster before retrying. Forge reports its fixture validates a real
checkpoint-failure response and rejects success without character identity.
`node --test test\starter-navigation.test.js test\character-add-message-handler.test.js`
passed 5/5; `npm run typecheck` and `git --no-pager diff --check` passed.
In-memory drift reports zero after the authorized baseline correction; the
actual hard gate remains unrun and generated artifacts/reports remain stale.
The earlier contract blocker is resolved locally, not live-verified; all other
offline and readiness limitations above still apply.

Forge reports the following offline validation, not independently rerun here:

- `node --test test\starter-navigation.test.js test\character-add-message-handler.test.js test\mission-upsert-message-handler.test.js test\celestial-body-list-message-handler.test.js test\navigation-position-contract.test.js test\navigation-route-edge-batch.test.js test\auth-wire.test.js test\game-join-wire.test.js test\character-list-message-handler.test.js test\game-join-message-handler.test.js test\login-message-handler.test.js test\register-message-handler.test.js test\socket-handler-registry.test.js`
  — 82/82 passed.
- `npm run typecheck` and `git --no-pager diff --check` — passed.
- In-memory `buildArtifact` and `analyzeDrift` — zero findings; this is not the
  hard gate. `npm run contract:gate` was not run because it invokes Prettier;
  generated contract artifacts and reports are stale.

### Recovered server contract review (2026-11-26)

Read-only HTTP inspection of the restarted server's `/docs` and referenced
`/openapi.yaml` found differences from the retained frontend. This establishes
published shapes, not actual socket behavior or gameplay readiness:

- Auth responses do not specify correlation echoes or typed failure reasons;
  the frontend requires a matching correlation and stricter response shapes.
- Character-list permits extra summary fields and does not require missions;
  the frontend rejects documented minimal and enriched summaries and the
  documented failure shape. Do not synthesize missing mission state.
- The canonical `game-join-request` and correlated response have the fields
  needed for the basic join gate, but the newer startup-denial branch is absent.
- Ship documentation describes starter-subsystem backfill; the navigation
  edge response schema requires `batch` and does not include the newer
  startup-unavailable extension. Neither description proves runtime readiness.
- Launch documents deployed yielded items with spatial and motion data, while
  the existing frontend reward persistence path has unresolved identity and
  state mismatches. Item-upsert also documents partial updates, but its schema
  requires `itemType` and `displayName`; its destroy-item example fails that
  schema. These are not part of the immediate route-planning milestone.

Five representative auth and roster responses passed structural checks against
the served schemas but failed the frontend validator. These checks disabled
format validation and were not comprehensive OpenAPI or live gameplay tests.
No socket requests or live-data changes were made for that review.

### Latest recovery assessment: backend rollback and frontend salvage (2026-11-26)

**This assessment supersedes readiness claims and automatic continuation of the
implementation history below.** The owner reported a major problem with Forge's
implementation and began backend recovery with Forge. Nova was asked to capture
knowledge here and assess whether the frontend also needs recovery. The owner
confirmed a **document-only update, with no frontend code revert**.

The exact backend defect, restored worktree and final published contract have not
been independently verified by Nova. Forge's linked recovery assessment reports
overlapping pre-existing work and removal of some untracked backend files during
cleanup, no stash, and low confidence in reconstructing the entire earlier
worktree exactly. Those are backend-session findings, not evidence of frontend
file loss. Forge created a separate navigation restart document in `solid-train`
at `docs/navigation-phase4-2026-11-26.md`; reconcile its final findings in that
session before using any reported backend state.

**Recommendation: do not bulk-revert this frontend.** It compiles and its focused
tests pass, but auth/roster/join adoption may need a coordinated selective
rollback or adaptation if the backend restores older wire semantics. Passing
tests do not resolve that compatibility question.

#### Frontend inventory and provenance

**Owner decision and recovery update (2026-11-26, 19:01):** retain the frontend
changes as the intended coordinated implementation direction, rather than
reverting them wholesale. Their contract knowledge and safeguards remain useful;
exact wire compatibility and browser fixtures still require verification.
The owner reports that Forge's code has now been reverted except for captured
knowledge, and restarted. The earlier on-disk backend wiring and schema reports
are therefore historical, not a description of the recovered contract.
Nova has not verified the recovery target, running code, published OpenAPI or
actual outcomes. Preserve frontend work and review the recovered contract before
any coordinated adaptation; restart alone does not establish readiness.

At assessment start, frontend HEAD was `e83c1e5` (`start of navigation phase 4`).
There were 26 modified tracked files and three untracked files, with no staged
changes. The three untracked files are
[auth-selection-response.ts](../src/app/services/auth-selection-response.ts),
[auth.service.vitest.ts](../src/app/services/auth.service.vitest.ts), and
[game-session.service.vitest.ts](../src/app/services/game-session.service.vitest.ts).
Git HEAD is not the pre-session worktree: most auth, roster, session, join and
navigation edits were already uncommitted when this session began. A blanket
restore to HEAD would remove earlier desired work as well as today's changes.

Today's retained code changes are bounded: typed correlated join-denial handling
and its tests, explicit Join retry after denial, and debris scope/callback
isolation. The attempted launch-reward alteration was withdrawn; the
[launch controller](../src/app/scene/ship-exterior/ship-exterior-launch-controller.ts),
[inventory reward service](../src/app/scene/ship-exterior/inventory-reward.service.ts),
ship service and celestial-body DTO have no tracked diff against HEAD.
No new production clock, runtime, storage adapter, field-publication mechanism,
ship/body success contract or live migration was added to the frontend in this
session. This assessment changed only this document.

#### Selective rollback decision matrix

| Area              | Current dependency/risk                                                                                                                                                                                           | Recommendation                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth/registration | Fresh UUID-v4 correlation echoes; closed response keys; success requires `playerId`, login also requires `sessionKey`; lowercase failure reasons. Registration creates the account then routes to explicit login. | Compare the restored auth OpenAPI first. If it differs, adapt/recover models, validator, services, both pages and tests as a coherent group. Do not weaken parsing speculatively or automatically replay writes.                              |
| Character list    | Requires canonical IDs/names, complete `credits`, `creditLedger` and `missions`, strict keys and exact ledger balance; removed alternate-name and fabricated-ID normalization.                                    | Compare restored roster shape and metadata. Preserve genuine identities and explicit unavailable/error state; do not repair missing data by creating empty ledgers/missions or fake IDs.                                                      |
| Join              | Waits for `game-join-response` matching UUID, identity, player and character before navigation. Missing acknowledgement now produces a timeout.                                                                   | Verify the restored event and response contract. Adapt the page/service/DTO/tests together if necessary; preserve no-navigation-on-failure and require a supported admission acknowledgement rather than silently restoring optimistic entry. |
| Browser session   | Reload deliberately quarantines persisted tokens; successful login clears earlier context.                                                                                                                        | This is an intentional UX/session policy, not a necessary consequence of backend recovery. Retain or change only with the owner's chosen reload/restart policy.                                                                               |
| Navigation        | The uncommitted route change adds recognition of a correlated `startup_not_verified` denial; existing route-success evaluation is unchanged by that extension.                                                    | Keep separate from auth/gameplay recovery. If the restored backend lacks this denial branch, remove/adapt only the bounded DTO/service/test extension after contract comparison. Do not revert the accepted route planner wholesale.          |
| Debris            | New scope switching and generation guards reject responses from older scopes/requests or after stop. No response fields or gameplay transfer rule were added.                                                     | Retain this backend-independent reliability fix and its tests. It does not establish persistent debris or authoritative transfer.                                                                                                             |
| Shared visibility | Existing Viewer/Details shared services and celestial consumers were not replaced with Forge's proposed production field model.                                                                                   | No backend-induced world-body success adoption to undo here. Verify restored shared reads; do not introduce a character-private or immutable field.                                                                                           |

Evidence for the contract-sensitive groups:
[auth validator](../src/app/services/auth-selection-response.ts),
[character service](../src/app/services/character.service.ts),
[join service](../src/app/services/game-session.service.ts),
[character page](../src/app/page/character/character-list.ts), and
[session service](../src/app/services/session.service.ts).
The roster validator is stricter than the general frontend summary type
(optional economy fields, `createdAt`, richer mission progress); validation
passing does not prove every consumer or older backend payload agrees.

#### Concrete frontend risks not solved by passing unit tests

- Existing browser fixtures have not been coordinated with the strict rollout:
  [registration-scenario.ts](../e2e/fixtures/registration-scenario.ts) returns
  auth success without the now-required `playerId`, and
  [mission-session-helpers.ts](../e2e/fixtures/mission-session-helpers.ts)
  registers a game-join request with no response. These paths will reject or
  time out under the current frontend. The
  [socket mock](../e2e/fixtures/socket-mock.ts) also fills missing correlation
  fields, which can conceal wire mismatches. Review explicit payloads and update
  the relevant browser fixtures after the contract is settled.
- Cancellation removes listeners/timers, not server writes.
  [SocketService.emit](../src/app/services/socket.service.ts) uses ordinary
  Socket.IO emissions, which can buffer during disconnection. A cancelled or
  timed-out auth/join observation does not prove the request cannot later be
  transmitted. Correlation is not idempotency and timeout is not definite failure.
- Join guards prevent late navigation, but asynchronous ship hydration has
  its own session-state effects. The pre-existing
  [mission navigation service](../src/app/services/mission-navigation/mission-navigation.service.ts)
  must be checked for late ship responses before promising complete cancellation
  or isolation across session changes.
- Invalid-session handling is not uniform across pages, and registration copy
  still includes automatic-login wording despite the explicit-login flow.
  These are follow-up frontend consistency issues, not evidence that broad
  recovery is necessary.

#### Knowledge to preserve for the navigation restart

- **Authority and readiness are different.** Published OpenAPI defines the
  intended wire shape, not proof that production startup admits it. Valid YAML,
  resolved references, schema-valid examples, import-graph checks, listener
  health, and passing fake-storage tests do not prove a Mongo-backed vertical
  slice or safe recovery. Forge continued to report production verification
  outstanding, even after production wiring and fixture success.
- **Original dependency chain:** fresh auth/session, authoritative character and
  Cold Boot creation, shared persistent body reads, correlated join, then
  persisted ship reads. Keep it small and prove the actual server registry,
  storage, admission and response together before extending gameplay.
  The planner already exists; blocked backend route-event registration is a
  wiring/admission issue, not evidence that a new planner is needed.
- **Field publication:** "ready" must follow acknowledged character and starter
  item creation; ordinary shared reads and cache merges must not bypass that
  boundary. Manifest checks and a second read closed individual races in
  fixtures but were not proof of an atomic publication snapshot or crash
  durability. Preserve mutable/destroyed/deleted ready bodies; never synthesize
  replacements or infer durable provenance from a naming/rotation heuristic.
- **Clock and writer boundaries:** one game-clock sample at creation ties ship
  and field epochs. Paused time permits supported joins/gameplay changes.
  Handler wall time is not automatically trusted placement time. An in-process
  lock does not prove the owner-approved single authoritative writer deployment.
  Recovery, target/index verification and admission are separate prerequisites.
- **Last reported cutover, not a verified rollback baseline:** Forge reported
  only `game-join-request` remained registered; identity operation is
  `game-join` and response is `game-join-response`. Ship response uses persisted
  `name` and `launchable`, without `shipName`/default-launchable backfills;
  absent `status` remains absent. The owner disallowed legacy characters and
  sessions and no automatic migration was authorized. Recheck all of these
  against the recovered backend instead of replaying deleted implementation.
- **Denial-only frontend adoption:** the validated join denial was
  `{success:false,message:'Game unavailable',availability:'unavailable',reason:'startup_not_verified',correlationId,requestIdentity,playerName,characterId}`
  for a valid request. Nova requires exact matching of all four metadata/context
  fields; missing or mismatched metadata cannot resolve a pending join.
  That bounded adoption is not success-path approval.
- **Owner's clarified First Target workflow:** the Dart impacts/destroys the
  asteroid; Nova adds the asteroid material to inventory as part of the action
  after firing. Do not call it mining, invent a tractor collection event or
  numerical range, or treat bodies as immutable. Historical visual/planning
  documents are not authority to replace this workflow.
- **Inventory contract remains unresolved:** the unchanged reward service
  expands material quantities into new client IDs and separately uses the first
  yielded-item ID plus new IDs for extra quantity. It mutates local inventory
  before acknowledgement; a null yielded container becomes a ship container in
  persistence while state can remain `deployed`. Persistence omits spatial and
  motion and uses prefixed, not bare-UUID, item-upsert correlation IDs. The launch
  controller can replace Iron yield with quantity one and invoke both reward
  paths. Avoid duplicate synthetic inventory versus deployed records. Preserve
  the intended frontend-owned action, but settle item identity, quantity/state,
  ownership, inventory references and uncertain-write handling in the actual
  contract before enabling it. Legacy tractor activation was only an
  acknowledgement, not collection.

#### Forge's read-only navigation recovery handoff (2026-11-26, 18:57)

The following is **Forge-reported on-disk source state**, not Nova's independent
backend inspection or a probe of the running server. No restoration target is
selected and exact recovery has not been established. The owner started a
server; its loaded code and readiness remain unverified and may differ from
the current files. Preserve frontend work until the recovered OpenAPI and
actual outcomes can be compared under separately authorized access.

- Existing navigation state, estimate and edge-batch domain implementations
  are salvage candidates. The current production registry blocks
  `solar-system-get`, `navigation-route-estimate` and
  `navigation-route-edge-batch`; their documented historical success behavior
  is not evidence that those handlers are wired.
- Owner-approved `bounded-preview-100au` with profile
  `stellar-sol-station-100au-v1` may ignore drive range, but remains read-only
  planning, never flight, docking or clearance authorization. The starter
  drive profile is a separate decision. The current edge handler still
  validates `state.driveProfile` in preview: verify/fix the missing-profile
  end-to-end path before asserting drive-independent preview support.
- Preserve persisted departure position/epoch, a supported clock and valid
  capture. `shipPositionEpochMs` and `searchStartEpochMs` are distinct.
  Retain capture/source/owner/clock-lineage checks, the required direct
  reference and coherent geometry/timing, without implicit retries. The
  superseding Phase 3 handoff correction remains relevant.
- When production prerequisites pass, source registers strict register/login/
  character-list, character-add, `game-join-request`, ship-list and
  celestial-body-list. The old `game-join` alias is not registered.
  Requests/responses use current strict schemas; join replies echo player/
  character and valid metadata with typed failure reasons. Old character and
  session data are unsupported. This path is fixture-tested, not Mongo-backed
  end-to-end verified.
- Clock verification failure selects blocked handlers; database/index
  connection failures instead abort startup. Do not collapse these into a
  universal "listener is running but unavailable" outcome. Other gameplay
  operations, including launch/item/location and navigation, remain blocked.

Navigation denial shapes are operation-specific:

| Operation        | Reported current blocked result                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge batch       | `success:false`, `message:'Game unavailable'`, `availability:'unavailable'`, `reason:'startup_not_verified'`; independently validated correlation and canonicalized identity when valid. |
| Estimate         | A failed `NAVIGATION_READ_FAILED` estimate with `Game unavailable`, **not** the staged startup-unavailable branch.                                                                       |
| Solar-system get | Generic blocked failure with scoped metadata where available.                                                                                                                            |

Do not reuse one denial DTO across all three operations or infer support from
schema branches alone. The frontend navigation denial extension and debris
cancellation remain distinct from auth/roster/join compatibility recovery.
Forge performed no implementation, operations, data access or tests in this
handoff. It does not change the fresh frontend verification results below.

#### Fresh offline verification of the assessed frontend

Run during this assessment, before the document-only edit:

```powershell
npm run test:spec -- src\app\services\auth.service.vitest.ts src\app\guards\auth.guard.vitest.ts src\app\page\public\login.vitest.ts src\app\page\public\registration.vitest.ts src\app\services\character.service.vitest.ts src\app\page\character\character-list.vitest.ts src\app\services\game-session.service.vitest.ts src\app\page\game\game-join.vitest.ts src\app\services\session.service.vitest.ts src\app\services\navigation-route-search.service.vitest.ts src\app\scene\ship-exterior\floating-debris-controller.vitest.ts src\app\scene\ship-exterior\ship-exterior-launch-controller.vitest.ts src\app\mission\first-target-ship-exterior-mission.vitest.ts
```

Result: **13 files passed, 265 tests passed**.

- `npm run typecheck` - passed (app, Vitest specs and E2E TypeScript).
- `npm run build` - passed (including the E2E partition prebuild check and
  Angular template compilation). The partition check does not execute E2E tests.
- `git --no-pager diff --check` - passed at assessment start.
- Playwright, live socket responses, Mongo-backed tests, startup/target/index/
  clock verification and restored OpenAPI comparison - **not run**.
  The earlier attempted read-only OpenAPI availability check was interrupted;
  there is no completed live contract review from this session.

#### Safe next steps

1. Stop the implementation queue; preserve both worktrees and distinguish
   committed files from pre-existing untracked/modified work before recovery.
   Code restoration does not restore deleted untracked files or undo data writes,
   and does not change a separately running process.
2. Establish the recovered backend's actual registry and root OpenAPI plus
   referenced schemas. Review any newly proposed success contract only after
   matching handler/persistence verification, not illustrative reports.
3. Decide the desired auth/session/roster/join policy, then make the smallest
   coherent frontend adaptation. Retain independent safeguards; do not use
   passing replacement-shaped fixtures as evidence of restored compatibility.
4. Refresh the affected browser fixtures, run focused Vitest/typecheck/build,
   then obtain separate approval for server/data-dependent validation.
   No frontend revert, migration, character recreation, service control,
   commit or push was performed or authorized by this assessment.

**Latest owner direction supersedes the local-development implementation
direction below.** The owner wants a full implementation, not local-only
development code. The owner has stopped Forge's session and will stop this
session. The owner recommends considering removal of local-only development
code; this is a recommendation for review, **not authorization to delete or
revert anything now**. Do not resume the old implementation queue automatically.
Prior development-only exceptions and results are historical, not evidence of
production readiness or approval for a particular production architecture.

### What to salvage and reassess

- The frontend worktree contains uncommitted auth/selection contract adoption,
  unavailable-route handling, and correlated join gating. Existing-account
  login and a character list rendered against the local backend once. This
  validates that narrow path only; it does not establish production readiness,
  gameplay, durability, complete mission/ledger history or safe restart.
- The frontend join gate waits for a matched response using the then-served
  join schema; failures in any revised authoritative contract may have a
  different shape. Review and adapt it against the implemented OpenAPI, not
  the illustrative proposals in prior reports. No live join was exercised.
- Forge's last owner-relayed report describes uncommitted development-only
  clock/runtime changes and **unwired** placement and field persistence helpers.
  The field store has fake-storage tests only; creation, hidden-until-ready
  reads, reconciliation after gameplay changes, strict gameplay sessions and
  real join/read paths were not wired. No implemented gameplay readiness
  success contract was reported. This is peer-reported state, not an
  independently inspected backend inventory; reconcile the backend worktree in
  its own session before deciding what can be retained or removed.
- Contract work on existing auth/list channels and the agreed gameplay concepts
  may be useful independently of local-only runtime code. Review actual diffs,
  dependencies and guarantees before removing anything; preserve any desired
  work deliberately rather than deleting broad files or reverting worktrees.

### Decisions and operational facts

- The owner wants existing characters removed and recreated **by the owner** at
  a later prompt, once correct new-character creation and Cold Boot are ready.
  No deletion, relocation, regeneration, reseed or reset has been authorized
  for an agent. The owner also permits supported joining and gameplay changes
  while the global clock is paused; paused time does not imply wall-time
  catch-up or bypass admission checks.
- Previously selected new-start geometry: Sol belt 2.1–3.3 AU, continuous
  area-uniform sampling in catalog XY with Z=0, deterministic variation per
  character and 5–20 nearby tutorial asteroids. The field is tied to the
  original starter ship, with one authoritative creation-time clock sample for
  ship and field epochs. Review field completeness, durable publication,
  authoritative spin and unknown translation as part of the full design.
- The approved session-revision migration was applied once to one player in
  `mongodb://localhost:27017/solid-train`; readback passed and the follow-up
  preview reported zero planned and one already present. The owner operated a
  development backend startup and explicit login; startup was designed to write
  clock checkpoints and login changes session state. Backup was **owner-reported
  complete**, not independently verified. Do not repeat, undo or assume the
  migration or backup without reviewing the target and obtaining approval.
- Forge's session was stopped by the owner. Whether either server, MongoDB, or
  scheduled checkpoint writes are still running is **unknown**; stopping an
  agent session is not evidence that a separately started server stopped.
  Do not stop or restart processes or touch live data without owner approval.

### Next session

1. Re-establish the intended independent frontend/backend sessions and their
   workspace boundaries; inspect each own worktree and collect the backend's
   final state. Do not assume the previous task is still authorized or running.
2. Present a production-intent architecture and salvage/removal assessment for
   owner approval, including real storage/session admission, clock and recovery,
   placement/field publication and visibility, gameplay reads/writes, failure
   semantics, operational durability/exclusivity and honest limitations.
   Treat served OpenAPI and referenced schemas as wire authority.
3. After approval, implement and validate an end-to-end slice, including
   appropriate integration and real UI checks. Keep owner-controlled live-data,
   restart, deletion, commit and push gates explicit. Do not promise crash
   guarantees or declare gameplay ready on isolated helpers alone.

Frontend verification before this handoff: focused auth/selection tests 137/137,
then gameplay-entry tests 42/42, Angular build and targeted lint passed; final
`git --no-pager diff --check` passed. These are historical results, not a full
production or cross-repository validation. No commit or push was performed.

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

**Static path map (2026-11-24):** character-add initially creates and persists
the starter ship at Sol system-root `(0,0,0)` with a snapshot epoch derived from
character `createdAt`. After character creation, Nova's frontend asynchronously
lists the character's ships and upserts the first ship with a deterministic
generated asteroid-belt position. That helper uses a player/character-seeded
random point in an approximately 2.2-3.2 AU annulus, sets
`solarSystemId: 'sol'`, `frame: 'barycentric'`, and stamps `Date.now()` as
`epochMs`; it does not select a catalog asteroid or station. If the frontend
upsert is pending or fails, the backend's origin snapshot can remain.
The helper places its annulus in XZ with Y as a small offset, while the served
Sol catalog convention says zero-inclination orbits lie in XY with +Z normal.
The helper's barycenter comment also exceeds what the served generic spatial
contract certifies. Without a coordinate-basis identity or explicit transform,
the existing generated point cannot be assumed aligned to the catalog belt.

The Viewer also upserts invalid spatial records using the same generator; that
loop does not restrict repairs to the starter model. The documented legacy
asteroid-belt anchor fallback `(414012000,0,0)` km is a separate path; the belt
is not in the assembled Sol catalog body list. None of these static findings
establishes live ship locations or a valid navigation placement.

For the first-target scene, Nova reads the chosen ship's saved position as the
cluster center and queries nearby mission asteroids. The resume path uses
returned bodies where present, or generates 5-20 samples roughly 6-20 km around
the center when none are found; non-fallback samples are submitted through
celestial-body upserts with broad spatial labels and a `Date.now()` epoch. A
separate starter-ship generator exists, but its direct entry point has no
production call site found in this workspace. If ship position is unavailable,
the scene requests a fallback. Neither path certifies positions for navigation.
The served mission OpenAPI also states that activating first-target seeds a
server asteroid field. Forge reports that its current ten bodies have XY offsets
of 250-610 km from an origin-centered cluster, whereas Nova's scene queries
within 40 km of the ship. The two seed paths and their identifiers, rendered
offsets, persistence and resume behavior need joint reconciliation before
adopting a single authoritative field. Do not assume simply shifting the server
center will integrate it into the current scene.

Forge's read-only clarification reports that server-generated records and the
client upsert convention can use different IDs for the same scan ID, and a
partially written server field may be mistaken for an existing complete field on
retry. Forge proposes a single server-owned field centered on the authoritative
ship snapshot, with stable IDs, explicit incomplete-field recovery and
paginated character/mission retrieval; Nova would display those records instead
of independently generating or persisting a second field. Field scale, epoch,
retry and unavailable-state behavior remain decisions, not approved changes.

The owner subsequently selected a single Forge-owned persistent field that Nova
retrieves and renders, and requested extensive validation in both repositories.
Existing Nova seeding should inform tutorial behavior, asteroid count and
proximity. If the field cannot be obtained, notify the player rather than
silently substituting another field; distinguish connection failures from other
causes. The exact contract, retry policy and implementation scope remain to be
agreed before edits. No live-data reset, restart, commit or push is authorized.

Forge's owner-relayed P4-02-CONTRACT-001 proposal adds a backend placement
attestation and a manifest for a single persistent field, with atomic
publication and explicit recovery of interrupted writes. It recommends ten
bodies 6-20 km away, including usable iron, and preserving the same IDs and
states across scan, launch and resume. Transaction support, read consistency,
launch side effects and bypass paths are not verified; they must not be claimed
as guarantees. Forge recommends a shared-game-clock position epoch and a distinct
belt provenance variant rather than fabricating a station source. Exact belt
bounds, clock durability, field lifecycle, mission completion semantics and
rollout remain open. No contract or schema has been approved or changed.

The served `SpatialState` contract says `frame: barycentric` and
`solarSystemId` are broad labels, not coordinate-basis identity; ordinary,
manually authored, legacy or otherwise unverified ship positions are
unsupported for navigation comparison. Forge's static map reports the
navigation-state path requires durable placement lineage or a volatile runtime
proof to return a certified basis. Thus an exact numeric Cold Boot coordinate
alone does not establish eligibility for current navigation tools. Forge also
found that character-add's starter object has no `damageProfile`, while the
documented Cold Boot subsystem backfill requires
`damageProfile.origin === 'cold-boot-scripted'`; whether these are the same
creation flow remains unresolved.

Nova also found that the frontend
[ship spatial validator](../src/app/model/math/spatial.ts) rejects positions less
than 1 km from system zero, and the
[Viewer renderer](../src/app/scene/viewer/viewer-system-scene.ts) shows such ships
at a synthetic unknown-position marker. A render fallback is not a saved position.

Sun-centered Sol zero is intentional. It must not be confused with a universe-wide
system location, a ship's physical start, or a scene-space offset.

**Owner direction (2026-11-24):** new Cold Boot/first-target characters start in
the real Sol main asteroid belt, at a position that varies per character. Use
continuous placement across the whole belt as the initial design direction;
the exact bounds and provenance remain open. The owner expects an early
navigation exercise toward one of four already-seeded belt stations but does not
currently require station positions to constrain the start. Nearby mission
asteroids are part of the context for the placement design. The owner intends
to drop test data personally, not schemas; no agent is authorized to inspect,
delete or mutate live data. These are design directions, not implementation
approval or a verified live-data inventory.

The owner selected one authoritative game-clock sample at character creation
for both ship and field snapshot epochs, and preserving the current backend
mission-completion behavior in this slice. If game time is unavailable, the UI
must not proceed with game events and must notify the player. The precise
application-wide gate, clock recovery, and implementation scope still need
design and approval; a Cold Boot-only check would not establish this broader
behavior.

**Decisions and acceptance evidence:**

- On resume, the owner selected the proposed 2.1-3.3 AU annulus, sampled
  continuously and uniformly by area in the Sol catalog XY plane with Z=0.
  Treat this as a simplified gameplay belt, not a physical asteroid-density
  model or a safety guarantee. Preserve deterministic per-character variation
  of 5-20 tutorial asteroids rather than adopting Forge's proposed fixed ten.
  These selections supersede the open geometry/count questions above; exact
  local geometry, usable iron yield, lifecycle, clock-failure gating and OpenAPI
  still require agreement before implementation.

- The owner selected a field tied to the original starter ship: switching
  ships must not move or regenerate it. Starter destruction or disablement can
  be normal gameplay and must not itself be treated as failed provisioning.
  Creation failures and later failed requests, including field retrieval, use
  normal error handling; do not add a special warning solely for starter loss.
  The character-list entry path currently
  derives new/resume/completed routing from first-target mission status, not
  an independent record of whether a session has ever been joined.
- The owner refined the unavailable-time policy to a simple app-wide gameplay
  blocking state: block gameplay and opening game views, while allowing login,
  reconnect and recovery and continuing to process incoming events. Show
  "Game unavailable" with accessible diagnostic details; don't describe a
  clock failure as a transport disconnect. This supersedes the earlier
  allowance to open game views. Exact readiness, stale-clock detection,
  recovery and in-flight outcome handling remain design gates, not implemented
  guarantees. Block gameplay writes if exclusive server ownership cannot be
  verified.
- The character selection page should show the authoritative game date/time
  in UTC, separate connection and game-availability indicators, and expandable
  diagnostic details. Keep it accessible for login and recovery; joining and
  opening gameplay remain blocked without trusted time. A connected socket is
  not proof that the game clock is trustworthy.
- The owner selected a smoothly advancing clock display based on the latest
  trusted server reading; stale or untrusted readings block gameplay until a
  fresh reading is obtained. Refresh intervals and advancement semantics
  require a tested contract. Diagnostic details must not expose credentials
  or sensitive infrastructure data.
- Normal gameplay requires durable storage; isolated tests may use explicit
  test storage. The owner approved a further read-only exact contract/dependency
  specification, not implementation. Player/UI pause must not be conflated
  with unavailable authoritative time: the owner expects real-time gameplay
  and incoming server events to remain available while a player opens a menu.
  Local input behavior and any genuine server-clock pause policy remain
  separate design questions; a global pause/write-block policy is not approved.

Forge's read-only exact-spec proposal recommends two MongoDB transactions:
one for creation and one for field publication plus mission activation. This
replaces its earlier nontransactional manifest proposal. Transaction-capable
deployment and isolated test setup are unverified; rollout and implementation
need owner approval. Its clock checkpoint intervals and fencing are proposed
engineering baselines, not measured guarantees. Nova verified the frontend hull
patch recipe requires one Iron; collection and the complete tutorial remain
unvalidated. The proposed field shape still needs an agreed mapping for current
mesh profiles, optional SW13B descriptors and captured kinematics, without
inventing authoritative motion or a second random geometry.
The owner declined a transaction-capable MongoDB requirement at this stage;
transactional hardening may be revisited later. Further read-only work must
evaluate a durable nontransactional approach, explicitly identifying failure
and concurrency guarantees it cannot satisfy rather than claiming atomicity.
Forge's subsequent nontransactional proposal uses durable manifests and
single-document publication markers under strictly enforced single-writer
assumptions. It does not provide physical multi-document atomicity; access
guards, durable write policy, startup recovery and ambiguous-write handling
remain unverified. Launch and other tutorial mutations currently span separate
writes and have independent crash/replay risks; the field protocol does not
fix them. Nova's scan HUD currently displays speed and spin as measurements;
unknown motion must not be silently presented as zero or cosmetic motion as
authoritative. The target-motion and appearance contract needs joint review.
The owner selected creation/field-only reliability scope for this phase, with
existing tutorial-action crash risks documented rather than resolved in this
slice, and intends one server process. Exclusive ownership and durability are
still deployment prerequisites to verify. The owner suggested Forge should
own motion values and selected Forge-authoritative persistent spin for this
slice. Translation stays unknown until a later compatible movement contract;
Nova must not present cosmetic animation as a measured value. The spin
reference, snapshot semantics and existing target paths still need review.
The owner agreed to single-server exclusive ownership, durable storage and
fail-closed reconciliation for incomplete or ambiguous creation/field writes,
without claiming automatic failover, protection from direct database edits or
atomic tutorial actions. Enforcement and deployment capability are unverified.
Forge proposes a distinct persisted rotation shape because the existing motion
schema requires linear velocity. Its constant-axis quaternion model, basis
conversion and trusted advancing clock remain proposed and unvalidated.
Nova's current scene derives asteroid visual positions independently and
animates a synthetic orbit; its spin is incremented per frame with a revealed
multiplier. Authoritative Cold Boot field rendering must instead use returned
snapshot positions and the approved rotation contract, without changing
unrelated scene paths. Forge reports the existing launch path targets the stored
body without propagating it; its debris wall-time epoch remains a limitation.
The current scene raycasts the animated asteroid meshes, so synthetic motion
also affects the displayed selection point. A continuously advancing trusted
game-time source, freshness/interpolation semantics and Sol-to-scene rotation
conversion are required for Forge's proposed quaternion model; the existing
request-specific navigation clock checks do not establish such a global source.
The owner selected displaying authoritative 6-20 km field positions with camera
and visual adjustments to keep the tutorial approachable, aiming to retain
current asteroid visibility and size. When trusted time becomes unavailable,
freeze the last known orientation while the app-wide gameplay block is active;
incoming events continue. Do not open a new game view until time is trusted.
These are design selections, not implementation approval.
The owner agreed to Forge publishing stable asteroid IDs, fixed snapshot
positions, physical size, appearance inputs and persistent spin, with Nova
using those IDs and positions for display, selection and launch. Exact
appearance, quaternion and clock mappings remain joint technical work; visual
familiarity and sufficient collectible Iron need tests.
The owner selected a final bounded read-only joint specification before an
implementation approval: Forge first, then served-contract review and Nova
adoption, followed by focused and end-to-end tests. Restarts and test-data
resets require separate authorization.
Forge's final read-only proposal is not yet a served contract. Nova identified
two clock-shape gaps: a restart-safe revision requires an explicit server
incarnation identifier, and smooth interpolation requires an agreed 1:1
elapsed-time rate or an explicit trusted rate. The asteroid scene lives under
a dynamically rotated world-relative group, so Sol-to-scene quaternion mapping
must be validated rather than assumed to be identity. The existing nearby-body
adapter substitutes zero for unknown motion and must not be used unchanged for
the new authoritative field. Root served OpenAPI still labels starters
uncertified; the proposed operations have not been verified there.
Forge subsequently proposed a per-process incarnation ID and per-incarnation
revision, and a fixed 1x monotonic advancement invariant in the new clock
status. Pushes invalidate; only a fresh correlated status on the current
connection may reopen gameplay. Current server clock uses wall time, so the
monotonic invariant and restart handling are proposed changes, not established
behavior. Proposed freshness and checkpoint timings remain untested; a player
menu does not imply server pause.
The owner approved a bounded Forge-first implementation slice for clock,
availability gate and durability prerequisites, with isolated tests and review
before character/field or Nova adoption. Deployment exclusivity and durability
remain unverified and must fail closed. No restart, live-data change/reset,
commit or push is authorized by this approval.
Forge stopped the first implementation slice before editing: static review found
that a running legacy clock checkpoint does not distinguish an orderly shutdown
from a crash, and a missing clock record does not establish a new universe.
Safe legacy recovery/bootstrap, exclusive-writer enforcement and complete
mutation coverage (including startup seeding and side-effecting reads) remain
unresolved. No live state or topology was inspected; no tests or changes were
made. Recovery, reset or deployment operations require a separate owner gate.
The owner selected a simple isolated, fail-closed prototype: normal gameplay
must remain unavailable when clock provenance or exclusive ownership cannot be
proven. An explicit bootstrap/recovery procedure returns for approval before
deployment; no live state access, reset, migration or restart is authorized.
Forge reports the isolated prototype complete: it always reports unavailable,
is not wired to production or OpenAPI, and does not protect existing gameplay
mutations. Its reported focused tests passed (21/21), as did typecheck, ESLint
and OpenAPI validation; no real database or service was touched. It is not a
production-ready clock contract or a basis for Nova adoption. Storage and
exclusive-writer verification, legacy/bootstrap policy and full gate coverage
remain separate work and approval gates.
The owner clarified that older test data do not need migration and selected a
read-only fresh-universe bootstrap/reseed plan. No data has been confirmed
reset, and no agent is authorized to inspect or reset live data, reseed or
restart. Reproducibility of required seeded systems and stations must be
established before recommending any destructive action.
Forge's static plan recommends retaining the existing database and first
rehearsing the chosen universe scope in a separately approved disposable target.
Player-only reset leaves shared clock uncertainty and potential cross-record
references; a full reset loses world data and normal startup does not restore the
full non-Sol universe. Sol seed source lists 14 market entries, but actual
records, jump-gate persistence, artifact availability and reproducibility were
not verified. Neither an empty database nor the prototype establishes trusted
clock, exclusive ownership or global gameplay gating. No reset or seed run.
The owner selected a Sol-only disposable rehearsal, is comfortable reseeding
if needed, and plans to personally complete Cold Boot with a new character then
try a route to the nearest station. This is not authorization to create a
target, reset, seed or restart. Normal-drive routing also needs an authoritative
drive profile; P4-03 remains unresolved and position provenance alone does not
guarantee that route mode will work.
The owner clarified that route preview using the ignore-drive-limits checkbox is
sufficient: this is planning only, not travel or docking. Normal-drive
assignment and range remain separate P4-03 work.
For a genuinely fresh universe, the owner selected a single server current-UTC
sample at explicitly approved bootstrap, followed by monotonic advancement.
Missing clock data alone must not trigger initialization. No bootstrap has been
authorized or executed.
Forge stopped the fresh-clock implementation before edits: existing writers do
not share a verified ownership protocol and durable acknowledgement is not
established. A bootstrap-only lock cannot exclude those writers. Nova's prior
scope did not clearly distinguish simulated isolated-test proof from the real
ownership proof required before production bootstrap; this needs clarification.
Existing production auto-initialization and gameplay mutation paths remain
unchanged and unprotected.
The owner clarified that the bootstrap protocol may be implemented and tested
with explicitly simulated test-only ownership/durability. Simulations do not
establish real guarantees: real bootstrap and gameplay must remain blocked
until actual exclusive access and durable storage are independently verified.
Forge reports the simulated bootstrap protocol complete, with 27/27 focused
prototype/navigation tests, typecheck and ESLint passing. It uses only an
in-memory test store and remains disconnected from production and OpenAPI.
Retry reconciliation is limited to the same simulated instance; durable
restart/recovery, actual ownership/durability and global mutation gating are
not implemented. Existing production behavior remains unchanged and unprotected.
The owner selected a minimal concrete integration plan for one dedicated
disposable database and one gameplay server, including explicit fresh
initialization, actual exclusivity and fail-closed write coverage. Plan only;
implementation and any target/service operations require separate approval.
Forge's read-only integrated plan proposes an unavailable-by-default startup,
durable target-bound clock/ownership operations and a non-expiring cooperative
lock, plus independently operator-verified access exclusion for legacy writers.
A lock or database name alone cannot prove exclusive ownership. Global readiness
must remain false until mutation coverage and required Sol seeds are verified;
auth/registration writes also require safe storage/ownership. Manual verified
ownership handoff is needed after stop; no automatic takeover. Current served
OpenAPI and running server are unchanged, and Nova's game join has no new
readiness guard yet. The owner approved the first backend code and isolated-test slice,
acknowledging gameplay will remain unavailable until more work is complete.
This is not approval for live target access, creation, initialization, seeding,
reset, migration, restart, commit or push; those remain separate gates.
The owner approved Forge implementing and testing a bounded explicit
fresh-bootstrap/readiness slice using isolated test storage, with gameplay
fail-closed unless durability and exclusive ownership are verified. This does
not authorize a live target, initialization, reseeding, restart, reset or
migration; field/character and Nova UI work remain separately gated.
Forge reports the first integrated slice complete as storage primitives and
blocked `startServer`, not game readiness. Normal startup does not connect to
Mongo or seed, and denies all registered operations including auth/selection;
no production verifier, adapter startup wiring or authoritative clock status
exists. The exported low-level `createServer` can bypass this block, and direct
DB/context and offline writers remain unfenced. Forge reports 107/107 focused
tests and a subsequent 6/6 adapter tests passed, plus typecheck and targeted
lint; disposable Mongo tests used fake verification, not operational proof.
Nova's character list handles failure responses, but game join currently routes
without awaiting join success. The agreed UI availability gate is not yet
implemented. This is not authorization to deploy, restart or operate a target;
future work and operations remain separate approval gates.
Forge's subsequent read-only review found that an executable isolated worker
uses the unblocked low-level factory, and direct/offline writers remain
unfenced. The adapter verifier currently accepts caller-provided identity
evidence, not independently verified deployment or exclusion; failed bootstrap
attempts can leave an ownership record requiring quarantine. Auth session
publication and character-list presence effects also need redesign before
allowlisting. The proposed next slice makes entrypoints blocked by default and
adds a reviewed blocked-status contract and conservative adapter diagnostics;
it does not enable auth/gameplay or establish real ownership/durability.
Nova's join service emits without awaiting the existing correlated response.
Forge's review ran no tests or operations. The owner approved the next blocked
entrypoint/unavailable-status code and isolated-test slice; real-target
operations and restart remain separately gated.
Forge reports that slice complete for review, not ready: public server
entrypoints and the isolated pilot/worker are blocked, and an unavailable-only
correlated status contract is proposed but not yet reviewed or served. Adapter
deadlines quarantine uncertain outcomes; already-issued writes may still
commit. Reported focused tests passed 98/98 and final adapter tests 18/18;
a broader selected regression batch failed 1/94 on Earth preview eligibility.
The same assertion failed in Forge's comparison using the HEAD registry, which
does not by itself establish the cause. Direct/offline writers and real
exclusion/durability/lifecycle remain unverified. Do not deploy or adopt the
new contract on this report alone; review code, schema and failure first.
Nova reviewed Forge's supplied source/schema excerpts. They support blocked-only
behavior, not operational readiness. Legacy denial responses can omit required
operation fields or fail correlation; the unavailable-status schema also allows
mismatched message/reason pairs despite correct current handler output. These
are focused response-contract follow-ups before client adoption.
The Earth failure has a concrete input mismatch: current station periapsis is
about 16371 km versus the host mean radius of 6371 km, so the shown predicate
does not identify an intersection. Earth-specific test/prose expectations
conflict with those inputs; the generic schema permits either eligibility
branch. Do not change the orbit merely to satisfy the assertion. Intended seed
policy and deterministic invalid-host fixture coverage need review. The old
registry comparison was not a clean-HEAD baseline, and the regression batch
remains failed. No further implementation or operations are authorized.
The owner subsequently approved focused denial/status response-contract fixes
and isolated tests only. Belt markets remain candidates for the future
nearest-station rehearsal once their authoritative poses and eligibility are
validated; using one does not resolve or replace the Earth regression/policy
question. No destination implementation or real-target operation is authorized.
Forge reports status message/reason pairing fixed, with 2/2 focused
schema/OpenAPI tests and typecheck passing. Broader denial fixes stopped:
existing response schemas often require domain data or typed failures that
cannot truthfully be supplied during blocked startup. Registry behavior remains
unchanged; no general denial-conformance or readiness claim. A reviewed
unavailable-response contract and client compatibility decision is needed
before further implementation. The Earth regression remains unresolved.
Forge proposed a shared unavailable response branch with a disjoint legacy
branch, but it is not approved. Nova's frontend assessment found that character
requests generate prefixed non-UUID correlation IDs and may require identity or
player data to accept failures; navigation expects a typed batch failure.
The proposed optional UUID-only metadata is not drop-in compatible and needs
operation-aware correlation design plus coordinated frontend handling before
server emission changes. No contract implementation or runtime adoption is
authorized by the read-only design.
Forge's refinement reports that character request schemas already require UUIDs:
Nova's prefixed IDs are a client/contract discrepancy to resolve, not grounds
to assume the contract accepts them. Other operations legitimately use opaque
IDs or distinct request/response identity mappings. Exact-echo extras, mission
aliases, malformed notices and uncorrelated auth need explicit policy.
The proposed shared branch remains a design only; contract tests, compatible
frontend handling and changed server emissions require staged approvals.
The owner approved a bounded contract-only schema/OpenAPI slice with focused
automated tests for resolved operations. Preserve operation-specific correlation,
fix Nova's character UUID mismatch later, and defer unresolved exact-echo/alias
policies. Frontend handling and server emission changes remain separate gates;
no services or database operations are authorized.
Forge reports contract staging complete for route estimate and route edge batch
only; the other 46 registry operations remain deferred. Reported schema tests
passed 3/3, plus targeted lint and typecheck. Edge success was not exercised
against the composed schema in that suite and remains a focused validation gap.
No runtime emission, frontend adoption or served-contract update occurred.
Review the composed contracts and compatible frontend handling before any
separately approved emission change; gameplay remains blocked.
Forge subsequently closed the edge success-case gap using the unchanged
deterministic in-memory fixture: composed and legacy schemas accept success,
and the unavailable branch rejects it. Reported focused tests passed 4/4,
plus targeted lint and typecheck. No frontend or emission changes occurred.
This is contract-test evidence only; served-contract review and separately
approved frontend compatibility work still precede runtime rollout.
The owner approved Nova's navigation compatibility slice. Nova verified HTTP
200 for served root/module OpenAPI and the shared/two operation unavailable
schemas without restarting any service. The staged compositions are now served;
this is not evidence that the new response is emitted or gameplay is ready.
Nova's existing edge-batch consumer now recognizes exact correlated unavailable
envelopes before legacy domain parsing. Optional response identity is validated;
uncorrelatable notices do not resolve pending requests, and stale/late replies
are ignored. A matching unavailable response cancels local pending work and
discards partial route results, without a transport-disconnection claim.
No standalone estimate consumer exists here; none was added. Focused search and
selection tests passed 57/57, typecheck and targeted ESLint passed, and Angular
build/template validation passed. Backend emission rollout, full availability
gate, character UUID correction, auth handling and other deferred operations
remain separate gates. No service restart, database operations or Prettier ran.
Forge subsequently reports edge-batch-only blocked emission implemented:
valid metadata is independently preserved/mapped, invalid metadata omitted,
and response channel comes from the registry before auth/handler/storage work.
Supplied source matches Nova's adopted correlation and optional-identity
handling. Forge reports 5/5 selected mocked/schema tests passing, including
14 input cases, plus targeted lint; typecheck passed before final test additions.
This is not a deployed or end-to-end/browser-verified integration. Other 47
operation emissions remain unchanged and may still conflict with schemas.
No restart, rollout, gameplay readiness or next implementation is authorized.
The owner approved mocked browser verification. Nova added an existing-spec
Playwright case covering an uncorrelated notice through timeout, matched
unavailability with optional identity, no route choices or automatic retries,
late old replies and a subsequent request over the same mocked transport.
Direct mock pushes avoid fixture-added correlation metadata. Selected browser
validation passed 4/4 (auth setup and three scenarios), including existing
calculated-route success and ineligible-destination behavior. Targeted ESLint,
e2e typecheck and diff check passed. This is mocked browser integration, not
real Forge startup/storage readiness or live end-to-end acceptance.
No backend restart, database operation or further rollout is authorized.
On 2026-11-25 the owner approved a read-only startup/auth design. Forge reports
unsafe cache-before-persistence auth, fallback/backfill storage paths and
presence-mutating selection. It proposes an injected strict auth/selection
path with mock tests while all public traffic remains blocked. Selection DTO,
missing/legacy ledger outcomes and internal failure semantics need agreement
before implementation; no fabricated session, ledger or empty-list success.
Real deployment-bound exclusion/durability, public contract/client handling,
clock lifecycle and complete gameplay admission remain separate gates.
No topology or write-concern policy, admin pause or recovery guarantee has
been approved; no live resources or tests were accessed during this design.
Forge's exact DTO design identifies genuine full-ledger requirements and
unresolved legacy ID/reference equivalence. Nova confirmed selection displays
optional level and uses mission progress for join labeling/routing, so a minimal
DTO is not a drop-in public replacement. The proposed first code slice is a
pure canonical-data converter with in-memory tests, no legacy defaults or
derived IDs and no public wiring; owner approval is still required.
The owner approved that converter slice. Forge supplied complete source and
reports 4/4 focused tests, typecheck, targeted lint and whitespace checks passing.
Nova's excerpt review supports required-field validation, player-wide duplicate
rejection, finite append-order balances and defensive whitelisted copies.
Structural validation does not prove the input snapshot is complete or trusted.
The converter remains internal/unwired and omits level/mission UI fields.
No auth, storage, session, gameplay or operational enablement occurred; further
implementation requires separate approval.
The owner approved a larger unwired strict auth/selection service. Forge reports
16/16 service/converter tests, typecheck and lint passing. Nova reviewed complete
source supplied by Forge: same-player login and selection share a lock, selection
rechecks published-session identity/generation and persisted token after read,
and uncertain writes quarantine the instance. The specific selection/login
overlap schedule lacks a focused regression test but is serialized in the
shown implementation, not a demonstrated race bug.
These checks assume injected adapter/gate invariants; no concrete storage adapter,
target verification, public authentication or recovery policy is implemented.
Timeouts bound individual waits, not the complete operation. Public wiring and
all operational gates remain separate; no readiness claim.

### Auth/selection contract proposal gate

The owner corrected responsibilities: Forge owns backend implementation
correctness; Nova assesses OpenAPI sufficiency for frontend integration.
The earlier source assessment is not a backend approval gate.

The owner authorized a larger **read-only proposal** for registration, login and
character-list/selection. No new wire semantics, schema implementation, client
implementation or operational enablement are approved by that authorization.

Nova's frontend acceptance requirements for that proposal:

- Define operation-specific success and failure shapes without requiring
  credentials or fabricated roster data on failures. Define whether registration
  authenticates or requires a separate login.
- Specify response channels and exact request matching, including malformed or
  uncorrelatable requests. Correlation must not implicitly provide idempotency.
  Ignore stale or mismatched replies rather than consuming another request's
  response. Coordinated adoption must remove current first-channel auth matching,
  prefixed character correlation IDs and player-name matching fallbacks.
- Distinguish transport connectivity, safe auth/selection availability and
  gameplay clock readiness. An unavailable result must not claim logout or
  successful empty selection.
- Specify retry treatment for definite no-write, conflict, uncertain write and
  missing/late response outcomes. Client timeout is not server cancellation or
  proof that a registration/login write failed.
- Specify token replacement, server restart/revocation, browser reload and
  recovery. Browser sessionStorage currently preserves token/player and selected
  character/mission context; that cached state is not server admission evidence.
  Stale invalid-session notices must not clear a newer session, and error
  metadata must not expose session tokens.
- Preserve stable character IDs/names and complete append-ordered creditLedger
  with derived credits. Level is optional display data. Tutorial routing needs
  authoritative mission progress distinguishing initial, active and completed
  states; missing/unknown progress must not silently become initial progress.
  The current frontend recognizes available/active/completed mission statuses;
  those client types alone do not establish OpenAPI authority.
- Identify the game-join admission dependency: the current frontend emits join
  and routes immediately. Auth/selection success alone must not imply gameplay
  admission. Join implementation and Cold Boot remain outside this proposal.

Proposed contract-validation coverage must include positive and negative
envelopes, no sensitive data on failures, exact correlation/channel behavior,
uncorrelatable notices, stale auth and invalid-session replies, replacement and
restart lifecycle, unknown-vs-empty roster/progress, complete ledger data, and
the availability/retry matrix. These are proposed acceptance cases, not tests
reported as run.

Forge delivered the complete read-only V2 proposal. It addresses the major
contract gaps, but migration and tutorial/lifecycle decisions remain unapproved.
Nova recommends isolated versioned event channels instead of reserving a marker
inside permissive legacy payloads. Registration should create an account only,
with separate explicit login; cached browser tokens are not admission evidence.
Unknown mission data must fail selection rather than silently start the tutorial.

Before schema implementation, the outcome/retry table must also explicitly cover
an acknowledged mutation followed by admission revocation: that is not a
definite-no-write unavailable response and need not be an unknown commit.
Recovery instructions must not promise an unimplemented reconciliation endpoint
or authorize automatic login/replay. Exact versioned channel names, malformed
version handling and authoritative missing-first-target behavior still need
decisions. No proposal is current OpenAPI authority until approved and adopted.

Owner decisions supersede the above migration/tutorial recommendations:
replace contracts in a coordinated rollout on existing channels, with **no
legacy support, V2 marker, version negotiation or new channels**. Keep this
auth/selection slice simple; no new endpoints or gameplay/join implementation.
The tutorial is an ordinary mission: preserve generic mission summaries and
do not introduce a tutorial-specific field, required first-target or special
routing policy. Registration creates an account only, followed by separate
login; server restart requires fresh login and cached tokens do not prove
admission. Login uses generic invalid_credentials for both absent players and
wrong passwords. Exact simplified schemas remain pending approval.

Forge's simplified COMPLETE is sufficient to specify the proposed auth/selection
OpenAPI replacement: existing channels, UUID-v4 correlation, separate closed
success/failure branches, no credential/domain data on failures, generic complete
mission and ledger snapshots, and documented retry/session rules. No extra
versioning, legacy machinery or tutorial-specific fields are needed.

The proposed outcome_unknown reason refers to uncertain client-facing completion,
not necessarily an unknown database commit; an acknowledged write followed by
admission revocation must not be mapped to a definite-no-write failure. This
mapping remains a future backend implementation gate, not a Nova source-review
gate. Client adoption must coordinate exact matching, timeout errors, UUID-v4
generation and removal of undocumented request extras if schemas are closed.
Contract sufficiency does not establish runtime admission, storage durability,
gameplay readiness or authorization to implement/deploy.

The owner subsequently approved implementation of the simplified **schemas,
directly related documentation and focused contract tests only**. Forge owns
that backend-repository slice. Runtime auth/admission/emissions, storage adapters,
frontend runtime adoption, clock/gameplay and live operations remain unapproved.
Nova will assess the resulting OpenAPI integration artifacts, not backend source
correctness, before recommending the next gate.

Contract closeout: Forge reports the focused OpenAPI contract checks passing
4/4 after inlining approved matching, failure/retry and session rules in the
auth/character operation descriptions. Nova independently fetched both served
modules (HTTP 200) and verified those semantics directly in OpenAPI, following
earlier HTTP 200 inspection of root references, shared definitions and all six
request/response schemas. The bounded registration/login/character-selection
OpenAPI is sufficient for coordinated integration. This is not a backend
source-review approval or runtime readiness claim. Frontend/backend adoption,
storage/admission and live operations remain separately gated; no next task
starts automatically.

The owner subsequently approved coordinated implementation toward **real storage
and gameplay UI validation**, including backend storage/admission, frontend
contract adoption and trustworthy clock startup. A mock-only UI milestone is
not the end goal. Real target access, migration, startup and data writes remain
subject to an exact operational approval before execution. The target is not
yet selected; the owner raised migration as a practical validation requirement.
Identify the minimum required migration rather than assuming existing data is
canonical, discarding it or silently repairing it. Preserve truthful admission
and clock gates while moving the real vertical slice forward; no new gameplay
features or P4-03 are included.

### Frontend auth/selection adoption

Nova implemented the approved existing-channel contract adoption. Auth and
selection emit fresh UUID-v4 correlation IDs, match exact replies, and reject
malformed matched envelopes. Requests omit undocumented extras. Timeout errors
are surfaced without automatically replaying registration or login.
Registration now routes to a separate explicit login instead of authenticating
automatically. Superseded login listeners are cancelled without cancelling
server-side writes. Successful login clears earlier session-scoped context.

Selection requires canonical names/IDs, complete generic missions and ledger
snapshots with finite balances; no fallback IDs, names or fabricated empty
mission data remain. Unattributed invalid-session notices trigger correlated
selection verification rather than clearing a newer token. Only a failure
matched to the current session can clear it. Persisted browser credentials are
quarantined on reload and cannot establish admission; fresh login is required.
Existing mission routing is preserved; no tutorial-specific contract is added.

This frontend adoption is implementation, not real-backend/gameplay verification.
Live migration, startup and real UI validation require their separate operational
gate. Browser fixtures for the coordinated replacement must use the new schemas;
no legacy response compatibility is promised.

Frontend validation: six focused auth/service/selection/page/session Vitest
files passed 137/137; `npm run typecheck`, `npm run build`, targeted changed-file
ESLint and `git diff --check` passed. Old fallback and automatic-login assertions
were updated to the coordinated replacement. No real backend/database/browser
rehearsal or server restart was performed by Nova in this implementation slice.

Real local UI follow-up (2026-11-25): after owner-operated development startup
and explicit existing-account login, Nova inspected the shared browser at
`/splash(left:character-list)`. One character rendered without a list error,
with the existing mission-derived "Join Game in Progress" action. This validates
the real login-to-character-list path, not game join, mission execution, historical
ledger completeness or checkpoint durability. No join/edit/delete was exercised.
Browser validation exposed an auth callback generic inference error; explicit
login/register response type arguments fixed it. `npm run build` passed and
`npm run test:spec -- src\app\services\auth.service.vitest.ts` passed 6/6.
Gameplay remains blocked pending backend context/session/clock integration and
the corresponding authoritative OpenAPI readiness semantics.

Gameplay-entry follow-up: the frontend now emits a fresh correlated game join
and waits for its matched success before publishing character context or loading
the resumed mission's ship. Rejected/malformed/timed-out joins do not navigate;
there is no automatic replay. Duplicate submissions are disabled, pending join
observation is cancelled on destruction or invalid-session verification, and
resumed gameplay stays closed if an authoritative ship cannot be hydrated.
English and Italian status/errors are updated. Validation:
`npm run test:spec -- src\app\services\game-session.service.vitest.ts src\app\page\character\character-list.vitest.ts`
passed 42/42; `npm run build`, targeted ESLint and whitespace checks passed.
This uses the currently served game-join schema, not an invented readiness
contract. Backend gameplay integration is incomplete. Forge's initial claim
that placement necessarily blocks all join/session/status work was corrected:
safe independent paths can be implemented while genuinely placement-dependent
operations remain unavailable. Illustrative replacement schemas are not
authoritative or adoptable until implemented and published. No live
join, relocation, deletion, reseed or additional restart was performed.

Owner blocker decisions (2026-11-26): no legacy-data support or reconciliation
is required. The owner intends to delete existing characters when prompted, but
that prompt must wait until authoritative new-character creation and Cold Boot
are ready for a separately approved live validation. No agent deletion is
authorized. Existing entries without trustworthy placement/field authority must
not be admitted by pretending their old origin is valid. Globally paused runtime
initially denied game joins and gameplay writes, with safe read-only inspection
allowed. The subsequent owner clarification supersedes that restriction:
supported gameplay joining and changes are allowed while globally paused.
Pausing does not authorize wall-time timestamps, simulation catch-up or bypass
of session/storage/placement/field admission checks. This is an implementation
policy, not authorization to perform live joins or writes.
Ship hydration must not create synthetic starter items or repair missing data.
The retained backend task is to implement new starts using the approved Sol belt
placement and game-clock authority, then publish actual supported OpenAPI
semantics. Live operations remain separately gated.

- [ ] Agree on the intended Cold Boot position, coordinate basis, snapshot epoch
      and any source/lineage required for navigation eligibility.
- [ ] Assign ownership for authoritative placement and saving across backend
      creation and frontend follow-up; preserve the existing sequence.
- [ ] Distinguish new-character placement from purchased ships and define
      treatment of existing saved positions before changing their representation.
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
| D4-13 | 2026-11-24 | Select P4-02 as the next discussion priority                                                          | Planning only: define Cold Boot placement and existing-ship policy; no implementation or live-data work authorized                    |

## Work and validation log

Append an entry for each approved slice. Include work-item ID, approval reference,
modified files, exact validation commands/results, remaining blockers and next gate.
Do not mark historical checks as new validation.

| Date       | Item                 | Progress / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                  | Next gate                                                                                                                                                       |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-23 | REVIEW-001           | Forge completed read-only orientation; Nova checked served contract and frontend status. No application tests or live-data reads performed.                                                                                                                                                                                                                                                                                                          | Owner discussion, beginning with P4-01                                                                                                                          |
| 2026-11-23 | Planning             | Created this document with initial findings, ordered work, decision gates and acceptance checklists.                                                                                                                                                                                                                                                                                                                                                 | Approve a bounded planning/design task                                                                                                                          |
| 2026-11-23 | P4-01                | Owner answered a structured departure questionnaire; recorded direction and deferred topics. No implementation authorized.                                                                                                                                                                                                                                                                                                                           | Forge design review, then resolve remaining owner decisions                                                                                                     |
| 2026-11-23 | DESIGN-001           | Forge agrees on pinned departure and proposes explicit snapshot/search epoch fields, source invalidation and candidate-pool guard.                                                                                                                                                                                                                                                                                                                   | Owner agreement on capture point, invalidation UX and dock-following limitation                                                                                 |
| 2026-11-23 | DESIGN-002           | Forge distinguishes stored snapshots from orbital evaluation and recommends discussing on-demand station pose. Reports a Phase 3 station-offset/direct-endpoint contract gap.                                                                                                                                                                                                                                                                        | Decide target-time geometry scope and station-following design direction                                                                                        |
| 2026-11-23 | DESIGN-003           | Forge proposes coherent full-target timed geometry and separately versioned contract with focused regression checks.                                                                                                                                                                                                                                                                                                                                 | Owner compatibility/deployment and direct-reference failure policy decisions                                                                                    |
| 2026-11-23 | DESIGN-004           | Forge supplies in-place contract/adoption proposal with pinned time, solved endpoints, required direct, typed failures and truthful completion. No tests or API edits performed.                                                                                                                                                                                                                                                                     | Technical contract review and owner-scoped implementation approval                                                                                              |
| 2026-11-23 | P4-01 implementation | Owner approved backend-first implementation and subsequent Nova adoption; excludes broader movement/attachment/travel work.                                                                                                                                                                                                                                                                                                                          | Forge contract-ready report, then owner restart and served-contract review                                                                                      |
| 2026-11-23 | IMPLEMENT-001        | Forge reports corrected contract/evaluator on disk: pinned capture time, full station arrival pose, coherent direct/leg geometry, source/pool guards, typed failures and truthful completion. No restart performed.                                                                                                                                                                                                                                  | Owner restart; verify running handler and served schemas before Nova adoption                                                                                   |
| 2026-11-23 | Nova adoption        | Owner confirmed backend restart and authorized invalid unauthenticated probe. Corrected served schemas and failed-batch runtime path verified; models/guards/fixtures/dialog updated. Focused checks below passed.                                                                                                                                                                                                                                   | Owner integrated review; optional separately authorized signed-in validation                                                                                    |
| 2026-11-24 | NAV-P4-REC-001       | Nova and Forge recommend discussing P4-02 first, then P4-03 promptly. Owner selected P4-02 as discussion priority only; no implementation or live-data work began. `git --no-pager diff --check` passed; no application tests run.                                                                                                                                                                                                                   | Pause; no next queue item. Any P4-02 design or implementation needs separately bounded owner approval                                                           |
| 2026-11-24 | P4-02-MAP-001        | Static mapping found backend origin initialization followed by Nova's asynchronous generated belt-position upsert and nearby mission-asteroid persistence. The generated XZ annulus/Y-offset is not shown to align with the served XY/+Z Sol catalog convention; ordinary ship spatial has no certified basis. Forge's character-add/Cold Boot marker relationship remains unclear. Served OpenAPI schemas returned HTTP 200; no live rows or tests. | Agree on exact Cold Boot location, coordinate transform/basis, epoch/lineage, seed/save ownership, and existing-record treatment before implementation approval |

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

## Frontend adaptation to the restarted server

The frontend was adapted against the OpenAPI served through
`http://localhost:3000/docs/` and `/openapi.yaml`, not Forge's workspace. Login
retains the authenticated player ID in memory; character creation, roster and
join use the published correlation/context rules. A failed or uncertain creation
does not auto-retry, and a failed join does not navigate. Character creation no
longer provisions or overwrites the server-created starter ship.

First Target activation failure is treated as potentially partial and requires
reconciliation. The exterior reads the filtered server field and nearby shared
contacts, retains canonical IDs and positions, and does not regenerate an empty
or unavailable field. Ship/context changes invalidate stale requests. Scan
persistence retains the fetched body's identity and spatial epoch instead of
reconstructing them. A full-body scan upsert still has no documented conditional
write or atomic-snapshot guarantee; concurrent mutations need further validation.
The radius-limited field query does not establish field completeness.

Final offline frontend checks:

- `npm test`: passed, 230 files and 2,884 tests.
- `npm run lint`: passed.
- `npm run typecheck`: passed app, spec and e2e typechecks.
- `npm run build`: passed, including Angular templates and the e2e partition gate.
- After the final request-lifecycle adjustment:
  `npm run test:spec -- src\app\scene\ship-exterior\ship-exterior-bootstrap-controller.vitest.ts`
  passed, 22 tests; `npm run lint`, `npm run typecheck`, and
  `git --no-pager diff --check` passed.

Nova did not operate on live data, control services, run Playwright gameplay,
commit or push for this adaptation. The owner's screenshot subsequently showed
the route-preview UI described in the current-session handoff above; it does not
independently establish backend or full-flow correctness. Actual MongoDB
persistence/restart, station availability across sessions, and First Target
visuals, scans, Dart destruction and debris retrieval remain unverified
end-to-end. The backend reports that activation and field creation are
nontransactional and the clock has no bounded crash rollback; this frontend
does not claim either guarantee.
