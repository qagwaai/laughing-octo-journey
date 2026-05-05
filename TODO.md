# TODO

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
- [ ] Update `docs/server-message-contracts.md` to match the new backend `MESSAGE_CONTRACT.md` (mission catalog IDs, prerequisite graph, `statusDetail`, `requestId`, alias events, asteroid seeding edge case)
- [ ] Normalize the list of in game parts with those that are part of first-target, and need fixing
