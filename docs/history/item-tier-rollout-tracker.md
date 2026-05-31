# Item Tier Rollout Tracker

- Date: 2026-05-22
- Status: Active (scanner Phase 1 slice implemented)
- Related decision: `docs/item-tier-functionality-architecture-decision.md`
- Scope: Tiered behavior rollout for currently active ship item families

## Purpose

Track implementation of tier-driven frontend behavior while preserving backend authority for item definitions and authoritative outcomes.

This document starts with scanner implementation, which has now been migrated to a tier capability resolver for Phase 1.

## Current Baseline (Confirmed)

- Tier 1 scanner duration in ship exterior is `10_000 ms`.
- Source: sensor-array capability resolver and scene scan-step mapping.
- Tier rule for rollout:
- Tier 1 scanner scan time must remain exactly the current baseline (`10_000 ms`).

## Implementation Plan: Sensor Array Tiered Scanning

### Goal

Replace hardcoded scanner timing with tier-driven behavior using `sensor-array` item tier, with no Tier 1 gameplay regression.

### Phase 1: Introduce scanner tier behavior model (completed)

1. Add a frontend model for scanner capabilities keyed by tier (1-20).
2. Add a resolver that maps inventory + active sensor item to scanner capability output.
3. Keep the model deterministic and side-effect free so it is easy to unit test.

Proposed output shape:

- `scanDurationMs`
- `scanTickMs`
- `scanDetailBand` (for UI detail reveal level)
- `qualityConfidence` (frontend-only detail presentation hint)

### Phase 2: Wire ship exterior scanning to model (completed in initial slice)

1. Replace direct use of `SCAN_TOTAL_MS` for progress math with resolved scanner capability.
2. Preserve existing tick behavior as default fallback.
3. Ensure Tier 1 output equals current values:
- `scanDurationMs = 10_000`
- `scanTickMs = 100`

### Phase 3: Add tests and migration safety (completed for initial scanner slice)

1. Unit tests for tier mapping (1, 5, 10, 15, 20 + out-of-range clamp).
2. Ship exterior spec update to validate Tier 1 still completes in 100 ticks at 100 ms tick.
3. Add tests ensuring missing `sensor-array` disables hover scanning and surfaces an error toast.

### Phase 4: Enable richer scanner tier effects

1. Add detail reveal progression linked to `scanDetailBand`.
2. Add optional per-tier UX affordances (reticle state, panel data density).
3. Keep mission/loot outcomes server-authoritative.

## Tier Bands (1-20) for Scanner (sensor-array)

Tier baseline and progression targets for planning. Values are frontend behavior targets until backend capability payloads are finalized.

| Tier | Scan Duration (ms) | Detail Band | Notes |
| --- | ---: | --- | --- |
| 1 | 10000 | basic | Exact parity with current hardcoded behavior |
| 2 | 9600 | basic | Small quality-of-life speed gain |
| 3 | 9200 | basic |  |
| 4 | 8800 | basic+ |  |
| 5 | 8400 | basic+ | First perceptible responsiveness bump |
| 6 | 8000 | standard |  |
| 7 | 7600 | standard |  |
| 8 | 7200 | standard+ |  |
| 9 | 6800 | standard+ |  |
| 10 | 6400 | advanced | Midpoint tier milestone |
| 11 | 6000 | advanced |  |
| 12 | 5600 | advanced+ |  |
| 13 | 5200 | advanced+ |  |
| 14 | 4800 | expert |  |
| 15 | 4400 | expert | Late-mid tier acceleration |
| 16 | 4000 | expert+ |  |
| 17 | 3600 | elite |  |
| 18 | 3200 | elite+ |  |
| 19 | 2800 | elite+ |  |
| 20 | 2400 | apex | Cap tier target for this iteration |

## Current Item Tier Tracking (1-20)

Use this as a single place to track what each current ship item gains by tier.

### 1) Sensor Array (`sensor-array`) - scanning via left-hover

- Interaction owner: frontend scan loop and UI.
- Backend authority: canonical tier capability payload.
- Tiered capability focus:
- Scan duration reduction (primary).
- Scan detail band expansion (secondary).
- Scan confidence and readout density (presentation).

Progress:

- Status: In progress (Phase 1 scanner slice complete)
- Tier model: Implemented (`item-tier-capabilities` resolver)
- Implementation: Live in ship exterior scan loop (temporary hardcoded active tier source)

