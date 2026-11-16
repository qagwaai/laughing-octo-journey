# Ship navigation: implementation and handoff

Date: 2026-11-14  
Updated: 2026-11-15  
Status: Phase 1 preview, paired direct distance, and broad candidate sweep
implemented and accepted by the user. Paused for the evening; the user will
commit and push. The X-Y plot is retained.

## Session closeout: 2026-11-15

- The user visually accepted the broad, flowing candidate sweep and supplied
  a live Viewer screenshot of projected Earth on the route to Pluto Orbital
  Market. This approves the appearance of the illustrative preview, not a
  physical trajectory or clearance result.
- Phase 1 station planning, the paired direct-distance display, and the
  UI-only candidate sweep are complete for this increment. Validation results
  and rendering limitations are recorded below. Automated coverage exercises
  both distance modes; user approval is not a claim that every body, camera
  angle, or live-data combination was manually tested.
- No commit or push was performed by the assistant. The user owns those
  actions. No further implementation is authorized as part of this closeout.
- Resume by choosing and reviewing the next navigation increment with the
  user. Moving-target timing, scenario speed/duration, assist assessment,
  candidate search/ranking, fuel, and travel execution remain deferred; no
  next physics/planner design has implementation approval.
- Nova owns UI/UX and display geometry. Forge owns data/API guarantees;
  `openapi.yaml` remains the contract authority. The accepted visual sweep
  needs no additional Forge work. Any later data request must identify the
  missing contract capability, not ask Forge to decide Viewer rendering.

## Goal

Introduce **Plan route to...** beside stations in the Stellar Viewer details list.
Phase 1 is a clearly labeled geometric preview for an eligible, newly purchased
ship in Sol. It uses backend-projected positions at one navigation epoch and
displays a route to a selected station without moving the ship. Selecting one
celestial candidate adds an illustrative sweep around its projected marker,
not a calculated gravity-assist trajectory.

The design should lean toward a physics-oriented foundation while allowing
explicit, understandable gameplay tradeoffs. An attractive curve alone is not
evidence of a workable gravity assist.

## Decisions from the initial discussion

- [x] Use **Plan route to...**, not **Navigate to...**.
- [x] Offer the new action for stations only.
- [x] Restrict planning to the active ship's current star system; browsing
      another system must not offer the action or allow cross-system planning.
- [x] Preview only: do not move the ship or initiate docking.
- [x] Limit the optional celestial candidate to one; do not auto-select or
      describe it as an assist in Phase 1.
- [x] Use backend-supported projected positions for a geometric-only preview;
      defer physics-informed trajectory calculation.
- [x] Defer travel time, thrust, engine capabilities, and fuel consumption.
- [x] Preserve room for future Gravity Assist and Direct Vector routing options.
- [x] Keep ordinary Viewer meshes at their stored positions; use distinct
      preview-only markers for projected endpoints.
- [x] Approve Phase 1 UX: active ship only, dashed line, unchanged camera,
      separate projected markers for hidden groups, and explicit warnings.
- [x] Accept the broad candidate sweep after revising the initial tight bend;
      preserve the direct baseline and its separate paired distance.

Checked items record discussion decisions or completed planning work, not
implemented features. Unchecked items are proposals or outstanding work.

## Scope of the first playable increment

### Included

- A station-row route-planning icon in both grouped and distance-sorted views.
- A named eligible departure ship and selected destination station.
- One active geometric preview using the opt-in backend `navigationState`.
- A distinct projected destination marker and optional candidate marker,
  identified by system plus station/body ID and labeled with the navigation epoch.
- A route line anchored only to projected navigation positions, plus a clear
  action and visible clearance-unknown warning when eligible with warnings.
- A paired, hypothetical straight-line endpoint distance, independent of the
  optional candidate sweep. No detour distance or duration is shown.
- A single-candidate visual sweep shared by the X-Y plot and 3D overlay,
  with explicit unavailable states when marker avoidance cannot be displayed.
- Explicit loading, insufficient-data, no-candidate, and stale-preview states.
- Fail-closed handling for unsupported position projections and ineligible
  destinations.
- Focused component and mocked browser tests, plus visual review of the
  projected-marker treatment.

### Excluded

- Ship movement, autopilot, departure/arrival events, docking, and persistence.
- ETA, departure windows, orbital rendezvous, and moving-target interception.
- Engine selection, thrust integration, acceleration, delta-v budgets, fuel
  deductions, or claims of fuel savings.
- Gravity-assist assessment or trajectory, candidate ranking/automatic
  selection, player-authored waypoints, route comparison, interstellar jumps,
  and a production orbital optimizer.
- A working Direct Vector mode. A geometric direct baseline may be used
  internally without presenting it as an executable powered flight path.

## Physics boundary: what this preview can honestly mean

A gravity assist turns a ship's velocity relative to a celestial body. For an
ideal unpowered flyby, the incoming and outgoing asymptotic speeds in the
body's frame are equal. Energy can change in the system frame because the body
is moving. A frozen body does not provide free net energy in that frame.

Current positions alone do not determine a trajectory. Velocity, encounter
epoch, and transfer duration are needed to establish whether a ship can reach
the flyby and destination. Ignoring travel time in gameplay is compatible with
adding internal encounter timing later; treating time as nonexistent is not.

**Phase 1 label:** "Illustrative geometric preview." Supporting guidance must
say that it is not a validated flight path and does not calculate clearance,
travel time, velocity compatibility, fuel use, transfer feasibility, or a
gravity assist. Final copy must be localized in English and Italian.

Do not call this route optimal, fuel-efficient, safe to fly, or physically
validated. Do not invent a fuel-saving percentage or silently assume that a
missing velocity is zero.

### Deferred physics for a later increment

Use an ideal two-body hyperbolic flyby as a local plausibility constraint:

