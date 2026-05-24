# SW-08 Contract Safety Gate Runbook (Frontend-Led)

Status: Draft
Date: 2026-05-24
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
3. Run local SW-08 check command.
4. Confirm exact mismatch lines and paths.

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
- Approval from frontend and backend leads.
- Ticket with expiry date.
- Rollback strategy.
- Follow-up owner assigned.

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
