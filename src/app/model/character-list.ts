export const CHARACTER_LIST_REQUEST_EVENT = 'character-list-request';
export const CHARACTER_LIST_RESPONSE_EVENT = 'character-list-response';

import type { CreditLedgerEntry } from './character-economy';
import type { CharacterMissionProgress } from './mission';

export interface CharacterListRequest {
  playerName: string;
  sessionKey: string;
}

export interface PlayerCharacterSummary {
  id: string;
  characterName: string;
  level?: number;
  createdAt?: string;
  missions?: CharacterMissionProgress[];
  credits?: number;
  creditLedger?: CreditLedgerEntry[];
}

export interface CharacterListResponse {
  success: boolean;
  message: string;
  playerName: string;
  characters: PlayerCharacterSummary[];
}
