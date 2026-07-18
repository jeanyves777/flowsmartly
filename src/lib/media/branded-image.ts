import { prisma } from "@/lib/db/client";
import { runVisualForUser } from "@/app/api/ai/visual/route";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import { nameBrandColors } from "@/lib/media/color-names";

/**
 * generateBrandedImage — the ONE place that turns a creative brief + a user's
 * Brand Kit into a finished, on-brand image. Every branded-image surface
 * (Flow-AI's create_branded_design, content-automation pre-generate, the
 * scheduler, manual runs) calls this so they all share the SAME engine, prompt,
 * provider policy, logo composite, date handling, and anti-card composition.
 *
 * TEMPLATE-FREE: the new backend generates purely from the creative brief +
 * Brand Kit + the shared art-direction recipe on the fixed xAI@2K path — NO
 * design templates (they forced the edit chain / template reproduction and hurt
 * quality). It assembles the FlowCreative `/api/ai/visual` body and delegates to
 * `runVisualForUser` (generation → logo composite → persistence).
 * [[image-pipeline-providers]]
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
  category?: string;
  /** Caller handles billing — engine skips its own gate + deduction. */
  skipCredits?: boolean;
  /** Run the premium quality-review regeneration loop (3x cost when engine bills). */
  qualityCheck?: boolean;
}

export interface GenerateBrandedImageResult {
  ok: boolean;
  imageUrl?: string;
  designId?: string;
  creditsUsed?: number;
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

  // Describe the palette with human color NAMES, never raw hex — xAI renders a
  // hex string literally as visible text (the "#a441e8" leak). The real hex is
  // still passed to the engine separately for accurate on-brand coloring.
  const colorNames = await nameBrandColors({ primary: colors?.primary, secondary: colors?.secondary, accent: colors?.accent });
  const palette = [
    colorNames.primary ? `primary ${colorNames.primary}` : null,
    colorNames.secondary ? `secondary ${colorNames.secondary}` : null,
    colorNames.accent ? `accent ${colorNames.accent}` : null,
  ].filter(Boolean).join(", ") || undefined;

  const contactInfo = brandKit
    ? { email: brandKit.email, phone: brandKit.phone, website: brandKit.website, address: brandKit.address }
    : null;
  const contactLine = [brandKit?.phone, brandKit?.email, brandKit?.website, brandKit?.address]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join("  ·  ");

