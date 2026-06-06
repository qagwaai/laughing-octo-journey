// SW-15 M0-V: Non-functional scaffolding — type definitions only.
// Contract source: Forge solid-train PR #2 (agents/sw-15-m0-contract-lock-feature).
// No runtime behavior. Adapter and view-model implementations are deferred to M1/M2.

export const CHARACTER_BUST_CREATE_REQUEST_EVENT = 'character-bust-create';
export const CHARACTER_BUST_CREATE_RESPONSE_EVENT = 'character-bust-create-response';
export const CHARACTER_BUST_READ_REQUEST_EVENT = 'character-bust-read';
export const CHARACTER_BUST_READ_RESPONSE_EVENT = 'character-bust-read-response';
export const CHARACTER_BUST_UPDATE_REQUEST_EVENT = 'character-bust-update';
export const CHARACTER_BUST_UPDATE_RESPONSE_EVENT = 'character-bust-update-response';
export const NPC_BUST_CREATE_REQUEST_EVENT = 'npc-bust-create';
export const NPC_BUST_CREATE_RESPONSE_EVENT = 'npc-bust-create-response';
export const NPC_BUST_READ_REQUEST_EVENT = 'npc-bust-read';
export const NPC_BUST_READ_RESPONSE_EVENT = 'npc-bust-read-response';
export const NPC_BUST_UPDATE_REQUEST_EVENT = 'npc-bust-update';
export const NPC_BUST_UPDATE_RESPONSE_EVENT = 'npc-bust-update-response';

// Domain enum types — aligned to Forge BustDescriptor schema (bust-descriptor.schema.json).
// Any value outside these unions is a hard-reject at the Forge validation layer.
export type BustFaceShape = 'oval' | 'round' | 'square' | 'angular' | 'narrow';
export type BustSkinTone = 'pale' | 'light' | 'medium' | 'tan' | 'dark' | 'deep';
export type BustHairStyle = 'short-crop' | 'mid-fade' | 'long-loose' | 'braided' | 'shaved' | 'slicked';
export type BustHairColor = 'black' | 'brown' | 'auburn' | 'blonde' | 'silver' | 'white' | 'red';
export type BustEyeStyle = 'narrow' | 'wide' | 'almond' | 'hooded' | 'round';
export type BustEyeColor = 'brown' | 'hazel' | 'green' | 'blue' | 'grey' | 'amber' | 'violet';
export type BustExpressionPreset = 'neutral' | 'focused' | 'smirk' | 'stern' | 'warm' | 'weary';
export type BustApparelAccent = 'none' | 'collar' | 'hood' | 'visor' | 'goggles' | 'headband';
export type BustSchemaVersion = 'sw-15-m0-v1';

/**
 * Write-side descriptor for create/update requests. schemaVersion is server-assigned
 * and not included in request payloads (mirrors character-bust-create-request.schema.json).
 */
export interface BustDescriptorInput {
  presetVersion: string;
  faceShape: BustFaceShape;
  skinTone: BustSkinTone;
  hairStyle: BustHairStyle;
  hairColor: BustHairColor;
  eyeStyle: BustEyeStyle;
  eyeColor: BustEyeColor;
  expressionPreset: BustExpressionPreset;
  apparelAccent: BustApparelAccent;
}

/**
 * Full normalized bust descriptor as returned in read/write responses.
 * Mirrors Forge component BustDescriptor (bust-descriptor.schema.json).
 * additionalProperties: false — no extra fields accepted or emitted.
 */
export interface BustDescriptor extends BustDescriptorInput {
  schemaVersion: BustSchemaVersion;
}

/**
 * Optional admin-tool overrides for NPC create/update requests.
 * Mirrors the overrides object in npc-bust-create-request.schema.json.
 * Only fields present in this object override the deterministicSeed output.
 */
export interface BustDescriptorOverrides {
  faceShape?: BustFaceShape;
  skinTone?: BustSkinTone;
  hairStyle?: BustHairStyle;
  hairColor?: BustHairColor;
  eyeStyle?: BustEyeStyle;
  eyeColor?: BustEyeColor;
  expressionPreset?: BustExpressionPreset;
  apparelAccent?: BustApparelAccent;
}

