# TODO

## Test Quality Remediation (from TEST_QUALITY_REVIEW.md, 2026-05-07)

**Context:** Full review in [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md). 1199 unit + 68 e2e tests pass, but ~55 % of spec code (10 386 LOC across 30 files) consists of "shadow specs" that re-implement component logic instead of importing the SUT, inflating reported coverage and providing no real regression protection.

### Phase A — Stop the bleeding (Priority: HIGH)

- [X] Add CI guard: every `src/app/**/*.spec.ts` (except `*.integration.spec.ts`) must `import` the file at the matching path; fail the build otherwise.
- [X] Extract `src/testing/` shared helpers typed against the real service interfaces:
  - [X] `createSignal<T>()` (currently duplicated in 21 spec files)
  - [X] `MockSocketService` implementing the public surface of `src/app/services/socket.service.ts` (currently duplicated in 13 spec files)
  - [X] `MockSessionService`, `MockMissionService`, `MockPrinterStateService` against their real interfaces
- [X] Delete duplicated helper blocks from existing specs once the shared module is in place.
- [X] Update [TODO.md](TODO.md) and [docs/operational-testing-checklist.md](docs/operational-testing-checklist.md) test counts to current values (1199 unit / 68 e2e).
- [X] Remove scratch file `.cov-extract.cjs` and confirm `coverage/` is git-ignored.

### Phase B — Convert shadow specs to real component tests (Priority: HIGH)

Goal: each spec drives the actual component via `TestBed`. Use [src/app/component/cube.spec.ts](src/app/component/cube.spec.ts) and [src/app/component/character-ship-badge.spec.ts](src/app/component/character-ship-badge.spec.ts) as the template.

Order by LOC / traffic:

- [X] [src/app/page/game/market-hub.spec.ts](src/app/page/game/market-hub.spec.ts) (972 LOC, 18 tests) → import `MarketHubComponent`, drive via `TestBed`
- [X] [src/app/page/character/character-list.spec.ts](src/app/page/character/character-list.spec.ts) (763 LOC, 25 tests)
- [ ] [src/app/page/game/ship-hangar.spec.ts](src/app/page/game/ship-hangar.spec.ts) (582 LOC, 15 tests)
- [ ] [src/app/page/game/mission-board.spec.ts](src/app/page/game/mission-board.spec.ts) (20 tests)
- [ ] [src/app/page/game/repair-retrofit.spec.ts](src/app/page/game/repair-retrofit.spec.ts) and the four `repair-retrofit-*` detail/items/ship-detail/item-detail siblings
- [ ] [src/app/page/game/fabrication-lab.spec.ts](src/app/page/game/fabrication-lab.spec.ts)
- [ ] [src/app/page/game/print-queue.spec.ts](src/app/page/game/print-queue.spec.ts)
- [ ] [src/app/page/game/character-profile.spec.ts](src/app/page/game/character-profile.spec.ts)
- [ ] [src/app/page/game/game-join.spec.ts](src/app/page/game/game-join.spec.ts), [src/app/page/game/game-main.spec.ts](src/app/page/game/game-main.spec.ts), [src/app/page/game/logout.spec.ts](src/app/page/game/logout.spec.ts)
- [ ] [src/app/page/game/item-view-specs.spec.ts](src/app/page/game/item-view-specs.spec.ts), [src/app/page/game/ship-view-inventory.spec.ts](src/app/page/game/ship-view-inventory.spec.ts), [src/app/page/game/ship-view-specs.spec.ts](src/app/page/game/ship-view-specs.spec.ts), [src/app/page/game/stellar-initiation.spec.ts](src/app/page/game/stellar-initiation.spec.ts)
- [ ] [src/app/page/character/character-setup.spec.ts](src/app/page/character/character-setup.spec.ts)
- [ ] [src/app/page/public/login.spec.ts](src/app/page/public/login.spec.ts), [src/app/page/public/registration.spec.ts](src/app/page/public/registration.spec.ts), [src/app/page/public/intro.spec.ts](src/app/page/public/intro.spec.ts)
- [ ] [src/app/page/opening/cold-boot.spec.ts](src/app/page/opening/cold-boot.spec.ts)
- [ ] [src/app/scene/ship-exterior-view.spec.ts](src/app/scene/ship-exterior-view.spec.ts), [src/app/scene/ship-view-specs.spec.ts](src/app/scene/ship-view-specs.spec.ts)
- [ ] [src/app/scene/hud/cold-boot-hud-scene.spec.ts](src/app/scene/hud/cold-boot-hud-scene.spec.ts), [src/app/scene/hud/hud-overlay.spec.ts](src/app/scene/hud/hud-overlay.spec.ts)
- [ ] [src/app/component/button.spec.ts](src/app/component/button.spec.ts), [src/app/component/current.spec.ts](src/app/component/current.spec.ts)
- [ ] [src/app/services/mission-flow.integration.spec.ts](src/app/services/mission-flow.integration.spec.ts) — convert to a real integration test wired to the real `MissionService` + fake `SocketService`

