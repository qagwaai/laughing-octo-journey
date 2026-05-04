# Ship Exterior View Seeding Architecture Decision

- Date: 2026-04-27
- Status: Accepted
- Scope: Mission-aware seeding behavior for ship-exterior-view across multiple navigation entry points

## Context

The right-pane scene `ship-exterior-view` is entered from at least two flows:

- Cold boot scanning flow.
- Ship hangar flow.

Observed behavior was inconsistent:

- Cold boot re-entry for a started first-target mission correctly loaded previously scanned celestial bodies.
- Ship hangar entry did not load previously scanned celestial bodies and seeded a fresh local sample set.

Root cause was architectural coupling between seeding behavior and a single navigation flag (`firstTargetMissionStatus`). The scene logic treated this flag as a proxy for flow intent, which made behavior depend on caller-specific state shape rather than an explicit scene contract.

## Decision

Adopt an explicit mission context contract for `ship-exterior-view` and resolve seeding behavior by policy rather than by entrypoint.

### Contract

A shared model defines mission context and seeding policy:

- `missionContext.missionId`
- `missionContext.missionStatusHint` (optional)
- `missionContext.seedPolicy` = `auto | new | resume`

### Scene behavior

`ship-exterior-view` now resolves a seed policy via a centralized resolver:

- `resume` => load existing celestial bodies (in-progress path) and top up deterministic samples.
- `new` => seed a fresh deterministic sample set around starter ship context.
- `auto` => infer `new` vs `resume` from mission status hint.

Legacy compatibility is preserved by allowing fallback to `firstTargetMissionStatus` while callers migrate.

### Caller responsibilities

- Cold boot start-scanning path passes mission context with `seedPolicy: new`.
- Character-list direct rejoin (started mission) passes mission context with `seedPolicy: auto` and status hint.
- Ship hangar exterior-view navigation passes mission context with `seedPolicy: auto` and first-target status hint when available from character mission state.

## Rationale

- Keeps `ship-exterior-view` generic and reusable for current and future mission scenarios.
- Removes hidden coupling to one source flow.
- Makes entry intent explicit and testable.
- Supports future mission-specific scene behavior without adding route- or caller-specific conditionals in the scene.

## Alternatives Considered

1. Keep branching on `firstTargetMissionStatus` only.
- Rejected: brittle and entrypoint-coupled; does not scale for additional mission contexts.

2. Duplicate cold-boot seeding logic in ship-hangar flow.
- Rejected: logic drift risk and higher maintenance cost.

3. Add route-specific components per flow.
- Rejected: unnecessary fragmentation; same scene should remain shared.

## Consequences

Positive:

- Consistent mission-aware seeding behavior across cold boot and ship hangar.
- Clear API for future mission-driven use of ship-exterior-view.
- Better separation of concerns between navigation layer and scene internals.

Trade-offs:

- Slightly larger navigation state payload.
- Temporary dual support (`missionContext` plus legacy status fallback) until full migration is complete.

## Implementation Notes

Implemented with:

- Shared context/resolver model: `src/app/model/ship-exterior-view-context.ts`
- Scene seed policy resolution: `src/app/scene/ship-exterior-view.ts`
- Navigation state updates:
  - `src/app/page/opening/cold-boot.ts`
  - `src/app/page/character/character-list.ts`
  - `src/app/page/game/ship-hangar.ts`

Related unit tests were updated to assert mission context propagation and policy-based behavior.

## Follow-up Recommendations

- Remove legacy `firstTargetMissionStatus` fallback after all callers use `missionContext`.
- Introduce mission strategy mapping by `missionId` if mission-specific seeding rules diverge.
- Consider extending `auto` policy to fetch live mission status when hints are absent or stale.

## 2026-05-04 Addendum: Mission Gate Normalization and Repair Fallbacks

### Additional context

During first-target mission regression triage, mission completion could still appear after hull patch manufacture in some user sessions, even though manufacture should only unlock repair.

Two state-shape issues were identified:

- Legacy persisted mission gate states could be stored with fewer steps than current mission definitions (for example: missing `repair_scavenger_pod`).
- Repair detail flows could receive ship status indicating damage while `damageProfile` payload was absent in navigation state.

### Addendum decision

Normalize persisted mission gate state on read and evaluation paths against current mission step definitions, and apply mission-aware damage-profile fallback in repair detail pages.

### Addendum implementation points

- Mission gate normalization on read/evaluation:
  - `src/app/scene/ship-exterior-view.ts`
  - `src/app/page/game/mission-board.ts`
  - `src/app/page/game/repair-retrofit.ts`
  - `src/app/page/game/repair-retrofit-items.ts`
  - `src/app/page/game/repair-retrofit-ship-detail.ts`

- Repair damage fallback (when profile missing but mission/status implies damage):
  - `src/app/page/game/repair-retrofit-items.ts`
  - `src/app/page/game/repair-retrofit-ship-detail.ts`
  - `src/app/page/game/repair-retrofit-system-detail.ts`

### Addendum rationale

- Prevents false mission completion from truncated legacy gate state.
- Keeps mission progression deterministic: scan -> launch -> manufacture -> repair.
- Ensures repair UX reflects expected cold-boot damage context when profile payloads are omitted.

### Addendum verification

- Dedicated full-flow Playwright coverage added and passing:
  - `e2e/tests/first-target-full-mission-flow.spec.ts`
- Full Playwright Chromium suite passing after fixes.
