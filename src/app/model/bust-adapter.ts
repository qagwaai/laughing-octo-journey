// SW-15 M0-V: Placeholder adapter interfaces — no runtime implementation.
// TODO(M1): Implement BustDescriptorAdapter against Forge character-bust-* and npc-bust-* endpoints.
// TODO(M2): Implement BustDescriptorViewModel mapping for bust builder panel controls.

import type {
  BustDescriptor,
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
  // TODO(M1): loadCharacterBust(characterId: string): Observable<BustDescriptor | null>
  // TODO(M1): saveCharacterBust(characterId: string, descriptor: BustDescriptorInput): Observable<BustDescriptor | BustValidationErrorResponse>
  // TODO(M1): loadNpcBust(npcId: string): Observable<BustDescriptor | null>
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
  | { ok: false; validationErrorResponse: BustValidationErrorResponse };

// Explicitly reference types to prevent dead-code removal before M1/M2 implementations land.
type _UnusedUntilM1 = BustDescriptorInput | BustDescriptorOverrides;
