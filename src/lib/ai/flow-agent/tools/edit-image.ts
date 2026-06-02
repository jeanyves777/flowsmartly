import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { editImagesForRole } from "@/lib/ai/image-router";
import { imageEditRole } from "@/lib/ai/media-models";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";
import { analyzeLogoPlacement } from "@/lib/media/analyze-logo-placement";
import { uploadToS3, getPresignedUrl } from "@/lib/utils/s3-client";
import { getUserPreferredLanguage, withLanguagePrefix } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import { saveToMediaLibrary } from "../save-media";

/**
 * edit_image — take an EXISTING image (a previously generated one, or an
 * image the user uploaded) and either (a) edit it with an instruction
 * ("make the background blue", "remove the text") and/or (b) composite the
 * user's REAL BrandKit logo onto it. Reuses the same provider chain the rest
 * of the platform uses (editImagesForRole → global model policy) — no
 * reimplementation — and the
 * shared compositeBrandLogoOnImageBuffer for the logo overlay.
 *
 * Runs as a BACKGROUND TASK like generate_image. Mutating, confirmed-plan.
 *
 * Cost model: an AI edit costs the tier image price (charged in the worker
 * after success). A logo-only composite is a local sharp operation — free —
 * but still goes through propose_plan because it produces a new artifact.
 */
