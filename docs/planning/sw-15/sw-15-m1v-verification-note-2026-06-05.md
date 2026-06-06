# SW-15 M1-V Verification Note (Nova)

Status: Complete
Date: 2026-06-05
Feature: SW-15 Minimal Character Bust Builder v0
Milestone: M1-V - Nova Adapter Integration
Repo: laughing-octo-journey (Nova)
Contract source of truth: openapi.yaml in solid-train (Forge)

---

## 1. Scope Completed

Nova M1-V adapter integration is complete for all required persistence lifecycle paths:

1. Playable-character bust create/read/update.
2. NPC bust create/read/update.
3. Hard-reject validation error passthrough without field inference or fallback normalization.

Implementation files:

1. src/app/services/bust-descriptor-adapter.service.ts
2. src/app/model/bust-adapter.ts
3. src/app/model/bust-descriptor.ts
4. src/app/services/bust-descriptor-adapter.service.spec.ts

---

## 2. Endpoints Exercised

1. /socket/character-bust-create
2. /socket/character-bust-read
3. /socket/character-bust-update
4. /socket/npc-bust-create
5. /socket/npc-bust-read
6. /socket/npc-bust-update

---

## 3. OpenAPI Components Exercised

1. BustDescriptor
2. BustValidationErrorResponse
3. CharacterBustCreateRequest
4. CharacterBustCreateResponse
5. CharacterBustReadRequest
6. CharacterBustReadResponse
7. CharacterBustUpdateRequest
8. CharacterBustUpdateResponse
9. NpcBustCreateRequest
10. NpcBustCreateResponse
11. NpcBustReadRequest
12. NpcBustReadResponse
13. NpcBustUpdateRequest
14. NpcBustUpdateResponse

---

## 4. Adapter Integration Summary

### 4.1 Character paths

1. Added create/read/update adapter methods with event wiring for character-bust-create, character-bust-read, and character-bust-update.
2. Request correlationId and requestIdentity are auto-filled when omitted, matching existing Nova socket-correlation patterns.
3. Responses are routed only when correlationId and requestIdentity match expected request metadata.
4. Non-matching in-flight responses are ignored instead of being misrouted to the active observer.

### 4.2 NPC paths

1. Added create/read/update adapter methods with event wiring for npc-bust-create, npc-bust-read, and npc-bust-update.
2. deterministicSeed, descriptor, and appliedOverrides fields are consumed as returned by Forge with no inferred client fields.
3. Response routing uses the same strict correlation guard as character flows.

### 4.3 Error-path integration

1. Hard-reject BustValidationErrorResponse payloads are surfaced unchanged through adapter observables.
2. validationErrors entries retain exact field, reason, rejectedValue mapping fidelity.
3. No Nova-side fallback path mutates or masks contract violations.

---

## 5. Contract Conformance Check

Conformance checks performed:

1. Request and response method signatures map directly to OpenAPI component types in src/app/model/bust-descriptor.ts.
2. Adapter request construction does not inject inferred business fields.
3. Response handling does not transform descriptor payload shape.
4. Validation error payloads are passed through exactly as contract-defined.

Decision-lock alignment:

1. Character-scoped ownership preserved: characterId and npcId are used as lifecycle scope keys; no account-scoped fallback path introduced.
2. Normalized descriptor payload preserved: descriptor includes presetVersion and schemaVersion from server response; no local derivation.
3. Invalid payload behavior preserved: hard-reject response path with explicit validationErrors is passed to consumers.
4. Deterministic seed behavior preserved: NPC read/create/update paths retain deterministicSeed as first-class contract data.

---

## 6. Drift Scan and Source Routing

Drift result: No unresolved contract drift found in Nova M1-V integration.

Routing policy applied:

1. Any schema or endpoint mismatch is treated as source drift in Forge openapi.yaml.
2. No compensating Nova behavior was added to mask drift.

Note on Forge evidence input URL from Orion prompt:

1. The referenced document https://github.com/qagwaai/miniature-octo-waffle/blob/main/docs/coordination/sw-15-m1-forge-verification-note-2026-06-05.md returned HTTP 404 at verification time.
2. Nova M1-V implementation remained anchored to the contract authority (solid-train openapi.yaml) and in-repo typed contracts.

---

## 7. Test Evidence Summary

### 7.1 Round-trip compatibility checks

Command:

1. npm run test:spec -- "**/bust-descriptor-adapter.service.spec.ts"

Result:

1. 7 passed, 0 failed.

Coverage in this spec includes:

1. Character create/read/update adapter request and response routing.
2. NPC create/read/update adapter request and response routing.
3. Concurrent request isolation under out-of-order responses.

### 7.2 Negative-path hard-reject checks

Verified in unit tests:

1. Character create hard-reject validation error passthrough retains field/reason/rejectedValue.
2. NPC update hard-reject validation error passthrough retains field/reason/rejectedValue.

### 7.3 Targeted e2e regression check

Command:

1. npm run e2e:spec -- e2e/tests/character-add.spec.ts e2e/tests/character-edit.spec.ts

Result:

1. 6 passed, 0 failed.

---

## 8. Visual Gate Statement for M1-V

M1-V is adapter-only and introduces no UI rendering changes by design. Visual regression guard outcome:

1. No visible UI change introduced by this milestone slice.
2. No placeholder/fallback visual mutation path added.

---

## 9. Orion Gate Readiness

Nova M1-V status for Orion M1-J gate close: Ready.

Readiness basis:

1. Adapter integration complete for character and NPC create/read/update.
2. Hard-reject validation error path integrated with full mapping fidelity.
3. No unresolved contract drift findings in Nova implementation.
4. Evidence package includes endpoints, schema components, integration summary, drift status, and test evidence.