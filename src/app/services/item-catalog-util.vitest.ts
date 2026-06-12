import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ItemCatalogService } from './item-catalog.service';
import { getItemOrToast } from './item-catalog-util';
import { MissingItemToastService } from './missing-item-toast.service';

describe('getItemOrToast', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('returns item when catalog contains requested type', () => {
    const item = { id: 'item-1', itemType: 'ore', displayName: 'Ore' };
    const catalog = { getItemByType: vi.fn().mockReturnValue(item) };
    const toast = { showMissingItem: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ItemCatalogService, useValue: catalog },
        { provide: MissingItemToastService, useValue: toast },
      ],
    });

    const result = TestBed.runInInjectionContext(() => getItemOrToast('ore'));

    expect(result).toEqual(item);
    expect(catalog.getItemByType).toHaveBeenCalledWith('ore');
    expect(toast.showMissingItem).not.toHaveBeenCalled();
  });

  it('shows missing item toast when catalog lookup fails', () => {
    const catalog = { getItemByType: vi.fn().mockReturnValue(undefined) };
    const toast = { showMissingItem: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ItemCatalogService, useValue: catalog },
        { provide: MissingItemToastService, useValue: toast },
      ],
    });

    const result = TestBed.runInInjectionContext(() => getItemOrToast('missing-type'));

    expect(result).toBeUndefined();
    expect(toast.showMissingItem).toHaveBeenCalledWith('missing-type');
  });
});
