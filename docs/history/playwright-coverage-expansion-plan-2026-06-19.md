# Playwright Coverage Expansion Plan

Date: 2026-06-19
Status: Draft for implementation planning
Owner: QA automation / frontend gameplay reliability

## Legend

| Marker | Meaning |
| --- | --- |
| ☐ | Not started |
| ◧ | In progress |
| ☑ | Done |
| ⚠ | Blocked / needs decision |

## Current Coverage Snapshot

- ☑ 33 Playwright specs currently in e2e/tests.
- ☑ Core auth and character management flows are covered.
- ☑ Mission board and first-target transition flows are covered.
- ☑ Market hub base flows are covered (location, cross-system, docking, grouped sections).
- ☑ Ship exterior baseline flows are covered (flight mode, position persistence, hangar resume).
- ⚠ Reconnect-path behavior is not deeply covered for live socket workflows.
- ⚠ Route-feed driven gate rendering in ship-exterior scene lacks direct end-to-end coverage.
- ⚠ Mid-flight event handling (mission completion, character switch) has lifecycle regression risk.

---

## Problem Statement

Recent functionality increased lifecycle and socket complexity in three areas:

1. Persistent scene host with activate/deactivate/resume behavior.
2. Socket correlation and reconnect handling through domain services.
3. Market route-feed adapter behavior driving scene gate/station state.

Current tests validate happy-path behavior but do not fully stress reconnection, cross-route continuity, and live event mutation while the scene is active.

---

## Strategy

1. Prioritize tests by impact x likelihood of regression.
2. Front-load reconnect and lifecycle integrity tests before content-level visual checks.
3. Keep new tests deterministic via SocketIOMock sequencing and explicit readiness waits.
4. Add coverage in small clusters to keep failures attributable and triage-friendly.

---

## Prioritized Backlog (Top 8)

## P0: Stability and Data Integrity

Status: ☐ Not started

### Objectives

- [ ] Add reconnect and correlation-hardening coverage for market-list and flight loops.
- [ ] Ensure route transitions do not recreate or duplicate scene runtime behavior.
- [ ] Verify reconnect resumes exactly once without duplicate listeners or loops.

### Tests

- [ ] New spec: market-list reconnect correlation recovery
  - File target: e2e/tests/market-hub-socket-reconnect-correlation.spec.ts
  - Main assertions:
    - market-list request correlation ID is echoed and enforced
    - stale pre-disconnect response is ignored
    - post-reconnect response is accepted once
    - no duplicate market rendering updates
  - Effort: M

- [ ] New spec: flight -> mission-board -> flight route roundtrip continuity
  - File target: e2e/tests/ship-exterior-flight-route-roundtrip.spec.ts
  - Main assertions:
    - flight state visible before route change
    - mission-board route hides scene without teardown side effects
    - return to ship exterior resumes same runtime state
    - no camera or loop reset indicators
  - Effort: M

- [ ] New spec: reconnect resumes flight loop once
  - File target: e2e/tests/ship-exterior-flight-reconnect-single-loop.spec.ts
  - Main assertions:
    - active loop before disconnect
    - reconnect resumes loop
    - no duplicate update cadence or duplicate emits
  - Effort: M

### Hard Validation

- [ ] Each new P0 test fails when reconnect guard logic is intentionally broken in local branch.
- [ ] P0 tests pass consistently in three consecutive runs.

---

## P1: Route-Feed and Docking Correctness

Status: ☐ Not started

### Objectives

- [ ] Validate route-feed adapter outcomes in real gameplay flow.
- [ ] Validate docking transitions across refetch cycles.

### Tests

- [ ] New spec: route-feed gates render in scene during flight
  - File target: e2e/tests/ship-exterior-route-feed-gates.spec.ts
  - Main assertions:
    - market-list response with gate route feed updates visible scene state
    - gate appears with expected descriptor metadata
    - interaction/proximity behavior is available once gate is in range
  - Effort: L

- [ ] New spec: dock -> undock -> refetch yields fresh market state
  - File target: e2e/tests/market-hub-docking-refresh.spec.ts
  - Main assertions:
    - docking state toggles correctly
    - subsequent market-list reflects current docking truth, not stale cached state
  - Effort: S

### Hard Validation

- [ ] Market state assertions include both UI-visible state and mock-level event checks.
- [ ] Route-feed test validates both presence and update behavior for repeated payloads.

---

## P2: Flow Robustness During Active Scene Runtime

Status: ☐ Not started

### Objectives

- [ ] Confirm character and mission mutations during active flight do not destabilize scene runtime.
- [ ] Confirm traversal actions respect server-authoritative route metadata.

### Tests

- [ ] New spec: character switch during active flight performs clean scene teardown/re-entry
  - File target: e2e/tests/ship-exterior-character-switch-cleanup.spec.ts
  - Main assertions:
    - switch to character list while flight active
    - no orphaned loop behavior after switch
    - rejoin with second character is clean and deterministic
  - Effort: S

- [ ] New spec: gate traversal uses hop validation from server route data
  - File target: e2e/tests/ship-exterior-gate-hop-validation.spec.ts
  - Main assertions:
    - hop count shown from server route payload
    - traverse emit contains expected route/hop values
    - no traversal emit when route indicates no-route
  - Effort: S

- [ ] New spec: mission completion event while flying updates HUD without scene reset
  - File target: e2e/tests/ship-exterior-mission-complete-in-flight.spec.ts
  - Main assertions:
    - mission-upsert completion updates UI
    - flight loop remains active
    - no implicit scene deactivate/activate cycle triggered
  - Effort: S

### Hard Validation

- [ ] All P2 tests pass with console error guard enabled.
- [ ] No flaky waits based on fixed timeouts only.

---

## Implementation Notes

### Socket Mock Requirements

- Track correlation IDs per request type.
- Reject mismatched correlation responses by default.
- Support deterministic disconnect/reconnect hooks.
- Support delayed response queues for race-condition scenarios.

### Synchronization Rules

- Wait for telemetry readiness before flight-panel interactions.
- Wait for URL transitions before asserting scene state.
- Prefer condition-based waits over fixed sleeps.

### Anti-Flake Policy

- Avoid assertions that rely only on animation timing.
- Keep one dominant behavior goal per spec.
- Keep fixtures explicit and local to each spec where behavior diverges.

---

## Suggested Delivery Sequence

1. Implement P0 (3 specs) and stabilize.
2. Implement P1 (2 specs), then run targeted reruns.
3. Implement P2 (3 specs) and consolidate helper utilities.

---

## Success Criteria

- [ ] 8 new high-value specs added and green.
- [ ] Reconnect and lifecycle regressions become first-class e2e gates.
- [ ] Route-feed and docking edge-case behavior has deterministic coverage.
- [ ] Mid-flight mutation flows covered without timing-based flake.

---

## References

- Existing plan style baseline: docs/planning/ship-external-view-long-term-plan.md
- Existing e2e coverage set: e2e/tests
- Route feed adapter: src/app/scene/ship-exterior/ship-exterior-route-feed-adapter.ts
- Market hub gameplay page: src/app/page/game/market-hub.ts
- Scene lifecycle owner: src/app/scene/ship-exterior-view.ts
- Socket mock fixture: e2e/fixtures/socket-mock.ts
- Testing policy: docs/testing-policy.md