  const brandIdentity = brandKit
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
        // hashtags are DELIBERATELY omitted — they belong in the social CAPTION,
        // never rendered on the image. (They used to leak in via this serialized
        // brand-identity JSON and print as literal "#Tag" text on the design.)
        // NOTE: color NAMES only (no raw hex) so the model can't render the hex
        // as literal text on the design. Real hex still flows via visualBody.brandColors.
        palette,
        handles,
        website: brandKit.website || null,
        email: brandKit.email || null,
        phone: brandKit.phone || null,
        address: brandKit.address || null,
        hasLogo: hasBrandLogo,
      }
    : null;

  // NOTE: logo-lock, full-bleed, typography, and single-logo rules are NO LONGER
  // repeated here — they come from the shared art-direction recipe
  // (buildArtDirection) applied in the pipeline. Duplicating them blew the prompt
  // past xAI's 8000-char limit, silently dropping Standard from xAI to a fallback
  // model. Keep THIS prompt to the creative brief + brand facts only.
  // [[image-pipeline-providers]]
  const exactReferencePolicy = referenceImageUrls.length
    ? "The uploaded photo(s) are the REAL subject — preserve the real person's face/identity exactly (no lookalike) and integrate them naturally."
    : null;
  const brandNameHeader = !hasBrandLogo && brandKit?.name
    ? `Show the brand name "${brandKit.name}" as a clear header at the top.`
    : null;
  const contactRule = contactLine
    ? `Include these REAL contact details, copied exactly (never invent), as a DESIGNED, on-brand contact treatment that suits this design — vary it (a footer bar, an icon-chip row, a rounded contact panel, or a slim pill; small icons/dividers, legible), not a bare line: ${contactLine}.`
    : null;
  const antiInventionPolicy =
    "Render ONLY the messaging, names, dates, and visuals provided. Do not invent products, people, prices, dates, claims, or testimonials. Do NOT render any hashtags (#…) anywhere on the image. NO YEAR OR DATE unless the brief above explicitly includes one: do not add a year, a \"Season 20XX\" / \"Tax Season 20XX\" badge, a copyright line, or any date stamp on your own — by default the design shows NO year at all.";

  const imagePrompt = withLanguagePrefix(
    [
      promptText,
      exactReferencePolicy,
      brandNameHeader,
      contactRule,
      antiInventionPolicy,
    ]
      .filter(Boolean)
      .join("\n\n"),
    languageTag,
  );

  const size = input.size && /^\d+x\d+$/.test(input.size) ? input.size : orientationToSize(input.orientation);
  const style = typeof input.style === "string" && input.style.trim() ? input.style.trim() : "modern";
  const ctaText = typeof input.ctaText === "string" && input.ctaText.trim() ? input.ctaText.trim() : null;

  // /api/ai/visual body — raw_brand pipeline, reference handling, logo overlay.
  // TEMPLATE-FREE: no templateImageUrl / agentDesignTemplate. The provider is
  // chosen by the role-based media-model policy (xAI grok-imagine @2K for
  // Standard), so we deliberately do NOT pass a provider/strictProvider knob.
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
    templateImageUrl: null,
    compositeReferenceSubject: false,
    qualityCheckEnabled: input.qualityCheck === true,
    ctaText,
  };

  const result = await runVisualForUser(visualBody, {
    userId: input.userId,
    isAdmin: input.isAdmin === true,
    adminId: input.adminId ?? null,
    skipCredits: input.skipCredits === true,
  });

  const resBody = result.body as {
    success?: boolean;
    data?: { design?: { id?: string; imageUrl?: string }; creditsUsed?: number };
    error?: { message?: string; code?: string };
  };
  if (result.status !== 200 || !resBody.success || !resBody.data?.design?.imageUrl) {
    return {
      ok: false,
      error: resBody.error?.message || "The design could not be generated.",
      errorCode: resBody.error?.code,
    };
  }

  // The engine response presigns the URL (short-lived). Callers persist this on
  // posts that fire later / show in the media library, so return the STABLE
  // stored URL from the Design row instead — never an expiring presigned link.
  const designId = resBody.data.design.id;
  let imageUrl = resBody.data.design.imageUrl;
  if (designId) {
    const row = await prisma.design.findUnique({ where: { id: designId }, select: { imageUrl: true } });
    if (row?.imageUrl) imageUrl = row.imageUrl;
  }

  return {
    ok: true,
    imageUrl,
    designId,
    creditsUsed: resBody.data.creditsUsed,
  };
}

export function orientationToSize(orientation: unknown): string {
  const o = typeof orientation === "string" ? orientation.toLowerCase() : "";
  // Story / Reel — full phone-tall 9:16. The ONLY 9:16 case: a flyer/poster is
  // NOT this tall (that's what made "flyer" designs look stretched).
  if (o === "story" || o === "reel" || o === "9:16" || o === "tall") return "1080x1920";
  // Flyer / poster — A4-style portrait (3:4 ≈ 0.75), the real print-flyer proportion.
  if (o === "flyer" || o === "poster" || o === "3:4" || o === "a4") return "1080x1440";
  // Portrait social post — 4:5 (Instagram portrait).
  if (o === "portrait" || o === "4:5") return "1080x1350";
  // Landscape / wide — 16:9.
  if (o === "landscape" || o === "wide" || o === "16:9") return "1920x1080";
  // Default — square feed post (1:1).
  return "1080x1080";
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
