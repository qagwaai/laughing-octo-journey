# Operational Testing Checklist

## Purpose
Track policy compliance items that are operational over time, not just code-state checks.

## Cadence
- Update weekly (or once per sprint).
- Keep the last 2-4 entries in this file.

## Checklist Template

### Cycle
- Date range:
- Owner:
- Scope (feature areas):

### 1) Flake Rate (< 2% for 2 consecutive weeks)
- CI jobs evaluated:
- Total automated test runs:
- Flaky failures observed (rerun-pass or non-deterministic):
- Calculated flake rate:
- Result: pass / fail
- Notes:

### 2) Escaped Bug -> Regression Test Mapping
- Escaped bugs found this cycle:
- Regression tests added:
- Mapping:
  - Bug ID / summary -> test file -> test name
- Any open gaps:
- Result: pass / fail

### 3) CI Runtime Acceptable for Team Cadence
- Main test job average runtime:
- Playwright job average runtime:
- Team threshold:
- Result: pass / fail
- Notes:

### 4) Coverage Floor Snapshot
- Statements:
- Branches:
- Functions:
- Lines:
- Result: pass / fail

### 5) Decision
- Policy-compliant this cycle: yes / no
- If no, top 1-3 actions before next cycle:

## Fast Incident Runbook - Repair Consumes Item But Item Reappears

Use this when a consumed item (for example Hull Patch Kit) reappears after ship repair.

### 1) 60-second classification
- Confirm which UI action path was used (repair list page vs detail page).
- Capture one correlationId from the client repair action.
- Check backend ship-upsert diagnostics for the same correlationId.

### 2) Branch decision table
- Client hasInventory=true and backend hasInventoryPatch=true:
  - Treat as backend persistence/projection issue.
  - Validate pre-persist and persisted inventory ids differ as expected.
- Client hasInventory=true and backend hasInventoryPatch=false:
  - Treat as transport/request-shape issue.
  - Verify message handler reads the same request field names and payload nesting.
- Client hasInventory=false:
  - Treat as client code path issue.
  - Find the specific upsertShip caller used by this UI action and patch that path.

### 3) Required diagnostics (minimum)
- Client repair log: correlationId, hasInventory, inventoryLength, consumedItemId.
- Socket emit log: correlationId, hasInventory, inventoryLength.
- Backend incoming ship-upsert log: correlationId, hasInventoryPatch, incoming inventory ids.
- Backend pre-persist log: correlationId, previous inventory ids, pre-persist inventory ids.
- Backend persisted log: correlationId, persisted inventory ids.
- Ship-list projection log: correlationId, inventoryRefIds, projectedItemIds, backfilledItemIds.

### 4) Validation criteria before closing
- Persisted ship inventory refs exclude the consumed item id.
- Projected ship-list excludes the consumed item id.
- Item record is destroyed (or otherwise marked not contained) after repair.
- Refresh and relogin both keep the item absent.

### 5) Defense-in-depth policy
- Client remains the primary source of explicit inventory patch on repair.
- Backend safeguard may auto-consume one kit only when:
  - damage transitions to intact
  - inventory patch is omitted
- Safeguard must emit explicit diagnostic logs when triggered.
- Treat safeguard activations as warning events to investigate client path drift.

### 6) Regression guardrails to add
- Unit/integration: repair action sends ship-upsert with inventory patch containing kit removed.
- Integration: backend ship-upsert persists patched inventory refs when inventory is supplied.
- Integration: safeguard path consumes exactly one kit when patch is omitted.
- E2E: fully repair ship, refresh, relogin, verify kit remains absent.

### 7) Known high-signal root causes from this incident
- Different UI repair entry points used different upsertShip payload shapes.
- Ship-upsert patch semantics preserve inventory when inventory is omitted.
- Missing correlation ids slowed multi-hop diagnosis across client and backend logs.
- Local consumed-item shadow filtering can hide symptoms but not fix persistence.

---

## Cycle 1 — 2026-05-07

### Cycle
- Date range: 2026-05-07
- Owner: AI-assisted review (GitHub Copilot)
- Scope: Full codebase — test quality review + Phase A remediation

### 1) Flake Rate (< 2% for 2 consecutive weeks)
- CI jobs evaluated: 1 (npm run test:ci)
- Total automated test runs: 1199 unit + 68 e2e
- Flaky failures observed: 0
- Calculated flake rate: N/A (single run; baseline only)
- Result: pass (no failures)
- Notes: First cycle. Flake tracking begins from this baseline.

