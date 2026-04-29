/**
 * Editable Design Agent — produces a polished design WITH editable
 * Fabric layers extracted, ready for the Studio editor.
 *
 * Built on the official Claude Agent SDK. Same architecture as the
 * flat agent, with one key difference: the `finalize` tool runs
 * reproduceTemplate() over the chosen image to extract editable
 * Fabric layers (every text block, photo slot, decorative accent
 * becomes a separate editable object). The user's bg-removed cutout
 * is dropped into the photo placeholder so they see their real photo
 * in the editor.
 *
 * Per user direction: "do no mix them each must have his own agent" —
 * separate file, separate prompt, separate tool curation, separate
 * terminal contract.
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
import { reproduceTemplate } from "./template-reproduce-agent";

export interface EditableDesignBrief {
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

export interface EditableDesignResult {
  imageDataUrl: string;
  width: number;
  height: number;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    objects: Record<string, unknown>[];
  };
  iterations: number;
  toolsUsed: string[];
  totalCostUsd?: number;
  critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }>;
}

export async function runEditableDesignAgent(brief: EditableDesignBrief): Promise<EditableDesignResult> {
  const store = new ImageStore();
  const critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }> = [];
  let finalImageId: string | null = null;
  let finalCanvas: EditableDesignResult["canvas"] | null = null;
  let cutoutHandle: string | null = null;

  // Pre-load reference photo if supplied.
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
        note: "user-uploaded reference photo (raw)",
      });
    } catch (err) {
      console.warn("[EditableDesignAgent] failed to load reference image (continuing):", err);
    }
  }

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }],
  });

  const tools = [
    tool(
      "generate_image",
      "Draft a fresh image via gpt-image-1. Use for the BACKGROUND or initial composition. Returns image_id.",
      {
        prompt: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        quality: z.enum(["low", "medium", "high"]).optional(),
      },
      async (args) => ok(await genImage(store, {
        prompt: args.prompt,
        width: args.width ?? brief.width,
        height: args.height ?? brief.height,
        quality: args.quality,
      })),
    ),
    tool(
      "edit_image",
      "Revise an image via gpt-image-1.edit. Returns a new image_id.",
      {
        image_id: z.string(),
        instruction: z.string(),
      },
      async (args) => ok(await edImage(store, {
        image_id: args.image_id,
        instruction: args.instruction,
        width: brief.width,
        height: brief.height,
      })),
    ),
    tool(
      "remove_background",
      "Strip the background from an image via rembg. Returns a transparent-PNG handle.",
      { image_id: z.string() },
      async (args) => {
        const r = await removeImageBackground(store, { image_id: args.image_id });
        if (!cutoutHandle) cutoutHandle = r.image_id;
        return ok(r);
      },
    ),
    tool(
      "composite_images",
      "Layer images on top of a base. Each overlay positioned by percent.",
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
      async (args) => ok(await compositeImages(store, args)),
    ),
    tool(
      "color_grade",
      "Tweak saturation / brightness / hue. Returns a new image_id.",
      {
        image_id: z.string(),
        saturation: z.number().optional(),
        brightness: z.number().optional(),
        hue: z.number().optional(),
      },
      async (args) => ok(await colorGrade(store, args)),
    ),
    tool(
      "add_drop_shadow",
      "Soft drop shadow from alpha. Grounds cutouts.",
      {
        image_id: z.string(),
        blur_radius: z.number().optional(),
        opacity: z.number().optional(),
        offset_x: z.number().optional(),
        offset_y: z.number().optional(),
      },
      async (args) => ok(await addDropShadow(store, args)),
    ),
    tool(
      "critique_design",
      "Claude-vision review. Returns verdict (ship|iterate), score 1-10, suggestions. Critique an editable design especially for: clean separability of text blocks, photo placement that vision can reverse-engineer cleanly, hierarchy.",
      { image_id: z.string() },
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
      "TERMINAL TOOL — commits the editable design. The system runs Claude vision over your final image to extract Fabric layers (every text block, shape, photo slot becomes editable). The user's reference cutout is dropped into the photo placeholder. After finalize, do not call more tools or write text.",
      { image_id: z.string() },
      async (args) => {
        if (!store.has(args.image_id)) {
          return ok({ error: `unknown image_id: ${args.image_id}` });
        }
        const finalImg = store.get(args.image_id);

        const refForLayers: string[] = [];
        if (cutoutHandle && store.has(cutoutHandle)) {
          const c = store.get(cutoutHandle);
          refForLayers.push(`data:${c.mimeType};base64,${c.buffer.toString("base64")}`);
        } else if (referenceHandle && store.has(referenceHandle)) {
          const r = store.get(referenceHandle);
          refForLayers.push(`data:${r.mimeType};base64,${r.buffer.toString("base64")}`);
        }

        const dataUrl = `data:${finalImg.mimeType};base64,${finalImg.buffer.toString("base64")}`;
        const reproduce = await reproduceTemplate(dataUrl, {
          customText: brief.designText,
          brandColors: brief.brand
            ? { primary: brief.brand.primary, secondary: brief.brand.secondary, accent: brief.brand.accent }
            : null,
          brandFonts: brief.brand?.fonts ?? null,
          referenceImages: refForLayers.length > 0 ? refForLayers : undefined,
        });

        finalImageId = args.image_id;
        finalCanvas = reproduce.canvas;
        return ok({
          ok: true,
          message: `Editable design finalized — ${reproduce.canvas.objects.length} editable layers extracted. Stop calling tools.`,
          layers_count: reproduce.canvas.objects.length,
        });
      },
    ),
  ];

  const server = createSdkMcpServer({
    name: "editable_design_engine",
    version: "1.0.0",
    tools,
    alwaysLoad: true,
  });

  const allowedTools = tools.map((t) => `mcp__editable_design_engine__${t.name}`);

  const systemPrompt = buildEditableSystemPrompt(brief, referenceHandle);
  const userPrompt = buildEditableUserMessage(brief, referenceHandle, store);

  let iterations = 0;
  const toolsUsed: string[] = [];
  let totalCostUsd: number | undefined;

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      mcpServers: { editable_design_engine: server },
      allowedTools,
      permissionMode: "bypassPermissions",
      maxTurns: 12,
      pathToClaudeCodeExecutable: getClaudeCodeBinaryPath(),
      stderr: (msg: string) => console.error(`[editable-agent/cli] ${msg.trimEnd()}`),
    },
  })) {
    if (message.type === "assistant") {
      iterations++;
      const blocks = (message.message?.content ?? []) as Array<{ type?: string; name?: string }>;
      for (const b of blocks) {
        if (b.type === "tool_use" && typeof b.name === "string") toolsUsed.push(b.name);
      }
    } else if (message.type === "result") {
      const r = message as unknown as { total_cost_usd?: number };
      if (typeof r.total_cost_usd === "number") totalCostUsd = r.total_cost_usd;
    }
  }

  if (!finalImageId || !finalCanvas) {
    throw new Error(
      `Editable agent finished without calling finalize (iterations=${iterations}, tools=${toolsUsed.join(",")})`,
    );
  }

  const finalImage = store.get(finalImageId);
  const finalMeta = await sharp(finalImage.buffer).metadata();
  return {
    imageDataUrl: `data:image/png;base64,${finalImage.buffer.toString("base64")}`,
    width: finalMeta.width || brief.width,
    height: finalMeta.height || brief.height,
    canvas: finalCanvas,
    iterations,
    toolsUsed,
    totalCostUsd,
    critiqueLog,
  };
}

// ─── prompt builders ──────────────────────────────────────────────────

function buildEditableSystemPrompt(_brief: EditableDesignBrief, hasReference: string | null): string {
  return `You are FlowAI Editable-Design Engine — a senior creative director producing one polished design that will become EDITABLE Fabric layers in the Studio editor.

Your job: build a polished composition + call finalize. The system handles the editable-layer extraction (Claude vision walks your final image and emits a Fabric canvas spec where every text block, shape, and photo slot is a separately editable object).

Tool inventory (all reachable via the editable_design_engine MCP server):
- generate_image — draft a fresh image (gpt-image-1).
- edit_image — revise an image with an instruction.
- remove_background — strip a photo's background.
- composite_images — layer images at percent positions.
- color_grade — adjust saturation / brightness / hue.
- add_drop_shadow — soft shadow for cutouts.
- critique_design — Claude-vision review with verdict/score/suggestions.
- finalize — TERMINAL: extracts editable Fabric layers and commits.

Design with EDITABILITY in mind:
- Every text block in the final image will be reverse-engineered into a Fabric Textbox. Help the extractor by keeping text crisp, well-separated, and never overlapping graphics.
- Photo placement should sit in a clear, defined zone — that zone becomes a photo placeholder in the editor (filled with the user's real cutout).
- Avoid super-busy collages or heavily blended typography over photos — those reverse-engineer poorly.
- Solid / gradient / minimal-photo backgrounds reverse-engineer cleanly. Plan for that.

Process latitude is yours. Draft → critique → refine 1-3 times → finalize.

Brief specifics:
- Use the EXACT copy from the user — never invent your own headlines, names, scripture, contact info.
- ${hasReference ? "Reference photo is pre-loaded in the store. The user's actual photo MUST appear — strip its background, composite it thoughtfully into the chosen photo zone." : "No reference photo. Design from scratch."}
- Honor the brand palette and fonts but pick alternatives if the topic warrants.
- Fill the canvas edge-to-edge. No nested-card-on-bg, no AI watermarks, no placeholder rectangles.

Innovate. The brief is a brief, not a template recipe.`;
}

function buildEditableUserMessage(brief: EditableDesignBrief, refHandle: string | null, store: ImageStore): string {
  const lines: string[] = [];
  lines.push(`# Brief`);
  lines.push(`Category: ${brief.category}`);
  lines.push(`Topic: ${brief.topic}`);
  lines.push(`Canvas: ${brief.width}×${brief.height}px (will become an editable Fabric canvas)`);
  if (brief.vibe) lines.push(`Vibe: ${brief.vibe}`);
  lines.push("");
  lines.push(`## Literal copy that MUST appear`);
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
    lines.push(`The reference photo is the user's actual subject. Strip its bg via remove_background, then composite the cutout thoughtfully. The cutout will be re-used in the editor as the photo layer.`);
    lines.push("");
  }
  lines.push(`## Your turn`);
  lines.push(`Build a polished composition + call finalize. The system extracts editable layers automatically once you finalize.`);
  return lines.join("\n");
}

function buildBriefSummary(brief: EditableDesignBrief): string {
  const lines: string[] = [];
  lines.push(`Category: ${brief.category}; topic: ${brief.topic}.`);
  lines.push(`Canvas: ${brief.width}×${brief.height}.`);
  lines.push(`Required copy:\n${brief.designText}`);
  if (brief.brand) {
    const palette = [brief.brand.primary, brief.brand.secondary, brief.brand.accent].filter(Boolean).join(", ");
    if (brief.brand.name) lines.push(`Brand: ${brief.brand.name}`);
    if (palette) lines.push(`Palette: ${palette}`);
  }
  if (brief.referenceImageUrl) lines.push(`User reference photo MUST appear in the result.`);
  return lines.join("\n");
}
