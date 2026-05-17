import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { appLogger } from './logger';

export interface Item {
  id: string;
  itemType: string;
  displayName: string;
  tier?: number;
  launchable: boolean;
  state: string;
  damageStatus: string;
  container: any;
  // ...other fields as needed
}

@Injectable({ providedIn: 'root' })
export class ItemCatalogService {
  private readonly http = inject(HttpClient);
  private readonly catalogEndpoints = this.buildCatalogEndpoints();
  private readonly items$ = this.fetchItemsFromEndpoint(0).pipe(
    catchError((error) => {
      appLogger.error('Failed to load item catalog from all configured endpoints.', error);
      return of([] as Item[]);
    }),
    shareReplay(1),
  );
  readonly items = toSignal(this.items$, { initialValue: [] });

  getItemByType(itemType: string): Item | undefined {
    return this.items().find((i) => i.itemType === itemType);
  }

  private fetchItemsFromEndpoint(index: number): Observable<Item[]> {
    if (index >= this.catalogEndpoints.length) {
      return of([]);
    }

    const endpoint = this.catalogEndpoints[index];
    return this.http.get<unknown>(endpoint).pipe(
      map((payload) => this.normalizeItems(payload)),
      catchError((error) => {
        appLogger.warn(`Item catalog fetch failed for '${endpoint}'. Trying next fallback endpoint.`, error);
        return this.fetchItemsFromEndpoint(index + 1);
      }),
    );
  }

  private normalizeItems(payload: unknown): Item[] {
    if (Array.isArray(payload)) {
      return payload as Item[];
    }

    if (payload && typeof payload === 'object') {
      const envelope = payload as Record<string, unknown>;
      if (Array.isArray(envelope['items'])) {
        return envelope['items'] as Item[];
      }

      const data = envelope['data'];
      if (data && typeof data === 'object') {
        const dataEnvelope = data as Record<string, unknown>;
        if (Array.isArray(dataEnvelope['items'])) {
          return dataEnvelope['items'] as Item[];
        }
      }
    }

    return [];
  }

  private buildCatalogEndpoints(): string[] {
    const apiBase = (environment.apiUrl ?? '').replace(/\/+$/, '');
    const endpointCandidates = [
      `${apiBase}/items`,
      `${apiBase}/api/items`,
      '/items',
      '/api/items',
    ];

    // Keep ordering while removing empty/duplicate entries.
    return endpointCandidates.filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
  }
}
