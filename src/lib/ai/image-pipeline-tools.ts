import Anthropic from "@anthropic-ai/sdk";
import { openaiClient } from "./openai-client";
import { xaiClient, sizeToAspectRatio } from "./xai-client";
import { geminiImageClient, sizeToAspectRatioGemini } from "./gemini-image-client";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { saveToFile, saveToFileLocal } from "@/lib/utils/file-storage";
import { randomUUID } from "crypto";
import type { AgentTool } from "./client";

/**
 * Image pipeline agent tools — drop-in replacement for the hardcoded
 * provider-selection + transparency strategy in `design-image-pipeline.ts`.
 *
 * The agent's job per image placeholder:
 *   1. Pick the best provider for the subject (photoreal vs illustrated etc.)
 *   2. Compose a clean prompt with the right transparency approach
 *   3. Generate
 *   4. Evaluate the output (vision)
 *   5. Rerun if quality<threshold or transparency failed
 *
 * Tools cache the generated base64 in `ctx.images` keyed by handle so the
 * agent can pass references through context cheaply. The route handler
 * pulls the final base64 out by handle and uploads to S3.
 */

export interface ImagePipelineToolContext {
  /** Canvas dimensions — drives aspect ratio decisions across providers. */
  canvasWidth: number;
  canvasHeight: number;
  /** Cache of all images generated this session, keyed by handle. */
  images: Map<
    string,
    { base64: string; format: "png" | "jpeg"; provider: string; transparent: boolean; prompt: string }
  >;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function mapToOpenAISize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  const ratio = width / height;
  if (ratio > 1.3) return "1536x1024";
  if (ratio < 0.77) return "1024x1536";
  if (Math.abs(ratio - 1) < 0.15) return "1024x1024";
  return "auto";
}

