/**
 * Ship transfer socket contracts for ownership transitions.
 */
import type { ShipOwnerDescriptor, ShipOwnership } from './ship-owner';

export const SHIP_TRANSFER_REQUEST_EVENT = 'ship-transfer-request';
export const SHIP_TRANSFER_RESPONSE_EVENT = 'ship-transfer-response';

export interface ShipTransferRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export interface ShipTransferRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: ShipTransferRequestIdentity;
  shipId: string;
  fromOwner?: ShipOwnerDescriptor | null;
  toOwner: ShipOwnerDescriptor;
  claimToken?: string;
}

export interface ShipTransferResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId?: string;
  requestIdentity?: ShipTransferRequestIdentity;
  shipId: string;
  fromOwner?: ShipOwnership | null;
  toOwner?: ShipOwnership | null;
}