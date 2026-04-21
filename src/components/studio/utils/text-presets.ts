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

  // ─── Additions — 12 more distinct looks ─────────────────────────
  {
    id: "sunset-gradient",
    name: "Sunset",
    recommendedFont: "Bebas Neue",
    preview: {
      background: "#1a0a14",
      color: "#fbbf24",
      gradient: "linear-gradient(180deg,#fde047,#fb923c 50%,#dc2626)",
    },
    apply: async (text) => {
      await applyVerticalGradient(text, [
        { offset: 0, color: "#fde047" },
        { offset: 0.5, color: "#fb923c" },
        { offset: 1, color: "#dc2626" },
      ]);
      text.set({ stroke: null, strokeWidth: 0, shadow: null });
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    recommendedFont: "Montserrat",
    preview: {
      background: "#001018",
      color: "#67e8f9",
      gradient: "linear-gradient(180deg,#a5f3fc,#22d3ee 50%,#0284c7)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, [
        { offset: 0, color: "#a5f3fc" },
        { offset: 0.5, color: "#22d3ee" },
        { offset: 1, color: "#0284c7" },
      ]);
      text.set({
        stroke: null,
        strokeWidth: 0,
        shadow: new fabric.Shadow({
          color: "rgba(8,47,73,0.35)",
          blur: 6,
          offsetX: 0,
          offsetY: 3,
        }),
      });
    },
  },
  {
    id: "rainbow",
    name: "Rainbow",
    recommendedFont: "Bebas Neue",
    preview: {
      background: "#0f0f0f",
      color: "#f87171",
      gradient: "linear-gradient(90deg,#ef4444,#f97316,#fde047,#22c55e,#3b82f6,#a855f7)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      const height = (text.height || 100) * (text.scaleY || 1);
      // Horizontal gradient — spread the 6 colors across the width
      const width = (text.width || 400) * (text.scaleX || 1);
      const gradient = new fabric.Gradient({
        type: "linear",
        coords: { x1: 0, y1: height / 2, x2: width, y2: height / 2 },
        colorStops: [
          { offset: 0, color: "#ef4444" },
          { offset: 0.2, color: "#f97316" },
          { offset: 0.4, color: "#fde047" },
          { offset: 0.6, color: "#22c55e" },
          { offset: 0.8, color: "#3b82f6" },
          { offset: 1, color: "#a855f7" },
        ],
      });
      text.set({ fill: gradient, stroke: null, strokeWidth: 0, shadow: null });
    },
  },
  {
    id: "glitch",
    name: "Glitch",
    recommendedFont: "Bebas Neue",
    preview: {
      background: "#0a0a0a",
      color: "#ffffff",
      textShadow: "3px 0 #ef4444, -3px 0 #06b6d4",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      // Two stacked RGB-split shadows — cyan left, red right
      text.set({
        fill: "#ffffff",
        stroke: null,
        strokeWidth: 0,
        shadow: new fabric.Shadow({
          color: "#ef4444",
          blur: 0,
          offsetX: 3,
          offsetY: 0,
        }),
      });
    },
  },
  {
    id: "pastel-dream",
    name: "Pastel Dream",
    recommendedFont: "Pacifico",
    preview: {
      background: "#fff7ed",
      color: "#c084fc",
      gradient: "linear-gradient(135deg,#fbcfe8,#c4b5fd,#a5f3fc)",
    },
    apply: async (text) => {
      await applyVerticalGradient(text, [
        { offset: 0, color: "#fbcfe8" },
        { offset: 0.5, color: "#c4b5fd" },
        { offset: 1, color: "#a5f3fc" },
      ]);
      text.set({ stroke: null, strokeWidth: 0, shadow: null });
    },
  },
  {
    id: "chalk",
    name: "Chalk",
    recommendedFont: "Permanent Marker",
    preview: {
      background: "#1f2937",
      color: "#f9fafb",
      textShadow: "0 0 3px rgba(255,255,255,0.3)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#f9fafb",
        stroke: "rgba(255,255,255,0.2)",
        strokeWidth: 0.5,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(255,255,255,0.25)",
          blur: 4,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    },
  },
  {
    id: "emboss",
    name: "Emboss",
    recommendedFont: "Montserrat",
    preview: {
      background: "#e5e7eb",
      color: "#9ca3af",
      textShadow: "-1px -1px 0 rgba(255,255,255,0.8), 1px 1px 0 rgba(0,0,0,0.25)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#9ca3af",
        stroke: null,
        strokeWidth: 0,
        shadow: new fabric.Shadow({
          color: "rgba(255,255,255,0.95)",
          blur: 0,
          offsetX: -1,
          offsetY: -1,
        }),
      });
      // Second shadow effect approximated via paintFirst + stroke darker
      // Fabric has only one shadow — emboss is best-effort with single shadow
    },
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    recommendedFont: "Bangers",
    preview: {
      background: "#fef3c7",
      color: "#ec4899",
      textShadow: "3px 3px 0 #f9a8d4, 6px 6px 0 #f472b6",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#ec4899",
        stroke: "#831843",
        strokeWidth: 2,
        strokeUniform: true,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "#f9a8d4",
          blur: 0,
          offsetX: 5,
          offsetY: 5,
        }),
      });
    },
  },
  {
    id: "ice",
    name: "Ice Crystal",
    recommendedFont: "Cinzel",
    preview: {
      background: "#0c4a6e",
      color: "#e0f2fe",
      gradient: "linear-gradient(180deg,#ffffff,#bae6fd 50%,#0ea5e9)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, [
        { offset: 0, color: "#ffffff" },
        { offset: 0.5, color: "#bae6fd" },
        { offset: 1, color: "#0ea5e9" },
      ]);
      text.set({
        stroke: "#0369a1",
        strokeWidth: 0.8,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(56,189,248,0.6)",
          blur: 18,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    },
  },
  {
    id: "forest",
    name: "Forest",
    recommendedFont: "Lora",
    preview: {
      background: "#0a0f08",
      color: "#86efac",
      gradient: "linear-gradient(180deg,#86efac,#16a34a,#14532d)",
    },
    apply: async (text) => {
      await applyVerticalGradient(text, [
        { offset: 0, color: "#86efac" },
        { offset: 0.5, color: "#16a34a" },
        { offset: 1, color: "#14532d" },
      ]);
      text.set({ stroke: null, strokeWidth: 0, shadow: null });
    },
  },
  {
    id: "retro-wave",
    name: "Retro Wave",
    recommendedFont: "Bungee",
    preview: {
      background: "#0b0420",
      color: "#f472b6",
      gradient: "linear-gradient(180deg,#fde047,#f472b6 50%,#a855f7)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      await applyVerticalGradient(text, [
        { offset: 0, color: "#fde047" },
        { offset: 0.5, color: "#f472b6" },
        { offset: 1, color: "#a855f7" },
      ]);
      text.set({
        stroke: "#f472b6",
        strokeWidth: 1,
        paintFirst: "stroke",
        shadow: new fabric.Shadow({
          color: "rgba(244,114,182,0.6)",
          blur: 14,
          offsetX: 0,
          offsetY: 6,
        }),
      });
    },
  },
  {
    id: "stamp",
    name: "Stamp",
    recommendedFont: "Alfa Slab One",
    preview: {
      background: "#fffbeb",
      color: "#b91c1c",
      textShadow: "1px 1px 0 rgba(185,28,28,0.3)",
    },
    apply: async (text) => {
      const fabric = await import("fabric");
      text.set({
        fill: "#b91c1c",
        stroke: "#7f1d1d",
        strokeWidth: 1,
        paintFirst: "stroke",
        // Slight rotation gives the stamp-tilted feel
        angle: -5,
        opacity: 0.88,
        shadow: new fabric.Shadow({
          color: "rgba(185,28,28,0.35)",
          blur: 2,
          offsetX: 1,
          offsetY: 1,
        }),
      });
    },
  },
];
