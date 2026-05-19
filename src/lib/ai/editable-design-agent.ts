/**
 * Editable Design Agent v2 — composition-graph architecture.
 *
 * Old approach: agent built a flat polished image, then reproduceTemplate
 * (Claude vision) tried to reverse-engineer Fabric layers from the
 * pixels. This was lossy — vision routinely missed photo placeholders,
 * decorative shapes, color panels, sun-rays. The user opened the editor
 * and saw a stripped-down version of the design.
 *
 * New approach: the agent thinks in LAYERS as it builds. Each tool call
 * appends a Fabric layer descriptor to a CompositionGraph. At finalize:
 *   - Render preview image from the graph (sharp.composite stack).
 *   - Build Fabric canvas spec directly from the graph — lossless.
 *
 * The agent's intent IS the canvas spec. Nothing has to be inferred.
 */

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import sharp from "sharp";
import {
  ImageStore,
  resolveToBuffer,
  generateImage as genImage,
  removeImageBackground,
  loadBrandLogo,
  generateQrCode,
  critiqueDesign,
  getClaudeCodeBinaryPath,
  CompositionGraph,
  type FabricCanvasSpec,
} from "./design-tools";

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
  canvas: FabricCanvasSpec;
  iterations: number;
  toolsUsed: string[];
  totalCostUsd?: number;
  critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }>;
}

