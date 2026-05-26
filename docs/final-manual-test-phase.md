# Final Manual Test Phase

## Goal
Run the last human validation pass before starting new feature development and before removing temporary/debug functionality.

## Entry Criteria
- Automated unit and integration suite is green: `npm run test:ci`.
- Full e2e suite is green: `npm run e2e`.
- No active merge conflicts in the working tree.

Current status at phase start:
- `test:ci`: pass.
- `e2e`: pass.

## Test Environment
- Browser: Chromium (same baseline as Playwright).
- App start: `npm start`.
- Locale coverage: English and Italian.
- Test data: default local mocked/dev environment used by current app workflow.

## Manual Test Charter
Use this as a strict pass/fail checklist.

### 1. Auth and Character Lifecycle
- Register/login flow works from cold start.
- Character list loads and reflects current player.
- Create character completes and returns to list.
- Edit character persists and returns to list.
- Join Game in Progress consistently routes to game main when expected.

### 2. First-Target Mission Flow
- Mission gate order is coherent through all steps.
- New debris step appears in flow and objective text updates correctly.
- Manufacture and repair steps unlock only after prior gate completion.
- Mission board stage count and completion text match observed mission state.

### 3. Ship Exterior and Hangar Continuity
- Ship exterior opens reliably from in-progress join.
- Hangar round-trip does not regress mission/scan progression.
- Active ship badge remains correct after navigation transitions.

### 4. Fabrication, Print Queue, and Repair
- Print queue shows recipe availability correctly based on inventory.
- Queue/cancel flow updates status text and inventory behavior correctly.
- Repair and retrofit flows behave correctly with and without usable ship spatial data.
- No dead-end state when active ship is unresolved.

### 5. Market Hub
- By-location list populates and ordering is sensible.
- Cross-system badges render (in-system, gate-route, no-route).
- Docking/radius behavior matches selected context.
- Grouped sections and out-of-range toggle behavior are correct.

### 6. Viewer
- Viewer menu is accessible post-join.
- Scene loads, remains interactive (hover/rotate/zoom/pan), and survives repeated interactions.
- Character ship overlays/legend and locale text render correctly.

### 7. Localization
- English and Italian labels remain coherent in changed mission/gameplay areas.
- No obvious untranslated placeholders in core paths above.

## Defect Logging Rules
- Log each failure with: route, action sequence, expected result, actual result, screenshot.
- Tag defects:
  - `blocker`: ship progression/data integrity/navigation dead-end.
  - `major`: wrong mission gating, wrong economy action state, broken viewer interaction.
  - `minor`: text mismatch, spacing, low-impact UI inconsistency.
- Stop release sign-off if any blocker or major remains open.

## Exit Criteria
Manual phase passes when:
- All checklist items above are pass, or
- Remaining failures are only minor and explicitly accepted.

When passed, proceed immediately to:
- [Debug Removal Gate Plan](docs/debug-removal-gate-plan.md)
