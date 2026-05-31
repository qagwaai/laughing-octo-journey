# Debug Removal Gate Plan

## Purpose
Remove temporary diagnostics and dev-facing UI safely after final manual test pass.

## Gate Condition
Do not remove items in this plan until final manual phase is signed off:
- [Final Manual Test Phase](docs/final-manual-test-phase.md)

## Removal Strategy
- Phase A: Remove user-visible debug overlays and labels first.
- Phase B: Remove dev-only action buttons and helpers in runtime UI.
- Phase C: Keep low-level correlation warning events unless they are proven noisy and unnecessary.

## Candidate Inventory

### A. User-visible debug overlays in ship exterior / cold boot
Primary locations:
- [src/app/page/opening/cold-boot-scan.html](src/app/page/opening/cold-boot-scan.html)
- [src/app/page/opening/cold-boot-scan.css](src/app/page/opening/cold-boot-scan.css)
- [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)

Current examples:
- Asteroid debug panel and collapse toggle.
- Launch debug lines (`LAUNCH DBG`, `LAUNCH ID DBG`).
- Socket debug line (`SOCKET DBG`).
- Debug-style flight diagnostics text blocks.

Action after gate pass:
- Remove debug sections from template and associated styles.
- Keep mission-critical status text only (non-debug operational HUD).

### B. Dev-only controls in gameplay pages
Primary locations:
- [src/app/page/game/print-queue.ts](src/app/page/game/print-queue.ts)
- [src/app/page/game/print-queue.html](src/app/page/game/print-queue.html)
- [src/app/page/game/ship-view-inventory.ts](src/app/page/game/ship-view-inventory.ts)

Current examples:
- `isDevBuild` branches and dev-only queue completion controls.
- `showDevTools` and development helper paths.
- Direct console diagnostic logging in runtime page logic.

Action after gate pass:
- Remove dev-only UI entry points.
- Replace ad-hoc console logging with existing logger abstraction only where still needed.

### C. Test utility hooks exposed on window
Primary locations:
- [src/app/scene/ship-exterior/ship-exterior-test-utils.ts](src/app/scene/ship-exterior/ship-exterior-test-utils.ts)
- [src/app/scene/ship-exterior-view.ts](src/app/scene/ship-exterior-view.ts)

Current examples:
- `window.__shipExteriorTestUtils` registration in non-production mode.

Action after gate pass:
- Keep as-is if still required by e2e strategy.
- If removed, replace with equivalent deterministic test seams and update affected specs first.

### D. Correlation warning events
Primary locations:
- [src/app/services/socket.service.ts](src/app/services/socket.service.ts)
- [src/app/services/character.service.ts](src/app/services/character.service.ts)
- [src/app/services/ship.service.ts](src/app/services/ship.service.ts)
- [src/app/services/solar-system.service.ts](src/app/services/solar-system.service.ts)
- [src/app/services/ship-exterior-socket.service.ts](src/app/services/ship-exterior-socket.service.ts)

Current examples:
- `socket-correlation-warning` custom event dispatch.

Action after gate pass:
- Default is retain. These are high-value diagnostics for contract drift.
- Consider only reducing verbosity, not full removal.

## Execution Checklist
Run in order for each removal batch:
1. Remove smallest coherent set of debug code.
2. Run targeted tests for touched area.
3. Run `npm run test:ci`.
4. Run `npm run e2e`.
5. If any regression appears, revert that batch only and split into smaller changes.

## Sign-off Template
- Manual phase passed by:
- Date:
- Approved for Phase A cleanup: yes/no
- Approved for Phase B cleanup: yes/no
- Notes:
