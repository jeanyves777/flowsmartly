/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Layout-to-Canvas Converter
 *
 * Converts an AIDesignLayout JSON (percentage-based) into
 * individual Fabric.js objects on the canvas.
 */

import type {
  AIDesignLayout,
  AILayoutElement,
  AITextElement,
  AIShapeElement,
  AIDividerElement,
  AIImagePlaceholder,
} from "@/lib/ai/design-layout-types";
import { createTextbox, createRect, createCircle, createLine } from "./canvas-helpers";
import { loadGoogleFont } from "./font-loader";

export interface ApplyLayoutOptions {
  clearCanvas?: boolean;
  brandLogoUrl?: string | null;
}

/** Role → friendly customName for layers panel */
const ROLE_NAMES: Record<string, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  body: "Body Text",
  cta: "CTA Button",
  caption: "Caption",
  label: "Label",
  contact: "Contact Info",
};

/**
 * Apply an AI-generated layout to the Fabric.js canvas.
 *
 * Follows the same pattern as handleApplyStarter() in templates-panel.tsx:
 * clear canvas → set background → create elements → renderAll
 */
export async function applyAILayout(
  canvas: any,
  layout: AIDesignLayout,
  fabric: any,
  canvasWidth: number,
  canvasHeight: number,
  options?: ApplyLayoutOptions
): Promise<void> {
  const { clearCanvas = true, brandLogoUrl } = options || {};

  // 1. Clear canvas
  if (clearCanvas) {
    canvas.clear();
  }

  // 2. Set background (image or color/gradient)
  await applyBackground(canvas, layout.background, fabric, canvasWidth, canvasHeight);

  // 3. Collect all fonts used and preload them
  const fontsUsed = new Set<string>();
  for (const el of layout.elements) {
    if (el.type === "text" && (el as AITextElement).fontFamily) {
      fontsUsed.add((el as AITextElement).fontFamily!);
    }
  }
  await Promise.all([...fontsUsed].map((f) => loadGoogleFont(f)));

  // 4. Create elements (ordered bottom-to-top), skip background-role images
  for (const el of layout.elements) {
    if (el.type === "image" && (el as AIImagePlaceholder).imageRole === "background") {
      continue; // background images are handled in applyBackground
    }
    const obj = await createElement(el, fabric, canvasWidth, canvasHeight, brandLogoUrl);
    if (obj) {
      canvas.add(obj);
    }
  }

  // 5. Render
  canvas.renderAll();
}

async function applyBackground(
  canvas: any,
  bg: AIDesignLayout["background"],
  fabric: any,
  w: number,
  h: number
): Promise<void> {
  // Handle AI-generated background image
  if (bg.type === "image" && bg.imageUrl) {
    try {
      let safeUrl = bg.imageUrl;
      if (typeof window !== "undefined" && bg.imageUrl.startsWith("http") && !bg.imageUrl.startsWith(window.location.origin)) {
        safeUrl = `/api/image-proxy?url=${encodeURIComponent(bg.imageUrl)}`;
      }
      const img = await fabric.FabricImage.fromURL(safeUrl, { crossOrigin: "anonymous" });
      if (img && img.width && img.height) {
        // Scale to cover the entire canvas
        const scale = Math.max(w / img.width, h / img.height);
        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: "left",
          originY: "top",
        });
        canvas.backgroundImage = img;
        // Also set a fallback solid color
        canvas.backgroundColor = bg.color || "#1e293b";
        return;
      }
    } catch (err) {
      console.warn("[LayoutToCanvas] Failed to load background image:", err);
    }
    // Fallback to solid color
    canvas.backgroundColor = bg.color || "#1e293b";
    return;
  }

  if (bg.type === "gradient" && bg.gradient) {
    const g = bg.gradient;
    const angleRad = ((g.angle || 0) * Math.PI) / 180;

    // Convert angle to coordinates
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    let coords;
    if (g.type === "radial") {
      coords = {
        r1: 0,
        r2: Math.max(w, h) / 2,
        x1: w / 2,
        y1: h / 2,
        x2: w / 2,
        y2: h / 2,
      };
    } else {
      // Linear gradient direction based on angle
      coords = {
        x1: w / 2 - (cos * w) / 2,
        y1: h / 2 - (sin * h) / 2,
        x2: w / 2 + (cos * w) / 2,
        y2: h / 2 + (sin * h) / 2,
      };
    }

    const colorStops = (g.colorStops || []).map((cs) => ({
      offset: cs.offset,
      color: cs.color,
    }));

    if (colorStops.length >= 2) {
      const gradient = new fabric.Gradient({
        type: g.type === "radial" ? "radial" : "linear",
        coords,
        colorStops,
      });
      canvas.backgroundColor = gradient;
    } else {
      canvas.backgroundColor = bg.color || "#ffffff";
    }
  } else {
    canvas.backgroundColor = bg.color || "#ffffff";
  }
}

