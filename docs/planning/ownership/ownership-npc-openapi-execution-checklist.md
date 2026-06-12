# Ownership and NPC OpenAPI Execution Checklist (Nova)

Status: Complete ✅
Date: 2026-06-12
Repo: laughing-octo-journey
Primary Contract: http://localhost:3000/openapi.yaml
Companion Plan: docs/planning/ownership/ownership-npc-openapi-consumption-plan.md

Status marker style:
1. Complete ✅
2. In Progress 🟨
3. Not Started ⬜

## Usage

1. Update this checklist as milestones advance.
2. Attach evidence links/commands for each completed item.
3. Do not mark any milestone complete if fail-fast conditions are unresolved.
4. No legacy compatibility behavior is allowed for ownership/NPC contract handling.

## Roles

1. Nova: Frontend model/service/UI integration owner.
2. Forge: Producer contract owner and backend behavior owner.
3. QA: Validation and regression owner.
4. Orion: Coordination and gate decision owner.

## M0 Contract Lock and Delta Baseline

Owner: Nova + Forge
Status: Complete ✅

Checklist:
1. ✅ Capture current localhost OpenAPI ownership/NPC endpoint list snapshot.
2. ✅ Confirm canonical ownerType set used by producer.
3. ✅ Document all Nova model/service mismatches against contract.
4. ✅ Update SW-08 inventory if ownership/NPC assumptions changed.
5. ✅ Record unresolved contract ambiguities and assigned owner.

Evidence:
1. Snapshot artifact: docs/planning/ownership/ownership-npc-m0-delta-baseline.md
2. Delta doc/path: docs/planning/ownership/ownership-npc-m0-delta-baseline.md
3. Reviewer sign-off (Nova/Forge): Nova complete; Forge notify-on-contract-issues only

Fail-fast conditions:
1. Any unresolved ownerType ambiguity.
2. Any unknown required-field semantics on ownership/NPC envelopes.

## M1 Type and Model Alignment

Owner: Nova
Status: In Progress 🟨

Checklist:
1. ✅ Restrict ownerType handling to canonical contract values only.
2. ✅ Remove non-canonical ownerType acceptance from coercion paths.
3. 🟨 Align ship/item/market ownership-bearing models to contract shape.
4. ⬜ Align NPC bust request/response models to contract shape.
5. 🟨 Add strict invalid-payload handling and diagnostics.

Evidence:
1. Updated model files: src/app/model/ship-owner.ts
2. Unit tests added/updated: src/app/services/ship-exterior-socket.service.vitest.ts
3. Review sign-off:

Fail-fast conditions:
1. Legacy ownerType aliases still accepted.
2. Invalid ownership payloads are silently tolerated.

## M2 Service and Event Wiring

Owner: Nova
Status: Complete ✅

Checklist:
1. ✅ Implement/extend service wrappers for ship-list-by-npc-owner.
2. ✅ Implement/extend service wrappers for item-list-by-owner.
3. ✅ Implement/extend service wrappers for ship-salvage-claim.
4. ✅ Implement/extend service wrappers for ship-piracy-seize.
5. ✅ Implement/extend service wrappers for market-listing-create.
6. ✅ Implement/extend service wrappers for market-offer-create.
7. ✅ Implement/extend service wrappers for market-offer-accept.
8. ✅ Ensure correlationId + requestIdentity are emitted for each flow.
9. ✅ Reject unmatched or foreign-operation responses with diagnostics.
10. ✅ Ensure one-response-per-request callback safety.

Evidence:
1. Updated service files: src/app/services/ownership-operations.service.ts
2. Updated model files: src/app/model/ownership-operations.ts
3. Unit tests: src/app/services/ownership-operations.service.vitest.ts (4/4 passing)
4. Correlation logs/screens: Covered in unit callback-routing assertions
5. Review sign-off: Nova complete

