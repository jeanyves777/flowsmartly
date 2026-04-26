import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { OpenAIClient } from "@/lib/ai/openai-client";
import { uploadToS3 } from "@/lib/utils/s3-client";

/**
 * POST /api/studio/templates/generate
 *
 * Stage 1 of the template-discovery funnel — generates 8 low-quality
 * AI-rendered design prototypes from a search query OR returns the
 * cached batch if the same query was generated before.
 *
 * Architecture (see C:/Users/koffi/.claude/plans/keen-prancing-donut.md):
 *  - Hash normalized query → cache lookup against AiTemplate table
 *  - Cache hit: return cached rows · no credits charged
 *  - Cache miss: openai.images.generate(n=8, quality="low") · ~$0.09 ·
 *    upload PNGs to S3 · insert 8 AiTemplate rows · charge 10 credits
 *
 * Body: { query: string }
 * Returns: { templates: AiTemplate[], cached: boolean, creditsUsed: number, creditsRemaining: number }
 */
export async function POST(req: NextRequest) {
  try {
    // Allow x-admin-secret for server-to-server calls (cron pre-warm),
    // otherwise require a user session.
    const adminSecret = req.headers.get("x-admin-secret");
    const isServerCall = !!adminSecret && adminSecret === process.env.ADMIN_SECRET;

    const session = isServerCall ? null : await getSession();
    if (!isServerCall && !session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await req.json();

    // ─── drill_down mode ────────────────────────────────────────────
    // Burst 8 variations of ONE specific style the user already liked.
    // Cheaper-than-discovery in latency (single n=8 call) but same cost
    // (8 paid images). Cached by sha256(parentQuery + styleLabel) so a
    // second user clicking the same drill-down gets free results.
    if (body?.mode === "drill_down") {
      return handleDrillDown(req, body, isServerCall, session);
    }

    const rawQuery = String(body?.query || "").trim();
    // Empty/short query → return a sample of the most-recent unique
    // queries' templates so the modal isn't blank when the user opens
    // it. Acts as a "browse the library" mode.
    if (!rawQuery || rawQuery.length < 2) {
      const recent = await prisma.aiTemplate.findMany({
        where: { hideFromLibrary: false },
        orderBy: { createdAt: "desc" },
        take: 24,
      });
      return NextResponse.json({
        success: true,
        cached: true,
        library: true,
        templates: recent,
        creditsUsed: 0,
        creditsRemaining: null,
      });
    }
    // cacheOnly: true means PROBE — return cached if present, otherwise
    // 404 with code CACHE_MISS so the client can prompt the user to
    // explicitly opt into the credit charge before we generate.
    const cacheOnly = !!body?.cacheOnly;
    // forceRegenerate: skip the cache lookup entirely. Used when the user
    // hits "Generate fresh batch" to get NEW variations even though the
    // query already has cached results.
    const forceRegenerate = !!body?.forceRegenerate;

    // Normalize for cache key — lowercase + collapse whitespace. Two
    // users searching "Wedding Invitation" and "  wedding   invitation"
    // hit the same cache.
    const normalized = rawQuery.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    const queryHash = createHash("sha256").update(normalized).digest("hex");

    // ─── Cache lookup ────────────────────────────────────────────────
    // Skip the lookup when the user explicitly asked for a fresh batch.
    const cached = forceRegenerate
      ? []
      : await prisma.aiTemplate.findMany({
          where: { queryHash, hideFromLibrary: false },
          orderBy: { position: "asc" },
        });

    // We consider a batch "cached" if at least 4 thumbnails survived.
    // Below 4 means too many were hidden by moderation — regenerate
    // a fresh batch so the user has something to pick from.
    if (cached.length >= 4) {
      console.log(`[AiTemplates] cache HIT query="${normalized}" hash=${queryHash.slice(0, 8)} count=${cached.length}`);
      return NextResponse.json({
        success: true,
        cached: true,
        templates: cached,
        creditsUsed: 0,
        creditsRemaining: null,
      });
    }

    // Cache-only probe — caller doesn't want to spend credits unless
    // they explicitly confirm. Return a structured CACHE_MISS so the
    // client can show a Generate button.
    if (cacheOnly) {
      return NextResponse.json(
        { success: false, error: { code: "CACHE_MISS", message: "No cached templates for this query." } },
        { status: 404 },
      );
    }

    // ─── Cache miss → generate ───────────────────────────────────────
    const isAdmin = isServerCall || !!session?.adminId;
    const userId = session?.userId;

    const creditCost = await getDynamicCreditCost("AI_TEMPLATE_GENERATE");

    // Credit gate (skip for server / admin calls)
    if (!isAdmin && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true },
      });
      if (!user || user.aiCredits < creditCost) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INSUFFICIENT_CREDITS",
              message: `Generating templates costs ${creditCost} credits. You have ${user?.aiCredits ?? 0}.`,
              required: creditCost,
              available: user?.aiCredits ?? 0,
            },
          },
          { status: 402 },
        );
      }
    }

    console.log(`[AiTemplates] cache MISS query="${normalized}" hash=${queryHash.slice(0, 8)} — generating 8 thumbnails (8 styles)`);

    // We generate 8 SEPARATE images each with a DIFFERENT style prompt
    // rather than n=8 of the same prompt — n=8 in a single call returns
    // 8 variations of one aesthetic (all flat cartoon, all the same look)
    // which is what the user complained about. 8 parallel calls each
    // with a unique style modifier yields real variety: collage,
    // typographic, photographic, elegant, modern, vintage, corporate,
    // playful — same cost, same latency (parallel), much wider span.
    const openai = OpenAIClient.getInstance();
    const styledPrompts = STYLE_VARIANTS.map((variant) => ({
      style: variant.label,
      prompt: buildPrompt(rawQuery, variant),
    }));

    type Gen = { b64: string; style: string; prompt: string };
    const settled = await Promise.allSettled(
      styledPrompts.map((sp): Promise<Gen | null> =>
        openai
          .generateImagesBulk(sp.prompt, {
            n: 1,
            size: "1024x1024",
            quality: "low",
            transparent: false,
          })
          .then((arr) => (arr[0] ? { b64: arr[0], style: sp.style, prompt: sp.prompt } : null)),
      ),
    );

    const successes: Gen[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) successes.push(r.value);
    }

    if (successes.length === 0) {
      throw new Error("All 8 style generations failed");
    }
    console.log(`[AiTemplates] generated ${successes.length}/8 styled thumbnails`);

    // Upload + persist in parallel.
    const generationBatch = randomBytes(12).toString("hex");
    const inserted = await Promise.all(
      successes.map(async (s, i) => {
        const buf = Buffer.from(s.b64!, "base64");
        const key = `designs/ai-templates/${queryHash}/${generationBatch}-${i}.png`;
        const url = await uploadToS3(key, buf, "image/png");
        return prisma.aiTemplate.create({
          data: {
            queryHash,
            query: `${rawQuery.slice(0, 180)} · ${s.style}`,
            prompt: s.prompt,
            imageUrl: url,
            width: 1024,
            height: 1024,
            generationBatch,
            position: i,
            createdById: userId ?? null,
          },
        });
      }),
    );

    // Deduct credits transactionally for non-admin/non-server calls.
    let creditsRemaining: number | null = null;
    if (!isAdmin && userId) {
      const txn = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { aiCredits: { decrement: creditCost } },
          select: { aiCredits: true },
        }),
        prisma.creditTransaction.create({
          data: {
            userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter: 0,                // updated below — placeholder
            referenceType: "ai_template_generate",
            referenceId: generationBatch,
            description: `Template prototypes: "${rawQuery.slice(0, 80)}"`,
          },
        }),
      ]);
      creditsRemaining = txn[0].aiCredits;
      // Patch the placeholder balanceAfter we wrote above.
      await prisma.creditTransaction.updateMany({
        where: { referenceId: generationBatch, balanceAfter: 0 },
        data: { balanceAfter: creditsRemaining },
      });
    }

    await prisma.aIUsage.create({
      data: {
        userId: userId ?? null,
        adminId: session?.adminId ?? null,
        feature: "ai_template_generate",
        model: "gpt-image-1",
        inputTokens: 0,
        outputTokens: 0,
        costCents: Math.round(successes.length * 1.1), // ~$0.011/image low quality
      },
    });

    return NextResponse.json({
      success: true,
      cached: false,
      templates: inserted,
      creditsUsed: isAdmin ? 0 : creditCost,
      creditsRemaining,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generate failed";
    console.error("[AiTemplates] generate error:", err);
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 },
    );
  }
}