### Phase C — Re-baseline coverage (Priority: MEDIUM)

- [ ] Re-run `npm run test:ci` after Phase B; record new (lower) baseline numbers.
- [ ] Bring branch coverage above the 75 % policy floor in:
  - [ ] [src/app/component](src/app/component) (currently 51 %)
  - [ ] [src/app/i18n/locale.ts](src/app/i18n/locale.ts) (currently 38 %)
  - [ ] [src/app/services/mission.service.ts](src/app/services/mission.service.ts) error/timeout paths
- [ ] Add a real "service integration" tier (`*.integration.spec.ts`) targeting the policy's 20 % integration band — start with mission flow + socket reconnect.
- [ ] Add `requestId` correlation tests once the contract change lands (cross-references the existing TODO item under Technical Debt).

### Phase D — Operational compliance (Priority: LOW)

- [ ] Record the first real cycle in [docs/operational-testing-checklist.md](docs/operational-testing-checklist.md): flake rate, CI runtime, escaped-bug mapping, coverage snapshot.
- [ ] Add a CODEOWNERS / PR template note pointing at [docs/testing-policy.md](docs/testing-policy.md) PR checklist.

---

## UX / Navigation

- [X] Character creation automatically goes back to character list
- [X] Fix view external (ship exterior scene) not loading correctly after first-target mission completes
- [X] Migrate 3D print queue from left pane to right pane
- [ ] Start new main mission on Mission Board

## Features

- [ ] Market Hub initial implementation — sell/buy items, credit balance display
- [ ] Character credits backend integration — source balance from session/join response; keep in sync via a `credits-update` socket event (see `character-economy.ts`)
- [ ] Mission reward credits — wire credit payout to client economy model on mission completion
- [ ] Italian locale (`it.ts`) — add missing keys for mission board, market hub, and all new mission locale content added in M-01–M-05 / SQ-01–SQ-04
- [X] Add to the logout page a link to go to the character list page.
- [ ] Add non-asteroid based debris to initial first-target mission
- [ ] Add scanning progress to external-ship-view

## Technical Debt / Cleanup

- [X] Replace client-side mission auto-assignment (`MissionAssignmentService`) with server-driven unlock — backend now supports auto-creating `available` missions on `completed`/`turned-in` transition; client-side optimistic path can be removed once backend is confirmed stable
- [ ] Normalize `playerName` comparison in `MissionService` response filters to be case-insensitive — backend returns canonical casing which may differ from what the client sent
- [ ] Add `requestId` correlation to mission socket requests/responses to eliminate cross-response matching ambiguity and reduce timeout flakes
- [X] Update `docs/server-message-contracts.md` to match the new backend `MESSAGE_CONTRACT.md` (mission catalog IDs, prerequisite graph, `statusDetail`, `requestId`, alias events, asteroid seeding edge case)
- [ ] Normalize the list of in game parts with those that are part of first-target, and need fixing

---

# Space-Game Distance/Drive/Routing Refactor (Phases 8–14)

## Phase 8: Mixed-System Market Fixtures & Full Route Coverage
**Priority:** HIGH  
**Depends on:** Phase 7 (route badges in place)  
**Effort:** 1–2 days (e2e + fixtures)

