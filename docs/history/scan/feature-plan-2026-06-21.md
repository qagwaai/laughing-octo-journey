# Scan/Target Unified Interaction Feature Plan

Date: 2026-06-21
Owner: Frontend (Nova) + Backend (Forge)
Status: Proposed

## Objective

Enable scanning and targeting for any interactive object in ship-external-view, starting with Jax's ship, while preserving existing asteroid/debris behavior and enforcing backend-persisted contract truth.

## Confirmed Scope

- Phase 1 target: everything that is a scene entity should be eligible for scan/target.
- Interaction model:
  - Existing hover behavior drives scan.
  - Existing right mouse down/hold behavior drives target lock.
- Scan rules: one-time identify.
- Contract policy:
  - Continue using existing celestial-body contract.
  - Add/use NPC contract for Jax ship.
  - Add backend-persisted contract support for other entity categories that are not yet represented.

## Current Baseline (Implementation Anchors)

- Jax ship is currently render-only and emits no interaction events.
  - src/app/component/jaxs-ship.ts
- Jax ship is directly instantiated in ship-exterior-view scene template.
  - src/app/scene/ship-exterior-view.html
- Asteroid pipeline already supports hover-scan and right-hold targeting.
  - src/app/scene/ship-exterior-view.ts
- Debris pipeline supports right-hold targeting with separate handlers.
  - src/app/scene/ship-exterior-view.ts
- Active target state currently models only asteroid/debris kinds.
  - src/app/scene/ship-exterior-view.ts
- Route feed entities (gates/stations/encounter ships) are rendered but not currently interactive.
  - src/app/scene/ship-exterior/ship-exterior-route-feed-layer.ts

## Architecture Direction

### 1) Introduce Unified Scene Interaction Entity Model

Create a canonical frontend interaction model for all scan/target candidates.

Required fields (minimum):
- kind (asteroid | debris | npcShip | station | gate | encounterShip | other)
- id (stable scene entity id)
- source (which feed/controller produced it)
- position (scene/world position)
- scanned (boolean)
- scanProgress (0-100)
- descriptor (UI/render profile)
- backend references where available (for contract-backed actions)

State should converge to:
- hoveredEntityId
- targetHoldCandidateEntityId
- activeScanEntityId
- targetedEntity

### 2) Jax Vertical Slice First

Upgrade Jax component to emit interaction events aligned with existing pattern:
- hoverChange
- pointerButtonDown
- pointerButtonUp

Wire those into ship-exterior-view so Jax:
- can be scanned via hover using existing scan loop semantics
- can be targeted via right-hold
- displays target visual treatment
- persists one-time identified state

### 3) Generalize Handlers

Refactor asteroid/debris-specific interaction handlers into shared entity-agnostic handlers:
- shared hover enter/leave scan transitions
- shared right-hold target lock
- shared target clear/replace behavior

Keep asteroid-specific launch logic and celestial upsert behavior behind kind guards.

### 4) Expand to Additional Scene Objects

Add interaction wrappers for route feed entities and other scene objects:
- stations
- gates
- encounter ships
- additional object families as they become renderable entities

Route feed layer should emit interaction events instead of being display-only.

### 5) Contract and Persistence Rollout

- Keep current celestial-body list/upsert contract path for celestial targets.
- Add or complete NPC ship scan/target contract path for Jax.
- For other entity kinds, define persisted scan/target metadata in backend contracts before final UX claims.
- No frontend-only fallback as final state for contract-backed objects.

OpenAPI note:
- Repository-local openapi.yaml was not found during planning check.
- For contract changes, use runtime OpenAPI source of truth, then sync generated/typed frontend model artifacts.
- On any OpenAPI change:
  - bump info.version (patch by default)
  - run contract validation/regeneration checks

### 6) HUD and UX Integration

- Move from asteroid-only target readout toward generic targetedEntity HUD.
- Keep launch controls enabled only for valid celestial targets.
- Add entity-aware scan-complete messaging.

### 7) Persistence and Rehydration

- Extend targeted asteroid persistence to targeted entity persistence.
- On restore, validate entity existence by kind/source.
- Clear stale target references safely when feed/entity no longer exists.

## Milestones

1. M1: Jax interactive vertical slice
- Jax hover scan
- Jax right-hold target lock
- Jax target visuals
- Tests for Jax interaction path

2. M2: Unified interaction state and handlers
- Introduce generic scene interaction entity model
- Replace asteroid/debris split state where possible
- Maintain asteroid launch compatibility

3. M3: Route/feed entity interactivity
- stations/gates/encounter ships targetable/scannable
- route feed layer emits interaction events

4. M4: Contract and persistence completion
- NPC contract completion for Jax
- backend persisted support for remaining entity kinds

5. M5: Hardening and regression
- full scene regression (scan, target, launch, debris tractor)
- UX polish and telemetry logging consistency

## Test Strategy

Vitest/unit/component focus:
- Jax component emits hover and pointer events correctly.
- Jax scan completes one-time identify and persists.
- right-hold targeting works across entity kind transitions.
- asteroid/debris existing behavior remains unchanged.
- launch hotkeys remain gated to valid celestial targets.

Playwright/e2e focus:
- first-target flow includes successful Jax scan + target.
- asteroid scanning/targeting unaffected.
- debris tractor flow unaffected.

## Risks and Mitigations

- Risk: Regressions from mixed old/new target state.
  - Mitigation: adapter layer and staged migration (M1 then M2).
- Risk: Contract lag for non-celestial entities blocks persistence.
  - Mitigation: explicit M4 backend gate; do not mark complete without persisted contract path.
- Risk: Input conflicts between orbit controls and mesh pointer events.
  - Mitigation: reuse established pointer patterns from asteroid/debris handlers and add focused interaction tests.

## Definition of Done

- Jax ship is scannable and targetable in ship-external-view using existing controls.
- Any registered interactive scene entity can flow through one shared scan/target pipeline.
- Contract-backed entity scan/target state is persisted in backend-supported contracts.
- Existing asteroid/debris gameplay behaviors pass regression coverage.
