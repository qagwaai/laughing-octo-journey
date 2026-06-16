# Ship External View Long-Term Plan

Date: 2026-06-15
Status: Draft for implementation planning
Owner: Frontend architecture / gameplay scene lifecycle

## Legend

| Marker | Meaning |
| --- | --- |
| ☐ | Not started |
| ◧ | In progress |
| ☑ | Done |
| ⚠ | Blocked / needs decision |

## Current Implementation Snapshot

- ☑ Persistent ship-external-view host: **Phase 1 complete — the persistent AppComponent host and overlay routing are live**.
- ☑ Right-pane Angular routes can overlay the scene (infrastructure exists).
- ☑ Scene lifecycle uses explicit deactivate / activate transitions.
- ☑ SceneVisibilityService wires right-outlet active state to scene hide/show.
- ☑ Scene bootstrap-once guard added (sceneBootstrapped flag prevents re-init on resume).
- ☑ viewOrientationRestoreEffect sealed after first bootstrap (orientationRestored = true).
- ☑ All camera capture/restore scaffolding removed — scene designed to never need it.
- ☑ cold-boot-scan.html ngt-canvas camera config stabilized (no inline object literals).
- ☑ AppComponent ngt-canvas camera config stabilized (no inline object literals).
- ☑ AppComponent now owns the ship-exterior HUD overlay shell.
- ☑ Scan overlay no longer hides the scene host, so scan loops can continue while the right outlet is present.
- ☑ Hidden scene rendering driven by demand mode.
- ☑ Ship-scoped hydration keys include shipId.
- [ ] Rollout guard and rollback path defined.

---

## Root Cause Discovery (2026-06-15)

After extensive investigation, the camera persistence problem was traced to a **host architecture mismatch**, not a save/restore or lifecycle issue:

### The Core Problem

`ColdBootScanPage` used to own the ship-exterior HUD shell and an `<ngt-canvas>`. Angular destroys/recreates route components on every navigation, so camera continuity requires the scene to live in the AppComponent persistent canvas and the HUD to live in the AppComponent shell too.

### Why Save/Restore Cannot Solve This

Save/restore was attempted and failed because:
- The camera config `{ position: [0, 1.8, 6.6], fov: 52 }` was an inline object literal, causing `ngt-canvas` to treat every change-detection cycle as a new config and reset the camera.
- Even with stabilized camera config, `viewOrientationRestoreEffect` re-applied the stored orientation on every new canvas mount, overwriting the user's last pose.
- Even with the effect sealed, the angular-three `NgtStore` resets camera state on canvas reinit.

### The Correct Architectural Fix (Phase 1 completion)

The scene must live in the **persistent AppComponent canvas** (primary outlet), never inside a right-outlet component.

1. Join game flow navigates the primary outlet to a persistent scene route.
2. `ColdBootScanPage` HUD (flight panel, objective text, debug) becomes a floating overlay or left-panel component that does not own a canvas.
2. `ColdBootScanPage` becomes a blank route placeholder; the HUD (flight panel, objective text, debug) lives in the persistent AppComponent shell.
3. Right outlet = mission board, market hub, specs overlays only — never a scene host.
4. When navigating to mission board, the scene is hidden behind the overlay (SceneVisibilityService already handles this).
5. When returning from the scan overlay, the scene stays alive and the scan loop remains attached.
6. When returning from mission board / market hub overlays, the scene is exactly where it was — no save, no restore.

This is the correct completion of Phase 1. All Phase 2 lifecycle work (bootstrap-once, deactivate/activate, orientation guard sealing) is still valid and required for this architecture.

---

## Persistent Ship External View

### Problem Statement

The current ship-external-view flow relies on destroy-and-restore during right-pane navigation. This has repeatedly introduced restoration gaps (camera continuity, asteroid continuity, debris continuity, phase drift) and increases implementation risk for future features.

### Strategy

Keep a ship-external-view scene mounted and hydrated for the duration of the login session, then:

1. Hide it (do not destroy it) when right-pane Angular pages are shown.
2. Pause application loops while hidden.
3. Use angular-three on-demand rendering while hidden to minimize GPU/CPU work.
4. Resume immediately when returning to ship-external-view, without full reconstruction.

### Design Principles

1. Scene lifetime is bound to login session, not right-outlet route changes.
2. Route changes trigger activate/deactivate, not ngOnDestroy/ngOnInit rebuild cycles.
3. Persisted storage remains fallback and recovery, not the primary re-entry path.
4. Per-ship state must be keyed by shipId for multi-ship correctness.
5. Rollout is feature-flagged with clear rollback path.