/**
 * 8 distinct visual styles we cycle through for each generation batch.
 * Picked to span the realistic range a user might want — a single search
 * for "happy birthday" should return one polaroid-photo card, one
 * elegant gold-foil card, one bold display-typography poster, one
 * vibrant balloons-and-confetti party flyer, etc.
 *
 * Each style describes both the AESTHETIC (color, typography, layout)
 * AND the COMPOSITIONAL ELEMENTS (photo placeholders, decorations,
 * frames). Heavy specificity beats vague modifiers like "modern".
 */
interface StyleVariant {
  label: string;
  modifier: string;
}

const STYLE_VARIANTS: StyleVariant[] = [
  {
    label: "Photo collage",
    modifier:
      "Polaroid-style photo collage layout — 2-3 framed photo PLACEHOLDER frames (slight tilt, white borders, soft drop shadow) overlapping a soft pastel background. Decorative ribbons or confetti scattered across the layout. Hand-lettered script headline + bold sans-serif name underneath. Multiple text levels: large headline, medium name, small footer line.",
  },
  {
    label: "Elegant gold-foil",
    modifier:
      "Premium luxury aesthetic — deep emerald or navy background with metallic gold foil typography, ornate decorative accents (laurel wreaths, geometric borders, thin gold rules dividing sections), a circular framed photo PLACEHOLDER at the top, polished serif fonts (Playfair / Cormorant). Hierarchy: small uppercase eyebrow line + giant elegant headline + scripture / quote line + small footer.",
  },
  {
    label: "Bold display typography",
    modifier:
      "Massive editorial display typography — the headline OWNS the frame, taking 60-70% of the canvas in oversized sans-serif (Anton, Bebas Neue feel). Strong contrasting background color blocks. Minimal decorative elements. Clear hierarchy: huge headline, medium subhead, small detail line. Magazine-cover energy.",
  },
  {
    label: "Vibrant party",
    modifier:
      "Vibrant celebratory party flyer — bright candy-colored background with realistic 3D balloons (gold and black, or pink and white), confetti scatter, gold curling streamers across the frame. Curved bold script headline + uppercase bold name + small celebratory tagline. Joyful, energetic, slight playful chaos.",
  },
  {
    label: "Modern minimalist",
    modifier:
      "Modern editorial minimalist — generous white/cream space, single thin accent color, refined typography hierarchy with serif display + clean sans body. One small geometric accent or a single thin gold rule. A small framed photo PLACEHOLDER off to one side with breathing room. Calm, sophisticated, gallery-like.",
  },
  {
    label: "Photographic full-bleed",
    modifier:
      "Cinematic full-bleed photographic background covering the entire canvas (a moody contextual scene appropriate for the topic — soft lighting, depth-of-field blur). Dark gradient overlay across the lower third. Bright headline typography reversed-out white over the dark gradient. Small subline + footer at the bottom. Movie-poster feel.",
  },
  {
    label: "Vintage retro",
    modifier:
      "Vintage retro design — warm cream / kraft paper background with subtle paper texture, distressed serif and slab-serif typography, decorative vintage ornaments (laurels, ribbons with deep red or burgundy fill, tiny stars), a sepia-toned framed photo PLACEHOLDER. Multiple text levels stacked centered. Editorial almanac vibe.",
  },
  {
    label: "Corporate clean",
    modifier:
      "Corporate professional clean layout — geometric grid, two-tone color palette anchored on a strong brand primary color, sans-serif typography (Inter / Montserrat feel), a left-aligned column of stacked text levels (eyebrow / headline / subhead / CTA pill / small footer), a rectangular photo PLACEHOLDER occupying the right half. Used for business / event / launch announcements.",
  },
];

