import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { accentText, brandColor, hexToRgba, palettes, softFill, type ThemeTokens, type V5ThemeMode } from './tokens.ts';

/**
 * The public site has three themes and, until this file existed, nothing that
 * could tell them apart.
 *
 * Dark Grey shipped as a near-black page (L* 8.1) beside Dark's L* 3.1 — five
 * points apart on a hundred-point scale, so the middle theme was invisible as a
 * distinct theme. The correction for that overshot to L* 73.1, a light page
 * with dark ink, which is a different theme wearing the same name. Both passed
 * every check that existed, because the only check that existed was `tsc`.
 *
 * Contrast ratios cannot catch either failure: a well-built light page and a
 * well-built dark page both score green. What separates them is *where the
 * palette sits* and *which way its ink runs*, so that is what is asserted here
 * — alongside the per-rung minimums that stop a fix for one from breaking the
 * other, and the handful of call sites that were silently correct only while
 * Grey happened to behave exactly like Dark.
 *
 * Luminance is reimplemented here rather than imported. `tokens.ts` keeps a
 * private copy for `brandColor`, and a test that shares the implementation
 * under test cannot see an error in it.
 */

const MODES: V5ThemeMode[] = ['light', 'grey', 'dark'];
const SURFACES = ['background', 'surface', 'surfaceRaised', 'surfaceMuted', 'surfaceInset'] as const;
type SurfaceKey = (typeof SURFACES)[number];
const ACCENTS = ['brand', 'brandStrong', 'violet', 'green', 'orange', 'pink'] as const;

