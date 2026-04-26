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
    const rawQuery = String(body?.query || "").trim();
    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json(
        { success: false, error: { message: "query is required (min 2 chars)" } },
        { status: 400 },
      );
    }
    // cacheOnly: true means PROBE — return cached if present, otherwise
    // 404 with code CACHE_MISS so the client can prompt the user to
    // explicitly opt into the credit charge before we generate.
    const cacheOnly = !!body?.cacheOnly;

    // Normalize for cache key — lowercase + collapse whitespace. Two
    // users searching "Wedding Invitation" and "  wedding   invitation"
    // hit the same cache.
    const normalized = rawQuery.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    const queryHash = createHash("sha256").update(normalized).digest("hex");

    // ─── Cache lookup ────────────────────────────────────────────────
    const cached = await prisma.aiTemplate.findMany({
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

    console.log(`[AiTemplates] cache MISS query="${normalized}" hash=${queryHash.slice(0, 8)} — generating 8 thumbnails`);

    const prompt = buildPrompt(rawQuery);
    const openai = OpenAIClient.getInstance();
    const base64Images = await openai.generateImagesBulk(prompt, {
      n: 8,
      size: "1024x1024",
      quality: "low",
      transparent: false,
    });

    if (base64Images.length === 0) {
      throw new Error("OpenAI returned zero images");
    }

    // Upload + persist in parallel.
    const generationBatch = randomBytes(12).toString("hex");
    const inserted = await Promise.all(
      base64Images.map(async (b64, i) => {
        const buf = Buffer.from(b64, "base64");
        const key = `designs/ai-templates/${queryHash}/${generationBatch}-${i}.png`;
        const url = await uploadToS3(key, buf, "image/png");
        return prisma.aiTemplate.create({
          data: {
            queryHash,
            query: rawQuery.slice(0, 200),
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
        costCents: Math.round(base64Images.length * 1.1), // ~$0.011/image low quality
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
 * Build the gpt-image-1 prompt from a user search query. Bias toward
 * polished flat designs (flyer/poster/card aesthetic) since this is the
 * design-template discovery flow — users searching here want layouts,
 * not raw photography.
 */
function buildPrompt(query: string): string {
  return [
    `Design a clean, polished ${query} template.`,
    "Flat graphic-design aesthetic — like a flyer, poster, social-media post, or greeting card a professional designer would make.",
    "Balanced composition, readable typography that fills the frame, strong color hierarchy, decorative accents where appropriate.",
    "Single design only — no thumbnails, no alternate versions, no labels, no watermarks, no surrounding white space.",
    "Output should be ready to use as a marketing template the user can edit.",
  ].join(" ");
}
