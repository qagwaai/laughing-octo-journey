# SW-13 Reviewer Governance Checklist (2026-07-16)

Status owner: Nova (frontend)
Audience: reviewers of SW-13 stabilization and adjacent gameplay test changes
Purpose: provide a concrete, repeatable review gate for readiness-contract and flake-risk policy enforcement

## Reviewer Gate (Required)

Mark each item before approval:

- [ ] Change scope is explicit (stateful gameplay, viewer, mission, or infrastructure) and excludes unrelated feature churn.
- [ ] Test layer impact is identified (unit, integration, component/page integration, e2e).
- [ ] Stateful gameplay specs touching Ship Hangar surfaces assert readiness through sw13.v1 contract (for example waitForLoadedReadiness).
- [ ] New/changed e2e assertions use intent-level page-object helpers where available instead of raw polling loops.
- [ ] Any known flaky path edits include a deterministic recovery path or remain untouched with rationale.
- [ ] Focused validation commands are documented in PR notes (smallest impacted test subset first).
- [ ] Expected failures vs regressions are explicitly labeled in PR notes when applicable.
- [ ] No backend contract mutation is introduced without corresponding openapi.yaml update in the same pass.

## Evidence To Request In PR

1. Focused commands executed (unit + e2e subset) and green outcome summary.
2. Files changed by area (fixtures, page objects, specs, docs/governance).
3. If a flaky path was touched, before/after rationale plus fallback behavior.
4. Any deferred full-suite validation plan and owner.

## Escalation Rules

1. Reject if readiness assertions are replaced with timing-only waits for Ship Hangar stateful specs.
2. Reject if reviewer cannot map changed e2e behavior to a deterministic setup and success checkpoint.
3. Escalate for owner decision if broad cross-domain churn appears in a stabilization slice.

## Linkage

- Policy baseline: docs/testing-policy.md
- SW-13 investment plan: docs/planning/sw-13-closure/sw-13-test-foundation-investment-plan-2026-07-11.md
- SW-13 closure status: docs/planning/sw-13-closure/sw-13-closure-status-2026-07-10.md
