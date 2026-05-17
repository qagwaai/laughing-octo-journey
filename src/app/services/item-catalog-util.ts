import { inject } from '@angular/core';
import { ItemCatalogService } from './item-catalog.service';
import { MissingItemToastService } from './missing-item-toast.service';

export function getItemOrToast(itemType: string) {
  const catalog = inject(ItemCatalogService);
  const toast = inject(MissingItemToastService);
  const item = catalog.getItemByType(itemType);
  if (!item) {
    toast.showMissingItem(itemType);
  }
  return item;
}
