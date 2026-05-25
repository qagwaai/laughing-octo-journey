/**
 * Owner-scoped ship list socket contracts.
 */
import type { ShipOwnerDescriptor, ShipOwnership } from './ship-owner';
import type { ShipSummary } from './ship-list';

export const SHIP_LIST_BY_OWNER_REQUEST_EVENT = 'ship-list-by-owner-request';
export const SHIP_LIST_BY_OWNER_RESPONSE_EVENT = 'ship-list-by-owner-response';

export interface ShipListByOwnerRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export interface ShipListByOwnerRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: ShipListByOwnerRequestIdentity;
  owner: Pick<ShipOwnerDescriptor, 'ownerType'> & Partial<Omit<ShipOwnerDescriptor, 'ownerType'>>;
}

export interface ShipListByOwnerResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId?: string;
  requestIdentity?: ShipListByOwnerRequestIdentity;
  owner?: ShipOwnership | null;
  ships: ShipSummary[];
}