# Testing Policy

## Purpose
Define a pragmatic, repeatable testing target for this repository so the team catches regressions early without over-investing in low-value tests.

## Scope
This policy applies to the full repository, including:
- mission flows and mission gate progression
- gameplay services and sync paths
- page-level rendering and interaction behavior
- end-to-end user journeys

## Target Matrix

| Layer | Goal | Target Range | Minimum Coverage Intent |
| --- | --- | ---: | --- |
| Unit (reducers/models/helpers) | Validate logic quickly | 20-35 tests per major feature area | Transition rules, edge cases, status mapping |
| Service integration | Validate service contracts and sync behavior | 8-15 tests per major feature area | Service-to-service and socket/API contract correctness |
| Component/page integration | Validate UI-service wiring | 6-12 tests per major feature area | Rendering, state reconciliation, user-triggered transitions |
| Playwright e2e | Validate user-visible regression alarms | 4-8 tests per major feature area | Happy path, stale-state recovery, wrong-sequence guards |
| Feature total | Practical confidence envelope | 38-70 tests per major feature area | Balanced confidence with maintainable runtime |

## Recommended Mix
- 70% unit tests
- 20% integration tests
- 10% Playwright e2e tests

## Stop-Rule
Stop adding routine tests when all criteria below are true:

1. Happy path is covered at all three levels:
   - unit
   - integration
   - Playwright
2. At least three guardrail scenarios are covered:
   - wrong event order
   - stale local state reconciliation
   - backend state mismatch handling
3. Every escaped production bug has a permanent regression test.
4. Flake rate remains below 2% for two consecutive weeks.
5. CI runtime remains acceptable for team cadence.
6. Coverage floors are maintained:
   - unit test coverage >= 80%
   - branches >= 75%
   - functions >= 80%
   - lines >= 85%

## Add-Test Rule
Add new tests only when one of the following is true:

1. New behavior was introduced.
2. A new bug class was discovered.
3. A high-risk refactor changed control flow, state merge logic, or contracts.

## PR Checklist
For test-sensitive pull requests, verify:

- [ ] Which layer(s) changed: unit, integration, component, e2e
- [ ] Affected transitions and contracts are covered
- [ ] At least one negative-path assertion exists when risk increased
- [ ] Existing tests were updated if contracts or flow changed
- [ ] No brittle timing assumptions were introduced in Playwright
- [ ] CI remains green and runtime remains reasonable

## Current Practical Baseline
For major feature areas in this repository, the pragmatic target is:
- 40-60 well-chosen tests, with emphasis on scenario quality over raw count.

Beyond that range, prioritize only high-risk additions tied to new behavior, defects, or refactors.

## Operational Compliance
Use the companion checklist to verify policy items that require time-window evidence (for example flake rate and escaped-bug mapping):
- [Operational Testing Checklist](docs/operational-testing-checklist.md)
