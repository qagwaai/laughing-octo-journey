export const CHARACTER_LIST_REQUEST_EVENT = 'character-list-request';
export const CHARACTER_LIST_RESPONSE_EVENT = 'character-list-response';

import type { CreditLedgerEntry } from './character-economy';
import type { CharacterMissionProgress } from './mission';

/**
 * Socket payload for retrieving characters owned by a player.
 */
export interface CharacterListRequest {
  playerName: string;
  sessionKey: string;
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
  success: boolean;
  message: string;
  playerName: string;
  characters: PlayerCharacterSummary[];
}
