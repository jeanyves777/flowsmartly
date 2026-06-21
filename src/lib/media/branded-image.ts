import { prisma } from "@/lib/db/client";
import { runVisualForUser } from "@/app/api/ai/visual/route";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { verifyDesignText } from "@/lib/media/verify-design-text";
import {
  buildAgentDesignTemplatePrompt,
  chooseAgentDesignTemplate,
  getAgentDesignTemplateById,
  serializeAgentDesignTemplateForTool,
  type AgentDesignChannel,
  type AgentDesignTemplate,
} from "@/lib/ai/flow-agent/design-templates";

/**
 * generateBrandedImage — the ONE place that turns a creative brief + a user's
 * Brand Kit into a finished, on-brand image. Every branded-image surface
 * (Flow-AI's create_branded_design, content-automation pre-generate, the
 * scheduler, manual runs) calls this so they all share the SAME engine, prompt,
 * provider policy, logo composite, date handling, and anti-card composition —
 * instead of each maintaining its own divergent generator.
 *
 * It assembles the FlowCreative `/api/ai/visual` body (brand identity, colors,
 * logo, contact, optional agent design template) and delegates to
 * `runVisualForUser`, which does generation → logo composite → persistence.
 *
 * Billing: by default the engine charges AI_VISUAL_DESIGN. Pass
 * `skipCredits: true` when the CALLER bills itself (automation/scheduler charge
 * per-occurrence with their own bookkeeping) so it isn't double-charged.
 */
export type BrandedOrientation =
  | "square"
  | "portrait"
  | "story"
  | "reel"
  | "landscape"
  | "wide";

export interface GenerateBrandedImageInput {
  userId: string;
  isAdmin?: boolean;
  adminId?: string | null;
  /** The creative brief: headline/message, occasion, any EXACT text to include. */
  prompt: string;
  /** Maps to a canvas size; ignored if `size` is given. */
  orientation?: BrandedOrientation;
  /** Explicit "WxH" (e.g. "1080x1080"). Overrides `orientation`. */
  size?: string;
  tier?: "standard" | "premium";
  style?: string;
  /** Uploaded reference photos (real person/product) whose identity is preserved. */
  referenceImageUrls?: string[];
  ctaText?: string | null;
  /** Pin a specific agent design template; otherwise one is auto-chosen. */
  templateId?: string | null;
  category?: string;
  /** Caller handles billing — engine skips its own gate + deduction. */
  skipCredits?: boolean;
  /** Run the premium quality-review regeneration loop (3x cost when engine bills). */
  qualityCheck?: boolean;
  /**
   * Skip agent-template selection entirely → a clean full-bleed brand design
   * driven only by the brief + brand kit. Use for automation/social posts where
   * specific ticket/invite/card template layouts produce a card-on-a-surface.
   */
  skipTemplate?: boolean;
  /**
   * Feed the chosen template's IMAGE as a generation reference. Default false —
   * feeding it makes the engine clone the template's (often card) layout. The
   * template's TEXT guidance is still used when a template is selected.
   */
  useTemplateImage?: boolean;
  /**
   * Run the post-gen vision QA that rejects card-on-a-surface / garbled-text
   * output and regenerates once without a template. Default ON.
   */
  qaRegenerate?: boolean;
}

export interface GenerateBrandedImageResult {
  ok: boolean;
  imageUrl?: string;
  designId?: string;
  creditsUsed?: number;
  agentTemplate?: { id: string; name: string; industry: string; metaTags: string[] } | null;
  error?: string;
  errorCode?: string;
}

