# Ownership and NPC OpenAPI Consumption Plan (Nova)

Status: Draft
Date: 2026-06-12
Repo: laughing-octo-journey
Contract Source: http://localhost:3000/openapi.yaml (v3.1.0)
Upstream Guidance Inputs:
1. https://github.com/qagwaai/solid-train/blob/main/docs/planning/ownership/nova-ownership-api-guide.md
2. https://github.com/qagwaai/solid-train/blob/main/docs/planning/ownership/nova-ownership-api-guide-section-8.md

## 1. Intake Decisions (Captured Before Planning)

Selected scope:
1. Ownership API changes.
2. NPC API changes.
3. Ownership + NPC integration.
4. Frontend model/type updates.
5. Service/socket/event wiring.
6. Vitest + Playwright test updates.
7. OpenAPI governance/versioning checklist.

Selected structure:
1. Phased milestones.

Selected validation depth:
1. Strict: full regression gates + contract drift checks.

Mandatory constraint:
1. No legacy support. Fail fast on contract challenges with notification.

## 2. Hard Rules for This Migration

1. OpenAPI at localhost is the single source of truth for this migration cycle.
2. No legacy compatibility paths are allowed in Nova for ownership payload shape, owner discriminator handling, or ownership-gated requests.
3. Any contract mismatch must fail fast, surface user-visible notification where applicable, and emit diagnostics.
4. Correlation semantics are required on all request/response socket flows that support concurrent in-flight requests.
5. Existing SW-08 safety gates remain mandatory and must be run for ownership/NPC surfaces before merge.

## 3. Contract Surface to Consume

Ownership and NPC-critical operations present in the contract index:
1. ship-list-by-owner.
2. ship-list-by-npc-owner.
3. item-list-by-owner.
4. ship-salvage-claim.
5. ship-piracy-seize.
6. market-listing-create.
7. market-offer-create.
8. market-offer-accept.
9. npc-bust-create.
10. npc-bust-read.
11. npc-bust-update.

Canonical owner discriminator expectations from upstream guide:
1. player-character.
2. npc-pirate.
3. unowned.
4. unknown.

Ownership-protected failure reasons to handle explicitly:
1. OWNERSHIP_VALIDATION_FAILED.
2. SHIP_LIST_OWNER_FORBIDDEN.
3. ITEM_LIST_OWNER_FORBIDDEN.
4. OWNERSHIP_ITEM_FORBIDDEN.
5. OWNERSHIP_LISTING_FORBIDDEN.
6. OWNERSHIP_OFFER_FORBIDDEN.
7. OWNERSHIP_ACCEPT_FORBIDDEN.
8. SALVAGE_CLAIM_FORBIDDEN.
9. SALVAGE_ALREADY_OWNED.
10. PIRACY_SEIZE_INVALID_TARGET.

## 4. Current Nova Touchpoints (Implementation Map)

Model/type layer:
1. src/app/model/ship-owner.ts.
2. src/app/model/ship-list-by-owner.ts.
3. src/app/model/ship-list.ts.
4. src/app/model/market-list.ts.

Service/socket correlation layer:
1. src/app/services/ship.service.ts.
2. src/app/services/ship-exterior-socket.service.ts.
3. src/app/services/market.service.ts.

Feature consumers impacted by ownership flow:
1. src/app/page/game/market-hub.ts.
2. src/app/page/character/character-setup.ts.
3. src/app/scene/ship-exterior-view.ts.

