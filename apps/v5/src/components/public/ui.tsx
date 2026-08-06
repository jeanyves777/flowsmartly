import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useMemo } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { trackCta } from '@/lib/analytics';
import { elevation, hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';

/* ------------------------------------------------------------------ */
/* type scale                                                          */
/* ------------------------------------------------------------------ */

/**
 * One scale for the whole page. Sections used to hardcode 48/47/50/46/38/31/27
 * headings and eleven body sizes down to 7.5px, with per-section `*Mobile`
 * overrides; a single ratio keeps the hierarchy intact at every width and
 * never drops below a readable floor.
 */
export type TypeScale = {
  display: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  h4: TextStyle;
  body: TextStyle;
  bodySm: TextStyle;
  caption: TextStyle;
  micro: TextStyle;
};

const clamp = (value: number, min: number) => Math.max(min, Math.round(value));

export function buildTypeScale(l: Layout, t: ThemeTokens): TypeScale {
  const k = l.isPhone ? 0.66 : l.isTablet ? 0.78 : l.width < BP.desktop ? 0.9 : 1;
  const heading = (size: number, min: number, tracking: number): TextStyle => ({
    fontSize: clamp(size * k, min),
    lineHeight: clamp(size * k * 1.14, Math.round(min * 1.16)),
    letterSpacing: tracking * k,
    fontWeight: '800',
    color: t.text,
  });
  const copy = (size: number, min: number, muted = false): TextStyle => ({
    fontSize: clamp(size * (l.isPhone ? 0.9 : l.isTablet ? 0.95 : 1), min),
    lineHeight: clamp(size * (l.isPhone ? 0.9 : l.isTablet ? 0.95 : 1) * 1.55, Math.round(min * 1.5)),
    color: muted ? t.textMuted : t.text,
  });
  return {
    display: heading(52, 32, -1.9),
    h1: heading(44, 28, -1.5),
    h2: heading(34, 24, -1),
    h3: heading(24, 19, -0.4),
    h4: heading(18, 16, -0.2),
    body: copy(17, 15, true),
    bodySm: copy(15, 14, true),
    caption: { ...copy(13, 12.5, true), lineHeight: 19 },
    micro: { ...copy(11.5, 11, true), lineHeight: 16 },
  };
}

export function useTypeScale(): TypeScale {
  const l = useLayout();
  const t = useTokens();
  return useMemo(() => buildTypeScale(l, t), [l, t]);
}

/* ------------------------------------------------------------------ */
/* semantic headings                                                   */
/* ------------------------------------------------------------------ */

/**
 * react-native-web renders every `Text` as a `<div>`, so a page built from the
 * type scale alone ships with **no heading structure at all** — which is a real
 * gap for crawlers and answer engines, not a cosmetic one.
 *
 * `role="heading"` + `aria-level` is the accessible-and-crawlable equivalent,
 * and it is what RNW can actually emit. Use `level={1}` exactly once per page,
 * on the page's main title.
 */
export function Heading({
  level,
  style,
  children,
  numberOfLines,
}: {
  level: 1 | 2 | 3 | 4;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text role="heading" aria-level={level} style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* section shell                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* open sections and bands                                             */
/* ------------------------------------------------------------------ */

/**
 * A public-page section is **open by default**: the page gutter, real vertical
 * breathing room, and nothing else. No border, no radius, no surface.
 *
 * There used to be a `Section`/`useSectionShell` pair that put every section in
 * a card, and every route was built from it. A page made entirely of them reads
 * as a dashboard — a wall of equally-weighted rounded rectangles, each holding
 * a grid of more rounded rectangles. Two borders around every idea flattens the
 * hierarchy instead of creating it, so the pair is gone rather than left around
 * to be reached for again.
 *
 * The rule this encodes:
 *
 * > A section gets a border, a radius or a card background only when the
 * > container itself is an interactive object, a distinct product surface, or
 * > grouped data. Sections are open; cards are for the content objects inside
 * > one.
 *
 * So a heading, an intro, a feature narrative, a diagram or a CTA sits
 * directly on the page, while a dashboard preview, a pricing plan or a
 * testimonial keeps its box.
 */
export function useOpenSection(): ViewStyle {
  const l = useLayout();
  return useMemo(
    () => ({ paddingHorizontal: l.gutter, paddingVertical: l.sectionSpace }),
    [l],
  );
}

export function OpenSection({
  children,
  style,
  art,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** a faded background diagram — see `SectionArt` */
  art?: SectionArtProps;
}) {
  const open = useOpenSection();
  // Clipping only when there is art to clip. An open section is not a box, and
  // giving every one of them `overflow: hidden` would silently crop anything a
  // section legitimately hangs outside itself.
  return (
    <View style={[open, art ? CLIP : null, style]}>
      {art ? <SectionArt {...art} /> : null}
      {children}
    </View>
  );
}

/** shared so `OpenSection` and `Band` clip their artwork the same way */
const CLIP: ViewStyle = { overflow: 'hidden' };

export type BandTone = 'surface' | 'brand' | 'violet' | 'green' | 'orange' | 'pink';

/**
 * The ground a band sits on.
 *
 * `surface` is the neutral lift. The accent tones are a *much* weaker wash than
 * `softFill` — that one is sized for a 38px icon tile, and the same alpha
 * across a whole section reads as a coloured panel rather than a tint. These
 * are the alternating soft grounds the page rhythm is built from, so they have
 * to be felt more than seen.
 *
 * **Pick a tone by meaning, never by rotation.** A hue that cycles is noise; a
 * hue that means something is navigation:
 *
 * | Tone | Belongs to |
 * | --- | --- |
 * | `brand` (blue) | platform, systems, analytics, trust |
 * | `violet` | FlowAgent, intelligence, creation |
 * | `green` | connection, completion, verified outcomes |
 * | `orange` | service, operations, scheduling |
 * | `pink` | sales, customers, engagement |
 * | `surface` | the neutral ground a route alternates against |
 */
function bandGround(tone: BandTone, t: ThemeTokens): string {
  if (tone === 'surface') return t.surface;
  const hex =
    tone === 'violet' ? t.violet : tone === 'green' ? t.green : tone === 'orange' ? t.orange : tone === 'pink' ? t.pink : t.brand;
  return hexToRgba(hex, t.mode === 'light' ? 0.05 : 0.09);
}

/**
 * How far a band has to escape the page column on each side to reach the
 * viewport edge.
 *
 * `PageShell` caps its content at `BP.maxContent` and centres it, so above that
 * width a band that simply filled its parent would stop at 1536 and read as a
 * very wide card â€” the exact thing bands exist to avoid. Below it the column
 * already *is* the viewport, so the answer is zero.
 *
 * Measured rather than a generous constant on purpose: a flat overrun leaves
 * the scroll container reporting that much phantom width at every viewport.
 * `overflow-x: hidden` means nobody can scroll into it, but a scroll container
 * that lies about its own width is the kind of thing that quietly breaks
 * something later.
 */
function bandBleed(width: number): number {
  return Math.max(0, Math.round((width - BP.maxContent) / 2));
}

/* ------------------------------------------------------------------ */
/* section artwork                                                     */
/* ------------------------------------------------------------------ */

export type ArtVariant =
  | 'network' | 'sync' | 'api'
  | 'waves' | 'inbox' | 'support'
  | 'chart' | 'funnel' | 'store' | 'people'
  | 'docs' | 'media' | 'palette'
  | 'calendar' | 'tasks'
  | 'shield' | 'pulse' | 'analytics'
  | 'learn' | 'map' | 'search';

export type SectionArtProps = { variant: ArtVariant; color: string; side?: 'left' | 'right' };

/**
 * A faded diagram behind a section, drawn rather than sourced.
 *
 * This repo never generates or downloads an image, and a flat PNG of a
 * light-mode illustration would be wrong in two of the three themes anyway.
 * Geometry takes the accent colour and the theme's own alpha, so it fades
 * correctly everywhere and costs nothing to ship.
 *
 * It is decoration in the strictest sense: absolutely positioned, never
 * pressable, no layout contribution, and dropped entirely on phone where it
 * would sit under the copy instead of beside it.
 */
/**
 * The composition behind one section, in a 1440x420 field scaled to cover
 * whatever the section actually measures.
 *
 * `curves` cross the whole field rather than sitting in a corner — that is the
 * motif. `waves` are the soft flowing baselines underneath, `bubbles` are the
 * icon nodes the curves appear to connect, and the optional primitives
 * (`bars`, `rings`, `cards`, `grid`, `waveform`, `donut`, `checks`, `pins`,
 * `frames`) are what makes one variant read differently from the next.
 *
 * There are deliberately many variants: a section gets the one that matches
 * *its own* subject, so a security section and a scheduling section never wear
 * the same picture.
 */
type Bubble = { x: number; y: number; size: number; icon: string };

type Composition = {
  curves: string[];
  waves: string[];
  bubbles: Bubble[];
  dots: [number, number][];
  /** concentric halos: [cx, cy, innermost radius, count] */
  rings?: [number, number, number, number][];
  /** columns rising from the baseline: [x, height] */
  bars?: [number, number][];
  /** a dense speech waveform across this x range */
  waveform?: [number, number];
  /** document cards: x, y, width, height, text lines */
  cards?: { x: number; y: number; w: number; h: number; lines: number }[];
  /** a date grid anchored at [x, y] */
  grid?: [number, number];
  /** a segmented ring at [cx, cy, radius] */
  donut?: [number, number, number];
  /** checklist rows anchored at [x, y, count] */
  checks?: [number, number, number];
  /** map pins at [x, y] */
  pins?: [number, number][];
  /** media frames at [x, y] */
  frames?: [number, number][];
};

const ART_W = 1440;
const ART_H = 420;

/**
 * Four curve families, so twenty-one variants do not need twenty-one
 * hand-drawn path sets — the icons and primitives carry the meaning, the
 * family sets the movement.
 */
const ARC = [
  'M-60 300 C 240 268 430 212 700 190 S 1160 118 1520 78',
  'M-60 150 C 300 198 520 104 820 152 S 1240 214 1520 160',
];
const WEAVE = [
  'M-60 250 C 220 90 430 330 700 180 S 1150 60 1520 200',
  'M-60 110 C 260 300 520 90 800 280 S 1230 330 1520 150',
];
const LOW = [
  'M-60 306 C 280 262 520 344 820 288 S 1240 232 1520 282',
  'M-60 214 C 260 176 480 254 780 208 S 1200 156 1520 202',
];
const HIGH = [
  'M-60 132 C 250 218 470 88 760 174 S 1210 250 1520 156',
  'M-60 262 C 300 208 540 320 840 258 S 1250 196 1520 246',
];

const BASE = 'M-60 348 C 250 304 480 386 790 338 S 1210 288 1520 334';
const BASE2 = 'M-60 366 C 260 330 470 396 780 352 S 1200 308 1520 350';

const COMPOSITIONS: Record<ArtVariant, Composition> = {
  network: {
    curves: WEAVE,
    waves: [BASE],
    bubbles: [
      { x: 50, y: 12, size: 60, icon: 'cloud' },
      { x: 40, y: 40, size: 54, icon: 'database' },
      { x: 48, y: 66, size: 58, icon: 'envelope' },
      { x: 36, y: 78, size: 50, icon: 'user' },
      { x: 58, y: 70, size: 54, icon: 'calendar-days' },
    ],
    dots: [[612, 128], [1210, 122], [905, 262], [352, 214]],
    rings: [[1180, 150, 40, 3]],
  },
  sync: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 46, y: 20, size: 56, icon: 'arrows-rotate' },
      { x: 58, y: 58, size: 62, icon: 'plug' },
      { x: 74, y: 30, size: 50, icon: 'link' },
      { x: 36, y: 68, size: 48, icon: 'cloud-arrow-up' },
    ],
    dots: [[320, 236], [760, 176], [1220, 118]],
    rings: [[880, 200, 46, 3]],
  },
  api: {
    curves: LOW,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 24, size: 54, icon: 'code' },
      { x: 57, y: 60, size: 58, icon: 'server' },
      { x: 72, y: 28, size: 50, icon: 'terminal' },
      { x: 84, y: 62, size: 48, icon: 'key' },
    ],
    dots: [[340, 232], [700, 262], [1130, 214]],
    cards: [{ x: 760, y: 118, w: 176, h: 118, lines: 3 }],
  },
  waves: {
    curves: LOW,
    waves: [
      'M-60 210 C 180 130 300 290 520 208 S 860 128 1120 208 S 1360 268 1520 216',
      BASE,
    ],
    bubbles: [
      { x: 72, y: 18, size: 56, icon: 'ellipsis' },
      { x: 66, y: 58, size: 62, icon: 'comment-dots' },
      { x: 85, y: 66, size: 54, icon: 'phone' },
    ],
    dots: [[300, 176], [654, 246], [1002, 168]],
    waveform: [860, 1300],
  },
  inbox: {
    curves: HIGH,
    waves: [BASE],
    bubbles: [
      { x: 43, y: 22, size: 56, icon: 'envelope' },
      { x: 55, y: 62, size: 58, icon: 'comment-sms' },
      { x: 71, y: 30, size: 50, icon: 'paper-plane' },
      { x: 82, y: 66, size: 48, icon: 'inbox' },
    ],
    dots: [[330, 196], [720, 244], [1180, 168]],
    cards: [
      { x: 900, y: 96, w: 190, h: 74, lines: 2 },
      { x: 946, y: 196, w: 190, h: 74, lines: 2 },
    ],
  },
  support: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 45, y: 26, size: 58, icon: 'headset' },
      { x: 58, y: 62, size: 54, icon: 'circle-question' },
      { x: 73, y: 32, size: 50, icon: 'life-ring' },
      { x: 85, y: 64, size: 48, icon: 'ticket' },
    ],
    dots: [[320, 244], [740, 200], [1160, 140]],
    rings: [[640, 220, 44, 3]],
  },
  chart: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 55, y: 62, size: 60, icon: 'cart-shopping' },
      { x: 67, y: 38, size: 48, icon: 'chevron-right' },
      { x: 77, y: 26, size: 48, icon: 'chevron-right' },
    ],
    dots: [[268, 300], [512, 258], [1338, 112]],
    bars: [[352, 92], [428, 138], [504, 116], [580, 178], [656, 216]],
  },
  funnel: {
    curves: LOW,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 20, size: 54, icon: 'filter' },
      { x: 57, y: 52, size: 60, icon: 'bullseye' },
      { x: 72, y: 68, size: 50, icon: 'handshake' },
      { x: 84, y: 26, size: 48, icon: 'sack-dollar' },
    ],
    dots: [[330, 200], [720, 250], [1150, 190]],
    bars: [[300, 210], [376, 168], [452, 128], [528, 92], [604, 62]],
  },
  store: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 45, y: 54, size: 62, icon: 'store' },
      { x: 58, y: 22, size: 50, icon: 'tag' },
      { x: 70, y: 62, size: 54, icon: 'credit-card' },
      { x: 82, y: 30, size: 48, icon: 'truck' },
    ],
    dots: [[300, 268], [688, 224], [1180, 200]],
    bars: [[300, 78], [372, 112], [444, 96]],
  },
  people: {
    curves: HIGH,
    waves: [BASE],
    bubbles: [
      { x: 41, y: 24, size: 54, icon: 'user' },
      { x: 52, y: 56, size: 62, icon: 'user-group' },
      { x: 65, y: 22, size: 50, icon: 'user' },
      { x: 76, y: 64, size: 50, icon: 'heart' },
    ],
    dots: [[352, 200], [700, 254], [1152, 194]],
    rings: [[760, 236, 44, 3]],
  },
  docs: {
    curves: HIGH,
    waves: [BASE],
    bubbles: [
      { x: 70, y: 16, size: 56, icon: 'image' },
      { x: 84, y: 54, size: 52, icon: 'pen-nib' },
      { x: 40, y: 66, size: 50, icon: 'wand-magic-sparkles' },
    ],
    dots: [[412, 168], [688, 214], [1150, 128]],
    cards: [
      { x: 736, y: 118, w: 150, h: 128, lines: 3 },
      { x: 812, y: 168, w: 150, h: 128, lines: 3 },
    ],
  },
  media: {
    curves: LOW,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 22, size: 56, icon: 'play' },
      { x: 58, y: 60, size: 60, icon: 'clapperboard' },
      { x: 74, y: 28, size: 50, icon: 'microphone' },
      { x: 85, y: 64, size: 48, icon: 'sliders' },
    ],
    dots: [[330, 216], [700, 268], [1150, 200]],
    frames: [[880, 110], [1010, 168], [1140, 226]],
  },
  palette: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 45, y: 24, size: 56, icon: 'palette' },
      { x: 58, y: 60, size: 58, icon: 'brush' },
      { x: 72, y: 30, size: 50, icon: 'layer-group' },
      { x: 84, y: 62, size: 48, icon: 'font' },
    ],
    dots: [[330, 236], [720, 190], [1160, 132]],
    rings: [[600, 210, 40, 4]],
  },
  calendar: {
    curves: HIGH,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 20, size: 56, icon: 'clock' },
      { x: 36, y: 68, size: 52, icon: 'bell' },
      { x: 74, y: 60, size: 58, icon: 'calendar-check' },
    ],
    dots: [[336, 158], [742, 178], [1128, 232]],
    grid: [960, 106],
  },
  tasks: {
    curves: LOW,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 22, size: 54, icon: 'list-check' },
      { x: 57, y: 62, size: 58, icon: 'circle-check' },
      { x: 72, y: 28, size: 50, icon: 'clipboard-check' },
    ],
    dots: [[330, 220], [700, 260], [1160, 196]],
    checks: [880, 120, 4],
  },
  shield: {
    curves: LOW,
    waves: [BASE],
    bubbles: [
      { x: 47, y: 44, size: 66, icon: 'shield-halved' },
      { x: 36, y: 20, size: 50, icon: 'lock' },
      { x: 60, y: 72, size: 50, icon: 'fingerprint' },
    ],
    dots: [[300, 190], [820, 244], [1240, 168]],
    rings: [[690, 206, 54, 4]],
  },
  pulse: {
    curves: ARC,
    waves: [
      'M-60 212 C 200 212 300 212 380 212 L 420 140 L 452 286 L 486 176 L 520 212 C 700 212 900 212 1520 212',
      BASE2,
    ],
    bubbles: [
      { x: 46, y: 24, size: 54, icon: 'heart-pulse' },
      { x: 60, y: 62, size: 56, icon: 'signal' },
      { x: 76, y: 30, size: 50, icon: 'circle-check' },
    ],
    dots: [[300, 210], [760, 236], [1200, 176]],
    waveform: [900, 1320],
  },
  analytics: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 56, y: 60, size: 58, icon: 'chart-column' },
      { x: 70, y: 28, size: 52, icon: 'arrow-trend-up' },
      { x: 84, y: 62, size: 48, icon: 'table-list' },
    ],
    dots: [[300, 280], [640, 226], [1180, 124]],
    donut: [430, 196, 78],
    bars: [[880, 96], [946, 142], [1012, 122], [1078, 184]],
  },
  learn: {
    curves: HIGH,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 22, size: 58, icon: 'graduation-cap' },
      { x: 57, y: 60, size: 56, icon: 'book-open' },
      { x: 72, y: 28, size: 50, icon: 'play' },
      { x: 84, y: 64, size: 48, icon: 'certificate' },
    ],
    dots: [[330, 200], [720, 252], [1160, 186]],
    cards: [{ x: 880, y: 120, w: 168, h: 112, lines: 2 }],
  },
  map: {
    curves: LOW,
    waves: [BASE],
    bubbles: [
      { x: 44, y: 24, size: 56, icon: 'location-dot' },
      { x: 58, y: 62, size: 58, icon: 'star' },
      { x: 74, y: 30, size: 50, icon: 'map-location-dot' },
    ],
    dots: [[330, 226], [700, 262], [1160, 204]],
    pins: [[880, 150], [1010, 216], [1150, 138]],
  },
  search: {
    curves: ARC,
    waves: [BASE],
    bubbles: [
      { x: 45, y: 26, size: 58, icon: 'magnifying-glass' },
      { x: 60, y: 62, size: 54, icon: 'globe' },
      { x: 76, y: 30, size: 50, icon: 'ranking-star' },
    ],
    dots: [[320, 250], [740, 200], [1180, 140]],
    cards: [
      { x: 880, y: 118, w: 200, h: 62, lines: 1 },
      { x: 880, y: 200, w: 200, h: 62, lines: 1 },
      { x: 880, y: 282, w: 200, h: 62, lines: 1 },
    ],
  },
};

