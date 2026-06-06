// SW-15 M0-V: Placeholder adapter interfaces — no runtime implementation.
// TODO(M1): Implement BustDescriptorAdapter against Forge character-bust-* and npc-bust-* endpoints.
// TODO(M2): Implement BustDescriptorViewModel mapping for bust builder panel controls.

import type { Observable } from 'rxjs';

import type {
  BustBlockedSaveResponse,
  BustDescriptor,
  CharacterBustCreateRequest,
  CharacterBustCreateTerminalResponse,
  CharacterBustReadRequest,
  CharacterBustReadResponse,
  CharacterBustUpdateRequest,
  CharacterBustUpdateTerminalResponse,
  NpcBustCreateRequest,
  NpcBustCreateTerminalResponse,
  NpcBustReadRequest,
  NpcBustReadResponse,
  NpcBustUpdateRequest,
  NpcBustUpdateTerminalResponse,
  BustDescriptorInput,
  BustDescriptorOverrides,
  BustValidationErrorResponse,
} from './bust-descriptor';

/**
 * TODO(M1): Adapter for bust descriptor persistence lifecycle.
 * Wraps character-bust-create/read/update and npc-bust-create/read/update socket events.
 * Must not bypass Forge normalization or add ad hoc fallback correction.
 */
export interface BustDescriptorAdapter {
  createCharacterBust(
    request: CharacterBustCreateRequest,
  ): Observable<CharacterBustCreateTerminalResponse>;
  readCharacterBust(request: CharacterBustReadRequest): Observable<CharacterBustReadResponse>;
  updateCharacterBust(
    request: CharacterBustUpdateRequest,
  ): Observable<CharacterBustUpdateTerminalResponse>;

  createNpcBust(request: NpcBustCreateRequest): Observable<NpcBustCreateTerminalResponse>;
  readNpcBust(request: NpcBustReadRequest): Observable<NpcBustReadResponse>;
  updateNpcBust(request: NpcBustUpdateRequest): Observable<NpcBustUpdateTerminalResponse>;
}

/**
 * TODO(M2): View model derived from a normalized BustDescriptor for the bust builder panel.
 * Selector control states map 1:1 to BustDescriptor domain fields.
 * Must only consume canonical enum values; no ad hoc fallbacks are permitted.
 */
export interface BustDescriptorViewModel {
  // TODO(M2): Map BustDescriptor domains → Angular selector control input states.
}

/**
 * TODO(M2): Result type for save operations surfaced in the builder UX.
 * On failure, validationErrors drive the blocked-save reason display.
 */
export type BustSaveResult =
  | { ok: true; descriptor: BustDescriptor }
  | { ok: false; validationErrorResponse: BustValidationErrorResponse }
  | { ok: false; blockedSaveResponse: BustBlockedSaveResponse };

// Explicitly reference types to prevent dead-code removal before M1/M2 implementations land.
type _UnusedUntilM1 = BustDescriptorInput | BustDescriptorOverrides;