```text
mu = G * bodyMass
e = 1 + (periapsisRadius * vInfinity^2) / mu
maximumTurnAngle = 2 * asin(1 / e)
```

Use kilometres and seconds throughout (`mu` in km^3/s^2); convert from SI
explicitly. `periapsisRadius` is measured from the body's centre, not altitude.
At a chosen minimum safe radius, this gives the maximum ideal unpowered turn
for an assumed positive body-relative encounter speed.

The angle between departure-to-body and body-to-destination directions is only
a coarse geometric turn proxy. Finite endpoints are not asymptotes. Passing
this screen does not prove that the two transfer legs connect to the flyby,
conserve velocity across the joins, or arrive at the station.

### Future physics-informed planner (not Phase 1)

1. Capture the departure, destination, and candidate bodies as a planning
   snapshot in one system and barycentric frame. Preserve source epochs and
   measurement/estimate provenance.
2. Initially consider planets and moons with usable mass and physical radius.
   Stars, black holes, stations, gates, debris, and small bodies are excluded
   from assist selection for this increment. Their gravity is not claimed to
   be absent; stellar transfer dynamics are simply not solved yet.
3. Use a documented minimum clearance above the physical radius, including any
   known atmosphere/ring exclusion. Unknown hazard extents must be disclosed;
   never derive physical clearances from the enlarged display mesh.
4. Evaluate a bounded, documented set/range of assumed encounter speeds.
   Assumptions are planner inputs with provenance, not measured ship speeds
   or engine specifications. Do not tune a separate speed for each body just
   to manufacture an accepted candidate.
5. Apply the local turn constraint and reject degenerate geometry, invalid
   numbers, surface intersections, and candidates outside the defined search
   bounds. Treat speed-sensitive results as uncertain, not universally feasible.
6. Rank surviving candidates by a documented geometric heuristic, initially
   detour length relative to the direct endpoint distance, with stable-ID
   tie-breaking. This is not a fuel, energy, or time optimization.
7. Draw a smooth illustrative connector through the candidate encounter region.
   Keep it outside tested physical exclusion volumes; do not draw through the
   body's centre. If a local hyperbolic segment is drawn, derive it from the
   stated encounter assumptions. Smooth joins are not proof of dynamic continuity.
8. If no candidate survives, report "No assist candidate found under these
   assumptions." This is not proof that no real gravity-assisted route exists.
   Never substitute a straight line and label it Gravity Assist.

**Approval gate:** choose encounter-speed assumptions, clearance policy,
candidate bounds, and maximum tolerated detour after inspecting real data.
Record their units, rationale, and sensitivity in the implementation handoff.
If these cannot be justified, ship an explicitly geometric concept preview
instead of overstating the physics.

## Gameplay and interaction proposal

1. Use the currently active owned ship as departure; show its name prominently.
   If none is selected, ask the player to choose one through the existing ship
   flow. Do not silently use the first owned ship or change the active ship.
2. Show the action only for recognized stations in the active ship's current
   star system, independent of market availability. The viewed system and
   destination station must both match the ship's authoritative
   `spatial.solarSystemId`. Hide the action while browsing any other system;
   never infer the ship's location from the viewed system. Reuse existing
   station classification; gates are not stations.
3. Provide a keyboard-accessible route/path icon with a station-specific
   accessible name and tooltip, for example "Plan route to Port Meridian".
   Preserve the separate Target and existing station-view actions.
4. Require valid source/destination positions in the same selected system.
   Recheck the system match in the action handler and calculator, not just
   the template, so stale actions cannot create cross-system routes. Disable
   with localized guidance when planning is otherwise unavailable.
5. Planning does not retarget the camera or move the ship. Proposed controls:
   **Frame route** and **Clear route**. Framing should be optional and preserve
   normal camera controls afterward.
6. Show departure, destination, optional projected candidate marker, geometric
   preview status, and concise failure/warning explanations in a compact
   preview summary. Do not label the candidate an assist in Phase 1.
   No Engage control is needed for this preview-only milestone.
7. Planning another station replaces the preview. Changing ship, character,
   system, or relevant source data invalidates it. Ignore late calculation
   results for replaced requests; never keep an old route under new labels.
8. Proposed visibility policy: do not silently change group filters. If a route
   references a hidden object, show a labeled route marker and explain that
   its object group is hidden. Confirm this policy before implementation.

Local station planning is not docking permission. Restrictions on visiting
hostile, undiscovered, or inaccessible stations remain an open gameplay choice.

## Existing integration points and constraints

These are frontend observations. The OpenAPI audit below distinguishes contract
support from fields exposed by the current frontend models.

| Area                   | Existing foundation                                                                                                                 | Planned use / caution                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Details actions        | [solar-system-details.ts](../src/app/page/game/solar-system-details.ts), [template](../src/app/page/game/solar-system-details.html) | Add the station-only action in both list modes without changing targeting.                                       |
| Viewer orchestration   | [viewer-scene.ts](../src/app/page/game/viewer-scene.ts), [data facade](../src/app/page/game/viewer-data-facade.ts)                  | Consume existing data; do not introduce a second fetch/repair pipeline.                                          |
| Scene mapping          | [viewer-system-scene.ts](../src/app/scene/viewer/viewer-system-scene.ts)                                                            | Separate kilometre-space calculation from presentation transforms.                                               |
| Spatial state          | [spatial math](../src/app/model/math/spatial.ts), [ship item](../src/app/model/ship-item.ts)                                        | Barycentric positions and epochs exist; ship motion is optional. Same-frame checks do not check epoch alignment. |
| Body data              | [solar-system-get.ts](../src/app/model/solar-system-get.ts)                                                                         | Optional mass/radius/orbital elements exist; body velocity is not exposed directly in `ViewerBody`.              |
| Physical values        | [physical-catalog.ts](../src/app/model/physical-catalog.ts)                                                                         | Reuse mass/radius source precedence and retain estimated-value warnings.                                         |
| Cross-pane interaction | [viewer-target.service.ts](../src/app/services/viewer-target.service.ts)                                                            | Follow the shared signal pattern, but keep route state separate from camera target state.                        |
| Viewer behavior        | [architecture decisions](./viewer-architecture-decision.md)                                                                         | Preserve current ship selection, group filters, targeting, and camera behavior.                                  |

### Phase 1 projected-marker rendering contract

The Viewer has distance/presentation mapping and host-overlap adjustments.
Ordinary body/station meshes remain at their stored snapshot positions and are
not synchronized with the opt-in navigation projection. They must not be moved
or used as route anchors.

- Consume one `navigationState` with `status: supported`. Use only its
  `departure.positionKm`, `destination.positionKm`, and (if selected)
  `candidates[].positionKm`, all in `coordinateBasisId` at `epochMs`.
- Render the destination and optional candidate as visibly distinct
  preview-only projected markers. Associate them by
  `(solarSystemId, destination.marketId)` and
  `(solarSystemId, candidate.bodyId)`, not by position or proximity.
- Label markers **Projected preview**, identify the object, and disclose the
  navigation epoch in exact milliseconds or unambiguous UTC. The markers must
  remain visually distinct even when overlapping their ordinary meshes.
- The route line ends at the projected destination marker. It must not be
  extended, snapped, or visually bridged to the ordinary station mesh.
- Replacing or invalidating the projection removes its route and markers
  together. Never mix responses/epochs or fall back to ordinary stored positions.
- Check `previewEligibility` before drawing. `ineligible` blocks the preview;
  `eligible-with-warnings / CLEARANCE_UNVERIFIED` displays a visible
  clearance-unknown warning.

The backend contract defines this as consumer presentation; it adds no marker
fields and does not implement the frontend overlay.

**Candidate waypoint restriction:** the API supplies the celestial body's
projected position, not a periapsis/flyby point. Do not connect route segments
through the candidate body's center or depict a gravity-assist arc in Phase 1.
If showing the candidate, render it as a separate projected candidate marker
only. Route geometry that bends around a body needs a separately designed
presentation and must not imply physical feasibility or safe clearance.

Review the marker and route overlay in both Viewer distance modes, including
host-overlap-adjusted stations, nested hosts, hidden groups, and large
stored-versus-projected separations.

### Data and contract gate

The refreshed backend contract uses the existing authenticated
`solar-system-get` request with optional navigation selectors. Its
`navigationState` is a position projection, not a route solver. The consumer
must require supported status, known Sol basis/model, valid shared navigation
epoch and finite positions, verified destination association, and
`previewEligibility` before drawing.

New supported Sol station purchases can carry durable backend-controlled
placement lineage. Existing and starter ships without valid lineage remain
unsupported; selecting one must not trigger certification or automatic active
ship changes. Phase 1 is usable only when the player explicitly selects an
eligible owned ship. The reported local purchase/restart example demonstrates
the intended path, but was not independently authenticated in this frontend
session.

The OpenAPI and response schema are authoritative for integration. Do not
invent socket events or use other contract documents as substitutes. Do not
propagate, convert, retimestamp, repair, or seed from the client. A successful
ordinary system response alone is not navigation support.

### Initial OpenAPI audit: refreshed 2026-11-14 (historical)

**Historical outcome, superseded by the 2026-11-15 update below:** at the time,
ordinary owned-ship route preview remained blocked. Catalog body
records can be compared under explicit provenance, system, and exact-epoch
conditions; an active station inherits its exact host's basis and epoch. The
ordinary ship has no coordinate-basis identity, so matching system, frame, and
epoch is not sufficient. Fail closed; do not build a route from that ship until
the backend supplies an approved basis guarantee.

#### Sources and verification boundary

