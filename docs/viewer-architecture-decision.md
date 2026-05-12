# Solar System Viewer — Architecture Decision

## Status

Accepted (initial MVP).

## Context

The game world has historically rendered only the Sol system through hand-crafted
Angular Three components (`scene/ship-exterior-view.ts`, `component/sol.ts`).
We now need a player-facing way to browse the broader HYG star database that the
backend already exposes via socket events.

A new left-pane navigation item ("Viewer") presents a list of solar systems and,
on selection, drives the right pane to a 3D scene that renders the system's
celestial bodies.

Source data: HYG database (https://codeberg.org/astronexus/hyg) served by the
backend via the contract described in
https://github.com/qagwaai/solid-train/blob/main/MESSAGE_CONTRACT.md.

## Decision

### Routing & layout

- Add a left-outlet route `viewer` that loads `page/game/viewer.ts`. This page
  hosts `GuardedLeftMenu` and `CharacterShipBadge`, mirroring `mission-board`.
- Add a right-outlet route `viewer-scene` that loads
  `page/game/viewer-scene.ts`. This is a **wrapper page** that owns the
  `<ngt-canvas>` element and projects the inner scene component as canvas
  content. This convention is mandatory: any Angular Three scene that injects
  the `NgtStore` token (via `NgtsOrbitControls`, `NgtArgs`, `injectStore`,
  etc.) must be route-loaded indirectly through such a wrapper. Loading a
  scene component directly produces NG0201.

### Menu placement & gating

- The Viewer entry is inserted in `GuardedLeftMenu.menuItems` immediately
  after the Mission Board entry, with icon code `VW`.
- `ViewerPage.isViewerUnlocked()` is a predicate that always returns `true`
  for the MVP. The predicate exists as the future hook for entitlement checks
  so the menu structure does not need to change when gating is added.

### Data flow

- `SolarSystemService` (in `src/app/services/solar-system.service.ts`) wraps
  two socket request/response pairs:
  - `solar-system-list-request` / `solar-system-list-response`
  - `solar-system-get-request` / `solar-system-get-response`
- The list page issues a `solar-system-list-request` on `ngOnInit` (using the
  active `playerName` + `sessionKey`) with a default limit of 50 systems and a
  default 50-parsec radius. Selecting a system navigates the right outlet with
  the `solarSystemId` and the cached `SolarSystemSummary` payload in the
  navigation state, allowing the scene host to render summary metadata
  immediately while the body list streams in.
- `ViewerScenePage` reads navigation state in its constructor, requests
  `solar-system-get-request`, and feeds the resulting `ViewerBody[]` into
  `<app-viewer-system-scene>` via inputs.

### Scene rendering

- Stars: rendered with `MeshBasicMaterial` (self-lit) sized by
  `sqrt(luminositySolar)` and clamped to a small visible band.
- Non-stars: rendered with `MeshStandardMaterial` lit by a single point light
  at the system origin; size is derived from
  `physicalCatalog.estimatedDiameterM` via cube-root scaling relative to
  Earth's diameter.
- Positions: hybrid **log-distance** scaling. Bodies retain their direction
  vector from `spatial.positionKm` but their magnitude is
  `(1 + log10(km / 1e6 km)) * 4 scene units`. This keeps inner planets
  separable while still placing distant bodies in the same scene.
- Color: prefers `visualization.colorHex`; falls back to `#fff5b6` for stars
  and `#9bb1c9` for other bodies.
- All scaling helpers are isolated in
  `src/app/scene/viewer/viewer-formatters.ts` and unit-tested.

### Internationalization

- Keys live under `game.viewer` in `src/app/i18n/locales/en.ts` and
  `it.ts`. The Italian locale follows the existing convention of inheriting
  any unspecified strings from English via the deep merge in `locale.ts`.

## Consequences

- The viewer is decoupled from the existing Sol-specific scene assets and can
  evolve independently (e.g. orbital propagation, multi-star rendering) without
  destabilizing the cold-boot flow.
- Adding new system features (search input, time-of-day slider, body-detail
  panel) only requires extending the page or scene wrapper, not the routing or
  service layer.
- Future entitlement gating only needs to update `isViewerUnlocked()` and the
  menu rendering; the route itself is already authenticated via `authGuard`.

## Operational finding: target-fly snap

### Symptom

- During cinematic body targeting, the camera completed the fly-in and then
  visibly snapped back toward the system origin (sun-facing composition).

### Root cause

- The snap did not come from the tween path itself.
- After target-fly finalize, `NgtsOrbitControls` could be temporarily absent
  (target unavailable), which left camera ownership in a brief handoff state.
- In that state, control re-attachment/default target behavior could reorient
  toward origin unless target/pose were explicitly preserved.

### Fix pattern (keep)

- Preserve a persistent look target across frames (`persistentLookTarget`) and
  re-sync OrbitControls target when controls are present again.
- Persist the settled camera position at target-fly finalize and, while
  a target remains active with no running tween, restore that pose if drift is
  introduced by external camera ownership transitions.
- Do not clear/recenter camera pose when `targetBodyId` is cleared; only cancel
  target-flight state.

### Guardrails for future changes

- Any future camera controller integration must treat target-fly finalize as a
  cross-owner handoff point and preserve both camera position and look target.
- If snap behavior reappears, instrument the timeline around finalize and
  post-finalize snapshots to verify whether controls are absent during handoff.

## Alternatives considered

- **Embedding the scene directly in a route component.** Rejected — Angular
  Three's `NgtStore` is provided by `<ngt-canvas>`, so a scene route without a
  wrapper throws NG0201 at runtime. The wrapper convention is also already
  proven by the cold-boot scan flow.
- **Reusing the existing `Sol` component for non-Sol systems.** Rejected — its
  textures and shader assumptions are Sun-specific. A generic, color-driven
  star sphere keeps the MVP focused.