/** deterministic, so the server render and the client render agree */
function waveformBars(from: number, to: number): [number, number][] {
  const bars: [number, number][] = [];
  for (let i = 0, x = from; x < to; i += 1, x += 13) {
    // two out-of-phase sines, so the envelope swells and dips like speech
    const envelope = Math.abs(Math.sin(i * 0.21)) * 0.7 + Math.abs(Math.sin(i * 0.07)) * 0.3;
    bars.push([x, Math.max(8, Math.round(envelope * 116))]);
  }
  return bars;
}

/**
 * A faded line composition behind a section, drawn rather than sourced.
 *
 * This repo never generates or downloads an image, and a flat PNG of a
 * light-mode illustration would be wrong in two of the three themes anyway.
 * Everything here takes the accent colour and the theme's own alpha, so it
 * fades correctly in light, grey and dark and costs nothing to ship.
 *
 * It **crosses** the section rather than decorating a corner: the curves run
 * off both edges and the section clips them. A vignette tucked at one end
 * reads as a stray graphic; a run that enters and leaves reads as a diagram
 * the page is sitting on.
 *
 * Decoration in the strictest sense — absolutely positioned, never pressable,
 * no layout contribution, and dropped on phone where it would sit under the
 * copy instead of behind it.
 */
export function SectionArt({ variant, color, side = 'right' }: SectionArtProps) {
  const t = useTokens();
  const l = useLayout();
  const comp = COMPOSITIONS[variant];

  if (l.isPhone) return null;

  const dark = t.mode !== 'light';
  // Body copy and headings cross this, so the ceiling is readability, not
  // prettiness. The icon nodes are the loud part — they carry a border, a fill
  // and a glyph — so they sit lower than the linework, not higher.
  const line = hexToRgba(color, dark ? 0.17 : 0.14);
  const soft = hexToRgba(color, dark ? 0.11 : 0.085);
  const fill = hexToRgba(color, dark ? 0.07 : 0.042);
  const dot = hexToRgba(color, dark ? 0.19 : 0.155);
  // Large filled shapes — card bodies, checklist rules, date cells, media
  // frames — are the parts that actually collide with a paragraph sitting on
  // top of them. Thin strokes read as texture; a 150px pale rectangle behind a
  // headline reads as a rendering bug, so the solids get their own weaker ink.
  const plate = hexToRgba(color, dark ? 0.1 : 0.075);

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={[StyleSheet.absoluteFill, side === 'left' ? artStyles.flip : null]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${ART_W} ${ART_H}`}
        preserveAspectRatio="xMidYMid slice">
        {comp.waves.map((d) => (
          <Path key={d} d={d} stroke={soft} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        ))}
        {comp.curves.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={line}
            strokeWidth={1.6}
            strokeDasharray="1 8"
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {comp.rings?.map(([cx, cy, r0, count]) =>
          Array.from({ length: count }, (_, i) => (
            <Circle
              key={`${cx}-${cy}-${i}`}
              cx={cx}
              cy={cy}
              r={r0 + i * 26}
              stroke={soft}
              strokeWidth={1.2}
              fill="none"
            />
          )),
        )}
        {comp.bars?.map(([x, h]) => (
          <Rect key={x} x={x} y={330 - h} width={44} height={h} rx={10} fill={fill} stroke={line} strokeWidth={1.2} />
        ))}
        {comp.waveform
          ? waveformBars(comp.waveform[0], comp.waveform[1]).map(([x, h]) => (
              <Rect key={x} x={x} y={210 - h / 2} width={5} height={h} rx={2.5} fill={plate} />
            ))
          : null}
        {comp.grid
          ? Array.from({ length: 20 }, (_, i) => (
              <Rect
                key={i}
                x={(comp.grid as [number, number])[0] + (i % 5) * 42}
                y={(comp.grid as [number, number])[1] + Math.floor(i / 5) * 42}
                width={30}
                height={30}
                rx={8}
                fill={i === 7 || i === 13 ? plate : fill}
                stroke={line}
                strokeWidth={1.1}
              />
            ))
          : null}
        {comp.cards?.map((card) => (
          <Fragment key={`${card.x}-${card.y}`}>
            <Rect
              x={card.x}
              y={card.y}
              width={card.w}
              height={card.h}
              rx={16}
              fill={fill}
              stroke={line}
              strokeWidth={1.2}
            />
            {Array.from({ length: card.lines }, (_, i) => (
              <Rect
                key={i}
                x={card.x + 22}
                y={card.y + 30 + i * 24}
                width={i === card.lines - 1 ? card.w * 0.42 : card.w * 0.66}
                height={7}
                rx={3.5}
                fill={plate}
              />
            ))}
          </Fragment>
        ))}
        {comp.donut
          ? Array.from({ length: 5 }, (_, i) => (
              <Circle
                key={i}
                cx={(comp.donut as [number, number, number])[0]}
                cy={(comp.donut as [number, number, number])[1]}
                r={(comp.donut as [number, number, number])[2]}
                stroke={i % 2 ? line : soft}
                strokeWidth={16}
                strokeDasharray={`${58 + i * 14} 300`}
                strokeDashoffset={-i * 72}
                fill="none"
              />
            ))
          : null}
        {comp.checks
          ? Array.from({ length: (comp.checks as [number, number, number])[2] }, (_, i) => {
              const [gx, gy] = comp.checks as [number, number, number];
              const y = gy + i * 58;
              return (
                <Fragment key={i}>
                  <Rect x={gx} y={y} width={26} height={26} rx={8} fill={fill} stroke={line} strokeWidth={1.2} />
                  <Path d={`M${gx + 7} ${y + 13} l6 6 l10 -12`} stroke={dot} strokeWidth={2.4} fill="none" strokeLinecap="round" />
                  <Rect x={gx + 44} y={y + 9} width={i % 2 ? 150 : 220} height={8} rx={4} fill={plate} />
                </Fragment>
              );
            })
          : null}
        {comp.pins?.map(([px, py]) => (
          <Fragment key={`${px}-${py}`}>
            <Path
              d={`M${px} ${py + 46} C ${px - 30} ${py + 8} ${px - 26} ${py - 26} ${px} ${py - 26} C ${px + 26} ${py - 26} ${px + 30} ${py + 8} ${px} ${py + 46} Z`}
              fill={fill}
              stroke={line}
              strokeWidth={1.4}
            />
            <Circle cx={px} cy={py - 4} r={9} fill={dot} />
          </Fragment>
        ))}
        {comp.frames?.map(([fx, fy]) => (
          <Fragment key={`${fx}-${fy}`}>
            <Rect x={fx} y={fy} width={122} height={78} rx={12} fill={fill} stroke={line} strokeWidth={1.2} />
            <Path d={`M${fx + 52} ${fy + 27} l24 12 l-24 12 Z`} fill={dot} />
          </Fragment>
        ))}
        {comp.dots.map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={6} fill={dot} />
        ))}
      </Svg>

      {/* The icon nodes the curves appear to connect. Real glyphs rather than
          empty rings — an unlabelled circle reads as a smudge at this alpha. */}
      {comp.bubbles.map((bubble) => (
        <View
          key={`${bubble.icon}-${bubble.x}-${bubble.y}`}
          style={[
            artStyles.bubble,
            {
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              width: bubble.size * 0.86,
              height: bubble.size * 0.86,
              borderRadius: bubble.size / 2,
              backgroundColor: fill,
              borderColor: line,
            },
          ]}>
          <FontAwesome6 name={bubble.icon as never} size={Math.round(bubble.size * 0.32)} color={dot} />
        </View>
      ))}
    </View>
  );
}

const artStyles = StyleSheet.create({
  // Mirrored so a section whose copy sits on the right does not get the same
  // composition as the one above it, facing the same way.
  flip: { transform: [{ scaleX: -1 }] },
  bubble: {
    position: 'absolute',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});



/**
 * An open section on a tinted, edge-to-edge ground.
 *
 * Bands are the page's rhythm: a run of open sections on the page background
 * with an occasional band gives variation without boxing anything. The tint is
 * the only thing marking the section, so it carries hairline edges rather than
 * a radius — a rounded tint is just a wide card again.
 */
export function Band({
  children,
  tone = 'surface',
  style,
  art,
}: {
  children: React.ReactNode;
  tone?: BandTone;
  style?: ViewStyle | ViewStyle[];
  /** a faded background composition — see `SectionArt` */
  art?: SectionArtProps;
}) {
  const t = useTokens();
  const l = useLayout();
  const band = useMemo<ViewStyle>(() => {
    const bleed = bandBleed(l.width);
    return {
      // No `width`: the band stretches to its parent and the negative margins
      // widen it from there. Setting a width would pin the border box to the
      // column and leave the margins doing nothing.
      marginHorizontal: -bleed,
      // Brings the *content* back onto the column's own gutter, so a band's
      // text lines up with the open section above it.
      paddingHorizontal: bleed + l.gutter,
      paddingVertical: l.sectionSpace,
      backgroundColor: bandGround(tone, t),
      // Clips its own artwork. A band is a ground, so nothing inside one is
      // ever meant to escape it — and `SectionArt` deliberately hangs past the
      // edge so its geometry runs off rather than ending in mid-air.
      overflow: 'hidden',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: t.divider,
    };
  }, [t, l, tone]);
  return (
    <View style={[band, style]}>
      {art ? <SectionArt {...art} /> : null}
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* eyebrow chip                                                        */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children }: { children: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.chipBg,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
      }}>
      <Text style={{ color: t.chipText, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ButtonSize, { height: number; padding: number; font: number; radius: number }> = {
  // 44, not 40: `sm` is the header's "Start free" and the inline CTAs in the
  // legal pages, and the touch floor has no small variant. It also lines the
  // header button up with the 44px "Log in" hit area beside it.
  sm: { height: 44, padding: 16, font: 13, radius: 9 },
  md: { height: 48, padding: 22, font: 15, radius: 10 },
  lg: { height: 54, padding: 26, font: 16, radius: 11 },
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /**
   * Stable id for the analytics event. Set it on anything a visitor can click
   * that matters — it is what makes conversion reporting possible later.
   */
  trackId?: string;
  size?: ButtonSize;
  /** stretch to the container width — used on phone where buttons stack */
  full?: boolean;
  icon?: string;
  /** icon on the right instead of the left */
  iconRight?: boolean;
  accessibilityLabel?: string;
};

/**
 * The old primary button faked a highlight with an absolutely-positioned
 * violet circle, which rendered as a hard purple rectangle covering the right
 * third of every CTA. A real gradient fill replaces it.
 *
 * The label's contrast contract lives in the tokens, not here: `t.gradient` is
 * a background-only token that must clear 4.5:1 against `t.textOnBrand` at the
 * 13px `sm` label. It used to score 3.29:1 in grey/dark and 4.02:1 in light.
 */
export function PrimaryButton({
  label,
  onPress,
  size = 'md',
  full,
  icon,
  iconRight,
  accessibilityLabel,
  trackId,
}: ButtonProps) {
  const t = useTokens();
  const s = SIZES[size];
  const handlePress = () => {
    trackCta(trackId ?? label, { variant: 'primary' });
    onPress?.();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        {
          minHeight: s.height,
          borderRadius: s.radius,
          overflow: 'hidden',
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.88 : 1,
        },
        full ? { width: '100%' } : null,
        elevation(t, 1) as ViewStyle,
      ]}>
      <LinearGradient
        colors={[t.gradient[0], t.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: s.height,
          paddingHorizontal: s.padding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}>
        {icon && !iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.textOnBrand} /> : null}
        <Text style={{ color: t.textOnBrand, fontSize: s.font, fontWeight: '700' }}>{label}</Text>
        {icon && iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.textOnBrand} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  size = 'md',
  full,
  icon,
  iconRight,
  accessibilityLabel,
  trackId,
}: ButtonProps) {
  const t = useTokens();
  const s = SIZES[size];
  const handlePress = () => {
    trackCta(trackId ?? label, { variant: 'secondary' });
    onPress?.();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        {
          minHeight: s.height,
          borderRadius: s.radius,
          borderWidth: 1,
          borderColor: t.borderStrong,
          backgroundColor: t.surfaceRaised,
          paddingHorizontal: s.padding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.85 : 1,
        },
        full ? { width: '100%' } : null,
      ]}>
      {icon && !iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.text} /> : null}
      <Text style={{ color: t.text, fontSize: s.font, fontWeight: '700' }}>{label}</Text>
      {icon && iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.text} /> : null}
    </Pressable>
  );
}

/**
 * The quiet "read more" link that closes a card or a copy column.
 *
 * Pages used to roll their own `Pressable accessibilityRole="link"` for this,
 * which meant each one had its own hit area, its own arrow and — the part that
 * mattered — no tracking. This one emits a `cta_click` like every other button,
 * so a link out of a card is as measurable as the button beside it.
 */
export function TextLink({
  label,
  onPress,
  icon = 'arrow-right',
  trackId,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  icon?: string;
  trackId?: string;
  accessibilityLabel?: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={() => {
        trackCta(trackId ?? label, { variant: 'text-link' });
        onPress?.();
      }}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ color: t.brand, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <FontAwesome6 name={icon as never} size={12} color={t.brand} />
    </Pressable>
  );
}

/** Row of buttons that stacks and stretches on phone. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const l = useLayout();
  return (
    <View
      style={{
        flexDirection: l.isPhone ? 'column' : 'row',
        alignItems: l.isPhone ? 'stretch' : 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  style,
  level = 1,
  inset,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  level?: 1 | 2 | 3;
  inset?: boolean;
}) {
  const t = useTokens();
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          backgroundColor: inset ? t.surfaceMuted : t.surfaceRaised,
          padding: 14,
        },
        elevation(t, level) as ViewStyle,
        style,
      ]}>
      {children}
    </View>
  );
}

export const hairline = StyleSheet.hairlineWidth;
