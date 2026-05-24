# Ship Ownership Contract Rollout Plan

## Source Contract

- Live contract reviewed from `http://localhost:3000/openapi.yaml` using a cache-busted request.
- Primary contract theme for this rollout: backend ownership semantics are becoming explicit, and ship data is no longer safely modeled as character-bound by default.

## Contract Changes That Matter

The current live contract keeps the existing character-scoped ship flow, but adds a second ownership-aware layer that the frontend does not model yet.

### Still available

- `/socket/ship-list`
  - Still requests ships by `playerName + characterId + sessionKey`.
  - Still returns canonical ship payloads.
  - This is the current frontend dependency for join, hangar, market hydration, repair hydration, inventory refresh, and mission navigation bootstrap.

### New or materially changed

- `/socket/ship-list-by-owner`
  - Requests ships by a normalized owner descriptor.
  - Response includes a normalized `owner` descriptor and canonical `ship.ownership` payloads.
- `/socket/ship-transfer`
  - Introduces explicit ownership transfer semantics.
  - Supports unknown -> player-character claim flows via `claimToken`.
- `/socket/ship-upsert`
  - Ownership mutation is now strict.
  - Cross-player mutation attempts are rejected with `SHIP_OWNERSHIP_MISMATCH`.
  - `unknown -> player-character` ownership transitions require `claimToken`.
  - Legacy `ship.location` and `ship.kinematics` are explicitly rejected in favor of canonical `ship.spatial` and optional `ship.motion`.
- `/socket/character-list`
  - `characters[].ships` is now explicitly optional/enrichment-style rather than a stable assumption.

## Current Frontend Assumptions

The frontend is still predominantly character-scoped for ship discovery and session hydration.

### High-impact code paths

- [src/app/services/ship.service.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/services/ship.service.ts)
  - Only wraps `ship-list`.
- [src/app/services/mission-navigation/mission-navigation.service.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/services/mission-navigation/mission-navigation.service.ts)
  - Fetches the active ship via `ship-list` and stores the first returned ship in session state.
- [src/app/page/game/game-join.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/game-join.ts)
  - Loads ships for the selected character with `ship-list`.
- [src/app/page/game/ship-hangar.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/ship-hangar.ts)
  - Lists ships for the selected character with `ship-list`.
- [src/app/page/game/ship-view-inventory.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/ship-view-inventory.ts)
  - Refreshes active ship state with `ship-list`.
- [src/app/page/game/market-hub.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/market-hub.spec.ts)
  - Existing tests already depend on ship hydration behavior when the active ship is incomplete.
- [src/app/scene/ship-exterior-view.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/scene/ship-exterior-view.ts)
  - Uses `characterId` and active ship session state heavily for launch, tractor, mission, and location refresh flows.

## Rollout Strategy

The right first move is additive compatibility, not an immediate cutover.

### Phase 1: Add ownership-aware contract models without changing behavior

Create new frontend contract types for the new ship ownership layer.

- Add `ShipOwnerDescriptor` and `ShipOwnership` model types.
- Add request/response models for:
  - `ship-list-by-owner`
  - `ship-transfer`
- Extend `ShipSummary` to accept optional `ownership` without breaking existing callers.
- Extend ship normalization helpers so unknown ownership shapes fail soft instead of breaking views.

Expected outcome:

- The frontend can represent the new contract surface while preserving all current character-scoped flows.

### Phase 2: Extend `ShipService` with additive wrappers

Add new `ShipService` methods alongside the existing `listShips` method.

- Keep `listShips(request)` unchanged for current consumers.
- Add `listShipsByOwner(request)`.
- Add `transferShip(request)`.
- Keep response handling single-shot and consistent with the existing service style.

Expected outcome:

- New ownership-aware flows can be built without forcing every current caller to migrate in one patch.

### Phase 3: Normalize active ship selection rules

Introduce a single active-ship resolution helper or small service-level policy instead of letting each page decide independently.

- Preferred selection order:
  - existing session active ship when still present in refreshed results
  - exact ship id requested by navigation state
  - first ship with usable spatial data
  - first returned ship
- Make this policy usable from:
  - mission navigation
  - market hub hydration
  - hangar selection refresh
  - inventory refresh

Expected outcome:

- Contract changes to ownership or result ordering do not fragment active ship behavior across pages.

### Phase 4: Decide where owner-scoped loading replaces character-scoped loading

Do not replace all `ship-list` callers blindly. Split them by business meaning.

#### Keep character-scoped until proven otherwise

- `game-join`
- `ship-hangar`
- mission entry that is explicitly character-led

Reason:

- The live contract still supports `ship-list`, and these screens are still framed around the selected character.

#### Candidate migrations to owner-aware queries

- any future “all player ships” view
- claim/unbound ship flows
- transfer flows
- pages that must survive backend removal of implicit `character -> ships[]` assumptions

Reason:

- These are the places where the new ownership model adds actual capability rather than duplicate plumbing.

### Phase 5: Add compatibility fallback only where real breakage appears

If the backend starts returning fewer ships for character-scoped calls because ships are disassociated from characters, add targeted fallback behavior instead of global dual-fetching.

Recommended fallback shape:

- Try `ship-list` first where the page is character-scoped.
- If the response succeeds but returns no usable active ship, optionally try `ship-list-by-owner` with the agreed owner descriptor.
- Gate that fallback behind a small helper so it is testable and reversible.

This avoids paying complexity cost before the backend behavior actually requires it.

## Tests To Preserve and Reuse

The existing suite is already strong enough to act as a regression net for the rollout. We should use it as the baseline proof that ownership-contract work did not break current gameplay.

### Focused Karma/Jasmine specs to run during implementation

- [src/app/services/ship-exterior-socket.service.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/services/ship-exterior-socket.service.spec.ts)
  - Protects request/response wrapper behavior.
- [src/app/services/session.service.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/services/session.service.spec.ts)
  - Protects active ship session semantics.
- [src/app/page/game/game-join.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/game-join.spec.ts)
  - Protects character-scoped ship loading and normalization.
- [src/app/page/game/ship-hangar.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/ship-hangar.spec.ts)
  - Protects ship listing and active-ship selection from the hangar.
- [src/app/page/game/market-hub.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/market-hub.spec.ts)
  - Protects active ship hydration when ship location data is incomplete.
- [src/app/page/game/repair-retrofit.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/repair-retrofit.spec.ts)
  - Protects ship-list refresh behavior on repair flows.
- [src/app/page/game/ship-view-inventory.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/game/ship-view-inventory.spec.ts)
  - Protects active ship refresh and inventory rendering.
- [src/app/page/character/character-list.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/character/character-list.spec.ts)
  - Protects join behavior and character normalization assumptions.
- [src/app/page/character/character-setup.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/page/character/character-setup.spec.ts)
  - Protects starter ship bootstrap behavior after character creation.
- [src/app/component/character-ship-badge.integration.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/component/character-ship-badge.integration.spec.ts)
  - Protects shared active-ship display semantics.
- [src/app/scene/ship-exterior-view.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/scene/ship-exterior-view.spec.ts)
  - Protects mission/exterior flows that depend on active ship hydration and ship inventory.

### Existing Playwright specs worth keeping green

- [e2e/tests/character-add.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/e2e/tests/character-add.spec.ts)
  - Covers starter-ship chain after character creation.
- [e2e/tests/character-ship-badge.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/e2e/tests/character-ship-badge.spec.ts)
  - Covers active ship hydration and hangar selection UX.
- [e2e/tests/first-target-fabrication-menu-cue.spec.ts](/c:/Development/Projects/Github/laughing-octo-journey/e2e/tests/first-target-fabrication-menu-cue.spec.ts)
  - Covers in-progress mission behavior that depends on ship inventory from `ship-list`.

### Recommended command order during implementation

Use focused specs first, then broaden.

1. `npm run test:spec -- "**/game-join.spec.ts"`
2. `npm run test:spec -- "**/ship-hangar.spec.ts"`
3. `npm run test:spec -- "**/market-hub.spec.ts"`
4. `npm run test:spec -- "**/character-list.spec.ts"`
5. `npm run test:spec -- "**/character-setup.spec.ts"`
6. `npm run test:spec -- "**/ship-view-inventory.spec.ts"`
7. `npm run test:spec -- "**/ship-exterior-view.spec.ts"`
8. `npm run test:ci`
9. `npm run build`
10. `npm run e2e:spec -- e2e/tests/character-ship-badge.spec.ts`

## Documentation Updates Needed During Implementation

### Must update

- [docs/openapi-integration.md](/c:/Development/Projects/Github/laughing-octo-journey/docs/openapi-integration.md)
  - Add a section for ship ownership and owner-scoped ship queries.
  - Prefer the live local contract URL for day-to-day development notes instead of only the GitHub copy.
- [docs/server-message-contracts.md](/c:/Development/Projects/Github/laughing-octo-journey/docs/server-message-contracts.md)
  - Reconcile character-scoped ship assumptions with the new ownership-aware contract.
  - Add or update `ship-list-by-owner`, `ship-transfer`, and ownership notes on `ship-upsert`.

### Update if UI wording changes

- [src/app/i18n/locales/en.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/i18n/locales/en.ts)
- [src/app/i18n/locales/it.ts](/c:/Development/Projects/Github/laughing-octo-journey/src/app/i18n/locales/it.ts)

## Open Questions To Resolve Before Phase 4

- Should `ship-hangar` show only ships attached to the selected character, or all ships owned by the player-character owner descriptor?
- When a ship is disassociated from a character, what owner shape should the frontend expect for normal player gameplay:
  - `player-character`
  - `player`
  - transitional `unknown` until claimed
- Does `game-join` remain strictly character-scoped even when ship ownership is no longer character-bound?
- Should active ship persistence remain a plain `ShipSummary` in session state, or should it also remember the normalized owner descriptor?

## Recommended First Implementation Slice

The smallest defensible first change set is:

1. Add new ownership-aware models.
2. Extend `ShipService` with additive wrappers.
3. Extend `ShipSummary` normalization for `ownership`.
4. Add unit tests for the new models and service methods.
5. Run the existing focused regression specs listed above.
6. Update the docs after the code and tests are green.

That slice gives us immediate contract coverage without forcing a risky behavioral migration before we confirm how the backend will expose disassociated ships in practice.