### Tasks
- [X] Create e2e fixture with cross-system market list (e.g., Sol + Alpha Centauri markets)
- [X] Add market-hub spec asserting gate-route badge with hop count ("1 gate hop", "2 gate hops")
- [X] Add market-hub spec asserting no-route badge for unreachable systems
- [X] Verify flavor text adapts for gate routes: "Alpha Station, 1 gate hop away" / "Barnard's Depot, 2 gate hops away"
- [X] Update e2e backend mock to return markets with route metadata (kind + hops)

### Files to Modify
- `e2e/tests/market-hub-cross-system.spec.ts` (**new file** — cross-system fixture, gate-route + no-route tests)
- `e2e/tests/market-hub-docking.spec.ts` (added route badge assertions + docked cross-system scenario)
- `e2e/fixtures/socket-mock.ts` (no changes needed — mock already supports route metadata passthrough)

### Acceptance Criteria
- All in-system, gate-route, and no-route markets render with correct badges.
- Travel estimates include gate transit time when applicable.
- No-route markets show a "Requires new drive or gate access" message distinct from drive-upgrade message.

---

## Phase 9: Server-Route Precedence & Runtime Route Resolution
**Priority:** HIGH  
**Depends on:** Phase 8 (fixtures in place)  
**Effort:** 1 day (logic + minor UI tweaks)

### Tasks
- [X] Implement marketRouteStatus() to prefer markets[].route from server when present
- [X] Fall back to client-side jump-gate inference only if server route is missing
- [X] Add unit test for explicit route override (server route wins over heuristic)
- [X] Update marketRouteLabel() to use server-provided hops count if available
- [X] Ensure no-route markets from server are still properly gated (transact button disabled)

### Files to Modify
- `src/app/page/game/market-hub.ts` (updated route classification logic — server route wins)
- `src/app/page/game/market-hub.spec.ts` (added 5 server-route precedence tests; 15 total)
- `e2e/tests/market-hub-cross-system.spec.ts` (added no-route override test — server beats BFS)

### Acceptance Criteria
- Server-provided route metadata takes precedence over client heuristics.
- Client falls back gracefully if route field is missing from market response.
- No visual difference between inferred and explicit routes in final UI.

---

## Phase 10: Drive Unlock Progression UI
**Priority:** MEDIUM  
**Depends on:** Phases 1–4 (drive model in place)  
**Effort:** 2–3 days (UI + mission wiring)

### Tasks
- [ ] Add drive-tier display in Market Hub showing:
  - Active drive (green checkmark)
  - Locked drives (locked icon + unlock condition, e.g., "Complete M-02 Mission" or "Level 10+")
  - Range/speed specs for each tier
- [ ] Create dedicated "Drive Specs" section in Ship Hangar or a new Upgrades/Progression page
- [ ] Wire drive unlock conditions to mission/level system (e.g., first Rapid Transit unlock on M-02 completion)
- [ ] Add tooltip on locked market: "Rapid Transit Thruster required — unlock via mission M-02"
- [ ] Implement visual progression indicator (e.g., skill tree or unlock timeline)

### Files to Create/Modify
- `src/app/page/game/market-hub.html` (add drive-tier widget)
- `src/app/page/game/market-hub.ts` (add drive-tier logic, unlock-condition resolver)
- `src/app/page/game/ship-hangar.ts` (optional: add drive specs card)
- `src/app/model/drive-progression.ts` (new: define unlock tree, mission dependencies)
- `src/app/i18n/locales/en.ts` (add unlock condition labels)

### Acceptance Criteria
- All three drive tiers visible in UI with current/locked status.
- Hover on locked drive shows unlock requirement.
- Locked markets show required drive with unlock hint in out-of-range warning.
- Drive unlock tied to mission completion (verify via test mock).

---

## Phase 11: Automated Trade-Route Interface
**Priority:** MEDIUM  
**Depends on:** Phases 1–2, 8–9 (route resolution, market list)  
**Effort:** 3–4 days (UI + route calculation)

### Tasks
- [ ] Add route-planner component (pick source market → pick dest market → show route + ETA)
- [ ] Calculate full route distance or hop count (in-system: AU distance; cross-system: gate hops)
- [ ] Display total travel time in hours (sum of in-system cruise time + per-gate transit time)
- [ ] Show required drive for route completion (e.g., "Requires Quantum Fold Engine for final leg")
- [ ] Add "Plan Trade Route" button in Market Hub or new dedicated Route Planner page
- [ ] Optional: Display profit/loss per route (buy price × quantity − sell price × quantity − fuel cost)

