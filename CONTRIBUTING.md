# Contributing

Thank you for your interest in contributing.

## Inbound Contribution Terms

By submitting any contribution (including code, documentation, assets, issue text, or pull request content) to this repository, you agree that:

1. Your contribution is submitted under this repository's LICENSE and NOTICE terms.
2. You grant the repository owner all rights necessary to use, modify, relicense, and otherwise exploit your contribution as part of this project.
3. You have the legal right to submit the contribution and to grant these rights.
4. Your contribution does not knowingly infringe third-party intellectual property rights.

## No Implied License

Submitting a contribution does not grant you or others any additional rights to use this repository beyond what is explicitly stated in the LICENSE file.

## Commercial Use

Commercial use of this repository or derivative works is not permitted without a separate written commercial license.

For commercial licensing inquiries, contact: qagwaai@gmail.com

## SW-13 Stabilization Governance

For pull requests that touch SW-13 stabilization scope (stateful gameplay tests, readiness assertions, viewer harness/spec cleanup, or related governance docs):

1. Complete the SW-13 section in the pull request template.
2. Use the reviewer checklist artifact during author self-review and code review:
	- `docs/planning/sw-13-closure/sw-13-reviewer-governance-checklist-2026-07-16.md`
3. Update the governance adoption log (or document why not applicable):
	- `docs/planning/sw-13-closure/sw-13-governance-adoption-log-2026-07-20.md`
4. Include focused validation commands in the PR description (smallest impacted subset first).
5. If Ship Hangar stateful gameplay specs were modified, confirm deterministic sw13.v1 readiness assertions are present.
6. Label expected failures versus regressions explicitly when applicable.
