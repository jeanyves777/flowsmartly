import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { runVisualForUser } from "@/app/api/ai/visual/route";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import {
  buildAgentDesignTemplatePrompt,
  chooseAgentDesignTemplate,
  getAgentDesignTemplateById,
  serializeAgentDesignTemplateForTool,
  type AgentDesignChannel,
  type AgentDesignTemplate,
} from "../design-templates";

/**
 * create_branded_design — the agent's PRIMARY image tool for anything
 * branded or marketing-grade: ads, flyers, birthday/holiday cards,
 * announcements, product shots, social creatives. It drives the SAME
 * robust FlowCreative pipeline the Studio's Create modal uses
 * (`/api/ai/visual` → runVisualForUser): brand-aware prompt, real brand
 * colors + logo composite, reference-photo IDENTITY PRESERVATION, and (on
 * Premium) the quality-review loop that regenerates until the design
 * passes and the uploaded person's real face is kept.
 *
 * This is NOT a reimplementation — it reuses the production visual engine
 * so we don't re-tune generation. Use plain generate_image only for raw,
 * unbranded concept art.
 *
 * Tier → cost: Standard = AI_VISUAL_DESIGN (15), Premium = 3× (45, quality
 * loop). The pipeline charges credits itself; this tool does not.
 */
export const createBrandedDesign: FlowAgentTool = {
  name: "create_branded_design",
  description:
    "Create a polished, ON-BRAND image via the platform's FlowCreative engine (the SAME engine the Studio Create modal uses) — use this for ANY branded or marketing visual: ads, flyers, birthday/holiday cards, announcements, product images, social posts. It automatically applies the user's brand colors, composites their REAL logo, and — when reference photos are supplied — PRESERVES the real person's/product's identity (never invents a lookalike). If the user uploaded a photo of a person/product, you MUST pass its URL in referenceImageUrls — otherwise the engine generates a stranger. Tiers differ in engine quality (Premium = sharper text/detail); always ask which they want and read the exact live prices from list_my_features (admin-set, from the DB) — never hardcode. Keep the prompt focused on the user's actual request; don't pile on brand-tone adjectives (the engine applies the brand separately). Pass `planId` from a confirmed propose_plan. Runs in the background and notifies when ready.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      prompt: {
        type: "string",
        description: "The creative brief: message/headline, occasion, mood, and any EXACT text to include (e.g. the Bible verse, the name 'Daniel'). Keep it focused on what the user asked for (e.g. 'a fun, festive birthday flyer with a Bible verse') — do NOT add brand-tone adjectives; the engine applies the brand separately.",
      },
      tier: {
        type: "string",
        description: "'premium' (highest-fidelity engine — sharper text/detail, best for client-facing) or 'standard' (fast everyday). Always ask the user which they want; read the exact live prices from list_my_features.",
      },
      referenceImageUrls: {
        type: "array",
        description: "URLs of uploaded reference photos to USE in the design (the real person/product). Identity is preserved. If the user uploaded a photo, you MUST put its URL here — never leave empty when they handed you one, or the engine will invent a different subject.",
        items: { type: "string" },
      },
      orientation: {
        type: "string",
        description: "'square' (1080x1080, default), 'portrait'/'story' (1080x1920), or 'landscape'/'wide' (1920x1080).",
      },
      style: { type: "string", description: "Visual style: 'modern' (default), 'photorealistic', 'minimalist', 'vintage', 'illustration', 'elegant', etc." },
      ctaText: { type: "string", description: "Optional call-to-action button text. Omit for cards/announcements with no button." },
      templateId: {
        type: "string",
        description: "Optional id from list_agent_design_templates. If omitted, FlowAI chooses the closest agent design template from the user's brand industry and prompt.",
      },
    },
    required: ["planId", "prompt"],
  },
  plans: null,
  // Free base — the FlowCreative pipeline charges AI_VISUAL_DESIGN itself.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const promptText = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!promptText) {
      return { ok: false, error_code: "missing_input", message: "prompt (the creative brief) is required." };
    }
    const tier = input.tier === "premium" ? "premium" : "standard";

    const referenceImageUrls = Array.isArray(input.referenceImageUrls)
      ? input.referenceImageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0).slice(0, 4)
      : [];

    const cost = await getDynamicCreditCost("AI_VISUAL_DESIGN");

    // Pre-flight credit check mirrors the pipeline (purchased credits only,
    // non-admin) so the agent can warn instead of starting a doomed job.
    if (!ctx.isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { aiCredits: true, freeCredits: true },
      });
      const purchased = Math.max(0, (user?.aiCredits ?? 0) - (user?.freeCredits ?? 0));
      if (purchased < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `A ${tier} branded design costs ${cost} credits (purchased credits only). User has ${purchased}. Suggest /buy-credits.`,
          meta: { need: cost, have: purchased, tier },
        };
      }
    }

    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: ctx.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    const languageTag = await getUserPreferredLanguage(ctx.userId);

    const colors = parseJson<Record<string, string> | null>(brandKit?.colors, null);
    const handles = parseJson<Record<string, string> | null>(brandKit?.handles, null);
    const brandLogo = brandKit?.logo || brandKit?.iconLogo || null;
    const hasBrandLogo = Boolean(brandLogo);
    const requestedTemplateId = typeof input.templateId === "string" && input.templateId.trim()
      ? input.templateId.trim()
      : null;
    const autoTemplate = chooseAgentDesignTemplate({
      industry: brandKit?.industry || brandKit?.niche || null,
      query: [promptText, input.style, input.ctaText].filter((item) => typeof item === "string" && item.trim()).join(" "),
      channel: orientationToTemplateChannel(input.orientation, promptText),
      limit: 1,
    });
    const agentTemplate = requestedTemplateId
      ? getAgentDesignTemplateById(requestedTemplateId)
      : autoTemplate;

    if (requestedTemplateId && !agentTemplate) {
      return {
        ok: false,
        error_code: "not_found",
        message: `Agent design template "${requestedTemplateId}" was not found. Call list_agent_design_templates to get a valid template id.`,
      };
    }

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
          hashtags: parseJson<unknown[]>(brandKit.hashtags, []),
          colors,
          handles,
          website: brandKit.website || null,
          email: brandKit.email || null,
          phone: brandKit.phone || null,
          address: brandKit.address || null,
          hasLogo: hasBrandLogo,
          agentDesignTemplate: agentTemplate ? compactAgentTemplateForPrompt(agentTemplate) : null,
        }
      : null;

    // Same policy scaffolding the Create modal uses so quality matches the
    // product page. Logo lock + anti-invention + exact-reference handling.
    const logoPolicy = hasBrandLogo
      ? "Logo lock: do NOT draw any logo, wordmark, emblem, seal, crest, mascot, badge, or monogram. FlowSmartly composites the REAL brand logo after generation — leave that area natural, no placeholder box/frame/watermark."
      : "Do not invent a logo, icon, seal, crest, monogram, mascot, or brand mark the user did not provide. Use plain brand-name text only if the prompt asks for it.";
    const exactReferencePolicy = referenceImageUrls.length
      ? "Exact reference handling: the uploaded photo(s) are the REAL subject. Preserve the real person's face and identity exactly — do NOT synthesize a similar-looking or different person. Integrate them naturally into the design."
      : null;
    // Real, factual brand elements the design MUST show (not tone — these are
    // required content). The user explicitly wants the brand name + contact on it.
    const brandDisplayPolicy = [
      brandKit?.name ? `Show the brand name "${brandKit.name}" as a clear, readable text header at the TOP of the design.` : null,
      contactLine ? `Include these REAL contact details in small, legible text near the bottom (copy them exactly, do not invent any): ${contactLine}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const antiInventionPolicy =
      "Content rule: render ONLY the messaging, names, dates, and visuals the user provided in the prompt, brand kit, or uploaded references. Do not invent extra products, people, prices, dates, claims, or testimonials.";

    const imagePrompt = withLanguagePrefix(
      [
        promptText,
        agentTemplate ? buildAgentDesignTemplatePrompt(agentTemplate) : null,
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

    const size = orientationToSize(input.orientation);
    const provider = tier === "premium" ? "openai" : "xai";
    const style = typeof input.style === "string" && input.style.trim() ? input.style.trim() : "modern";
    const ctaText = typeof input.ctaText === "string" && input.ctaText.trim() ? input.ctaText.trim() : null;

    // Mirror the Studio Create modal's /api/ai/visual body EXACTLY — same
    // raw_brand pipeline, provider-by-tier, reference handling, and logo
    // overlay that already produces great designs there. Don't add knobs
    // FlowCreative wasn't built with; it's already tuned.
    const visualBody = {
      prompt: imagePrompt,
      category: "social_post",
      size,
      style,
      provider,
      strictProvider: true,
      tier,
      promptMode: "raw_brand",
      brandIdentity,
      channels: "selected social channels",
      heroType: "product",
      textMode: "creative",
      brandColors: colors,
      brandLogo,
      brandName: brandKit?.name || null,
      showBrandName: !!brandKit?.name,
      showSocialIcons: true,
      socialHandles: handles,
      contactInfo,
      referenceImageUrl: referenceImageUrls[0] || null,
      referenceImageUrls,
      templateImageUrl: agentTemplate?.imageUrl || null,
      agentDesignTemplate: agentTemplate ? serializeAgentDesignTemplateForTool(agentTemplate) : null,
      compositeReferenceSubject: false,
      logoPlacement: { x: 0.03, y: 0.03, sizePercent: 12 },
      ctaText,
    };

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "create_branded_design",
      input: { tier, references: referenceImageUrls.length, agentTemplateId: agentTemplate?.id || null },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 15,
          message: "Designing your branded image…",
        });

        const result = await runVisualForUser(visualBody, { userId: ctx.userId, isAdmin: ctx.isAdmin });
        const resBody = result.body as {
          success?: boolean;
          data?: { design?: { id?: string; imageUrl?: string } };
          error?: { message?: string };
        };
        if (result.status !== 200 || !resBody.success || !resBody.data?.design?.imageUrl) {
          const msg = resBody.error?.message || "The design could not be generated.";
          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "create_branded_design",
            ok: false,
            summary: "Your branded design hit a snag",
            detail: msg,
            deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
          });
          throw new Error(msg);
        }

        const url = resBody.data.design.imageUrl;
        const designId = resBody.data.design.id;

        await notifyAgentTaskComplete({
          userId: ctx.userId,
          taskId,
          kind: "create_branded_design",
          ok: true,
          summary: `Your ${tier === "premium" ? "Premium" : "Standard"} branded design is ready`,
          deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
          previewImageUrl: url,
        });

        return {
          output: { url, designId, tier, link: "/studio" },
          resultRefType: "Design",
          resultRefId: designId,
        };
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "create_branded_design",
      summary: "Creating your branded design…",
    });

    return {
      ok: true,
      data: {
        taskId,
        tier,
        creditCostQuoted: cost,
        agentTemplate: agentTemplate
          ? {
              id: agentTemplate.id,
              name: agentTemplate.name,
              industry: agentTemplate.industryLabel,
              metaTags: agentTemplate.metaTags,
            }
          : null,
        usedReferencePhoto: referenceImageUrls.length > 0,
        userMessage: `Started a ${tier} branded design via FlowCreative${agentTemplate ? ` using the ${agentTemplate.name} agent template` : ""}${referenceImageUrls.length ? ` using the uploaded photo (real face preserved)` : ""}. Runs in the background; the user gets the image inline + a notification. Tell them you'll let them know when it's ready.`,
      },
    };
  },
};

function orientationToSize(orientation: unknown): string {
  const o = typeof orientation === "string" ? orientation.toLowerCase() : "";
  if (o === "portrait" || o === "story" || o === "reel" || o === "9:16") return "1080x1920";
  if (o === "landscape" || o === "wide" || o === "16:9") return "1920x1080";
  return "1080x1080";
}

function orientationToTemplateChannel(orientation: unknown, prompt: string): AgentDesignChannel {
  const normalizedOrientation = typeof orientation === "string" ? orientation.toLowerCase() : "";
  const normalizedPrompt = prompt.toLowerCase();
  if (normalizedOrientation === "landscape" || normalizedOrientation === "wide" || normalizedOrientation === "16:9") return "ad";
  if (/\b(event|open house|webinar|workshop|conference|service|concert|invite|invitation|rsvp)\b/.test(normalizedPrompt)) return "poster";
  if (normalizedOrientation === "portrait" || normalizedOrientation === "story" || normalizedOrientation === "reel" || normalizedOrientation === "9:16") return "flyer";
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
