# SW-15 M2-A1 Orion Slice Request (Nova)

Status: Proposed
Date: 2026-06-05
Feature: SW-15 Minimal Character Bust Builder v0
Slice: M2-A1 - Angular Three Character Preview
Repo: laughing-octo-journey (Nova)
Audience: Orion (coordination and gate authority)

---

## 1. Purpose

Define a new post-M2-A slice, `M2-A1`, to replace the current Create Character live preview card with a visual Angular Three preview of the selected character.

This slice is intentionally named `M2-A1` because an `M2-B` slice already exists in planning.

---

## 2. Input Lock (User Selections)

The following scope inputs are explicitly locked from the intake form and should be treated as source constraints for this slice:

1. Primary goal: Higher-fidelity showcase.
2. Render source: Form state only.
3. Interaction scope:
   - Drag rotate + zoom
   - Preset camera buttons
4. Asset strategy: Introduce a new dedicated bust model.
5. Required gates:
   - Desktop + mobile render reliability
   - Selector-to-3D mapping correctness
   - Deterministic unit + e2e coverage
   - Performance budget threshold (FPS/load time)

---

## 3. Scope In

1. Replace the current CSS/DOM live preview area in Create Character with an Angular Three scene preview panel.
2. Render a dedicated bust model whose visible attributes are driven directly from current selector form state.
3. Implement user interaction controls:
   - Drag rotate
   - Zoom
   - Camera preset buttons (front / three-quarter / profile minimum)
4. Ensure responsive behavior for desktop and mobile layouts in the existing page shell.
5. Preserve existing save flow semantics from M2-A:
   - blocked-save behavior
   - validation panel behavior
   - retry behavior

---

## 4. Scope Out (for M2-A1)

1. No server-driven preview source in this slice (form state remains authoritative for live preview).
2. No persistence/contract expansion beyond existing M2-A bust descriptor fields.
3. No additional gameplay-side scene integration outside Create Character.
4. No fallback contract workaround behavior.

---

## 5. Technical Direction

1. Use Angular Three patterns already established in this repo for scene composition and camera lifecycle.
2. Keep preview rendering isolated behind a dedicated component/module boundary to avoid bloating `character-setup` orchestration logic.
3. Wire descriptor-to-visual mapping as a pure transformation layer so it is testable without WebGL runtime.
4. Ensure camera control ownership is explicit to avoid control-state drift when switching preset camera views.
5. Keep styling and layout continuity with current Create Character structure while replacing only the preview implementation.

---

## 6. Acceptance Criteria (Orion Gate)

### 6.1 Reliability

1. Preview scene initializes without errors on desktop and mobile viewport profiles.
2. Repeated navigation to/from Create Character does not leak controls, listeners, or animation loops.

### 6.2 Mapping Correctness

1. Every selector field currently in M2-A produces a deterministic and visible effect in the 3D preview mapping layer.
2. Mapping behavior is stable under rapid selector changes.

### 6.3 Interaction

1. User can rotate and zoom preview with pointer/touch interaction.
2. Preset camera buttons move to deterministic viewpoints and remain compatible with subsequent drag/zoom.

### 6.4 Performance

1. Define and meet an explicit budget in the slice verification note (minimum FPS and/or max scene-init latency).
2. Performance validation must include both desktop and mobile-profile checks.

### 6.5 Testing

1. Deterministic unit tests for mapping and camera preset behavior.
2. Deterministic e2e coverage proving selector-to-visual update path and interaction controls are functional.
3. Existing character add/edit e2e flows remain green.

---

## 7. Required Deliverables

1. Implementation in Nova repo for M2-A1 preview replacement.
2. M2-A1 verification note with test evidence and performance evidence.
3. M2-A1 handoff note stating gate readiness to Orion.
4. Explicit list of any new assets introduced for the dedicated bust model.

---

## 8. Blocking Conditions

Orion should block M2-A1 close if any of the following occur:

1. Selector-to-3D mapping is partial, ambiguous, or non-deterministic.
2. Preview interactions work on desktop but fail on mobile profile.
3. Performance budget is not defined or not met.
4. New viewer causes regressions in existing character setup save semantics.

---

## 9. Proposed Next Step

Upon Orion approval, Nova starts M2-A1 implementation and keeps M2-B planning independent.
