import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateImageForRole } from "@/lib/ai/image-router";
import { imageGenerateRole } from "@/lib/ai/media-models";
import { uploadToS3, isS3Configured } from "@/lib/utils/s3-client";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { saveToMediaLibrary } from "../save-media";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import type { FlowAgentTool } from "../registry";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

const clampDim = (n: number, def: number) => {
  const v = Math.round(typeof n === "number" && isFinite(n) ? n : def);
  return Math.max(256, Math.min(1920, v || def));
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The user's brand palette for a canvas BACKGROUND, so a generated backdrop is
 * always on-brand instead of a random/white image — the #1 complaint with the
 * old brand-blind path. We read the BrandKit colors directly (cheap) and merge
 * in the design's current accent (passed by the agent from the canvas context).
 */
async function brandPaletteFor(userId: string, accentHint?: string): Promise<string[]> {
  const out: string[] = [];
  const accent = typeof accentHint === "string" ? accentHint.trim().toLowerCase() : "";
  if (HEX.test(accent)) out.push(accent);
  try {
    const bk = await prisma.brandKit.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { colors: true },
    });
    const colors = (bk?.colors ?? null) as { primary?: unknown; secondary?: unknown; accent?: unknown } | null;
    for (const c of [colors?.primary, colors?.secondary, colors?.accent]) {
      const hex = typeof c === "string" ? c.trim().toLowerCase() : "";
      if (HEX.test(hex) && !out.includes(hex)) out.push(hex);
    }
  } catch (err) {
    console.warn("[canvas_object] brand palette lookup failed:", err instanceof Error ? err.message : err);
  }
  return out.slice(0, 4);
}

