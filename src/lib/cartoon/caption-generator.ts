import type { CartoonScene } from "./script-generator";

// ── Types ──────────────────────────────────────────────────────────────────

export type CaptionStyleId = "none" | "classic" | "bold_pop" | "boxed" | "cinematic" | "colorful" | "karaoke" | "minimal" | "subtitle_bar" | "neon";

export interface CaptionStyleDef {
  id: CaptionStyleId;
  name: string;
  description: string;
  emoji: string;
  fontsize: number;
  fontcolor: string;
  borderw: number;
  shadowx: number;
  shadowy: number;
  shadowcolor: string;
  box: boolean;
  boxcolor: string;
  boxborderw: number;
  fontFamily: string;
  bold: boolean;
  y_expr: string;
  x_expr: string;
  speakerFontsize: number;
  speakerFontcolor: string;
  speakerBold: boolean;
}

export interface TimedCaption {
  character: string;
  line: string;
  startSeconds: number;
  endSeconds: number;
  wordCount: number;
}

// ── Caption Style Definitions ──────────────────────────────────────────────

const NONE_DEFAULTS: Omit<CaptionStyleDef, "id" | "name" | "description" | "emoji"> = {
  fontsize: 0, fontcolor: "", borderw: 0, shadowx: 0, shadowy: 0,
  shadowcolor: "", box: false, boxcolor: "", boxborderw: 0,
  fontFamily: "", bold: false, y_expr: "", x_expr: "",
  speakerFontsize: 0, speakerFontcolor: "", speakerBold: false,
};

export const CAPTION_STYLES: CaptionStyleDef[] = [
  {
    id: "none",
    name: "No Captions",
    description: "Clean video without text overlays",
    emoji: "🚫",
    ...NONE_DEFAULTS,
  },
  {
    id: "classic",
    name: "Classic",
    description: "White text with black outline, bottom center",
    emoji: "📺",
    fontsize: 48,
    fontcolor: "white",
    borderw: 3,
    shadowx: 2,
    shadowy: 2,
    shadowcolor: "black@0.5",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Arial",
    bold: false,
    y_expr: "h-th-80",
    x_expr: "(w-tw)/2",
    speakerFontsize: 36,
    speakerFontcolor: "#FFD700",
    speakerBold: true,
  },
  {
    id: "bold_pop",
    name: "Bold Pop",
    description: "Large bold text, TikTok/Reel style",
    emoji: "💥",
    fontsize: 64,
    fontcolor: "white",
    borderw: 5,
    shadowx: 3,
    shadowy: 3,
    shadowcolor: "black@0.7",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Arial",
    bold: true,
    y_expr: "h-th-100",
    x_expr: "(w-tw)/2",
    speakerFontsize: 44,
    speakerFontcolor: "#FF6B6B",
    speakerBold: true,
  },
  {
    id: "boxed",
    name: "Boxed",
    description: "White text on semi-transparent dark box",
    emoji: "🔲",
    fontsize: 44,
    fontcolor: "white",
    borderw: 0,
    shadowx: 0,
    shadowy: 0,
    shadowcolor: "",
    box: true,
    boxcolor: "black@0.6",
    boxborderw: 12,
    fontFamily: "Arial",
    bold: false,
    y_expr: "h-th-80",
    x_expr: "(w-tw)/2",
    speakerFontsize: 34,
    speakerFontcolor: "#4FC3F7",
    speakerBold: true,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Elegant thin text with subtle shadow",
    emoji: "🎬",
    fontsize: 42,
    fontcolor: "white@0.95",
    borderw: 1,
    shadowx: 1,
    shadowy: 1,
    shadowcolor: "black@0.3",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Georgia",
    bold: false,
    y_expr: "h-th-70",
    x_expr: "(w-tw)/2",
    speakerFontsize: 32,
    speakerFontcolor: "white@0.7",
    speakerBold: false,
  },
  {
    id: "colorful",
    name: "Colorful",
    description: "Each character gets a unique color",
    emoji: "🌈",
    fontsize: 52,
    fontcolor: "white",
    borderw: 4,
    shadowx: 2,
    shadowy: 2,
    shadowcolor: "black@0.6",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Arial",
    bold: true,
    y_expr: "h-th-90",
    x_expr: "(w-tw)/2",
    speakerFontsize: 40,
    speakerFontcolor: "white",
    speakerBold: true,
  },
  {
    id: "karaoke",
    name: "Karaoke",
    description: "Word-by-word highlight, great for music",
    emoji: "🎤",
    fontsize: 52,
    fontcolor: "white",
    borderw: 3,
    shadowx: 2,
    shadowy: 2,
    shadowcolor: "black@0.5",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Arial",
    bold: true,
    y_expr: "h-th-90",
    x_expr: "(w-tw)/2",
    speakerFontsize: 40,
    speakerFontcolor: "#FFD700",
    speakerBold: true,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Small clean text, bottom-left, documentary feel",
    emoji: "📝",
    fontsize: 32,
    fontcolor: "white@0.9",
    borderw: 1,
    shadowx: 1,
    shadowy: 1,
    shadowcolor: "black@0.4",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Arial",
    bold: false,
    y_expr: "h-th-50",
    x_expr: "40",
    speakerFontsize: 26,
    speakerFontcolor: "white@0.6",
    speakerBold: false,
  },
  {
    id: "subtitle_bar",
    name: "Subtitle Bar",
    description: "Full-width dark bar at bottom, TV subtitle style",
    emoji: "📺",
    fontsize: 40,
    fontcolor: "white",
    borderw: 0,
    shadowx: 0,
    shadowy: 0,
    shadowcolor: "",
    box: true,
    boxcolor: "black@0.7",
    boxborderw: 16,
    fontFamily: "Arial",
    bold: false,
    y_expr: "h-th-40",
    x_expr: "(w-tw)/2",
    speakerFontsize: 32,
    speakerFontcolor: "#81D4FA",
    speakerBold: true,
  },
  {
    id: "neon",
    name: "Neon",
    description: "Glowing neon text effect, energetic style",
    emoji: "💡",
    fontsize: 56,
    fontcolor: "#00FFFF",
    borderw: 2,
    shadowx: 0,
    shadowy: 0,
    shadowcolor: "#00FFFF@0.6",
    box: false,
    boxcolor: "",
    boxborderw: 0,
    fontFamily: "Arial",
    bold: true,
    y_expr: "h-th-90",
    x_expr: "(w-tw)/2",
    speakerFontsize: 42,
    speakerFontcolor: "#FF00FF",
    speakerBold: true,
  },
];

