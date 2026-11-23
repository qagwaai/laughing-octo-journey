# Phase 3 ship navigation: implementation session prompt

> Historical session prompt, superseded by the completed integration and later
> owner decisions. Do not execute it as a new implementation request. See the
> [current navigation handoff](./ship-navigation-2026-11-14.md#phase-3-frontend-closeout-2026-11-23)
> and the served OpenAPI for current behavior and contract details.

Implement Phase 3 ship navigation in coordinated backend and frontend slices.
Start by reading the current [Phase 3 plan](./ship-navigation-phase3-plan-2026-11-21.md),
especially its opening scope, product decisions, API boundary and validation
sections. The plan contains historical research: its opening scope and newer
owner decisions supersede older proposals. The
[Phase 1/2 handoff](./ship-navigation-2026-11-14.md) provides the accepted
baseline. Inspect both repositories and the live OpenAPI before assuming
anything has been implemented since planning.

## Collaboration and sequencing

- Nova owns frontend route search, ranking, policy presentation and Viewer
  geometry in `laughing-octo-journey`. Forge owns authoritative backend data,
  calculations and OpenAPI in the neighboring `solid-train` repository.
- Collaborate directly with Forge using a linked backend session when
  available, rather than asking the owner to copy messages between agents.
  Ask Forge to send complete, substantive results and a clear completion
  notification directly back to this session. A message marked as processing
  is not proof the work or delivery is complete; verify the result before
  acting on it. If direct collaboration is unavailable, explain the blocker.
- Agree the new backend contract and implement it before prototyping the
  frontend. OpenAPI is the contract authority; illustrative examples and
  proposed names or limits in the plan are not an approved schema.
- Implement in small, testable slices. Identify genuine missing product
  decisions and ask the owner rather than inventing them. Do not treat
  deferred architecture or speculative defaults as prerequisites.

## Agreed product behavior

- Preserve Phase 2 responses, behavior and schema. The new Phase 3 operation
  must support the Tier 1 speed of 0.3 AU/hour, or 12,466.489225 km/s;
  Phase 2's maximum is 10,000 km/s and must not be changed or silently clamped.
- Use 1 prototype fuel unit per AU and a 0.5 AU per-leg hop limit. Search
  automatically among up to ten Sol planets/moons, with at most five distinct,
  nonrepeating encounters. These limits allow at most six legs and 3 AU of
  eligible path length. A supported direct reference may exceed the hop limit
  and must remain visible but ineligible.
- Show at most five choices total, including the direct reference. Include the
  shortest eligible route examined and retain longer alternatives. With four
  alternative slots, aim for roughly two low-cost choices and two chosen for
  different flyby bodies; fill unused slots with other complete choices.
  Explain selection reasons, do not duplicate direct when it is shortest,
  and do not claim a bounded search found a global optimum.
- Evaluate each calculated encounter side independently; different-cost sides
  are separate choices and count toward five. Under constant speed and
  distance-based fuel, time and fuel rankings coincide. Do not invent gravity
  savings or a fuel tradeoff.
- The player starts a search with **Plan Route**, can order by time or fuel,
  sees activity while it runs, and can select a route. Draw the selected
  route and direct reference and list flyby bodies in comparison rows. If no
  eligible route is found, show the direct reference and explain. If a search
  times out or is interrupted, show only complete choices, mark the result
  incomplete, and allow another Plan Route. Preserve ship/destination identity
  guards and surface backend errors; do not add source-change monitoring or
  automatic retries solely for this purpose.

## Departure, time and contract

- Treat the ship's saved coordinates as its current game position, subject to
  ownership, Sol-basis and source-consistency checks. Do not rewrite an old
  snapshot epoch, invent historical movement or perform a universe-wide
  coordinate migration. The existing basis gap is not proof saved numbers
  differ. A missing required input must produce an explicit error.
- The shared game clock starts once from server UTC when first created,
  advances one game second per real second while the server runs, and pauses
  when the server stops. Restart from persisted game time without adding
  downtime. Authorized global pause/resume is desired; fast-forward and
  detailed crash recovery are deferred.
- Forge's bounded edge/prefix evaluator is a proposal, not an existing API or
  backend optimizer. Nova retains search and ranking. Agree how requests
  associate the same departure, body data and model across batches, including
  authentication, source changes, complete legs, typed failures, side
  histories, numeric precision, solver bounds and performance limits. Do not
  imply transactional or ABA guarantees that the chosen mechanism cannot
  establish.
- Earlier suggestions of 32 jobs, 192 logical legs, 512 dispatched jobs and a
  120–20,000 km/s range are unapproved proposals, not measured guarantees.
  The old sample request in the plan predates side-dependent offsets and is
  not a final contract.

## Calculated encounters and hazard survey

- Use new versioned calculated waypoints around encounter bodies, not Phase 2
  body centers or a decorative display curve. Each waypoint must be strictly
  outside applicable modeled target-body boundaries plus the provisional
  1,000 km warning buffer, including after rounding. If it overlaps another
  surveyed body's buffer, try a bounded set of alternate offsets; if none
  work, report that encounter unavailable. These points are not physical
  flyby trajectories and do not guarantee the connecting legs are clear.
- Check the entire calculated timed route and supported direct reference
  against relevant moving surveyed bodies, including noncandidate bodies.
  Show one advisory warning level and selected-route markers with body, hazard
  type and explanation. Account explicitly for incomplete or unresolved
  assessment; do not say a route is physically safe or silently skip a body.
  Warnings do not change time, fuel or ranking.
- A complete initial Sol hazard survey is a hard Phase 3 requirement. Its
  inventory includes supported planets, moons, dwarf planets and the Sun;
  survey membership does not automatically make a body a flyby candidate.
  Preserve usable values and prefer researched inputs. When completed research
  finds no hazard, the owner permits a game assumption of absence without an
  extra UI label; retain its provenance and do not claim empirical certainty.
  Failed research or unavailable data is not a completed survey.
- Use a coarse spherical ring warning envelope, while obtaining a known ring
  plane for present rings. The Sun's approved modeled atmosphere boundary is
  20 catalog solar radii from its center: 13,914,000 km, with the 1,000 km
  buffer outside. This is a game convention, not a physical safety boundary.
  Defer diffuse circumsolar dust, other stars and pirate hazards.
- Design the profile, inventory, sources and generation process for review.
  Do not seed, backfill, migrate, repair or otherwise change live world data
  without separate explicit approval. Navigation reads must not silently
  generate or repair data.

## Live data, dependencies and deferred work

- The owner wants validation using live Forge data, but chose to wait until the
  new Phase 3 contract can be tested rather than call the existing navigation
  branch now. Do not guess credentials or identities; establish authorized
  access and understand side effects. The existing navigation branch bypasses
  ordinary seeding and presence refresh but can revoke an in-memory placement
  proof; authentication may have write-on-read behavior.
- Inspect the required Sol survey and test-relevant ship/station data before
  proposing cleanup. Earth and Luna station seeds appear inside their catalog
  body radii, but no current live state was checked. Existing Phase 2 station
  validation requires stored orbits to match the seed, so a database-only fix
  is insufficient. Report actual evidence and dependent impacts and request
  separate approval before changes; never silently relocate or retimestamp
  ships.
- Purchased-ship placement and durable station-following/fixed-position
  lifecycles are valuable follow-ups; use the saved-position rule for route
  planning and do not expand their scope without a demonstrated dependency.
  Cold Boot is the initial asteroid-belt mission, not a station start.
- Defer stale-route tracking, TTLs and dedicated Recalculate UI; signed
  capture tokens; journal/transfer crash coordination; detailed clock crash
  recovery; global coordinate redesign; market pricing; and applied gravity
  benefits. None is a prerequisite for the initial route-calculation design.

## Validation and handoff

- Cover clock pause/restart, current saved-position and basis handling,
  source association, full side-dependent waypoint replay, strict buffer
  boundaries, moving hazards, missing survey data, numerical failures,
  timeout and incomplete results, route diversity, and unchanged Phase 2.
  Include Sun, ring-envelope and outside-hop-limit direct cases.
- Run focused backend contract/numerical tests and frontend Vitest tests;
  run Angular template build and appropriate Playwright tests for UI changes.
  Benchmark bounded search and hazard assessment before claiming limits.
  Use the project's existing test and localization conventions.
- The prior planning session ran two existing isolated Phase 2 navigation
  Vitest files: 34 tests passed. This is baseline evidence only, not Phase 3
  validation. No live Phase 3 route or hazard survey has been validated.
- Report exactly what was implemented, tested and still blocked. Ask for
  explicit approval before any live data modification or cleanup.