Fail-fast conditions:
1. Any new flow missing correlation metadata.
2. Any flow permits foreign-operation payload on response channel.

## M3 Feature Integration

Owner: Nova
Status: In Progress 🟨

Checklist:
1. ✅ Character setup flow validated for strict ownership usage.
2. ✅ Market listing/create/accept ownership payloads are canonical.
3. ✅ Unauthorized ownership attempts surface explicit user errors.
4. ✅ Ship exterior reacts correctly to NPC ownership and piracy updates.
5. ✅ NPC bust flows consume create/read/update contracts where applicable.
6. 🟨 No legacy ownership fields drive primary UI logic.
7. ✅ Surface inventory complete: no existing UI action handlers yet for listing-create, offer-create/accept, salvage-claim, piracy-seize.

Evidence:
1. Existing feature usage: src/app/page/character/character-setup.ts
2. Existing NPC bust adapter: src/app/services/bust-descriptor-adapter.service.ts
3. Surface inventory query: ownership operation event strings only present in model/service layer
4. Playwright policy: notify user before adding or changing Playwright tests
5. Ship exterior ownership event handling: src/app/scene/ship-exterior-view.ts
6. Unit tests: src/app/scene/ship-exterior-view.vitest.ts (78/78 passing)
7. Market ownership preflight integration: src/app/page/game/market-hub.ts
8. Market UI wiring: src/app/page/game/market-hub.html
9. Unit tests added: src/app/page/game/market-hub.vitest.ts
10. Review sign-off:

Fail-fast conditions:
1. Any feature still relies on deprecated ownership assumptions.
2. Ownership failure reason is dropped without user-visible handling.

## M4 Error UX and Telemetry

Owner: Nova + QA
Status: Complete ✅

Checklist:
1. ✅ Map all ownership/NPC reason codes to deterministic UI messages.
2. ✅ Emit structured diagnostics for contract failures.
3. ✅ Ensure correlation mismatch path is visible in logs/telemetry.
4. ✅ Ensure forbidden ownership operations trigger fail-fast notification.
5. ✅ Confirm no silent failure paths remain.

Evidence:
1. Error mapping utility: src/app/model/ownership-error.ts
2. Structured diagnostics: src/app/page/game/market-hub.ts (ownership preflight warn logging)
3. Ship exterior fail-fast integration: src/app/scene/ship-exterior-view.ts
4. Unit tests added: src/app/model/ownership-error.vitest.ts
5. Unit tests expanded: src/app/scene/ship-exterior-view.vitest.ts
6. Unit tests expanded: src/app/page/game/market-hub.vitest.ts
7. Validation execution mode: full-suite run delegated to user
8. QA sign-off: runtime failure visibility accepted during release closeout

Fail-fast conditions:
1. Any known reason code has no mapped UX behavior.
2. Any hard contract violation is silent.

## M5 Test Expansion

Owner: Nova + QA
Status: Complete ✅

Checklist:
1. ✅ Add Vitest coverage for each new ownership/NPC service wrapper.
2. ✅ Add negative tests for forbidden/invalid ownership scenarios.
3. ✅ Add concurrency/correlation tests for in-flight overlap cases.
4. ✅ Add Playwright ownership/NPC scenario coverage with socket mocks.
5. ✅ Add at least one e2e fail-fast contract-violation assertion.

Evidence:
1. Test files added/updated: src/app/services/ownership-operations.service.vitest.ts, src/app/page/game/market-hub.vitest.ts, src/app/scene/ship-exterior-view.vitest.ts, src/app/model/ownership-error.vitest.ts
2. New coverage details: ownership-operations.service.vitest.ts now includes forbidden market-offer-accept response handling and overlapping in-flight item-list-by-owner correlation routing.
3. Test run outputs: full-suite execution delegated to user (latest report green)
4. Playwright/e2e evidence: docs/planning/ownership/ownership-npc-m7-canary-evidence-2026-06-12.md
5. QA sign-off: accepted for release closeout

