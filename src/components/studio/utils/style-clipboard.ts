"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Style copy/paste between Fabric objects — Canva's "paint bucket" UX.
 *
 * Only props that visually carry between *compatible* object types are
 * copied. Geometry (left/top/width/height/scale/angle) is intentionally
 * excluded — pasting style should never relocate or resize the target.
 *
 * Compatibility matrix (source → valid target families):
 *   text  ↔ text
 *   shape ↔ shape (also accepts paste from image fill/stroke/shadow)
 *   image ↔ image (filters + opacity + shadow)
 *
 * The clipboard lives in module scope so it survives panel changes and
 * keyboard-shortcut invocations without going through the canvas store.
 */

interface CopiedStyle {
  family: "text" | "shape" | "image";
  // Common (all families)
  fill?: any;
  stroke?: any;
  strokeWidth?: number;
  opacity?: number;
  shadow?: any;
  globalCompositeOperation?: string;
  // Text-only
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: any;
  fontStyle?: any;
  textAlign?: string;
  lineHeight?: number;
  charSpacing?: number;
  underline?: boolean;
  linethrough?: boolean;
  // Image-only
  filters?: any[];
}

let clipboard: CopiedStyle | null = null;

function familyOf(obj: any): "text" | "shape" | "image" | null {
  if (!obj?.type) return null;
  if (["textbox", "text", "i-text"].includes(obj.type)) return "text";
  if (obj.type === "image") return "image";
  if (["rect", "circle", "triangle", "polygon", "line", "path", "group"].includes(obj.type))
    return "shape";
  return null;
}

export function copyStyle(obj: any): boolean {
  const family = familyOf(obj);
  if (!family) return false;

  const next: CopiedStyle = { family };
  // Common
  if (obj.fill !== undefined) next.fill = obj.fill;
  if (obj.stroke !== undefined) next.stroke = obj.stroke;
  if (obj.strokeWidth !== undefined) next.strokeWidth = obj.strokeWidth;
  if (obj.opacity !== undefined) next.opacity = obj.opacity;
  if (obj.shadow !== undefined) next.shadow = obj.shadow;
  if (obj.globalCompositeOperation !== undefined)
    next.globalCompositeOperation = obj.globalCompositeOperation;

  if (family === "text") {
    next.fontFamily = obj.fontFamily;
    next.fontSize = obj.fontSize;
    next.fontWeight = obj.fontWeight;
    next.fontStyle = obj.fontStyle;
    next.textAlign = obj.textAlign;
    next.lineHeight = obj.lineHeight;
    next.charSpacing = obj.charSpacing;
    next.underline = obj.underline;
    next.linethrough = obj.linethrough;
  }

  if (family === "image") {
    next.filters = Array.isArray(obj.filters) ? [...obj.filters] : undefined;
  }

  clipboard = next;
  return true;
}

export function pasteStyle(obj: any): boolean {
  if (!clipboard || !obj) return false;
  const family = familyOf(obj);
  if (!family) return false;

  // Cross-family pastes only carry the common props (fill/stroke/etc.)
  const isSameFamily = family === clipboard.family;

  const props: Record<string, unknown> = {};
  if (clipboard.fill !== undefined) props.fill = clipboard.fill;
  if (clipboard.stroke !== undefined) props.stroke = clipboard.stroke;
  if (clipboard.strokeWidth !== undefined) props.strokeWidth = clipboard.strokeWidth;
  if (clipboard.opacity !== undefined) props.opacity = clipboard.opacity;
  if (clipboard.shadow !== undefined) props.shadow = clipboard.shadow;
  if (clipboard.globalCompositeOperation !== undefined)
    props.globalCompositeOperation = clipboard.globalCompositeOperation;

  if (isSameFamily && family === "text") {
    if (clipboard.fontFamily !== undefined) props.fontFamily = clipboard.fontFamily;
    if (clipboard.fontSize !== undefined) props.fontSize = clipboard.fontSize;
    if (clipboard.fontWeight !== undefined) props.fontWeight = clipboard.fontWeight;
    if (clipboard.fontStyle !== undefined) props.fontStyle = clipboard.fontStyle;
    if (clipboard.textAlign !== undefined) props.textAlign = clipboard.textAlign;
    if (clipboard.lineHeight !== undefined) props.lineHeight = clipboard.lineHeight;
    if (clipboard.charSpacing !== undefined) props.charSpacing = clipboard.charSpacing;
    if (clipboard.underline !== undefined) props.underline = clipboard.underline;
    if (clipboard.linethrough !== undefined) props.linethrough = clipboard.linethrough;
  }

  obj.set(props);

  if (isSameFamily && family === "image" && clipboard.filters) {
    obj.filters = clipboard.filters;
    if (typeof obj.applyFilters === "function") obj.applyFilters();
  }

  return true;
}

export function hasCopiedStyle(): boolean {
  return clipboard !== null;
}

export function clearStyleClipboard(): void {
  clipboard = null;
}
