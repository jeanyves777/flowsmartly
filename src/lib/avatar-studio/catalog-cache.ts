/**
 * HeyGen catalog cache — avatars / voices / templates.
 *
 * One HeyGen account (one API key) serves every user, so the catalog is global
 * data — yet each workspace open used to pay a live multi-second HeyGen
 * roundtrip. Cache it server-side for everyone instead.
 *
 * Two layers, mirroring media-policy.ts:
 *  - an in-memory copy per process (hot path, zero DB),
 *  - a SystemSetting row (existing table — deploy has no `prisma db push`),
 *    which survives pm2 reloads so even the first request after a deploy is
 *    served from cache.
 *
 * Stale-while-revalidate: once anything is cached, requests NEVER wait on
 * HeyGen — they get the cached list immediately and, past the TTL, a refresh
 * runs in the background. New stock avatars/looks therefore appear within a
 * TTL window, and clones created through our own upload flow appear right
 * away via bustAvatarCatalog().
 */

import { prisma } from "@/lib/db/client";
import { heygenClient, type HeyGenAvatar, type HeyGenVoice } from "@/lib/ai/heygen-client";

export type CatalogKind = "avatars" | "voices" | "templates";

export interface HeyGenTemplate { id: string; name: string; thumbnailUrl?: string }

const SETTING_KEY: Record<CatalogKind, string> = {
  avatars: "heygen_catalog_avatars",
  voices: "heygen_catalog_voices",
  templates: "heygen_catalog_templates",
};

/** How long a cached list counts as fresh. Refreshes happen in the background,
 *  so this is "how quickly changes made directly on HeyGen show up", not a wait. */
const TTL_MS = 10 * 60 * 1000;

interface Entry { items: unknown[]; fetchedAt: number }

const mem = new Map<CatalogKind, Entry>();
const inflight = new Map<CatalogKind, Promise<unknown[]>>();

/**
 * Monotonic counter bumped every time a clone is created (bustAvatarCatalog).
 * A refresh captures it at the moment its HeyGen request goes out; if it changes
 * before the request returns, that result predates the new clone and must not be
 * cached as fresh — the refresh re-fetches instead. This closes the race where a
 * bust lands on top of an already-in-flight (pre-clone) fetch. Avatars only.
 */
let avatarBustGen = 0;

async function fetchLive(kind: CatalogKind): Promise<unknown[]> {
  if (kind === "avatars") return heygenClient.listAvatars();
  if (kind === "voices") return heygenClient.listVoices();
  return heygenClient.listTemplates();
}

/**
 * Fetch from HeyGen and persist (memory + SystemSetting). Concurrent callers
 * share one flight via the `inflight` map. `force` skips the dedup — used by a
 * bust so it can never join a stale pre-clone flight.
 */
function refresh(kind: CatalogKind, force = false): Promise<unknown[]> {
  if (!force) {
    const existing = inflight.get(kind);
    if (existing) return existing;
  }
  const genAtStart = avatarBustGen;
  const p = (async () => {
    try {
      const items = await fetchLive(kind);
      // A clone was busted while this fetch was in flight → the result may
      // predate it. Don't stamp it fresh; fetch once more (un-deduped).
      if (kind === "avatars" && avatarBustGen !== genAtStart) {
        return await refresh("avatars", true);
      }
      // An empty list is indistinguishable from a HeyGen hiccup — never let it
      // clobber a good cache (the lib-level fallbacks handle the truly-empty case).
      if (items.length > 0) {
        mem.set(kind, { items, fetchedAt: Date.now() });
        try {
          const value = JSON.stringify({ fetchedAt: Date.now(), items });
          await prisma.systemSetting.upsert({
            where: { key: SETTING_KEY[kind] },
            update: { value, type: "json", category: "avatar_studio" },
            create: {
              key: SETTING_KEY[kind],
              value,
              type: "json",
              category: "avatar_studio",
              description: `Cached HeyGen ${kind} catalog (auto-refreshed, TTL ${TTL_MS / 60000}m)`,
            },
          });
        } catch (e) {
          console.error(`[avatar-catalog] persist ${kind} failed:`, e);
        }
      }
      return items;
    } finally {
      if (!force) inflight.delete(kind);
    }
  })();
  if (!force) inflight.set(kind, p);
  return p;
}

async function hydrateFromDb(kind: CatalogKind): Promise<Entry | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY[kind] } });
    if (!row) return null;
    const parsed = JSON.parse(row.value) as { fetchedAt?: number; items?: unknown[] };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    const entry: Entry = { items: parsed.items, fetchedAt: Number(parsed.fetchedAt) || 0 };
    // A concurrent refresh may have installed a fresher entry while we awaited the
    // DB read — don't overwrite it with this older row; return whichever is newer.
    const current = mem.get(kind);
    if (current && current.fetchedAt >= entry.fetchedAt) return current;
    mem.set(kind, entry);
    return entry;
  } catch {
    return null; // unreadable/legacy row — fall through to a live fetch
  }
}

/**
 * The cached catalog. Serves memory → DB → live HeyGen, refreshing stale
 * entries in the background so only the very first request ever waits.
 */
export async function getCatalog<T>(kind: CatalogKind): Promise<T[]> {
  const entry = mem.get(kind) ?? (await hydrateFromDb(kind));
  if (entry) {
    if (Date.now() - entry.fetchedAt > TTL_MS) {
      void refresh(kind).catch((e) => console.error(`[avatar-catalog] background refresh ${kind} failed:`, e));
    }
    return entry.items as T[];
  }
  return (await refresh(kind)) as T[];
}

export const getCachedAvatars = () => getCatalog<HeyGenAvatar>("avatars");
export const getCachedVoices = () => getCatalog<HeyGenVoice>("voices");
export const getCachedTemplates = () => getCatalog<HeyGenTemplate>("templates");

/**
 * Mark the avatar list stale and refresh it now (fire-and-forget) — called
 * after a clone/talking-photo is created through our flows so it shows up for
 * everyone without waiting out the TTL. `force` guarantees a fresh HeyGen fetch
 * that can't be deduped onto a pre-clone flight; the bumped generation makes any
 * such flight re-fetch when it lands. [[avatar-studio-heygen]]
 */
export function bustAvatarCatalog(): void {
  avatarBustGen++;
  const entry = mem.get("avatars");
  if (entry) entry.fetchedAt = 0;
  void refresh("avatars", true).catch((e) => console.error("[avatar-catalog] post-clone refresh failed:", e));
}
