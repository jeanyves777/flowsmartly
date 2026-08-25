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

  /**
   * Whether the page is a **light ground carrying dark ink** or the reverse.
   *
   * `mode` names the theme; `ground` names the only thing about it that two
   * dozen call sites across the site ever actually asked `mode` about. They
   * asked it as `t.mode === 'light'` — an editor panel borrowed the dark
   * palette "unless light", an artwork strip picked its alpha "unless light",
   * a modal scrim picked its opacity "unless light". That shorthand is correct
   * only while `light` is the single light-ground palette, and nothing would
   * have gone red the day it stopped being: those branches compile, and they
   * paint a dark-ground decision onto a light page.
   *
   * All three palettes shipping today answer the same as the mode check did,
   * so naming this changes no pixel. It changes what a fourth palette costs:
   * it declares which side it is on and every one of those sites is already
   * right. Only questions about **surface luminance** belong here — theme
   * identity (the header's sun/half-circle/moon) still asks `mode`, and so
   * does anything whose answer differs per palette rather than per ground.
   */
  ground: 'light' | 'dark';

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
  /**
   * Ink and glass for content sitting on a photograph.
   *
   * These **do** follow the theme. The first version of the photo hero was
   * hardcoded dark in all three, on the argument that a scrim carrying AA text
   * cannot also be a light surface — which is only true if the scrim has to be
   * dark. It does not: in light the photograph takes a near-white veil and the
   * copy stays navy, in grey and dark it takes the near-black one and the copy
   * goes white. Same photograph, three grounds, the theme switch still means
   * something on the first screen of the site.
   */
  /**
   * The ink on the *veil* — dark on a light one, white on a dark one.
   *
   * Ink on **glass** is a different thing and stays `textOnScrim`: a frosted
   * chip over a photograph is a window onto it, so it keeps its dark tint in
   * every theme rather than turning into a white pill in light mode, and
   * anything written on it is therefore always white.
   */
  scrimText: string;
  scrimTextMuted: string;
  scrimTextFaint: string;
  /** the ground a scrim is built from, as rgb triples for gradient stops */
  scrimBase: string;
  /**
   * How strongly the veil covers the photograph, across the four gradient
   * stops. Per theme, because the two grounds do not behave alike: a dark veil
   * deepens a photograph and it stays crisp, while a light one *milks* it, and
   * the same opacities that read well in dark left the light hero looking like
   * a faded print. Light therefore covers hard only where the copy sits and
   * gets out of the way fast.
   */
  scrimVeil: readonly [number, number, number, number];
  /** frosted panel on a photograph */
  scrimGlass: string;
  scrimGlassLine: string;
  /** accents that stay legible on a dark photograph */
  scrimAccent: string;
  scrimGood: string;
  scrimGoodBg: string;
  scrimGoodLine: string;
  /** the border on a glass panel the eye is being sent to */
  scrimGlassLit: string;
  /**
   * The frost. Without it a glass panel is only a tinted rectangle, so the
   * tint has to be heavy enough to carry text by itself and stops being
   * see-through — which is how these shipped first as white pills and then as
   * dark ones. With the blur the tint drops to 30% and the photograph reads
   * through properly.
   */
  scrimGlassBlur: string;

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
  ground: 'light',
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
  scrimText: '#071449',
  scrimTextMuted: '#33436c',
  scrimTextFaint: '#4a587c',
  scrimBase: '246, 249, 255',
  scrimVeil: [0.9, 0.68, 0.24, 0.08],
  scrimGlass: 'rgba(10, 16, 30, 0.30)',
  scrimGlassLine: 'rgba(255, 255, 255, 0.20)',
  scrimAccent: '#0a56b8',
  scrimGood: '#4ed67f',
  scrimGoodBg: 'rgba(78, 214, 127, 0.16)',
  scrimGoodLine: 'rgba(78, 214, 127, 0.32)',
  scrimGlassLit: 'rgba(124, 182, 255, 0.7)',
  scrimGlassBlur: 'blur(14px) saturate(120%)',

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

