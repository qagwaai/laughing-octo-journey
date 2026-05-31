# Cold Boot UX Decision Record

- Date: 2026-04-21
- Status: Accepted
- Scope: Opening sequence split-screen experience

## Context

The opening flow uses a split layout:

- Left pane: narrative and system text content.
- Right pane: immersive cockpit scene rendered in canvas.

During review, the right pane included a full HUD text overlay that duplicated key information already shown in the left pane. This created visual competition, reduced immersion, and weakened hierarchy.

## Decision

Use a strict content separation model for cold boot:

- Left pane is the source of truth for persistent text UI.
- Right pane is immersive-first and does not render persistent HUD text overlays.
- Right pane may use minimal contextual cues only when needed (for example brief interaction hints).

## Rationale

- Improves visual hierarchy by separating instruction from atmosphere.
- Reduces cognitive load from duplicated messages.
- Preserves cinematic focus in the cockpit view.
- Makes narrative progression easier to follow because all persistent text lives in one place.

## UX Principles Applied

- One channel per intent: guidance text vs environmental storytelling.
- Persistent information should not compete with scene composition.
- Temporary right-pane cues should be short-lived and non-blocking.

## Implementation Notes

Applied in the scene layer by removing the in-scene HUD text component from the cold boot HUD scene template.

Result:

- Left pane remains responsible for boot stages, system checks, and AI transmission text.
- Right pane now presents the cracked cockpit, lighting, and debris ambience without text clutter.

## Consequences

Positive:

- Cleaner and more immersive right pane.
- Stronger readability and consistency in the left pane.
- Lower risk of message drift between duplicated UI surfaces.

Trade-offs:

- No always-visible text in the right pane if left pane is collapsed or hidden.
- Any right-pane guidance must be intentionally designed as brief overlays.

## Follow-up Recommendations

- If onboarding friction appears, add a subtle short-lived right-pane hint (for example drag-to-look) that auto-fades.
- Keep cold boot copy and state progression centralized in the left-pane opening page components.
- Re-evaluate this split after usability feedback from first-time players.
