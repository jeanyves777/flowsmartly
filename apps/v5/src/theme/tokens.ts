import { Platform } from 'react-native';

export type V5ThemeMode = 'light' | 'grey' | 'dark';

/**
 * Every colour the public page is allowed to use.
 *
 * The page used to hardcode ~400 colour literals inside StyleSheet.create, so
 * only the handful of nodes that read the provider ever changed with the theme
 * — which is why dark mode showed white cards and navy-on-navy text. Sections
 * now build their stylesheet from these tokens instead.
 */
export type ThemeTokens = {
  mode: V5ThemeMode;

  /** page behind the section cards */
  background: string;
  /** a section card */
  surface: string;
  /** a card sitting on top of a card (panels, tiles, popovers) */
  surfaceRaised: string;
  /** quiet fill: diagram canvas, table stripe */
  surfaceMuted: string;
  /** inset wells: progress tracks, reason rows, code-ish blocks */
  surfaceInset: string;

  text: string;
  textMuted: string;
  textSubtle: string;
  /** text on brand / gradient fills */
  textOnBrand: string;

  border: string;
  borderStrong: string;
  divider: string;

  brand: string;
  brandStrong: string;
  brandSoft: string;
  violet: string;
  green: string;
  orange: string;
  pink: string;

  /** eyebrow / section-label chips */
  chipBg: string;
  chipText: string;
  successBg: string;
  successText: string;
  warnBg: string;
  warnText: string;

  /** primary button + hero accents */
  gradient: readonly [string, string];
  /** the wide CTA banner */
  ctaGradient: readonly [string, string, string];

  shadowColor: string;
  shadowStrength: number;

  statusBar: 'light' | 'dark';
};

const light: ThemeTokens = {
  mode: 'light',
  background: '#f3f6fc',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceMuted: '#f7f9fe',
  surfaceInset: '#eef3fb',

  text: '#071449',
  textMuted: '#42527a',
  textSubtle: '#6b7899',
  textOnBrand: '#ffffff',

  border: '#dfe5f2',
  borderStrong: '#c4cee4',
  divider: '#e9eef8',

  brand: '#0878f9',
  brandStrong: '#0a63d6',
  brandSoft: '#edf3ff',
  violet: '#6c2cff',
  green: '#13a94f',
  orange: '#ed6f00',
  pink: '#e0075f',

  chipBg: '#edf1ff',
  chipText: '#1740db',
  successBg: '#e8f8ee',
  successText: '#0a8f43',
  warnBg: '#fff1e6',
  warnText: '#c9560a',

  gradient: ['#0b7bfa', '#5b2ef5'],
  ctaGradient: ['#008cf8', '#174ff0', '#6b2df8'],

  shadowColor: '#1f2d62',
  shadowStrength: 0.1,

  statusBar: 'dark',
};

/** "Grey" is a true dark charcoal UI — neutral, not navy. */
const grey: ThemeTokens = {
  mode: 'grey',
  background: '#15181d',
  surface: '#1d2127',
  surfaceRaised: '#242931',
  surfaceMuted: '#20242b',
  surfaceInset: '#282d35',

  text: '#f1f4f8',
  textMuted: '#b2bac7',
  textSubtle: '#8c96a6',
  textOnBrand: '#ffffff',

  border: '#333941',
  borderStrong: '#48505c',
  divider: '#2b3038',

  brand: '#4f9dff',
  brandStrong: '#7cb6ff',
  brandSoft: '#1f2a37',
  violet: '#a98cff',
  green: '#3fd07c',
  orange: '#ffa34d',
  pink: '#ff5f96',

  chipBg: '#242e3c',
  chipText: '#89b9ff',
  successBg: '#17301f',
  successText: '#4ed67f',
  warnBg: '#332512',
  warnText: '#f5b040',

  gradient: ['#2f8dff', '#7d4dff'],
  ctaGradient: ['#1a7fe8', '#3a5cf0', '#7b45f6'],

  shadowColor: '#000000',
  shadowStrength: 0.45,

  statusBar: 'light',
};

/** Near-black navy. */
const dark: ThemeTokens = {
  mode: 'dark',
  background: '#070b16',
  surface: '#0e1424',
  surfaceRaised: '#141c30',
  surfaceMuted: '#101728',
  surfaceInset: '#182034',

  text: '#f5f8ff',
  textMuted: '#a9b6d2',
  textSubtle: '#7e8bab',
  textOnBrand: '#ffffff',

  border: '#26304a',
  borderStrong: '#3a4763',
  divider: '#1c2540',

  brand: '#4f9dff',
  brandStrong: '#7cb6ff',
  brandSoft: '#132441',
  violet: '#a98cff',
  green: '#3fd07c',
  orange: '#ffa34d',
  pink: '#ff5f96',

  chipBg: '#17264a',
  chipText: '#8ab8ff',
  successBg: '#0d2b1c',
  successText: '#4ed67f',
  warnBg: '#2e2110',
  warnText: '#f5b040',

  gradient: ['#2f8dff', '#7d4dff'],
  ctaGradient: ['#0f6fe0', '#2f52ec', '#7440f5'],

  shadowColor: '#000000',
  shadowStrength: 0.55,

  statusBar: 'light',
};

export const palettes: Record<V5ThemeMode, ThemeTokens> = { light, grey, dark };

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Brand glyphs keep their own colour, except the near-black ones (TikTok,
 * Apple, X) which disappear entirely on a dark surface.
 */
export function brandColor(hex: string, t: ThemeTokens): string {
  if (t.mode === 'light') return hex;
  // Only near-black marks need rescuing (#111 scores 0.067). A higher cut-off
  // also swallows saturated-but-dark brand colours — YouTube red is 0.213 and
  // was being repainted as a white block.
  return luminance(hex) < 0.12 ? t.text : hex;
}

/** Cross-platform elevation matching the token's shadow strength. */
export function elevation(t: ThemeTokens, level: 1 | 2 | 3 = 1) {
  const spread = level === 1 ? 24 : level === 2 ? 34 : 48;
  const offset = level === 1 ? 8 : level === 2 ? 12 : 18;
  const alpha = t.shadowStrength * (level === 1 ? 1 : level === 2 ? 1.15 : 1.3);
  return Platform.select({
    web: { boxShadow: `0 ${offset}px ${spread}px ${hexToRgba(t.shadowColor, alpha)}` } as object,
    default: {
      shadowColor: t.shadowColor,
      shadowOpacity: alpha,
      shadowRadius: spread * 0.6,
      shadowOffset: { width: 0, height: offset * 0.6 },
      elevation: level * 4,
    },
  }) as object;
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

/** Tint a solid colour towards the current surface — for soft icon backdrops. */
export function softFill(hex: string, t: ThemeTokens): string {
  return hexToRgba(hex, t.mode === 'light' ? 0.1 : 0.18);
}
