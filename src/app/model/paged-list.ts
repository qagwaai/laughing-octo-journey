/**
 * Offset paging shared by `solar-system-list`, `star-list` and `celestial-body-list`.
 * Forge defaults `limit` to 100 and clamps it to 500; always advance by the
 * response's effective `limit`, never the requested one.
 */
export const PAGED_LIST_DEFAULT_LIMIT = 100;
export const PAGED_LIST_MAX_LIMIT = 500;

/** Required on success; failure responses may omit every field. */
export interface PagedListResponseMetadata {
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
}

export interface PagedListPageInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Returns validated paging metadata, or null when a success response omits or corrupts it. */
export function readPagedListPageInfo(response: PagedListResponseMetadata): PagedListPageInfo | null {
  const { total, offset, limit, hasMore } = response;
  if (!isNonNegativeInteger(total) || !isNonNegativeInteger(offset) || !isNonNegativeInteger(limit) || limit < 1) {
    return null;
  }
  if (typeof hasMore !== 'boolean') {
    return null;
  }
  return { total, offset, limit, hasMore };
}
