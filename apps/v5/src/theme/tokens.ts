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
   * `mode` names the theme; `ground` names the only thing about it that twenty
   * call sites across the site ever actually asked `mode` about. They asked it
   * as `t.mode === 'light'`, which was a correct shorthand for exactly as long
   * as grey was a second dark — an editor panel borrowed the dark palette
   * "unless light", an artwork strip picked its alpha "unless light", a scrim
   * picked its opacity "unless light". Grey becoming a mid page falsified all
   * twenty at once, and none of them would have gone red: they compile, and
   * they render a dark-theme decision onto a light-theme page.
   *
   * Naming the property is what makes the next theme cheap. A fourth palette
   * declares which side it is on and every one of those call sites is already
   * right.
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
   * uses. The two light-ground themes keep white, because their accents are
   * deep. `dark` raises its accents to light tones (`brand` is `#4f9dff`
   * there, not `#0878f9`) so they read against a near-black page — which means
   * white on top of them scored 2.0–2.9:1, i.e. below even the 3:1 large-text
   * floor, on every "Approve" / "Accept all" / "Pay" / step-number fill on the
   * site. Dark ink on a light fill is the correct inversion, and it fixes all
   * ~44 call sites at once without any of them knowing.
   *
   * Grey used to be on dark's side of this and is now on light's: when its
   * page stopped being near-black its accents stopped needing to be light, and
   * the ink on them went back to white.
   *
   * The consequence, and it is deliberate: `gradient` and `ctaGradient` must
   * stay light enough in `dark` for a dark ink, and dark enough in the two
   * light-ground themes for a white one. They are background-only tokens, so
   * that is a free trade either way — see the notes on them below.
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
   * copy stays navy, in grey a mid-grey one with the same dark copy, and in
   * dark the near-black one with the copy in white. Same photograph, three
   * grounds, the theme switch still means something on the first screen of the
   * site.
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
   * gets out of the way fast; grey does the same thing one notch firmer,
   * because a mid veil has about half light's headroom over a photograph.
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
   * dark ones. With the blur the tint can drop far enough for the photograph to
   * read through: 30% on the two themes whose veil is near-white or near-black,
   * 55% in grey, where the tint has to fight a mid veil for the white ink it
   * carries. See `scrimGlass` on each palette.
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
  orangeText: string;
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
  background: '#faf9f6',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceMuted: '#faf9f6',
  surfaceInset: '#f3f2ee',

  text: '#0b1533',
  textMuted: '#414d77',
  // 4.70:1 on surfaceInset (the darkest light surface) and 5.24:1 on white.
  // #6b7899 scored 3.95–4.40 and carries 400+ small nodes; textMuted is 7.72:1
  // on white, so this stays unmistakably the quietest of the three tiers.
  textSubtle: '#5b6486',
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

  border: '#e4e3dd',
  borderStrong: '#cfcec6',
  divider: '#edece7',

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
  brand: '#1d4ed8',
  brandStrong: '#1740b0',
  brandSoft: '#f3f2ee',
  violet: '#6d28d9',
  green: '#0e7b3a',
  orange: '#d9631a',
  orangeText: '#ad5100',
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
 * "Grey" is a **mid** page — not a dimmer dark and not a paler light, but the
 * light theme's *structure* (dark ink, grounds that rise for a card and recede
 * for a well) at about half the luminance.
 *
 * It used to be a second dark, and the name was the only thing separating it
 * from `dark`. WCAG relative luminance of the five surfaces, measured on the
 * palette this replaces:
 *
 * ```
 *              background  surface  surfaceRaised  surfaceMuted  surfaceInset
 *   light        0.9098    1.0000     1.0000         0.9553        0.8879
 *   grey (was)   0.0093    0.0160     0.0224         0.0184        0.0272
 *   dark         0.0036    0.0079     0.0130         0.0095        0.0166
 * ```
 *
 * Grey's page sat **0.6% of the way from dark to light**, and it was *darker
 * than dark's own `surfaceRaised` (0.0130) and `surfaceInset` (0.0166)* — the
 * two ladders interleaved. Someone picking the middle of three themes got a
 * page darker than the recessed surfaces of the darkest one.
 *
 * ```
 *   grey (now)   0.4536    0.5811     0.6492         0.5066        0.4040
 * ```
 *
 * Dark's brightest surface is 0.0166 and light's dimmest is 0.8879, so the
 * three families no longer overlap anywhere.
 *
 * The ladder is transcribed from the portal's `packages/design-tokens`, which
 * made this correction first, so the two products agree on what grey is:
 * `surface.canvas` → `background`, `surface.raised` → `surface`,
 * `surface.overlay` → `surfaceRaised`, `surface.hover` → `surfaceMuted`,
 * `surface.sunken` → `surfaceInset`. Every ratio in the comments below is
 * measured against **these** five surfaces, never copied from the portal's.
 *
 * Three things do not survive a transcription and are authored here:
 *
 * **The ink inverts.** `text` was `#f1f4f8` — near-white on near-black. Every
 * text, scrim and on-brand token had to be re-derived from the other side.
 *
 * **The accents are deepened, not reused.** A blue that clears 4.5:1 on white
 * does not clear it on a ground at 0.45. Each accent below is the *lightest*
 * value on its own hue that clears 4.5:1 both as text on `surfaceInset` (the
 * darkest of the five) and under white on a solid fill — the same rule light
 * applies, run against a mid ground.
 *
 * **The washes are hand-authored, not scaled.** A tint loses its chroma faster
 * than its luminance when it is dimmed, so light's chip / success / warn
 * grounds scaled down arrive as three greys on a grey page — legible, and
 * indistinguishable. They carry more saturation here to say the same thing at
 * half the brightness.
 */