/**
 * "Dark Grey" — a charcoal/graphite UI carrying light ink. Neutral, not navy.
 *
 * It is the middle of three themes, and the mistake it has been corrected out
 * of twice is reading "middle" as *mid-luminance*. It is not: all three are
 * page designs, and this one is a **dark** page. What makes it the middle is
 * that it is a lighter charcoal than `dark`'s near-black navy — softer
 * contrast, less-deep blacks, a restrained brand glow — not that it sits
 * halfway to `light`.
 *
 * The defect it is corrected out of *this* time is the first kind: shipped at a
 * page of L* 8.1 against dark's L* 3.1, five points apart on a hundred-point
 * scale, it was a second near-black. Every rung was already lighter than dark's
 * corresponding rung, so it was never inverted — it was simply too close to
 * see. The page now sits at L* 20.7 and the whole ladder clears dark's
 * brightest surface by six points.
 *
 *                     dark    grey    light      (CIE L*, from the hexes below)
 *   surfaceInset      12.4    18.9      95.7
 *   background         3.1    20.7      96.8
 *   surfaceMuted       7.9    21.6      97.9
 *   surface            6.5    23.0     100.0
 *   surfaceRaised     10.5    24.3     100.0
 *
 * The ladder is also a different *shape*, not a scaled copy of dark's. Dark is
 * pinned against black, so it has nowhere to go but up and its "inset" well is
 * its brightest surface. Grey has headroom below its page, so an inset well
 * genuinely recedes — which is light's elevation architecture (inset below the
 * page, muted and card above it, panel highest) run at dark polarity. Reading
 * the middle column top to bottom reads the ladder in order; reading either
 * outer column does not.
 *
 * Why the ladder is only 5.4 L* tall, where dark's is 9.4
 * ------------------------------------------------------
 * Because accents are painted *on* these surfaces, and on a lighter ground a
 * tint of an accent costs more contrast than it buys. `softFill` puts an accent
 * disc under an accent-coloured glyph, `api-docs` writes a `JS` / `Py` monogram
 * on that same disc in the same accent, and `brandSoft` / `chipBg` carry small
 * accent labels. Every one of those is the accent measured against a ground
 * partly made of itself, so the headroom shrinks from both ends as the page
 * rises. A taller ladder here does not fail gracefully — it forces the accents
 * to bleach to pastel to stay legible on their own washes. This ladder, a 15%
 * softer `softFill`, and accents lifted 31% toward white is the combination
 * that keeps a recognisable brand blue: worst raw accent-on-its-own-disc is
 * 4.53:1, worst quiet ink anywhere on the page is 4.62:1.
 */
