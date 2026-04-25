import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { OpenAIClient } from "./openai-client";

/**
 * Template Reproduce Agent — turns a flat template image into an editable
 * Fabric.js canvas spec.
 *
 * Pipeline:
 *  1. Pull the source image bytes (local /public path or remote URL).
 *  2. Single Claude vision pass that returns a STRUCTURED SPEC describing:
 *      - canvas dimensions
 *      - background (color | gradient | image_prompt)
 *      - layers[] of editable objects (textbox / rect / circle / image_prompt)
 *  3. For every layer (or background) the agent marked as `image_prompt`,
 *     generate a transparent-background PNG via OpenAI gpt-image-1 in
 *     parallel. Skip text/shape layers — those are emitted directly as
 *     editable Fabric primitives.
 *  4. Return the assembled Fabric canvas JSON the studio can load via
 *     safeLoadFromJSON.
 *
 * Cost shape: 1 vision call (~$0.05) + N image gens (~$0.02-0.05 each).
 * Caller charges credits accordingly (see AI_TEMPLATE_REPRODUCE).
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReproduceResult {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    objects: FabricObject[];
  };
  imagesGenerated: number;
  usage: { inputTokens: number; outputTokens: number };
}

// We emit the studio's Fabric subset — same shape the editor's
// safeLoadFromJSON consumes. Keeping it loose-typed because Fabric's
// runtime accepts more keys than the strict TS types expose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObject = Record<string, any>;

interface SpecLayer {
  type: "textbox" | "rect" | "circle" | "image_prompt";
  /** Top-left x in canvas pixels. */
  left: number;
  /** Top-left y in canvas pixels. */
  top: number;
  /** Bounding box width in canvas pixels. */
  width: number;
  /** Bounding box height in canvas pixels. */
  height: number;
  // Textbox fields
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  fill?: string;
  charSpacing?: number;
  lineHeight?: number;
  // Shape fields
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
  opacity?: number;
  angle?: number;
  // image_prompt fields — drives a downstream OpenAI call
  prompt?: string;
  /** "transparent" cuts the bg, "scene" keeps it (used for full-bleed bgs). */
  bgMode?: "transparent" | "scene";
}

interface ReproduceSpec {
  width: number;
  height: number;
  background: {
    type: "color" | "gradient" | "image_prompt";
    color?: string;
    gradient?: { angle: number; stops: Array<{ offset: number; color: string }> };
    prompt?: string;
  };
  layers: SpecLayer[];
}

const SYSTEM_PROMPT = `You are a senior graphic designer reverse-engineering a flat marketing/event flyer image into an EDITABLE Fabric.js canvas.

Your single job: emit a JSON spec that, when rendered, looks visually similar to the input — but with EVERY text block as an editable Textbox, EVERY shape as a Fabric Rect/Circle, and every photo or decorative graphic flagged for AI regeneration on a transparent background.

ABSOLUTE OUTPUT FORMAT — a single JSON object, no prose, no markdown fences:
{
  "width": <int — pick canvas width that matches the source aspect; 1080 for IG square, 1080x1350 for IG portrait, etc>,
  "height": <int>,
  "background": {
    "type": "color" | "gradient" | "image_prompt",
    "color": "#hex"                             // when type == "color"
    "gradient": { "angle": 135, "stops": [{ "offset": 0, "color": "#hex" }, ...] }   // when type == "gradient"
    "prompt": "Wide cinematic photograph of ...."  // when type == "image_prompt" — describe the scene
  },
  "layers": [
    // TEXT — always emit as editable, NEVER as image_prompt:
    {
      "type": "textbox",
      "text": "Happy Birthday",
      "left": 60, "top": 800, "width": 960, "height": 120,
      "fontSize": 96, "fontFamily": "Playfair Display", "fontWeight": "bold",
      "fontStyle": "italic", "textAlign": "center",
      "fill": "#fcf6ba",
      "charSpacing": 0, "lineHeight": 1.0
    },
    // SHAPES — solid rects, ribbons, accent bars, circles, divider lines:
    {
      "type": "rect",
      "left": 80, "top": 950, "width": 920, "height": 4,
      "fill": "#d4af37", "rx": 2, "ry": 2
    },
    { "type": "circle", "left": 400, "top": 200, "width": 280, "height": 280, "fill": "#ffffff", "stroke": "#d4af37", "strokeWidth": 4 },
    // PHOTOS / DECORATIVE GRAPHICS — describe what to regenerate:
    {
      "type": "image_prompt",
      "left": 420, "top": 220, "width": 240, "height": 240,
      "prompt": "Professional headshot of a smiling Black man in his 40s wearing a grey suit jacket, photographed in soft warm lighting, cropped to chest-up, neutral indoor background",
      "bgMode": "transparent"
    }
  ]
}

ANALYSIS RULES:
- Read the image carefully — identify EVERY text block, even small subtitles, dates, scripture refs, footer text. Report each as a separate textbox layer with the exact wording from the image.
- Read text colors precisely (sample the actual rendered color, not what you'd "expect"). Match the hex.
- Approximate font: pick from Playfair Display, Lato, Bebas Neue, Open Sans, Montserrat, Merriweather, Great Vibes, Cinzel, Pacifico, Quicksand, Allura, Cormorant Garamond, Anton, Roboto, Inter. Recognise script vs serif vs sans.
- Position coordinates are in CANVAS pixels (your chosen width × height). Use the image aspect ratio to scale.
- For PHOTOS of people: describe race, gender, approximate age, clothing, mood, framing, lighting — enough that gpt-image-1 reproduces something visually similar. Use bgMode "transparent" so the photo composites cleanly over your shapes/background.
- For BACKGROUNDS that are a flat color or gradient, prefer color/gradient over image_prompt — cheaper and crisper.
- For BACKGROUNDS that are a photograph (e.g. cruise ship railing scene), use image_prompt with bgMode "scene".
- Layer ORDER matters: emit BACK to FRONT. Background goes via the "background" field, then layers[] from bottom-most to top-most.
- Don't add layers you can't see. Don't invent decoration.

Return ONLY the JSON object.`;