export async function runEditableDesignAgent(brief: EditableDesignBrief): Promise<EditableDesignResult> {
  const store = new ImageStore();
  const graph = new CompositionGraph(brief.width, brief.height);
  const critiqueLog: Array<{ score: number; verdict: "ship" | "iterate" }> = [];
  let finalized = false;

  // Pre-load reference photo + brand logo as image handles.
  let referenceHandle: string | null = null;
  let cutoutHandle: string | null = null;
  let logoHandle: string | null = null;

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
      console.warn("[EditableDesignAgent] failed to load reference (continuing):", err);
    }
  }

  if (brief.brand?.logoUrl) {
    try {
      const r = await loadBrandLogo(store, { logo_url: brief.brand.logoUrl });
      logoHandle = r.image_id;
    } catch (err) {
      console.warn("[EditableDesignAgent] failed to load brand logo (continuing):", err);
    }
  }

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }],
  });

  const dataUrl = (id: string): string => {
    const img = store.get(id);
    return `data:${img.mimeType};base64,${img.buffer.toString("base64")}`;
  };

  const tools = [
    // ── Layer-emitting tools — every call mutates the composition graph.
    tool(
      "set_canvas_background_color",
      "Set the canvas background to a solid color. Always call this once first to anchor the design palette. Pass a hex color matching the brand palette or topic vibe.",
      { color: z.string() },
      async (args) => {
        graph.setBackgroundColor(args.color);
        return ok({ ok: true, message: `bg color = ${args.color}`, layer_count: graph.size() });
      },
    ),
    tool(
      "set_canvas_background_gradient",
      "Set the canvas background to a linear gradient. angle in degrees, stops as [{offset 0-1, color hex}].",
      {
        angle: z.number(),
        stops: z.array(z.object({ offset: z.number(), color: z.string() })),
      },
      async (args) => {
        graph.addLayer({ kind: "background_gradient", angle: args.angle, stops: args.stops });
        return ok({ ok: true, layer_count: graph.size() });
      },
    ),
    tool(
      "generate_background_image",
      "Generate a STYLED BACKGROUND image via gpt-image-1 and add it as the canvas background layer. The prompt must describe ONLY the bg — no people, no text. Returns image_id.",
      {
        prompt: z.string().describe("Background ONLY. No people, no text, no headlines. Describe colour panels, gradients, decorative scenes."),
      },
      async (args) => {
        const r = await genImage(store, {
          prompt: args.prompt,
          width: brief.width,
          height: brief.height,
          quality: "high",
        });
        graph.replaceLast("background_image", { kind: "background_image", src: dataUrl(r.image_id) });
        return ok({ ...r, layer_count: graph.size() });
      },
    ),
    tool(
      "remove_subject_background",
      "Strip the background from the pre-loaded reference photo. Returns a transparent-bg cutout image_id you can place via add_photo_layer.",
      { image_id: z.string() },
      async (args) => {
        const r = await removeImageBackground(store, { image_id: args.image_id });
        cutoutHandle = r.image_id;
        return ok(r);
      },
    ),
    tool(
      "add_photo_layer",
      "Place an image as a layer on the canvas. left/top/width/height in canvas pixels. left+top is the TOP-LEFT corner; the image extends right and DOWN from there. role hints what the photo is (user_photo, logo, qr, decorative).",
      {
        image_id: z.string(),
        left: z.number(),
        top: z.number(),
        width: z.number(),
        height: z.number(),
        angle: z.number().optional(),
        opacity: z.number().optional(),
        role: z.string().optional(),
      },
      async (args) => {
        // Validate coordinates against canvas bounds. Fail fast and tell
        // the agent exactly what's wrong so it can correct on retry.
        const issues: string[] = [];
        if (args.left < 0 || args.top < 0) {
          issues.push(`left=${args.left} top=${args.top} are NEGATIVE. Coordinates must be >= 0. Top-left of canvas is (0, 0).`);
        }
        if (args.left + args.width > brief.width + 4) {
          issues.push(`Image extends past right edge: left(${args.left}) + width(${args.width}) = ${args.left + args.width} > canvas width ${brief.width}.`);
        }
        if (args.top + args.height > brief.height + 4) {
          issues.push(`Image extends past bottom edge: top(${args.top}) + height(${args.height}) = ${args.top + args.height} > canvas height ${brief.height}.`);
        }
        if (issues.length > 0) {
          throw new Error(
            `add_photo_layer: out-of-bounds placement.\n${issues.join("\n")}\nCanvas is ${brief.width}x${brief.height}. Pick left/top/width/height so the image fits entirely inside (0,0) → (${brief.width},${brief.height}).`,
          );
        }
        graph.addLayer({
          kind: "image",
          src: dataUrl(args.image_id),
          left: args.left,
          top: args.top,
          width: args.width,
          height: args.height,
          angle: args.angle,
          opacity: args.opacity,
          role: args.role,
        });
        return ok({ ok: true, layer_count: graph.size() });
      },
    ),
    tool(
      "add_text_layer",
      "Add an editable text layer (Fabric Textbox in the editor — fully editable). REQUIRED for every text block on the design (headline, subhead, contact info, CTA, etc). Don't bake text into gpt-image-1; create separate text layers here so the user can edit them in the canvas.",
      {
        text: z.string(),
        left: z.number(),
        top: z.number(),
        width: z.number(),
        font_size: z.number(),
        font_family: z.string(),
        font_weight: z.string().optional(),
        font_style: z.string().optional(),
        text_align: z.enum(["left", "center", "right"]).optional(),
        fill: z.string(),
        line_height: z.number().optional(),
        char_spacing: z.number().optional(),
        role: z.enum(["headline", "subheadline", "body", "cta", "caption", "contact", "brand"]).optional(),
      },
      async (args) => {
        graph.addLayer({
          kind: "text",
          text: args.text,
          left: args.left,
          top: args.top,
          width: args.width,
          fontSize: args.font_size,
          fontFamily: args.font_family,
          fontWeight: args.font_weight,
          fontStyle: args.font_style,
          textAlign: args.text_align,
          fill: args.fill,
          lineHeight: args.line_height,
          charSpacing: args.char_spacing,
          role: args.role,
        });
        return ok({ ok: true, layer_count: graph.size() });
      },
    ),
    tool(
      "add_rect_layer",
      "Add a rectangle layer — color panels, accent bars, ribbon banners, badge backgrounds. left/top/width/height in canvas px.",
      {
        left: z.number(),
        top: z.number(),
        width: z.number(),
        height: z.number(),
        fill: z.string(),
        stroke: z.string().optional(),
        stroke_width: z.number().optional(),
        rx: z.number().optional(),
        ry: z.number().optional(),
        angle: z.number().optional(),
        opacity: z.number().optional(),
      },
      async (args) => {
        graph.addLayer({
          kind: "rect",
          left: args.left,
          top: args.top,
          width: args.width,
          height: args.height,
          fill: args.fill,
          stroke: args.stroke,
          strokeWidth: args.stroke_width,
          rx: args.rx,
          ry: args.ry,
          angle: args.angle,
          opacity: args.opacity,
        });
        return ok({ ok: true, layer_count: graph.size() });
      },
    ),
    tool(
      "add_circle_layer",
      "Add a circle layer — sun-burst centerpoint, badge backdrop, decorative dot.",
      {
        left: z.number(),
        top: z.number(),
        radius: z.number(),
        fill: z.string(),
        stroke: z.string().optional(),
        stroke_width: z.number().optional(),
        opacity: z.number().optional(),
      },
      async (args) => {
        graph.addLayer({
          kind: "circle",
          left: args.left,
          top: args.top,
          radius: args.radius,
          fill: args.fill,
          stroke: args.stroke,
          strokeWidth: args.stroke_width,
          opacity: args.opacity,
        });
        return ok({ ok: true, layer_count: graph.size() });
      },
    ),
    tool(
      "add_line_layer",
      "Add a line layer — gold dividers under headlines, accent rules above contact blocks, separator strokes.",
      {
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
        stroke: z.string(),
        stroke_width: z.number().optional(),
      },
      async (args) => {
        graph.addLayer({
          kind: "line",
          x1: args.x1,
          y1: args.y1,
          x2: args.x2,
          y2: args.y2,
          stroke: args.stroke,
          strokeWidth: args.stroke_width,
        });
        return ok({ ok: true, layer_count: graph.size() });
      },
    ),
    tool(
      "generate_qr_code",
      "Generate a QR code as a square PNG. Returns image_id you can pass to add_photo_layer to place on the canvas.",
      {
        text: z.string(),
        size: z.number().optional(),
        fg_color: z.string().optional(),
        bg_color: z.string().optional(),
      },
      async (args) => ok(await generateQrCode(store, args)),
    ),
    tool(
      "list_layers",
      "List the current composition layers in order. Useful for sanity-checking your composition before finalize.",
      {},
      async () => ok({ layer_count: graph.size(), inventory: graph.inventory() }),
    ),
    tool(
      "critique_composition",
      "Render the current composition graph as a preview image and get a Claude-vision critique against the brief. Returns verdict (ship|iterate), score 1-10, suggestions. Call BEFORE finalize.",
      {},
      async () => {
        const previewBuf = await renderComposition(graph, store);
        const previewId = store.register({
          buffer: previewBuf,
          mimeType: "image/png",
          width: brief.width,
          height: brief.height,
          source: "composited",
          note: "preview render of composition graph",
        });
        const result = await critiqueDesign(store, {
          image_id: previewId,
          brief: buildBriefSummary(brief),
        });
        critiqueLog.push({ score: result.score, verdict: result.verdict });
        return ok(result);
      },
    ),
    tool(
      "finalize",
      "TERMINAL TOOL — commits the editable design. The composition graph IS the canvas spec (lossless). The system also renders a preview image from the graph for the chat result card. After finalize, do not call more tools or write text.",
      {},
      async () => {
        finalized = true;
        return ok({ ok: true, message: "Design finalized.", layer_count: graph.size() });
      },
    ),
  ];

  const server = createSdkMcpServer({
    name: "editable_design_engine",
    version: "2.0.0",
    tools,
    alwaysLoad: true,
  });

  const allowedTools = tools.map((t) => `mcp__editable_design_engine__${t.name}`);

  const systemPrompt = buildSystemPrompt(brief, referenceHandle, logoHandle);
  const userPrompt = buildUserMessage(brief, referenceHandle, logoHandle, store);

  let iterations = 0;
  const toolsUsed: string[] = [];
  let totalCostUsd: number | undefined;

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      mcpServers: { editable_design_engine: server },
      allowedTools,
      model: "claude-haiku-4-5-20251001",
      canUseTool: async () => ({ behavior: "allow" as const, updatedInput: {} }),
      maxTurns: 30,
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

  if (!finalized || graph.size() === 0) {
    throw new Error(
      `Editable agent finished without finalizing or with empty graph (iterations=${iterations}, layers=${graph.size()}, tools=${toolsUsed.join(",")})`,
    );
  }

  // Use cutout if available — drop into composition automatically? No,
  // the agent already added it via add_photo_layer with the cutout id.
  // (cutoutHandle is just bookkeeping in case the dispatcher wants the
  // raw cutout for any post-processing.)
  void cutoutHandle;

  // Render the preview image from the graph.
  const previewBuf = await renderComposition(graph, store);
  const finalCanvas = graph.toCanvasSpec();

  return {
    imageDataUrl: `data:image/png;base64,${previewBuf.toString("base64")}`,
    width: brief.width,
    height: brief.height,
    canvas: finalCanvas,
    iterations,
    toolsUsed,
    totalCostUsd,
    critiqueLog,
  };
}

