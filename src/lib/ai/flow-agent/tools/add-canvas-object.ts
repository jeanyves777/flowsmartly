import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateImageForRole } from "@/lib/ai/image-router";
import { imageGenerateRole } from "@/lib/ai/media-models";
import { uploadToS3 } from "@/lib/utils/s3-client";
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
    "Add ONE generated object to the OPEN design canvas without redrawing the whole design. type='element' generates an isolated, cut-out subject (a laptop, phone, product, icon, illustration) that drops on as a transparent, draggable image the user can move/resize; type='background' generates a polished backdrop sized to the user's current canvas that sits BEHIND the existing text/images (their layout & coordinates are kept). Use this whenever the user asks to ADD or place something ('add a laptop', 'put my product in', 'give it a nicer background', 'add an illustration') — do NOT use create_branded_design for that (it replaces the entire canvas). For a background, pass the canvas `size` from the canvas context, and write a prompt that fits the user's current design (branded with their colors only if they want it). Runs in the background and lands on the canvas when ready.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", description: "'element' (an isolated cut-out object to place on the canvas) or 'background' (a backdrop behind the current design)." },
      prompt: { type: "string", description: "What to generate. For an element, just the subject ('a sleek modern laptop, screen on'). For a background, describe the backdrop and whether it should pick up the brand colors/mood; keep it consistent with the user's current design style." },
      size: { type: "string", description: "The canvas size for a BACKGROUND, e.g. '1080×1350' (read it from the canvas context). Ignored for elements." },
      tier: { type: "string", description: "'standard' (default) or 'premium' (sharper). Read live prices from list_my_features." },
    },
    required: ["type", "prompt"],
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

    const enrichedPrompt =
      type === "element"
        ? `${promptText}. A single isolated subject, centered, professional studio product shot on a plain solid neutral background, full subject in frame, soft even lighting, no text, no extra props, no logo.`
        : `${promptText}. A polished, high-quality design BACKGROUND/backdrop only — texture, gradient, scene or subtle illustration suitable to sit behind headline text. No text, no words, no watermark, no central subject competing with foreground copy; keep the composition clean with calm negative space.`;

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
        const url = await uploadToS3(key, buffer, mime);

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
