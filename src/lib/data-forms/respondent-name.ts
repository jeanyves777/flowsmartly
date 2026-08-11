/**
 * Name handling for the public respondent lookup.
 *
 * A name is never a credential here — it only selects which contact gets sent a
 * one-time code. It still must be matched exactly rather than by prefix, and
 * over-long input is REJECTED rather than truncated: silently dropping words
 * past the fifth changes the identity being checked, so a caller could append
 * arbitrary trailing words and still match, while a legitimate six-word name
 * could never match as typed.
 */

export const MAX_NAME_TOKENS = 5;
export const MAX_NAME_LENGTH = 120;
export const MIN_NAME_LENGTH = 3;

export type NameParse =
  | { ok: true; tokens: string[]; fullName: string }
  | { ok: false; reason: "too_short" | "too_long" | "too_many_words" };

export function parseRespondentName(raw: unknown): NameParse {
  const text = typeof raw === "string" ? raw.trim() : "";

  if (text.length > MAX_NAME_LENGTH) return { ok: false, reason: "too_long" };

  const tokens = text.split(/\s+/).filter(Boolean);
  const fullName = tokens.join(" ");

  if (fullName.length < MIN_NAME_LENGTH) return { ok: false, reason: "too_short" };
  if (tokens.length > MAX_NAME_TOKENS) return { ok: false, reason: "too_many_words" };

  return { ok: true, tokens, fullName };
}

/**
 * Every way the typed name could be split across the stored firstName/lastName
 * columns, as exact case-insensitive equality. Names are stored inconsistently
 * (imports often put the whole name in firstName), so each division is tried.
 *
 * The `unknown[]` return keeps the caller's Prisma `where` loosely typed, which
 * the repo already does for `mode: "insensitive"` so it type-checks against the
 * local SQLite client while staying correct on Postgres.
 */
export function exactNameClauses(tokens: string[]): unknown[] {
  const fullName = tokens.join(" ");
  const clauses: unknown[] = [
    {
      firstName: { equals: fullName, mode: "insensitive" },
      OR: [{ lastName: null }, { lastName: "" }],
    },
  ];
  for (let i = 1; i < tokens.length; i++) {
    clauses.push({
      firstName: { equals: tokens.slice(0, i).join(" "), mode: "insensitive" },
      lastName: { equals: tokens.slice(i).join(" "), mode: "insensitive" },
    });
  }
  return clauses;
}
