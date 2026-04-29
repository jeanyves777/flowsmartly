/**
 * Flat Image Agent — produces a polished, print-ready FLAT design.
 *
 * v2 architecture: ChatGPT-style direct call to gpt-image-1.edit with
 * multi-image input. The agent's job is to write a great design brief
 * and call compose_design ONCE — the model handles composition,
 * lighting, shadow integration, typography natively. No more
 * multi-step pipelines (rembg + sharp.composite + drop-shadow chains)
 * because the model does all of that better than we ever could.
 *
 * Why this works: gpt-image-1 since 2025-04 accepts an array of input
 * images via images.edit({ image: [photo1, photo2, ...] }). Pass the
 * user's reference + brand logo + a comprehensive prompt and the model
 * outputs a fully-integrated polished design.
 *
 * The agent still has tools for refinement (edit_image), color grade,
 * critique. Just no more step-by-step compositing.
 */

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import sharp from "sharp";
import {
  ImageStore,
  resolveToBuffer,
  composeDesign,
  editImage as edImage,
  loadBrandLogo,
  generateQrCode,
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

export async function runFlatImageAgent(brief: FlatImageBrief): Promise<FlatImageResult> {
  const store = new ImageStore();
  const critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }> = [];
  let finalImageId: string | null = null;

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
        note: "user-uploaded reference photo",
      });
    } catch (err) {
      console.warn("[FlatImageAgent] failed to load reference image (continuing without it):", err);
    }
  }

  // Pre-load brand logo if supplied.
  let logoHandle: string | null = null;
  if (brief.brand?.logoUrl) {
    try {
      const r = await loadBrandLogo(store, { logo_url: brief.brand.logoUrl });
      logoHandle = r.image_id;
    } catch (err) {
      console.warn("[FlatImageAgent] failed to load brand logo (continuing without it):", err);
    }
  }

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }],
  });

  const tools = [
    tool(
      "compose_design",
      "PRIMARY tool — produces the entire polished design in ONE call to gpt-image-1.edit with multiple input images. Pass the input image_ids (user reference + brand logo if available + any other refs) and a comprehensive prompt describing the design. The model handles composition, lighting, shadow integration, typography natively. This is how ChatGPT actually generates polished designs. Returns image_id of the finished design.",
      {
        prompt: z.string().describe(
          "DETAILED design brief: composition (layout zones, panels, splits), color treatment, typography (headline/subhead sizes, font feel), how to integrate the input images (the first input is usually a person — describe their placement, scale, lighting), decorative elements (gold dividers, sun-rays, ribbon banners, frames), brand palette, mood. The richer the prompt the better. Write 200-400 words, concrete and visual. Include the EXACT copy text that must appear on the design.",
        ),
        image_ids: z.array(z.string()).describe(
          "Image handles to pass as inputs in priority order. Always include the user's reference photo if available. Include the brand logo if helpful. Multiple references are fine.",
        ),
        quality: z.enum(["low", "medium", "high"]).optional(),
      },
      async (args) => ok(await composeDesign(store, {
        prompt: args.prompt,
        image_ids: args.image_ids,
        width: brief.width,
        height: brief.height,
        quality: args.quality,
      })),
    ),
    tool(
      "edit_image",
      "Refine an existing design with a new instruction (gpt-image-1.edit single-image). Use when critique flags something fixable: 'enlarge the headline by 30%', 'shift the photo down 5%', 'replace the bg gradient with a brand-green panel'. Returns a NEW image_id.",
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
      "generate_qr_code",
      "Generate a QR code as a square PNG. Useful for event flyers (RSVP URL), business cards (vCard), promo posters. Then pass the resulting image_id into compose_design's image_ids so gpt-image-1 places it naturally in the design.",
      {
        text: z.string(),
        size: z.number().optional(),
        fg_color: z.string().optional(),
        bg_color: z.string().optional(),
      },
      async (args) => ok(await generateQrCode(store, args)),
    ),
    tool(
      "critique_design",
      "Get a candid Claude-vision review of the design against the brief. Returns verdict (ship|iterate), score 1-10, suggestions. Call BEFORE finalize.",
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
      "TERMINAL TOOL — call when the design is ready. Pass the final image_id. Stops the loop. After finalize, do not call more tools or write text.",
      { image_id: z.string() },
      async (args) => {
        if (!store.has(args.image_id)) {
          return ok({ error: `unknown image_id: ${args.image_id}` });
        }
        finalImageId = args.image_id;
        return ok({ ok: true, message: "Design finalized." });
      },
    ),
  ];

  const server = createSdkMcpServer({
    name: "flat_image_engine",
    version: "2.0.0",
    tools,
    alwaysLoad: true,
  });

  const allowedTools = tools.map((t) => `mcp__flat_image_engine__${t.name}`);

  const systemPrompt = buildSystemPrompt(brief, referenceHandle, logoHandle);
  const userPrompt = buildUserMessage(brief, referenceHandle, logoHandle, store);

  let iterations = 0;
  const toolsUsed: string[] = [];
  let totalCostUsd: number | undefined;

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      mcpServers: { flat_image_engine: server },
      allowedTools,
      // Sonnet 4.6 — instruction-following matters most here.
      model: "claude-sonnet-4-6",
      canUseTool: async () => ({ behavior: "allow" as const, updatedInput: {} }),
      maxTurns: 12,
      pathToClaudeCodeExecutable: getClaudeCodeBinaryPath(),
      stderr: (msg: string) => console.error(`[flat-agent/cli] ${msg.trimEnd()}`),
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