const grey: ThemeTokens = {
  mode: 'grey',
  ground: 'light',
  background: '#AEB4BE',
  surface: '#C4C9D1',
  surfaceRaised: '#CFD3DA',
  surfaceMuted: '#B8BDC6',
  surfaceInset: '#A4ABB6',

  // 8.20:1 on surfaceInset, the tightest of the five surfaces; 9.09 on the
  // page, 11.39 on a card, 12.62 on a raised panel.
  text: '#0A1020',
  // 6.13:1 on surfaceInset
  textMuted: '#232B3C',
  // 4.86:1 on surfaceInset — the quietest of the three tiers that still clears
  // AA on the darkest surface. #3E4556 was the next step down and scored 4.14.
  textSubtle: '#333B4B',
  // White, and this is the inversion the whole theme turns on. Grey used to
  // raise its accents to light tones so they read on a near-black page, which
  // forced a near-black ink on top of them. The accents below are deep, so the
  // ink goes back to white: 10.43:1 on brand, 11.93 brandStrong, 11.12 violet,
  // 10.60 green, 10.56 orange, 10.53 pink.
  textOnBrand: '#ffffff',
  // Glass over a photograph stays a dark tint in every theme, so its ink stays
  // white in every theme. See scrimGlass.
  textOnScrim: '#ffffff',
  // The veil is now the page's own grey rather than a near-black, so the copy
  // on it is the page's own ink. Measured on the *rendered* hero rather than on
  // the token: 8.76:1 at 1440, 9.02 at 768, 10.13 at 390.
  scrimText: '#0A1020',
  // 6.42 / 6.53 / 6.53 across the same three widths — and 5.02 at the worst
  // point of all, the right-hand third of the body copy at 768, where the veil
  // has thinned and the photograph is dark. That point is what set the veil.
  scrimTextMuted: '#232B3C',
  // A step deeper than `textSubtle`, which the two grounded tiers above reuse.
  // #333B4B measured 4.40:1 on the rendered page at 768; this is 5.15–5.63
  // across the three widths and 4.68 at its own worst third.
  scrimTextFaint: '#2E3644',
  scrimBase: '174, 180, 190',
  /*
   * Far firmer than light's [0.9, 0.68, 0.24, 0.08], and the tail is what
   * matters rather than the head.
   *
   * A mid veil has roughly half light's headroom over a photograph, and the
   * hero copy is only inset from the left on a wide screen: at 768 and 390 it
   * runs the full width and its last third sits under the veil's *thin* end.
   * Measured there with light's curve transcribed, grey's body copy scored
   * 2.84:1 at 768 and 2.77:1 at 390.
   *
   * Worth recording, because it is the reason this is a grey-only change:
   * LIGHT fails the same measurement harder — 1.94:1 at 768 and 1.48:1 at 390
   * on the same words — and dark passes everywhere, because a near-black veil
   * at any opacity is still dark. The defect belongs to light grounds, grey
   * inherited it by transcription, and only grey is in scope here. Light's
   * figures are recorded so the next person does not have to rediscover them.
   *
   * With this curve the worst third of any hero string is 4.68:1, at 768.
   * The photograph pays for it: it reads as a soft ground rather than a picture
   * at full strength. That is the trade, taken deliberately.
   */
  scrimVeil: [0.95, 0.9, 0.8, 0.68],
  // Deepened from light's 0.30, and measured rather than inherited. The glass
  // is a window onto the photograph and stays a dark tint in all three themes —
  // but it composites over the *veil*, and at 0.30 over a mid veil it landed at
  // #808691, where the white ink it carries scored 3.66:1. It is also coupled
  // to `scrimVeil`: every time the veil was firmed to protect the body copy,
  // the glass got a lighter backdrop and the pills inside it lost ground. At
  // 0.72 against the final veil the badge ink measures 10.75–10.92:1 and the
  // status pills 5.55–6.39:1.
  scrimGlass: 'rgba(10, 16, 30, 0.72)',
  scrimGlassLine: 'rgba(255, 255, 255, 0.22)',
  // The headline tail, painted on the veil rather than on glass — so unlike the
  // rest of this family it follows the theme. 5.56:1 measured on the rendered
  // hero at 1440, where the tail actually falls.
  scrimAccent: '#063572',
  // Lifted from the shared #4ed67f. It is a *label* on the hero's status pills,
  // not only the live dot, so it owes 4.5:1 — and the pill's ground is
  // scrimGoodBg over glass over the veil, the deepest stack of tints on the
  // page. At #4ed67f over grey's veil it measured 3.27:1 at 390; this measures
  // 5.55–6.39:1 across the three widths.
  scrimGood: '#6FE3A0',
  // The wash is thinner and the line is firmer than the other two palettes, and
  // measuring said why: the glass beneath it renders at 0.014 luminance, so
  // nearly all of the pill's lightness was coming from its own 16% green tint —
  // the ground the label has to clear was being raised by the label's own hue.
  // At 0.10 the pill still reads as a pill, because the border carries it.
  scrimGoodBg: 'rgba(111, 227, 160, 0.10)',
  scrimGoodLine: 'rgba(111, 227, 160, 0.38)',
  scrimGlassLit: 'rgba(124, 182, 255, 0.7)',
  scrimGlassBlur: 'blur(14px) saturate(120%)',

  // 1.22 / 1.51 / 2.20 against the page. These separate adjacent surfaces and
  // are never the sole boundary of a control; light's own ladder scores 1.10 /
  // 1.21 / 1.33 there, so grey is the firmer of the two light-ground themes.
  border: '#8A929E',
  borderStrong: '#6E7683',
  divider: '#9CA3AE',

  // Like LIGHT and unlike the old grey, an accent here is used both as text and
  // as a fill, and both roles pull the same way — so the hue is deepened rather
  // than the ink on it. Each value is the LIGHTEST one on its hue that clears
  // 4.5:1 both as text on surfaceInset (#A4ABB6, the darkest grey surface) and
  // under white on a solid fill.
  //   was (light tones, for a near-black page) -> now   as-text / white-on-fill
  //   brand   #4f9dff -> #063D85                1.85 -> 4.51 / 1.83 -> 10.43
  //   violet  #a98cff -> #431B9E                1.55 -> 4.81 / 2.14 -> 11.12
  //   green   #3fd07c -> #084A23                1.10 -> 4.51 / 2.31 -> 10.60
  //   orange  #ffa34d -> #663000                1.08 -> 4.57 / 2.32 -> 10.56
  //   pink    #ff5f96 -> #810235                1.35 -> 4.55 / 2.09 -> 10.53
  brand: '#063D85',
  brandStrong: '#063572',
  // Hand-authored, not `brand` scaled towards the surface: a 5% tint of this
  // blue on a mid ground is a grey. This carries real chroma and still takes
  // the page's ink at 11.01:1, with `brand` on it at 6.06:1.
  brandSoft: '#B9C6DE',
  violet: '#431B9E',
  green: '#084A23',
  orange: '#663000',
  orangeText: '#663000',
  pink: '#810235',

  // 6.58:1
  chipBg: '#9FB0D8',
  chipText: '#0E2170',
  // 5.55:1
  successBg: '#A8CBB4',
  successText: '#004F20',
  // 6.02:1
  warnBg: '#E5C6A2',
  warnText: '#752E00',

  // The palette's own brand → violet, so a gradient fill and a solid `t.brand`
  // fill sit at the same tone and take the same ink: 10.43:1 and 11.12:1 under
  // white. The old note here said the gradient had to stay *light* enough for a
  // dark ink; the constraint flipped with the ink.
  gradient: ['#063D85', '#431B9E'],
  // Light's arc at 60%. Measured after the banner's own 22% shadowColor scrim,
  // which is the budget that matters: #03467C 9.67:1, #0E2978 13.07:1 and
  // #351A7C 13.21:1 under white.
  ctaGradient: ['#005495', '#0e2f90', '#401b95'],

  // Not black. A pure-black shadow on a mid ground reads as dirt; this is the
  // page's own ink hue, at the strength the portal's elevation ladder uses.
  shadowColor: '#0e1522',
  shadowStrength: 0.18,

  statusBar: 'dark',
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
  orangeText: '#ffa34d',
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
 *
 * The rescue is for a **dark ground only**, and that is now stated by the
 * ground rather than by naming light. It used to read `t.mode === 'light'`,
 * which sent grey down the rescue path; on a mid page that path is not merely
 * unnecessary, it is backwards. The six marks the `< 0.12` cut-off fires on are
 * the six that score *best* on grey's page — GitHub 8.58:1, TikTok 9.06:1,
 * Apple / X / Notion / Copilot 10.07:1 — so it would have repainted the
 * official mark with the theme's ink to fix a problem the mid ground does not
 * have.
 *
 * The marks that genuinely vanish on a mid grey are the bright ones, and this
 * function cannot see them: Airtable `#18BFFF` measures 1.01:1 on the page,
 * Amazon `#ff9900` 1.03:1, WhatsApp `#25d366` 1.05:1. They are not rescued
 * here and deliberately so — a logotype is exempt from the contrast minimum,
 * every one of them is labelled in text beside the glyph, and light has
 * carried exactly the same figures since it shipped (Airtable is 1.60:1 on
 * white). Repainting them would mean inventing a colour for someone else's
 * mark, which the rest of `brand-logo.tsx` exists to prevent.
 */
export function brandColor(hex: string, t: ThemeTokens): string {
  if (t.ground === 'light') return hex;
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
 * put a 12px chip label at 4.36 in light. This nudges the accent in whichever
 * direction the *ground* needs: darker on a light one, lighter on a dark one.
 *
 * Grey moved sides with the rest of the palette. On the mid page a −16% shift
 * takes `brand` `#063D85` to `#053370`, which measures 6.11:1 on a 12% soft
 * fill over a card and 4.97:1 over the page itself; the +20% it used to get
 * would have moved it the wrong way.
 *
 * Only for text. Fills and icons are unaffected — they are not held to a
 * contrast ratio.
 */
const toRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};
const toHex = (c: [number, number, number]): string =>
  '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const relLum = (c: [number, number, number]): number => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: [number, number, number], b: [number, number, number]): number => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const overlay = (
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number,
): [number, number, number] => [
  fg[0] * alpha + bg[0] * (1 - alpha),
  fg[1] * alpha + bg[1] * (1 - alpha),
  fg[2] * alpha + bg[2] * (1 - alpha),
];

