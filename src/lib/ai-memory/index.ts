import { prisma } from "@/lib/db/client";

export type AiMemoryKind =
  | "brand-snapshot"
  | "media-generation"
  | "caption-generation"
  | "media-analysis"
  | "chat-highlight"
  | "user-preference"
  | "post-publish"
  /** A durable fact/pattern the agent identified and logged about the user/brand. */
  | "agent-note";

export interface RecordAiMemoryInput {
  userId: string;
  kind: AiMemoryKind;
  /** Short, searchable one-liner. Required — this is what context lookups search. */
  summary: string;
  /** Full payload — anything that's useful when this memory is recalled. */
  content?: Record<string, unknown>;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  referenceType?: string | null;
  referenceId?: string | null;
  /** Brand snapshots are auto-pinned. Other kinds can request pinning when load-bearing. */
  pinned?: boolean;
}

/**
 * Capture an AI use / creation into the user's searchable memory layer.
 * Fire-and-forget by design — callers should not await this. Failures are
 * logged but never propagate (memory loss never blocks generation).
 *
 * Auto-pins brand-snapshot kind so brand identity always surfaces first.
 */
export function recordAiMemory(input: RecordAiMemoryInput): void {
  const autoPin = input.pinned ?? input.kind === "brand-snapshot";
  prisma.userAiMemory
    .create({
      data: {
        userId: input.userId,
        kind: input.kind,
        summary: input.summary.slice(0, 240),
        content: JSON.stringify(input.content ?? {}),
        mediaUrl: input.mediaUrl ?? null,
        mediaType: input.mediaType ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        pinned: autoPin,
      },
    })
    .catch((err) => {
      console.warn(
        "[ai-memory] record failed (non-blocking):",
        err instanceof Error ? err.message : err,
      );
    });
}

/**
 * Awaited variant of recordAiMemory — used by the Flow-AI `remember` tool
 * which needs to confirm the save landed (and return its id) rather than
 * fire-and-forget. Never throws: returns null on failure so a memory write
 * can't break the agent loop (see feedback-no-stuck-ai-chat).
 */