/**
 * Build the gpt-image-1 prompt for a specific style variant. We
 * deliberately ASK FOR PHOTO PLACEHOLDERS (framed image regions the
 * user will later fill) rather than the AI inventing specific people,
 * because our downstream Recreate-as-Editable agent emits photo slots
 * the user fills themselves anyway.
 */
function buildPrompt(query: string, variant: StyleVariant): string {
  return [
    `Design a polished, print-ready ${query} flyer / poster / card template.`,
    `STYLE: ${variant.modifier}`,
    "QUALITY: balanced composition that fills the frame edge-to-edge, strong typographic hierarchy with multiple text levels (headline, subhead, body, footer), refined color palette, professional designer-quality finish.",
    "PHOTO PLACEHOLDERS: when the design calls for photos of people or products, include framed PHOTO PLACEHOLDER regions (clean rectangles or circles with subtle borders, possibly tilted polaroid-style) — do NOT generate specific human faces. Use light gray or soft pastel fill inside the placeholder.",
    "AVOID: thumbnails, alternate versions in a grid, labels, watermarks, surrounding white space, low-resolution feel, generic clipart aesthetic, lorem ipsum.",
    "INCLUDE: real-feeling text (headline + at least 2 supporting text levels), decorative accents appropriate to the style, full-bleed composition.",
  ].join("\n\n");
}

/**
 * "More like this" drill-down — generates 8 variations of ONE specific
 * style the user already saw and liked from the discovery batch. One
 * single n=8 API call (vs discovery's 8 parallel calls) — same cost,
 * marginally faster. Cached by parentQuery+styleLabel so a second user
 * who clicks the same drill-down gets free results.
 *
 * Body: { mode: "drill_down", parentQuery: string, styleLabel: string, forceRegenerate?: boolean }
 */