export const editImage: FlowAgentTool = {
  name: "edit_image",
  description:
    "Edit an EXISTING image (one you generated, or one the user uploaded) and/or composite the user's real brand logo onto it. Pass `imageUrl` (the source — use the URL from a prior generate_image result or an uploaded attachment). Use `prompt` for an edit instruction ('make the sky sunset', 'remove the text', 'add a coffee cup'). Set `addBrandLogo: true` to overlay the user's actual BrandKit logo (never an AI-drawn one). At least one of `prompt` or `addBrandLogo` is required. Runs in the background and notifies when ready. Pass `planId` from a confirmed propose_plan. A logo-only composite (no prompt) is free; an AI edit costs the image tier price — read the exact live prices from list_my_features (admin-set, from the DB); never hardcode them.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      imageUrl: { type: "string", description: "REQUIRED — source image URL (from a prior generate_image result or an uploaded attachment)." },
      prompt: { type: "string", description: "Edit instruction. Omit if you only want to add the brand logo." },
      addBrandLogo: { type: "boolean", description: "Composite the user's real BrandKit logo onto the image. Default false." },
      tier: { type: "string", description: "'premium' or 'standard' (default). Only matters when a prompt edit runs." },
      logoPosition: {
        type: "string",
        description: "Where to place the logo: 'top-left' (default), 'top-right', 'bottom-left', 'bottom-right', 'center'.",
      },
    },
    required: ["planId", "imageUrl"],
  },
  plans: null,
  // Base cost free — handler charges the tier image cost itself (only when an AI edit runs).
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
    if (!imageUrl) {
      return { ok: false, error_code: "missing_input", message: "imageUrl (the source image) is required." };
    }
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    const addBrandLogo = input.addBrandLogo === true;
    if (!prompt && !addBrandLogo) {
      return {
        ok: false,
        error_code: "missing_input",
        message: "Nothing to do — provide a `prompt` edit instruction and/or set addBrandLogo: true.",
      };
    }

    const tier = input.tier === "premium" ? "premium" : "standard";
    // Only an AI edit costs credits; a pure logo composite is local + free.
    const cost = prompt
      ? await getDynamicCreditCost(tier === "premium" ? "AGENT_GENERATE_IMAGE_PREMIUM" : "AGENT_GENERATE_IMAGE_STANDARD")
      : 0;

    // Resolve the BrandKit logo up front so we can fail fast if they asked
    // for a logo but don't have one set.
    const [brandKit, languageTag] = await Promise.all([
      prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true, description: true, logo: true, iconLogo: true },
      }),
      getUserPreferredLanguage(ctx.userId),
    ]);
    const logoSource = addBrandLogo ? brandKit?.iconLogo || brandKit?.logo || null : null;
    if (addBrandLogo && !logoSource) {
      return {
        ok: false,
        error_code: "validation_failed",
        message: "The user asked to add their logo but no logo is set in their Brand Kit. Point them to /brand to upload one.",
      };
    }

    if (!ctx.isAdmin && cost > 0) {
      const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
      if ((user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Need ${cost} credits for a ${tier} image edit. User has ${user?.aiCredits ?? 0}. Suggest /credits to top up.`,
          meta: { need: cost, have: user?.aiCredits ?? 0 },
        };
      }
    }

    const hasExplicitPosition = typeof input.logoPosition === "string";
    const placement = positionToPlacement(input.logoPosition);

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "edit_image",
      input: { imageUrl, prompt, addBrandLogo, tier },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({ type: "progress", taskId, progress: 10, message: "Loading image…" });
        let buffer = await loadImageBuffer(imageUrl);
        let format: "png" | "jpeg" = "png";

        // (a) AI edit, if a prompt was given.
        if (prompt) {
          publishTaskEvent({ type: "progress", taskId, progress: 35, message: "Editing image…" });
          const brandLine = brandKit
            ? `Brand: ${brandKit.name}${brandKit.description ? ` — ${brandKit.description.slice(0, 120)}` : ""}.`
            : "";
          const enrichedPrompt = withLanguagePrefix(
            [
              prompt,
              brandLine,
              "Preserve the subject and composition of the original; apply only the requested change. Do NOT add any logo or brand mark — we composite the real one after.",
            ]
              .filter(Boolean)
              .join(" "),
            languageTag,
          );
          const result = await editImagesForRole(imageEditRole(tier), enrichedPrompt, [buffer], 1024, 1024, {
            quality: tier === "premium" ? "high" : "medium",
            intent: "identity",
          });
          if (!result.base64) throw new Error("Image editor returned no image");
          buffer = Buffer.from(result.base64, "base64");
          format = result.format === "png" ? "png" : "jpeg";
        }

        // (b) Composite the real brand logo, if requested.
        if (logoSource) {
          publishTaskEvent({ type: "progress", taskId, progress: 70, message: "Adding your logo…" });
          // When the caller didn't pin a position, run the same vision
          // safe-area pass the FlowCreative pipeline uses so the logo lands
          // in a clear corner and never covers the headline/body text.
          let logoPlacement = placement;
          if (!hasExplicitPosition) {
            try {
              const safe = await analyzeLogoPlacement(buffer);
              logoPlacement = { x: safe.x, y: safe.y, sizePercent: safe.sizePercent };
            } catch {
              /* keep default placement on vision failure */
            }
          }
          buffer = await compositeBrandLogoOnImageBuffer({
            imageBuffer: buffer,
            logoSource,
            placement: logoPlacement,
            smartBackdrop: true,
          });
          format = "png"; // compositor outputs PNG
        }

        publishTaskEvent({ type: "progress", taskId, progress: 88, message: "Uploading…" });
        const ext = format === "png" ? "png" : "jpg";
        const key = `flow-ai/${ctx.userId}/${ctx.conversationId}-edit-${Date.now()}.${ext}`;
        const url = await uploadToS3(key, buffer, `image/${format}`);

        await saveToMediaLibrary({
          userId: ctx.userId,
          url,
          type: "image",
          mimeType: `image/${format}`,
          size: buffer.length,
          tags: ["flow-ai", "edit"],
          metadata: { sourceImageUrl: imageUrl, prompt: prompt || null, addBrandLogo, tier },
        });

        if (!ctx.isAdmin && cost > 0) {
          await creditService.deductCredits({
            userId: ctx.userId,
            amount: cost,
            type: "USAGE",
            description: `Flow-AI agent: ${tier} image edit`,
            referenceType: "flow_ai_task",
            referenceId: taskId,
          });
        }

        await notifyAgentTaskComplete({
          userId: ctx.userId,
          taskId,
          kind: "edit_image",
          ok: true,
          summary: prompt ? "Your edited image is ready" : "Your logo was added",
          deepLink: `/flow-ai?conversationId=${ctx.conversationId}&taskId=${taskId}`,
          previewImageUrl: url,
        });

        return {
          output: { url, tier, prompt: prompt || null, addBrandLogo },
          resultRefType: "AgentImage",
          resultRefId: url,
        };
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "edit_image",
      summary: prompt ? "Editing image…" : "Adding your logo…",
    });

    return {
      ok: true,
      data: {
        taskId,
        tier,
        creditCostQuoted: cost,
        userMessage: `Started the image edit in the background${cost === 0 ? " (free — logo composite only)" : ""}. The user will see the result inline when it's ready and get a notification.`,
      },
    };
  },
};

async function loadImageBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const b64 = src.replace(/^data:[^;]+;base64,/, "");
    if (!b64) throw new Error("Invalid image data URI");
    return Buffer.from(b64, "base64");
  }
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "";
  const looksManaged =
    src.includes(".amazonaws.com/") || (storageUrl !== "" && src.startsWith(storageUrl)) || !src.startsWith("http");
  const fetchUrl = looksManaged ? await getPresignedUrl(src) : src;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch source image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function positionToPlacement(pos: unknown): { x: number; y: number; sizePercent: number } {
  const map: Record<string, { x: number; y: number }> = {
    "top-left": { x: 0.04, y: 0.04 },
    "top-right": { x: 0.72, y: 0.04 },
    "bottom-left": { x: 0.04, y: 0.82 },
    "bottom-right": { x: 0.72, y: 0.82 },
    center: { x: 0.4, y: 0.43 },
  };
  const key = typeof pos === "string" && map[pos] ? pos : "top-left";
  return { ...map[key], sizePercent: 14 };
}
