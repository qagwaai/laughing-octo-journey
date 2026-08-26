# SW-13A Execution Report (Nova)

Status: In Progress (Nova-only scope executed)  
Date: 2026-05-31  
Feature: SW-13A Ship-External-View Support  
Scope: ship-external-view only

## Scope Guardrails Applied

1. Forge contract semantics unchanged.
2. No schema/version expansion performed in Nova.
3. No legacy presentation fallback reintroduced.
4. High-poly readiness remains out of scope (SW-13B).

## M0A-M4A Evidence Summary

### M0A - Surface Baseline Lock

Completed:
1. Confirmed ship-external-view integration boundaries in `ship-exterior-view` scene path.
2. Confirmed current render surfaces in-route are asteroids and floating debris.
3. Enumerated SW-13 families baseline for ship-external-view tracking:
   - debris: salvage-fragment, wreckage-panel, cargo-canister, field-shard
   - asteroids: rocky-irregular, metallic-cluster, icy-body, cinematic-hero
   - ships: scout, hauler, frigate, interceptor, industrial
   - stations: trade-hub, refinery, naval-outpost, research-platform
   - gates: ring-gate, segmented-arch, relay-spindle

Implementation artifacts:
1. Added SW-13 descriptor resolver module for ship-exterior context:
   - `src/app/model/ship-exterior-descriptors.ts`
2. Added descriptor fields in ship-exterior route models:
   - `src/app/model/ship-exterior-asteroid-sample.ts`
   - `src/app/model/floating-debris-item.ts`

### M1A - Family Integration Pass

Completed (ship-external-view active families):
1. Asteroid samples now carry SW-13 descriptors during generation/resume and scan progression.
2. Floating debris now carries SW-13 descriptors for server-ingested and cold-boot seeded entries.
3. Floating debris visual node now consumes descriptor render profile for geometry/material behavior.

Implementation artifacts:
1. `src/app/mission/first-target-ship-exterior-mission.ts`
2. `src/app/services/floating-debris-state.service.ts`
3. `src/app/scene/ship-exterior/floating-debris-controller.ts`
4. `src/app/scene/ship-exterior/floating-debris-node.ts`
5. `src/app/scene/ship-exterior-view.ts`
6. `src/app/scene/ship-exterior-view.html`

Validation evidence:
1. `npm run test:spec -- "**/floating-debris-state.service.spec.ts"` passed (11 tests).
2. `npm run test:spec -- "**/floating-debris-node.spec.ts"` passed (8 tests).
3. `npm run test:spec -- "**/first-target-ship-exterior-mission.spec.ts"` passed (21 tests).
4. `npm run test:spec -- "**/ship-exterior-view.spec.ts"` passed (70 tests).

### M2A - Landmark and Ambiguity Pass

Partially completed:
1. Gate-family baseline and approach metadata constraints were verified against SW-13 artifacts.
2. In current ship-external-view runtime payloads, explicit gate/station landmark entities are not surfaced through the route's active socket feeds.

Result:
1. Gate/station ambiguity regression in ship-external-view cannot be fully executed Nova-only without contract-backed entity feed in this route.

### M3A - Performance and Fallback Pass

Completed for active families in-route:
1. Fallback tier behavior remains deterministic via descriptor profile resolution and tiered detail mapping.
2. Asteroid detail override now blends render-tier and descriptor geometry segment policy deterministically.
3. Debris rendering now deterministically maps descriptor objectFamily to geometry/material profile.

Validation evidence:
1. Focused spec suite pass for ship-external-view and descriptor-driven debris/asteroid changes.
2. `npm run build` passed (known pre-existing CSS budget warning only).

### M4A - Canary and Release Recommendation

Canary readiness for Nova-only SW-13A scope:
1. Go for ship-external-view descriptor support on active in-route families (asteroids + debris).
2. No-go for claiming full family completion (ships + gates + stations) until contract-fed entities are present in ship-external-view route payloads.

## Ship-External-View Family Coverage Summary

Implemented in runtime path:
1. asteroids: supported and descriptor-driven.
2. debris: supported and descriptor-driven.

Tracked baseline (coverage reference in code):
1. ships family baseline captured and active ship model descriptor derivation added.
2. gates family baseline captured.
3. stations family baseline captured.

Blocked from runtime rendering in current route payload feeds:
1. gates
2. stations
3. non-player ship encounter entities

## Fallback Determinism Summary

1. Descriptor fallback tier remains bounded to hero|standard|minimal.
2. Asteroid detail resolution is deterministic from descriptor geometry profile plus render-tier caps.
3. Debris geometry selection is deterministic from descriptor objectFamily.
4. No random descriptor fallback path was introduced post-resolution.

## Contract-Gap Triage List

### GAP-SW13A-001

- Current contract field/enum:
  - `item-list-by-location` payloads consumed by ship-external-view do not provide SW-13 gate entities.
- Required behavior in ship-external-view:
  - Gate landmark entities with position + descriptor family for M2A ambiguity validation.
- Why Nova-only handling is insufficient:
  - No canonical gate entity stream exists in active route socket responses to render/validate navigation landmarks.
- Proposed minimal contract change:
  - Add optional `gates[]` entity feed to ship-external route payload source with canonical `externalObjectDescriptor`.

### GAP-SW13A-002

- Current contract field/enum:
  - Active ship-external route feeds do not include station landmark entities with SW-13 descriptors.
- Required behavior in ship-external-view:
  - Station landmark rendering + readability checks in this route.
- Why Nova-only handling is insufficient:
  - Synthetic client-side station generation would not be contract-authoritative evidence.
- Proposed minimal contract change:
  - Add optional `stations[]` entity feed with canonical descriptor payloads in the ship-external route source.

### GAP-SW13A-003

- Current contract field/enum:
  - Ship encounter entities (non-player ships) are not provided to ship-external-view as descriptor-bearing scene objects.
- Required behavior in ship-external-view:
  - Full ships-family descriptor rendering validation beyond active player ship derivation.
- Why Nova-only handling is insufficient:
  - Without contract-fed encounter entities, ships-family coverage remains partial in-route.
- Proposed minimal contract change:
  - Add optional `encounterShips[]` feed with canonical descriptor payloads and spatial data.

## SW-13A Readiness Statement

SW-13A Nova execution is ready to close for the ship-external-view active-family slice (asteroids + debris) under current contract boundaries.

Full SW-13A all-family closure in ship-external-view requires resolution of listed contract gaps for gate/station/non-player-ship entity feeds.