export interface BustRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Per-field validation error entry in a hard-reject response.
 */
export interface BustValidationError {
  field: string;
  reason: string;
  rejectedValue: unknown;
}

/**
 * Hard-reject response for invalid bust descriptor payloads.
 * Mirrors Forge component BustValidationErrorResponse.
 * success is always false; no silent correction path exists.
 */
export interface BustValidationErrorResponse {
  success: false;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  validationErrors: BustValidationError[];
}

// ---------------------------------------------------------------------------
// Playable-character bust socket contracts
// Endpoint: /socket/character-bust-create (operationId: socketCharacterBustCreate)
// ---------------------------------------------------------------------------

/** Mirrors Forge component CharacterBustCreateRequest. */
export interface CharacterBustCreateRequest {
  playerName: string;
  sessionKey: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  characterId: string;
  descriptor: BustDescriptorInput;
}

/** Mirrors Forge component CharacterBustCreateResponse. */
export interface CharacterBustCreateResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  playerName: string;
  characterId: string;
  descriptor: BustDescriptor;
}

// Endpoint: /socket/character-bust-read (operationId: socketCharacterBustRead)

/** Mirrors Forge component CharacterBustReadRequest. */
export interface CharacterBustReadRequest {
  playerName: string;
  sessionKey: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  characterId: string;
}

/** Mirrors Forge component CharacterBustReadResponse. */
export interface CharacterBustReadResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  playerName: string;
  characterId: string;
  descriptor: BustDescriptor;
}

// Endpoint: /socket/character-bust-update (operationId: socketCharacterBustUpdate)

/** Mirrors Forge component CharacterBustUpdateRequest. */
export interface CharacterBustUpdateRequest {
  playerName: string;
  sessionKey: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  characterId: string;
  descriptor: BustDescriptorInput;
}

/** Mirrors Forge component CharacterBustUpdateResponse. */
export interface CharacterBustUpdateResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  playerName: string;
  characterId: string;
  descriptor: BustDescriptor;
}

// ---------------------------------------------------------------------------
// NPC bust socket contracts
// Endpoint: /socket/npc-bust-create (operationId: socketNpcBustCreate)
// ---------------------------------------------------------------------------

/** Mirrors Forge component NpcBustCreateRequest. */
export interface NpcBustCreateRequest {
  playerName: string;
  sessionKey: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  npcId: string;
  deterministicSeed: string;
  presetVersion?: string;
  overrides?: BustDescriptorOverrides;
}

/** Mirrors Forge component NpcBustCreateResponse. appliedOverrides is a string[] of override field names. */
export interface NpcBustCreateResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  npcId: string;
  deterministicSeed: string;
  descriptor: BustDescriptor;
  appliedOverrides?: string[];
}

// Endpoint: /socket/npc-bust-read (operationId: socketNpcBustRead)

/** Mirrors Forge component NpcBustReadRequest. */
export interface NpcBustReadRequest {
  playerName: string;
  sessionKey: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  npcId: string;
}

/** Mirrors Forge component NpcBustReadResponse. deterministicSeed is required on read. */
export interface NpcBustReadResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  npcId: string;
  deterministicSeed: string;
  descriptor: BustDescriptor;
  appliedOverrides?: string[];
}

// Endpoint: /socket/npc-bust-update (operationId: socketNpcBustUpdate)

/** Mirrors Forge component NpcBustUpdateRequest. */
export interface NpcBustUpdateRequest {
  playerName: string;
  sessionKey: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  npcId: string;
  deterministicSeed: string;
  presetVersion?: string;
  overrides?: BustDescriptorOverrides;
}

/** Mirrors Forge component NpcBustUpdateResponse. */
export interface NpcBustUpdateResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: BustRequestIdentity;
  npcId: string;
  deterministicSeed: string;
  descriptor: BustDescriptor;
  appliedOverrides?: string[];
}
