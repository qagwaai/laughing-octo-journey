/**
 * Expendable Dart Drone domain item constants and coercion helpers.
 */
import { ShipItem, coerceShipItem } from '../ship-item';
import { getItemOrToast } from '../../services/item-catalog-util';

export { ItemContainer, ItemDamageStatus, ItemKinematics, ItemState, ShipItem } from '../ship-item';

export const EXPENDABLE_DART_DRONE_ITEM_TYPE = 'expendable-dart-drone';
export const EXPENDABLE_DART_DRONE_DISPLAY_NAME = 'Expendable Dart Drone';

export interface ExpendableDartDrone extends ShipItem {
  itemType: typeof EXPENDABLE_DART_DRONE_ITEM_TYPE;
}

export function isExpendableDartDrone(item: ShipItem): item is ExpendableDartDrone {
  return item.itemType === EXPENDABLE_DART_DRONE_ITEM_TYPE;
}

export function createExpendableDartDrone(): ExpendableDartDrone {
  const now = new Date().toISOString();
  const catalogItem = tryGetCatalogItem(EXPENDABLE_DART_DRONE_ITEM_TYPE);

  return {
    id: crypto.randomUUID(),
    itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
    displayName: catalogItem?.displayName ?? EXPENDABLE_DART_DRONE_DISPLAY_NAME,
    launchable: catalogItem?.launchable ?? true,
    state: 'contained',
    damageStatus: 'intact',
    container: null,
    owningPlayerId: null,
    owningCharacterId: null,
    spatial: null,
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function tryGetCatalogItem(itemType: string): ReturnType<typeof getItemOrToast> {
  try {
    return getItemOrToast(itemType);
  } catch {
    return undefined;
  }
}

export function coerceExpendableDartDrone(raw: unknown): ExpendableDartDrone | null {
  const item = coerceShipItem(raw);
  if (!item) return null;
  if (item.itemType !== EXPENDABLE_DART_DRONE_ITEM_TYPE) return null;
  return item as ExpendableDartDrone;
}
