# Scan/Target Reimplementation Plan

Status: Draft (Execution Ready)  
Date: 2026-08-26  
Repo: laughing-octo-journey  
Validation owner: user  
Validation policy: user_handles_tests

## 1. Objective

Reimplement ship exterior right-click target locking (asteroid-first pass) with historical behavior parity while preserving current architecture boundaries in the bare scene runtime.

## 2. Inputs and Constraints

1. Historical anchor behavior reviewed from commit `bdad35bde94a1f2a14d02a6566bb096e01ff61ff`.
2. First pass must include right-click target lock.
3. Full plan must include broader targeting slice.
4. Target lock can occur without requiring a prior scanned state.
5. Sensor array capability is required to initiate target lock hold.
6. Validation is user-owned; agent does not run tests/build/lint unless explicitly requested.

## 3. Architectural Guardrails (Separation of Concerns)

1. Keep input orchestration in [`ship-exterior-bare-scene.component.ts`](D:/at-template/at1/laughing-octo-journey/src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts).
2. Keep transient hold lifecycle/timers in [`ship-exterior-session-controller.ts`](D:/at-template/at1/laughing-octo-journey/src/app/scene/ship-exterior/ship-exterior-session-controller.ts) rather than ad-hoc component-local timer branches.
3. Keep asteroid target/hover/hold state ownership in [`ship-scene-context.ts`](D:/at-template/at1/laughing-octo-journey/src/app/scene/ship-exterior/ship-scene-context.ts).
4. Keep per-asteroid mesh/event contracts in [`asteroid.ts`](D:/at-template/at1/laughing-octo-journey/src/app/component/asteroid.ts) + [`asteroid.html`](D:/at-template/at1/laughing-octo-journey/src/app/component/asteroid.html).
5. Keep hold-duration policy sourced from capabilities in [`item-tier-capabilities.ts`](D:/at-template/at1/laughing-octo-journey/src/app/model/item-tier-capabilities.ts), not hardcoded at call sites.
6. Avoid mixing mission progression logic into low-level pointer handling paths beyond existing extension points.

## 4. Scope

In scope:
1. Right-click hold-to-lock on asteroid target (first pass).
2. Sensor-array-gated targeting hold.
3. Target lock without scan prerequisite.
4. Dedicated lock visual animation parity.
5. Unit + targeted e2e coverage in same PR.
6. Manual validation checklist in same PR.

Out of scope for first implementation pass:
1. Debris targeting parity unless needed for shared-path regression prevention.
2. Broad launch/mission refactors unrelated to lock behavior.

## 5. Implementation Phases

### Phase A - Right-click input parity (first pass)

1. Update window pointer handling in [`ship-exterior-bare-scene.component.ts`](D:/at-template/at1/laughing-octo-journey/src/app/scene/ship-exterior/ship-exterior-bare-scene.component.ts):
   - Start hold on right button down (`button === 2`) over hovered asteroid.
   - Cancel hold on right button up (`button === 2`).
2. Keep `contextmenu` suppression behavior consistent with current scene UX.

### Phase B - Hold lifecycle consolidation

1. Route begin/cancel hold flow through [`ShipExteriorSessionController`](D:/at-template/at1/laughing-octo-journey/src/app/scene/ship-exterior/ship-exterior-session-controller.ts) to centralize lifecycle.
2. Ensure hold candidate and timeout cleanup on:
   - pointer up,
   - hover loss,
   - context switch,
   - teardown.

### Phase C - Capability gate + lock confirmation

1. Require active sensor-array capability before beginning hold; surface explicit error toast on failure.
2. Keep lock confirmation path free of `sample.scanned` gating.
3. Continue using capability-derived hold duration (`resolveSensorArrayTargetLockHoldMs`).

### Phase D - Target lock visuals

1. Preserve/restore distinct states:
   - targeting-hold ring animation,
   - targeted lock ring animation.
2. Keep animation updates in render-time visual sync paths in [`ship-scene-context.ts`](D:/at-template/at1/laughing-octo-journey/src/app/scene/ship-exterior/ship-scene-context.ts), not in input handlers.

### Phase E - Full targeting slice completion

1. Verify persistence and state consistency with existing context state flows.
2. Ensure lock state remains coherent across ship/context transitions.
3. Ensure launch-target reads remain compatible with restored lock behavior.

## 6. Test Plan (User-Run Validation Handoffs)

### Unit-first handoff

Run focused vitest specs for changed behavior:

```bash
npm run test:spec -- src/app/component/asteroid.vitest.ts src/app/scene/ship-exterior/floating-debris-node.vitest.ts src/app/scene/ship-exterior/ship-exterior-bare-scene.targeting.vitest.ts
```

Notes:
1. Add/extend `ship-exterior-bare-scene` targeting unit coverage for right-button down/up, hold completion, cancellation, sensor-array gating, and unscanned lock success.
2. Keep tests deterministic via direct scene/test API hooks.

### Targeted e2e handoff

Run targeted ship-exterior e2e suite:

```bash
npm run e2e:spec -- e2e/tests/ship-exterior-test-utils.spec.ts
```

Optional follow-up confidence run:

```bash
npm run e2e:spec -- e2e/tests/ship-exterior-hangar-resume.spec.ts
```

### Manual validation handoff

Start app:

```bash
npm start
```

Manual checklist:
1. Right-click hold begins lock candidate state.
2. Releasing right-click early cancels candidate and does not lock.
3. Holding through duration locks asteroid.
4. Lock succeeds on unscanned asteroid.
5. Missing sensor array blocks hold and surfaces error toast.
6. Dedicated lock visual animation is visible and distinct from hold/hover visuals.

## 7. Risks and Mitigations

1. Risk: input regressions from changing pointer button semantics.
   - Mitigation: tightly scoped unit tests around pointer down/up branches.
2. Risk: timer duplication between component and session controller.
   - Mitigation: consolidate hold lifecycle in session controller and keep one active timer authority.
3. Risk: visual regressions from state/render coupling.
   - Mitigation: keep visual updates in render sync methods and assert state transitions in tests.

## 8. Exit Criteria

1. Right-click hold-to-lock parity restored for asteroid targeting.
2. Sensor-array gate enforced with explicit user feedback.
3. Lock can be acquired without prior scanned state.
4. Dedicated target lock visual animation present.
5. User-run unit, targeted e2e, and manual validation complete with passing evidence.