export async function reproduceTemplate(
  imageUrl: string,
  options: { maxImages?: number } = {},
): Promise<ReproduceResult> {
  const { maxImages = 8 } = options;

  console.log(`[TemplateReproduce] start url=${imageUrl}`);
  // Pull the source bytes. Local /public/* paths read off disk; remote URLs
  // get fetched. Pexels-hosted thumbnails would also work via the URL path.
  const { base64, mediaType } = await loadImageBytes(imageUrl);
  console.log(`[TemplateReproduce] loaded ${base64.length} bytes (${mediaType})`);

  // ─── Step 1: vision analysis ──────────────────────────────────────────
  const response = (await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Analyze this template image and return the JSON spec described in the system prompt. Be exhaustive with text layers — capture every word visible in the image, no matter how small." },
        ],
      },
    ],
  } as unknown as Parameters<typeof anthropic.messages.create>[0])) as Anthropic.Message;

  const textBlock = response.content.find((b: Anthropic.ContentBlock) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Reproduce agent returned no parseable JSON");
  }
  let spec: ReproduceSpec;
  try {
    spec = JSON.parse(jsonMatch[0]) as ReproduceSpec;
  } catch (err) {
    throw new Error(`Reproduce agent JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(`[TemplateReproduce] vision ok — ${spec.layers?.length || 0} layers, bg=${spec.background?.type}`);

  // Defensive: enforce sensible canvas dimensions
  spec.width = clampInt(spec.width, 400, 4096, 1080);
  spec.height = clampInt(spec.height, 400, 4096, 1080);
  spec.layers = Array.isArray(spec.layers) ? spec.layers : [];

  // ─── Step 2: generate every image_prompt in parallel ─────────────────
  const openai = OpenAIClient.getInstance();

  // Cap how many image gens we'll do per request — protects credits +
  // latency. Excess image_prompt layers fall back to placeholder rects.
  const imagePromptIndices: number[] = [];
  spec.layers.forEach((l, i) => { if (l.type === "image_prompt" && l.prompt) imagePromptIndices.push(i); });
  const allowedImagePromptIndices = imagePromptIndices.slice(0, maxImages);

  const bgIsImagePrompt = spec.background.type === "image_prompt" && spec.background.prompt;
  const totalImageGens = allowedImagePromptIndices.length + (bgIsImagePrompt ? 1 : 0);

  type ImageResult = { index: number | "background"; b64: string | null };
  const imagePromises: Promise<ImageResult>[] = [];

  for (const idx of allowedImagePromptIndices) {
    const l = spec.layers[idx];
    const aspect = pickClosestSize(l.width, l.height);
    imagePromises.push(
      openai
        .generateImage(l.prompt!, { size: aspect, quality: "medium", transparent: l.bgMode !== "scene" })
        .then((b64): ImageResult => ({ index: idx, b64 }))
        .catch((): ImageResult => ({ index: idx, b64: null })),
    );
  }
  if (bgIsImagePrompt) {
    const aspect = pickClosestSize(spec.width, spec.height);
    imagePromises.push(
      openai
        .generateImage(spec.background.prompt!, { size: aspect, quality: "medium", transparent: false })
        .then((b64): ImageResult => ({ index: "background", b64 }))
        .catch((): ImageResult => ({ index: "background", b64: null })),
    );
  }

  console.log(`[TemplateReproduce] launching ${imagePromises.length} image gens (${allowedImagePromptIndices.length} layers + ${bgIsImagePrompt ? 1 : 0} bg)`);
  const results = await Promise.all(imagePromises);
  const failed = results.filter((r) => !r.b64).length;
  console.log(`[TemplateReproduce] image gens done — ${results.length - failed} ok, ${failed} failed`);

  // ─── Step 3: assemble Fabric canvas JSON ─────────────────────────────
  const objects: FabricObject[] = [];

  // Background as a fill or a full-canvas image. A solid color is set on
  // the canvas itself (not as an object) so other layers stack cleanly.
  let backgroundColor = "#ffffff";
  if (spec.background.type === "color" && spec.background.color) {
    backgroundColor = spec.background.color;
  } else if (spec.background.type === "gradient" && spec.background.gradient) {
    objects.push({
      type: "rect",
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      width: spec.width,
      height: spec.height,
      selectable: false,
      evented: false,
      fill: {
        type: "linear",
        coords: gradientCoords(spec.background.gradient.angle, spec.width, spec.height),
        colorStops: spec.background.gradient.stops,
      },
    });
  } else if (spec.background.type === "image_prompt") {
    const bgResult = results.find((r) => r.index === "background");
    if (bgResult?.b64) {
      objects.push({
        type: "image",
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        width: spec.width,
        height: spec.height,
        scaleX: 1,
        scaleY: 1,
        selectable: false,
        evented: false,
        src: `data:image/png;base64,${bgResult.b64}`,
      });
    } else {
      backgroundColor = "#f5f5f5";
    }
  }

  // Emit each layer in source order (back-to-front).
  for (let i = 0; i < spec.layers.length; i++) {
    const l = spec.layers[i];
    if (l.type === "textbox") {
      objects.push({
        type: "textbox",
        text: l.text || "",
        left: l.left, top: l.top, width: l.width,
        originX: "left", originY: "top",
        fontSize: l.fontSize ?? 32,
        fontFamily: l.fontFamily || "Inter",
        fontWeight: l.fontWeight || "normal",
        fontStyle: l.fontStyle || "normal",
        textAlign: l.textAlign || "left",
        fill: l.fill || "#000000",
        charSpacing: l.charSpacing ?? 0,
        lineHeight: l.lineHeight ?? 1.16,
        editable: true,
      });
    } else if (l.type === "rect") {
      objects.push({
        type: "rect",
        left: l.left, top: l.top, width: l.width, height: l.height,
        originX: "left", originY: "top",
        fill: l.fill || "#cccccc",
        stroke: l.stroke,
        strokeWidth: l.strokeWidth,
        rx: l.rx, ry: l.ry,
        opacity: l.opacity ?? 1,
        angle: l.angle ?? 0,
      });
    } else if (l.type === "circle") {
      const radius = Math.min(l.width, l.height) / 2;
      objects.push({
        type: "circle",
        left: l.left, top: l.top, radius,
        originX: "left", originY: "top",
        fill: l.fill || "#cccccc",
        stroke: l.stroke,
        strokeWidth: l.strokeWidth,
        opacity: l.opacity ?? 1,
      });
    } else if (l.type === "image_prompt") {
      const imgResult = results.find((r) => r.index === i);
      if (imgResult?.b64) {
        objects.push({
          type: "image",
          left: l.left, top: l.top,
          originX: "left", originY: "top",
          scaleX: 1, scaleY: 1, // sized below via width/height
          width: l.width, height: l.height,
          src: `data:image/png;base64,${imgResult.b64}`,
        });
      } else {
        // Fallback: keep a placeholder so the layout doesn't collapse.
        objects.push({
          type: "rect",
          left: l.left, top: l.top, width: l.width, height: l.height,
          originX: "left", originY: "top",
          fill: "rgba(200,200,200,0.4)",
          stroke: "#999",
          strokeWidth: 1,
          strokeDashArray: [4, 4],
        });
      }
    }
  }

  return {
    canvas: { width: spec.width, height: spec.height, backgroundColor, objects },
    imagesGenerated: totalImageGens,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

// ─── helpers ───────────────────────────────────────────────────────────

async function loadImageBytes(imageUrl: string): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  // Local /public/foo.jpg → read off disk so we don't bounce through HTTP.
  if (imageUrl.startsWith("/")) {
    const p = join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
    const buf = readFileSync(p);
    const mediaType = inferMediaType(imageUrl);
    return { base64: buf.toString("base64"), mediaType };
  }
  // Remote URL — fetch.
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch source image (${res.status}): ${imageUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mediaType = (res.headers.get("content-type") as "image/jpeg" | "image/png" | "image/webp") || inferMediaType(imageUrl);
  return { base64: buf.toString("base64"), mediaType };
}

function inferMediaType(url: string): "image/jpeg" | "image/png" | "image/webp" {
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  return "image/jpeg";
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

// gpt-image-1 only supports a small set of sizes. Pick the one closest to
// the requested aspect — over-generating then scaling down via Fabric is
// fine because the canvas re-rasterizes on render.
function pickClosestSize(w: number, h: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ar = w / h;
  if (ar >= 1.25) return "1536x1024";
  if (ar <= 0.8) return "1024x1536";
  return "1024x1024";
}

function gradientCoords(angle: number, w: number, h: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  const cx = w / 2, cy = h / 2;
  const r = Math.max(w, h);
  return {
    x1: cx - (Math.cos(rad) * r) / 2,
    y1: cy - (Math.sin(rad) * r) / 2,
    x2: cx + (Math.cos(rad) * r) / 2,
    y2: cy + (Math.sin(rad) * r) / 2,
  };
}