Existing tests to extend:
1. src/app/services/ship.service.vitest.ts.
2. src/app/services/ship-exterior-socket.service.vitest.ts.
3. src/app/services/market-correlation.integration.vitest.ts.
4. e2e/tests/* ownership and market flow specs (targeted additions required).

## 5. Phased Milestones

### M0: Contract Lock and Drift Baseline

Objective:
1. Freeze migration baseline to the current localhost OpenAPI and identify delta against Nova assumptions.

Steps:
1. Snapshot ownership/NPC endpoints and schemas from localhost OpenAPI into planning notes for this cycle.
2. Review current consumer assumptions in model and service files listed above.
3. Record all incompatible deltas as migration tasks with owner and file target.
4. Update SW-08 contract inventory if ownership/NPC field expectations changed.

Exit criteria:
1. Ownership/NPC delta list is complete and reviewed.
2. No unresolved ambiguity about canonical owner fields or ownerType enum handling.

### M1: Type and Model Alignment (Fail-Fast First)

Objective:
1. Align Nova models to canonical ownership and NPC schema shapes.

Steps:
1. Update owner-type and owner descriptor types to match canonical contract values only.
2. Remove acceptance of non-canonical ownerType values from runtime coercion paths.
3. Ensure ownership-bearing entities in ship/item/market models expose canonical ownership fields.
4. Add strict parser/coercion behavior: invalid owner payloads return null/error path and trigger diagnostics, never silent fallback.
5. Confirm model changes cover NPC-owned ship and NPC bust payloads.

Exit criteria:
1. Model layer no longer accepts legacy ownerType variants.
2. Invalid ownership payloads are observable via explicit failure/notification path.

### M2: Service/Event Wiring for New Ownership Operations

Objective:
1. Wire all ownership/NPC socket request-response contracts with strict correlation and identity matching.

Steps:
1. Implement/extend service methods for ship-list-by-npc-owner, item-list-by-owner, ship-salvage-claim, ship-piracy-seize, market-listing-create, market-offer-create, and market-offer-accept.
2. Ensure each request sets correlationId, correlationSource, and requestIdentity.
3. Ensure each response handler rejects unmatched or foreign-operation payloads and emits contract warnings.
4. Add explicit reason-code handling and forwarding to UI-safe error states.
5. Keep one-response-per-request callback behavior for all newly introduced methods.

Exit criteria:
1. Every ownership/NPC endpoint used by Nova has a strict service wrapper.
2. Correlation mismatch and ownership mismatch are both treated as failures.

### M3: Feature Integration by Surface

Objective:
1. Consume new ownership/NPC flows in high-value UI paths.

Steps:
1. Character setup and post-create ship bootstrap:
- Validate starter ship ownership resolution via ship-list-by-owner.
- Ensure failures surface actionable warning and do not silently continue.
2. Market hub and trading surfaces:
- Use ownership-qualified payloads for listing and offer creation/acceptance.
- Ensure unauthorized owner attempts produce clear UI feedback.
3. Ship exterior and route encounter surfaces:
- Consume NPC-owner and piracy signals for encounter and fleet updates.
- React to ship-piracy-seize outcomes with strict state updates and notification.
4. NPC bust consumption:
- Add or align adapters/services to npc-bust-create/read/update where needed in character/NPC UX.

Exit criteria:
1. Ownership and NPC operations are integrated in all planned surfaces.
2. No UI flow depends on deprecated/legacy ownership assumptions.

### M4: Error UX, Telemetry, and Notification Contract

Objective:
1. Make contract failure modes explicit and diagnosable.

Steps:
1. Map all ownership-related reason codes to deterministic user-facing messages.
2. Emit structured diagnostics for:
- Ownership validation failure.
- Forbidden ownership operation.
- Correlation mismatch.
- Foreign operation payload on response channel.
3. Add fail-fast UI state for hard contract violations.
4. Document telemetry field requirements in this repo's planning notes.

Exit criteria:
1. Every ownership/NPC failure reason has UI + logging behavior.
2. Silent failure paths are eliminated.

### M5: Test Expansion (Unit, Integration, E2E)

Objective:
1. Prove strict ownership/NPC behavior under normal and negative scenarios.

Steps:
1. Vitest service tests:
- Add concurrent in-flight correlation tests for each new endpoint wrapper.
- Add foreign-operation and mismatched-owner rejection tests.
2. Feature tests:
- Add coverage for ownership-gated create/accept flows and piracy/salvage negative paths.
3. Playwright tests:
- Add deterministic ownership + NPC flow specs using socket mocks.
- Validate fail-fast notifications for forbidden/invalid ownership scenarios.
4. Ensure no test introduces fallback assertions that conflict with strict mode.

Exit criteria:
1. Ownership/NPC strict behavior is covered by positive and negative tests.
2. Regression suite includes at least one end-to-end ownership failure-path assertion.

### M6: SW-08 Gate Validation for Ownership/NPC Surfaces

Objective:
1. Enforce contract safety before merge.

Steps:
1. Run ownership/NPC-focused contract checks via existing SW-08 tooling.
2. Validate intentional mismatch behavior still hard-fails for ownership enum/required-field drift.
3. Ensure diagnostics include consumer and producer ownership paths.
4. Reject merge if any ownership/NPC contract drift is unresolved.

Exit criteria:
1. Hard-fail contract gate passes in canonical state.
2. Ownership/NPC drift fixtures fail as expected when injected.

### M7: Rollout Readiness and Canary

Objective:
1. Promote only after strict ownership/NPC readiness is proven.

Steps:
1. Verify targeted e2e ownership/NPC specs pass.
2. Verify broader regression baseline remains acceptable.
3. Confirm runtime notifications and logs for contract failures are visible.
4. Define rollback trigger criteria tied to ownership/NPC error-rate thresholds.

Exit criteria:
1. Canary readiness checklist is complete.
2. Go/no-go recommendation is evidence-backed.

## 6. File-Level Change Checklist

Types and contracts:
1. src/app/model/ship-owner.ts.
2. src/app/model/ship-list-by-owner.ts.
3. src/app/model/ship-list.ts.
4. src/app/model/market-list.ts.
5. Add model files for missing ownership/NPC request/response envelopes if absent.

Services:
1. src/app/services/ship.service.ts.
2. src/app/services/ship-exterior-socket.service.ts.
3. src/app/services/market.service.ts.
4. Add/extend dedicated ownership service modules if endpoint count increases further.

Feature consumers:
1. src/app/page/character/character-setup.ts.
2. src/app/page/game/market-hub.ts.
3. src/app/scene/ship-exterior-view.ts.
4. Any NPC-facing panels consuming NPC bust or NPC-owned fleet data.

Tests:
1. src/app/services/ship.service.vitest.ts.
2. src/app/services/ship-exterior-socket.service.vitest.ts.
3. src/app/services/market-correlation.integration.vitest.ts.
4. e2e/tests ownership and NPC flow specs.

## 7. Validation Commands (To Run During Execution)

Core validation:
1. npm run typecheck
2. npm run build
3. npm run test:ci

Targeted regression commands:
1. npm run test:spec -- src/app/services/ship.service.vitest.ts
2. npm run test:spec -- src/app/services/ship-exterior-socket.service.vitest.ts
3. npm run test:spec -- src/app/services/market-correlation.integration.vitest.ts
4. npm run e2e:spec -- <ownership-or-npc-spec>

Contract gate validation:
1. npm run contract:check:stage3
2. npm run contract:check:stage5

## 8. Risks and Countermeasures

1. Risk: Owner type drift between Forge and Nova.
- Countermeasure: strict enum coercion + SW-08 hard-fail checks.

2. Risk: Cross-request callback contamination under concurrency.
- Countermeasure: correlationId + requestIdentity matching with rejection logging.

3. Risk: Silent authorization failures in market ownership flows.
- Countermeasure: explicit reason-code mapping to fail-fast UI notifications.

4. Risk: NPC ownership and bust schemas diverge from UI assumptions.
- Countermeasure: dedicated NPC model tests plus endpoint-specific integration checks.

## 9. Completion Definition

The migration is complete when:
1. All M0-M7 milestones are closed with evidence.
2. Ownership/NPC operations are consumed using canonical payloads only.
3. No legacy compatibility logic remains for ownership contract handling.
4. Strict contract drift gates pass in CI and local reproducible commands.
5. Failure paths are visible, actionable, and telemetry-backed.