async function createElement(
  el: AILayoutElement,
  fabric: any,
  cw: number,
  ch: number,
  brandLogoUrl?: string | null
): Promise<any | null> {
  switch (el.type) {
    case "text":
      return createTextElement(el as AITextElement, fabric, cw, ch);
    case "shape":
      return createShapeElement(el as AIShapeElement, fabric, cw, ch);
    case "divider":
      return createDividerElement(el as AIDividerElement, fabric, cw, ch);
    case "image":
      return await createImageElement(el as AIImagePlaceholder, fabric, cw, ch, brandLogoUrl);
    default:
      return null;
  }
}

function createTextElement(
  el: AITextElement,
  fabric: any,
  cw: number,
  ch: number
): any {
  const absLeft = (el.x / 100) * cw;
  const absTop = (el.y / 100) * ch;
  const absWidth = (el.width / 100) * cw;

  // Scale fontSize proportionally if canvas isn't 1080px wide
  const scaledFontSize = Math.round(el.fontSize * (cw / 1080));

  const opts: Record<string, any> = {
    text: el.text,
    left: absLeft,
    top: absTop,
    width: absWidth,
    fontSize: scaledFontSize,
    fontFamily: el.fontFamily || "Inter",
    fontWeight: el.fontWeight || "normal",
    fontStyle: el.fontStyle || "normal",
    fill: el.fill || "#000000",
    textAlign: el.textAlign || "left",
    originX: "left",
    originY: "top",
  };

  if (el.lineHeight) opts.lineHeight = el.lineHeight;
  if (el.charSpacing) opts.charSpacing = el.charSpacing;
  if (el.opacity !== undefined) opts.opacity = el.opacity;
  if (el.angle) opts.angle = el.angle;
  if (el.shadow) opts.shadow = el.shadow;
  if (el.backgroundColor) opts.backgroundColor = el.backgroundColor;

  const obj = createTextbox(fabric, opts);
  obj.customName = ROLE_NAMES[el.role] || el.role || "Text";
  return obj;
}

function createShapeElement(
  el: AIShapeElement,
  fabric: any,
  cw: number,
  ch: number
): any {
  const absLeft = (el.x / 100) * cw;
  const absTop = (el.y / 100) * ch;
  const absWidth = (el.width / 100) * cw;
  const absHeight = ((el.height || el.width) / 100) * ch;

  let obj: any;

  switch (el.shape) {
    case "circle": {
      const radius = el.radius
        ? (el.radius / 100) * cw
        : Math.min(absWidth, absHeight) / 2;
      obj = createCircle(fabric, {
        left: absLeft,
        top: absTop,
        radius,
        fill: el.fill || "#3b82f6",
        stroke: el.stroke || undefined,
        strokeWidth: el.strokeWidth || 0,
        opacity: el.opacity,
      });
      break;
    }
    case "line": {
      obj = createLine(
        fabric,
        [absLeft, absTop, absLeft + absWidth, absTop],
        {
          stroke: el.stroke || el.fill || "#000000",
          strokeWidth: el.strokeWidth || 2,
          opacity: el.opacity,
        }
      );
      break;
    }
    case "rect":
    default: {
      obj = createRect(fabric, {
        left: absLeft,
        top: absTop,
        width: absWidth,
        height: absHeight,
        fill: el.fill || "#3b82f6",
        stroke: el.stroke || undefined,
        strokeWidth: el.strokeWidth || 0,
        rx: el.rx || 0,
        ry: el.ry || 0,
        opacity: el.opacity,
      });
      break;
    }
  }

  if (obj) {
    obj.customName = el.shape === "rect" ? "Shape" : el.shape === "circle" ? "Circle" : "Line";
  }
  return obj;
}

