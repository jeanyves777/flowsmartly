import { prisma } from "@/lib/db/client";
import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { recordAiMemory } from "@/lib/ai-memory";

export interface GenerateCopyOptions {
  userId: string;
  automationId: string;
  /** ISO date string of the specific occurrence — gives the AI date context. */
  occurrenceAt?: string | null;
}

export interface GenerateCopyResult {
  caption: string;
  creditsSpent: number;
  balanceAfter: number | null;
}

function clean(raw: string, max = 600): string {
  return raw
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function captionHasHashtags(text: string): boolean {
  // True only when the caption ends with a recognizable hashtag block —
  // a stray "#1" inside body copy doesn't count.
  return /\n\s*#\w+(\s+#\w+){0,}\s*$/.test(text);
}

/**
 * Ask the AI for 3-5 brand-respecting hashtags. Used when the caption AI
 * forgot to include them or when caption generation itself fell back to
 * the brief verbatim. No regex / no hardcoded list — every tag is the
 * AI's call based on brand + brief.
 *
 * Returns [] only when the AI call itself fails (network / rate-limit).
 * Callers should still ship the post in that case — better an un-tagged
 * publish than a blocked one — but log loudly so we know.
 */
async function generateHashtagsForBrief(opts: {
  brief: string;
  brandLine: string;
  platforms: string[];
}): Promise<string[]> {
  const platformLine = opts.platforms.length
    ? `Posting to: ${opts.platforms.join(", ")}.`
    : "";
  const prompt = `Give me 3-5 hashtags for a social media post. Return ONLY the hashtags, space-separated, PascalCase with # prefix (e.g. "#MemorialDay #VeteranSupport #SmallBusinessLove"). No quotes, no preamble, no explanation.

${opts.brandLine ? `Brand context: ${opts.brandLine}\n` : ""}${platformLine ? `${platformLine}\n` : ""}
Pick tags that ACTUALLY apply to this post — proper nouns (event names, locations, brand name), niche/industry, and 1-2 broader-reach tags. Skip generic filler like #Marketing or #SmallBusiness unless they're the only relevant fit. Respect the brand voice and the post topic.

Post brief: ${opts.brief}`;

  try {
    const raw = await ai.generate(prompt, {
      model: HAIKU_MODEL,
      maxTokens: 80,
      temperature: 0.7,
      systemPrompt:
        "You generate concise, on-brand social media hashtags. Output hashtags only, space-separated, no preamble.",
    });
    const cleaned = raw
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .replace(/[\r\n]+/g, " ")
      .trim();
    const tags = Array.from(
      new Set(
        cleaned
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => /^#?[A-Za-z][A-Za-z0-9_]{1,29}$/.test(t))
          .map((t) => (t.startsWith("#") ? t : `#${t}`)),
      ),
    );
    return tags.slice(0, 5);
  } catch (err) {
    console.warn(
      "[automation-copy] hashtag AI call failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Generate fresh post copy for a single automation occurrence.
 *
 * Used by the scheduler when an automation's `copy` field is null (i.e. the
 * user picked "AI generates each fire" in the AddItem modal). The automation
 * row's `topic` / `aiPrompt` field is the BRIEF — this helper turns the brief
 * into actual post text that can be published verbatim.
 *
 * Charges AI_CAPTION credits AFTER success so failed generations cost nothing.
 * Returns the original brief on credit shortage or AI failure so the post
 * still fires with SOMETHING rather than nothing.
 */
export async function generateAutomationCopy(
  opts: GenerateCopyOptions,
): Promise<GenerateCopyResult> {
  const automation = await prisma.contentAutomation.findFirst({
    where: { id: opts.automationId, userId: opts.userId },
    select: {
      id: true,
      name: true,
      topic: true,
      aiPrompt: true,
      aiTone: true,
      hashtags: true,
      platforms: true,
      calendarSourceLabel: true,
    },
  });
  if (!automation) throw new Error("Automation not found");

  const brief =
    automation.aiPrompt ||
    automation.topic ||
    automation.calendarSourceLabel ||
    automation.name;
  // Load brand + platforms + user-defined hashtags upfront so every
  // return path (including early bailouts) can enforce hashtag presence
  // with brand-aware AI generation.
  let brandKit = await prisma.brandKit.findFirst({
    where: { userId: opts.userId, isDefault: true },
    select: { name: true, voiceTone: true, industry: true, description: true },
  });
  if (!brandKit) {
    brandKit = await prisma.brandKit.findFirst({
      where: { userId: opts.userId },
      select: { name: true, voiceTone: true, industry: true, description: true },
    });
  }
  let platforms: string[] = [];
  try {
    const parsed = JSON.parse(automation.platforms || "[]");
    if (Array.isArray(parsed)) platforms = parsed.filter((p) => typeof p === "string");
  } catch { /* default empty */ }
  let hashtagList: string[] = [];
  try {
    const parsed = JSON.parse(automation.hashtags || "[]");
    if (Array.isArray(parsed)) hashtagList = parsed.filter((h) => typeof h === "string");
  } catch { /* default empty */ }
  const brandLine = brandKit
    ? [
        brandKit.name ? `Brand: ${brandKit.name}` : "",
        brandKit.industry ? `Industry: ${brandKit.industry}` : "",
        brandKit.description ? `About: ${brandKit.description}` : "",
      ].filter(Boolean).join(" · ")
    : "";

  // Universal hashtag enforcer — applied by every return path.
  // 1. User-defined → respected verbatim (strip any AI block, replace).
  // 2. Else if caption already has them → keep.
  // 3. Else call AI hashtag generator (brand-aware, no regex).
  // 4. Else (AI also failed) → return un-tagged; logger warns.
  const enforceHashtags = async (caption: string): Promise<string> => {
    if (hashtagList.length > 0) {
      const stripped = caption.replace(/\n\s*#\w+(\s+#\w+){0,}\s*$/, "").trimEnd();
      const tagBlock = hashtagList
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .join(" ");
      return `${stripped}\n\n${tagBlock}`;
    }
    if (captionHasHashtags(caption)) return caption;
    const aiTags = await generateHashtagsForBrief({ brief, brandLine, platforms });
    if (aiTags.length === 0) {
      console.warn(
        "[automation-copy] ALL hashtag sources failed; post will ship without tags",
      );
      return caption;
    }
    return `${caption.trimEnd()}\n\n${aiTags.join(" ")}`;
  };

  // No brief, nothing to generate. Use the automation name + AI hashtags.
  if (!brief || !brief.trim()) {
    const c = await enforceHashtags(clean(automation.name));
    return { caption: c, creditsSpent: 0, balanceAfter: null };
  }

  // Credit gate BEFORE the AI call so a broke user doesn't burn tokens.
  // If the user can't pay, return the brief verbatim so the post still
  // fires — better than blocking publication entirely. Still enforce
  // hashtags via the secondary AI call (separate small cost).
  const costKey = "AI_CAPTION";
  const creditCost = await getDynamicCreditCost(costKey);
  const balance = await creditService.getBalance(opts.userId);
  if (balance < creditCost) {
    console.warn(
      `[automation-copy] insufficient credits (${balance}/${creditCost}); using brief verbatim`,
    );
    const c = await enforceHashtags(clean(brief));
    return { caption: c, creditsSpent: 0, balanceAfter: balance };
  }

  const tone = automation.aiTone || brandKit?.voiceTone || "friendly";
  const platformLine = platforms.length
    ? `Posting to: ${platforms.join(", ")}.`
    : "";
  const dateLine = opts.occurrenceAt
    ? `Posting date: ${new Date(opts.occurrenceAt).toISOString().slice(0, 10)}.`
    : "";

  // When the user provided their own hashtags we'll append them ourselves
  // below. Otherwise ask the model to include 3-5 relevant ones at the end
  // of the caption so the post doesn't ship hashtag-naked.
  const userProvidedHashtags = hashtagList.length > 0;
  const hashtagInstruction = userProvidedHashtags
    ? "No hashtag block — those will be appended separately."
    : "End with a SECOND line containing 3-5 relevant hashtags (PascalCase, # prefix, space-separated). Pick proper-noun phrases from the brief (event, brand, location) — not generic single-word splits.";

  const prompt = `You are writing a SINGLE ready-to-publish social media post caption. Output ONLY the caption — no preamble, no explanation, no quotes around it, no markdown headers, no labels like "Caption:".

${brandLine ? `${brandLine}\n` : ""}${platformLine ? `${platformLine}\n` : ""}${dateLine ? `${dateLine}\n` : ""}Tone: ${tone}.

Brief from the user — TRANSFORM this into actual post text. Do NOT echo it verbatim. Do NOT include phrases like "this post should…", "this post will…", "we want to…" — those are notes about the post, not the post itself.

Brief: ${brief}

Write the actual post: hook, value, light CTA. Keep the body under 220 characters total (Twitter-safe). One emoji max. ${hashtagInstruction}`;

  let captionRaw: string;
  try {
    captionRaw = await ai.generate(prompt, {
      model: HAIKU_MODEL,
      maxTokens: 400,
      temperature: 0.8,
      systemPrompt:
        "You are a concise social media copywriter. Return only the caption — no quotes, no preamble.",
    });
  } catch (err) {
    console.warn(
      "[automation-copy] AI generation failed; falling back to brief:",
      err instanceof Error ? err.message : err,
    );
    const c = await enforceHashtags(clean(brief));
    return { caption: c, creditsSpent: 0, balanceAfter: balance };
  }

  const caption = clean(captionRaw);
  if (!caption) {
    const c = await enforceHashtags(clean(brief));
    return { caption: c, creditsSpent: 0, balanceAfter: balance };
  }

  // Charge AFTER success.
  let balanceAfter: number | null = null;
  try {
    const deduction = await creditService.deductCredits({
      userId: opts.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `Auto-generate post caption`,
      referenceType: "ContentAutomation",
      referenceId: opts.automationId,
      metadata: { costKey, platforms, briefLength: brief.length },
    });
    balanceAfter = deduction.transaction?.balanceAfter ?? null;
    await prisma.contentAutomation.update({
      where: { id: opts.automationId },
      data: { totalCreditsSpent: { increment: creditCost } },
    });
  } catch (creditErr) {
    console.error("[automation-copy] credit deduction failed:", creditErr);
  }

  // Apply universal hashtag enforcer (AI-driven, brand-aware, no regex).
  const finalCaption = await enforceHashtags(caption);

  // Record into searchable AI memory (fire-and-forget).
  recordAiMemory({
    userId: opts.userId,
    kind: "caption-generation",
    summary: caption.slice(0, 160),
    content: { brief, caption: finalCaption, briefLength: brief.length, platforms },
    referenceType: "ContentAutomation",
    referenceId: opts.automationId,
  });

  return { caption: finalCaption, creditsSpent: creditCost, balanceAfter };
}
