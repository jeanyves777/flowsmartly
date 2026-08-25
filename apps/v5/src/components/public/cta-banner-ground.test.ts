import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { palettes, type V5ThemeMode } from '../../theme/tokens.ts';

/**
 * The growth CTA banner must declare the colour its copy sits on.
 *
 * `expo-linear-gradient` on web renders a `View` carrying a `backgroundImage`
 * and nothing else. The banner therefore painted correctly — verified by eye
 * and by sampled pixels at 390, 768 and 1440 in all three themes, 4.58–4.91:1
 * — while `getComputedStyle(banner).backgroundColor` was `rgba(0, 0, 0, 0)`.
 *
 * That hole is what produced "textOnBrand on a bare page surface, 1.05:1" in
 * all three palettes at once. Anything that resolves an effective background by
 * walking ancestors for a `background-color` — which is how essentially every
 * contrast checker does it — walks past a `background-image` and reports the
 * page underneath the banner. Measured on this export, that walk returns the
 * page ground on every route: 1.08:1 light, 1.45:1 grey, 1.05:1 dark. Three
 * identical failures from one missing declaration, not three bad colours; and a
 * palette fix for any of them would have been a fix for nothing.
 *
 * So the requirement is structural, and it is asserted as such:
 *
 *   1. the banner declares a `backgroundColor` at all;
 *   2. it is `t.ctaGradient[0]` — the stop the gradient already paints at x = 0,
 *      so the declaration costs no pixel — and an expression, not a literal, so
 *      it can never decay into three independently-patched hexes;
 *   3. that ground, under the scrim alpha the component actually uses, clears AA
 *      against `textOnBrand` in every palette.
 *
 * The last test is the counter-example: it runs the same extractor over the
 * banner as it was written *before* this fix and requires it to be rejected. A
 * check that cannot fail on the defect it was written for is not a check.
 */

const MODES: V5ThemeMode[] = ['light', 'grey', 'dark'];
const AA = 4.5;

const FOOTER = new URL('./v5-footer.tsx', import.meta.url);

/* ---------------------------------------------------------------- */
/* colour maths — independent of the implementation under test        */
/* ---------------------------------------------------------------- */

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

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

/** Composite an alpha colour over an opaque one, the way the renderer does. */
function over(fg: string, alpha: number, bg: string): string {
  const f = channels(fg);
  const b = channels(bg);
  return `#${[0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/* ---------------------------------------------------------------- */
/* the extractor under test                                           */
/* ---------------------------------------------------------------- */

/**
 * The body of the `cta:` style block, as written in the component.
 *
 * Line endings are normalised first: the file is stored LF and checked out CRLF
 * on Windows, so a pattern anchored on `\n` alone passes in CI and fails on the
 * machine the fix was written on — or the reverse, which is worse.
 */
function ctaStyleBlock(source: string): string {
  const text = source.replace(/\r\n/g, '\n');
  const match = /\n {4}cta: \{\n([\s\S]*?)\n {4}\},\n/.exec(text);
  assert.ok(match, 'the `cta:` style block is no longer where this test looks for it');
  return match[1];
}

/**
 * The right-hand side of the banner's `backgroundColor`, or `null` when it
 * declares none — which is the defect: a banner whose only ground is an image.
 */
function declaredGround(styleBlock: string): string | null {
  // Comment lines are stripped first, so prose that merely *mentions*
  // `backgroundColor` can never satisfy the check the way a declaration does.
  const code = styleBlock
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n');
  const match = /(?:^|\n)\s*backgroundColor:\s*([^,\n]+),/.exec(code);
  return match ? match[1].trim() : null;
}

/** The alpha of the scrim the banner paints over its gradient. */
function scrimAlpha(source: string): number {
  const text = source.replace(/\r\n/g, '\n');
  const match = /ctaScrim: \{[\s\S]*?backgroundColor: hexToRgba\(t\.shadowColor, ([\d.]+)\)/.exec(text);
  assert.ok(match, 'the CTA scrim no longer composites `shadowColor` at a readable alpha');
  return Number(match[1]);
}

/* ---------------------------------------------------------------- */
/* the assertions                                                     */
/* ---------------------------------------------------------------- */

test('the CTA banner declares a background colour, not only a gradient image', () => {
  const ground = declaredGround(ctaStyleBlock(readFileSync(FOOTER, 'utf8')));
  assert.ok(
    ground !== null,
    'the growth CTA banner declares no `backgroundColor`. Its ground is a `background-image` alone, ' +
      'so the box model records no colour under `textOnBrand` and every ancestor-walking contrast ' +
      'checker reports the page beneath the banner instead — 1.05:1 in all three themes at once.',
  );
});

test('the banner’s ground is the gradient’s own first stop, not a hand-picked colour', () => {
  const ground = declaredGround(ctaStyleBlock(readFileSync(FOOTER, 'utf8')));
  assert.equal(
    ground,
    't.ctaGradient[0]',
    'the banner’s ground must be `t.ctaGradient[0]` — the colour the gradient already paints at x = 0. ' +
      'A literal, or any other value, both changes the render and re-opens the door to three palettes ' +
      'being patched independently for what is one missing declaration.',
  );
});

test('the declared ground clears AA under its own scrim in every palette', () => {
  const source = readFileSync(FOOTER, 'utf8');
  const alpha = scrimAlpha(source);
  for (const mode of MODES) {
    const t = palettes[mode];
    const scrimmed = over(t.shadowColor, alpha, t.ctaGradient[0]);
    const ratio = contrast(t.textOnBrand, scrimmed);
    assert.ok(
      ratio >= AA,
      `${mode}: the banner’s declared ground ${t.ctaGradient[0]} under the ${alpha} scrim is ${scrimmed}, ` +
        `and textOnBrand ${t.textOnBrand} scores ${ratio.toFixed(2)}:1 on it`,
    );
  }
});

test('the check fails on the banner as it was written before this fix', () => {
  // The exact `cta:` block from 0b0136f0 — the accepted Dark Grey candidate, in
  // which the banner painted a correct gradient and declared no ground at all.
  // If this parses as "has a ground", the three tests above prove nothing.
  const before = [
    '',
    '    cta: {',
    '      marginHorizontal: l.gutter,',
    '      marginTop: l.sectionGap,',
    '      borderRadius: l.radius,',
    '      padding: l.sectionPad,',
    "      flexDirection: stacked ? 'column' : 'row',",
    "      alignItems: stacked ? 'stretch' : 'center',",
    '      gap: stacked ? 20 : 30,',
    "      overflow: 'hidden',",
    '    },',
    '',
  ].join('\n');

  assert.equal(
    declaredGround(ctaStyleBlock(before)),
    null,
    'the pre-fix banner must read as having no declared ground, or the check is vacuous',
  );

  // And a banner whose only mention of the property is prose must also fail,
  // so the check cannot be satisfied by a comment about the fix.
  const commentOnly = [
    '',
    '    cta: {',
    '      /* backgroundColor: t.ctaGradient[0], — described but never applied */',
    "      overflow: 'hidden',",
    '    },',
    '',
  ].join('\n');
  assert.equal(
    declaredGround(ctaStyleBlock(commentOnly)),
    null,
    'a commented-out declaration must not count as a declaration',
  );

  // The live component, run through the same extractor, must pass — so the two
  // rejections above are the extractor discriminating, not refusing everything.
  assert.equal(declaredGround(ctaStyleBlock(readFileSync(FOOTER, 'utf8'))), 't.ctaGradient[0]');
});
