export const CHARACTER_LIST_REQUEST_EVENT = 'character-list-request';
export const CHARACTER_LIST_RESPONSE_EVENT = 'character-list-response';

export interface CharacterListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

import type { CreditLedgerEntry } from './character-economy';
import type { CharacterMissionProgress } from './mission';

/**
 * Socket payload for retrieving characters owned by a player.
 */
export interface CharacterListRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: CharacterListRequestIdentity;
}

/**
 * Summary projection used across UI flows for character selection and navigation.
 */
export interface PlayerCharacterSummary {
  id: string;
  characterName: string;
  level?: number;
  createdAt?: string;
  missions?: CharacterMissionProgress[];
  credits?: number;
  creditLedger?: CreditLedgerEntry[];
}

/**
 * Socket response payload containing character summaries for a player.
 */
export interface CharacterListResponse {
  success: true;
  message: string;
  correlationId: string;
  requestIdentity: CharacterListRequestIdentity;
  playerName: string;
  characters: PlayerCharacterSummary[];
}

export interface CharacterListFailure {
  success: false;
  message: string;
  reason?: 'invalid_request' | 'invalid_session' | 'player_not_registered' | 'incomplete_roster' | 'outcome_unknown';
  correlationId?: string;
  requestIdentity?: CharacterListRequestIdentity;
  clientError?: 'timeout' | 'invalid_response';
}

export type CharacterListResult = CharacterListResponse | CharacterListFailure;