### Implementation State

- ☑ Decision recorded: persistent host + overlay routing is the chosen architecture.
- ☑ Decision recorded: route transitions call activate / deactivate instead of destroy / recreate.
- ☑ Decision recorded: ship-scoped state uses `shipId` as the primary key.
- ☑ Decision recorded: persisted storage remains fallback, not the primary restore path.

---

## Implementation Phases

## Phase 0: ADR and Scope Lock

Status: ☐ Planned

### Objectives

- [ ] Confirm architecture decision: persistent host + overlay right pages + activate/deactivate lifecycle.
- [ ] Lock state ownership model (in-memory vs sessionStorage vs localStorage vs backend).
- [ ] Lock per-ship scoping rules.

### Deliverables

- [ ] ADR section added to this document.
- [ ] State ownership matrix approved by frontend and backend owners.
- [ ] Feature flag name and rollback plan defined.
- [ ] A concise implementation-state checklist exists in this document.

### Hard Validation

- [ ] Sign-off checklist completed by code owners.
- [ ] Explicit decision for ship-scoped keys (`shipId` included) documented.
- [ ] Rollback plan tested in dev via feature flag toggle.
- [ ] Open decisions below are reduced to zero or explicitly deferred.

---

## Phase 1: Persistent Scene Host and Overlay Routing

Status: ☑ Complete

### Overview
The persistent scene host migration is in place. The ship-external scene now lives in the AppComponent canvas, the HUD is shell-owned, and scan/overlay routes no longer tear down the live scene.

### Root Cause

`ColdBootScanPage` (right outlet) owns its own `<ngt-canvas>`. Angular destroys/recreates this on every navigation. Camera continuity requires the scene to live in the AppComponent persistent canvas instead.

### Objectives

- ☑ Right-outlet rendered as overlay layer above scene host.
- ☑ Route-derived scene visibility signal (SceneVisibilityService).
- ☑ AppComponent ngt-canvas camera config stabilized (no inline object literals).
- ☑ cold-boot-scan ngt-canvas camera config stabilized (no inline object literals).
- ☑ Migrate join-game flow to route the **primary outlet** to a persistent scene route.
- ☑ Extract `ColdBootScanPage` HUD (flight panel, objective text, debug panel) into a floating overlay or left-panel component that does not own a canvas.
- ☑ Remove `<ngt-canvas>` from `ColdBootScanPage` entirely.
- ☑ Ship-hangar "View External" navigates to the persistent primary scene, not the right outlet.
- ☑ All scene entry points (cold-boot, ship-hangar, station exit, jump gate) pass init context to the primary scene via route state.
- ☑ Right outlet restricted to: mission board, market hub, item specs, repair, fabrication — never a scene host.
- ☑ Scan overlay stays transparent to scene lifecycle so activation does not flap during the scan flow.

### Primary Touchpoints

- ☑ [src/app/app.component.html](../../src/app/app.component.html) — persistent canvas and HUD shell host
- ☑ [src/app/app.component.ts](../../src/app/app.component.ts) — entry route drives primary canvas and HUD visibility
- ☑ [src/app/routed.routes.ts](../../src/app/routed.routes.ts) — primary route for persistent scene
- ☑ [src/app/page/opening/cold-boot-scan.ts](../../src/app/page/opening/cold-boot-scan.ts) — blank route placeholder
- ☑ [src/app/page/opening/cold-boot-scan.html](../../src/app/page/opening/cold-boot-scan.html) — blank route placeholder
- ☑ [src/app/page/opening/ship-exterior-hud-overlay.ts](../../src/app/page/opening/ship-exterior-hud-overlay.ts) — dedicated HUD overlay shell
- ☑ [src/app/app.component.html](../../src/app/app.component.html) — HUD now rendered from persistent app shell
- ☑ [src/app/app.component.ts](../../src/app/app.component.ts) — scan overlay excluded from scene hiding
- ☑ [src/app/page/game/ship-hangar.ts](../../src/app/page/game/ship-hangar.ts) — route to primary scene
- ☑ [src/app/page/opening/ship-exterior-hud-overlay.ts](../../src/app/page/opening/ship-exterior-hud-overlay.ts) — floating HUD overlay component for flight panel / objective text

### Hard Validation