const grey: ThemeTokens = {
  mode: 'grey',
  ground: 'dark',
  // L* 20.7 — the page. Six points above dark's brightest surface (L* 12.4), so
  // no rung of this ladder can be confused with any rung of that one.
  background: '#2f3238',
  surface: '#34373d',
  surfaceRaised: '#373a40',
  surfaceMuted: '#31343a',
  // The one rung that goes *down*: a well, not a highlight. See the note above.
  surfaceInset: '#2b2e34',

  text: '#f1f4f8',
  // Lifted, because the page is. The floor is not a surface: it is the
  // lightest thing actually painted, which is an accent's own 20% pill on the
  // raised surface at L* 36.9. The old palette documented its quiet ink against
  // "surfaceInset, the tightest of the five" — true of a near-black page, and
  // silently false the moment the ladder changed shape.
  //   worst anywhere: text 6.57:1  textMuted 5.55:1  textSubtle 4.62:1
  textMuted: '#d8e2f2',
  textSubtle: '#c3cfe5',
  // Neutral near-black, to match the charcoal palette: 9.37:1 on brand,
  // 11.33 brandStrong, 9.76 violet, 11.48 green, 11.64 orange, 8.86 pink.
  textOnBrand: '#101317',
  textOnScrim: '#ffffff',
  scrimText: '#ffffff',
  scrimTextMuted: '#c8d4ee',
  /**
   * Lighter than dark's `#93a4c9`, and the one scrim token the two dark
   * palettes do not share.
   *
   * Measured on the rendered home hero at 390, this ink lands on the frosted
   * panel at `#434953` and scored 3.62:1 there — the same node, the same ground
   * and the same figure in `dark`, because every scrim token was transcribed
   * between them. Dark needs its own lane for that; this palette does not get to
   * ship the failure while it waits. 5.05:1 now, and 'lighter text and icons' is
   * this theme's brief rather than a departure from it.
   */
  scrimTextFaint: '#b6c2d8',
  scrimBase: '6, 10, 20',
  scrimVeil: [0.95, 0.88, 0.62, 0.42],
  scrimGlass: 'rgba(10, 16, 30, 0.30)',
  scrimGlassLine: 'rgba(255, 255, 255, 0.18)',
  scrimAccent: '#7cb6ff',
  scrimGood: '#4ed67f',
  scrimGoodBg: 'rgba(78, 214, 127, 0.16)',
  scrimGoodLine: 'rgba(78, 214, 127, 0.32)',
  scrimGlassLit: 'rgba(124, 182, 255, 0.7)',
  scrimGlassBlur: 'blur(14px) saturate(120%)',

  // Transcribed from the old palette by *perceptual* distance rather than by
  // hex: each sits the same number of L* points off its reference surface as
  // before (border +11.1, borderStrong +21.2, divider +11.6). On a ladder this
  // shallow the borders, not the fills, are what separate a card from the page.
  border: '#4c5159',
  borderStrong: '#626973',
  divider: '#474c54',

  // Lifted 31% toward white — the "lighter icons" half of this theme's brief,
  // and the least that keeps every accent legible as raw text on its own soft
  // disc (4.53:1 at worst, on pink). They are still accents and not pastels:
  // the narrowest channel spread here is violet's 79 of 255.
  brand: '#86bbff',
  brandStrong: '#a5cdff',
  brandSoft: '#363e4c',
  violet: '#c4b0ff',
  green: '#7bdfa5',
  orange: '#ffc084',
  pink: '#ff91b7',

  // The tinted panels are authored to a target *lightness*, not to a shared
  // alpha, and over `surfaceInset` rather than over the card — a tinted panel
  // should recede. At one alpha the orange panel lands two L* points above the
  // blue one purely because orange is a brighter hue, and the lightest of the
  // four then sets the floor for every accent written on any of them.
  chipBg: '#37414f',
  chipText: '#86bbff', // 5.20:1
  successBg: '#344140',
  successText: '#7bdfa5', // 6.55:1 — the accent itself already clears it here
  warnBg: '#403d3c',
  warnText: '#ffc084', // 6.73:1 — likewise

  // The palette's own brand → violet accents, so a gradient fill and a solid
  // `t.brand` fill sit at the same tone and take the same ink. 9.37:1.
  gradient: ['#86bbff', '#c4b0ff'],
  // Same arc, lifted until every stop still clears 4.5:1 after the banner's own
  // 22% scrim: 4.55 / 4.85 / 4.72. Deeper than the button gradient because the
  // scrim spends roughly a third of the budget before the copy lands.
  ctaGradient: ['#56a1ff', '#84a1ff', '#ac91ff'],

  // Not pure black, and not dark's strength. A black shadow on a charcoal card
  // reads as dirt rather than depth, and the softer contrast this theme is
  // meant to have starts with its elevation. `video-studio` also paints its
  // player from this colour at 0.82, which lands on #0c0f15 over a grey card —
  // chrome, as intended.
  shadowColor: '#05070b',
  shadowStrength: 0.38,

  statusBar: 'light',
};