// ─── Server-side composition renderer ─────────────────────────────────
// Renders the composition graph as a PNG for the preview image. Uses
// sharp.composite for image layers + svg overlays for text/shapes/lines.
// This is best-effort — text rendering via svg has font-loading limits;
// the editor canvas always shows the precise truth via Fabric.
async function renderComposition(graph: CompositionGraph, _store: ImageStore): Promise<Buffer> {
  const spec = graph.toCanvasSpec();
  const W = spec.width;
  const H = spec.height;

  // Start with the bg color.
  let canvas = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: hexToRgb(spec.backgroundColor),
    },
  })
    .png()
    .toBuffer();

  // Walk objects in order, compositing each onto the canvas.
  const composites: sharp.OverlayOptions[] = [];
  for (const obj of spec.objects) {
    const o = obj as Record<string, unknown>;
    const type = String(o.type || "");
    if (type === "image" && typeof o.src === "string") {
      const src = o.src;
      let buf: Buffer;
      if (src.startsWith("data:")) {
        buf = Buffer.from(src.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
      } else {
        try {
          buf = await resolveToBuffer(src);
        } catch {
          continue;
        }
      }
      const targetW = typeof o.width === "number" ? Math.round(o.width) : 100;
      const targetH = typeof o.height === "number" ? Math.round(o.height) : 100;
      const angle = typeof o.angle === "number" ? o.angle : 0;
      let layer = sharp(buf).resize(targetW, targetH, { fit: "inside" });
      if (angle !== 0) {
        layer = layer.rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
      }
      const layerBuf = await layer.png().toBuffer();
      composites.push({
        input: layerBuf,
        left: Math.round((o.left as number) || 0),
        top: Math.round((o.top as number) || 0),
      });
    } else if (type === "rect") {
      const w = Math.max(1, Math.round((o.width as number) || 1));
      const h = Math.max(1, Math.round((o.height as number) || 1));
      const fill = String(o.fill || "#000000");
      const stroke = typeof o.stroke === "string" ? o.stroke : "none";
      const strokeWidth = typeof o.strokeWidth === "number" ? o.strokeWidth : 0;
      const rx = typeof o.rx === "number" ? o.rx : 0;
      const ry = typeof o.ry === "number" ? o.ry : 0;
      const opacity = typeof o.opacity === "number" ? o.opacity : 1;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" /></svg>`;
      const layerBuf = await sharp(Buffer.from(svg)).png().toBuffer();
      composites.push({
        input: layerBuf,
        left: Math.round((o.left as number) || 0),
        top: Math.round((o.top as number) || 0),
      });
    } else if (type === "circle") {
      const r = Math.max(1, Math.round((o.radius as number) || 1));
      const d = r * 2;
      const fill = String(o.fill || "#000000");
      const stroke = typeof o.stroke === "string" ? o.stroke : "none";
      const strokeWidth = typeof o.strokeWidth === "number" ? o.strokeWidth : 0;
      const opacity = typeof o.opacity === "number" ? o.opacity : 1;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${r}" cy="${r}" r="${r - strokeWidth / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" /></svg>`;
      const layerBuf = await sharp(Buffer.from(svg)).png().toBuffer();
      composites.push({
        input: layerBuf,
        left: Math.round((o.left as number) || 0),
        top: Math.round((o.top as number) || 0),
      });
    } else if (type === "line") {
      const x1 = Math.round((o.x1 as number) || 0);
      const y1 = Math.round((o.y1 as number) || 0);
      const x2 = Math.round((o.x2 as number) || 0);
      const y2 = Math.round((o.y2 as number) || 0);
      const stroke = String(o.stroke || "#000000");
      const sw = typeof o.strokeWidth === "number" ? o.strokeWidth : 1;
      // Render as a full-canvas svg so positioning is exact.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" /></svg>`;
      const layerBuf = await sharp(Buffer.from(svg)).png().toBuffer();
      composites.push({ input: layerBuf, left: 0, top: 0 });
    } else if (type === "textbox" && typeof o.text === "string") {
      const text = String(o.text);
      const fontSize = typeof o.fontSize === "number" ? o.fontSize : 32;
      const fontFamily = String(o.fontFamily || "Arial, sans-serif");
      const fontWeight = String(o.fontWeight || "normal");
      const fontStyle = String(o.fontStyle || "normal");
      const fill = String(o.fill || "#000000");
      const textAlign = String(o.textAlign || "left");
      const wPx = Math.max(50, Math.round((o.width as number) || 200));
      // Approximate height per line; allow word wrap via foreignObject.
      const lineHeight = typeof o.lineHeight === "number" ? o.lineHeight : 1.2;
      const escTxt = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${Math.round(fontSize * lineHeight * Math.max(1, escTxt.split("\n").length) * 1.5)}" >
  <foreignObject x="0" y="0" width="${wPx}" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${fontFamily};font-size:${fontSize}px;font-weight:${fontWeight};font-style:${fontStyle};color:${fill};text-align:${textAlign};line-height:${lineHeight};word-wrap:break-word;">
      ${escTxt.split("\n").map((l) => `<div>${l}</div>`).join("")}
    </div>
  </foreignObject>
</svg>`;
      try {
        const layerBuf = await sharp(Buffer.from(svg)).png().toBuffer();
        composites.push({
          input: layerBuf,
          left: Math.round((o.left as number) || 0),
          top: Math.round((o.top as number) || 0),
        });
      } catch {
        // sharp svg renderer has font limits; if it fails, skip — the
        // editor canvas will still show the text correctly via Fabric.
      }
    }
  }

  if (composites.length > 0) {
    canvas = await sharp(canvas).composite(composites).png().toBuffer();
  }

  return canvas;
}

function hexToRgb(hex: string): { r: number; g: number; b: number; alpha: number } {
  const s = hex.replace(/^#/, "");
  if (s.length === 3) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
      alpha: 1,
    };
  }
  if (s.length === 6) {
    return {
      r: parseInt(s.substring(0, 2), 16),
      g: parseInt(s.substring(2, 4), 16),
      b: parseInt(s.substring(4, 6), 16),
      alpha: 1,
    };
  }
  return { r: 255, g: 255, b: 255, alpha: 1 };
}

// (clamp helper removed — preview renderer now passes coordinates
// through faithfully so the preview image matches what the editor
// canvas will show. add_photo_layer validates bounds at the tool layer.)

// ─── prompt builders ──────────────────────────────────────────────────

function buildSystemPrompt(_brief: EditableDesignBrief, hasReference: string | null, hasLogo: string | null): string {
  return `You are FlowAI Editable-Design Engine v2 — a senior creative director composing designs LAYER BY LAYER.

ARCHITECTURE — read carefully:
You build the design as a composition graph of editable Fabric layers. Each tool you call appends a layer to the graph. At finalize, the graph IS the canvas spec — every text block, shape, line, and image is its own editable object in the Studio editor (lossless).

DO NOT bake text into a generated background image. Generated images are pixels — pixels are NOT editable. Use add_text_layer for every text block so the user can edit them in the canvas.

Tool inventory (all reachable via the editable_design_engine MCP server):
LAYER-EMITTING TOOLS (each call adds ONE Fabric layer to the composition):
- set_canvas_background_color — solid bg color (call this first to anchor the palette)
- set_canvas_background_gradient — linear gradient bg
- generate_background_image — gpt-image-1 image as bg layer (NO text in the prompt)
- add_photo_layer — place an image (cutout, logo, qr code, decorative) at left/top with given size
- add_text_layer — editable Fabric Textbox. USE THIS FOR EVERY TEXT BLOCK (headline, subhead, dates, contact lines, CTA, brand mark)
- add_rect_layer — color panels, accent bars, ribbon banners, badge backgrounds
- add_circle_layer — sun-burst centerpoint, decorative dot, badge backdrop
- add_line_layer — gold dividers, accent rules, separators

UTILITY TOOLS:
- remove_subject_background — strip bg from the pre-loaded reference photo, returns a cutout image_id
- generate_qr_code — make a QR PNG (then add_photo_layer to place it)
- list_layers — sanity-check the composition
- critique_composition — render preview + Claude-vision critique
- finalize — TERMINAL: emits the canvas spec from the graph

WORKFLOW (typical for a design with a reference photo):
${hasReference ? `   1. set_canvas_background_color (anchor the palette).
   2. (Optional) generate_background_image for a styled bg, OR set_canvas_background_gradient.
   3. (Optional) add_rect_layer / add_circle_layer for decorative panels and accent shapes.
   4. remove_subject_background on the user reference handle → get cutout image_id.
   5. add_photo_layer placing the cutout in the chosen photo zone (typically right half).
   6. add_text_layer for each text block: headline, subhead, dates, contact lines, brand mark.
      Use real font names (Playfair Display, Lato, Bebas Neue, Open Sans, Montserrat, etc.).
      Headline ≥3× body. Use brand colors.
   7. add_line_layer for accent rules under the headline / above the contact strip.
   ${hasLogo ? "8. add_photo_layer for the brand logo (typically top-left or footer)." : ""}
   ${hasLogo ? "9" : "8"}. critique_composition once.
   ${hasLogo ? "10" : "9"}. If 'iterate' → adjust 1-2 layers (add/remove, reposition) → critique again → finalize.
   ${hasLogo ? "11" : "10"}. finalize.` : `   1. set_canvas_background_color or set_canvas_background_gradient or generate_background_image.
   2. (Optional) add_rect_layer / add_circle_layer for decorative panels.
   3. add_text_layer for every text block (headline, subhead, contact, CTA).
   4. add_line_layer for dividers / accent rules.
   5. critique_composition → ship or one fix → finalize.`}

QUALITY BAR — agency-grade output:
- Layered, intentional composition (10-20 layers for a rich design).
- Headline ≥3× body. One display font + one body font. Left-aligned to a single guide.
- ≤3 colors total + WCAG AA contrast.
- Edge-to-edge fill. ≥4% safe-area margins.
- Decorative chrome: gold dividers, accent rules under headlines, color panels, ribbon banners.
- The user's photo (when provided) MUST appear via add_photo_layer with the cutout from remove_subject_background.

COORDINATE GROUND TRUTH:
- left=0, top=0 is the TOP-LEFT corner of the canvas.
- left+width MUST be ≤ canvas width (${_brief.width}). top+height MUST be ≤ canvas height (${_brief.height}).
- Negative coordinates ARE INVALID — they put the layer off-canvas. The tool will throw if you try.
- A photo cutout is typically ~40-55% of canvas width, ~70-90% of canvas height, anchored to the bottom edge of its zone (top = canvas_height - photo_height).

CREATIVITY — DON'T BE CLICHÉ:
- Don't reach for the obvious religious/topical icon every time. A church flyer doesn't NEED a cross; a wedding flyer doesn't NEED rings; a tech launch doesn't NEED a circuit board.
- For variety, alternate between: gradients, sun-rays / radial accents, abstract geometric shapes, color blocks with diagonal cuts, ribbon banners, ornamental dot patterns, asymmetric layouts (text right, photo left for a change), bold color-on-color, photo-as-bg with text overlay panel, etc.
- The user's reference photo is the focal element — the design supports it, doesn't compete with religious / topical iconography.
- If the user's brand / brief specifically calls for an icon (e.g. they mention "cross" in the copy), then yes use it. Otherwise: pick from a wider visual vocabulary.

You have 30 turns. Spend them on layers, not on chasing perfection. A design with 12 well-placed layers ships better than 6 endlessly re-critiqued.`;
}

function buildUserMessage(brief: EditableDesignBrief, refHandle: string | null, logoHandle: string | null, store: ImageStore): string {
  const lines: string[] = [];
  lines.push(`# Brief`);
  lines.push(`Category: ${brief.category}`);
  lines.push(`Topic: ${brief.topic}`);
  lines.push(`Canvas: ${brief.width}×${brief.height}px (every layer becomes an editable Fabric object in the Studio editor)`);
  if (brief.vibe) lines.push(`Vibe: ${brief.vibe}`);
  lines.push("");
  lines.push(`## Literal copy that MUST appear (each as its own add_text_layer call)`);
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
  lines.push(`## Pre-loaded image handles`);
  if (refHandle) {
    lines.push(`- ${store.describe(refHandle)} ← user's photo. Run remove_subject_background on this, then add_photo_layer with the cutout.`);
  }
  if (logoHandle) {
    lines.push(`- ${store.describe(logoHandle)} ← brand logo. add_photo_layer (typically top-left or footer).`);
  }
  if (!refHandle && !logoHandle) {
    lines.push(`(none — design from scratch)`);
  }
  lines.push("");
  lines.push(`## Your turn`);
  lines.push(`Build the design layer by layer. Aim for 10-20 layers. Critique once, fix one thing if needed, finalize.`);
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
  if (brief.referenceImageUrl) lines.push(`User reference photo MUST appear via add_photo_layer with the cutout.`);
  return lines.join("\n");
}
