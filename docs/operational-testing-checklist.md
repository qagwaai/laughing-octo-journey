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

---

## Example Entry (Replace With Real Data)

### Cycle
- Date range: 2026-05-01 to 2026-05-14
- Owner: QA + Feature Team
- Scope (feature areas): mission flow, ship exterior

### 1) Flake Rate (< 2% for 2 consecutive weeks)
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