### 2) Targeting (currently enabled by `expendable-dart-drone`) - right mouse hold

- Current state:
- Target lock capability is currently derived from dart-drone inventory presence.
- No dedicated targeting item type is enforced yet in ship exterior flow.
- Tiered capability candidates (1-20):
- Lock acquisition hold duration.
- Lock stability window and break tolerance.
- Target metadata depth (classification confidence, weak-point hints).

Progress:

- Status: Implemented
- Tier model: Reuses active `sensor-array` capability timing
- Implementation: Live in ship exterior target-lock hold for asteroids and debris

### 3) Tractor Beam (`ship-tractor-beam`) - `E` activation

- Current state:
- Fixed range and fixed pull/reverse durations in ship exterior.
- Tiered capability candidates (1-20):
- Beam range.
- Pull speed / pull duration.
- Capture reliability and energy efficiency (frontend presentation + backend validation).

Progress:

- Status: Implemented
- Tier model: Implemented (`item-tier-capabilities` resolver)
- Implementation: Live in ship exterior tractor beam range + pull duration

## Tier Bands (1-20) for Tractor Beam (`ship-tractor-beam`)

Tier baseline and progression targets for planning. Values are frontend behavior targets until backend capability payloads are finalized.

- Tier 1 tractor beam pull time is `10_000 ms`.
- Tier 1 tractor beam range is `10.0 km`.
- Tier 20 tractor beam pull time target is `1_200 ms`.
- Tier 20 tractor beam range target is `25.0 km`.

| Tier | Max Range (km) | Pull Duration (ms) | Notes |
| --- | ---: | ---: | --- |
| 1 | 10.0 | 10000 | Baseline parity range, new slower pull baseline |
| 2 | 10.789 | 9537 |  |
| 3 | 11.579 | 9074 |  |
| 4 | 12.368 | 8611 |  |
| 5 | 13.158 | 8147 |  |
| 6 | 13.947 | 7684 |  |
| 7 | 14.737 | 7221 |  |
| 8 | 15.526 | 6758 |  |
| 9 | 16.316 | 6295 |  |
| 10 | 17.105 | 5832 | Midpoint progression milestone |
| 11 | 17.895 | 5368 |  |
| 12 | 18.684 | 4905 | Highest intact-only tier currently used if present |
| 13 | 19.474 | 4442 |  |
| 14 | 20.263 | 3979 |  |
| 15 | 21.053 | 3516 |  |
| 16 | 21.842 | 3053 |  |
| 17 | 22.632 | 2589 |  |
| 18 | 23.421 | 2126 |  |
| 19 | 24.211 | 1663 |  |
| 20 | 25.0 | 1200 | Cap tier target for this iteration |

### 4) Dart Drone (`expendable-dart-drone`) - launch/impact workflow

- Current state:
- Launch-capable consumable item with targeting dependency in mission flow.
- Tiered capability candidates (1-20):
- Impact effectiveness profile.
- Guidance precision / impact variance.
- Post-impact debris quality hints and telemetry richness.

Progress:

- Status: Planned
- Tier model: Not started
- Implementation: Not started

## Cross-Item Tier Scaling Template (1-20)

Apply this shared structure for every item family so behavior remains predictable:

- Tiers 1-4: baseline + small improvements.
- Tiers 5-8: clear QoL gains and first identity shifts.
- Tiers 9-12: strong role expression and meaningful differentiation.
- Tiers 13-16: specialist behavior with noticeable tactical changes.
- Tiers 17-20: apex behavior with strict backend-validated boundaries.

## Data Contract and Code Work Checklist

1. Add frontend capability types for item tiers (scanner first).
2. Add adapter/resolver functions by item family.
3. Migrate ship exterior hardcoded scanner duration to adapter output.
4. Add unit tests per adapter and integration tests in ship exterior specs.
5. Document backend field alignment in OpenAPI (`openapi.yaml`, prefer `http://localhost:3000/openapi.yaml`) as capabilities are introduced.

## Definition of Done (Scanner First Slice)

- Tier 1 sensor array scan time remains `10_000 ms`.
- Ship exterior no longer hardcodes scanner total duration in scan progression logic.
- Tier 1-20 scanner mapping exists in a typed frontend resolver.
- Unit and scene tests cover baseline parity and tier progression behavior.