// Upload to S3, or fall back to /public when storage isn't configured (local dev)
// so the generated object still lands on the canvas instead of failing.
async function uploadOrLocal(key: string, buffer: Buffer, mime: string): Promise<string> {
  const toLocal = async () => {
    const rel = key.replace(/^\/+/, "");
    const abs = path.join(process.cwd(), "public", "uploads", rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    return `/uploads/${rel}`;
  };
  // Skip the doomed S3 round-trip entirely when storage isn't configured.
  if (!isS3Configured()) return toLocal();
  try {
    return await uploadToS3(key, buffer, mime);
  } catch (err) {
    console.warn("[canvas_object] S3 upload failed; serving from /public:", err instanceof Error ? err.message : err);
    return toLocal();
  }
}

/**
 * add_canvas_object — generate a SINGLE element or a background for the OPEN
 * design canvas, and add it as a new object the user can keep manipulating —
 * WITHOUT regenerating the whole design.
 *
 *  - type "element": e.g. "a laptop", "a coffee cup", an illustration/icon. The
 *    subject is generated isolated and (best-effort) background-removed so it
 *    drops onto the canvas as a transparent, draggable/resizable image layer.
 *  - type "background": a polished backdrop sized to the user's current canvas
 *    (branded or neutral, per the prompt) that sits behind the existing text/
 *    images — the layout/coordinates are preserved.
 *
 * Use this when the user asks to ADD something ("add a laptop", "put a phone in
 * it", "give it a nicer background") — NOT create_branded_design, which replaces
 * the whole canvas with a freshly rendered image.
 */
export const addCanvasObject: FlowAgentTool = {
  name: "add_canvas_object",
  description:
    "Add ONE generated object to the OPEN design canvas without redrawing the whole design. type='element' generates an isolated, cut-out subject (a laptop, phone, product, icon, illustration) that drops on as a transparent, draggable image the user can move/resize; type='background' generates a polished backdrop sized to the user's current canvas that sits BEHIND the existing text/images (their layout & coordinates are kept). Use this whenever the user asks to ADD or place something ('add a laptop', 'put my product in', 'give it a nicer background', 'add an illustration') — do NOT use create_branded_design for that (it replaces the entire canvas), and NEVER tell the user to open a separate/legacy studio — THIS canvas is the studio. It's a paid action: call `propose_plan` FIRST (one step + the credit cost), wait for the user to confirm, then call this with `planId` set to the confirmed plan's id. For a BACKGROUND: pass the canvas `size` AND the design's current `accent` from the canvas context — the tool AUTOMATICALLY builds the backdrop around the user's real brand palette (you don't need to type hex codes), so it comes back on-brand and never a plain white/random image. Runs in the background and lands on the canvas when ready.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan. Call propose_plan first (with the step + credit cost), wait for the user to confirm, then call this with that planId." },
      type: { type: "string", description: "'element' (an isolated cut-out object to place on the canvas) or 'background' (a backdrop behind the current design)." },
      prompt: { type: "string", description: "What to generate. For an element, just the subject ('a sleek modern laptop, screen on'). For a background, describe the mood/scene/texture you want (e.g. 'soft modern gradient with subtle geometric shapes') — do NOT bother spelling out hex colors; the tool already injects the user's brand palette. Keep it consistent with the user's current design style." },
      size: { type: "string", description: "The canvas size for a BACKGROUND, e.g. '1080×1350' (read it from the canvas context). Ignored for elements." },
      accent: { type: "string", description: "For a BACKGROUND: the design's current accent hex from the canvas context (e.g. '#0ea5e9'). The tool blends it with the brand palette so the backdrop harmonizes with the on-canvas accent. Ignored for elements." },
      tier: { type: "string", description: "'standard' (default) or 'premium' (sharper). Read live prices from list_my_features." },
    },
    required: ["planId", "type", "prompt"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // base 0 — the handler charges the image cost itself
  mutating: true,
  handler: async (input, ctx) => {
    const type = input.type === "background" ? "background" : "element";
    const promptText = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!promptText) {
      return { ok: false, error_code: "missing_input", message: "prompt (what to generate) is required." };
    }
    const tier = input.tier === "premium" ? "premium" : "standard";
    const costKey = tier === "premium" ? "AGENT_GENERATE_IMAGE_PREMIUM" : "AGENT_GENERATE_IMAGE_STANDARD";
    const cost = await getDynamicCreditCost(costKey);

    // Pre-flight credit check (purchased credits only, non-admin).
    if (!ctx.isAdmin) {
      const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true, freeCredits: true } });
      const have = Math.max(0, (user?.aiCredits ?? 0) - (user?.freeCredits ?? 0));
      if (have < cost) {
        return { ok: false, error_code: "insufficient_credits", message: `Generating a ${type} costs ${cost} credits. User has ${have}. Suggest /home/billing.`, meta: { need: cost, have } };
      }
    }

    // Size: elements render square (they're a layer); backgrounds match the canvas.
    let width = 1024, height = 1024;
    if (type === "background") {
      const [sw, sh] = (typeof input.size === "string" ? input.size : "").split(/[×x]/).map((n) => parseInt(n, 10));
      width = clampDim(sw, 1080);
      height = clampDim(sh, 1350);
    }

    // Backgrounds are made BRAND-AWARE automatically: pull the user's palette
    // (brand colors + the design's current accent) and bake it into the prompt
    // so the backdrop harmonizes with the on-canvas design instead of coming back
    // a random/near-white image. The user only said "improve the background" — so
    // we ground it in their brand, not "anything".
    const palette = type === "background" ? await brandPaletteFor(ctx.userId, typeof input.accent === "string" ? input.accent : undefined) : [];
    const wantsWhite = /\b(white|plain|blank|minimal|clean white|pure white)\b/i.test(promptText);

    const enrichedPrompt =
      type === "element"
        ? `${promptText}. A single isolated subject, centered, professional studio product shot on a plain solid neutral background, full subject in frame, soft even lighting, no text, no extra props, no logo.`
        : [
            `${promptText}.`,
            `A polished, professionally art-directed design BACKGROUND/backdrop only — gradient, texture, depth, subtle shapes or scene suitable to sit behind headline text.`,
            palette.length
              ? `Build the color palette AROUND these exact brand colors: ${palette.join(", ")} — use them as the dominant tones (rich, cohesive, on-brand), with tasteful tints/shades and complementary neutrals derived from them.`
              : `Use a rich, cohesive, modern color palette (not flat white).`,
            wantsWhite
              ? `Keep it light and airy as requested, but still tinted with the brand colors — not a dead pure-white page.`
              : `Do NOT return a plain white, washed-out, or empty page — give it real color, contrast and visual interest while staying tasteful.`,
            `Leave calm negative space where the foreground copy sits so the text stays readable. No text, no words, no letters, no watermark, no logo, no central subject competing with the foreground copy.`,
          ].join(" ");

    const taskId = await spawnBackgroundTask({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      kind: "canvas_object",
      input: { objectType: type, tier, width, height },
      creditCost: cost,
      worker: async (taskId) => {
        publishTaskEvent({ type: "progress", taskId, progress: 15, message: type === "background" ? "Generating background…" : "Generating element…" });

        const result = await generateImageForRole(imageGenerateRole(tier), enrichedPrompt, width, height, {
          quality: tier === "premium" ? "high" : "medium",
        });
        if (!result.base64) throw new Error("Image generator returned no image");

        let buffer = Buffer.from(result.base64, "base64");
        let mime = `image/${result.format}`;
        let ext = result.format === "png" ? "png" : "jpg";

        // Elements: cut out the subject so it composites cleanly (best-effort —
        // if rembg isn't available we keep the generated image as-is).
        if (type === "element" && isRembgAvailable()) {
          try {
            publishTaskEvent({ type: "progress", taskId, progress: 55, message: "Isolating the subject…" });
            const tmpDir = path.join(process.cwd(), "public", "uploads", "temp");
            await mkdir(tmpDir, { recursive: true });
            const inPath = path.join(tmpDir, `${randomUUID()}.${ext}`);
            await writeFile(inPath, buffer);
            const cut = await removeBackground(inPath, { model: "u2net" });
            buffer = await readFile(cut.outputPath);
            mime = "image/png";
            ext = "png";
            await unlink(inPath).catch(() => {});
            await unlink(cut.outputPath).catch(() => {});
          } catch (e) {
            console.warn("[canvas_object] subject cut-out skipped:", e instanceof Error ? e.message : e);
          }
        }

        publishTaskEvent({ type: "progress", taskId, progress: 85, message: "Uploading…" });
        const key = `flow-ai/${ctx.userId}/${ctx.conversationId}-obj-${Date.now()}.${ext}`;
        const url = await uploadOrLocal(key, buffer, mime);

        await saveToMediaLibrary({
          userId: ctx.userId,
          url,
          type: "image",
          mimeType: mime,
          size: buffer.length,
          tags: ["flow-ai", "canvas-object", type],
          metadata: { prompt: promptText, objectType: type, tier },
        });

        if (!ctx.isAdmin && cost > 0) {
          await creditService.deductCredits({
            userId: ctx.userId,
            amount: cost,
            type: "USAGE",
            description: `Flow-AI agent: canvas ${type}`,
            referenceType: "flow_ai_task",
            referenceId: taskId,
          });
        }

        await notifyAgentTaskComplete({
          userId: ctx.userId,
          taskId,
          kind: "canvas_object",
          ok: true,
          summary: type === "background" ? "Your new background is ready" : "Your new element is ready",
          deepLink: "/home/create",
          previewImageUrl: url,
        });

        return { output: { url, objectType: type, link: "/home/create" } };
      },
    });

    ctx.emit({
      type: "task_started",
      taskId,
      kind: "canvas_object",
      summary: type === "background" ? "Generating a background…" : "Generating your element…",
    });

    return {
      ok: true,
      data: {
        taskId,
        objectType: type,
        creditCostQuoted: cost,
        userMessage: `Started generating a ${type} (${tier}). It will drop onto the OPEN canvas as a ${type === "background" ? "backdrop behind the current design" : "draggable, resizable object"} when ready — the existing layout is preserved. Tell the user you're adding it and you'll place it on the canvas shortly. Do NOT call create_branded_design.`,
      },
    };
  },
};