### 2) Escaped Bug -> Regression Test Mapping
- Escaped bugs found this cycle: 0
- Regression tests added: 0 new tests; 22 existing specs migrated to shared helpers
- Mapping: N/A
- Any open gaps: 31 shadow specs provide no SUT regression protection (tracked in Phase B)
- Result: N/A (no escaped bugs this cycle)

### 3) CI Runtime Acceptable for Team Cadence
- Main test job average runtime: ~45s (Karma, headless Chrome)
- Playwright job average runtime: ~29s (68 tests)
- Team threshold: not yet formally set
- Result: pass (both well under 2 min)
- Notes: pretest shadow-spec guard adds <1s overhead

### 4) Coverage Floor Snapshot (post Phase A)
- Statements: 85.92% (floor: 80%) ✓
- Branches: 74.04% (floor: 75%) ✗ — 0.96 pp below floor
- Functions: 83.70% (floor: 80%) ✓
- Lines: 87.10% (floor: 85%) ✓
- Result: **fail** — branch coverage below 75% floor
- Notes: Coverage denominators cover only instrumented files; real effective coverage is lower because 31 shadow specs inflate numerators without exercising the actual SUT. Expected to worsen further once Phase B converts shadow specs to real TestBed tests.

### 5) Decision
- Policy-compliant this cycle: **no**
- Top actions before next cycle:
  1. Convert highest-traffic shadow specs to real TestBed tests (Phase B — start with `market-hub.spec.ts`)
  2. Re-baseline branch coverage after Phase B; target ≥ 75%
  3. Record flake rate over 2+ CI runs to establish a trend


- CI jobs evaluated: test:ci, playwright-chromium
- Total automated test runs: 120
- Flaky failures observed (rerun-pass or non-deterministic): 1
- Calculated flake rate: 0.83%
- Result: pass
- Notes: one transient e2e timeout, not reproduced after rerun

### 2) Escaped Bug -> Regression Test Mapping
- Escaped bugs found this cycle: 1
- Regression tests added: 1
- Mapping:
  - BUG-142 mission progressed out-of-order -> src/app/services/mission-flow.integration.spec.ts -> should not progress mission when launch happens before scan
  - BUG-RESUME-FT-COMPLETED joined game replayed cold boot after tutorial completion -> e2e/tests/login-after-first-target-completed.spec.ts -> routes to game-main + mission-board and never enters opening-cold-boot
- Any open gaps: none
- Result: pass

### 3) CI Runtime Acceptable for Team Cadence
- Main test job average runtime: 6m 20s
- Playwright job average runtime: 2m 10s
- Team threshold: <= 12m total
- Result: pass
- Notes: runtime stable across five recent runs

### 4) Coverage Floor Snapshot
- Statements: 86.97%
- Branches: 75.58%
- Functions: 83.15%
- Lines: 88.39%
- Result: pass

### 5) Decision
- Policy-compliant this cycle: yes
- If no, top 1-3 actions before next cycle:

---

## Cycle 3 - 2026-05-19

### Cycle
- Date range: 2026-05-19
- Owner: AI-assisted review (GitHub Copilot)
- Scope: First-target mission navigation guidance UX

### 1) Flake Rate (< 2% for 2 consecutive weeks)
- CI jobs evaluated: focused local regression runs only
- Total automated test runs: 8 focused tests (unit + e2e)
- Flaky failures observed (rerun-pass or non-deterministic): 0
- Calculated flake rate: 0%
- Result: pass
- Notes: focused validation only; not a full-cycle CI sample.

### 2) Escaped Bug -> Regression Test Mapping
- Escaped bugs found this cycle: 1
- Regression tests added: 1
- Mapping:
  - BUG-FT-NAV-OVERLAY-DISMISS-STEP mouse-hover-dependent menu coachmark created clunky mission guidance; guidance now extracted to persistent left-pane overlay with dismiss-per-step behavior -> e2e/tests/first-target-fabrication-menu-cue.spec.ts -> keeps overlay dismissed for the same step across refresh, then shows again when step changes
- Any open gaps: none for the two guided first-target nav steps (fabrication-lab, repair-retrofit)
- Result: pass

### 3) CI Runtime Acceptable for Team Cadence
- Main test job average runtime: not sampled in this focused cycle
- Playwright job average runtime: not sampled in this focused cycle
- Team threshold: <= 12m total
- Result: N/A
- Notes: cycle used focused regression execution only.

### 4) Coverage Floor Snapshot
- Statements: not sampled in this focused cycle
- Branches: not sampled in this focused cycle
- Functions: not sampled in this focused cycle
- Lines: not sampled in this focused cycle
- Result: N/A

### 5) Decision
- Policy-compliant this cycle: yes (feature-scope regression criteria met)
- If no, top 1-3 actions before next cycle:
