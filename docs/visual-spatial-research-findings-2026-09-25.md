# Visual/Spatial Research Findings: Ship Re-entry and Asteroid Fields

_Research and investigation handoff: 2026-09-25_

## Purpose

This document records the investigation into the following player-visible problem:

> I piloted away from that asteroid field. Why am I back in the middle of it after logging out and rejoining the same character?

The immediate investigation began as a ship-position persistence problem. Ship-position persistence was found to have real defects and was corrected separately. After those corrections, manual validation still produced the same apparent asteroid field after logout and login. Browser and network inspection showed that this remaining behavior is primarily a **visual/spatial representation problem**, not another failure to persist the ship position.

The central design tension is:

- The game needs readable, close, interactive asteroid visuals.
- Canonical world positions must remain authoritative enough that flying away has a visible and persistent consequence.
- A fully literal 1 scene unit = 1 km presentation is not necessarily playable or visually useful.
- A fully identity-seeded local arrangement is playable, but it erases the visible effect of movement through world space.

This is a research handoff, not an implementation decision. It intentionally records extra detail so a future session can evaluate the product and technical tradeoffs without repeating the investigation.

## Executive Summary

The completed character used during manual validation did **not** receive a newly seeded asteroid field on login.

What actually happened:

1. The character had completed the scripted `first-target` mission.
2. Rejoining routed the character into `generic-exploration`.
3. Generic exploration loaded the active ship at its backend-persisted position.
4. The client requested celestial bodies within the ship's sensor range.
5. The backend returned nine previously persisted `first-target` asteroids approximately 25-56 km from the ship.
6. The frontend correctly calculated each body's canonical position relative to the ship.
7. The final asteroid visualization code ignored those relative positions.
8. It deterministically redistributed every returned asteroid into a close field only 3.2-7 scene units from the viewer.

The same records therefore reconstruct a very similar close-up field on each login, even though:

- The ship position was persisted.
- The asteroid positions were persisted.
- The backend proximity query used the persisted ship position.
- The bodies were not newly created by the login.

The strongest architectural conclusion is that the game currently mixes three separate concepts:

1. **Discovery/sensor range**: which contacts the ship can know about.
2. **Immediate encounter range**: which contacts should be represented as nearby, flyable meshes.
3. **Visual compression**: how large canonical distances are mapped into a playable scene.

Those concepts need explicit, separate policies.

## Status of Ship-Position Persistence

Ship-position persistence was the first suspected cause and had genuine gaps. Those gaps were addressed before the asteroid-field investigation.

Current intended behavior:

- Live ship movement remains precise in the active simulation.
- A persistence snapshot is quantized to a 0.05 km coordinate grid.
- While moving, backend writes are throttled to at most one write approximately every two seconds.
- A trailing save occurs approximately 500 ms after movement stops.
- Pending movement is committed when the final movement key is released, input is cleared, the window blurs, or flight stops.
- Logout and return-to-character-list wait for final backend confirmation.
- A failed or timed-out final save leaves the session active and reports an error instead of presenting a false successful logout.
- Scene teardown requests a best-effort flush.

The distinction between live and persisted coordinates is important:

- The live coordinate must not be overwritten by its quantized persistence representation.
- A live coordinate such as `z = -0.06 km` may legitimately persist as `z = -0.05 km`.
- The maximum quantization difference per axis is half of the 0.05 km persistence step.

The corrected E2E flow proves that logout/login restores the backend-acknowledged coordinate rather than merely retaining an in-memory scene context.

Relevant implementation and tests:

- [`ship-flight-position-persistence.service.ts`](../src/app/services/ship-flight-position-persistence.service.ts)
- [`ship-exterior-flight-controller.ts`](../src/app/scene/ship-exterior/ship-exterior-flight-controller.ts)
- [`ship-scene-context.ts`](../src/app/scene/ship-exterior/ship-scene-context.ts)
- [`ship-exterior-bare-scene.component.ts`](../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts)
- [`logout.ts`](../src/app/page/game/logout.ts)
- [`ship-exterior-flight-position-persistence.spec.ts`](../e2e/tests/ship-exterior-flight-position-persistence.spec.ts)

This matters because the remaining visual issue should not be "fixed" by weakening or bypassing canonical ship persistence.

## Manual Validation Scenario

The player performed this validation:

1. Join a previously completed character session.
2. Pilot the ship away from the asteroids in the immediate view.
3. Verify that the backend receives a `ship-upsert-request`.
4. Observe the asteroid field from farther away.
5. Log out.
6. Log in to the same player and join the same character.
7. Compare the new scene with the pre-logout scene.

An observed backend entry included:

```text
2026-09-25T13:00:40.178Z
[handler]
messageType=ship-upsert-request
player=qagwaai
character=de33be86-e589-4645-93af-fc53e5fb7060
sessionId=d17a527f-d81d-484a-81a7-29a9a1bb8514
correlationId=ship-upsert:mugyy641:80225e1d-c7e2-41da-971b-0156927e68d8
```

After login, the scene again appeared to contain many nearby asteroids, including asteroids that had already been scanned.

Initial hypotheses were:

1. The ship-position changes were not working.
2. Old asteroids persisted from a prior session and were being loaded.
3. Login was reseeding the mission asteroids.
4. The spatial representation made correctly loaded bodies appear closer than they really were.
5. Some combination of the above.

The evidence supports hypotheses 2 and 4. It does not support a new client seed on completed-character login.

## Verified Runtime Evidence

### Character and mission routing

For the inspected completed character:

- The `first-target` mission was complete.
- The character-list flow selected `generic-exploration`, not `first-target`.
- Generic exploration uses backend local-body hydration.
- Only active `first-target` uses scripted client-side cold-boot seeding.

Relevant code:

- [`character-list.ts`](../src/app/page/character/character-list.ts)
- [`ship-exterior-bare-scene.component.ts`](../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts)
- [`generic-exploration-ship-exterior-mission.ts`](../src/app/mission/generic-exploration-ship-exterior-mission.ts)

The scene expresses this distinction through `usesScriptedSeeding`:

- `first-target` -> scripted seeding path.
- Any other mission, including `generic-exploration` -> local celestial-body query.

### Captured local-body request

The browser session issued a mission-agnostic and owner-agnostic proximity request centered on the persisted active ship position.

Observed center:

```json
{
  "x": -355911308.85,
  "y": 2009195.05,
  "z": -225302532.25
}
```

Observed request behavior:

- Solar system: active ship's solar system, with the project default as fallback.
- Search radius: 7,500 km.
- States: `["unscanned", "active"]`.
- No `missionId` filter.
- No `createdByCharacterId` filter.

The omission of mission and creator filters is deliberate in the current code. Generic exploration is intended to show the real local neighborhood, not only bodies created by the current mission or character.

Relevant code:

- [`ship-exterior-bootstrap-controller.ts`](../src/app/scene/ship-exterior/ship-exterior-bootstrap-controller.ts)
- [`celestial-body-list.ts`](../src/app/model/celestial-body-list.ts)

### Captured local-body response

The backend returned nine old `first-target` celestial bodies. They were created on:

```text
2026-09-23T19:49:11.419Z
```

The returned records included both scanned and unscanned asteroids. At least two were already scanned:

- `sample-a10`
- `sample-a3`

Observed canonical distances from the request origin:

| Asteroid | Canonical distance from ship |
|---|---:|
| `sample-a8` | 24.95 km |
| `sample-a7` | 26.01 km |
| `sample-a6` | 26.39 km |
| `sample-a5` | 35.70 km |
| `sample-a10` | 43.32 km |
| `sample-a3` | 47.37 km |
| `sample-a4` | 48.67 km |
| `sample-a1` | 48.75 km |
| `sample-a2` | 56.19 km |

This proves:

- The records existed before the login under investigation.
- The login did not newly seed these records.
- The backend considered them within the requested 7,500 km sensor radius.
- The nearest returned body was roughly 25 km away, not 3.2 scene units away by canonical position.

### Why old mission asteroids survive

The scripted mission persists generated asteroids as canonical celestial bodies.

Persisted data includes:

- Stable celestial-body ID.
- Catalog ID.
- Source scan ID.
- Creating character ID.
- `bodyType: "asteroid"`.
- `missionId: "first-target"`.
- Canonical barycentric position.
- Motion.
- Physical size and mass.
- Visualization metadata.
- Scan state.
- Lifecycle state.

Unscanned samples are persisted as `state: "unscanned"`. Scanned samples become `state: "active"`.

No investigated client flow automatically destroys, expires, or removes these bodies when the mission completes. A broad generic-exploration query can therefore return them later.

Relevant code:

- [`asteroid-persistence.service.ts`](../src/app/scene/ship-exterior/asteroid-persistence.service.ts)
- [`celestial-body-upsert.ts`](../src/app/model/celestial-body-upsert.ts)

Whether these objects should remain permanent is a product/lifecycle decision, not something the renderer should silently decide.

## End-to-End Data Flow

The current completed-character re-entry path is:

1. Character list inspects mission progress.
2. A completed/non-active `first-target` character is prepared for `generic-exploration`.
3. Mission navigation loads the real ship and its persisted spatial state.
4. The ship-exterior scene creates or activates a ship scene context.
5. Because the active mission is not `first-target`, the scene does not fabricate scripted asteroids.
6. The bootstrap controller queries celestial bodies around the active ship.
7. The query uses the sensor-array detection range; 7,500 km was observed.
8. The backend returns nearby canonical bodies.
9. [`mapLocalCelestialBodiesToSamples`](../src/app/scene/ship-exterior/ship-exterior-local-body-samples.ts) calculates real ship-relative offsets.
10. The scene replaces its current asteroid samples with the returned samples.
11. [`deriveAsteroidVisuals`](../src/app/scene/ship-exterior/ship-exterior-asteroid-visuals.ts) discards the canonical relative offsets for placement.
12. Each returned asteroid is assigned a deterministic close visual position.

Steps 9 and 11 are in direct conflict:

- The mapper documents and produces a 1:1 scene-unit-to-km offset.
- The visual derivation does not use that offset.

## Root Cause in the Visual Derivation

The local-body mapper correctly creates:

```text
basePosition = body.spatial.positionKm - queryCenterKm
position = basePosition
```

Each component is rounded to two decimal places for the render sample.

The final visual derivation instead uses:

```text
sampleSeed = hash(shipId + sample.id + array index)
theta = seeded random angle
phi = seeded random elevation
distance = 3.2 + seeded random * 3.8
position = a point 3.2-7 scene units away
```

Consequences:

- Canonical direction is ignored.
- Canonical distance is ignored.
- Movement of the ship does not continuously change the rendered contact position.
- As long as the same bodies are returned, they reconstruct into approximately the same close field.
- Identity, ship ID, and array index drive placement.
- A body 25 km away and a body 5,000 km away are both placed into the same 3.2-7 scene-unit shell.
- A player can physically leave a canonical field while the field visually follows or reforms around the player after hydration.

The deterministic behavior is useful for visual stability but is anchored to the wrong inputs. Stability should be derived from canonical world state, not solely from identity.

Relevant code:

- [`ship-exterior-local-body-samples.ts`](../src/app/scene/ship-exterior/ship-exterior-local-body-samples.ts)
- [`ship-exterior-asteroid-visuals.ts`](../src/app/scene/ship-exterior/ship-exterior-asteroid-visuals.ts)

## Important Interpretation of the Screenshot

The screenshot from the investigation should not be interpreted as a literal spatial image.

It is a stylized contact field:

- Angular arrangement is deterministic but synthetic.
- Radial placement is clamped to a very small shell.
- Asteroid mesh size is normalized for readability.
- Scanned body diameter affects visual radius through a clamped logarithmic mapping.
- Unscanned bodies deliberately avoid leaking hidden physical data and use a fallback radius.

The observed canonical asteroid diameters ranged roughly from 0.61 km to 9.18 km. Even those sizes are not rendered literally. This is reasonable for gameplay, but it reinforces that distance, scale, and visibility policies must be explicit.

The player assumption that the scene was spatially faithful was reasonable because the UI does not currently communicate that the field is an abstract contact visualization.

## What the Investigation Did Not Find

The following were considered but were not the root cause of the observed re-entry field:

### New client-side asteroid seeding on completed-character login

Not supported by the observed mission route or the captured backend records.

### Frontend append-based duplication

The local-body application replaces the context sample array. It does not append every response into a growing frontend list.

Duplicate bootstrap triggers can cause redundant network requests. The bootstrap controller coalesces identical in-flight sweeps. This deserves normal maintenance attention but does not explain a newly duplicated visual field.

### A completely stale ship position

The request center matched the persisted active ship position. Ship persistence has separate regression coverage.

### Insufficient coordinate precision as the principal explanation

The 0.05 km persistence grid can cause centimetre/metre-scale-to-tens-of-metres differences, but it does not explain why canonical bodies tens or thousands of kilometres away are rendered in the same 3.2-7 scene-unit shell.

The larger issue is not persistence granularity. It is the visual mapping.

## Concepts That Should Be Separated

### 1. Canonical world position

The backend position is the authority for:

- Proximity.
- Travel.
- Persistence.
- Encounter membership.
- Sensor detection.
- Navigation.
- Cross-session reproducibility.

Visual compression must not modify canonical world state.

### 2. Sensor/discovery radius

This answers:

> Which objects can the ship know about?

The observed sensor range was 7,500 km. A detected object does not need to be a nearby flyable mesh.