- ☑ Unit test: navigating to right-outlet pages does not trigger ship scene ngOnDestroy.
- ☑ Unit test: returning from mission-board/market-hub/hangar preserves same scene instance.
- ☑ Manual check: rotate camera, navigate to Mission Board, return — pose is preserved exactly.
- ☑ Manual check: ship-hangar View External re-enters same persistent scene (no full reload).
- ☑ Manual check: ngt-canvas is rendered exactly once in the DOM at all times.
- ☑ Manual check: scan overlay can start, tick, and complete without the loop stopping at tick 0.

---

## Phase 2: Scene Activation Lifecycle (Deactivate/Activate)

Status: ☑ Complete

### Overview
Scene activation/deactivation lifecycle is now fully implemented and tested. The scene can transition between active and inactive states without being destroyed, preserving all in-memory state. Route changes trigger these transitions via the SceneVisibilityService.

### Objectives

- ☑ Split one-time setup/teardown from route-level activation transitions.
- ☑ Introduce explicit deactivateScene() and activateScene() behavior.
- ☑ Make activation idempotent and safe across repeated route changes.
- ☑ Wire route visibility signal so scene responds to right-outlet navigation.

### Primary Touchpoints

- ☑ [src/app/scene/ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts)
  - Bootstrap-once guard (`sceneBootstrapped` flag) — re-entry skips full init, only resumes loops
  - `resumeSceneRuntime()` — pause/resume subscriptions and loops only
  - `viewOrientationRestoreEffect` sealed after first bootstrap (`orientationRestored = true`)
  - All camera capture/restore helpers removed — scene designed to never need them
- ☑ [src/app/scene/ship-exterior/ship-exterior-session-controller.ts](../../src/app/scene/ship-exterior/ship-exterior-session-controller.ts)
- ☑ [src/app/services/scene-visibility.service.ts](../../src/app/services/scene-visibility.service.ts)
- ☑ [src/app/app.component.ts](../../src/app/app.component.ts)

### Deactivate Requirements

- ☑ Stop scan loop.
- ☑ Stop flight loop.
- ☑ Stop tractor beam animation loop.
- ☑ Detach pointer/keyboard input.
- ☑ Suppress non-essential toasts/debug emissions while hidden.

### Activate Requirements

- ☑ Reattach input.
- ☑ Restart loops exactly once.
- ☑ Refresh backend snapshots incrementally (no full reseed).
- ☑ Resume from in-memory state without visual reset.

### Hard Validation

- ☑ Unit test: deactivateScene() is idempotent (double-call safe).
- ☑ Unit test: activateScene() is idempotent (double-call safe).
- ☑ Unit test: timer count before/after route toggles remains bounded (no interval leaks).
- ☑ Unit test: scene instance is preserved across hide/show cycles.
- ☑ Unit test: scene responds to route visibility signal (right-outlet navigation).
- ☑ Integration test: 20 repeated hide/show cycles produce stable memory and no duplicate listeners.
- ☑ Integration test: rapid visibility toggles (10 cycles) produce no console errors.
- ☑ Build: no TypeScript errors after adding SceneVisibilityService.
- ☑ Camera pose continuity across hide/show validated (persistent AppComponent canvas host preserves pose across hide/show cycles).

---

## Phase 3: On-Demand Rendering Control

Status: ☑ Done

### Objectives

- [x] Use angular-three frameloop demand mode when scene is hidden.
- [x] Return to always mode (or invalidated demand mode) on active view.
- [x] Ensure camera/controls changes call invalidate() where direct three.js mutations occur.
- [x] Confirm hidden-mode render cost drops without blocking resume behavior.

### Primary Touchpoints

- [ ] [src/app/page/opening/cold-boot-scan.ts](../../src/app/page/opening/cold-boot-scan.ts)
- [ ] [src/app/page/opening/cold-boot-scan.html](../../src/app/page/opening/cold-boot-scan.html)
- [ ] [src/app/scene/ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts)

### Deliverables

- [x] Frameloop signal policy wired to visibility (active vs hidden).
- [x] Explicit invalidate calls at required mutation points.
- [x] Performance instrumentation for hidden-mode idle behavior.
- [x] A clear rule exists for which state transitions must call invalidate().

### Hard Validation

- [x] Manual perf trace: hidden scene frame activity near idle.
- [x] Unit/integration test: on resume, first frame renders correctly without user interaction deadlock.
- [x] Manual check: orbit/camera orientation changes remain responsive when active.
- [x] Regression check: no animation freeze during active play.

---

## Phase 4: Per-Ship Hydrated State Model

Status: ☐ Planned

### Objectives

- [ ] Move scene cache scoping from mission+character to include `shipId` where required.
- [ ] Prevent cross-ship contamination when switching active ships.
- [ ] Add debris persistence policy aligned with ship scope.
- [ ] Distinguish session-only state from state that can survive route churn.

### Primary Touchpoints

- [ ] [src/app/services/ship-exterior-asteroid-state.service.ts](../../src/app/services/ship-exterior-asteroid-state.service.ts)
- [ ] [src/app/services/ship-exterior-view-state.service.ts](../../src/app/services/ship-exterior-view-state.service.ts)
- [ ] [src/app/services/floating-debris-state.service.ts](../../src/app/services/floating-debris-state.service.ts)
- [ ] [src/app/scene/ship-exterior-view.ts](../../src/app/scene/ship-exterior-view.ts)

### Deliverables

- [ ] Key schema including `shipId` for ship-specific state.
- [ ] Debris persistence implementation and invalidation rules.
- [ ] Reconciliation logic for stale cached entities not present in backend snapshot.
- [ ] Per-ship restore path documented with a concrete example.

### Hard Validation

- [ ] Integration test: switch Ship A -> Ship B -> Ship A and verify each ship restores its own state.
- [ ] Integration test: collected debris does not reappear after route cycle.
- [ ] Unit test: stale cached asteroid/debris entries are pruned on backend mismatch.
- [ ] Manual check: targeted asteroid restore never points to missing sample.

### Implementation State Notes

- [ ] Confirm whether debris is session-scoped, ship-scoped, or hybrid-scoped.
- [ ] Confirm whether stale cache reconciliation is TTL-based or snapshot-authoritative.
- [ ] Confirm which state survives browser refresh and which does not.

---

## Phase 5: Rollout, Monitoring, and Cleanup

Status: ☐ Planned

### Objectives

- [ ] Ship behind feature flag.
- [ ] Run side-by-side comparison with current restore path.
- [ ] Remove obsolete restore complexity only after stability window.
- [ ] Keep rollback path one toggle away throughout the rollout.

### Deliverables

- [ ] Feature flag guard in routing/lifecycle entry points.
- [ ] Telemetry counters for activate/deactivate, loop restarts, invalidation calls, and errors.
- [ ] Cleanup PR removing dead restoration-only paths after acceptance window.
- [ ] A rollout checklist exists for manual verification before flag expansion.

### Hard Validation

- [ ] Soak test in dev/stage: at least 30 minutes repeated navigation with no scene reset defects.
- [ ] Error budget gate: no increase in uncaught exceptions or contract mismatch warnings.
- [ ] E2E gate: ship-external-view navigation suite passes under both flag states.
- [ ] Rollback drill: disable flag and confirm old behavior still functional.

---

## Validation Matrix (Concrete)

- [ ] Lifecycle correctness: no unintended destroy/create during right-pane navigation.
- [ ] State continuity: camera, coordinates, asteroids, target, and debris remain stable across hide/show.
- [x] Performance: hidden mode reduces frame activity and avoids runaway intervals.
- [ ] Multi-ship correctness: no cross-ship state bleed.
- [ ] Reliability: idempotent activation methods and no listener/timer leaks.

### Visual Indicators for Status Updates

- [ ] Use `☐` for anything not yet started.
- [ ] Change to `◧` when work is underway but not complete.
- [ ] Change to `☑` when an item is implemented and validated.
- [ ] Add `⚠` beside any item that is blocked on a decision or dependency.

---

## Open Decisions

- [ ] Should hidden mode use demand->always toggle, or demand in both states with explicit invalidation?
- [ ] What is the required stale cache TTL before forced backend reconciliation?
- [ ] Which states remain session-only vs durable across browser restart?
- [ ] Is backend scene-checkpoint support in scope for later phases or explicitly out of scope?

---

## Suggested Execution Order

- [ ] Phase 0 and Phase 1 in one milestone (architecture and host refactor).
- [ ] Phase 2 immediately after (activation lifecycle correctness).
- [ ] Phase 3 next (on-demand render pause hardening).
- [ ] Phase 4 for per-ship correctness and debris continuity.
- [ ] Phase 5 for controlled rollout and cleanup.

## Suggested Reporting Format

- [ ] Track progress as `Phase N: ☐ Planned`, `Phase N: ◧ In progress`, or `Phase N: ☑ Done`.
- [ ] Move completed validation items to `☑` only after the related test or manual check is actually performed.
- [ ] Keep open decisions in this document until the corresponding implementation choice is locked.
