/**
 * Flat Image Agent — produces a polished, print-ready FLAT design.
 *
 * Built on the official Claude Agent SDK (@anthropic-ai/claude-agent-sdk).
 * The SDK handles the tool-loop, sub-agents, hooks, permissions, and
 * lifecycle so we only write tool handlers + a system prompt.
 *
 * Architecture:
 *  - Tools live in src/lib/ai/design-tools/ as plain TypeScript
 *    functions (image-store, sharp ops, openai wrappers, rembg,
 *    Claude vision critique).
 *  - tool() wraps each function with a zod input schema. They run in
 *    THIS process — no sandbox.
 *  - createSdkMcpServer() bundles them as an in-process MCP server.
 *  - query() runs the agent loop with our system prompt + tools.
 *
 * Per user direction: "engine must be real agent at work no hardcoded
 * rul with luck of inivation" + "migrate to the SDK first" + "do no
 * mix them each must have his own agent".
 */

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import sharp from "sharp";
import {
  ImageStore,
  resolveToBuffer,
  generateImage as genImage,
  editImage as edImage,
  removeImageBackground,
  compositeImages,
  colorGrade,
  addDropShadow,
  critiqueDesign,
  getClaudeCodeBinaryPath,
} from "./design-tools";

export interface FlatImageBrief {
  category: string;
  topic: string;
  designText: string;
  width: number;
  height: number;
  brand?: {
    name?: string;
    voiceTone?: string;
    primary?: string;
    secondary?: string;
    accent?: string;
    logoUrl?: string;
    fonts?: { heading?: string; body?: string };
  };
  referenceImageUrl?: string;
  vibe?: string;
}

export interface FlatImageResult {
  imageDataUrl: string;
  width: number;
  height: number;
  iterations: number;
  toolsUsed: string[];
  totalCostUsd?: number;
  critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }>;
}

/**
 * Run the Flat Image agent against a brief. Returns the final image
 * + telemetry. Throws on hard failure.
 */
export async function runFlatImageAgent(brief: FlatImageBrief): Promise<FlatImageResult> {
  const store = new ImageStore();
  const critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }> = [];
  let finalImageId: string | null = null;

  // Pre-load the user's reference photo.
  let referenceHandle: string | null = null;
  if (brief.referenceImageUrl) {
    try {
      const buf = await resolveToBuffer(brief.referenceImageUrl);
      const meta = await sharp(buf).metadata();
      referenceHandle = store.register({
        buffer: buf,
        mimeType: "image/png",
        width: meta.width,
        height: meta.height,
        source: "user_reference",
        note: "user-uploaded reference photo",
      });
    } catch (err) {
      console.warn("[FlatImageAgent] failed to load reference image (continuing without it):", err);
    }
  }

  // ─── Tool definitions ─────────────────────────────────────────────
  // Each tool: name, description, zod schema, async handler returning
  // CallToolResult { content: [{ type: "text", text: ... }] }.
  // Handler results are JSON-stringified so the agent reads structured
  // image_id summaries.

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }],
  });

  const tools = [
    tool(
      "generate_image",
      "Draft a fresh image from a text prompt via gpt-image-1. Use this for the initial composition or to swap a background. The prompt is YOURS — describe what you want; there are no hidden layout rules. Returns image_id you can pass to other tools.",
      {
        prompt: z.string().describe("What to draft. Be specific — composition, color treatment, typography, mood."),
        width: z.number().optional(),
        height: z.number().optional(),
        quality: z.enum(["low", "medium", "high"]).optional(),
      },
      async (args) => {
        const r = await genImage(store, {
          prompt: args.prompt,
          width: args.width ?? brief.width,
          height: args.height ?? brief.height,
          quality: args.quality,
        });
        return ok(r);
      },
    ),
    tool(
      "edit_image",
      "Revise an existing image via gpt-image-1.edit. Pass the image_id and a clear instruction. Returns a NEW image_id (the original is preserved).",
      {
        image_id: z.string(),
        instruction: z.string(),
      },
      async (args) => {
        const r = await edImage(store, {
          image_id: args.image_id,
          instruction: args.instruction,
          width: brief.width,
          height: brief.height,
        });
        return ok(r);
      },
    ),
    tool(
      "remove_background",
      "Strip the background from an image via rembg. Useful for the user's reference photo before compositing. Returns a transparent-PNG handle.",
      {
        image_id: z.string(),
      },
      async (args) => {
        const r = await removeImageBackground(store, { image_id: args.image_id });
        return ok(r);
      },
    ),
    tool(
      "composite_images",
      "Layer one or more images on top of a base. Each overlay is positioned by percent (x_pct, y_pct = top-left; width_pct sizes it). Returns a new image_id with the composite.",
      {
        base_id: z.string(),
        overlays: z.array(z.object({
          image_id: z.string(),
          x_pct: z.number(),
          y_pct: z.number(),
          width_pct: z.number().optional(),
          opacity: z.number().optional(),
        })),
      },
      async (args) => {
        const r = await compositeImages(store, args);
        return ok(r);
      },
    ),
    tool(
      "color_grade",
      "Tweak saturation / brightness / hue on an image (sharp.modulate). saturation/brightness 1=neutral; hue is degrees. Returns a new image_id.",
      {
        image_id: z.string(),
        saturation: z.number().optional(),
        brightness: z.number().optional(),
        hue: z.number().optional(),
      },
      async (args) => {
        const r = await colorGrade(store, args);
        return ok(r);
      },
    ),
    tool(
      "add_drop_shadow",
      "Synthesise a soft drop shadow from an image's alpha channel — grounds a cutout subject. Returns a new image_id.",
      {
        image_id: z.string(),
        blur_radius: z.number().optional(),
        opacity: z.number().optional(),
        offset_x: z.number().optional(),
        offset_y: z.number().optional(),
      },
      async (args) => {
        const r = await addDropShadow(store, args);
        return ok(r);
      },
    ),
    tool(
      "critique_design",
      "Get a candid Claude-vision review of an in-progress image against the brief. Returns verdict (ship|iterate), score 1-10, strengths/weaknesses/suggestions. Call this BEFORE finalize.",
      {
        image_id: z.string(),
      },
      async (args) => {
        const result = await critiqueDesign(store, {
          image_id: args.image_id,
          brief: buildBriefSummary(brief),
        });
        critiqueLog.push({ score: result.score, verdict: result.verdict });
        return ok(result);
      },
    ),
    tool(
      "finalize",
      "TERMINAL TOOL — call when the design is ready to ship. Pass the final image_id. The system stops the loop and persists the result. After calling this, do not call any more tools or write any more text.",
      {
        image_id: z.string(),
      },
      async (args) => {
        if (!store.has(args.image_id)) {
          return ok({ error: `unknown image_id: ${args.image_id}` });
        }
        finalImageId = args.image_id;
        return ok({ ok: true, message: "Design finalized. Stop calling tools." });
      },
    ),
  ];

  const server = createSdkMcpServer({
    name: "flat_image_engine",
    version: "1.0.0",
    tools,
    alwaysLoad: true,
  });

  const allowedTools = tools.map((t) => `mcp__flat_image_engine__${t.name}`);

  const systemPrompt = buildFlatSystemPrompt(brief, referenceHandle);
  const userPrompt = buildFlatUserMessage(brief, referenceHandle, store);

  // ─── Run the SDK agent loop ──────────────────────────────────────
  let iterations = 0;
  const toolsUsed: string[] = [];
  let totalCostUsd: number | undefined;

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      mcpServers: { flat_image_engine: server },
      allowedTools,
      permissionMode: "bypassPermissions",
      maxTurns: 12,
      pathToClaudeCodeExecutable: getClaudeCodeBinaryPath(),
    },
  })) {
    if (message.type === "assistant") {
      iterations++;
      const blocks = (message.message?.content ?? []) as Array<{ type?: string; name?: string }>;
      for (const b of blocks) {
        if (b.type === "tool_use" && typeof b.name === "string") toolsUsed.push(b.name);
      }
    } else if (message.type === "result") {
      // SDK's terminal message — surface cost telemetry if exposed.
      const r = message as unknown as { total_cost_usd?: number };
      if (typeof r.total_cost_usd === "number") totalCostUsd = r.total_cost_usd;
    }
  }

  if (!finalImageId) {
    throw new Error(
      `Flat agent finished without calling finalize (iterations=${iterations}, tools=${toolsUsed.join(",")})`,
    );
  }

  const finalImage = store.get(finalImageId);
  const finalMeta = await sharp(finalImage.buffer).metadata();
  return {
    imageDataUrl: `data:image/png;base64,${finalImage.buffer.toString("base64")}`,
    width: finalMeta.width || brief.width,
    height: finalMeta.height || brief.height,
    iterations,
    toolsUsed,
    totalCostUsd,
    critiqueLog,
  };
}

// ─── prompt builders ──────────────────────────────────────────────────

