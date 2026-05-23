# Item Tier Functionality Architecture Decision

- Date: 2026-05-22
- Status: Accepted
- Scope: Tiered ship item behavior in ship-exterior gameplay loops (scanner, targeting, tractor beam, drone, future modules)

## Context

The game now includes and will continue adding ship items with distinct interaction models:

- Sensor array tied to left-mouse hover scan behavior.
- Targeting behavior triggered on right mouse down.
- Tractor beam behavior triggered with `E`.
- Dart drone behavior and future deployable modules.

Backend item definitions are the system-of-record for item identity and inventory semantics. At the same time, the frontend must provide responsive player-facing behavior (input handling, progress UX, visual/audio feedback) that varies by tier.

If both tiers and behavior logic are independently authored on frontend and backend, drift risk is high (different scan times, lock windows, ranges, cooldowns). If all tier behavior is server-only, moment-to-moment UX iteration slows and interaction quality degrades.

## Decision

Adopt a split-responsibility model:

- Backend is the source of truth for tier capability data and authoritative outcomes.
- Frontend is the source of truth for real-time interaction and presentation driven by those capabilities.

This means the backend defines *what a tier can do* and the frontend defines *how it feels and is shown*.

## Responsibility Boundaries

### Backend responsibilities (authoritative)

- Canonical item definitions and tier metadata.
- Capability values that affect balance/economy/mission integrity.
- Validation and final resolution of state-changing actions.
- Versioned contract for item-tier capability payloads.

Examples of backend-owned capability fields:

- `scanDurationMs`
- `scanDetailLevel`
- `targetLockWindowMs`
- `targetingConeDeg`
- `tractorRangeMeters`
- `tractorPullForce`
- `droneDeployCooldownMs`

### Frontend responsibilities (experience)

- Input mapping and state machines per item interaction model.
- Translation of backend capability fields into interaction pacing.
- UX feedback: reticles, progress, scan readouts, VFX/SFX intensity.
- Local prediction/interpolation that does not mint authoritative outcomes.

Examples of frontend-owned behavior:

- Hover scanner progress animation and reveal sequencing.
- Target lock UI affordances and acquisition indicators.
- Tractor beam beam-shape, audio envelope, and camera feedback.
- Drone command UI, cooldown visualization, and deployment affordance.

## Architectural Pattern

Use a data-driven item behavior adapter pattern on the frontend.

1. Backend sends tier capability data as part of item definition payloads.
2. Frontend resolves an item behavior adapter by item type.
3. Adapter consumes capability data + current scene state.
4. Adapter emits UX-ready behavior outputs (timings, thresholds, detail bands, effects profile).
5. Server remains authoritative for final state-changing events.

### Suggested frontend shape

- `ItemTierCapabilities` model type in the shared frontend model layer.
- One adapter per item family (scanner, targeting, tractor, drone).
- Scene/controller code depends on adapter interfaces, not hard-coded tier branches.
- Unit tests target adapter mapping from capability input to UX output.

## Guardrails

- Do not hard-code tier multipliers directly in scene components.
- Do not duplicate canonical balance constants across frontend and backend.
- Do not let client-only timing determine inventory/resource/mission outcomes.
- Keep all tier-varying presentation deterministic from capability payload + local scene state.
- Preserve backward compatibility when contract versions evolve.

## Contract Guidance

- Define capability payloads in server message contracts and keep frontend model types aligned.
- Prefer additive versioning for new capability fields.
- Provide sane defaults for optional fields to avoid runtime regressions during rollout.
- Include explicit unit annotations in field names where practical (`Ms`, `Meters`, `Deg`).

Primary reference:

- `docs/server-message-contracts.md`

## Consequences

Positive:

- Clear ownership prevents split-brain tier logic.
- Faster frontend iteration on game feel without changing backend authority.
- Safer anti-cheat and economy integrity posture.
- Scales to new ship items without monolithic scene branching.

Trade-offs:

- Requires disciplined contract versioning.
- Requires adapter and contract tests to prevent mapping drift.
- Slightly more upfront architecture than embedding logic directly in scene code.

## Initial Rollout Plan

1. Introduce `ItemTierCapabilities` model and adapter interfaces on frontend.
2. Implement scanner adapter first (scan speed + detail reveal bands).
3. Route current scanner behavior in ship exterior through adapter outputs.
4. Add unit tests for scanner tier mapping and UX timing boundaries.
5. Extend pattern to targeting, tractor beam, and drone.

## Open Questions

- Which tier capability fields should be globally standardized across all item families versus item-specific?
- Should capability payloads be snapshot-only at loadout time, or hot-refreshable mid-session?
- Which outcomes remain fully server-resolved versus optimistic client-predicted with reconciliation?