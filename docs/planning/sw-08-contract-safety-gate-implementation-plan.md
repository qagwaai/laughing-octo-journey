# SW-08 Contract Safety Gate Implementation Plan (Frontend-Led)

Status: Stage 1 implemented (report-only)
Date: 2026-05-24
Repo: laughing-octo-journey

## 1. Objective

Implement contract drift detection in CI and local workflows to prevent incompatible backend/frontend changes from merging.

## 2. Workstreams

1. Contract ingestion
- Pull or reference backend OpenAPI/event artifacts.
- Normalize artifacts for deterministic comparison.

2. Frontend contract inventory
- Identify critical consumer surfaces: auth, missions, market, ship exterior, fabrication, item catalog.
- Map consumer assumptions (required fields, enums, nested paths).

3. Drift detection tooling
- Implement comparison checks.
- Classify mismatches by severity and owner.

4. CI integration
- Add job and thresholds.
- Add report artifact upload.

5. Developer UX
- Add local preflight command.
- Add remediation hints in output.

## 3. Milestones

1. M1: Baseline scan and false-positive cleanup.
2. M2: Report-only CI gate.
3. M3: Soft fail + bypass workflow.
4. M4: Hard fail + SLA enforcement.

## 4. Team Responsibilities

Frontend:
- Implement consumer inventory and local tooling command.
- Update UI-facing contracts when backend evolves.

Backend:
- Publish stable schema/event artifacts.
- Announce breaking changes with migration notes.

QA:
- Maintain mismatch fixtures.
- Validate gate reliability in CI.

## 5. Dependency Map

Required:
- Stable backend contract artifacts.
- Existing CI pipeline and permissions.
- Cross-repo agreement on drift categories.

Optional accelerators:
- Generated typed client artifacts.
- Unified schema changelog.

## 6. Risks and Mitigations

Risk: High false positives reduce trust.
Mitigation: Baseline tuning and known-safe allowlist with expiry.

Risk: Slow CI times.
Mitigation: Scope checks to changed surfaces plus nightly full scan.

Risk: Ownership ambiguity.
Mitigation: Include owner field in each failure category.

## 7. Deliverables

- CI gate workflow.
- Local command docs.
- Drift category map.
- Mismatch fixture suite.
- Runbook and prompt pack.

## 8. Stage 1 Implementation Status

Implemented in this repo:
- Frontend consumer contract inventory: docs/planning/sw-08/frontend-consumer-contract-inventory.json
- Canonical backend artifact snapshot: docs/planning/sw-08/backend-contract-artifact.json
- Intentional mismatch fixture: docs/planning/sw-08/backend-contract-artifact.intentional-mismatch.json
- Report-only detector: scripts/sw-08-contract-safety-gate.mjs
- CI workflow: .github/workflows/sw-08-contract-safety-gate.yml
- Local preflight command: npm run contract:check

Current mode:
- Report-only only; drift is reported and artifacted, but the workflow does not hard-fail on findings.

Stage 2 tuning needed before soft-fail:
- Add an allowlist for deliberate backend enum expansions that frontend consumers ignore safely.
- Separate true producer regressions from frontend normalization gaps when the consumer can coerce legacy aliases.
- Scope any future soft-fail threshold to changed contract surfaces first to keep CI time and noise down.

## 9. Done Criteria

- Gate catches intentional break.
- Teams can reproduce and fix locally.
- Hard-fail mode active on PR merges.
- Exception workflow documented and tested.