### Files to Create/Modify
- `src/app/page/game/route-planner.ts` (new component)
- `src/app/page/game/route-planner.html` (new template)
- `src/app/model/route-calculator.ts` (new utility: distance, time, drive requirements)
- `src/app/page/game/market-hub.ts` (add route-planner link/launch)
- `src/app/i18n/locales/en.ts` (route-planner labels)

### Acceptance Criteria
- User can select source & destination markets.
- Route and ETA calculated and displayed.
- Required drive prominently shown.
- Profit/loss optional but nice-to-have.

---

## Phase 12: Time-Based Travel Simulation (Passive Travel)
**Priority:** LOW (Post-MVP feature)  
**Depends on:** Phases 1–2, 11 (drive speeds, route planning)  
**Effort:** 5+ days (state machine, real-time simulation, socket events)

### Tasks
- [ ] Define travel state on ship (idle, in-transit, arrived)
- [ ] Calculate ETA on departure based on route distance and drive speed
- [ ] Implement passive travel (no UI interaction; game-time progresses automatically)
- [ ] Emit server event on arrival (ship-arrival-event with ETA check, cargo update if applicable)
- [ ] Display travel status in Ship Hangar (e.g., "In transit to Proxima Station — ETA 3 hours, 45 minutes")
- [ ] Optional: Allow player to abort travel (return to origin or nearest waypoint with penalty)
- [ ] Hook into game-time system (ensure 1 real minute ≠ 1 game hour mapping is consistent)

### Files to Create/Modify
- `src/app/model/ship-travel.ts` (new: travel state, ETA calculation)
- `src/app/services/travel.service.ts` (new: passive travel simulation)
- `src/app/page/game/ship-hangar.ts` (display travel status)
- `src/app/page/game/ship-hangar.html` (travel status badge)
- Backend: Add travel-state to ship model, ship-arrival-event socket message
- `src/app/i18n/locales/en.ts` (travel status labels)

### Acceptance Criteria
- Ship enters travel state on market departure.
- ETA countdown visible in Ship Hangar.
- Server receives arrival event when ETA reached.
- Passive travel works across page navigation (state persists in session).
- Game-time consistently mapped throughout app.

---

## Phase 13 (Optional): Spatial Anomalies & Lore-Based Flavor
**Priority:** LOW (Nice-to-have, post-MVP)  
**Depends on:** Phases 6–9 (routing framework)  
**Effort:** 2–3 days (UI + descriptions)

### Tasks
- [ ] Define spatial anomalies (nebulae, wormholes, time-dilation zones) that affect perceived distance/routing
- [ ] Implement anomaly effects: distance appears closer/farther, routing requires detour, etc.
- [ ] Add lore flavor text on affected markets: "Nebula interference causes sensor distortion — actual distance may vary"
- [ ] Optional: Anomalies unlock after certain missions or player discovery
- [ ] Render anomaly zones on a sector map (if map view is added)

### Files to Create/Modify
- `src/app/model/spatial-anomaly.ts` (new: anomaly definitions, distance modifiers)
- `src/app/page/game/market-hub.ts` (apply anomaly effects to distance/routing)
- `src/app/page/game/market-hub.html` (show anomaly warning badges)
- `src/app/i18n/locales/en.ts` (anomaly descriptions)

### Acceptance Criteria
- Anomalies appear on relevant markets.
- Distance/routing affected visibly.
- Lore flavor text is immersive and non-intrusive.

---

## Phase 14 (Optional): Jump-Gate Discovery & Unlock Mechanics
**Priority:** LOW (Post-MVP)  
**Depends on:** Phases 6–9 (jump-gate system)  
**Effort:** 3–4 days (discovery state, socket events, progression)

### Tasks
- [ ] Add gate-unlock state to character progression (e.g., "Proxima Gate: Locked", "Vega Gate: Discovered")
- [ ] Implement gate discovery via exploration or mission reward
- [ ] Show "Uncharted Territory" badge on unreachable systems until gate is discovered
- [ ] Add gate-discovery socket event (server sends when player discovers new gate)
- [ ] Display discoverable gates in Route Planner or new Discoveries page
- [ ] Optional: Gate traversal cost varies by gate stability (adds flavor)

