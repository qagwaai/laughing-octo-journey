# SW-15 M0-V Verification Note (Nova)

Status: Complete
Date: 2026-06-05
Feature: SW-15 Minimal Character Bust Builder v0
Milestone: M0-V — Nova Fixture Compatibility Verification
Repo: laughing-octo-journey (Nova)
Contract source of truth: `openapi.yaml` in solid-train (Forge PR #2)
Branch: agents/featurenova-m0v-verification-scaffolding

---

## 1. Contract-Fit Verification

### Forge M0 Contract Reference

All SW-15 bust contract artifacts originate from **Forge solid-train PR #2**
(`agents/sw-15-m0-contract-lock-feature`, SHA `59b286a7b244b8d30ea57d944459fcb48a389ed3`).
The PR adds a `Bust` tag to `openapi.yaml` and 14 new schema components.

**Note:** Forge PR #2 is open and pending merge to `solid-train/main` at verification time.
Nova verification is conducted against the locked PR branch as the authoritative M0 contract.

### Endpoint Paths Consumed

| Path | operationId | Owner scope |
|------|-------------|-------------|
| `/socket/character-bust-create` | `socketCharacterBustCreate` | `characterId` (playable-character) |
| `/socket/character-bust-read` | `socketCharacterBustRead` | `characterId` (playable-character) |
| `/socket/character-bust-update` | `socketCharacterBustUpdate` | `characterId` (playable-character) |
| `/socket/npc-bust-create` | `socketNpcBustCreate` | `npcId` (NPC) |
| `/socket/npc-bust-read` | `socketNpcBustRead` | `npcId` (NPC) |
| `/socket/npc-bust-update` | `socketNpcBustUpdate` | `npcId` (NPC) |

### Schema Components Consumed

| Component Name | Schema File | Nova Usage |
|---|---|---|
| `BustDescriptor` | `bust-descriptor.schema.json` | Stored descriptor returned in all read/write responses |
| `BustValidationErrorResponse` | `bust-validation-error-response.schema.json` | Hard-reject error surface in builder UX (M2) |
| `CharacterBustCreateRequest` | `character-bust-create-request.schema.json` | Write request shape (M1) |
| `CharacterBustCreateResponse` | `character-bust-create-response.schema.json` | Write response echo (M1) |
| `CharacterBustReadRequest` | `character-bust-read-request.schema.json` | Load request shape (M1) |
| `CharacterBustReadResponse` | `character-bust-read-response.schema.json` | Load response (M1) |
| `CharacterBustUpdateRequest` | `character-bust-update-request.schema.json` | Update request shape (M1) |
| `CharacterBustUpdateResponse` | `character-bust-update-response.schema.json` | Update response echo (M1) |
| `NpcBustCreateRequest` | `npc-bust-create-request.schema.json` | NPC create with seed (M3) |
| `NpcBustCreateResponse` | `npc-bust-create-response.schema.json` | NPC create response (M3) |
| `NpcBustReadRequest` | `npc-bust-read-request.schema.json` | NPC load shape (M3) |
| `NpcBustReadResponse` | `npc-bust-read-response.schema.json` | NPC load + seed replay (M3) |
| `NpcBustUpdateRequest` | `npc-bust-update-request.schema.json` | NPC admin-tool override (M3) |
| `NpcBustUpdateResponse` | `npc-bust-update-response.schema.json` | NPC update response echo (M3) |

### Character-Scoped Ownership Confirmation

**Confirmed.** Bust ownership is consistently character-scoped end-to-end:

- `CharacterBust*` request schemas key on `characterId`, not `playerName` or a player-level id.
- Persistence shape embeds bust under `Player.characters[].bust` (playable-character record), not at player root.
- `NpcBust*` request schemas key on `npcId`.
- No global player-level bust profile exists in the M0 contract.
- Nova's type scaffold mirrors this: `CharacterBustCreateRequest.characterId`, `NpcBustCreateRequest.npcId`.
- Decision Lock item 1 ("bust ownership is character-scoped") is consistent end-to-end in the Forge M0 contract.

### Nova Schema Assumptions

Nova TypeScript types in `src/app/model/bust-descriptor.ts` are derived directly from Forge schemas with no ad hoc additions:

- `BustDescriptorInput` mirrors the write-side descriptor (no `schemaVersion` — server-assigned).
- `BustDescriptor` extends `BustDescriptorInput` with `schemaVersion: BustSchemaVersion`.
- All domain union types (`BustFaceShape`, etc.) match Forge schema enum arrays exactly.
- `BustValidationErrorResponse` mirrors the exact shape with `correlationId`, `requestIdentity`, and `validationErrors[]`.
- `appliedOverrides` in NPC responses is `string[]` (field names), consistent with schema.

---

## 2. Fixture Compatibility Validation

### 2a. Canonical Pass Fixture

**Fixture:** `test/fixtures/sw15/character-bust-canonical-pass.json` (solid-train PR #2)

```json
{
  "schemaVersion": "sw-15-m0-v1",
  "presetVersion": "v1",
  "faceShape": "oval",
  "skinTone": "medium",
  "hairStyle": "short-crop",
  "hairColor": "brown",
  "eyeStyle": "almond",
  "eyeColor": "green",
  "expressionPreset": "neutral",
  "apparelAccent": "none"
}
```

**Nova adapter/view-model mapping verification:**

| Field | Fixture value | Nova `BustDescriptor` type | Compatible |
|-------|--------------|---------------------------|------------|
| `schemaVersion` | `"sw-15-m0-v1"` | `BustSchemaVersion` | ✅ |
| `presetVersion` | `"v1"` | `string` | ✅ |
| `faceShape` | `"oval"` | `BustFaceShape` | ✅ |
| `skinTone` | `"medium"` | `BustSkinTone` | ✅ |
| `hairStyle` | `"short-crop"` | `BustHairStyle` | ✅ |
| `hairColor` | `"brown"` | `BustHairColor` | ✅ |
| `eyeStyle` | `"almond"` | `BustEyeStyle` | ✅ |
| `eyeColor` | `"green"` | `BustEyeColor` | ✅ |
| `expressionPreset` | `"neutral"` | `BustExpressionPreset` | ✅ |
| `apparelAccent` | `"none"` | `BustApparelAccent` | ✅ |

**Result: PASS — canonical fixture maps cleanly into Nova `BustDescriptor` type. All 10 fields compatible.**

### 2b. Intentional Mismatch Fixture

**Fixture:** `test/fixtures/sw15/character-bust-mismatch-fail.json` (solid-train PR #2)

```json
{
  "schemaVersion": "sw-15-m0-v1",
  "presetVersion": "v1",
  "faceShape": "triangle",
  ...
}
```

**Nova rejection verification:**

`"triangle"` is not a member of `BustFaceShape` (`'oval' | 'round' | 'square' | 'angular' | 'narrow'`).
TypeScript type system rejects this assignment at compile time — no fallback acceptance path.
At runtime, Forge enforces hard reject (`BustValidationErrorResponse`) with `rejectedValue: "triangle"`.
Nova's `BustValidationErrorResponse` type surfaces `validationErrors[0].field = "descriptor.faceShape"` and `rejectedValue = "triangle"` to the UX blocked-save display (M2).

**Result: REJECTED — `faceShape: "triangle"` fails Nova TypeScript type check and produces no fallback acceptance.**

No Nova-side compensating behavior exists; hard-reject path flows through `BustValidationErrorResponse`.

### 2c. Seed Replay Fixture

**Fixture:** `test/fixtures/sw15/npc-bust-seed-replay.json` (solid-train PR #2)

```json
{
  "npcId": "npc-merchant-001",
  "deterministicSeed": "faction:trade|role:merchant|id:001",
  "descriptor": {
    "schemaVersion": "sw-15-m0-v1",
    "presetVersion": "v1",
    "faceShape": "round",
    "skinTone": "light",
    "hairStyle": "slicked",
    "hairColor": "auburn",
    "eyeStyle": "wide",
    "eyeColor": "hazel",
    "expressionPreset": "warm",
    "apparelAccent": "collar"
  },
  "appliedOverrides": []
}
```

**Nova NPC rendering path compatibility:**

| Field | Fixture value | Nova type | Compatible |
|-------|--------------|-----------|------------|
| `deterministicSeed` | `"faction:trade|role:merchant|id:001"` | `NpcBustReadResponse.deterministicSeed: string` | ✅ |
| `descriptor.faceShape` | `"round"` | `BustFaceShape` | ✅ |
| `descriptor.expressionPreset` | `"warm"` | `BustExpressionPreset` | ✅ |
| `descriptor.apparelAccent` | `"collar"` | `BustApparelAccent` | ✅ |
| `appliedOverrides` | `[]` | `string[]` (field name list) | ✅ |

**Result: COMPATIBLE — seed replay fixture maps cleanly into `NpcBustReadResponse`.**
Replaying `deterministicSeed: "faction:trade|role:merchant|id:001"` must always produce this descriptor.
Nova NPC rendering path (M3) consumes `NpcBustReadResponse.descriptor` for display; seed is stored for replay verification.

---

## 3. Drift Scan

### 3a. Field Coverage

All 6 required domains from Decision Lock item 2 are present in `BustDescriptor`:

| Domain | Decision Lock requirement | Forge schema field | Nova type | Status |
|--------|---------------------------|-------------------|-----------|--------|
| Face shape | ✅ | `faceShape` (5 values) | `BustFaceShape` | ✅ No drift |
| Skin tone | ✅ | `skinTone` (6 values) | `BustSkinTone` | ✅ No drift |
| Hair style | ✅ | `hairStyle` (6 values) | `BustHairStyle` | ✅ No drift |
| Hair color | ✅ | `hairColor` (7 values) | `BustHairColor` | ✅ No drift |
| Eye style | ✅ | `eyeStyle` (5 values) | `BustEyeStyle` | ✅ No drift |
| Eye color | ✅ | `eyeColor` (7 values) | `BustEyeColor` | ✅ No drift |
| Expression preset | ✅ | `expressionPreset` (6 values) | `BustExpressionPreset` | ✅ No drift |
| Apparel accent | ✅ | `apparelAccent` (6 values) | `BustApparelAccent` | ✅ No drift |

### 3b. Persistence Shape Fields

| Required field | Forge schema | Nova type | Status |
|---------------|--------------|-----------|--------|
| `presetVersion` | Required in `BustDescriptor` | `string` | ✅ No drift |
| `schemaVersion` | `"sw-15-m0-v1"` enum | `BustSchemaVersion = 'sw-15-m0-v1'` | ✅ No drift |
| `deterministicSeed` (NPC) | Required in `NpcBustReadResponse` | `string` required | ✅ No drift |
| `appliedOverrides` (NPC) | `string[]` of field names | `string[]` optional | ✅ No drift |

### 3c. Error Shape

| Field | Forge `BustValidationErrorResponse` | Nova type | Status |
|-------|-------------------------------------|-----------|--------|
| `success` | `false` (enum-constrained) | `false` literal type | ✅ No drift |
| `correlationId` | Required string (UUID) | `string` required | ✅ No drift |
| `requestIdentity` | Required object | `BustRequestIdentity` required | ✅ No drift |
| `validationErrors` | Required array, minItems: 1 | `BustValidationError[]` required | ✅ No drift |
| `validationErrors[].field` | Required string | `string` | ✅ No drift |
| `validationErrors[].reason` | Required string | `string` | ✅ No drift |
| `validationErrors[].rejectedValue` | Any JSON type | `unknown` | ✅ No drift |

### 3d. Drift Report

**No drift found.**

All Nova TypeScript types are derived directly from Forge schema files without deviation, addition, or compensating assumption. No enum mismatches, missing required fields, nullability mismatches, or error-shape mismatches were detected.

---

## 4. Non-Functional Scaffolding Summary

The following files were added to the Nova repo. They contain type definitions and TODO anchors only — no runtime behavior, no UI behavior changes, no fallback logic.

| File | Contents | M-phase |
|------|----------|---------|
| `src/app/model/bust-descriptor.ts` | Socket event constants, domain union types, `BustDescriptor`, `BustDescriptorInput`, `BustValidationErrorResponse`, all 12 request/response interfaces | M0-V scaffolding |
| `src/app/model/bust-adapter.ts` | `BustDescriptorAdapter` interface placeholder, `BustDescriptorViewModel` interface placeholder, `BustSaveResult` type | TODO anchors for M1/M2 |

No Angular components, services, routes, or socket wiring were added.

---

## 5. Evidence for M0-10 Checklist

| Evidence item | Result | Reference |
|---------------|--------|-----------|
| Contract-fit verification note | Complete — this document | `docs/planning/sw-15/sw-15-m0v-verification-note.md` |
| Canonical pass fixture compatibility | PASS — all 10 fields map cleanly | Section 2a above |
| Mismatch fixture rejection | REJECTED — `faceShape: "triangle"` fails type and hard-fails Forge validation | Section 2b above |
| Seed replay fixture compatibility | COMPATIBLE — `NpcBustReadResponse` shape matches | Section 2c above |
| Drift scan | No drift found | Section 3d above |
| Scaffolding files (non-functional) | 2 files added, types only | Section 4 above |
| Forge contract reference | solid-train PR #2, SHA `59b286a7b244b8d30ea57d944459fcb48a389ed3` | Sections 1–3 above |

---

## 6. Nova M0-V Acknowledgment

Nova confirms:

1. Forge M0 OpenAPI components and endpoint shapes can be consumed by Nova without schema assumptions.
2. All required customization domains are present and enum-locked.
3. Character-scoped ownership is consistent end-to-end — no account-level bust path was found.
4. Canonical pass fixture maps into Nova descriptor types with no adaptation required.
5. Mismatch fixture (`faceShape: "triangle"`) is a hard rejection — no fallback acceptance path exists in Nova.
6. Seed replay fixture is compatible with Nova NPC rendering path assumptions.
7. No contract drift was found. No Nova-side compensating behavior was added.
8. Non-functional scaffolding (type definitions + TODO anchors) was added to `src/app/model/`.

**M0-10 status: Evidence complete. Ready for Orion M0 gate review.**
