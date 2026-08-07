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
  /**
   * Ink for anything painted **on** a brand / accent / gradient fill.
   *
   * It is not "white": it is whatever clears 4.5:1 on the fills *this* palette
   * uses. Light keeps white, because its accents are deep. The two dark themes
   * raise their accents to light tones (`brand` is `#4f9dff` there, not
   * `#0878f9`) so they read against a dark page — which means white on top of
   * them scored 2.0–2.9:1, i.e. below even the 3:1 large-text floor, on every
   * "Approve" / "Accept all" / "Pay" / step-number fill on the site. Dark ink
   * on a light fill is the correct inversion, and it fixes all ~44 call sites
   * at once without any of them knowing.
   *
   * The consequence, and it is deliberate: `gradient` and `ctaGradient` must
   * stay light enough in grey/dark for this ink. They are background-only
   * tokens, so that is a free trade — see the notes on them below.
   */
  textOnBrand: string;
  /**
   * Ink for text painted on a **dark scrim over imagery** (a duration chip on a
   * thumbnail, a presenter name over a video tile). That surface is dark in
   * every theme, so this stays light in every theme — it is the one case
   * `textOnBrand` must not be used for now that it inverts.
   */
  textOnScrim: string;

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

  /**
   * Primary button + hero accents. Background-only: every consumer paints
   * `textOnBrand` on it, so both stops must clear 4.5:1 against that ink at the
   * smallest button label (13px).
   */
  gradient: readonly [string, string];
  /**
   * The wide CTA banner. Background-only, and the banner paints a 22%
   * `shadowColor` scrim over it before the copy lands — so the contrast budget
   * is measured on `stop × 0.78`, not on the raw stop.
   */
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
  // 4.70:1 on surfaceInset (the darkest light surface) and 5.24:1 on white.
  // #6b7899 scored 3.95–4.40 and carries 400+ small nodes; textMuted is 7.72:1
  // on white, so this stays unmistakably the quietest of the three tiers.
  textSubtle: '#59647f',
  textOnBrand: '#ffffff',
  textOnScrim: '#ffffff',

  border: '#dfe5f2',
  borderStrong: '#c4cee4',
  divider: '#e9eef8',

  // In LIGHT, unlike the dark palettes, an accent is used both as text and as a
  // fill, and both roles pull the same way — so the hue itself is deepened
  // rather than the ink on it. Each value below is the LIGHTEST one that clears
  // 4.5:1 both as text on surfaceInset (#eef3fb, the darkest light surface) and
  // under white on a solid fill, so the palette stays as close to its original
  // brightness as AA allows.
  //   before -> after   as-text / white-on-fill
  //   brand   #0878f9 -> #0a63d6   3.72 -> 5.00 / 4.15 -> 5.57
  //   green   #13a94f -> #0e7b3a   2.77 -> 4.82 / 3.08 -> 5.37
  //   orange  #ed6f00 -> #ad5100   2.74 -> 4.77 / 3.05 -> 5.31
  //   pink    #e0075f -> #d70459   4.32 -> 4.66 / 4.81 -> 5.18
  brand: '#0a63d6',
  brandStrong: '#0a56b8',
  brandSoft: '#edf3ff',
  violet: '#6c2cff',
  green: '#0e7b3a',
  orange: '#ad5100',
  pink: '#d70459',

  chipBg: '#edf1ff',
  chipText: '#1740db',
  successBg: '#e8f8ee',
  // 4.61:1 on successBg; #0a8f43 was 3.80.
  successText: '#008034',
  warnBg: '#fff1e6',
  // 4.58:1 on warnBg; #c9560a was 3.94.
  warnText: '#bd4a00',

  // Blue stop deepened from #0b7bfa: white on it was 4.02:1, which the 13px
  // `sm` button label cannot spend. 4.80:1 now, across the whole ramp.
  gradient: ['#0a6fe1', '#5b2ef5'],
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
  // already 4.63:1 on surfaceInset, the tightest of the five surfaces
  textSubtle: '#98a2b3',
  // Neutral near-black, to match the charcoal palette: 6.74:1 on brand,
  // 8.86 brandStrong, 6.99 violet, 9.33 green, 9.40 orange, 6.50 pink.
  textOnBrand: '#101317',
  textOnScrim: '#ffffff',

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

  // The palette's own brand → violet accents, so a gradient fill and a solid
  // `t.brand` fill sit at the same tone and take the same ink. 6.66:1.
  gradient: ['#4f9dff', '#a98cff'],
  // Same arc, lifted 16% so it still clears 4.5:1 (4.81) after the banner's own
  // 22% black scrim. Keeping the old deep-royal stops would have put the copy
  // at 2.40:1 against this ink — the scrim spends a third of the budget.
  ctaGradient: ['#6badff', '#939fff', '#b79eff'],

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
  // already 4.76:1 on surfaceInset, the tightest of the five surfaces
  textSubtle: '#8b98b8',
  // Navy near-black, to match the near-black-navy palette: 6.78:1 on brand,
  // 8.91 brandStrong, 7.03 violet, 9.38 green, 9.45 orange, 6.53 pink.
  textOnBrand: '#0b1220',
  textOnScrim: '#ffffff',

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

  // as in grey — brand → violet at accent tone, 6.69:1 against this ink
  gradient: ['#4f9dff', '#a98cff'],
  // lifted 14%: 4.72:1 after the banner's 22% black scrim (the old stops would
  // have scored 2.22:1), and a shade deeper than grey's banner, which is the
  // relationship the two themes had before
  ctaGradient: ['#68abff', '#919dff', '#b59cff'],

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

/**
 * An accent, adjusted for use as *text on a tinted ground*.
 *
 * The palette accents were tuned to clear 4.5:1 on `surfaceInset`, the darkest
 * surface that existed at the time. Soft band grounds arrived later and sit
 * slightly off that value, which costs about a tenth of a point — enough to
 * put a 12px chip label at 4.36 in light and 3.94 in grey. This nudges the
 * accent in whichever direction the theme needs: darker on light, lighter on
 * the two dark palettes.
 *
 * Only for text. Fills and icons are unaffected — they are not held to a
 * contrast ratio.
 */
export function accentText(hex: string, t: ThemeTokens): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const shift = t.mode === 'light' ? -0.16 : 0.2;
  const channel = (start: number) => {
    const v = parseInt(full.slice(start, start + 2), 16);
    const next = shift < 0 ? v * (1 + shift) : v + (255 - v) * shift;
    return Math.round(Math.max(0, Math.min(255, next)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
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
