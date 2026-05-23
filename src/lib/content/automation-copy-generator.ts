import { prisma } from "@/lib/db/client";
import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

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
  // No brief, nothing to generate. Caller will fall back to topic/name.
  if (!brief || !brief.trim()) {
    return { caption: automation.name, creditsSpent: 0, balanceAfter: null };
  }

  // Credit gate BEFORE the AI call so a broke user doesn't burn tokens.
  // If the user can't pay, return the brief verbatim so the post still
  // fires — better than blocking publication entirely.
  const costKey = "AI_CAPTION";
  const creditCost = await getDynamicCreditCost(costKey);
  const balance = await creditService.getBalance(opts.userId);
  if (balance < creditCost) {
    console.warn(
      `[automation-copy] insufficient credits (${balance}/${creditCost}); using brief verbatim`,
    );
    return { caption: clean(brief), creditsSpent: 0, balanceAfter: balance };
  }

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

  const tone = automation.aiTone || brandKit?.voiceTone || "friendly";
  const platformLine = platforms.length
    ? `Posting to: ${platforms.join(", ")}.`
    : "";
  const dateLine = opts.occurrenceAt
    ? `Posting date: ${new Date(opts.occurrenceAt).toISOString().slice(0, 10)}.`
    : "";

  const prompt = `You are writing a SINGLE ready-to-publish social media post caption. Output ONLY the caption — no preamble, no explanation, no quotes around it, no markdown headers, no labels like "Caption:".

${brandLine ? `${brandLine}\n` : ""}${platformLine ? `${platformLine}\n` : ""}${dateLine ? `${dateLine}\n` : ""}Tone: ${tone}.

Brief from the user — TRANSFORM this into actual post text. Do NOT echo it verbatim. Do NOT include phrases like "this post should…", "this post will…", "we want to…" — those are notes about the post, not the post itself.

Brief: ${brief}

Write the actual post: hook, value, light CTA. Keep it under 220 characters total (Twitter-safe). One emoji max. No hashtag block — those will be appended separately.`;

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
    return { caption: clean(brief), creditsSpent: 0, balanceAfter: balance };
  }

  const caption = clean(captionRaw);
  if (!caption) {
    return { caption: clean(brief), creditsSpent: 0, balanceAfter: balance };
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

  // Append hashtags if present (separated by a blank line so platforms that
  // strip them don't dirty the main caption).
  let finalCaption = caption;
  if (hashtagList.length) {
    const hashtagBlock = hashtagList
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    finalCaption = `${caption}\n\n${hashtagBlock}`;
  }

  return { caption: finalCaption, creditsSpent: creditCost, balanceAfter };
}
