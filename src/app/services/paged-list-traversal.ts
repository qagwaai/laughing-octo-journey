import { PAGED_LIST_MAX_LIMIT, readPagedListPageInfo, type PagedListResponseMetadata } from '../model/paged-list';
import { appLogger } from './logger';

export interface PagedListRequest {
  offset?: number;
  limit?: number;
}

export interface PagedListResponse extends PagedListResponseMetadata {
  success: boolean;
  message?: string;
}

/** Issues one page request and returns an unsubscribe function. */
export type PagedListRequester<TRequest, TResponse> = (
  request: TRequest,
  onResponse: (response: TResponse) => void,
) => (() => void) | void;

export type PagedListIncompleteReason = 'page-cap' | 'page-failed' | 'invalid-paging' | 'no-progress' | 'timeout';

export type FetchAllPagesOutcome<TItem> =
  | { status: 'complete'; items: TItem[]; total: number; pages: number }
  | {
      status: 'partial';
      items: TItem[];
      total: number | null;
      pages: number;
      reason: PagedListIncompleteReason;
      message: string;
    }
  | { status: 'failed'; items: TItem[]; pages: number; reason: PagedListIncompleteReason; message: string };

export interface FetchAllPagesOptions<TResponse, TItem> {
  /** Used in warnings, for example `ship-exterior.local-sweep`. */
  label: string;
  readItems: (response: TResponse) => readonly TItem[] | null | undefined;
  getId: (item: TItem) => string;
  /** Hard stop; reaching it with `hasMore` still true yields a `partial` outcome. */
  maxPages: number;
  pageSize?: number;
  /** Per-page wait before the traversal gives up. 0 disables the timer. */
  pageTimeoutMs?: number;
}

export const FETCH_ALL_PAGES_DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Walks an offset-paged list until `hasMore` is false, advancing by the
 * response's effective `offset + limit` and de-duplicating by ID (later pages
 * win, first-seen order is kept). Pages are computed per request, so a sweep is
 * best-effort when the data changes mid-walk.
 *
 * A failure on the first page is `failed`; a failure after at least one good
 * page is `partial`. Callers that must not act on incomplete data (seeding)
 * must require `complete`.
 *
 * Returns a cancel function; after cancellation `onDone` is never called.
 */
export function fetchAllPages<TRequest extends PagedListRequest, TResponse extends PagedListResponse, TItem>(
  requestPage: PagedListRequester<TRequest, TResponse>,
  baseRequest: TRequest,
  options: FetchAllPagesOptions<TResponse, TItem>,
  onDone: (outcome: FetchAllPagesOutcome<TItem>) => void,
): () => void {
  const pageSize = Math.min(Math.max(1, Math.floor(options.pageSize ?? PAGED_LIST_MAX_LIMIT)), PAGED_LIST_MAX_LIMIT);
  const maxPages = Math.max(1, Math.floor(options.maxPages));
  const timeoutMs = options.pageTimeoutMs ?? FETCH_ALL_PAGES_DEFAULT_TIMEOUT_MS;
  const items = new Map<string, TItem>();
  let pages = 0;
  let lastTotal: number | null = null;
  let finished = false;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearPending = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    unsubscribe?.();
    unsubscribe = undefined;
  };

  const finish = (outcome: FetchAllPagesOutcome<TItem>) => {
    if (finished) return;
    finished = true;
    clearPending();
    if (outcome.status !== 'complete') {
      appLogger.warn(`[paged-list] ${options.label} ${outcome.status}: ${outcome.reason} - ${outcome.message}`, {
        pages: outcome.pages,
        items: outcome.items.length,
      });
    }
    onDone(outcome);
  };

  const stop = (reason: PagedListIncompleteReason, message: string) => {
    const collected = [...items.values()];
    if (pages === 0) {
      finish({ status: 'failed', items: collected, pages, reason, message });
      return;
    }
    finish({ status: 'partial', items: collected, total: lastTotal, pages, reason, message });
  };

  const requestAt = (offset: number) => {
    if (finished) return;
    let answered = false;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timer = undefined;
        if (answered) return;
        stop('timeout', `no response for offset ${offset} within ${timeoutMs} ms`);
      }, timeoutMs);
    }

    const result = requestPage({ ...baseRequest, offset, limit: pageSize }, (response) => {
      if (finished || answered) return;
      answered = true;
      clearPending();

      if (!response.success) {
        stop('page-failed', response.message?.trim() || 'list request failed');
        return;
      }
      const info = readPagedListPageInfo(response);
      if (!info) {
        stop('invalid-paging', 'success response is missing total, offset, limit or hasMore');
        return;
      }

      pages += 1;
      lastTotal = info.total;
      for (const item of options.readItems(response) ?? []) {
        items.set(options.getId(item), item);
      }

      if (!info.hasMore) {
        finish({ status: 'complete', items: [...items.values()], total: info.total, pages });
        return;
      }
      const nextOffset = info.offset + info.limit;
      if (nextOffset <= offset) {
        stop('no-progress', `next offset ${nextOffset} does not advance past ${offset}`);
        return;
      }
      if (pages >= maxPages) {
        stop('page-cap', `stopped after ${pages} pages with ${info.total - nextOffset} items remaining`);
        return;
      }
      requestAt(nextOffset);
    });
    if (!answered && !finished && typeof result === 'function') {
      unsubscribe = result;
    }
  };

  requestAt(Math.max(0, Math.floor(baseRequest.offset ?? 0)));

  return () => {
    finished = true;
    clearPending();
  };
}
