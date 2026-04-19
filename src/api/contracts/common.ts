/**
 * Shared API response primitives. Every endpoint should return one of these
 * envelopes — this is the bridge between backend route handlers and frontend
 * consumers, and the single source of truth for response shape.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * NOTE: Existing routes use the nested form `error: { message }`. New code
 * should match this shape so contracts and runtime agree. A future migration
 * can flatten to `error: string` once all routes are audited.
 */
export interface ApiError {
  success: false;
  error: { message: string; code?: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}

/**
 * Narrow an ApiResponse to its success payload. Throws on ApiError.
 * Use on the client side when you want to work directly with `data`.
 */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (res.success === true) return res.data;
  const err = (res as ApiError).error;
  throw new Error(err?.message ?? "API request failed");
}