function buildFlatSystemPrompt(_brief: FlatImageBrief, hasReference: string | null): string {
  return `You are FlowAI Flat-Image Engine — a senior creative director with hands-on tools producing one polished, print-ready FLAT design.

Your job: read the brief in the next user message, decide your approach, and use the tools to draft, refine, and finalize ONE design. There is no fixed workflow — you pick it.

Tool inventory (all reachable via the flat_image_engine MCP server):
- generate_image — draft a fresh image from a text prompt (gpt-image-1).
- edit_image — revise an image with a new instruction.
- remove_background — strip the background from a photo.
- composite_images — layer images at percent positions.
- color_grade — adjust saturation / brightness / hue.
- add_drop_shadow — soft shadow synthesised from alpha.
- critique_design — Claude-vision self-review with verdict, score, suggestions.
- finalize — TERMINAL: commits the design and stops the loop.

How to think about this:
- The brief gives you the literal copy that MUST appear on the design (headline, dates, contact, CTA). Use those exact words. Do not invent your own.
- ${hasReference ? "A reference photo is pre-loaded in the image store. The user's actual photo MUST appear in the result — do NOT regenerate the subject. Strip its background and composite it thoughtfully." : "No reference photo. You're producing a design from scratch."}
- Brand context (colors, fonts, voice) is given. Honor it but don't be slavish.
- Iterate. After your first draft, call critique_design and act on its suggestions. Repeat until critique returns "ship" OR you've done 2-3 refinement passes.
- When confident, call finalize with the chosen image_id. After finalize, do not write more text or call more tools.

Quality you are aiming for:
- Magazine-grade typographic hierarchy. Composition that feels intentional.
- Text and any composited subject MUST NOT collide.
- Every word from the brief is visible and readable.
- The design fills the canvas edge-to-edge — no nested-card-on-background.
- No AI provider watermarks, no model branding, no placeholder boxes.

Latitude and innovation are encouraged — surprise the user. The brief is a brief, not a recipe.`;
}

function buildFlatUserMessage(brief: FlatImageBrief, refHandle: string | null, store: ImageStore): string {
  const lines: string[] = [];
  lines.push(`# Brief`);
  lines.push(`Category: ${brief.category}`);
  lines.push(`Topic: ${brief.topic}`);
  lines.push(`Canvas: ${brief.width}×${brief.height}px`);
  if (brief.vibe) lines.push(`Vibe: ${brief.vibe}`);
  lines.push("");
  lines.push(`## Literal copy that MUST appear on the design`);
  lines.push(brief.designText);
  lines.push("");
  if (brief.brand) {
    lines.push(`## Brand`);
    if (brief.brand.name) lines.push(`Name: ${brief.brand.name}`);
    if (brief.brand.voiceTone) lines.push(`Voice/tone: ${brief.brand.voiceTone}`);
    const palette = [brief.brand.primary, brief.brand.secondary, brief.brand.accent].filter(Boolean).join(", ");
    if (palette) lines.push(`Palette: ${palette}`);
    if (brief.brand.fonts?.heading || brief.brand.fonts?.body) {
      lines.push(`Fonts: heading=${brief.brand.fonts.heading || "(your pick)"}, body=${brief.brand.fonts.body || "(your pick)"}`);
    }
    lines.push("");
  }
  if (refHandle) {
    lines.push(`## Pre-loaded image handles`);
    lines.push(store.describe(refHandle));
    lines.push("");
    lines.push(`The reference photo is the user's actual subject. It must appear in the final design — strip its bg and composite it. Do NOT regenerate this subject.`);
    lines.push("");
  }
  lines.push(`## Your turn`);
  lines.push(`Produce one polished design and call finalize when you're confident. Use critique_design at least once before finalize to sanity-check.`);
  return lines.join("\n");
}

function buildBriefSummary(brief: FlatImageBrief): string {
  const lines: string[] = [];
  lines.push(`Category: ${brief.category}; topic: ${brief.topic}.`);
  lines.push(`Canvas: ${brief.width}×${brief.height}.`);
  lines.push(`Required copy:\n${brief.designText}`);
  if (brief.brand) {
    const palette = [brief.brand.primary, brief.brand.secondary, brief.brand.accent].filter(Boolean).join(", ");
    if (brief.brand.name) lines.push(`Brand: ${brief.brand.name}`);
    if (palette) lines.push(`Palette: ${palette}`);
    if (brief.brand.voiceTone) lines.push(`Voice: ${brief.brand.voiceTone}`);
  }
  if (brief.referenceImageUrl) lines.push(`User reference photo MUST appear in the result.`);
  if (brief.vibe) lines.push(`Vibe: ${brief.vibe}`);
  return lines.join("\n");
}