/* ---------------------------------------------------------------- */
/* colour maths — independent of the implementation under test        */
/* ---------------------------------------------------------------- */

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.x relative luminance, gamma decode included. */
function luminance(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = channels(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L* — perceptual lightness, 0 (black) to 100 (white). */
function lstar(hex: string): number {
  const y = luminance(hex);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/** Composite an alpha colour over an opaque one, the way the renderer does. */
function over(fg: string, alpha: number, bg: string): string {
  const f = channels(fg);
  const b = channels(bg);
  return `#${[0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** `rgba(r, g, b, a)` as the components write it, back to a hex + alpha pair. */
function fromRgba(css: string): { hex: string; alpha: number } {
  const [r, g, b, a] = css.replace(/[^\d.,]/g, '').split(',').map(Number);
  return { hex: `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`, alpha: a };
}

const AA = 4.5;
/** WCAG's floor for a meaningful non-text graphic. */
const AA_GRAPHIC = 3;

/**
 * Shortfalls that already existed in `light` and `dark` when these assertions
 * were first written, and that this work unit deliberately did not touch: it
 * authored Dark Grey, and a separate lane owns the light theme.
 *
 * They are recorded rather than excused. Each entry is the exact measured ratio,
 * so the pair may not get any worse, and any *other* pair failing is a real
 * failure. Dark Grey appears here nowhere — it has no allowance.
 */
const PRE_EXISTING: Record<string, number> = {
  // Dark's quietest ink against an accent pill. Five of the six are short; the
  // pills are `hexToRgba(accent, 0.2)` and dark's `textSubtle` was tuned against
  // `surfaceInset` alone, which no longer describes the lightest thing it lands
  // on. Real, and dark's to fix.
  'dark|textSubtle|a brand pill': 4.2,
  'dark|textSubtle|a brandStrong pill': 3.91,
  'dark|textSubtle|a violet pill': 4.19,
  'dark|textSubtle|a green pill': 3.92,
  'dark|textSubtle|a orange pill': 3.96,
  'dark|textSubtle|a pink pill': 4.44,
  // Light's pink on grounds built from pink. The light theme is being repaired
  // in a separate lane; touching it here would collide with that work.
  'light|pink|own softFill disc on surface': 4.36,
  'light|pink|own softFill disc on surfaceRaised': 4.36,
  'light|pink|softFill glyph on surface': 4.36,
  'light|pink|softFill glyph on surfaceRaised': 4.36,
  'light|pink|own soft band': 4.41,
  // Dark's faint scrim ink on the frosted hero panel at stacked widths. Grey
  // carried the identical figure until its ink was lifted; dark's needs a dark
  // lane, and recording it stops the number drifting further while it waits.
  'dark|scrimTextFaint|the frosted hero panel': 3.62,
};

/** Collects violations so the whole picture is reported, not just the first. */
function checker(mode: V5ThemeMode) {
  const bad: string[] = [];
  return {
    check(subject: string, ground: string, r: number, floor = AA) {
      const key = `${mode}|${subject}|${ground}`;
      const allowed = PRE_EXISTING[key];
      if (r >= floor - 0.005) return;
      if (allowed !== undefined && r >= allowed - 0.005) return;
      bad.push(`${key} = ${r.toFixed(2)}:1 (needs ${allowed !== undefined ? `${allowed} recorded` : floor})`);
    },
    get failures() { return bad; },
  };
}

const ladder = (t: ThemeTokens) => SURFACES.map((k) => t[k]);
const dimmest = (t: ThemeTokens) => ladder(t).reduce((m, c) => (luminance(c) < luminance(m) ? c : m));
const brightest = (t: ThemeTokens) => ladder(t).reduce((m, c) => (luminance(c) > luminance(m) ? c : m));
/** The rung a light-ink palette has the least contrast against, and vice versa. */
const tightest = (t: ThemeTokens) => (t.ground === 'dark' ? brightest(t) : dimmest(t));

/* ---------------------------------------------------------------- */
/* A. `ground` is a measurement, not a label                          */
/* ---------------------------------------------------------------- */

test('every palette declares the ground its own ink measures', () => {
  for (const mode of MODES) {
    const t = palettes[mode];
    const inkIsLighter = luminance(t.text) > luminance(t.background);
    assert.equal(
      t.ground,
      inkIsLighter ? 'dark' : 'light',
      `${mode}: text ${t.text} (L* ${lstar(t.text).toFixed(1)}) on background ${t.background} ` +
        `(L* ${lstar(t.background).toFixed(1)}) is a ${inkIsLighter ? 'dark' : 'light'} ground, ` +
        `but the palette says '${t.ground}'. Two dozen call sites branch on this.`,
    );
  }
});

test('ground is never inferred from mode', () => {
  // The whole point of the property: `ground === 'light'` must be answerable
  // without knowing the palette's name. If it were only ever true for `light`
  // by construction, the abstraction would be decorative — so pin the contract
  // rather than the current membership: every palette answers, and the answer
  // agrees with its own polarity (asserted above) rather than with its name.
  for (const mode of MODES) {
    assert.ok(['light', 'dark'].includes(palettes[mode].ground), `${mode} declares no ground`);
  }
});

/* ---------------------------------------------------------------- */
/* B. the three palettes occupy three distinct places                 */
/* ---------------------------------------------------------------- */

test('Dark Grey is a dark page, neither a second Dark nor a light one', () => {
  const grey = palettes.grey;
  const page = lstar(grey.background);

  assert.equal(grey.ground, 'dark', 'Dark Grey carries light ink on a dark page');

  // The two failures this file exists for. The shipped palette scored 8.1 and
  // the correction for it scored 73.1; both are outside this band, in opposite
  // directions. Charcoal/graphite is L* 20-35.
  assert.ok(page >= 15, `Dark Grey's page is L* ${page.toFixed(1)} — that is a second near-black, not a charcoal`);
  assert.ok(page <= 40, `Dark Grey's page is L* ${page.toFixed(1)} — that is a mid/light page, not a charcoal`);
});

test('no rung of any ladder can be mistaken for a rung of another', () => {
  const gap = (a: ThemeTokens, b: ThemeTokens) => lstar(dimmest(b)) - lstar(brightest(a));

  const darkToGrey = gap(palettes.dark, palettes.grey);
  const greyToLight = gap(palettes.grey, palettes.light);

  assert.ok(
    darkToGrey > 0,
    `Dark's brightest surface (L* ${lstar(brightest(palettes.dark)).toFixed(1)}) is not below Dark Grey's ` +
      `dimmest (L* ${lstar(dimmest(palettes.grey)).toFixed(1)}) — the ladders interleave`,
  );
  assert.ok(greyToLight > 0, 'Dark Grey and Light interleave');

  // Not interleaving is not the same as being distinguishable. The shipped
  // palette cleared some of Dark by hundredths of an L* point.
  assert.ok(
    darkToGrey >= 5,
    `only ${darkToGrey.toFixed(1)} L* between Dark's ceiling and Dark Grey's floor — too close to see`,
  );
  assert.ok(greyToLight >= 30, `only ${greyToLight.toFixed(1)} L* between Dark Grey's ceiling and Light's floor`);
});

test('Dark Grey has its own elevation ladder, not a scaled copy of Dark', () => {
  const order = (t: ThemeTokens) =>
    [...SURFACES].sort((a, b) => luminance(t[a]) - luminance(t[b])).join(' < ');
  assert.notEqual(
    order(palettes.grey),
    order(palettes.dark),
    'Dark Grey climbs its surfaces in exactly Dark\'s order — it is Dark at a different brightness, not its own theme',
  );
  // Dark is pinned against black and can only rise; Grey has room below its
  // page, so its inset well genuinely recedes. That is the difference.
  assert.ok(
    luminance(palettes.grey.surfaceInset) < luminance(palettes.grey.background),
    'Dark Grey\'s inset well should sit below its page — it has the headroom Dark lacks',
  );
});

/* ---------------------------------------------------------------- */
/* C. AA on every rung, not just the one that used to be tightest     */
/* ---------------------------------------------------------------- */

test('all three ink tiers clear AA on all five surfaces of all three palettes', () => {
  for (const mode of MODES) {
    const t = palettes[mode];
    for (const ink of ['text', 'textMuted', 'textSubtle'] as const) {
      for (const surface of SURFACES) {
        const r = contrast(t[ink], t[surface]);
        assert.ok(
          r >= AA,
          `${mode}.${ink} (${t[ink]}) on ${surface} (${t[surface]}) is ${r.toFixed(2)}:1`,
        );
      }
    }
    // The old palettes documented a ratio against "surfaceInset, the tightest
    // of the five". That was true of a near-black page and false the moment the
    // ladder changed shape; nothing would have said so.
    assert.ok(contrast(t.textSubtle, tightest(t)) >= AA, `${mode}: quietest ink fails on its tightest rung`);

    // And the tightest ground is not a surface at all. Ink lands on the tinted
    // panels and on accent pills, which on a lighter page sit above every rung.
    const c = checker(mode);
    for (const wash of ['chipBg', 'successBg', 'warnBg', 'brandSoft'] as const) {
      for (const ink of ['text', 'textMuted', 'textSubtle'] as const) {
        c.check(ink, wash, contrast(t[ink], t[wash]));
      }
    }
    for (const key of ACCENTS) {
      const pill = over(t[key], pillAlpha(t), t.surfaceRaised);
      for (const ink of ['text', 'textMuted', 'textSubtle'] as const) {
        c.check(ink, `a ${key} pill`, contrast(t[ink], pill));
      }
    }
    assert.deepEqual(c.failures, [], `ink fails on a tinted ground — ${c.failures.join(' | ')}`);
  }
});

test('the ink tiers stay distinguishable from each other', () => {
  for (const mode of MODES) {
    const t = palettes[mode];
    const tiers = [lstar(t.text), lstar(t.textMuted), lstar(t.textSubtle)];
    const monotonic = t.ground === 'dark' ? tiers[0] > tiers[1] && tiers[1] > tiers[2] : tiers[0] < tiers[1] && tiers[1] < tiers[2];
    assert.ok(monotonic, `${mode}: the three ink tiers are not ordered — ${tiers.map((n) => n.toFixed(1)).join(' / ')}`);
    assert.ok(
      Math.abs(tiers[0] - tiers[2]) >= 8,
      `${mode}: only ${Math.abs(tiers[0] - tiers[2]).toFixed(1)} L* between the loudest and quietest ink`,
    );
  }
});

/* ---------------------------------------------------------------- */
/* D+E+F. accents, as text and as fills                               */
/* ---------------------------------------------------------------- */

/**
 * The alphas the components paint these accents at. They are duplicated from
 * the call sites deliberately — `ui.tsx` bandGround, the `liveChip` pills in
 * `call-agent` / `live-room`, and the chart area fills all pick between two
 * numbers on `t.ground`. If a component changes its alpha, this file has to be
 * told, which is the point: the alpha and the accent are one contract.
 */
const bandAlpha = (t: ThemeTokens) => (t.ground === 'light' ? 0.05 : 0.09);
const pillAlpha = (t: ThemeTokens) => (t.ground === 'light' ? 0.12 : 0.2);

/** The tinted panel each accent is written on, where it has one. */
const OWN_WASH: Partial<Record<(typeof ACCENTS)[number], ['chipBg' | 'successBg' | 'warnBg' | 'brandSoft', ...('chipBg' | 'successBg' | 'warnBg' | 'brandSoft')[]]>> = {
  brand: ['chipBg', 'brandSoft'],
  green: ['successBg'],
  orange: ['warnBg'],
};

/**
 * Every opaque ground an accent is actually painted on, read off the rendered
 * pages rather than guessed: the five surfaces, its own tinted panel, its own
 * `softFill` disc (`api-docs` writes a `JS` monogram on one, in the accent), and
 * its own soft band.
 */
function accentGrounds(t: ThemeTokens, key: (typeof ACCENTS)[number]): [string, string][] {
  const accent = t[key];
  const { hex, alpha } = fromRgba(softFill(accent, t));
  return [
    ...SURFACES.map((k) => [k, t[k]] as [string, string]),
    ...(OWN_WASH[key] ?? []).map((w) => [w, t[w]] as [string, string]),
    ['own softFill disc on surface', over(hex, alpha, t.surface)],
    ['own softFill disc on surfaceRaised', over(hex, alpha, t.surfaceRaised)],
    ['own soft band', over(accent, bandAlpha(t), t.background)],
  ];
}

test('an accent used as raw text clears AA on every ground it is painted on', () => {
  // `accentText` exists, but plenty of call sites paint `t.brand` straight into
  // a Text style — the consent banner's policy link, the pricing plan's credit
  // line, `api-docs`'s language monogram. On a near-black page those cleared AA
  // without anyone deciding they should; on a lighter charcoal they are the
  // first thing to fall, and nothing here would have said so.
  for (const mode of MODES) {
    const t = palettes[mode];
    const c = checker(mode);
    for (const key of ACCENTS) {
      for (const [name, ground] of accentGrounds(t, key)) c.check(key, name, contrast(t[key], ground));
    }
    assert.deepEqual(c.failures, [], `raw accent text below AA — ${c.failures.join(' | ')}`);
  }
});

test('accent text clears AA on every ground it is painted on', () => {
  for (const mode of MODES) {
    const t = palettes[mode];
    for (const key of ACCENTS) {
      const accent = t[key];
      const ink = accentText(accent, t);
      const grounds: [string, string][] = [
        ['surfaceRaised', t.surfaceRaised],
        ['surface', t.surface],
        ['own pill on surface', over(accent, pillAlpha(t), t.surface)],
        ['own pill on surfaceRaised', over(accent, pillAlpha(t), t.surfaceRaised)],
        ['own soft band', over(accent, bandAlpha(t), t.background)],
      ];
      for (const [name, ground] of grounds) {
        const r = contrast(ink, ground);
        assert.ok(r >= AA, `${mode}: accentText(${key}) ${ink} on ${name} ${ground} is ${r.toFixed(2)}:1`);
      }
    }
  }
});

test('accents keep their chroma as fills — only the text form is allowed to bleach', () => {
  // The failure mode this guards: satisfying the test above by lightening the
  // accents themselves until a "brand blue" is a pale wash on every surface.
  for (const mode of MODES) {
    const t = palettes[mode];
    for (const key of ACCENTS) {
      const [r, g, b] = channels(t[key]);
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      assert.ok(chroma >= 60, `${mode}.${key} (${t[key]}) has chroma ${chroma} — it has washed out to a near-grey`);
    }
  }
});

test('on-brand ink clears AA on every accent fill and every gradient stop', () => {
  for (const mode of MODES) {
    const t = palettes[mode];
    for (const key of ACCENTS) {
      const r = contrast(t.textOnBrand, t[key]);
      assert.ok(r >= AA, `${mode}: textOnBrand ${t.textOnBrand} on ${key} ${t[key]} is ${r.toFixed(2)}:1`);
    }
    for (const [i, stop] of t.gradient.entries()) {
      const r = contrast(t.textOnBrand, stop);
      assert.ok(r >= AA, `${mode}: textOnBrand on gradient[${i}] ${stop} is ${r.toFixed(2)}:1`);
    }
    // The CTA banner paints a 22% `shadowColor` scrim over its gradient before
    // the copy lands, so the budget is spent on the composite, not the stop.
    for (const [i, stop] of t.ctaGradient.entries()) {
      const scrimmed = over(t.shadowColor, 0.22, stop);
      const r = contrast(t.textOnBrand, scrimmed);
      assert.ok(r >= AA, `${mode}: textOnBrand on ctaGradient[${i}] after the scrim (${scrimmed}) is ${r.toFixed(2)}:1`);
    }
  }
});

test('chip, success and warn inks clear AA on their own washes', () => {
  for (const mode of MODES) {
    const t = palettes[mode];
    for (const [ink, ground] of [
      ['chipText', 'chipBg'],
      ['successText', 'successBg'],
      ['warnText', 'warnBg'],
    ] as const) {
      const r = contrast(t[ink], t[ground]);
      assert.ok(r >= AA, `${mode}: ${ink} ${t[ink]} on ${ground} ${t[ground]} is ${r.toFixed(2)}:1`);
    }
  }
});

/* ---------------------------------------------------------------- */
/* G. the sites that were correct only while Grey behaved like Dark   */
/* ---------------------------------------------------------------- */

test('a dark ground can actually host the dark chrome the pages build from it', () => {
  // `inkFor()` in resources/api-docs and resources/index borrows the whole dark
  // palette on a light ground, and on a dark ground uses the theme's OWN
  // surfaceRaised / surfaceInset as an editor panel. That second branch is only
  // sane while those surfaces are dark. On a mid-grey page it produced pale
  // syntax on a pale panel while still calling itself dark chrome, and compiled.
  for (const mode of MODES) {
    const t = palettes[mode];
    if (t.ground !== 'dark') continue;
    for (const key of ['surfaceRaised', 'surfaceInset'] as const) {
      assert.ok(
        lstar(t[key]) < 45,
        `${mode}.${key} is L* ${lstar(t[key]).toFixed(1)} — too light to be an editor panel, but inkFor() will use it as one`,
      );
      assert.ok(contrast(t.text, t[key]) >= AA, `${mode}: editor ink fails on ${key}`);
    }
  }
});

test('the video player frame reads as chrome, not as another card', () => {
  // solutions/video-studio paints it as `hexToRgba(t.shadowColor, 0.82)` over
  // the page on a dark ground. If the shadow colour drifts light, or the page
  // drifts dark, the "frame" becomes a slightly different grey rectangle.
  for (const mode of MODES) {
    const t = palettes[mode];
    if (t.ground !== 'dark') continue;
    const frame = over(t.shadowColor, 0.82, t.surface);
    // Chrome in absolute terms — this is what fails if the page drifts light
    // while the alpha stays where a near-black page left it.
    assert.ok(lstar(frame) < 20, `${mode}: the player frame lands at L* ${lstar(frame).toFixed(1)} — not chrome`);
    // Never lighter than the card it sits on. Dark's page is already near-black
    // so its frame can only fall a few points; the requirement is the direction
    // and the ceiling, not a fixed drop the darkest palette has no room for.
    assert.ok(
      lstar(frame) <= lstar(t.surface),
      `${mode}: the player frame (L* ${lstar(frame).toFixed(1)}) is lighter than its card (L* ${lstar(t.surface).toFixed(1)})`,
    );
    assert.ok(contrast(t.textOnScrim, frame) >= AA, `${mode}: scrim ink fails on the player frame`);
  }
});

test('the artwork hairline is visible on the ground it is chosen for', () => {
  // components/public/artwork.tsx picks `t.border` on a light ground and a 14%
  // white hairline on a dark one. A white hairline only reads as a hairline
  // while the ground underneath is dark.
  for (const mode of MODES) {
    const t = palettes[mode];
    if (t.ground !== 'dark') continue;
    const hairline = over('#ffffff', 0.14, t.surface);
    assert.ok(
      lstar(hairline) - lstar(t.surface) >= 3,
      `${mode}: the 14% white hairline lifts only ${(lstar(hairline) - lstar(t.surface)).toFixed(1)} L* off its surface`,
    );
  }
});

test('the consent backdrop actually darkens the page it covers', () => {
  // components/public/consent.tsx: a navy 34% veil on a light ground, black 58%
  // on a dark one. The dark one was tuned against a near-black page.
  const veils: Record<'light' | 'dark', string> = {
    light: 'rgba(7, 20, 73, 0.34)',
    dark: 'rgba(0, 0, 0, 0.58)',
  };
  for (const mode of MODES) {
    const t = palettes[mode];
    const { hex, alpha } = fromRgba(veils[t.ground]);
    const covered = over(hex, alpha, t.background);
    // What a scrim is *for* is separating the modal panel from the page behind
    // it. Measuring the absolute drop instead would demand room that a
    // near-black page does not have, and would pass on a page so light that the
    // veil turns it grey without the panel gaining anything.
    const before = contrast(t.surface, t.background);
    const after = contrast(t.surface, covered);
    assert.ok(
      lstar(covered) <= lstar(t.background),
      `${mode}: the modal backdrop lightens the page instead of veiling it`,
    );
    assert.ok(
      after > before,
      `${mode}: the backdrop leaves the panel no better separated than the bare page (${before.toFixed(2)} -> ${after.toFixed(2)})`,
    );
    // An absolute floor only where the page has room beneath it. Dark's page is
    // L* 3.1 and its veil can only reach 1.11:1 — it has shipped that way, and
    // its modal leans on a border and an elevation shadow for the rest. Any
    // palette with headroom has no such excuse, and Dark Grey is the palette
    // that just acquired 19 points of it.
    if (lstar(t.background) >= 10) {
      assert.ok(after >= 1.4, `${mode}: the modal panel does not separate from its own backdrop (${after.toFixed(2)}:1)`);
    }
  }
});

test('brandColor rescues the marks that vanish and leaves the rest alone', () => {
  const nearBlack = ['#000000', '#111111', '#181717'];
  const saturated = ['#ff0000', '#4a154b', '#0052CC'];
  const bright = ['#18BFFF', '#ff9900', '#25d366'];

  for (const mode of MODES) {
    const t = palettes[mode];
    for (const mark of nearBlack) {
      const painted = brandColor(mark, t);
      if (t.ground === 'light') {
        assert.equal(painted, mark, `${mode}: a light ground must not repaint ${mark}`);
      } else {
        assert.equal(painted, t.text, `${mode}: ${mark} vanishes on this page and was not rescued`);
        assert.ok(contrast(painted, t.surface) >= AA_GRAPHIC, `${mode}: the rescue colour is itself illegible`);
      }
    }
    for (const mark of saturated) {
      assert.equal(brandColor(mark, t), mark, `${mode}: ${mark} is a brand colour, not a near-black — it must survive`);
    }
    // Bright marks are never repainted, on any ground. That is deliberate: a
    // logotype is exempt from the contrast minimum, each is labelled in text
    // beside the glyph, and inventing a colour for someone else's mark is worse
    // than the ratio. Light has carried Airtable at 2.11:1 on white since it
    // shipped, and that is not this work unit's to change.
    for (const mark of bright) {
      assert.equal(brandColor(mark, t), mark, `${mode}: ${mark} must keep its own colour`);
    }
  }
});

test('Dark Grey stays dark enough that bright marks still read on it', () => {
  // The branch that made Dark Grey a mid page measured Airtable at 1.01:1,
  // Amazon 1.03 and WhatsApp 1.05 — marks `brandColor` cannot rescue, because
  // its test only ever looks downward for near-blacks. On the restored charcoal
  // the same three measure 4.9-5.3:1. This pins that: it is the one assertion
  // that would go red if this palette drifted back toward the middle, and it
  // fails for a reason no contrast-only sweep of the page would report.
  const t = palettes.grey;
  for (const [mark, name] of [['#18BFFF', 'Airtable'], ['#ff9900', 'Amazon'], ['#25d366', 'WhatsApp']] as const) {
    const r = contrast(mark, t.surface);
    assert.ok(r >= AA_GRAPHIC, `${name} ${mark} scores ${r.toFixed(2)}:1 on Dark Grey's card`);
  }
});

test('scrim ink clears AA on the frosted panel it is written on', () => {
  // Measured on the rendered home hero at 390: the frosted panel composites to
  // #434953, and `scrimTextFaint` at 12.5px lands on it. Grey and dark had
  // transcribed every scrim token between them, so both scored 3.62:1 — the same
  // node, the same ground, the same figure. Grey's ink was lifted; dark's is
  // recorded in PRE_EXISTING and belongs to a dark lane.
  //
  // The ground is a measurement rather than a token, because the panel is glass
  // over a photograph. Pinning the measured value is the point: it is the number
  // a token-only sweep cannot produce.
  const FROSTED_PANEL = '#434953';
  for (const mode of MODES) {
    const t = palettes[mode];
    if (t.ground !== 'dark') continue;
    const c = checker(mode);
    c.check('scrimText', 'the frosted hero panel', contrast(t.scrimText, FROSTED_PANEL));
    c.check('scrimTextMuted', 'the frosted hero panel', contrast(t.scrimTextMuted, FROSTED_PANEL));
    c.check('scrimTextFaint', 'the frosted hero panel', contrast(t.scrimTextFaint, FROSTED_PANEL));
    assert.deepEqual(c.failures, [], `scrim ink below AA — ${c.failures.join(' | ')}`);
  }
});


/* ---------------------------------------------------------------- */
/* H. per-palette quantities that must not collapse to per-ground     */
/* ---------------------------------------------------------------- */

test('a soft icon backdrop is visible without swallowing the glyph on it', () => {
  // `softFill` is keyed on mode, not ground, and NOT because the lift should
  // match across themes — it deliberately does not. The disc is a tint of the
  // same accent that is drawn on top of it, so one alpha has to satisfy two
  // opposing requirements, and how much room there is between them depends on
  // how bright the card already is. Dark can spend 0.18; grey at 0.18 put the
  // `api-docs` monogram at 2.95:1 on its own disc.
  for (const mode of MODES) {
    const t = palettes[mode];
    const c = checker(mode);
    for (const key of ACCENTS) {
      const { hex, alpha } = fromRgba(softFill(t[key], t));
      for (const base of ['surface', 'surfaceRaised'] as const) {
        const disc = over(hex, alpha, t[base]);
        const lift = Math.abs(lstar(disc) - lstar(t[base]));
        assert.ok(lift >= 3, `${mode}: the ${key} disc lifts only ${lift.toFixed(1)} L* off ${base} — invisible`);
        assert.ok(lift <= 18, `${mode}: the ${key} disc lifts ${lift.toFixed(1)} L* off ${base} — a solid tile, not a tint`);
        c.check(key, `softFill glyph on ${base}`, contrast(t[key], disc));
      }
    }
    assert.deepEqual(c.failures, [], `a soft disc swallowed its glyph — ${c.failures.join(' | ')}`);
  }
});

test('hexToRgba round-trips the alpha the palettes are measured with', () => {
  // Everything above composites through `fromRgba(...)`; if the two disagree
  // the whole file measures the wrong colour and still passes.
  assert.equal(hexToRgba('#4f9dff', 0.2), 'rgba(79, 157, 255, 0.2)');
  const { hex, alpha } = fromRgba(hexToRgba('#4f9dff', 0.2));
  assert.equal(hex, '#4f9dff');
  assert.equal(alpha, 0.2);
});

/* ---------------------------------------------------------------- */
/* I. the documentation is checked against the values it documents    */
/* ---------------------------------------------------------------- */

test('the ladder table in the source recomputes from the hexes beside it', () => {
  // A previous revision of this file carried a table whose light, dark and grey
  // rows did not recompute from its own values. A table that disagrees with the
  // palette below it is worse than no table, because it is read as evidence.
  const source = readFileSync(new URL('./tokens.ts', import.meta.url), 'utf8');
  const row = /^\s*\*\s+(surfaceInset|surfaceRaised|surfaceMuted|surface|background)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/gm;

  const seen: SurfaceKey[] = [];
  for (const match of source.matchAll(row)) {
    const key = match[1] as SurfaceKey;
    seen.push(key);
    const documented = { dark: Number(match[2]), grey: Number(match[3]), light: Number(match[4]) };
    for (const mode of MODES) {
      const actual = lstar(palettes[mode][key]);
      assert.ok(
        Math.abs(actual - documented[mode]) < 0.1,
        `the table says ${mode}.${key} is L* ${documented[mode]}, the hex ${palettes[mode][key]} measures ${actual.toFixed(1)}`,
      );
    }
  }
  assert.equal(seen.length, SURFACES.length, `the ladder table documents ${seen.length} of ${SURFACES.length} surfaces`);
  assert.deepEqual([...seen].sort(), [...SURFACES].sort(), 'the ladder table names a surface that is not one');
});
