/**
 * Shared pagination parsing for the Tools APIs (follow-ups, surveys,
 * data-forms, events) and their sub-resources.
 *
 * Every list endpoint used to read `page`/`limit` straight from the query
 * string with `parseInt(... || "20")` and no upper bound — so a caller could
 * request `limit=999999` and force the DB to stream every row into memory.
 * `parsePagination` clamps both values to safe ranges and returns the
 * `skip`/`take` Prisma needs, so every endpoint behaves the same way.
 */

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Parse + clamp `page` and `limit` from a URLSearchParams.
 *
 * - `page`   → integer ≥ 1 (non-numeric / negative → 1)
 * - `limit`  → integer in [1, maxLimit] (default 20, hard cap 100)
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): Pagination {
  const { defaultLimit = 20, maxLimit = 100 } = options;

  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawLimit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Standard pagination metadata block returned to the client. */
export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