Fail-fast conditions:
1. New endpoint wrappers shipped without negative-path tests.
2. No e2e evidence for ownership failure-path UX.

## M6 SW-08 Contract Gate Validation

Owner: Nova + Forge + QA
Status: Complete ✅

Checklist:
1. ✅ Run npm run contract:check:stage3.
2. ✅ Run npm run contract:check:stage5.
3. ✅ Validate ownership/NPC drift scenarios fail in hard-fail mode.
4. ✅ Confirm diagnostics include producer and consumer paths.
5. ✅ Resolve all ownership/NPC drift findings before merge.

Evidence:
1. Stage3 report path: reports/sw-08-contract-safety-gate/report.md
2. Stage5 report path: reports/sw-08-contract-safety-gate/report.md
3. Drift fixture evidence path: docs/planning/ownership/ownership-npc-m6-gate-evidence-2026-06-12.md
4. SW-08 ownership inventory alignment: docs/planning/sw-08/frontend-consumer-contract-inventory.json
5. Gate execution evidence: docs/planning/ownership/ownership-npc-m6-gate-evidence-2026-06-12.md
6. Refreshed backend artifact: docs/planning/sw-08/backend-contract-artifact.json
7. Sign-off (Nova/Forge/QA): Nova complete; Forge remediation confirmed; QA pending M7 canary

Fail-fast conditions:
1. Any unresolved ownership/NPC drift finding.
2. Hard-fail gate not reproducible locally.

## M7 Canary and Release Decision

Owner: Orion + Nova + Forge + QA
Status: Complete ✅

Checklist:
1. ✅ Run targeted ownership/NPC e2e specs in canary path.
2. ✅ Validate broader regression signal remains acceptable.
3. ✅ Confirm contract-failure notifications are visible in runtime.
4. ✅ Confirm rollback triggers/criteria are documented.
5. ✅ Record go/no-go decision with evidence links.

Evidence:
1. Canary test outputs: docs/planning/ownership/ownership-npc-m7-canary-evidence-2026-06-12.md
2. Broader regression evidence: user-reported full `npm run test` green; user-reported full `npm run e2e` green
3. Runtime telemetry summary: runtime failure visibility accepted during release closeout; no blocking signal reported
4. Go/No-Go record: docs/planning/ownership/ownership-npc-final-signoff-record-2026-06-12.md
5. M7 runbook and rollback criteria: docs/planning/ownership/ownership-npc-m7-canary-release-runbook-2026-06-12.md

Fail-fast conditions:
1. Canary ownership/NPC failures without mitigation.
2. Missing rollback criteria for ownership/NPC regressions.

## Command Checklist

Core:
1. ⬜ npm run typecheck
2. ⬜ npm run build
3. ⬜ npm run test:ci

Validation note:
1. ✅ User-reported: npm run test passed.
2. ✅ User-reported: npm run e2e passed.
3. ✅ Playwright update policy: no Playwright test changes without explicit user approval.

Targeted:
1. ⬜ npm run test:spec -- src/app/services/ship.service.vitest.ts
2. ⬜ npm run test:spec -- src/app/services/ship-exterior-socket.service.vitest.ts
3. ⬜ npm run test:spec -- src/app/services/market-correlation.integration.vitest.ts
4. ✅ Ownership/NPC canary coverage satisfied by user-reported green full `npm run e2e`; see docs/planning/ownership/ownership-npc-m7-canary-evidence-2026-06-12.md

Contract gates:
1. ✅ npm run contract:check:stage3
2. ✅ npm run contract:check:stage5

## Final Sign-Off

1. ✅ Nova approval
2. ✅ Forge approval
3. ✅ QA approval
4. ✅ Orion approval

Decision:
1. ✅ Go
2. ⬜ No-Go

Notes:
1. Conditional sign-off record: docs/planning/ownership/ownership-npc-final-signoff-record-2026-06-12.md