export async function generateBrandedImage(
  input: GenerateBrandedImageInput,
): Promise<GenerateBrandedImageResult> {
  const promptText = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!promptText) {
    return { ok: false, error: "prompt (the creative brief) is required.", errorCode: "missing_input" };
  }
  const tier: "standard" | "premium" = input.tier === "premium" ? "premium" : "standard";
  const referenceImageUrls = Array.isArray(input.referenceImageUrls)
    ? input.referenceImageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0).slice(0, 4)
    : [];

  const brandKit = await prisma.brandKit.findFirst({
    where: { userId: input.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  const languageTag = await getUserPreferredLanguage(input.userId);

  const colors = parseJson<Record<string, string> | null>(brandKit?.colors, null);
  const handles = parseJson<Record<string, string> | null>(brandKit?.handles, null);
  const brandLogo = brandKit?.logo || brandKit?.iconLogo || null;
  const hasBrandLogo = Boolean(brandLogo);

  const requestedTemplateId =
    typeof input.templateId === "string" && input.templateId.trim() ? input.templateId.trim() : null;
  const autoTemplate = input.skipTemplate
    ? null
    : chooseAgentDesignTemplate({
        industry: brandKit?.industry || brandKit?.niche || null,
        query: [promptText, input.style, input.ctaText].filter((i) => typeof i === "string" && i.trim()).join(" "),
        channel: orientationToTemplateChannel(input.orientation, promptText),
        limit: 1,
      });
  const agentTemplate = input.skipTemplate
    ? null
    : requestedTemplateId
      ? getAgentDesignTemplateById(requestedTemplateId)
      : autoTemplate;
  if (requestedTemplateId && !input.skipTemplate && !agentTemplate) {
    return {
      ok: false,
      error: `Agent design template "${requestedTemplateId}" was not found.`,
      errorCode: "not_found",
    };
  }

  const contactInfo = brandKit
    ? { email: brandKit.email, phone: brandKit.phone, website: brandKit.website, address: brandKit.address }
    : null;
  const contactLine = [brandKit?.phone, brandKit?.email, brandKit?.website, brandKit?.address]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join("  ·  ");

  const brandIdentityBase = brandKit
    ? {
        name: brandKit.name || null,
        tagline: brandKit.tagline || null,
        description: brandKit.description || null,
        industry: brandKit.industry || null,
        niche: brandKit.niche || null,
        audience: brandKit.targetAudience || null,
        voice: brandKit.voiceTone || null,
        value: brandKit.uniqueValue || null,
        products: parseJson<unknown[]>(brandKit.products, []),
        keywords: parseJson<unknown[]>(brandKit.keywords, []),
        hashtags: parseJson<unknown[]>(brandKit.hashtags, []),
        colors,
        handles,
        website: brandKit.website || null,
        email: brandKit.email || null,
        phone: brandKit.phone || null,
        address: brandKit.address || null,
        hasLogo: hasBrandLogo,
      }
    : null;

  // Same policy scaffolding the Studio Create modal uses so quality matches the
  // product page (logo lock + anti-invention + exact-reference handling).
  const logoPolicy = hasBrandLogo
    ? "Logo lock: do NOT draw, redraw, or invent any logo, wordmark, emblem, seal, crest, mascot, or monogram — the user's REAL logo is composited on afterward, SMALL, in one TOP corner. RESERVE a calm clear corner for it: keep the TOP-LEFT and TOP-RIGHT corners (about the top 16% of the height) free of headline text, faces, and key graphics — quiet background only — so the small logo drops in cleanly without covering anything. Do NOT add a placeholder box, frame, label, or watermark; just keep those corners uncluttered, and do NOT spell out the brand name as a wordmark."
    : "Do not invent a logo, icon, seal, crest, monogram, mascot, or brand mark the user did not provide. Use plain brand-name text only if the prompt asks for it.";
  const exactReferencePolicy = referenceImageUrls.length
    ? "Exact reference handling: the uploaded photo(s) are the REAL subject. Preserve the real person's face and identity exactly — do NOT synthesize a similar-looking or different person. Integrate them naturally into the design."
    : null;
  const brandDisplayPolicy = [
    !hasBrandLogo && brandKit?.name
      ? `Show the brand name "${brandKit.name}" as a clear, readable text header at the TOP of the design.`
      : null,
    contactLine
      ? `Include these REAL contact details in small, legible text near the bottom (copy them exactly, do not invent any): ${contactLine}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const antiInventionPolicy =
    "Content rule: render ONLY the messaging, names, dates, and visuals the user provided in the prompt, brand kit, or uploaded references. Do not invent extra products, people, prices, dates, claims, or testimonials.";

  const size = input.size && /^\d+x\d+$/.test(input.size) ? input.size : orientationToSize(input.orientation);
  const style = typeof input.style === "string" && input.style.trim() ? input.style.trim() : "modern";
  const ctaText = typeof input.ctaText === "string" && input.ctaText.trim() ? input.ctaText.trim() : null;

  // One generation attempt. `template` may be null → a clean full-bleed brand
  // design with no card/ticket layout. The template IMAGE is never fed as a
  // generation reference by default (feeding it made the engine clone card
  // layouts); only its TEXT guidance is used. `bill=false` skips engine credits
  // (used for the QA regeneration so it's never double-charged).
  const runAttempt = async (template: AgentDesignTemplate | null, bill: boolean) => {
    const imagePrompt = withLanguagePrefix(
      [
        promptText,
        template ? buildAgentDesignTemplatePrompt(template) : null,
        exactReferencePolicy,
        brandDisplayPolicy || null,
        logoPolicy,
        antiInventionPolicy,
        "Keep the final visual sharp, high-resolution, and readable.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      languageTag,
    );
    const brandIdentity = brandIdentityBase
      ? { ...brandIdentityBase, agentDesignTemplate: template ? compactAgentTemplateForPrompt(template) : null }
      : null;
    const visualBody = {
      prompt: imagePrompt,
      category: input.category || "social_post",
      size,
      style,
      tier,
      promptMode: "raw_brand",
      brandIdentity,
      channels: "selected social channels",
      heroType: "product",
      textMode: "creative",
      brandColors: colors,
      brandLogo,
      brandName: brandKit?.name || null,
      showBrandName: hasBrandLogo ? false : !!brandKit?.name,
      showSocialIcons: true,
      socialHandles: handles,
      contactInfo,
      referenceImageUrl: referenceImageUrls[0] || null,
      referenceImageUrls,
      templateImageUrl: (input.useTemplateImage && template?.imageUrl) || null,
      agentDesignTemplate: template ? serializeAgentDesignTemplateForTool(template) : null,
      compositeReferenceSubject: false,
      qualityCheckEnabled: input.qualityCheck === true,
      ctaText,
    };
    const result = await runVisualForUser(visualBody, {
      userId: input.userId,
      isAdmin: input.isAdmin === true,
      adminId: input.adminId ?? null,
      skipCredits: input.skipCredits === true || !bill,
    });
    const rb = result.body as {
      success?: boolean;
      data?: { design?: { id?: string; imageUrl?: string }; creditsUsed?: number };
      error?: { message?: string; code?: string };
    };
    if (result.status !== 200 || !rb.success || !rb.data?.design?.imageUrl) {
      return { ok: false as const, error: rb.error?.message || "The design could not be generated.", errorCode: rb.error?.code };
    }
    // Return the STABLE stored Design URL (never the response's expiring presigned one).
    const designId = rb.data.design.id;
    let imageUrl = rb.data.design.imageUrl;
    if (designId) {
      const row = await prisma.design.findUnique({ where: { id: designId }, select: { imageUrl: true } });
      if (row?.imageUrl) imageUrl = row.imageUrl;
    }
    return { ok: true as const, imageUrl, designId, creditsUsed: rb.data.creditsUsed };
  };

  let attempt = await runAttempt(agentTemplate, true);
  if (!attempt.ok) return { ok: false, error: attempt.error, errorCode: attempt.errorCode };

  // ── Post-gen QA — the structural safety net. Prompt rules alone don't stop
  // the model rendering a card-on-a-surface or garbling paragraph text, so we
  // vision-check the result and, if it failed, regenerate ONCE with NO template
  // (clean full-bleed). The retry is unbilled so it never double-charges.
  if (input.qaRegenerate !== false && attempt.ok && attempt.imageUrl) {
    try {
      const res = await fetch(await getPresignedUrl(attempt.imageUrl));
      const buf = Buffer.from(await res.arrayBuffer());
      const verdict = await verifyDesignText(buf, {}, { checkDesignQuality: true });
      if (verdict.cardOnSurface || verdict.garbledText) {
        console.warn(
          `[branded-image] QA rejected design (card=${verdict.cardOnSurface} garbled=${verdict.garbledText}) — regenerating without template`,
        );
        const retry = await runAttempt(null, false);
        if (retry.ok) attempt = retry;
      }
    } catch (qaErr) {
      console.warn("[branded-image] QA check skipped:", qaErr instanceof Error ? qaErr.message : qaErr);
    }
  }

  return {
    ok: true,
    imageUrl: attempt.imageUrl,
    designId: attempt.designId,
    creditsUsed: attempt.creditsUsed,
    agentTemplate: agentTemplate
      ? {
          id: agentTemplate.id,
          name: agentTemplate.name,
          industry: agentTemplate.industryLabel,
          metaTags: agentTemplate.metaTags,
        }
      : null,
  };
}

export function orientationToSize(orientation: unknown): string {
  const o = typeof orientation === "string" ? orientation.toLowerCase() : "";
  if (o === "portrait" || o === "story" || o === "reel" || o === "9:16") return "1080x1920";
  if (o === "landscape" || o === "wide" || o === "16:9") return "1920x1080";
  return "1080x1080";
}

function orientationToTemplateChannel(orientation: unknown, prompt: string): AgentDesignChannel {
  const o = typeof orientation === "string" ? orientation.toLowerCase() : "";
  const p = prompt.toLowerCase();
  if (o === "landscape" || o === "wide" || o === "16:9") return "ad";
  if (/\b(event|open house|webinar|workshop|conference|service|concert|invite|invitation|rsvp)\b/.test(p)) return "poster";
  if (o === "portrait" || o === "story" || o === "reel" || o === "9:16") return "flyer";
  return "social_post";
}

function compactAgentTemplateForPrompt(template: AgentDesignTemplate) {
  return {
    id: template.id,
    name: template.name,
    industry: template.industryLabel,
    useCase: template.useCase,
    metaTags: template.metaTags.slice(0, 12),
    layout: template.layout,
    imageDirection: template.imageDirection,
    copySlots: template.copySlots,
    ctaStyle: template.ctaStyle,
    imageUrl: template.imageUrl,
    thumbnailUrl: template.thumbnailUrl,
  };
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
