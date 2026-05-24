import { prisma } from "@/lib/db/client";

export type AiMemoryKind =
  | "brand-snapshot"
  | "media-generation"
  | "caption-generation"
  | "media-analysis"
  | "chat-highlight"
  | "user-preference"
  | "post-publish";

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