- [Swagger UI](http://localhost:3000/docs/) loads the
  [root OpenAPI](http://localhost:3000/openapi.yaml), version 4.0.0.
- Fetched the root OpenAPI and navigation schemas with unique `navAudit` query
  parameters plus `Cache-Control: no-cache` and `Pragma: no-cache`. The
  cache-busted root response included the new coordinate-basis limitations.
  At verification, its `Last-Modified` header was `Sat, 14 Nov 2026 19:02:31
GMT`; the response ETag was `W/"83bd-1a1db70987c"`.
- Verified the refreshed
  [SpatialState schema](http://localhost:3000/schemas/spatial-state.schema.json),
  [market response](http://localhost:3000/schemas/market-list-response.schema.json),
  [station placement](http://localhost:3000/schemas/station-placement.schema.json),
  [atmosphere](http://localhost:3000/schemas/atmosphere.schema.json), and
  [physical catalog](http://localhost:3000/schemas/celestial-physical-catalog.schema.json).
  Other relevant contract links are the
  [orbital elements](http://localhost:3000/schemas/orbital-elements.schema.json),
  [ship list](http://localhost:3000/schemas/ship-list-response.schema.json), and
  [celestial body list](http://localhost:3000/schemas/celestial-body-list-response.schema.json).
- The reported examples and backend validation results below were supplied by
  Forge; this session did not run authenticated gameplay requests, execute
  Forge tests, or independently inspect production records. The documented ship
  evidence is from a read-only local database, not an authenticated socket
  capture or production-environment record.
- `/docs/spatial-model.md` was not served by the local API (the attempted URL
  returned the Swagger UI fallback). It was inspected from the unpushed local
  `solid-train` working tree; its claims remain Forge-provided local evidence,
  not a production capture.

#### Updated findings

| Topic                        | Guaranteed now                                                                                                                                                                                                                                                                         | Unsupported / implication                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog body basis           | Catalog-seeded records with `isCatalogBody=true`, `sourceScanId=catalog`, and `createdByCharacterId=system-catalog` use a system-root game origin. The transform is right-handed. Sol heliocentric elements use the J2000.0 ecliptic.                                                  | This is not a claim of a physical barycentre or absolute inertial alignment. Parent-relative moon elements have no separate plane identifier.                                       |
| Body comparability           | Catalog-provenance body positions may be directly compared only within one `solarSystemId` and at exactly equal `epochMs`.                                                                                                                                                             | Do not generalize this to manual or unverified records, or propagate positions in the client.                                                                                       |
| Active station               | An actively evaluated station with an exact orbital anchor inherits that host's basis and snapshot epoch; position is host position plus the backend-evaluated relative orbital vector.                                                                                                | This establishes a station-to-exact-host relationship, not compatibility with an arbitrary ship or a different-epoch candidate.                                                     |
| Ship/manual/legacy positions | Spatial coordinates and their snapshot epochs are represented.                                                                                                                                                                                                                         | No `coordinateBasisId` exists. Ship, manual, legacy, and other unverified positions must be rejected for navigation—even if system, `barycentric` frame, and epoch happen to match. |
| Epochs                       | `spatial.epochMs` is the position snapshot epoch. Orbital-element/market trajectory `orbit.epoch` is a separate reference epoch. Reads generally preserve snapshots; station evaluation uses the host epoch.                                                                           | No coherent common-epoch snapshot is guaranteed across ship, destination, and candidate bodies. Do not propagate to request time.                                                   |
| Velocity                     | If `motion` is present, `velocityKmPerSec` is required.                                                                                                                                                                                                                                | Motion may be missing or null (unavailable, not zero); its frame and epoch relationship to position are unspecified. Do not use it as navigation evidence.                          |
| Station placement            | Station spatial/trajectory fields are typed. Active body/stellar orbital evaluation needs an exact anchor. Legacy stations without `stationPlacement` may still be evaluated from orbital trajectory, but their placement kind remains unknown. Lagrange/deep-space are metadata-only. | A placement label does not prove a propagated or safe trajectory. Fail closed for unsupported placement/evaluation.                                                                 |
| Mass/radius                  | Physical catalog fields and precedence are documented; values may be approximations/generated, and zero is not a measurement.                                                                                                                                                          | Eligibility and provenance must be checked per candidate body; values alone do not validate a flyby.                                                                                |
| Atmospheric exclusion        | Atmosphere currently represents presence, optional surface pressure, and components. Null/absent pressure is unknown.                                                                                                                                                                  | No exclusion altitude or provenance is exposed. Pressure must not be converted to an altitude; safe clearance cannot be certified from this contract.                               |
| Existing context routing     | Generic route context returns node identifiers.                                                                                                                                                                                                                                        | It does not provide a km-space trajectory or gravity-assist solver. Do not use it for this preview.                                                                                 |

#### Example and validation status reported by Forge

Forge's local documentation includes a read-only Sol owned-ship/Earth/station
example and an illustrative unsupported legacy-shaped example. The local ship
record is real and passed through production `normalizeShip`, but it is not an
authenticated socket capture or production-environment evidence. It
intentionally demonstrates that matching system/frame is insufficient and
that its epoch differs from the host/station epoch. No positive comparable
ship/host/station triple is demonstrated.

Forge reports these checks passed: `npx --yes @apidevtools/swagger-cli validate
api/openapi.yaml`; `node --test test/station-market-snapshot.test.js
test/alpha-centauri-system.test.js` (27 tests); `git diff --check`; and parsing
the seven JSON examples. These backend checks were reported by Forge and were
not rerun in this frontend repository/session.

#### Initial gate decision and backend proposal (superseded)

- [x] Resolve backend coordinate and epoch semantics before selecting physics
      assumptions.
- [x] Confirm catalog-body and exact-host station comparability rules from the
      refreshed contract.
- [x] Review Forge's local, unpushed schema/documentation proposal for
      `coordinateBasisId`.
- [ ] Keep ordinary ship-to-station planning blocked until the ship's basis is
      identifiable and compatible with the target/candidate basis.
- [ ] Before enabling gravity-assist calculations, require compatible
      departure, target, and candidate positions at a common epoch. Equal epochs
      do not compensate for an unknown ship basis.
- [ ] Keep velocity out of calculations until its frame and epoch semantics are
      specified.
- [ ] Do not claim a safe flyby without an approved exclusion policy; atmospheric
      altitude is currently unavailable.

**Backend proposal reviewed (not implemented or approved):** add an optional,
response-only `spatial.coordinateBasisId`, initially proposing
`stellar:sol:catalog-cartesian:v1`. The ID describes the existing Sol numeric
game-coordinate convention, not a physical barycentric ephemeris. Backend
certification must come from trusted producer/ship-placement lineage, not
system/frame labels, ownership, model, proximity, or caller assertions.
Evaluated stations inherit the basis and epoch of their exact resolved host.
Missing/null is unknown; an unrecognized ID is unsupported. The proposal is
defined outside live schema properties, so consumers must not expect the field
in runtime responses.

The proposed fail-closed position gate requires finite positions; matching
system IDs; the same non-null, consumer-supported basis registered for that
system; exact equality of valid position epochs; and a verified exact host for
the station. Suggested client-side reasons include `BASIS_UNKNOWN`,
`BASIS_UNSUPPORTED`, `BASIS_MISMATCH`, `SYSTEM_MISMATCH`,
`POSITION_EPOCH_INVALID`, `POSITION_EPOCH_MISMATCH`, `POSITION_INVALID`, and
`STATION_HOST_UNVERIFIED`. These are not new server error enums. Do not
propagate, convert, retimestamp, or infer compatibility. Even when the position
gate passes, it does not certify velocity compatibility, clearance, transfer
feasibility, or a gravity assist.

The proposal needs backend approval and implementation for certification
storage, trusted writers, and response serialization. Trusted future ship
placement lineage and creation paths need explicit review. Any existing-world
certification or repair is separately scoped and approved; there is no promise
that a given legacy ship can be certified without changing its position or
epoch.

#### Local evidence accompanying the initial proposal

The unpushed `C:\Development\Projects\Github\solid-train` working tree was
available for inspection. Its modified `api/openapi.yaml`,
`api/schemas/spatial-state.schema.json`, and `docs/spatial-model.md` describe
the basis field as a proposal only. The shared schema has a
`definitions.proposedCoordinateBasisId`, but it is not referenced by live
`properties` or `required` fields. Forge's backend changes have not been
pushed; this checkout is design evidence, not an available runtime guarantee.

Forge documents a read-only local database example passed through production
`normalizeShip`, and an Earth station snapshot evaluated against its exact
host. This is a real local record, but not an authenticated socket capture or
production-environment evidence. Its ship position epoch is `1794673584678`;
the Earth and station position epoch is `1794150382573`, a difference of
`523202105` ms. The ship basis is unidentified. Thus that ship fails both the
basis and exact-epoch gates; adding only the proposed basis ID would not unblock
it. Its nonzero velocity has no certified relationship to position and cannot
be used to propagate it. The station/host pair is comparable under the
documented exact-anchor construction.

Forge also documents an illustrative legacy-shaped ship with a matching host
epoch but no basis, which must be rejected as `BASIS_UNKNOWN`. No positive,
real ship/host/station comparison has been demonstrated. A sanitized
representative of an already-compatible owned ship and host/station triple,
plus backend-certified lineage, remains an exit requirement.

Forge reports that its local backend validation passed:
`npx --yes @apidevtools/swagger-cli validate api/openapi.yaml`;
`node --test test/station-market-snapshot.test.js test/alpha-centauri-system.test.js`
(27 tests); `git diff --check`; and parsing seven JSON examples. These results
were not run or independently verified in this frontend session and do not
implement or approve the proposed runtime capability.

No world repair, snapshot rewrite, epoch change, axis conversion, or route
solver is authorized or performed by this planning task.

### Backend contract update and Phase 1 gate: 2026-11-15

**Historical gate status: ready to begin frontend implementation, subject to
the UX decisions then outstanding.** Implementation and acceptance are now
recorded in the session closeout above. Forge reports that the durable
placement-lineage milestone
and the Viewer representation/schema follow-up are implemented in its backend
working tree. The refreshed API schemas were independently inspected during
the preceding contract discussion, but this frontend session did not make an
authenticated navigation request or independently repeat the fresh-server
restart check. Treat the real-player runtime example and backend test results
as Forge-reported evidence, not as validation performed here.

The latest contract provides:

- An opt-in `navigationState` for the newly purchased, lineage-attested Sol
  ship path. Legacy and starter ships without valid backend lineage remain
  unsupported; reads do not repair or certify them.
- `previewEligibility` separate from position support. Ineligible selections
  block the preview. `eligible-with-warnings` with
  `CLEARANCE_UNVERIFIED` requires a visible warning; it is not a safety claim.
- Required `purchasedShip.navigationPlacement` outcomes when a purchased ship
  is returned. The public issuance result is response-only and is not writable
  lineage metadata. It does not replace checking current `navigationState` and
  `previewEligibility`.
- A contract for consumers to build projected markers from navigation
  positions. No backend marker fields or frontend rendering were implemented
  as part of this contract work.

Forge reports a sanitized actual newly purchased ship example for destination
`sol-pluto-orbit`, with persisted lineage still supported after a fresh server
restart. Its ordinary stored station position at epoch `1794150382573` differs
from the projected position at navigation epoch `1794694161611` by
approximately 2.85 million km. This confirms why the ordinary station mesh
cannot be used as the projected endpoint. Forge also reports that the Earth
station, whose apocentre is 4242 km against Earth's reported 6371 km radius,
is blocked as a preview destination and as a source for newly certified
purchases. Its placement must not be repaired or called physically valid.

Forge reports 46 focused tests passed, including support/eligibility,
projected-position separation, epoch/identity presentation requirements,
purchase issuance outcomes, and Earth-station exclusion. Targeted ESLint,
root/modular OpenAPI validation, documentation JSON parsing, and
`git diff --check` also reportedly passed. These checks were not rerun here.
The reported documentation and captured example are useful integration
evidence; they do not prove physical safety, transfer feasibility, or a
gravity-assist trajectory.

#### Phase 1 implementation boundaries (historical initial slice)

The marker-only candidate treatment below describes the original Phase 1
slice. N10 subsequently adds the separately reviewed and accepted UI-only
sweep; it does not authorize an assist trajectory or physical planner.

- Add the station-only **Plan route to...** affordance in both Viewer list modes,
  constrained to the explicitly selected active ship's current system.
- Request the opt-in projection for a selected eligible owned ship and
  destination. Handle loading, unsupported/error, ineligible, warning, and
  stale/replaced selection states explicitly.
- Draw only a geometric line from the projected departure position to the
  projected destination position, in the returned basis and epoch. Render a
  distinct projected destination marker; leave ordinary meshes and stored
  positions untouched.
- Display the exact or unambiguous UTC navigation epoch and the required
  clearance-unknown warning. Clear route and projected markers together on
  replacement or invalidation. Do not mix responses or fall back to snapshots.
- If a candidate is exposed in Phase 1, show its projected body position as a
  separate marker only. It is not a flyby waypoint; do not connect the line
  through the body's center or draw an assist arc.
- Do not add a local trajectory solver, propagation, velocity conversion,
  candidate ranking, motion/clearance/transfer validation, fuel or time
  estimates, movement, or any gravity-assist claim.

The API's `candidateBodyId` is optional and accepts at most one candidate. A
candidate's returned position is the body's evaluated position, not an
encounter point. Product/UI treatment of candidate selection remains a Phase 1
UX decision; hiding candidate selection initially is preferable to presenting
it as an assist.

## Fuel and future navigation

[Stellar Fuel.md](./Stellar%20Fuel.md) is brainstorming input, not an accepted
scientific or API specification. Its acoustic-resonance fusion and artificial
gravitational-gradient drive concepts are speculative game fiction, not
established propulsion capabilities. Keep them out of Phase 1 and any later
physics-informed solver unless separately validated and approved as game design.

Preserve these possible later distinctions without committing their balance:

- **Gravity Assist:** physically modeled encounters; potential propulsion
  tradeoffs must be calculated rather than assumed.
- **Direct Vector:** powered travel with explicit acceleration, braking,
  clearance, and engine/fuel constraints; not automatically a straight line
  through intervening bodies.
- **Local maneuvering/docking:** separate station-relative approach.
- **Jump travel:** separate inter-system capability.

A future validated planner will need synchronized state vectors/ephemerides,
transfer durations and encounter epochs, transfer-leg solving, velocity
matching, departure/arrival maneuvers, and engine capability checks. Patched
conics may be an appropriate next level before considering n-body integration.
Keep internal physical time distinct from future player-facing time compression.

## Progress tracker

| ID  | Work item / exit condition                                                                                                                   | Depends on | Status                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Capture initial user decisions and inspect relevant Viewer/fuel foundations.                                                                 | None       | Complete                                                                                                                                |
| N2  | Clarify authoritative position projection, durable ship lineage, eligibility, and response schemas.                                          | N1         | Complete per refreshed contract; Forge reports a real purchase/restart example and backend validation, not independently repeated here. |
| N3  | Finalize Phase 1 UX: active-ship choice, candidate visibility, hidden-group behavior, line style, camera framing, and localized copy.        | N2         | Initial validation accepted; X-Y plot retained for now.                                                                                 |
| N4  | Add the station-only action and request lifecycle in both list modes; enforce selected ship/system/destination identity.                     | N3         | Implemented.                                                                                                                            |
| N5  | Render and clear the geometric route and projected-only markers; show epoch and eligibility warnings; never use ordinary meshes as anchors.  | N4         | Implemented; user reports Phase 1 validation green.                                                                                     |
| N6  | Add focused Vitest coverage for request lifecycle, system/identity guards, eligibility, warnings, and stale-result handling.                 | N4, N5     | Focused tests pass.                                                                                                                     |
| N7  | Validate templates/build/lint and mocked Playwright flows; visually inspect both Viewer distance modes and representative projected offsets. | N6         | User reports Phase 1 validation green; see checkpoint for automated results.                                                            |
| N8  | Review the shipped geometric preview and define separate gates for a future physics-informed route/assist milestone.                         | N7         | Current visual increment accepted; future planner scope/design remains deferred and requires separate approval.                         |
| N9  | Add an opt-in same-response direct baseline estimate, displaying distance only until scenario-speed UX is approved.                          | N7         | Implemented; automated checks pass and the user confirmed all visual validation items.                                                  |
| N10 | Add a UI-only same-epoch candidate-marker detour, sharing geometry across the plot and 3D overlay.                                           | N9         | Complete; automated checks pass and the user visually accepted the broad sweep on 2026-11-15.                                           |

The backend contract implementation and frontend phase are separate work.

### Frontend implementation checkpoint

- The active ship, hidden-group markers, fixed camera, dashed route, and
  access-warning choices have been implemented. The user accepted initial
  validation and chose to retain the explanatory X-Y plot for now.
- `npm run typecheck`: passed.
- `npm run test:spec -- src\app\page\game\solar-system-details.vitest.ts src\app\services\viewer-navigation-preview.service.vitest.ts src\app\services\solar-system.service.vitest.ts src\app\page\game\viewer-scene.vitest.ts`: passed, 85 tests.
- `npx playwright test viewer-station-model --grep navigation --reporter=line`:
  passed, including mocked warning, candidate selection, marker labels,
  both distance modes, hidden groups, replacement, route endpoint, and clearing.
- An earlier `npm run build` passed before the latest template changes. The
  user requested dev-server compile feedback instead of repeated builds.
- The user reports all Phase 1 validation items green. The live projection and
  visual cases were not independently repeated by the assistant.

#### Direct baseline estimate contract review: 2026-11-15

Forge first reviewed its local, uncommitted backend implementation for the
separate `navigation-route-estimate` operation. This review concerned a
hypothetical estimate only and did not associate it with the existing Viewer
preview.

- `distanceKm` is the Euclidean coordinate distance between the frozen
  evaluated endpoints at the verified ship epoch in the named game basis.
  It is not flown distance, route reachability, or a safety/clearance result.
  The contract/docs should state explicitly: **straight-line coordinate
  distance, not flown distance**.
- Supported responses use `success: true` and include distance plus a duration
  that is either estimated or explicitly unavailable. Rejected responses use
  `success: false` and omit distance and duration.
- On invalid session, Forge reports that the socket registry emits a separate
  invalid-session event and then one correlated estimate response with
  `unsupported / INVALID_SESSION`. The session event must not resolve the
  estimate request. This is one response per server-handled request, not a
  transport-level exactly-once guarantee.
- Forge then implemented the approved same-response pairing and underflow
  correction in its backend working tree. An opt-in `navigationEstimate: {}`
  sibling to `navigation` returns a direct-endpoint measurement from the exact
  departure and destination vectors in the same `navigationState` response.
  The standalone operation remains separate; its estimates must not be joined
  to Viewer geometry. This is a historical pair, not a live freshness or
  atomic database snapshot guarantee.
- For positive endpoint distance, duration underflow to zero now fails as
  `ESTIMATE_NUMERIC_INVALID`; zero duration remains valid only for exactly
  zero distance. Forge reports a production-calculation underflow regression,
  conditional schema constraints, and invalid-session event coverage.
- Forge reports 45 focused tests passed, OpenAPI validation, targeted ESLint,
  handler-pattern checks, and `git diff --check` passed. The reported
  `npm run typecheck` remains blocked by an unrelated error in
  `scripts\lib\non-sol-bulk-generator.js:192` (missing `density` and `teqK`);
  the full suite was not run. These backend results were reported by Forge,
  not run in this frontend workspace. The live OpenAPI paired schema was
  inspected before frontend integration.

#### Paired direct-baseline frontend integration: 2026-11-15

- Every Viewer route-preview request opts into the paired baseline with an
  empty `navigationEstimate` object. No scenario speed is supplied, so the UI
  displays distance only and does not display a duration.
- The panel labels this as a hypothetical straight-line coordinate distance
  between frozen endpoints, explicitly not distance flown, candidate/curve
  length, route reachability, or a safety/clearance result. The estimate's
  system, ship, destination, basis, epoch, model IDs, assumptions, and warning
  are validated against the preview before its distance is shown.
- Estimate rejection or an invalid/missing pair is surfaced independently;
  it does not discard an otherwise valid geometric preview. The paired data
  lives in the same preview state and is cleared/replaced with it.
- `npm run test:spec -- src\app\services\viewer-navigation-preview.service.vitest.ts src\app\page\game\solar-system-details.vitest.ts`:
  passed, 27 tests.
- `npx playwright test viewer-station-model --grep navigation --reporter=line`:
  passed, 2 tests, including the paired distance display and replacement/
  clearing flow against the existing server.
- `npm run typecheck`: passed. Targeted ESLint and `git diff --check` passed.
- No production build was run, per the user's preference to use the running
  development server for template compilation feedback.
- On 2026-11-15, the user confirmed the distance display, candidate-independent
  direct distance, distance-mode behavior, and clearing/re-planning behavior
  in the Viewer. This is UI validation only; it does not validate physical
  reachability, safety, travel time, or gravity-assist feasibility.

#### Next planner milestone: design decisions and gates

The UI-only visual detour described below is implemented and accepted.
The assist/timing work in this section remains future direction, not an
approved implementation plan. It requires separate design approval and
implementation authorization after the session pause.

- Start with a bounded search for at most one assist, not multi-assist A*.
  The player should select a route from a list; the existing candidate
  dropdown may be a starting point. Selecting a different route should update
  its illustrative curve in the Viewer.
- The long-term goal is to compare estimated travel time and recommend a
  route while allowing player choice. Fuel optimization and engine-tier,
  acceleration, and braking models are future options, not current inputs.
- Forge proposed moving-target and encounter geometry as the next contract
  phase, before separately approved assist speed changes. Its proposed timing
  iterations, prediction horizon, candidate limits, and standoff policy are
  not approved. Candidate and destination motion assumptions must be
  discussed, along with failure, nonconvergence, and uncertainty.
- The current OpenAPI provides a same-response frozen-endpoint direct
  baseline, not predicted encounter positions or assist trajectories. Do not
  implement a moving-target or assist UI against the current contract; review
  a minimal phased OpenAPI change with Forge first.
- The curve is illustrative and must not be presented as a validated flight
  path, clearance guarantee, or proof of a gravity assist.

#### Same-epoch candidate-marker detour: 2026-11-15

- UI-only: no OpenAPI or Forge changes are needed. Both endpoints and the
  selected candidate come exclusively from one supported `navigationState`.
  Ordinary body meshes, stored positions, and catalog/gameplay physical radii
  are not inputs to the detour.
- Apply the selected proportional or compressed distance mapping first.
  The Viewer rotates canonical X-Y into scene X-Z; construct the detour in
  that plane and interpolate scene height along its segments. The X-Y panel
  uses those same scene X-Z points with one uniform scale, omitting canonical
  Z. It does not construct an independent route.
- The user rejected the initial tight marker-sized turn and selected a
  broad, flowing sweep. Use a deterministic counter-clockwise arc with
  outward-bowed cubic approach/departure legs, joined tangentially. The
  visual sweep radius is 30% of the shorter displayed endpoint-to-candidate
  distance, with a minimum of the projected marker's actual
  0.22-scene-unit octahedron bound plus a 0.18-scene-unit visual margin.
  These proportions are presentation choices, not physical quantities.
- Explicitly sample each cubic leg into 32 segments and the arc at most
  five degrees per segment. Inflate the arc enough that its straight chords
  also clear the visual margin; validate every final segment. There is no
  additional renderer-side smoothing. Shorter candidate-route dashes keep
  gaps from swallowing the bend. This avoids only the marker, not a physical body,
  atmosphere, other objects, or any flight constraint. Missing or invalid
  catalog radius does not block this visual-only feature or invent a radius.
- Keep the direct endpoint reference separate as a labelled grey dashed
  line; blue identifies the illustrative candidate detour. The paired direct
  distance is unchanged and is never replaced with detour length. Removing
  the candidate restores the original direct-only preview.
- Check the final float32 3D polyline against the camera-projected
  octahedron bounding rectangle plus three pixels on every frame. Begin
  hidden until checked. Overlap, near/far clipping, or invalid projection
  hides the blue 3D path and displays an explicit status in the panel.
  Orbiting/zooming can restore it; the X-Y route stays unchanged. Conservative
  bounding rectangles can hide some non-intersecting paths.
- Endpoint/marker overlap, coincident projected endpoints, nonfinite
  coordinates, or failed geometry produce no candidate route, never a
  straight-line detour fallback. The separately labelled direct reference
  may remain. Plot endpoint-marker overlap also suppresses its detour;
  line/marker stroke widths are bounded by the visual margin.
- No camera reframing, future epochs, scenario speed, duration, assist
  benefit, candidate search, fuel, or travel execution is introduced.
- Focused geometry tests cover both distance modes, collinear and
  non-collinear layouts, height interpolation, exact endpoints, marker
  clearance, broad radius, curved legs, asymmetric leg lengths, determinism,
  degenerate/invalid input, and final camera
  projection. Mocked browser coverage checks shared SVG/3D geometry,
  projected versus stored positions, hidden groups, unavailable detours,
  unchanged direct distance, replacement, and clearing. Plot images are
  attached to the Playwright report for visual review.
- The user visually accepted the revised broad sweep on 2026-11-15, sharing
  a screenshot of projected Earth and the Pluto Orbital Market destination.
  The earlier tight marker-sized bend was not accepted. The X-Y plot remains
  available by scrolling within the preview panel; rotating the scene can
  restore a 3D detour suppressed by the projection checks.
- Validation:
  - `npm run test:spec -- src\app\scene\viewer\viewer-navigation-detour.vitest.ts src\app\services\viewer-navigation-preview.service.vitest.ts src\app\page\game\viewer-scene.vitest.ts`:
    passed, 70 tests after the broad-sweep visual revision.
  - `npx playwright test viewer-station-model --grep navigation --reporter=line,html`:
    passed, 2 tests including setup, against `http://localhost:4200`.
  - `npm run typecheck`: passed.
  - `npx eslint src\app\scene\viewer\viewer-navigation-detour.ts src\app\scene\viewer\viewer-navigation-detour.vitest.ts src\app\scene\viewer\viewer-navigation-preview.ts src\app\scene\viewer\viewer-system-scene.ts src\app\page\game\viewer-scene.ts src\app\i18n\locales\en.ts src\app\i18n\locales\it.ts e2e\tests\viewer-station-model.spec.ts`:
    passed.
  - `git diff --check`: passed. No production build was run.

### Phase 1 automated follow-up

- [x] Verify projected route endpoints and markers in both distance modes.
- [x] Verify projected markers remain present when their groups are hidden.
- [x] Verify replacing and clearing a preview removes the previous overlay.
- [x] Request and display the direct endpoint distance only from the same
      response as its navigation positions; do not combine standalone estimates.
- [x] Keep duration hidden when no scenario speed is supplied; label the
      measurement as hypothetical straight-line coordinate distance, not route
      or curve length, flown distance, reachability, or safety.

## Acceptance and verification checklist

- [x] Station-only planning is available in both list modes through native
      buttons with localized station-specific labels.
- [x] Action and handler require the explicitly selected active ship and
      destination to match the ship's authoritative current system; stale
      selection/system changes cannot produce a cross-system preview.
- [x] Unsupported navigation state or `previewEligibility: ineligible` blocks
      the preview with an explicit, non-success-shaped state.
- [x] Use a single supported `navigationState` and only its projected
      departure/destination positions (and candidate position if displayed) in
      the returned basis and exact `epochMs`.
- [x] Projected markers are distinct from ordinary meshes and associated by
      `(solarSystemId, marketId/bodyId)`, not position. Labels identify the
      projected destination/candidate and expose the navigation epoch.
- [x] Route line terminates at the projected destination marker. Ordinary
      Viewer mesh positions remain unchanged and are never route anchors.
- [x] `eligible-with-warnings / CLEARANCE_UNVERIFIED` displays a visible
      clearance-unknown warning; no safe-clearance claim is made.
- [x] Candidate selection produces the accepted broad illustrative sweep
      around the projected marker, not a physical body or a flyby point.
      Displayed candidate-route segments are validated; unavailable detours
      are explicit, not disguised as direct-route fallbacks.
- [x] The separately labelled direct reference and same-response endpoint
      distance remain independent of the candidate sweep.
- [x] Replacing/clearing a selection, changing ship/system, or receiving a
      changed/failed projection removes the route and all projected markers
      together. Delayed responses cannot restore a stale or mixed projection.
- [x] No client orbital propagation, canonical-coordinate retimestamping,
      stored-world repair, ship movement, docking, resource mutation, or travel
      request is introduced. Coordinate transforms are display-only.
- [x] Focused Vitest tests and relevant mocked Playwright flows cover identity,
      system, eligibility, warning, replacement, and stale-response behavior.
      Typecheck and targeted lint pass; exact results are recorded above.
- [x] Automated checks cover both distance modes, endpoint/marker overlap,
      different stored/projected positions, and final rendered geometry.
      The user accepted the revised live Earth-to-Pluto visual example.
- [x] No ETA, fuel savings, optimality, safe-route, physical-feasibility, or
      gravity-assist claims appear.

Validation limits: the full Vitest and Playwright suites were not rerun for
the sweep revision. No production build was rerun; the existing development
server at `http://localhost:4200` compiled and served the browser tests.
Backend test results elsewhere in this document remain Forge-reported.

## Questions for the next design checkpoint

Resolved UX decisions: keep the optional single-candidate selector and X-Y
plot; use separate projected markers even for hidden groups; do not reframe
the camera; allow planning to inaccessible stations with explicit access and
docking warnings. The accepted sweep does not change those decisions.

On resumption, choose the next increment before making changes:

1. Should the next milestone prioritize transfer feasibility, player-facing
   travel pacing, or route comparison? None is authorized by visual acceptance.
2. If future timing is chosen, what explicit scenario assumptions and
   failure/horizon policy should be agreed before requesting an OpenAPI change?
3. If assist assessment is chosen, what physical/model and exclusion-policy
   requirements must be met before showing any benefit or feasibility claim?