function buildSystemPrompt(_brief: FlatImageBrief, hasReference: string | null, hasLogo: string | null): string {
  return `You are FlowAI Flat-Image Engine v2 — a senior creative director with hands-on tools producing one polished, print-ready FLAT design.

Architecture: this engine works the way ChatGPT's image generation does. ONE call to compose_design (which wraps gpt-image-1.edit with multiple input images) produces the entire design. The model handles composition, lighting, shadow integration, typography. You do NOT need to manually composite layers — gpt-image-1 does it natively and far better than any sharp.composite chain.

Tool inventory (all reachable via the flat_image_engine MCP server):
- compose_design — PRIMARY. Generate the full polished design in one call. Pass image_ids (user reference + logo) + a rich prompt.
- edit_image — refine an existing design with a new instruction.
- generate_qr_code — make a QR PNG to include in image_ids.
- critique_design — Claude-vision review (ship/iterate + suggestions).
- finalize — TERMINAL: commits the design and stops the loop.

WORKFLOW:
${hasReference ? `   1. Call compose_design with image_ids = [user_reference${hasLogo ? ", brand_logo" : ""}${hasLogo === null ? "" : ""}] and a DETAILED prompt (200-400 words). The prompt must:
      - Describe the composition (panels, splits, color zones)
      - Describe how to integrate the user's photo (placement, scale, lighting, framing — polaroid? hero on right? left third?)
      - Spell out typography hierarchy (headline ≥3× body, font feel)
      - Name decorative elements (gold dividers, sun-rays, ribbon banners, frames, etc.)
      - Include the EXACT copy text from the brief
      - Reference brand palette + voice
   2. critique_design ONCE.
   3. If "iterate" → ONE call to edit_image to fix the top suggestion → critique once more → finalize.
   4. If "ship" → finalize immediately.
   You will be CUT OFF at 12 turns. Don't iterate more than once.
` : `   1. Call compose_design with image_ids = [${hasLogo ? "brand_logo" : ""}] (or [] if no logo) and a detailed prompt that describes the entire design from scratch.
   2. critique_design ONCE → ship or one fix → finalize.
`}

QUALITY BAR — agency-grade output:
- The compose_design prompt is YOUR creative work. Spend tokens here. The richer/more visual the prompt, the better the output.
- Reference real-world flyer compositions: panel splits, polaroid stacks, angled tickets, ribbon banners, gold dividers, sponsor strips, QR codes.
- Magazine-grade typographic hierarchy: headline ≥3× body, one display + one body font, left-aligned to a single guide.
- Text and the user's photo MUST NOT collide.
- Use the EXACT copy from the brief.
- Edge-to-edge, ≥4% margins, no AI watermarks.

Innovate. Be specific. The compose_design prompt is the whole game now — make it sing.`;
}

function buildUserMessage(brief: FlatImageBrief, refHandle: string | null, logoHandle: string | null, store: ImageStore): string {
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
  lines.push(`## Pre-loaded image handles (pass these to compose_design's image_ids)`);
  if (refHandle) {
    lines.push(`- ${store.describe(refHandle)} ← user's actual subject; MUST appear in the design naturally integrated`);
  }
  if (logoHandle) {
    lines.push(`- ${store.describe(logoHandle)} ← brand logo; place top-left or in footer`);
  }
  if (!refHandle && !logoHandle) {
    lines.push(`(none — design from scratch)`);
  }
  lines.push("");
  lines.push(`## Your turn`);
  lines.push(`Write a rich compose_design prompt and call it. Then critique once. Then finalize.`);
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
  if (brief.referenceImageUrl) lines.push(`User reference photo MUST appear in the result, naturally integrated.`);
  if (brief.vibe) lines.push(`Vibe: ${brief.vibe}`);
  return lines.join("\n");
}
