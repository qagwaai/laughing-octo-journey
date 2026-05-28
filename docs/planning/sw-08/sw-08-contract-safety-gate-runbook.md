# SW-08 Contract Safety Gate Runbook (Frontend-Led)

Status: Completed (Maintenance Mode)
Date: 2026-05-24
Completed: 2026-05-25
Repo: laughing-octo-journey

## 1. When This Runbook Applies

Use this runbook when the SW-08 CI gate fails due to detected contract drift.

## 2. Fast Triage Checklist

1. Identify drift category from CI output.
2. Identify owner (frontend/backend/shared).
3. Reproduce locally with the same command.
4. Confirm whether issue is breaking or non-breaking.
5. Decide fix path or exception path.

## 3. Local Reproduction

Suggested flow:
1. Pull latest main.
2. Retrieve current backend contract artifact.
3. Run `npm run contract:check` for the canonical report-only comparison.
4. To reproduce stage 3 hard-fail behavior, run `npm run contract:check:stage3`.
4a. Stage 5 continuous-assurance path uses `npm run contract:check:stage5` (same hard-fail semantics + trend artifacts).
5. To prove detector behavior, run `npm run contract:check:stage3:fixture`.
6. To confirm an approved bypass, run `npm run contract:check:stage3:approved`.
7. To validate invalid exception rejection, run `npm run contract:check:stage3:expired` and `npm run contract:check:stage3:missing-approval`.
8. To validate non-breaking additions, run `npm run contract:check:compatibility`.
9. Confirm exact mismatch lines, owner tags, and remediation hints.

Report artifacts are written to `reports/sw-08-contract-safety-gate/` as `report.json` and `report.md`.

Weekly metrics artifacts are also written to `reports/sw-08-contract-safety-gate/` as:
- `weekly-metrics.json`
- `weekly-metrics.md`
- `rolling-30d-trends.json`
- `rolling-30d-trends.md`

Metrics fields:
- Drift count
- MTTR (hours)
- Bypass count
- Expired bypasses
- Drift by class / impacted surface / owner tag
- Repeat offender signals by surface + mismatch class
- Near-expiry bypass count

## 4. Fix Paths

Frontend-led fix:
- Update model/consumer mapping.
- Add fallback handling if needed.
- Add or update tests.

Backend-led fix:
- Restore compatibility or provide compatible alias.
- Update artifact and changelog.
- Notify frontend of migration impact.

Shared fix:
- Sequence producer/consumer changes with temporary compatibility window.

## 5. Exception Path

Use only for urgent merges.

Required:
- Reason and impact.
- Approval from frontend and backend leads.
- Ticket with expiry date.
- Rollback strategy.
- Follow-up owner assigned.

Approved exception manifest fields:
- `status: approved`
- `reason`
- `impact`
- `expiryDate`
- `rollbackPlan`
- `followUpTicket`
- `followUpOwner`
- `approvals.frontendLead = true`
- `approvals.backendLead = true`
- `allowedFindings[]` entries that match contractId, category, and fieldPath.

Policy note:
- Expired or incomplete exception manifests must fail CI even when no drift findings are present.
- Near-expiry exceptions are reported for proactive cleanup.

Pre-merge prevention note:
- If `docs/planning/sw-08/frontend-consumer-contract-inventory.json` changes in a PR, include `SW-08 Assumption Change Note:` in the PR body.

## 6. Communication Template

Incident summary:
- Drift type:
- Impacted surface:
- Owning team:
- Immediate action:
- ETA for full fix:

## 7. Escalation

Escalate when:
- Gate stays red for more than 1 business day.
- Ownership cannot be resolved.
- Bypass needed more than once for same surface.

Escalation path:
1. Frontend lead
2. Backend lead
3. Engineering manager

## 8. Post-Incident Review

Capture:
- Root cause.
- Why not caught earlier.
- What detector/rule/test to add.
- Whether documentation requires updates.