### 3. Immediate encounter radius

This answers:

> Which objects are close enough to participate in the current local flight encounter?

This radius should be substantially smaller than the sensor radius. It should have an explicit product meaning.

### 4. Visual compression

This answers:

> How should canonical encounter-relative distance map to scene distance while preserving direction and movement?

Compression can improve playability without discarding spatial truth.

### 5. Physical size presentation

This answers:

> How large should an object appear at a given scene distance?

It can include minimum apparent sizes, scan-revealed size tiers, LOD, and target highlighting. It should not secretly change encounter membership.

### 6. Distant-contact representation

This answers:

> How should a detected object outside the immediate encounter be represented?

Possible representations include:

- HUD marker.
- Directional reticle.
- Navigation contact.
- Sensor list.
- Small distant sprite.
- Cluster marker.
- No 3D representation until targeted.

## Candidate Design Options

### Option A: Fully spatially faithful rendering

Use canonical ship-relative vectors directly at a fixed scale.

Example:

```text
scenePosition = canonicalBodyPosition - canonicalShipPosition
```

#### Advantages

- Simple mental model.
- Flying away always has a direct visible result.
- Cross-session reconstruction is naturally correct.
- Direction and relative motion are correct.
- Easiest to reason about technically.

#### Disadvantages

- Asteroids tens of kilometres away may be invisible or too small.
- Large bodies may create clipping, precision, and camera-scale issues.
- Scan and targeting gameplay may become difficult.
- Existing missions were designed around close, readable contacts.
- Realistic astronomical scale is usually incompatible with an ordinary local Three.js scene.

#### Assessment

Useful as a correctness baseline and test oracle, but likely too literal as the final gameplay presentation.

### Option B: Current identity-seeded contact field

Continue placing every returned contact into a deterministic 3.2-7 scene-unit shell.

#### Advantages

- Highly readable.
- Stable per ship/body set.
- Existing scan, hover, target, and mesh interactions remain easy.
- Minimal implementation change.

#### Disadvantages

- Flying away has little or no visible consequence.
- Sensor range and immediate encounter become indistinguishable.
- A 5,000 km contact can appear beside the ship.
- Re-entry feels like teleporting back into an old field.
- The presentation contradicts persisted spatial data.

#### Assessment

This is the current behavior and does not satisfy the player expectation.

### Option C: Hybrid true-direction visual compression

Use canonical relative direction and a monotonic compressed distance curve.

Conceptually:

```text
relative = bodyPosition - shipPosition
canonicalDistance = length(relative)
direction = normalize(relative)
sceneDistance = compress(canonicalDistance)
scenePosition = direction * sceneDistance
```

Possible compression families:

- Linear scale inside a small local radius.
- Square-root compression.
- Logarithmic compression.
- Piecewise linear/logarithmic compression.
- Capped compression with a separate far-contact state.

Example piecewise policy, for discussion only:

```text
0-10 km      -> mostly linear local flight space
10-100 km    -> progressively compressed immediate encounter
100-7,500 km -> no close mesh; distant sensor contact only
>7,500 km    -> not detected by the current sensor
```

#### Advantages

- Preserves canonical direction.
- Movement changes visual placement continuously.
- Can retain readable close meshes.
- Can distinguish nearby encounters from distant detections.
- Cross-session reconstruction remains deterministic from world state.
- Supports future navigation toward a contact.

#### Disadvantages

- Requires careful thresholds and transitions.
- Compression can make speed and distance perception non-linear.
- Close-flight collision and interaction rules need an explicit coordinate space.
- A hard boundary can cause popping unless hysteresis/fades are added.
- Existing tests that assume a dense field may need updates.

#### Assessment

Strong general-purpose candidate. This was the recommended direction in the final design question, but the user chose to defer implementation and preserve the research in this document.

### Option D: Encounter zones with stylized internal layout

Treat an asteroid field as an encounter object or zone with:

- A canonical center.
- A canonical radius.
- Stable membership.
- A stylized local arrangement while the ship is inside the zone.
- An explicit exited state after the ship crosses the boundary.

When outside:

- Render the zone as a distant cluster/contact.
- Do not rebuild the local rocks around the ship.

#### Advantages

- Preserves the existing close-field gameplay.
- Gives a clear meaning to entering and leaving a field.
- Supports encounter-specific density, objectives, and lifecycle.
- Can preserve a curated or seeded local layout.

#### Disadvantages

- Requires a first-class field/encounter model.
- Existing celestial bodies are currently independent records.
- Zone membership and persistence must be defined.
- Returning to a zone must reconstruct the same local arrangement.
- Edge cases arise when bodies move independently or belong to overlapping zones.

#### Assessment

Potentially the best choice if asteroid fields are intended as authored gameplay spaces rather than merely groups of nearby bodies. It is a larger domain-model change than visual compression.

### Option E: Lifecycle filtering or expiration

Exclude, destroy, archive, or expire completed mission bodies.

Examples:

- Exclude bodies where `missionId === "first-target"` after that mission completes.
- Mark mission bodies destroyed/retired on completion.
- Apply a time-to-live.
- Keep scanned discoveries but expire unscanned mission filler.
- Make mission bodies visible only to their creating character or mission instance.

#### Advantages

- Reduces old-content accumulation.
- Can prevent tutorial objects from polluting generic exploration.
- May align with an encounter-as-content interpretation.

#### Disadvantages

- Does not solve visual distortion for other persistent bodies.
- Risks deleting or hiding objects the player expects to remain in the world.
- Can invalidate scan history or future resource systems.
- Requires explicit backend lifecycle semantics.
- Mission/creator filtering conflicts with the current goal of a shared real neighborhood.

#### Assessment

This may be useful as a separate world-lifecycle policy, but it is not a substitute for correct spatial presentation.

### Option F: Hybrid encounter meshes plus distant contacts

Combine Options C and D:

- Canonical positions determine detection and encounter membership.
- Close members use readable meshes and bounded compression.
- Farther detected members use distant contacts.
- A stable cluster/encounter identity may group related bodies.
- Leaving the encounter removes close meshes instead of respawning them around the ship.

#### Advantages

- Preserves gameplay visuals.
- Preserves visible consequences of travel.
- Supports both individual-body and field-level gameplay.
- Can evolve incrementally.

#### Disadvantages

- Highest policy complexity.
- Requires clear ownership of selection, targeting, scan, and transition state.
- Needs UI work for distant contacts.

#### Assessment

Most flexible long-term model. It should be implemented only after choosing the minimum viable encounter semantics.

## Recommended Direction for Future Evaluation

The most promising starting point is a hybrid true-position model:

1. Keep canonical backend positions authoritative.
2. Calculate every contact's ship-relative vector from canonical positions.
3. Define a distinct immediate encounter radius.
4. Use a monotonic, bounded compression curve only inside that radius.
5. Preserve canonical direction.
6. Represent detected bodies outside that radius as distant contacts, not nearby meshes.
7. Add hysteresis or fades around the encounter boundary.
8. Keep apparent-size normalization and LOD as separate readability policies.

This addresses the specific player concern:

- If the ship moves away, old rocks visibly recede.
- After crossing the encounter boundary, the old close meshes disappear.
- Logout/login reconstructs the same result from ship and body positions.
- The bodies may remain detectable without appearing to surround the ship.

This recommendation is intentionally not a final decision. Encounter-zone modeling may be preferable if the game needs authored asteroid-field gameplay.

## Thresholds Requiring Product Decisions

The following values must not be selected accidentally by implementation detail:

### Immediate encounter radius

Candidate starting value for discussion: approximately 100 km.

Reasons it may be reasonable:

- The observed old field was 25-56 km away.
- It would still count as a local field under this threshold.
- A player would need to travel beyond the field rather than merely a few kilometres.
- It is much smaller than the 7,500 km sensor range.

Reasons it may be wrong:

- The intended ship speed and session duration may make 100 km too large.
- The player's manual 5 km movement felt meaningful even though it did not exit a 25-56 km field.
- Gameplay may define an encounter by field geometry rather than distance from each body.
- Large asteroids and future stations may need different encounter thresholds.

### Sensor range

The current observed value was 7,500 km and is tied to sensor tier. It should remain a discovery rule, not become the close-mesh radius.

### Compression curve

The curve should be:

- Monotonic.
- Continuous.
- Stable across reload.
- Independent of array ordering.
- Derived from canonical distance.
- Invertible or explainable enough for navigation UI.

### Minimum apparent size

Small or distant objects may require:

- Minimum mesh radius.
- Screen-space marker.
- Glow.
- Reticle.
- LOD transition.

This is a visibility policy, not a reason to move the object's apparent center next to the ship.

### Boundary hysteresis

Use different enter and exit thresholds or a transition band to prevent an asteroid from repeatedly appearing/disappearing at a boundary.

Example for discussion:

```text
Enter close encounter at <= 90 km.
Remain in encounter until > 110 km.
Fade between close mesh and distant marker across the band.
```

## Interaction and Gameplay Questions

These questions should be answered before implementation:

1. Does a targetable asteroid need a close 3D mesh, or can a distant sensor contact be selected?
2. Can scanning begin on a distant contact, or must the ship enter the encounter?
3. Is scanner range different from visual mesh range?
4. Does targeting a distant contact temporarily promote it to a visible marker or mesh?
5. Should autopilot/navigation be able to approach a distant contact?
6. Are asteroid fields persistent world geography or temporary encounter content?
7. Should a completed tutorial field remain available for later mining?
8. Should unscanned tutorial filler expire while scanned discoveries persist?
9. Should different characters see the same persistent bodies?
10. Should mission-created bodies be discoverable without mission or creator filters?
11. What should happen if the ship logs out exactly on an encounter boundary?
12. How should very large objects, stations, planets, and debris use the same system?
13. Should visual compression apply to collision and flight, or only presentation?
14. What UI communicates that a contact is sensor-detected but not locally adjacent?

## Contract and Model Drift

The runtime response included `bodyType`, but the frontend list model currently omits it:

- [`celestial-body-upsert.ts`](../src/app/model/celestial-body-upsert.ts) includes optional `bodyType`.
- [`celestial-body-list.ts`](../src/app/model/celestial-body-list.ts) does not declare it on `CelestialBodyListItem`.

The runtime/list request supports the `unscanned` lifecycle state, but `CelestialBodyListItem.state` currently declares only:

```text
"active" | "destroyed"
```

The generic local-body mapper currently treats every non-destroyed body with a position as an asteroid.

Risks:

- Future stations, planets, debris, or ships returned by the same proximity query could be rendered as asteroids.
- TypeScript does not fully describe the observed response.
- Filtering by `bodyType` is unsafe until the OpenAPI contract makes its presence and allowed values sufficiently reliable.

Recommended contract work:

1. Treat the running OpenAPI document as the authority.
2. Confirm whether `bodyType` is guaranteed on list results.
3. Add it to the frontend model with the contract's actual allowed values.
4. Add `unscanned` to the response-state union.
5. Filter asteroid rendering by canonical body type.
6. Define behavior for missing/unknown body types.
7. Deduplicate defensively by canonical celestial-body ID.

Do not invent a mandatory discriminator client-side if OpenAPI still makes it optional.

## Data Identity and Determinism

Stable visuals should be based on stable world data.

Current placement seed includes:

- Ship ID.
- Sample ID.
- Array index.

Array index is especially fragile:

- Backend ordering changes can move every asteroid.
- Filtering one contact can shift later contacts.
- Adding a new body can rearrange unrelated bodies.

Future placement should prefer:

- Canonical body ID.
- Canonical position.
- Canonical encounter/cluster ID, if introduced.
- Stable field-local seed, if an authored encounter layout is used.

The identity seed can still drive:

- Rotation.
- Surface variation.
- Mesh profile.
- Small bounded positional jitter.
- LOD variation.

It should not replace canonical direction and distance.

## Numerical and Rendering Considerations

The observed ship coordinates are hundreds of millions of kilometres from the origin. Rendering absolute barycentric coordinates directly in Three.js would produce precision problems.

The current relative-position approach is correct in principle:

```text
renderPosition = bodyCanonicalPosition - localOriginCanonicalPosition
```

The local origin can be:

- Active ship position.
- Floating origin near the ship.
- Encounter center.

Recommendations:

- Keep canonical positions in backend/domain state.
- Render in a local floating-origin coordinate system.
- Rebase scene objects when the ship travels far enough.
- Never require the GPU scene to use the full barycentric coordinate magnitude.
- Make any compression a pure projection from canonical/local-relative coordinates.
- Keep simulation/persistence coordinates separate from visual projection.

## Motion Considerations

Returned bodies include motion information. A future implementation should decide:

- Whether canonical body positions are epoch-based snapshots.
- Whether the client propagates body position from `epochMs` and velocity.
- Whether local-body sweeps refresh while flying.
- Whether encounter membership is recalculated continuously or only on sweep.
- How frequently sensor contacts update.

The current root cause exists even for static bodies, so orbital/motion propagation is not required for the first fix. However, the new design should not prevent later motion support.

## Suggested Incremental Implementation Plan

### Phase 0: Decide semantics

Before code changes:

- Choose whether asteroid fields are individual-body proximity, explicit encounter zones, or a hybrid.
- Choose an initial immediate encounter radius.
- Choose the distant-contact representation.
- Decide whether old mission bodies are permanent.
- Resolve the `bodyType` OpenAPI/model gap.

### Phase 1: Make spatial projection explicit

Introduce a pure function that accepts:

- Canonical ship position.
- Canonical body position.
- Detection radius.
- Encounter thresholds.
- Compression policy.

It should return a presentation state such as:

```typescript
type SpatialContactPresentation =
  | {
      kind: 'encounter-mesh';
      scenePosition: [number, number, number];
      canonicalDistanceKm: number;
    }
  | {
      kind: 'distant-contact';
      direction: [number, number, number];
      canonicalDistanceKm: number;
    }
  | {
      kind: 'undetected';
      canonicalDistanceKm: number;
    };
```

Keep this pure and heavily unit tested.

### Phase 2: Stop discarding sample positions

Update asteroid visual derivation so:

- Placement uses the projected canonical relative vector.
- Identity-seeded randomness is limited to bounded cosmetic variation.
- Array index does not determine world placement.
- Existing scan/material/radius logic remains intact.

### Phase 3: Add distant contacts

Implement the minimum viable representation:

- Stable direction.
- Distance label or sensor-range category.
- Targetability decision.
- Accessible name/description.
- Clear distinction from a nearby mesh.

### Phase 4: Add transitions

Add:

- Hysteresis.
- Fade/crossfade.
- Stable selection while representation changes.
- No duplicate mesh and marker for the same canonical ID unless intentionally crossfading.

### Phase 5: Revisit lifecycle

After spatial presentation is correct, decide whether completed mission bodies should:

- Remain permanent.
- Expire.
- Archive.
- Become destroyed.
- Become field-scoped.
- Be filtered from generic exploration.

Do not use lifecycle deletion as a shortcut for the visual projection bug.

## Required Test Coverage

### Pure unit tests

1. A canonical relative vector keeps its direction after compression.
2. Greater canonical distance never maps to a smaller scene distance within the same presentation band.
3. Moving the ship changes the derived relative position.
4. Identical ship/body coordinates reproduce identical presentation after reconstruction.
5. Array reordering does not change a body's placement.
6. A contact beyond the encounter radius is not emitted as a close mesh.
7. A contact within sensor range but beyond encounter range becomes a distant contact.
8. A contact beyond sensor range is not presented.
9. Enter/exit hysteresis prevents threshold flicker.
10. Zero-distance and invalid-coordinate inputs are handled explicitly.

### Component/integration tests

1. Local-body mapping preserves canonical IDs and relative positions.
2. The scene renders only asteroid body types as asteroid meshes.
3. Empty backend results remain empty.
4. Distant contacts do not become close meshes.
5. Target/hover/scan state survives a mesh-to-marker transition as intended.
6. Scanned material and diameter visual behavior remains unchanged.

### Playwright E2E tests

1. Start near a known asteroid field.
2. Move the ship beyond the encounter exit threshold.
3. Confirm the close asteroid meshes disappear or transition to distant contacts.
4. Log out and log in.
5. Confirm the ship restores to the backend-acknowledged position.
6. Confirm the old close field does not reconstruct around the ship.
7. Confirm distant contacts remain if still inside sensor range.
8. Move back toward the field.
9. Confirm the same canonical bodies re-enter the encounter.
10. Confirm scan state and identity are preserved.

Additional E2E requirements:

- Use deterministic Socket.IO fixtures.
- Assert backend request/response traffic, not only retained component state.
- Avoid assumptions that many animation callbacks execute during one large Playwright Clock `fastForward()`.
- Run under the GitHub Actions/software-rendered Chromium configuration.

## Acceptance Criteria for the Player Problem

A future implementation should not be considered complete until all of the following are true:

1. A ship's canonical position persists across logout/login.
2. A body's canonical position remains independent of the ship.
3. Flying away changes the body's apparent direction/distance continuously or through a clearly communicated transition.
4. Leaving the encounter prevents the old bodies from being reconstructed as immediate neighbors.
5. Sensor-detected distant bodies do not masquerade as nearby flyable meshes.
6. Rejoining reproduces the presentation implied by persisted ship/body coordinates.
7. Existing targeting, scanning, and material-reveal gameplay remains usable.
8. Presentation remains readable under software rendering.
9. No new asteroid records are fabricated in generic exploration.
10. The UI makes any abstraction understandable enough that players do not reasonably infer a false physical location.

## Observability Recommendations

Future debugging would benefit from structured development telemetry for:

- Active ship canonical position.
- Local sweep center and radius.
- Returned canonical body count.
- Body ID, canonical distance, and body type.
- Chosen presentation kind: mesh, distant contact, or hidden.
- Compressed scene distance.
- Encounter enter/exit events.
- Whether a body came from scripted seeding or backend hydration.

Avoid logging session keys or other credentials.

A development-only overlay could show:

```text
sample-a8
canonical: 24.95 km
presentation: encounter-mesh
scene: 5.12 units
```

This would make future spatial mismatches much easier to diagnose.

## Risks of an Incomplete Fix

### Only increasing persistence precision

Would not fix the visual field because visual placement currently ignores canonical distance.

### Only reducing sensor radius

May hide old objects, but conflates detection with encounter and can make sensors meaningless.

### Only randomizing the layout on every login

Would make the field look different but would further weaken spatial continuity.

### Only filtering `first-target`

Would hide the observed records but leave every other canonical body subject to the same false close placement.

### Only using canonical direction

Would improve orientation but still make a 5,000 km body appear close if distance remains clamped without an encounter policy.

### Only using canonical distance without scale/readability work

Could make the scene technically correct but unplayable.

### Feeding compressed coordinates back into persistence

Would corrupt world state. Visual projection must remain one-way.

## Open Decisions Checklist

- [ ] Are first-target asteroids permanent world objects?
- [ ] Are asteroid fields explicit encounter entities?
- [ ] What is the immediate encounter radius?
- [ ] Is the radius per body type or encounter type?
- [ ] What compression curve is acceptable?
- [ ] What are the enter/exit hysteresis thresholds?
- [ ] How are distant contacts represented?
- [ ] Can distant contacts be targeted or scanned?
- [ ] Does selection survive representation transitions?
- [ ] Should completed mission bodies be filtered, archived, or expired?
- [ ] Is `bodyType` required in OpenAPI list responses?
- [ ] How are unknown body types handled?
- [ ] How often are proximity sweeps refreshed during flight?
- [ ] Is local collision based on canonical or projected coordinates?
- [ ] What spatial abstraction is communicated to the player?

## Key Files for a Future Session

### Spatial query and hydration

- [`ship-exterior-bootstrap-controller.ts`](../src/app/scene/ship-exterior/ship-exterior-bootstrap-controller.ts)
- [`ship-exterior-local-body-samples.ts`](../src/app/scene/ship-exterior/ship-exterior-local-body-samples.ts)
- [`ship-exterior-bare-scene.component.ts`](../src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts)

### Visual projection

- [`ship-exterior-asteroid-visuals.ts`](../src/app/scene/ship-exterior/ship-exterior-asteroid-visuals.ts)
- [`ship-scene-types.ts`](../src/app/scene/ship-exterior/ship-scene-types.ts)
- [`ship-scene-context.ts`](../src/app/scene/ship-exterior/ship-scene-context.ts)

### Mission routing

- [`character-list.ts`](../src/app/page/character/character-list.ts)
- [`generic-exploration-ship-exterior-mission.ts`](../src/app/mission/generic-exploration-ship-exterior-mission.ts)
- [`ship-exterior-mission.ts`](../src/app/mission/ship-exterior-mission.ts)

### Persistence and contracts

- [`asteroid-persistence.service.ts`](../src/app/scene/ship-exterior/asteroid-persistence.service.ts)
- [`celestial-body-list.ts`](../src/app/model/celestial-body-list.ts)
- [`celestial-body-upsert.ts`](../src/app/model/celestial-body-upsert.ts)
- [`ship-flight-position-persistence.service.ts`](../src/app/services/ship-flight-position-persistence.service.ts)

### Regression coverage

- [`ship-exterior-flight-position-persistence.spec.ts`](../e2e/tests/ship-exterior-flight-position-persistence.spec.ts)
- [`ship-exterior-flight-mode.spec.ts`](../e2e/tests/ship-exterior-flight-mode.spec.ts)
- [`ship-exterior-flight-controller.vitest.ts`](../src/app/scene/ship-exterior/ship-exterior-flight-controller.vitest.ts)

## Final Finding

The ship was not simply being reset to an unpersisted origin, and the completed-character login was not client-seeding a fresh asteroid field.

The backend returned real, previously persisted asteroid records near the restored ship position. The frontend then converted those records into accurate ship-relative samples but discarded those positions during final visual derivation, rebuilding every returned body into a deterministic close-range shell.

The durable fix is to make the visual system an explicit projection of canonical world space:

- Canonical positions decide where objects are and whether an encounter has been left.
- Sensor policy decides what is detectable.
- Encounter policy decides what receives a close interactive mesh.
- Visual compression and apparent-size policy keep the scene playable.
- Distant-contact UI preserves awareness without falsely placing remote objects beside the ship.

That separation preserves gameplay visuals while making the player's travel meaningful across logout and login.
