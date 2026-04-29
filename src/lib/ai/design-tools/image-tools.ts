/**
 * Shared image-manipulation tools for design engine agents.
 *
 * Each function takes (store, ...args) and returns a result object the
 * agent can read. Image bytes never enter or leave through Claude — they
 * stay in the ImageStore; tools pass handles ("img_001") around.
 *
 * These are PRIMITIVES — they don't contain layout policy or design
 * rules. The agent decides when and how to use them.
 */

import sharp from "sharp";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { openaiClient } from "@/lib/ai/openai-client";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { ImageStore } from "./image-store";

// ─── helpers ──────────────────────────────────────────────────────────

function pickGptSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ar = width / height;
  if (ar >= 1.3) return "1536x1024";
  if (ar <= 0.77) return "1024x1536";
  return "1024x1024";
}

async function bufferMeta(buf: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const m = await sharp(buf).metadata();
    return { width: m.width, height: m.height };
  } catch {
    return {};
  }
}

/** Resolve any URL / data URL / public path to a Buffer. */
export async function resolveToBuffer(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("data:")) {
    const b64 = urlOrPath.replace(/^data:image\/[^;]+;base64,/, "");
    return Buffer.from(b64, "base64");
  }
  if (urlOrPath.startsWith("http")) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${urlOrPath}`);
    return Buffer.from(await res.arrayBuffer());
  }
  // Local public path
  const p = urlOrPath.startsWith("/")
    ? path.join(process.cwd(), "public", urlOrPath.replace(/^\//, ""))
    : path.join(process.cwd(), "public", urlOrPath);
  return readFile(p);
}

// ─── tool implementations ─────────────────────────────────────────────

/**
 * Generate a fresh image from a text prompt via gpt-image-1.
 * Returns the new image handle. The agent should describe what it wants
 * the image to look like in the prompt — there are no hardcoded layout
 * rules baked in here.
 */
export async function generateImage(
  store: ImageStore,
  args: { prompt: string; width?: number; height?: number; quality?: "low" | "medium" | "high" },
): Promise<{ image_id: string; summary: string }> {
  const w = args.width ?? 1080;
  const h = args.height ?? 1080;
  const size = pickGptSize(w, h);
  const quality = args.quality ?? "high";

  const base64 = await openaiClient.generateImage(args.prompt, { size, quality });
  if (!base64) throw new Error("gpt-image-1 returned no image");

  const buffer = Buffer.from(base64, "base64");
  const meta = await bufferMeta(buffer);
  const id = store.register({
    buffer,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "generated",
    note: args.prompt.slice(0, 100),
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Edit an existing stored image with a fresh instruction via
 * gpt-image-1.edit. Returns a NEW handle (the original is preserved
 * so the agent can iterate or compare).
 */
export async function editImage(
  store: ImageStore,
  args: { image_id: string; instruction: string; width?: number; height?: number },
): Promise<{ image_id: string; summary: string }> {
  const src = store.get(args.image_id);
  const w = args.width ?? src.width ?? 1080;
  const h = args.height ?? src.height ?? 1080;
  const size = pickGptSize(w, h);

  const base64 = await openaiClient.editImage(args.instruction, src.buffer, {
    size,
    quality: "high",
  });
  if (!base64) throw new Error("gpt-image-1 edit returned no image");

  const buffer = Buffer.from(base64, "base64");
  const meta = await bufferMeta(buffer);
  const id = store.register({
    buffer,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "edited",
    note: args.instruction.slice(0, 100),
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Strip the background from a stored image via rembg (u2net). Returns a
 * new handle pointing at a transparent-background PNG. Falls back to a
 * descriptive error if rembg isn't installed (Windows dev) — the agent
 * should plan around that gracefully.
 */
export async function removeImageBackground(
  store: ImageStore,
  args: { image_id: string },
): Promise<{ image_id: string; summary: string }> {
  if (!isRembgAvailable()) {
    throw new Error("rembg is not installed in this environment — background removal unavailable");
  }
  const src = store.get(args.image_id);
  const tmpDir = path.join(os.tmpdir(), "fs-bg");
  await mkdir(tmpDir, { recursive: true });
  const inPath = path.join(tmpDir, `${randomUUID()}.png`);

  // Normalize to PNG before passing in.
  const normalized = await sharp(src.buffer).png().toBuffer();
  await writeFile(inPath, normalized);

  try {
    const result = await removeBackground(inPath, { model: "u2net" });
    const cutoutBuffer = await readFile(result.outputPath);
    void unlink(inPath).catch(() => undefined);
    void unlink(result.outputPath).catch(() => undefined);

    const meta = await bufferMeta(cutoutBuffer);
    const id = store.register({
      buffer: cutoutBuffer,
      mimeType: "image/png",
      width: meta.width,
      height: meta.height,
      source: "background_removed",
      note: `cutout of ${args.image_id}`,
    });
    return { image_id: id, summary: store.describe(id) };
  } finally {
    void unlink(inPath).catch(() => undefined);
  }
}

/**
 * Composite multiple images on top of a base. Each overlay is positioned
 * by percentage (0-100) so it scales with canvas size, with optional
 * scale and shadow controls. Returns a new handle.
 *
 * Coordinates are TOP-LEFT corner of the overlay. The agent can compute
 * positioning from the base's width/height (visible via store summaries).
 */
export async function compositeImages(
  store: ImageStore,
  args: {
    base_id: string;
    overlays: Array<{
      image_id: string;
      /** Top-left X as percent of base width (0-100). */
      x_pct: number;
      /** Top-left Y as percent of base height (0-100). */
      y_pct: number;
      /** Width as percent of base width (0-100). Height auto-scales. */
      width_pct?: number;
      /** Opacity 0-1. Default 1. */
      opacity?: number;
    }>;
  },
): Promise<{ image_id: string; summary: string }> {
  const base = store.get(args.base_id);
  const baseMeta = await sharp(base.buffer).metadata();
  const bw = baseMeta.width || 1080;
  const bh = baseMeta.height || 1080;

  const composites: sharp.OverlayOptions[] = [];
  for (const ov of args.overlays) {
    const src = store.get(ov.image_id);
    const targetW = Math.round(((ov.width_pct ?? 30) / 100) * bw);
    let layerBuf = await sharp(src.buffer)
      .resize(targetW, undefined, { fit: "inside" })
      .png()
      .toBuffer();
    if (ov.opacity !== undefined && ov.opacity < 1) {
      // Multiply alpha by opacity
      const factor = Math.max(0, Math.min(1, ov.opacity));
      layerBuf = await sharp(layerBuf)
        .ensureAlpha()
        .composite([{
          input: Buffer.from([0, 0, 0, Math.round(255 * factor)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: "dest-in",
        }])
        .png()
        .toBuffer();
    }
    const layerMeta = await sharp(layerBuf).metadata();
    const left = Math.max(0, Math.min(bw - (layerMeta.width || targetW), Math.round((ov.x_pct / 100) * bw)));
    const top = Math.max(0, Math.min(bh - (layerMeta.height || targetW), Math.round((ov.y_pct / 100) * bh)));
    composites.push({ input: layerBuf, left, top });
  }

  const out = await sharp(base.buffer).composite(composites).png().toBuffer();
  const meta = await bufferMeta(out);
  const id = store.register({
    buffer: out,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "composited",
    note: `${args.base_id} + ${args.overlays.length} overlay(s)`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Tweak saturation / brightness / contrast on a stored image via sharp.
 * Returns a new handle.
 */
export async function colorGrade(
  store: ImageStore,
  args: {
    image_id: string;
    saturation?: number; // 0-3, 1=neutral
    brightness?: number; // 0-3, 1=neutral
    hue?: number; // degrees, 0=neutral
  },
): Promise<{ image_id: string; summary: string }> {
  const src = store.get(args.image_id);
  const out = await sharp(src.buffer)
    .modulate({
      saturation: args.saturation,
      brightness: args.brightness,
      hue: args.hue,
    })
    .png()
    .toBuffer();
  const meta = await bufferMeta(out);
  const id = store.register({
    buffer: out,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "color_graded",
    note: `sat=${args.saturation ?? 1} bri=${args.brightness ?? 1} hue=${args.hue ?? 0}`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Add a soft drop shadow to a stored image (synthesised from its alpha).
 * Useful for compositing cutout subjects so they "ground" naturally.
 */
export async function addDropShadow(
  store: ImageStore,
  args: {
    image_id: string;
    blur_radius?: number; // default 20
    opacity?: number; // 0-1, default 0.32
    offset_x?: number; // default 15
    offset_y?: number; // default 22
  },
): Promise<{ image_id: string; summary: string }> {
  const src = store.get(args.image_id);
  const blur = args.blur_radius ?? 20;
  const opacity = args.opacity ?? 0.32;
  const offX = args.offset_x ?? 15;
  const offY = args.offset_y ?? 22;

  const meta = await sharp(src.buffer).metadata();
  const sw = meta.width || 256;
  const sh = meta.height || 256;

  const alphaShadow = await sharp(src.buffer)
    .extractChannel("alpha")
    .blur(blur)
    .toColourspace("b-w")
    .toBuffer();
  const shadowLayer = await sharp({
    create: { width: sw, height: sh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: alphaShadow, blend: "dest-in" }])
    .ensureAlpha()
    .png()
    .toBuffer();
  const dimmedShadow = await sharp(shadowLayer)
    .composite([{
      input: Buffer.from([0, 0, 0, Math.round(255 * opacity)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: "dest-in",
    }])
    .png()
    .toBuffer();

  const out = await sharp({
    create: { width: sw + offX * 2, height: sh + offY * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: dimmedShadow, left: offX, top: offY + (offY - offX) },
      { input: src.buffer, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  const outMeta = await bufferMeta(out);
  const id = store.register({
    buffer: out,
    mimeType: "image/png",
    width: outMeta.width,
    height: outMeta.height,
    source: "drop_shadow_added",
    note: `shadow on ${args.image_id} (blur=${blur} opacity=${opacity})`,
  });
  return { image_id: id, summary: store.describe(id) };
}
