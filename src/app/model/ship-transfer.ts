/**
 * Ship transfer socket contracts for ownership transitions.
 */
import type { ShipOwnerDescriptor, ShipOwnership } from './ship-owner';

export const SHIP_TRANSFER_REQUEST_EVENT = 'ship-transfer-request';
export const SHIP_TRANSFER_RESPONSE_EVENT = 'ship-transfer-response';

export interface ShipTransferRequest {
  playerName: string;
  sessionKey: string;
  shipId: string;
  fromOwner?: ShipOwnerDescriptor | null;
  toOwner: ShipOwnerDescriptor;
  claimToken?: string;
}

export interface ShipTransferResponse {
  success: boolean;
  message: string;
  reason?: string;
  shipId: string;
  fromOwner?: ShipOwnership | null;
  toOwner?: ShipOwnership | null;
}