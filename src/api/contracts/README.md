# API Contracts

Single source of truth for request/response shapes between backend route handlers and frontend consumers.

## Why this exists

Before this folder, each API route defined its response shape inline, and each page component redefined matching interfaces independently. Adding a field, renaming a column, or tightening a union type broke the frontend silently. This folder eliminates that drift.

## How to use it

### In a route handler (`src/app/api/**/route.ts`)

```ts
import type { ContactListResponse } from "@/api/contracts/contacts";
import type { ApiResponse } from "@/api/contracts/common";

export async function GET(): Promise<NextResponse> {
  const data: ContactListResponse = { contacts: [...], pagination, stats };
  return NextResponse.json<ApiResponse<ContactListResponse>>({ success: true, data });
}
```

### In a page / client component

```ts
import type { ContactListResponse } from "@/api/contracts/contacts";
import type { ApiResponse } from "@/api/contracts/common";

const res = await fetch("/api/v1/contacts");
const body: ApiResponse<ContactListResponse> = await res.json();
if (!body.success) throw new Error(body.error);
const { contacts, stats } = body.data;
```

## Rules

1. **Never redefine a shape** that already exists here — import it.
2. **Never return a shape that isn't in a contract file** from a route handler.
3. **Breaking changes require a new API version** (`/api/v2/...`) with its own contract file.
4. **Use ISO-8601 strings for dates** (`string`, not `Date`) — JSON cannot carry `Date`.
5. **Prefer discriminated unions over optional flags** when a response has two modes.

## Files

- `common.ts` — `ApiResponse<T>`, `Pagination`, `unwrap()`
- `contacts.ts` — `/api/contacts/*` endpoints
- (extend as new contracts land)