// Color palette for the "colorful" style
const CHARACTER_COLORS = [
  "#FF6B6B", // coral red
  "#4ECDC4", // teal
  "#FFE66D", // yellow
  "#A8E6CF", // mint green
  "#FF8B94", // pink
  "#DDA0DD", // plum
  "#87CEEB", // sky blue
  "#F0E68C", // khaki
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Escape text for FFmpeg drawtext filter (used inside single-quoted values).
 *
 * FFmpeg's single-quoted strings ('...') have NO escape mechanism for the
 * ASCII single quote (U+0027) — any ' immediately ends the quoted string.
 * Solution: replace ASCII apostrophes with the Unicode RIGHT SINGLE QUOTATION
 * MARK (U+2019), which is visually identical but NOT an FFmpeg special char.
 * FreeType (used by drawtext) renders it correctly with standard fonts.
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")        // ' (U+0027) → ' (U+2019) — visually identical, not FFmpeg special
    .replace(/\u2018/g, "\u2019")   // ' (left curly) → ' (right curly) — normalize
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "%%")
    .replace(/;/g, "\\;");
}

/**
 * Get font file path for the platform
 */
function getFontPath(fontFamily: string, bold = false): string {
  if (process.platform === "win32") {
    const map: Record<string, string> = {
      "Arial": bold ? "C\\:/Windows/Fonts/arialbd.ttf" : "C\\:/Windows/Fonts/arial.ttf",
      "Georgia": bold ? "C\\:/Windows/Fonts/georgiab.ttf" : "C\\:/Windows/Fonts/georgia.ttf",
      "Verdana": bold ? "C\\:/Windows/Fonts/verdanab.ttf" : "C\\:/Windows/Fonts/verdana.ttf",
    };
    return map[fontFamily] || (bold ? "C\\:/Windows/Fonts/arialbd.ttf" : "C\\:/Windows/Fonts/arial.ttf");
  }
  // Linux / macOS fallback
  const map: Record<string, string> = {
    "Arial": bold
      ? "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
      : "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "Georgia": bold
      ? "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
      : "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
  };
  return map[fontFamily] || (bold
    ? "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    : "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf");
}

// ── Timing Calculation ─────────────────────────────────────────────────────

/**
 * Calculate per-line timing within a scene.
 * Duration is distributed proportionally based on word count per line.
 * Timing starts at 0 since each scene is composited independently.
 */
export function calculateCaptionTiming(
  scene: CartoonScene,
  sceneDurationSeconds: number
): TimedCaption[] {
  const dialogue = scene.dialogue || [];

  if (dialogue.length === 0) {
    // Show narration for full scene
    return [{
      character: "narrator",
      line: scene.narration,
      startSeconds: 0,
      endSeconds: sceneDurationSeconds,
      wordCount: scene.narration.split(/\s+/).length,
    }];
  }

  const linesWithWords = dialogue.map((d) => ({
    ...d,
    wordCount: d.line.split(/\s+/).filter(Boolean).length || 1,
  }));

  const totalWords = linesWithWords.reduce((sum, l) => sum + l.wordCount, 0);
  const MIN_LINE_DURATION = 1.2;

  // Proportional durations with minimum enforcement
  let rawDurations = linesWithWords.map((l) =>
    totalWords === 0
      ? sceneDurationSeconds / linesWithWords.length
      : (l.wordCount / totalWords) * sceneDurationSeconds
  );
  rawDurations = rawDurations.map((d) => Math.max(d, MIN_LINE_DURATION));

  // Scale to fit within scene duration
  const rawTotal = rawDurations.reduce((s, d) => s + d, 0);
  const scale = sceneDurationSeconds / rawTotal;
  const finalDurations = rawDurations.map((d) => d * scale);

  const timedCaptions: TimedCaption[] = [];
  let currentTime = 0;

  for (let i = 0; i < linesWithWords.length; i++) {
    const dur = finalDurations[i];
    timedCaptions.push({
      character: linesWithWords[i].character,
      line: linesWithWords[i].line,
      startSeconds: Math.round(currentTime * 1000) / 1000,
      endSeconds: Math.round((currentTime + dur) * 1000) / 1000,
      wordCount: linesWithWords[i].wordCount,
    });
    currentTime += dur;
  }

  return timedCaptions;
}

// ── FFmpeg Filter Generation ───────────────────────────────────────────────

/**
 * Build a color map assigning a unique color to each character across all scenes.
 */
export function buildCharacterColorMap(scenes: CartoonScene[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  const allChars = new Set<string>();

  for (const scene of scenes) {
    for (const line of (scene.dialogue || [])) {
      if (line.character.toLowerCase() !== "narrator") {
        allChars.add(line.character);
      }
    }
  }

  let idx = 0;
  for (const char of allChars) {
    colorMap.set(char, CHARACTER_COLORS[idx % CHARACTER_COLORS.length]);
    idx++;
  }
  colorMap.set("narrator", "#FFFFFF");

  return colorMap;
}

/**
 * Generate FFmpeg drawtext filter fragments for a single scene's captions.
 *
 * Chains drawtext filters sequentially:
 *   [v] -> [spk0] -> [cap0] -> [spk1] -> [cap1] -> ... -> [vcap]
 *
 * @returns filters array and final output label
 */
export function generateCaptionFilters(
  timedCaptions: TimedCaption[],
  style: CaptionStyleDef,
  inputLabel: string,
  characterColorMap?: Map<string, string>
): { filters: string[]; outputLabel: string } {
  if (style.id === "none" || timedCaptions.length === 0) {
    return { filters: [], outputLabel: inputLabel };
  }

  const filters: string[] = [];
  let currentLabel = inputLabel;

  const textFont = getFontPath(style.fontFamily, style.bold);
  const speakerFont = getFontPath(style.fontFamily, style.speakerBold);

  for (let i = 0; i < timedCaptions.length; i++) {
    const caption = timedCaptions[i];
    const isLast = i === timedCaptions.length - 1;

    const isColorful = style.id === "colorful" && characterColorMap;
    const charColor = isColorful
      ? (characterColorMap.get(caption.character) || style.fontcolor)
      : style.fontcolor;
    const speakerColor = isColorful ? charColor : style.speakerFontcolor;

    const isNarrator = caption.character.toLowerCase() === "narrator";
    const dialogueText = escapeDrawtext(caption.line);
    const enable = `enable='between(t,${caption.startSeconds},${caption.endSeconds})'`;

    // Speaker name filter (above dialogue) — skip for narrator
    if (!isNarrator) {
      const speakerText = escapeDrawtext(caption.character);
      const speakerLabel = `spk${i}`;
      const speakerYExpr = `${style.y_expr}-${style.fontsize + 8}`;

      const parts = [
        `${currentLabel}drawtext=`,
        `fontfile='${speakerFont}'`,
        `:text='${speakerText}'`,
        `:fontsize=${style.speakerFontsize}`,
        `:fontcolor=${speakerColor}`,
        `:x=${style.x_expr}`,
        `:y=${speakerYExpr}`,
        style.borderw > 0 ? `:borderw=${Math.max(1, style.borderw - 1)}:bordercolor=black` : "",
        `:${enable}`,
        `[${speakerLabel}]`,
      ];
      filters.push(parts.filter(Boolean).join(""));
      currentLabel = `[${speakerLabel}]`;
    }

    // Dialogue text filter
    const capLabel = isLast ? "vcap" : `cap${i}`;
    const textParts = [
      `${currentLabel}drawtext=`,
      `fontfile='${textFont}'`,
      `:text='${dialogueText}'`,
      `:fontsize=${style.fontsize}`,
      `:fontcolor=${charColor}`,
      `:x=${style.x_expr}`,
      `:y=${style.y_expr}`,
      style.borderw > 0 ? `:borderw=${style.borderw}:bordercolor=black` : "",
      style.shadowx > 0 ? `:shadowx=${style.shadowx}:shadowy=${style.shadowy}:shadowcolor=${style.shadowcolor}` : "",
      style.box ? `:box=1:boxcolor=${style.boxcolor}:boxborderw=${style.boxborderw}` : "",
      `:${enable}`,
      `[${capLabel}]`,
    ];
    filters.push(textParts.filter(Boolean).join(""));
    currentLabel = `[${capLabel}]`;
  }

  return { filters, outputLabel: "[vcap]" };
}

/**
 * Get caption style definition by ID
 */
export function getCaptionStyle(styleId: string): CaptionStyleDef {
  return CAPTION_STYLES.find((s) => s.id === styleId) || CAPTION_STYLES[0];
}