async function handleDrillDown(
  req: NextRequest,
  body: { parentQuery?: string; styleLabel?: string; forceRegenerate?: boolean },
  isServerCall: boolean,
  session: Awaited<ReturnType<typeof getSession>>,
) {
  void req;
  const parentQuery = String(body?.parentQuery || "").trim();
  const styleLabel = String(body?.styleLabel || "").trim();

  if (!parentQuery || !styleLabel) {
    return NextResponse.json(
      { success: false, error: { message: "drill_down requires parentQuery and styleLabel" } },
      { status: 400 },
    );
  }

  const variant = STYLE_VARIANTS.find((v) => v.label === styleLabel);
  if (!variant) {
    return NextResponse.json(
      { success: false, error: { message: `Unknown style label: ${styleLabel}` } },
      { status: 400 },
    );
  }

  // Cache key includes both query AND style — drill-down for "Photo
  // collage" is a different cache slot than discovery's "Photo collage"
  // entry (different generation count, different intent).
  const drillNorm = `${parentQuery.toLowerCase().replace(/\s+/g, " ").slice(0, 180)} :: ${styleLabel.toLowerCase()} :: drill`;
  const drillHash = createHash("sha256").update(drillNorm).digest("hex");

  const force = !!body?.forceRegenerate;
  const cached = force
    ? []
    : await prisma.aiTemplate.findMany({
        where: { queryHash: drillHash, hideFromLibrary: false },
        orderBy: { position: "asc" },
      });

  if (cached.length >= 4) {
    console.log(`[AiTemplates] drill_down cache HIT style="${styleLabel}" hash=${drillHash.slice(0, 8)}`);
    return NextResponse.json({
      success: true,
      cached: true,
      mode: "drill_down",
      templates: cached,
      creditsUsed: 0,
      creditsRemaining: null,
    });
  }

  const isAdmin = isServerCall || !!session?.adminId;
  const userId = session?.userId;
  const creditCost = await getDynamicCreditCost("AI_TEMPLATE_GENERATE");

  if (!isAdmin && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true },
    });
    if (!user || user.aiCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Generating 8 variations costs ${creditCost} credits. You have ${user?.aiCredits ?? 0}.`,
            required: creditCost,
            available: user?.aiCredits ?? 0,
          },
        },
        { status: 402 },
      );
    }
  }

  console.log(`[AiTemplates] drill_down cache MISS style="${styleLabel}" query="${parentQuery}" — generating n=8 variations`);

  const openai = OpenAIClient.getInstance();
  const prompt = buildPrompt(parentQuery, variant);
  const images = await openai.generateImagesBulk(prompt, {
    n: 8,
    size: "1024x1024",
    quality: "low",
    transparent: false,
  });

  if (images.length === 0) {
    throw new Error("Drill-down generation returned 0 images");
  }
  console.log(`[AiTemplates] drill_down produced ${images.length}/8 variations`);

  const generationBatch = randomBytes(12).toString("hex");
  const inserted = await Promise.all(
    images.map(async (b64, i) => {
      const buf = Buffer.from(b64, "base64");
      const key = `designs/ai-templates/${drillHash}/${generationBatch}-${i}.png`;
      const url = await uploadToS3(key, buf, "image/png");
      return prisma.aiTemplate.create({
        data: {
          queryHash: drillHash,
          query: `${parentQuery.slice(0, 160)} · ${styleLabel} (variation)`,
          prompt,
          imageUrl: url,
          width: 1024,
          height: 1024,
          generationBatch,
          position: i,
          createdById: userId ?? null,
        },
      });
    }),
  );

  let creditsRemaining: number | null = null;
  if (!isAdmin && userId) {
    const txn = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { aiCredits: { decrement: creditCost } },
        select: { aiCredits: true },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          type: "USAGE",
          amount: -creditCost,
          balanceAfter: 0,
          referenceType: "ai_template_drill_down",
          referenceId: generationBatch,
          description: `Template drill-down: "${parentQuery.slice(0, 60)}" · ${styleLabel}`,
        },
      }),
    ]);
    creditsRemaining = txn[0].aiCredits;
    await prisma.creditTransaction.updateMany({
      where: { referenceId: generationBatch, balanceAfter: 0 },
      data: { balanceAfter: creditsRemaining },
    });
  }

  await prisma.aIUsage.create({
    data: {
      userId: userId ?? null,
      adminId: session?.adminId ?? null,
      feature: "ai_template_drill_down",
      model: "gpt-image-1",
      inputTokens: 0,
      outputTokens: 0,
      costCents: Math.round(images.length * 1.1),
    },
  });

  return NextResponse.json({
    success: true,
    cached: false,
    mode: "drill_down",
    templates: inserted,
    creditsUsed: isAdmin ? 0 : creditCost,
    creditsRemaining,
  });
}
