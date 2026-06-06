# SW-15 M2-A Verification Note (Nova)

Status: Complete
Date: 2026-06-05
Feature: SW-15 Minimal Character Bust Builder v0
Milestone: M2-A - Create Character Baseline Integration
Repo: laughing-octo-journey (Nova)
Contract source of truth: openapi.yaml in solid-train (Forge)

---

## 1. Scope Completed

Nova M2-A baseline integration is complete for Create Character with selector state, live preview wiring, and typed blocked-save handling.

Completed implementation items:

1. Added blocked-save contract typing and terminal response unions for character/NPC create/update bust flows.
2. Wired Create Character form controls to canonical bust descriptor domains.
3. Added live preview card bound to normalized descriptor input state.
4. Added blocked-save panel and validation error panel with retry path.
5. Preserved existing create/edit and starter-ship bootstrap flow while introducing bust persistence.
6. Updated e2e socket mocking defaults for new character-bust-create/update requests.

Implementation files:

1. src/app/model/bust-descriptor.ts
2. src/app/model/bust-adapter.ts
3. src/app/services/bust-descriptor-adapter.service.ts
4. src/app/page/character/character-setup.ts
5. src/app/page/character/character-setup.html
6. src/app/page/character/character-setup.css
7. src/app/i18n/locales/en.ts
8. src/app/i18n/locales/it.ts
9. src/app/page/character/character-setup.spec.ts
10. src/app/services/bust-descriptor-adapter.service.spec.ts
11. e2e/fixtures/socket-mock.ts

---

## 2. Endpoints Exercised

1. /socket/character-bust-create
2. /socket/character-bust-update
3. /socket/character-add
4. /socket/character-edit
5. /socket/ship-list-by-owner
6. /socket/ship-upsert

---

## 3. OpenAPI Components Exercised

1. BustDescriptor
2. BustValidationErrorResponse
3. BustBlockedSave
4. BustBlockedSaveResponse
5. CharacterBustCreateRequest
6. CharacterBustCreateResponse
7. CharacterBustUpdateRequest
8. CharacterBustUpdateResponse
9. NpcBustCreateRequest
10. NpcBustCreateResponse
11. NpcBustUpdateRequest
12. NpcBustUpdateResponse

---

## 4. Integration Summary

### 4.1 Contract typing

1. Added `BustBlockedSaveReason`, `BustBlockedSave`, and `BustBlockedSaveResponse`.
2. Added terminal response unions for character and NPC create/update endpoints.
3. Updated adapter interface and service method signatures to consume new terminal unions.

### 4.2 Create Character UI baseline

1. Added selector controls for:
   - faceShape
   - skinTone
   - hairStyle
   - hairColor
   - eyeStyle
   - eyeColor
   - expressionPreset
   - apparelAccent
2. Added live preview rendering bound directly to form-driven descriptor state.
3. Added blocked-save and validation feedback panels.
4. Added retry action for failed bust persistence.

### 4.3 Save-flow behavior

1. Create/edit save still executes existing character save contract path.
2. Starter-ship provisioning for create still gates navigation as before.
3. New bust create/update persistence now runs before navigation.
4. Navigation is blocked when bust persistence returns blocked-save or hard-reject validation payload.
5. No fallback normalization was added to compensate for contract failures.

### 4.4 E2E compatibility

1. Added default mock responses for character-bust-create and character-bust-update in `SocketIOMock`.
2. Response payloads preserve request correlation and requestIdentity echo behavior.

---

## 5. Drift and Source-Routing Statement

Drift result: No unresolved Nova-side contract drift introduced in M2-A.

Routing policy applied:

1. Contract mismatches are treated as source-of-truth violations (Forge OpenAPI), not patched by Nova fallbacks.
2. Blocked-save and validation semantics are surfaced to user-facing flow as explicit terminal states.

---

## 6. Test Evidence

### 6.1 Unit/component

Command:

1. npm run test:spec -- "**/bust-descriptor-adapter.service.spec.ts"

Result:

1. 7 passed, 0 failed.

Command:

1. npm run test:spec -- "**/character-setup.spec.ts"

Result:

1. 34 passed, 0 failed.

### 6.2 Playwright e2e

Command:

1. npm run e2e:spec -- e2e/tests/character-add.spec.ts e2e/tests/character-edit.spec.ts

Result:

1. 6 passed, 0 failed.

### 6.3 Build/type/template verification

Command:

1. npm run build

Result:

1. Build succeeded.
2. Existing CSS budget warning unrelated to M2-A logic remains (cold-boot-scan.css over budget).

---

## 7. Visual Gate Statement

M2-A introduces visible Create Character baseline UI changes and passes baseline visual acceptance:

1. Selector controls are present and interactive on desktop and mobile layouts.
2. Live preview updates as selector values change.
3. Error-state panels for hard-reject and blocked-save are visible and actionable.
4. No placeholder-only shell state remains for the M2-A baseline.

---

## 8. Orion Gate Readiness

Nova M2-A status for Orion gate intake: Ready.

Readiness basis:

1. Typed contract semantics implemented end-to-end.
2. Create Character baseline UX wired and validated.
3. Unit and targeted e2e evidence passing.
4. No unresolved drift masked by fallback behavior.
