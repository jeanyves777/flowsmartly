/**
 * Contracts for `/api/contacts/*`.
 *
 * Keep in sync with `src/app/api/contacts/route.ts`. When the route changes
 * shape, update this file first — both the route handler and the consuming
 * page should import from here, so TypeScript will catch drift immediately.
 */
import type { Pagination } from "./common";

export type ContactStatus = "active" | "unsubscribed" | "bounced" | "complained";

export interface ContactListRef {
  id: string;
  name: string;
}

export interface ContactResponse {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Computed display name; falls back to email or phone. */
  name: string;
  status: ContactStatus;
  emailOptedIn: boolean;
  smsOptedIn: boolean;
  /** MM-DD format or null. */
  birthday: string | null;
  imageUrl: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  tags: string[];
  lists: ContactListRef[];
  /** ISO-8601 string. */
  createdAt: string;
}

export interface ContactStats {
  total: number;
  active: number;
  unsubscribed: number;
  emailOptedIn: number;
  smsOptedIn: number;
}

/** Response body for GET /api/contacts */
export interface ContactListResponse {
  contacts: ContactResponse[];
  pagination: Pagination;
  stats: ContactStats;
}

/** Query params for GET /api/contacts */
export interface ContactListQuery {
  search?: string;
  status?: ContactStatus | "all";
  listId?: string;
  page?: number;
  limit?: number;
  sort?: "createdAt" | "firstName" | "lastName" | "email" | "status";
  order?: "asc" | "desc";
}

/** Request body for POST /api/contacts */
export interface CreateContactRequest {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  /** MM-DD format. */
  birthday?: string;
  imageUrl?: string;
  tags?: string[];
  listIds?: string[];
  emailOptedIn?: boolean;
  smsOptedIn?: boolean;
}

/** Response body for POST /api/contacts */
export interface CreateContactResponse {
  contact: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
  };
}