const ACCENT_TEXT_CACHE = new Map<string, string>();

/**
 * Readable text in an accent colour — GUARANTEED readable, not nudged and hoped
 * about.
 *
 * This used to apply a flat -16% in light mode. A fixed nudge is a cosmetic
 * shift that says nothing about legibility, and the results proved it: `brand`
 * happened to land dark enough, while `orange` came out at #b65316 and scored
 * 4.41:1 on a tinted chip — under AA, and under it on eighteen surfaces across
 * six routes. Nothing in the old function could have noticed, because it never
 * asked what the number was.
 *
 * So it now darkens (or lightens, on dark grounds) until the answer is actually
 * 4.5:1, and it measures against the WORST ground the accent realistically sits
 * on: its own softFill tint, which is darker than the plain surface. Clearing
 * that clears white too.
 *
 * The consequence is that adding a new accent can no longer introduce an
 * unreadable label — the guarantee belongs to the helper, not to whoever
 * remembers to check.
 */
export function accentText(hex: string, t: ThemeTokens): string {
  const key = hex + '|' + t.mode;
  const cached = ACCENT_TEXT_CACHE.get(key);
  if (cached) return cached;

  const light = t.ground === 'light';
  /*
   * Measure against the WORST surface the accent can land on, not the nicest.
   * Targeting surfaceRaised alone left a green chip at 4.45:1 - it clears 4.5
   * on a raised white card, but that chip sits on an inset panel, and the tint
   * over a darker surface is darker again. Picking the least contrasty ground
   * of the four means clearing it clears the others too.
   */
  const candidates = [t.surfaceRaised, t.surface, t.background, t.surfaceMuted, t.surfaceInset]
    .filter(Boolean)
    .map((s) => overlay(toRgb(hex), toRgb(s as string), SOFT_FILL_ALPHA[t.mode]));
  const base = toRgb(hex);
  const ground = candidates.length
    ? candidates.reduce((worst, g) => (contrast(base, g) < contrast(base, worst) ? g : worst))
    : overlay(base, toRgb(t.background), SOFT_FILL_ALPHA[t.mode]);
  const target: [number, number, number] = light ? [0, 0, 0] : [255, 255, 255];

  let out = toRgb(hex);
  // 4% steps toward black/white; 25 of them span the full range, and the loop
  // stops the moment the ratio is met so hues keep as much chroma as they can.
  for (let i = 0; i <= 25 && contrast(out, ground) < 4.5; i++) {
    out = overlay(target, toRgb(hex), Math.min(1, i * 0.04));
  }
  const result = toHex(out);
  ACCENT_TEXT_CACHE.set(key, result);
  return result;
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
 * Tint a solid colour towards the current surface — for soft icon backdrops.
 *
 * Three values rather than two, because the alpha is really asking how much
 * room there is between the accent and the ground. Light has the most (a deep
 * accent on white), dark has the most in the other direction (a light accent on
 * near-black), and grey has the least in both: its accents are deep *and* its
 * page is mid, so 0.10 leaves the tile almost invisible and 0.18 turns it into
 * a second card. 0.13 puts `brand` at `#ACB7C7` on a card, which is a tint you
 * can see without it reading as a surface of its own.
 */
const SOFT_FILL_ALPHA: Record<V5ThemeMode, number> = { light: 0.1, grey: 0.13, dark: 0.18 };

export function softFill(hex: string, t: ThemeTokens): string {
  return hexToRgba(hex, SOFT_FILL_ALPHA[t.mode]);
}