export async function saveUserMemory(input: RecordAiMemoryInput): Promise<{ id: string } | null> {
  try {
    const autoPin = input.pinned ?? input.kind === "brand-snapshot";
    const row = await prisma.userAiMemory.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        summary: input.summary.slice(0, 240),
        content: JSON.stringify(input.content ?? {}),
        mediaUrl: input.mediaUrl ?? null,
        mediaType: input.mediaType ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        pinned: autoPin,
      },
      select: { id: true },
    });
    return row;
  } catch (err) {
    console.warn("[ai-memory] saveUserMemory failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface MemoryMatch {
  id: string;
  kind: string;
  summary: string;
  content: string;
  mediaUrl: string | null;
  referenceType: string | null;
  referenceId: string | null;
  pinned: boolean;
  createdAt: string;
}

/**
 * Keyword search over a user's memory log — powers the Flow-AI `recall`
 * tool so the agent can look up older facts/work/patterns not already in
 * the per-turn loadUserContext slice (e.g. "what did we decide about the
 * logo placement", "the customer's name from last week").
 *
 * Dialect-safe: we fetch a bounded recent window and rank in JS by token
 * overlap rather than relying on Prisma `mode: "insensitive"` (Postgres-only,
 * absent on the local SQLite). Cheap — a user's memory log is small and the
 * window is capped. Never throws.
 */
export async function searchUserMemories(
  userId: string,
  query: string,
  limit = 8,
): Promise<MemoryMatch[]> {
  try {
    const q = (query ?? "").trim().toLowerCase();
    const rows = await prisma.userAiMemory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        kind: true,
        summary: true,
        content: true,
        mediaUrl: true,
        referenceType: true,
        referenceId: true,
        pinned: true,
        createdAt: true,
      },
    });
    const tokens = q.split(/\s+/).filter((t) => t.length > 1);
    const scored = rows
      .map((r) => {
        const hay = `${r.summary} ${r.content} ${r.kind}`.toLowerCase();
        // No query → return most recent. Otherwise score by token hits.
        const score = tokens.length === 0 ? 1 : tokens.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
        return { r, score };
      })
      .filter((x) => x.score > 0)
      // Pinned + more-recent break ties, but token score leads.
      .sort((a, b) => b.score - a.score || (b.r.pinned ? 1 : 0) - (a.r.pinned ? 1 : 0))
      .slice(0, Math.max(1, Math.min(limit, 25)));
    return scored.map(({ r }) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  } catch (err) {
    console.warn("[ai-memory] searchUserMemories failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export interface UserContextSnapshot {
  brand: {
    name: string | null;
    description: string | null;
    voiceTone: string | null;
    industry: string | null;
    colors: { primary: string | null; secondary: string | null; accent: string | null };
    website: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  pinnedMemories: Array<{
    id: string;
    kind: string;
    summary: string;
    mediaUrl: string | null;
    createdAt: string;
  }>;
  recentMemories: Array<{
    id: string;
    kind: string;
    summary: string;
    mediaUrl: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: string;
  }>;
}

interface LoadContextOpts {
  /** How many non-pinned recent memories to surface. Default 8. */
  recentLimit?: number;
  /** Filter recent memories to these kinds. Default: all. */
  kinds?: AiMemoryKind[];
}

/**
 * Load the user's primary context for any AI call. Returns:
 *   - The user's default BrandKit (or first found) — primary identity.
 *   - All pinned memories (brand snapshots + load-bearing decisions).
 *   - The most recent N memories (default 8) of the requested kinds.
 *
 * Designed to be cheap enough to call on every FlowAI message / chat
 * turn / generation. Two queries total when memories exist.
 */
export async function loadUserContext(
  userId: string,
  opts: LoadContextOpts = {},
): Promise<UserContextSnapshot> {
  const recentLimit = Math.max(0, Math.min(opts.recentLimit ?? 8, 50));

  const [kit, pinned, recent] = await Promise.all([
    prisma.brandKit.findFirst({
      where: { userId, isDefault: true },
      select: {
        name: true,
        description: true,
        voiceTone: true,
        industry: true,
        colors: true,
        website: true,
        email: true,
        phone: true,
      },
    }) ?? null,
    prisma.userAiMemory.findMany({
      where: { userId, pinned: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, kind: true, summary: true, mediaUrl: true, createdAt: true },
    }),
    prisma.userAiMemory.findMany({
      where: {
        userId,
        pinned: false,
        ...(opts.kinds && opts.kinds.length > 0 ? { kind: { in: opts.kinds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      select: {
        id: true,
        kind: true,
        summary: true,
        mediaUrl: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
    }),
  ]);

  const brandKit =
    kit ??
    (await prisma.brandKit.findFirst({
      where: { userId },
      select: {
        name: true,
        description: true,
        voiceTone: true,
        industry: true,
        colors: true,
        website: true,
        email: true,
        phone: true,
      },
    }));

  type BrandColors = { primary?: string; secondary?: string; accent?: string };
  const colors: BrandColors = (() => {
    try {
      return JSON.parse(brandKit?.colors || "{}") as BrandColors;
    } catch {
      return {};
    }
  })();

  return {
    brand: brandKit
      ? {
          name: brandKit.name,
          description: brandKit.description,
          voiceTone: brandKit.voiceTone,
          industry: brandKit.industry,
          colors: {
            primary: colors.primary ?? null,
            secondary: colors.secondary ?? null,
            accent: colors.accent ?? null,
          },
          website: brandKit.website,
          email: brandKit.email,
          phone: brandKit.phone,
        }
      : null,
    pinnedMemories: pinned.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    recentMemories: recent.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/**
 * Render the user's context as a compact system-prompt prelude that any
 * AI call can prepend to ground the model in the user's brand + recent
 * work. Skips empty sections so we don't waste tokens.
 */
export function renderContextForPrompt(ctx: UserContextSnapshot): string {
  const parts: string[] = [];
  if (ctx.brand) {
    const b = ctx.brand;
    const lines = [
      b.name ? `Brand: ${b.name}` : "",
      b.description ? `About: ${b.description}` : "",
      b.industry ? `Industry: ${b.industry}` : "",
      b.voiceTone ? `Voice: ${b.voiceTone}` : "",
      b.colors.primary || b.colors.secondary || b.colors.accent
        ? `Colors: primary ${b.colors.primary || "n/a"}, secondary ${b.colors.secondary || "n/a"}, accent ${b.colors.accent || "n/a"}`
        : "",
      b.website ? `Website: ${b.website}` : "",
      b.email ? `Email: ${b.email}` : "",
      b.phone ? `Phone: ${b.phone}` : "",
    ].filter(Boolean);
    if (lines.length) parts.push(`User brand:\n${lines.join("\n")}`);
  }
  if (ctx.pinnedMemories.length) {
    parts.push(
      `Pinned context:\n${ctx.pinnedMemories.map((m) => `- [${m.kind}] ${m.summary}`).join("\n")}`,
    );
  }
  if (ctx.recentMemories.length) {
    parts.push(
      `Recent work:\n${ctx.recentMemories.map((m) => `- [${m.kind}] ${m.summary}`).join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

/**
 * Render ONLY the memory log (pinned facts/patterns + recent work) for the
 * Flow-AI agent's system prompt. Brand identity is rendered separately by
 * the agent prompt, so we skip it here to avoid duplication / token waste.
 * Returns "" when there's nothing worth injecting.
 */
export function renderAgentMemory(ctx: UserContextSnapshot): string {
  const parts: string[] = [];
  if (ctx.pinnedMemories.length) {
    parts.push(
      `Known facts & patterns (pinned — these persist across all conversations):\n${ctx.pinnedMemories
        .map((m) => `- [${m.kind}] ${m.summary}`)
        .join("\n")}`,
    );
  }
  if (ctx.recentMemories.length) {
    parts.push(
      `Recent work & highlights (most recent first):\n${ctx.recentMemories
        .map((m) => `- [${m.kind}] ${m.summary}`)
        .join("\n")}`,
    );
  }
  return parts.join("\n\n");
}
