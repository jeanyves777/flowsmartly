import Anthropic from "@anthropic-ai/sdk";
import { openaiClient } from "@/lib/ai/openai-client";
import { prisma } from "@/lib/db/client";
import type { AgentTool } from "./client";

/**
 * Logo agent tools — three orchestration tools the logo agent uses to:
 *   1. fetch brand context (`get_brand_context`),
 *   2. actually call OpenAI gpt-image-1 to render a logo (`generate_logo_image`),
 *   3. evaluate the rendered logo with Claude vision (`evaluate_logo_image`).
 *
 * The handlers run server-side. `generate_logo_image` returns the base64
 * payload AND a transient handle the agent can pass to `evaluate_logo_image`
 * — we cache base64s in `ctx.images` so they don't have to round-trip through
 * the model context (which would blow the token budget).
 */

export interface LogoToolContext {
  userId: string;
  /** Mutable cache of generated images keyed by handle (e.g. "img-1"). */
  images: Map<string, { base64: string; prompt: string; styleHint: string }>;
}

/**
 * Used by the route handler after the agent finishes — pulls the agent's
 * chosen images out of the context cache by handle and saves them.
 */
export function getCachedImage(ctx: LogoToolContext, handle: string) {
  return ctx.images.get(handle);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function buildLogoTools(ctx: LogoToolContext): AgentTool[] {
  return [
    {
      name: "get_brand_context",
      description:
        "Fetch the user's brand kit — name, voice, colors, industry, target audience. Call once at the start of a logo task to ground style choices in the user's brand.",
      input_schema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          select: {
            name: true,
            voiceTone: true,
            tagline: true,
            industry: true,
            niche: true,
            targetAudience: true,
            colors: true,
            personality: true,
          },
        });
        if (!kit) return { configured: false };
        let parsedColors: unknown = null;
        let parsedPersonality: unknown = null;
        try { parsedColors = kit.colors ? JSON.parse(kit.colors) : null; } catch {}
        try { parsedPersonality = kit.personality ? JSON.parse(kit.personality) : null; } catch {}
        return {
          configured: true,
          name: kit.name,
          voiceTone: kit.voiceTone,
          tagline: kit.tagline,
          industry: kit.industry,
          niche: kit.niche,
          targetAudience: kit.targetAudience,
          colors: parsedColors,
          personality: parsedPersonality,
        };
      },
    },

    {
      name: "generate_logo_image",
      description:
        "Render a logo using OpenAI gpt-image-1. Provide a self-contained prompt — the model gets nothing else. Returns a handle (e.g. 'img-1') that you can later pass to evaluate_logo_image. Don't include the base64 in your reasoning — the system caches it for you.",
      input_schema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "Full image-generation prompt. Must include brand name, style direction, transparency requirement, scale ('fill 80-90% of canvas'), and any color guidance. Be explicit — gpt-image-1 follows literal instructions.",
          },
          styleHint: {
            type: "string",
            description: "Short label for this variation (e.g. 'Modern bold', 'Vintage emblem'). Used for the saved logo's customName.",
          },
        },
        required: ["prompt", "styleHint"],
      },
      handler: async (input) => {
        const prompt = String(input.prompt || "");
        const styleHint = String(input.styleHint || "Logo");
        if (!prompt) return { error: "Empty prompt" };

        try {
          const base64 = await openaiClient.generateImage(prompt, {
            size: "1024x1024",
            quality: "high",
            transparent: true,
          });
          if (!base64) return { error: "Provider returned no image" };
          const handle = `img-${ctx.images.size + 1}`;
          ctx.images.set(handle, { base64, prompt, styleHint });
          return {
            handle,
            sizeBytes: base64.length,
            note: "Image cached. Call evaluate_logo_image with this handle to score it.",
          };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Image generation failed" };
        }
      },
    },

    {
      name: "evaluate_logo_image",
      description:
        "Score a generated logo using Claude vision. Returns a 1-10 quality score plus specific issues (e.g. 'brand name misspelled', 'too small / lots of empty padding', 'background not transparent', 'text illegible'). Use this BEFORE returning the final logo set to the user — rerun any image scoring < 7.",
      input_schema: {
        type: "object",
        properties: {
          handle: {
            type: "string",
            description: "The image handle returned by generate_logo_image (e.g. 'img-1').",
          },
          expectedBrandName: {
            type: "string",
            description: "The exact brand name that should appear in the logo. Case-sensitive.",
          },
        },
        required: ["handle", "expectedBrandName"],
      },
      handler: async (input) => {
        const handle = String(input.handle || "");
        const expectedBrandName = String(input.expectedBrandName || "");
        const cached = ctx.images.get(handle);
        if (!cached) return { error: `No image found for handle "${handle}"` };

        const evalPrompt = `Evaluate this generated logo image.

Brand name expected: "${expectedBrandName}"

Score the logo 1-10 on overall quality and report:
- Is the brand name spelled correctly and clearly readable?
- Does the logo fill at least 70% of the canvas, or is it too small with excessive padding?
- Is the background transparent (or appears to be)?
- Are there spelling errors, garbled text, or weird artifacts?
- Is the design coherent and professional?

Reply ONLY with valid JSON: { "score": <1-10>, "brandNameCorrect": <bool>, "fillsCanvas": <bool>, "issues": ["issue 1", "issue 2"], "verdict": "<one-line summary>" }`;

        try {
          const response = await anthropic.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 600,
            messages: [{
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: "image/png", data: cached.base64 },
                },
                { type: "text", text: evalPrompt },
              ],
            }],
          });

          const textBlock = response.content.find((b) => b.type === "text");
          const text = textBlock?.type === "text" ? textBlock.text : "";
          // Try to parse JSON out of the response
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              return JSON.parse(match[0]);
            } catch {
              // fall through
            }
          }
          return { score: 5, verdict: text.slice(0, 200), issues: ["could not parse evaluator response"] };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Evaluation failed" };
        }
      },
    },
  ];
}
