import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import { verifyDesignText } from "@/lib/media/verify-design-text";
import { editImagesForRole } from "@/lib/ai/image-router";
import { imageEditRole } from "@/lib/ai/media-models";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { loadImageBuffer } from "../load-image-buffer";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import {
  generateBrandedImage,
  orientationToSize,
  type BrandedOrientation,
} from "@/lib/media/branded-image";

/**
 * create_branded_design — the agent's PRIMARY image tool for anything
 * branded or marketing-grade: ads, flyers, birthday/holiday cards,
 * announcements, product shots, social creatives.
 *
 * Generation is centralized in `generateBrandedImage` (src/lib/media), which
 * every branded-image surface (this tool, content-automation, the scheduler)
 * shares — same FlowCreative engine, prompt, provider policy, logo composite,
 * and date handling. This tool adds the agent-specific bits on top: template
 * choice for the inline response, background task + notification, and a vision
 * QA self-check that proofreads the rendered contact text.
 *
 * Tier → cost: Standard = AI_VISUAL_DESIGN (15), Premium = 3× (45, quality
 * loop). The pipeline charges credits itself; this tool does not.
 */
export const createBrandedDesign: FlowAgentTool = {
  name: "create_branded_design",
  description:
    "Create a polished, ON-BRAND image via the platform's FlowCreative engine (the SAME engine the Studio Create modal uses) — use this for ANY branded or marketing visual: ads, flyers, birthday/holiday cards, announcements, product images, social posts. It automatically applies the user's brand colors, composites their REAL logo, and — when reference photos are supplied — PRESERVES the real person's/product's identity (never invents a lookalike). If the user uploaded a photo of a person/product, you MUST pass its URL in referenceImageUrls — otherwise the engine generates a stranger. ALWAYS ask the user the FORMAT/SIZE via the ask_choice tool (offer it together with the tier so they tap both), unless they already named it — options: Square post (1:1), Portrait post (4:5), Flyer/Poster (A4 3:4), Story/Reel (9:16), Landscape (16:9). Pass the matching `orientation`. A 'flyer'/'poster' is 3:4 (NOT the tall 9:16 story size); a feed post is square or 4:5. Tiers differ in engine quality (Premium = sharper text/detail); always ask which they want and read the exact live prices from list_my_features (admin-set, from the DB) — never hardcode. Keep the prompt focused on the user's actual request; don't pile on brand-tone adjectives (the engine applies the brand separately). Pass `planId` from a confirmed propose_plan. Runs in the background and notifies when ready.",
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
        description: "The format the user chose: 'square' (1:1 feed post), 'portrait' (4:5 portrait post), 'flyer' or 'poster' (3:4 A4 flyer/poster — NOT the tall story size), 'story'/'reel' (9:16 phone-tall), or 'landscape' (16:9). Pass exactly what they picked; a 'flyer'/'poster' is 3:4, NOT 9:16.",
      },
      style: { type: "string", description: "Visual style: 'modern' (default), 'photorealistic', 'minimalist', 'vintage', 'illustration', 'elegant', etc." },
      ctaText: { type: "string", description: "Optional call-to-action button text. Omit for cards/announcements with no button." },
    },
    required: ["planId", "prompt"],
  },
  plans: null,
  // Free base — the FlowCreative pipeline charges AI_VISUAL_DESIGN itself.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  // Accurate cost for the auto-confirm card when the model calls this without a
  // prior propose_plan: the pipeline bills AI_VISUAL_DESIGN (×3 for Premium),
  // not the ~0 base costKey — so the card never under-quotes.
  autoPlanCost: async (input) => {
    const premium = typeof input.tier === "string" && /premium/i.test(input.tier);
    const base = await getDynamicCreditCost("AI_VISUAL_DESIGN").catch(() => 0);
    const credits = premium ? base * 3 : base;
    return {
      credits,
      label: premium ? "Create your design (Premium)" : "Create your design",
      detail: premium ? "Premium engine — sharper text & detail" : "Standard engine",
    };
  },
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
          message: `A ${tier} branded design costs ${cost} credits (purchased credits only). User has ${purchased}. Suggest /home/billing.`,
          meta: { need: cost, have: purchased, tier },
        };
      }
    }

    // Brand kit is needed here for the vision QA self-check (exact contact
    // values). The heavy brand-context assembly + generation lives in
    // generateBrandedImage (template-free — brief + brand kit + xAI@2K recipe).
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: ctx.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    const languageTag = await getUserPreferredLanguage(ctx.userId);
    const hasBrandLogo = Boolean(brandKit?.logo || brandKit?.iconLogo);

    const orientation = typeof input.orientation === "string" ? (input.orientation as BrandedOrientation) : undefined;
    const size = orientationToSize(orientation);
    const ctaText = typeof input.ctaText === "string" && input.ctaText.trim() ? input.ctaText.trim() : null;

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "create_branded_design",
      input: { tier, references: referenceImageUrls.length },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({
          type: "progress",
          taskId,
          progress: 15,
          message: "Designing your branded image…",
        });

        const design = await generateBrandedImage({
          userId: ctx.userId,
          isAdmin: ctx.isAdmin,
          prompt: promptText,
          orientation,
          tier,
          style: typeof input.style === "string" ? input.style : undefined,
          referenceImageUrls,
          ctaText,
        });

        if (!design.ok || !design.imageUrl) {
          const msg = design.error || "The design could not be generated.";
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

        let url = design.imageUrl;
        const designId = design.designId;

        // ── Vision QA self-check ───────────────────────────────────────────
        // Proofread the rendered contact text + headline against the EXACT
        // brand values. Image models garble emails/URLs/phones and sometimes
        // duplicate the headline — if the vision check spots that, auto-run a
        // single xAI corrective edit (Grok is stronger at edits) with the exact
        // values. Best-effort: never block delivery on a QA/edit failure.
        // TIME-BOUNDED so a slow vision/xAI call can NEVER hang the design:
        // if the QA+fix doesn't finish within the cap, we deliver the original.
        const expected = {
          brandName: brandKit?.name && !hasBrandLogo ? brandKit.name : null,
          phone: brandKit?.phone || null,
          email: brandKit?.email || null,
          website: brandKit?.website || null,
          address: brandKit?.address || null,
        };
        if (expected.phone || expected.email || expected.website || expected.address || expected.brandName) {
          const runQa = async (): Promise<string | null> => {
            publishTaskEvent({ type: "progress", taskId, progress: 80, message: "Proofreading the text…" });
            const designBuf = await loadImageBuffer(url);
            const verdict = await verifyDesignText(designBuf, expected);
            if (verdict.ok) return null;
            publishTaskEvent({ type: "progress", taskId, progress: 88, message: "Fixing the text…" });
            const fixParts = [
              expected.phone ? `Phone: ${expected.phone}` : null,
              expected.email ? `Email: ${expected.email}` : null,
              expected.website ? `Website: ${expected.website}` : null,
              expected.address ? `Address: ${expected.address}` : null,
              expected.brandName ? `Brand name: ${expected.brandName}` : null,
            ].filter(Boolean);
            const fixPrompt = withLanguagePrefix(
              [
                "Fix ONLY the garbled/misspelled text in this design — do not change the artwork, layout, photos, colors, or logo.",
                verdict.headlineDuplicated
                  ? "The headline is duplicated/stacked/ghosted — render it EXACTLY ONCE as a single clean line, removing any repeated copy."
                  : "",
                fixParts.length
                  ? `Render these values EXACTLY, character-for-character (correct any garbled version currently shown, e.g. a wrong email/website/phone/city): ${fixParts.join("  |  ")}.`
                  : "",
                "Keep every other pixel identical and the same canvas size/aspect ratio.",
              ]
                .filter(Boolean)
                .join(" "),
              languageTag,
            );
            const [vw, vh] = size.split("x").map((n) => parseInt(n, 10));
            const edited = await editImagesForRole(imageEditRole(tier), fixPrompt, [designBuf], vw || 1080, vh || 1080, {
              quality: "high",
              intent: "identity",
              preferProvider: "xai", // xAI/Grok is strongest at text edits
            });
            if (!edited.base64) return null;
            let fixedBuf: Buffer = Buffer.from(edited.base64, "base64");
            try {
              const sharpMod = (await import("sharp")).default;
              const m = await sharpMod(fixedBuf).metadata();
              if (vw && vh && m.width && m.height && (m.width !== vw || m.height !== vh)) {
                if (Math.abs(m.width / m.height - vw / vh) / (vw / vh) < 0.06) {
                  fixedBuf = (await sharpMod(fixedBuf).resize(vw, vh, { fit: "cover", position: "centre" }).toBuffer()) as Buffer;
                }
              }
            } catch {
              /* keep edited output */
            }
            const key = `flow-ai/${ctx.userId}/${ctx.conversationId}-design-fixed-${taskId}.png`;
            const fixedUrl = await uploadToS3(key, fixedBuf, "image/png");
            if (designId) {
              await prisma.design.update({ where: { id: designId }, data: { imageUrl: fixedUrl } }).catch(() => {});
            }
            console.log(`[create_branded_design] QA auto-corrected text via xAI (${verdict.summary ?? "issues found"})`);
            return fixedUrl;
          };
          try {
            const QA_TIMEOUT_MS = 45_000;
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), QA_TIMEOUT_MS));
            const corrected = await Promise.race([runQa(), timeout]);
            if (corrected) url = corrected;
            else console.warn("[create_branded_design] QA skipped/timed out — delivering the design as-is");
          } catch (qaErr) {
            console.warn("[create_branded_design] vision QA / auto-fix skipped:", qaErr instanceof Error ? qaErr.message : qaErr);
          }
        }

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
          // link carries the conversation (so the chat carries over when the
          // studio opens) + the design id (to load it into the canvas).
          output: {
            url,
            designId,
            tier,
            link: `/home/create?conversationId=${ctx.conversationId}${designId ? `&design=${designId}` : ""}`,
          },
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
        usedReferencePhoto: referenceImageUrls.length > 0,
        userMessage: `Started a ${tier} branded design via FlowCreative${referenceImageUrls.length ? ` using the uploaded photo (real face preserved)` : ""}. Runs in the background; the user gets the image inline + a notification. Tell them you'll let them know when it's ready.`,
      },
    };
  },
};