### Files to Create/Modify
- `src/app/model/gate-discovery.ts` (new: discovery state, unlock conditions)
- `src/app/page/game/market-hub.ts` (mark undiscovered gates)
- `src/app/page/game/discoveries.ts` (new: dedicated discoveries/unlocks page, optional)
- Backend: Track gate discovery state per character, emit gate-discovery event
- `src/app/i18n/locales/en.ts` (discovery labels, "Uncharted Territory", etc.)

### Acceptance Criteria
- Undiscovered gates shown as "Uncharted Territory" in market list.
- Gate discovery triggers observable UI changes (badge removal, system becomes available).
- Progression tracked in character state and persisted across sessions.

---

## Backend Integration Checklist

These items must be completed by the backend team to fully support the client implementation:

### Ship Model
- [ ] Add optional `driveProfile` field (structure: id, name, rangeAu, cruiseSpeedAuPerHour, fuelCostPerAu)
- [ ] Validate driveProfile payload if provided; fallback to server-side heuristic if missing
- [ ] Ensure ship-list-response includes driveProfile in ship objects

### Market List & Discovery
- [ ] Update market-list-by-location-response to include optional `route` field per market
  - Structure: `{ kind: "in-system" | "gate-route" | "no-route", hops?: number }`
- [ ] Implement server-side jump-gate network lookup (given two systems, return hop path or null)
- [ ] Ensure effective radius request parameter (distanceAu) is respected in market filtering

### Jump-Gate Network
- [ ] Define gate definitions (gateId, sourceSystemId, destSystemId, traversalCostAu, traversalTimeHours)
- [ ] Implement gate reachability lookup (return all gates accessible from a given system)
- [ ] Calculate hop distance between any two systems (for route planning)

### Socket Messages
- [ ] Ensure existing ship-list-response, market-list-by-location-response contracts are extended (not breaking)
- [ ] Plan for future ship-arrival-event (when Phase 12 travel simulation is added)
- [ ] Plan for future gate-discovery-event (when Phase 14 gate discovery is added)

---

## Testing & Validation Checklist

- [X] All unit tests passing (1202 tests as of Phase B market-hub conversion: 3 new DOM smoke tests added)
- [X] All e2e tests passing (68 tests as of 2026-05-07)
- [X] Playwright runs report no regressions in existing tests after Phase 8–9 additions
- [ ] Manual testing confirms:
  - AU distances render correctly with km tooltips
  - Drive range clamping in effect
  - Route badges appear for in-system, gate-route, and no-route markets
  - Travel-time flavor text is human-readable
  - Out-of-range warnings show required drive

---

## Architecture Notes

### Distance Scaling
- **1 AU ≈ 149,597,870.7 km** (IAU precise constant)
- **UI Precision:** 3 decimals for AU distances (e.g., 0.032 AU)
- **Tooltip:** Humanized km (2.2M km, 845K km, 123 km)
- **Backend:** Store distances in km internally; convert to AU for market responses

### Drive Progression
- **Standard Cruise:** 0.5 AU range, 0.3 AU/hr speed, 1 fuel/AU cost (starter default)
- **Rapid Transit:** 15 AU range, 1.8 AU/hr speed, 4 fuel/AU cost (unlock via M-02 or Level 3+)
- **Quantum Fold:** 100 AU range, 12 AU/hr speed, 20 fuel/AU cost (unlock via Level 6+ or mission)
- **Server Override:** If ship.driveProfile is provided, use it instead of tier-based heuristic

### Routing Strategy
- **In-System:** Use AU distance + active drive range to determine reachability
- **Cross-System:** Use jump-gate network to find hop path; classify as "gate-route" or "no-route"
- **Effective Radius:** Client sends `min(selectedRadiusAu, activeDriveRangeAu)` to backend; server respects this clamp

### Localization
- All UI strings for drives, routes, and travel times have English translations in `src/app/i18n/locales/en.ts`
- Italian translations fall back to English for new strings (partial scaffold in `it.ts`)
