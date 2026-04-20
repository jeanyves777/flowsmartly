"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One-click text styling presets — gold metallic, neon glow, 3D shadow, etc.
 *
 * Each preset returns an async applier that mutates the given Fabric text
 * object. We import "fabric" lazily so we can use Gradient and Shadow without
 * pulling fabric into the SSR bundle.
 *
 * Pairing recommendation: every preset has a `recommendedFont` so the UI can
 * also swap the font family when the user picks a look. The font name MUST
 * exist in `FONT_CATEGORIES` so the picker can preload it.
 */

export interface TextPreset {
  id: string;
  name: string;
  recommendedFont?: string;
  preview: { background: string; color: string; gradient?: string; textShadow?: string };
  apply: (textObj: any) => Promise<void>;
}

const goldStops = [
  { offset: 0, color: "#bf953f" },
  { offset: 0.4, color: "#fcf6ba" },
  { offset: 0.6, color: "#b38728" },
  { offset: 1, color: "#8a6e2f" },
];

const silverStops = [
  { offset: 0, color: "#9c9c9c" },
  { offset: 0.45, color: "#f5f5f5" },
  { offset: 0.55, color: "#dcdcdc" },
  { offset: 1, color: "#7a7a7a" },
];

const roseGoldStops = [
  { offset: 0, color: "#b76e79" },
  { offset: 0.5, color: "#f7cac9" },
  { offset: 1, color: "#a05c61" },
];

async function applyVerticalGradient(
  textObj: any,
  stops: Array<{ offset: number; color: string }>,
): Promise<void> {
  const fabric = await import("fabric");
  const height = (textObj.height || 100) * (textObj.scaleY || 1);
  const gradient = new fabric.Gradient({
    type: "linear",
    coords: { x1: 0, y1: 0, x2: 0, y2: height },
    colorStops: stops,
  });
  textObj.set("fill", gradient);
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "gold-metallic",
    name: "Gold Metallic",
    recommendedFont: "Great Vibes",
    preview: {
      background: "#0a0a0a",
      color: "#fcf6ba",
      gradient: "linear-gradient(180deg,#bf953f,#fcf6ba 40%,#b38728 60%,#8a6e2f)",
      textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, goldStops);
      text.set({
        stroke: "#7a5618",
        strokeWidth: 1,
        strokeUniform: true,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.55)",
          blur: 12,
          offsetX: 4,
          offsetY: 6,
        }),
      });
    },
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    recommendedFont: "Allura",
    preview: {
      background: "#1a0f10",
      color: "#f7cac9",
      gradient: "linear-gradient(180deg,#b76e79,#f7cac9,#a05c61)",
      textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, roseGoldStops);
      text.set({
        stroke: "#8a3e48",
        strokeWidth: 0.5,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.4)",
          blur: 8,
          offsetX: 2,
          offsetY: 4,
        }),
      });
    },
  },
  {
    id: "silver-chrome",
    name: "Silver Chrome",
    recommendedFont: "Cinzel",
    preview: {
      background: "#0d0d0d",
      color: "#f5f5f5",
      gradient: "linear-gradient(180deg,#9c9c9c,#f5f5f5,#dcdcdc,#7a7a7a)",
      textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, silverStops);
      text.set({
        stroke: "#4a4a4a",
        strokeWidth: 0.8,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.5)",
          blur: 6,
          offsetX: 2,
          offsetY: 3,
        }),
      });
    },
  },
  {
    id: "neon-pink",
    name: "Neon Pink",
    recommendedFont: "Pacifico",
    preview: {
      background: "#0a0014",
      color: "#ff3ea5",
      textShadow: "0 0 10px #ff3ea5,0 0 20px #ff3ea5",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#ff3ea5",
        stroke: "#ffd6ec",
        strokeWidth: 0.5,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "#ff3ea5",
          blur: 22,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    },
  },
  {
    id: "neon-cyan",
    name: "Neon Cyan",
    recommendedFont: "Bebas Neue",
    preview: {
      background: "#001014",
      color: "#3ef0ff",
      textShadow: "0 0 10px #3ef0ff,0 0 20px #3ef0ff",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#3ef0ff",
        stroke: "#dffaff",
        strokeWidth: 0.5,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "#3ef0ff",
          blur: 22,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    },
  },
  {
    id: "fire-gradient",
    name: "Fire",
    recommendedFont: "Bangers",
    preview: {
      background: "#0a0000",
      color: "#ffb347",
      gradient: "linear-gradient(180deg,#ffd76a,#ff7a18 60%,#a3001a)",
      textShadow: "0 0 14px #ff5500",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, [
        { offset: 0, color: "#ffd76a" },
        { offset: 0.55, color: "#ff7a18" },
        { offset: 1, color: "#a3001a" },
      ]);
      text.set({
        stroke: "#3a0000",
        strokeWidth: 1,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(255,80,0,0.7)",
          blur: 14,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    },
  },
  {
    id: "shadow-3d",
    name: "3D Long Shadow",
    recommendedFont: "Anton",
    preview: {
      background: "#fff0e6",
      color: "#1f1f1f",
      textShadow: "4px 4px 0 #ff7a18,8px 8px 0 #ffae42",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#1f1f1f",
        stroke: null,
        strokeWidth: 0,
        shadow: new fabric.Shadow({
          color: "#ff7a18",
          blur: 0,
          offsetX: 6,
          offsetY: 6,
        }),
      });
    },
  },
  {
    id: "outline-only",
    name: "Outline Only",
    recommendedFont: "Bebas Neue",
    preview: {
      background: "#fff",
      color: "transparent",
      textShadow: "none",
    },
    apply: async (text) => {
      text.set({
        fill: "transparent",
        stroke: "#000000",
        strokeWidth: 2,
        strokeUniform: true,
        paintFirst: "stroke",
        shadow: null,
      });
    },
  },
  {
    id: "elegant-script",
    name: "Elegant Script",
    recommendedFont: "Great Vibes",
    preview: {
      background: "#fdfaf6",
      color: "#5b4636",
      textShadow: "1px 1px 2px rgba(0,0,0,0.15)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#5b4636",
        stroke: null,
        strokeWidth: 0,
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.18)",
          blur: 4,
          offsetX: 1,
          offsetY: 2,
        }),
      });
    },
  },
];