function createDividerElement(
  el: AIDividerElement,
  fabric: any,
  cw: number,
  ch: number
): any {
  const absLeft = (el.x / 100) * cw;
  const absTop = (el.y / 100) * ch;
  const absWidth = (el.width / 100) * cw;

  const opts: Record<string, any> = {
    stroke: el.stroke || "#cccccc",
    strokeWidth: el.strokeWidth || 1,
    opacity: el.opacity,
  };
  if (el.dashArray && el.dashArray.length > 0) {
    opts.strokeDashArray = el.dashArray;
  }

  const obj = createLine(
    fabric,
    [absLeft, absTop, absLeft + absWidth, absTop],
    opts
  );
  if (obj) obj.customName = "Divider";
  return obj;
}

async function createImageElement(
  el: AIImagePlaceholder,
  fabric: any,
  cw: number,
  ch: number,
  brandLogoUrl?: string | null
): Promise<any | null> {
  const absLeft = (el.x / 100) * cw;
  const absTop = (el.y / 100) * ch;
  const absWidth = (el.width / 100) * cw;
  const absHeight = ((el.height || 20) / 100) * ch;

  // If it's a logo placeholder and we have a brand logo URL, load it
  if (el.imageRole === "logo-placeholder" && brandLogoUrl) {
    return loadImageToCanvas(fabric, brandLogoUrl, absLeft, absTop, absWidth, absHeight, "Logo", el.opacity);
  }

  // If the element has a generated imageUrl, load the real image
  if (el.imageUrl) {
    const roleName = el.imageRole === "hero"
      ? "Hero Image"
      : el.imageRole === "icon"
        ? "Icon"
        : "Decoration";
    return loadImageToCanvas(fabric, el.imageUrl, absLeft, absTop, absWidth, absHeight, roleName, el.opacity);
  }

  // For image placeholders without a URL: show dashed placeholder rectangle
  const placeholder = createRect(fabric, {
    left: absLeft,
    top: absTop,
    width: absWidth,
    height: absHeight,
    fill: "rgba(148, 163, 184, 0.1)",
    stroke: "#94a3b8",
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    rx: 8,
    ry: 8,
    opacity: el.opacity ?? 0.6,
  });

  const roleName = el.imageRole === "logo-placeholder"
    ? "Logo"
    : el.imageRole === "hero"
      ? "Hero Image"
      : el.imageRole === "icon"
        ? "Icon"
        : "Decoration";

  placeholder.customName = `${roleName} (placeholder)`;
  return placeholder;
}

/**
 * Load an image URL into a Fabric.js image object, scaled to fit bounds.
 */
async function loadImageToCanvas(
  fabric: any,
  url: string,
  left: number,
  top: number,
  maxWidth: number,
  maxHeight: number,
  customName: string,
  opacity?: number
): Promise<any | null> {
  try {
    let safeUrl = url;
    if (typeof window !== "undefined" && url.startsWith("http") && !url.startsWith(window.location.origin)) {
      safeUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    const img = await fabric.FabricImage.fromURL(safeUrl, { crossOrigin: "anonymous" });
    if (img && img.width && img.height) {
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      img.set({
        left,
        top,
        scaleX: scale,
        scaleY: scale,
        originX: "left",
        originY: "top",
      });
      img.id = `obj-${Date.now()}-${customName.toLowerCase().replace(/\s+/g, "-")}`;
      img.customName = customName;
      if (opacity !== undefined) img.opacity = opacity;
      return img;
    }
  } catch (err) {
    console.warn(`[LayoutToCanvas] Failed to load image (${customName}):`, err);
  }
  return null;
}