/** Near-black navy. */
const dark: ThemeTokens = {
  mode: 'dark',
  ground: 'dark',
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
  scrimText: '#ffffff',
  scrimTextMuted: '#c8d4ee',
  scrimTextFaint: '#93a4c9',
  scrimBase: '6, 10, 20',
  scrimVeil: [0.95, 0.88, 0.62, 0.42],
  scrimGlass: 'rgba(10, 16, 30, 0.30)',
  scrimGlassLine: 'rgba(255, 255, 255, 0.18)',
  scrimAccent: '#7cb6ff',
  scrimGood: '#4ed67f',
  scrimGoodBg: 'rgba(78, 214, 127, 0.16)',
  scrimGoodLine: 'rgba(78, 214, 127, 0.32)',
  scrimGlassLit: 'rgba(124, 182, 255, 0.7)',
  scrimGlassBlur: 'blur(14px) saturate(120%)',

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

/**
 * WCAG relative luminance.
 *
 * This used to weight the raw sRGB channels, with no gamma decode — which is a
 * different quantity that happens to look like this one, and any threshold
 * tuned against it is tuned against nothing in particular. `#111111` measured
 * 0.067 under it and measures 0.0056 here; `#ff0000` measures 0.213 under both,
 * because a saturated primary is the one case where the two agree. The cut-off
 * in `brandColor` moved with it, deliberately preserving the same rescue set —
 * see there.
 */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const channel = (start: number) => {
    const c = parseInt(full.slice(start, start + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * Brand glyphs keep their own colour, except the near-black ones (TikTok,
 * Apple, X, GitHub, Notion, Intercom, Copilot) which disappear entirely on a
 * dark surface.
 *
 * The test is the **ground**, not the mode: a light page never swallows a
 * near-black mark, whatever the theme is called. Under the charcoal grey this
 * evaluates exactly as `t.mode === 'light'` did.
 *
 * The cut-off is 0.02 of true relative luminance, which is the same rescue set
 * the old `< 0.12` naive cut-off produced — the seven marks below 0.0087 are
 * rescued, and the next mark up (Slack, 0.0250) is not. Anything higher starts
 * swallowing saturated-but-dark marks: YouTube red is 0.2126 and was once being
 * repainted as a white block.
 *
 * What is deliberately *not* rescued: bright marks. On this palette's card they
 * measure Airtable 4.99:1, Amazon 4.93, WhatsApp 5.32, so the question does not
 * arise here — but it did on a mid-grey page, where the same three scored about
 * 1.0:1 and this test, which only ever looks downward, could not see them. Were
 * a light-ish ground ever added, the fix is not to invent a colour for someone
 * else's mark: each is labelled in text beside the glyph, and a logotype is
 * exempt from the contrast minimum for that reason.
 */
export function brandColor(hex: string, t: ThemeTokens): string {
  if (t.ground === 'light') return hex;
  return luminance(hex) < 0.02 ? t.text : hex;
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
 * How far `accentText` moves an accent, per palette. Negative darkens.
 *
 * The direction is a property of the **ground** — darker on a light page,
 * lighter on a dark one. The *magnitude* is not: it is how much headroom the
 * palette has between its accents and the grounds those accents are written on,
 * and the two dark palettes do not have the same amount. Dark's card is L* 6.5
 * and grey's is L* 23.0, and these labels frequently land on the accent's own
 * 20% pill *over* that card — a ground that rises with the page and with the
 * accent at once. At dark's 0.2 those labels measured 3.2-4.2:1 in grey.
 *
 * Keyed on mode rather than ground for exactly that reason: this is a
 * per-palette quantity, and collapsing it to two values is the same mistake in
 * a smaller box.
 */
const ACCENT_TEXT_SHIFT: Record<V5ThemeMode, number> = { light: -0.16, grey: 0.37, dark: 0.2 };

/**
 * An accent, adjusted for use as *text on a tinted ground*.
 *
 * The palette accents are tuned to clear 4.5:1 on the tightest surface. Soft
 * band grounds and 20% chip washes sit off that value, which costs anywhere
 * from a tenth of a point on a near-black page to a full point on a charcoal
 * one. This nudges the accent in whichever direction the ground needs, by
 * whichever amount the palette needs.
 *
 * Only for text. Fills and icons are unaffected — they are not held to a
 * contrast ratio, and keeping them where they are is what stops the accents
 * bleaching out as the page lightens.
 */
export function accentText(hex: string, t: ThemeTokens): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const shift = ACCENT_TEXT_SHIFT[t.mode];
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

/**
 * How opaque a soft icon backdrop is, per palette.
 *
 * Not a ground question either, and — unlike almost everything else here — not
 * a question of how far the disc lifts.
 *
 * The disc is a tint of the same accent that is drawn on top of it: a
 * `softFill(brand)` circle under a brand-coloured glyph, and in `api-docs` under
 * a brand-coloured `JS` monogram. So the alpha both lifts the disc off the card
 * and eats the contrast of what sits on it, and the second effect grows as the
 * page gets lighter. Dark can spend 0.18 because its card is near-black and the
 * disc still lands far below its accent; the same 0.18 on grey's L* 23 card put
 * that monogram at 2.95:1. 0.10 is the most grey can spend and still carry it
 * (4.53:1 at worst, on pink), and it still lifts the disc 5.6 L*.
 *
 * The rule is therefore "the largest tint the glyph on it can survive", not
 * "the tint that matches dark's lift" — which is why this is per palette.
 */
const SOFT_FILL_ALPHA: Record<V5ThemeMode, number> = { light: 0.1, grey: 0.1, dark: 0.18 };

/** Tint a solid colour towards the current surface — for soft icon backdrops. */
export function softFill(hex: string, t: ThemeTokens): string {
  return hexToRgba(hex, SOFT_FILL_ALPHA[t.mode]);
}
