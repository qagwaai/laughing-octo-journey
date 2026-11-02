import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllPages,
  type FetchAllPagesOutcome,
  type PagedListRequest,
  type PagedListResponse,
} from './paged-list-traversal';

interface Item {
  id: string;
}

interface Response extends PagedListResponse {
  items?: Item[];
}

type Request = PagedListRequest & { query: string };

function createServer(pages: Response[]) {
  const requests: Request[] = [];
  const pending: ((response: Response) => void)[] = [];
  const unsubscribes: ReturnType<typeof vi.fn>[] = [];
  let index = 0;
  const requester = (request: Request, onResponse: (response: Response) => void) => {
    requests.push(request);
    const page = pages[index++];
    const unsubscribe = vi.fn();
    unsubscribes.push(unsubscribe);
    if (page) {
      onResponse(page);
    } else {
      pending.push(onResponse);
    }
    return unsubscribe;
  };
  return { requester, requests, pending, unsubscribes };
}

const items = (...ids: string[]) => ids.map((id) => ({ id }));

function run(server: ReturnType<typeof createServer>, maxPages = 10, pageSize?: number) {
  const outcomes: FetchAllPagesOutcome<Item>[] = [];
  const cancel = fetchAllPages<Request, Response, Item>(
    server.requester,
    { query: 'q' },
    { label: 'test', readItems: (response) => response.items, getId: (item) => item.id, maxPages, pageSize },
    (outcome) => outcomes.push(outcome),
  );
  return { outcomes, cancel };
}

describe('fetchAllPages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('walks every page using the effective (clamped) limit and de-duplicates by id', () => {
    const server = createServer([
      { success: true, items: items('a', 'b'), total: 5, offset: 0, limit: 2, hasMore: true },
      { success: true, items: items('b', 'c'), total: 5, offset: 2, limit: 2, hasMore: true },
      { success: true, items: items('d'), total: 5, offset: 4, limit: 2, hasMore: false },
    ]);
    const { outcomes } = run(server, 10, 900);

    expect(server.requests.map((request) => [request.offset, request.limit, request.query])).toEqual([
      [0, 500, 'q'],
      [2, 500, 'q'],
      [4, 500, 'q'],
    ]);
    expect(outcomes).toEqual([{ status: 'complete', items: items('a', 'b', 'c', 'd'), total: 5, pages: 3 }]);
  });

  it('returns partial results when the page cap is reached', () => {
    const server = createServer([
      { success: true, items: items('a'), total: 3, offset: 0, limit: 1, hasMore: true },
      { success: true, items: items('b'), total: 3, offset: 1, limit: 1, hasMore: true },
    ]);
    const { outcomes } = run(server, 2);

    expect(server.requests).toHaveLength(2);
    expect(outcomes[0]).toMatchObject({ status: 'partial', reason: 'page-cap', items: items('a', 'b'), total: 3 });
  });

  it('fails on a first-page error and is partial on a later-page error', () => {
    const firstFails = createServer([{ success: false, message: 'sort must be one of: distance, name' }]);
    expect(run(firstFails).outcomes[0]).toMatchObject({
      status: 'failed',
      reason: 'page-failed',
      message: 'sort must be one of: distance, name',
    });

    const laterFails = createServer([
      { success: true, items: items('a'), total: 2, offset: 0, limit: 1, hasMore: true },
      { success: false, message: 'boom' },
    ]);
    expect(run(laterFails).outcomes[0]).toMatchObject({ status: 'partial', reason: 'page-failed', items: items('a') });
  });

  it('rejects success responses with missing paging metadata or a non-advancing offset', () => {
    const missing = createServer([{ success: true, items: items('a') }]);
    expect(run(missing).outcomes[0]).toMatchObject({ status: 'failed', reason: 'invalid-paging' });

    const stuck = createServer([
      { success: true, items: items('a'), total: 3, offset: 0, limit: 1, hasMore: true },
      { success: true, items: items('b'), total: 3, offset: 0, limit: 0, hasMore: true },
    ]);
    expect(run(stuck).outcomes[0]).toMatchObject({ status: 'partial', reason: 'invalid-paging' });
  });

  it('times out a page that never answers and unsubscribes it', () => {
    const server = createServer([{ success: true, items: items('a'), total: 2, offset: 0, limit: 1, hasMore: true }]);
    const { outcomes } = run(server);
    expect(outcomes).toHaveLength(0);

    vi.advanceTimersByTime(15_000);
    expect(outcomes[0]).toMatchObject({ status: 'partial', reason: 'timeout', items: items('a') });
    expect(server.unsubscribes[1]).toHaveBeenCalled();
  });

  it('never calls back after cancellation', () => {
    const server = createServer([]);
    const { outcomes, cancel } = run(server);
    cancel();
    server.pending[0]({ success: true, items: items('a'), total: 1, offset: 0, limit: 1, hasMore: false });
    vi.advanceTimersByTime(20_000);

    expect(outcomes).toHaveLength(0);
    expect(server.unsubscribes[0]).toHaveBeenCalled();
  });
});
