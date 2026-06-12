import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { environment } from '../../environments/environment';
import { appLogger } from './logger';
import { ItemCatalogService } from './item-catalog.service';

describe('ItemCatalogService', () => {
  const base = (environment.apiUrl ?? '').replace(/\/+$/, '');
  const endpoints = [`${base}/items`, `${base}/api/items`, '/items', '/api/items'];
  const originalApiUrl = environment.apiUrl;

  afterEach(() => {
    environment.apiUrl = originalApiUrl;
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('loads array payload from the primary endpoint', () => {
    const http = {
      get: vi.fn().mockReturnValue(of([{ id: 'item-1', itemType: 'ore', displayName: 'Ore' }])),
    } as unknown as HttpClient;

    TestBed.configureTestingModule({
      providers: [ItemCatalogService, { provide: HttpClient, useValue: http }],
    });
    const service = TestBed.inject(ItemCatalogService);

    expect((http.get as any).mock.calls[0]?.[0]).toBe(endpoints[0]);
    expect(service.getItemByType('ore')).toEqual({ id: 'item-1', itemType: 'ore', displayName: 'Ore' });
  });

  it('falls back to secondary endpoint when the first request fails', () => {
    const http = {
      get: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('primary unavailable')))
        .mockReturnValueOnce(of({ items: [{ id: 'item-2', itemType: 'alloy', displayName: 'Alloy' }] })),
    } as unknown as HttpClient;
    const warnSpy = vi.spyOn(appLogger, 'warn').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [ItemCatalogService, { provide: HttpClient, useValue: http }],
    });
    const service = TestBed.inject(ItemCatalogService);

    expect((http.get as any).mock.calls[0]?.[0]).toBe(endpoints[0]);
    expect((http.get as any).mock.calls[1]?.[0]).toBe(endpoints[1]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(service.getItemByType('alloy')?.id).toBe('item-2');
  });

  it('normalizes nested data.items payload shape', () => {
    const http = {
      get: vi.fn().mockReturnValue(
        of({
          data: {
            items: [{ id: 'item-3', itemType: 'fuel', displayName: 'Fuel Cell' }],
          },
        }),
      ),
    } as unknown as HttpClient;

    TestBed.configureTestingModule({
      providers: [ItemCatalogService, { provide: HttpClient, useValue: http }],
    });
    const service = TestBed.inject(ItemCatalogService);

    expect(service.getItemByType('fuel')?.displayName).toBe('Fuel Cell');
  });

  it('returns empty items and logs when all endpoints fail', () => {
    const http = {
      get: vi.fn().mockReturnValue(throwError(() => new Error('all failed'))),
    } as unknown as HttpClient;
    const warnSpy = vi.spyOn(appLogger, 'warn').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [ItemCatalogService, { provide: HttpClient, useValue: http }],
    });
    const service = TestBed.inject(ItemCatalogService);

    expect((http.get as any).mock.calls.map((call: unknown[]) => call[0])).toEqual(endpoints);
    expect(warnSpy).toHaveBeenCalledTimes(endpoints.length);
    expect(service.getItemByType('missing')).toBeUndefined();
  });

  it('normalizes unknown payload shapes to an empty item list', () => {
    const http = {
      get: vi.fn().mockReturnValue(of(42)),
    } as unknown as HttpClient;

    TestBed.configureTestingModule({
      providers: [ItemCatalogService, { provide: HttpClient, useValue: http }],
    });
    const service = TestBed.inject(ItemCatalogService);

    expect(service.getItemByType('any')).toBeUndefined();
  });

  it('builds deduplicated fallback endpoints when api url is missing', () => {
    environment.apiUrl = undefined as unknown as string;
    const http = {
      get: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('fallback-1')))
        .mockReturnValueOnce(of([{ id: 'item-4', itemType: 'probe', displayName: 'Probe' }])),
    } as unknown as HttpClient;

    TestBed.configureTestingModule({
      providers: [ItemCatalogService, { provide: HttpClient, useValue: http }],
    });
    const service = TestBed.inject(ItemCatalogService);

    expect((http.get as any).mock.calls[0]?.[0]).toBe('/items');
    expect((http.get as any).mock.calls[1]?.[0]).toBe('/api/items');
    expect(service.getItemByType('probe')?.id).toBe('item-4');
  });
});
