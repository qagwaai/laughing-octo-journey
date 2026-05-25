# SW-08 Contract Safety Gate Prompt Pack

Status: Completed (Maintenance Mode)
Date: 2026-05-24
Completed: 2026-05-25
Repo: laughing-octo-journey
Purpose: Reusable prompts for consistent implementation and maintenance.

## Usage Rules

1. Always reference the SW-08 requirements doc before writing code.
2. Treat prompts as accelerators, not source of truth.
3. Include file paths and acceptance criteria in every request.

## Prompt 1: Build Frontend Consumer Inventory

"Create or update a contract consumer inventory for laughing-octo-journey. Map API/event contract fields used by: auth, missions, market, ship-exterior-view, fabrication, item catalog. Output a table of field path, required/optional, consumer file path, and fallback behavior."

## Prompt 2: Add Drift Detection Rule

"Implement a contract drift check that compares backend artifact schemas against frontend consumer expectations. Classify mismatches as missing field, type mismatch, enum mismatch, endpoint/event missing, or renamed field. Produce actionable diagnostics with owner tags."

## Prompt 3: CI Integration

"Add a CI job for SW-08 contract safety gate in report-only mode, then soft-fail mode behind a flag with approved-exception metadata. Ensure output is uploaded as an artifact and includes remediation hints."

## Prompt 4: Create Intentional Mismatch Fixture

"Add a deterministic mismatch fixture proving SW-08 catches a breaking contract change. Include one missing required field and one enum mismatch. Ensure tests fail for the fixture and pass when corrected."

## Prompt 5: Frontend Remediation

"Given this drift failure output, update frontend models and consumers to restore compatibility while preserving existing UI behavior. Add tests for the updated fallback and required-field handling."

## Prompt 6: Backend Remediation

"Given this drift failure output, update backend contract artifacts and compatibility behavior to avoid breaking existing frontend consumers. Include migration note text and deprecation window guidance."

## Prompt 7: Runbook Update

"Update the SW-08 runbook with the current failure signature, owner mapping, and local reproduction steps based on the latest CI output."

## Prompt 8: Exception Review

"Review this requested SW-08 bypass for completeness: reason, risk, expiry date, rollback plan, and follow-up owner. Reject if any field is missing."
