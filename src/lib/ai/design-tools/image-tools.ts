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
import QRCode from "qrcode";
import { editImagesXaiFirst, generateImageXaiFirst } from "@/lib/ai/image-router";
import { removeBackground, isRembgAvailable } from "@/lib/image-tools/background-remover";
import { ImageStore } from "./image-store";

// ─── helpers ──────────────────────────────────────────────────────────

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
  const quality = args.quality ?? "high";

  const generated = await generateImageXaiFirst(args.prompt, w, h, { quality });
  if (!generated.base64) throw new Error("Image router returned no image");

  const buffer = Buffer.from(generated.base64, "base64");
  const meta = await bufferMeta(buffer);
  const id = store.register({
    buffer,
    mimeType: generated.format === "jpeg" ? "image/jpeg" : "image/png",
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

  const edited = await editImagesXaiFirst(args.instruction, [src.buffer], w, h, { quality: "high" });
  if (!edited.base64) throw new Error("Image router edit returned no image");

  const buffer = Buffer.from(edited.base64, "base64");
  const meta = await bufferMeta(buffer);
  const id = store.register({
    buffer,
    mimeType: edited.format === "jpeg" ? "image/jpeg" : "image/png",
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
      /** Rotation in degrees (clockwise). Useful for polaroid stacks /
       *  angled tickets / tilted decorative cards. */
      rotation_degrees?: number;
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
    let pipeline = sharp(src.buffer).resize(targetW, undefined, { fit: "inside" });
    if (ov.rotation_degrees !== undefined && ov.rotation_degrees !== 0) {
      pipeline = pipeline.rotate(ov.rotation_degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    let layerBuf = await pipeline.png().toBuffer();
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

/**
 * Rotate a stored image by N degrees (positive = clockwise). Sharp
 * fills the rotated bounding box with transparent pixels so the
 * result composites cleanly onto any background.
 */
export async function rotateImage(
  store: ImageStore,
  args: { image_id: string; degrees: number },
): Promise<{ image_id: string; summary: string }> {
  const src = store.get(args.image_id);
  const out = await sharp(src.buffer)
    .rotate(args.degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await bufferMeta(out);
  const id = store.register({
    buffer: out,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "rotated",
    note: `${args.image_id} rotated ${args.degrees}°`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Crop a stored image to a percentage-defined box. All values 0-100.
 * Useful for extracting a face or focal region from a wider photo
 * (e.g. cropping a portrait to a tight square for a polaroid).
 */
export async function cropImage(
  store: ImageStore,
  args: {
    image_id: string;
    /** Top-left X as percent of source width (0-100). */
    x_pct: number;
    /** Top-left Y as percent of source height (0-100). */
    y_pct: number;
    /** Crop width as percent of source width (0-100). */
    width_pct: number;
    /** Crop height as percent of source height (0-100). */
    height_pct: number;
  },
): Promise<{ image_id: string; summary: string }> {
  const src = store.get(args.image_id);
  const meta0 = await sharp(src.buffer).metadata();
  const sw = meta0.width || 1024;
  const sh = meta0.height || 1024;
  const left = Math.max(0, Math.round((args.x_pct / 100) * sw));
  const top = Math.max(0, Math.round((args.y_pct / 100) * sh));
  const width = Math.max(1, Math.min(sw - left, Math.round((args.width_pct / 100) * sw)));
  const height = Math.max(1, Math.min(sh - top, Math.round((args.height_pct / 100) * sh)));
  const out = await sharp(src.buffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  const meta = await bufferMeta(out);
  const id = store.register({
    buffer: out,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "cropped",
    note: `${args.image_id} crop ${args.x_pct},${args.y_pct} ${args.width_pct}x${args.height_pct}%`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Wrap an image in a Polaroid-style white border with a soft drop
 * shadow + optional slight rotation. Common in event flyers, birthday
 * collages, throwback posts. The result has transparent corners around
 * the rotated frame so it composites cleanly on any background.
 */
export async function addPolaroidFrame(
  store: ImageStore,
  args: {
    image_id: string;
    /** Border thickness as percent of image width. Default 5%. */
    border_pct?: number;
    /** Slight rotation in degrees. Default 0 (caller can rotate at composite time too). */
    rotation_degrees?: number;
    /** Whether to add a soft drop shadow under the polaroid. Default true. */
    add_shadow?: boolean;
  },
): Promise<{ image_id: string; summary: string }> {
  const src = store.get(args.image_id);
  const meta0 = await sharp(src.buffer).metadata();
  const sw = meta0.width || 600;
  const sh = meta0.height || 600;
  const borderPct = args.border_pct ?? 5;
  const border = Math.max(8, Math.round((borderPct / 100) * Math.min(sw, sh)));
  // Polaroids have a thicker bottom border than top/sides
  const bottomBorder = border * 2.5;

  // Build the framed image: white background + image inset
  const frameW = sw + border * 2;
  const frameH = sh + border + bottomBorder;
  let framed = await sharp({
    create: { width: frameW, height: frameH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: src.buffer, left: border, top: border }])
    .png()
    .toBuffer();

  // Optional rotation
  if (args.rotation_degrees !== undefined && args.rotation_degrees !== 0) {
    framed = await sharp(framed)
      .rotate(args.rotation_degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  // Optional drop shadow
  if (args.add_shadow !== false) {
    const fmeta = await sharp(framed).metadata();
    const fw = fmeta.width || frameW;
    const fh = fmeta.height || frameH;
    // Build a black silhouette of the frame, blur, dim opacity
    const alphaShadow = await sharp(framed)
      .extractChannel("alpha")
      .blur(15)
      .toColourspace("b-w")
      .toBuffer();
    const shadowLayer = await sharp({
      create: { width: fw, height: fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: alphaShadow, blend: "dest-in" }])
      .ensureAlpha()
      .png()
      .toBuffer();
    const dimmedShadow = await sharp(shadowLayer)
      .composite([{
        input: Buffer.from([0, 0, 0, Math.round(255 * 0.35)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      }])
      .png()
      .toBuffer();
    framed = await sharp({
      create: { width: fw + 30, height: fh + 30, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: dimmedShadow, left: 12, top: 18 },
        { input: framed, left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
  }

  const meta = await bufferMeta(framed);
  const id = store.register({
    buffer: framed,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "polaroid_framed",
    note: `polaroid of ${args.image_id} (border=${borderPct}% rot=${args.rotation_degrees ?? 0}°)`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Generate a QR code as a PNG image and register it. Useful for event
 * flyers (RSVP link), business cards (vCard), promo posters (campaign
 * URL). foreground/background can be tuned to match brand palette.
 */
export async function generateQrCode(
  store: ImageStore,
  args: {
    /** Text or URL to encode. */
    text: string;
    /** Output size in px (square). Default 600. */
    size?: number;
    /** Foreground hex (default "#000000"). */
    fg_color?: string;
    /** Background hex (default "#FFFFFF"). Use "#FFFFFF00" for transparent. */
    bg_color?: string;
    /** Quiet zone (margin) in modules. Default 2. */
    margin?: number;
  },
): Promise<{ image_id: string; summary: string }> {
  const size = args.size ?? 600;
  const buf = await QRCode.toBuffer(args.text, {
    type: "png",
    width: size,
    margin: args.margin ?? 2,
    color: {
      dark: args.fg_color ?? "#000000",
      light: args.bg_color ?? "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });
  const meta = await bufferMeta(buf);
  const id = store.register({
    buffer: buf,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "qr_code",
    note: `QR for "${args.text.slice(0, 50)}"`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Load the user's brand logo into the image store so it can be
 * composited onto designs (top corner, footer strip, etc.). The agent
 * passes the URL from the brief's brand.logoUrl field.
 */
export async function loadBrandLogo(
  store: ImageStore,
  args: { logo_url: string },
): Promise<{ image_id: string; summary: string }> {
  const buf = await resolveToBuffer(args.logo_url);
  const meta = await bufferMeta(buf);
  const id = store.register({
    buffer: buf,
    mimeType: meta.width ? "image/png" : "image/png", // assume PNG; sharp handles real format
    width: meta.width,
    height: meta.height,
    source: "brand_logo",
    note: `brand logo from ${args.logo_url.slice(0, 60)}`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * Render a simple decorative shape as a transparent PNG and register
 * it. Cheap alternative to calling gpt-image-1 for a colored block /
 * ribbon / curve. The agent picks shape, size, color.
 */
export async function addDecorativeShape(
  store: ImageStore,
  args: {
    /** "rect" — solid rectangle. "circle" — solid circle. "ribbon" — wide horizontal bar with curved ends. */
    shape: "rect" | "circle" | "ribbon";
    /** Width in px. */
    width: number;
    /** Height in px. */
    height: number;
    /** Fill hex, e.g. "#1a5f3f". */
    color: string;
    /** Optional border-radius for rect (px). */
    corner_radius?: number;
  },
): Promise<{ image_id: string; summary: string }> {
  const w = Math.max(2, Math.round(args.width));
  const h = Math.max(2, Math.round(args.height));
  const color = args.color || "#000000";
  let svg: string;
  if (args.shape === "circle") {
    const r = Math.min(w, h) / 2;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="${color}" /></svg>`;
  } else if (args.shape === "ribbon") {
    const r = Math.round(h * 0.5);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${color}" /></svg>`;
  } else {
    const cr = args.corner_radius ?? 0;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${cr}" ry="${cr}" fill="${color}" /></svg>`;
  }
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await bufferMeta(buf);
  const id = store.register({
    buffer: buf,
    mimeType: "image/png",
    width: meta.width,
    height: meta.height,
    source: "decorative_shape",
    note: `${args.shape} ${w}x${h} ${color}`,
  });
  return { image_id: id, summary: store.describe(id) };
}

/**
 * ChatGPT-style: ONE call to gpt-image-1.edit with multiple input
 * images + a comprehensive prompt describing the entire design.
 * The model handles composition, lighting, shadow blending, typography
 * — natively, in one shot. Dramatically higher quality than our prior
 * approach of generate_image(bg) + sharp.composite(cutout).
 *
 * This is the equivalent of how ChatGPT's image generation actually
 * works: no rembg, no sharp.composite, no multi-step pipeline. Just
 * a great prompt + the user's images, and gpt-image-1 produces the
 * full polished design.
 *
 * Pass ALL relevant input images via image_ids: the user's reference
 * photo, the brand logo, any inspiration references. The model will
 * decide how to integrate them based on the prompt.
 */
export async function composeDesign(
  store: ImageStore,
  args: {
    /** Detailed design brief: composition, layout, color, typography,
     *  decorative elements, and how to integrate the input images. */
    prompt: string;
    /** Image handles to pass as inputs. The first is treated as the
     *  primary reference; the rest are auxiliary. */
    image_ids: string[];
    width?: number;
    height?: number;
    quality?: "low" | "medium" | "high";
  },
): Promise<{ image_id: string; summary: string }> {
  if (!args.image_ids?.length) {
    throw new Error("composeDesign requires at least one image_id (the reference photo at minimum)");
  }
  const w = args.width ?? 1080;
  const h = args.height ?? 1080;
  // Bundle all input images in the order the agent specified.
  const images = args.image_ids.map((id) => {
    const img = store.get(id);
    return img.buffer;
  });

  const generated = await editImagesXaiFirst(args.prompt, images, w, h, { quality: args.quality ?? "high" });
  if (!generated.base64) throw new Error("composeDesign returned no image");

  const buffer = Buffer.from(generated.base64, "base64");
  const meta = await sharp(buffer).metadata();
  const id = store.register({
    buffer,
    mimeType: generated.format === "jpeg" ? "image/jpeg" : "image/png",
    width: meta.width,
    height: meta.height,
    source: "generated",
    note: `composeDesign (${args.image_ids.length} inputs) — ${args.prompt.slice(0, 80)}`,
  });
  return { image_id: id, summary: store.describe(id) };
}