export function buildImagePipelineTools(ctx: ImagePipelineToolContext): AgentTool[] {
  return [
    {
      name: "generate_image",
      description:
        "Render an image via one of three providers. PROVIDER GUIDE — pick based on subject:\n" +
        "  • openai (gpt-image-1) — best for: photorealistic people, complex scenes, native transparency. Higher cost.\n" +
        "  • xai (grok-imagine) — best for: illustrations, stylized art, fast generation. No native transparency (we rembg post-process).\n" +
        "  • gemini (imagen-4) — best for: photorealistic landscapes/objects, clean compositions. No native transparency.\n" +
        "TRANSPARENCY: pass needsTransparency=true ONLY for hero/foreground subjects that will overlay a background. " +
        "We auto-add the right background-isolation language per provider; do NOT hand-write 'green screen' or 'plain white background' yourself.\n" +
        "Returns a handle (e.g. 'pimg-1') the agent can pass to evaluate_image.",
      input_schema: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            enum: ["openai", "xai", "gemini"],
            description: "Which provider to use. Choose deliberately based on the subject — see provider guide above.",
          },
          prompt: {
            type: "string",
            description:
              "The CORE subject prompt (e.g. 'A confident barista smiling, wearing apron, holding a latte'). Do not include background instructions when needsTransparency=true — we'll add them.",
          },
          needsTransparency: {
            type: "boolean",
            description:
              "True for hero/foreground subjects (we'll isolate them on transparent bg). False for full backgrounds and decorative scenes.",
          },
        },
        required: ["provider", "prompt", "needsTransparency"],
      },
      handler: async (input) => {
        const provider = String(input.provider) as "openai" | "xai" | "gemini";
        const corePrompt = String(input.prompt || "");
        const needsTransparency = Boolean(input.needsTransparency);

        if (!corePrompt) return { error: "Empty prompt" };

        // Build the full prompt with provider-appropriate isolation language
        let fullPrompt = corePrompt;
        if (needsTransparency) {
          if (provider === "openai") {
            fullPrompt += " Isolated subject on a plain white background. No background scene, no environment, no text, no decorations.";
          } else {
            // xAI and Gemini: green chroma key for cleanest rembg
            fullPrompt += " Isolated subject centered on a solid bright green (#00FF00) chroma key background. The background must be a single flat solid green color with no variation, no shadows, no gradients. No background scene, no environment, no text, no decorations.";
          }
        }

        let base64: string | null = null;
        let format: "png" | "jpeg" = "png";

        try {
          if (provider === "openai") {
            base64 = await openaiClient.generateImage(fullPrompt, {
              size: mapToOpenAISize(ctx.canvasWidth, ctx.canvasHeight),
              quality: "medium",
              transparent: needsTransparency,
            });
            format = "png";
          } else if (provider === "xai") {
            base64 = await xaiClient.generateImage(fullPrompt, {
              aspectRatio: sizeToAspectRatio(ctx.canvasWidth, ctx.canvasHeight),
            });
            format = "jpeg";
          } else if (provider === "gemini") {
            base64 = await geminiImageClient.generateImage(fullPrompt, {
              aspectRatio: sizeToAspectRatioGemini(ctx.canvasWidth, ctx.canvasHeight),
            });
            format = "png";
          }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Image gen failed", provider };
        }

        if (!base64) return { error: "Provider returned no image", provider };

        // For non-OpenAI hero images, run rembg here so the cached image is already transparent
        let finalBase64 = base64;
        let finalFormat = format;
        let rembgApplied = false;
        if (needsTransparency && provider !== "openai" && isRembgAvailable()) {
          try {
            const tempId = randomUUID();
            const ext = format === "jpeg" ? "jpg" : "png";
            const dataUri = `data:image/${format};base64,${base64}`;
            const localUrl = await saveToFileLocal(dataUri, "temp", `rembg-input-${tempId}.${ext}`);
            const localPath = `${process.cwd()}/public${localUrl}`;
            const result = await removeBackground(localPath, { model: "u2net" });
            const { readFileSync } = await import("fs");
            finalBase64 = readFileSync(result.outputPath).toString("base64");
            finalFormat = "png";
            rembgApplied = true;
            const { unlink } = await import("fs/promises");
            await unlink(localPath).catch(() => {});
            await unlink(result.outputPath).catch(() => {});
          } catch {
            // rembg failed — return non-transparent, agent can decide to retry
          }
        }

        const handle = `pimg-${ctx.images.size + 1}`;
        ctx.images.set(handle, {
          base64: finalBase64,
          format: finalFormat,
          provider,
          transparent: needsTransparency && (provider === "openai" || rembgApplied),
          prompt: fullPrompt,
        });
        return {
          handle,
          provider,
          format: finalFormat,
          transparencyApplied: needsTransparency && (provider === "openai" || rembgApplied),
          note: "Image cached. Call evaluate_image with this handle to QA it.",
        };
      },
    },

    {
      name: "evaluate_image",
      description:
        "Score a generated image with Claude vision. Returns 1-10 score + specific issues (subject correctness, transparency check, artifacts, brand-fit). Use this BEFORE committing to a result — rerun anything scoring < 7.",
      input_schema: {
        type: "object",
        properties: {
          handle: {
            type: "string",
            description: "Image handle from generate_image (e.g. 'pimg-1').",
          },
          expectedSubject: {
            type: "string",
            description: "Short description of what should appear in the image (e.g. 'smiling barista with latte'). Used to check the image actually matches.",
          },
          requireTransparent: {
            type: "boolean",
            description: "True if the image is supposed to be background-removed. Evaluator checks for clean alpha edges and no leftover background pixels.",
          },
        },
        required: ["handle", "expectedSubject", "requireTransparent"],
      },
      handler: async (input) => {
        const handle = String(input.handle || "");
        const expectedSubject = String(input.expectedSubject || "");
        const requireTransparent = Boolean(input.requireTransparent);
        const cached = ctx.images.get(handle);
        if (!cached) return { error: `No image found for handle "${handle}"` };

        const evalPrompt = `Evaluate this generated image.

Expected subject: "${expectedSubject}"
${requireTransparent ? "REQUIREMENT: background must be transparent / cleanly removed." : "NOTE: this is a full-scene image (background expected)."}

Score 1-10 on overall fitness for use in a marketing design and report:
- Does the image match the expected subject?
- Are there visual artifacts, weird hands/faces, garbled text, distorted features?
${requireTransparent ? "- Is the background actually transparent (or unremoved/leftover)? Are the alpha edges clean?" : "- Is the composition usable as a background (room for text overlay, no busy clutter where titles will sit)?"}
- Is the lighting and color palette professional?

Reply ONLY with valid JSON: { "score": <1-10>, "subjectMatches": <bool>, "transparentOK": <bool>, "issues": ["..."], "verdict": "<one-line summary>" }`;

        try {
          const response = await anthropic.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 600,
            messages: [{
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: cached.format === "jpeg" ? "image/jpeg" : "image/png",
                    data: cached.base64,
                  },
                },
                { type: "text", text: evalPrompt },
              ],
            }],
          });
          const textBlock = response.content.find((b) => b.type === "text");
          const text = textBlock?.type === "text" ? textBlock.text : "";
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try { return JSON.parse(match[0]); } catch {}
          }
          return { score: 5, verdict: text.slice(0, 200), issues: ["could not parse evaluator response"] };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Evaluation failed" };
        }
      },
    },
  ];
}

/**
 * Helper used by the route handler to upload an agent-cached image to S3.
 * Centralized here so route code doesn't need to know about format quirks.
 */
export async function uploadCachedImage(
  ctx: ImagePipelineToolContext,
  handle: string,
  prefix = "designs/layout-images",
): Promise<string | null> {
  const cached = ctx.images.get(handle);
  if (!cached) return null;
  const id = randomUUID();
  const ext = cached.format === "jpeg" ? "jpg" : "png";
  const dataUri = `data:image/${cached.format};base64,${cached.base64}`;
  return saveToFile(dataUri, prefix, `${id}.${ext}`);
}
