import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { buildTypeScale } from '../components/public/ui';
import { palettes } from '../theme/tokens';
import { FOCUS_INDICATOR } from '../theme/focus-tokens';
import { BP, resolveLayout } from '../theme/use-responsive';

/**
 * THE HTML SHELL.
 *
 * This file did not exist before, so Expo emitted its default shell and the
 * public site had no typeface of its own: every text node inherited
 * react-native-web's `-apple-system` stack, which resolves to San Francisco on
 * a Mac, Segoe UI on Windows and Roboto on Android. The approved design calls
 * for Plus Jakarta Sans, and a browser audit of the live DOM found it applied
 * to exactly zero nodes.
 *
 * The family is SELF-HOSTED rather than linked from fonts.googleapis.com. The
 * site ships a cookie-consent banner, so quietly making every visitor issue a
 * request to a third-party host before consent is the wrong default. Serving
 * the file ourselves also removes a render-blocking dependency on someone
 * else's CDN. Both subsets together are ~48KB because this is the VARIABLE
 * font: one file covers every weight from 200 to 800, so the five weights the
 * design uses cost one request, not five.
 *
 * Anything added here must survive an export, so after changing this file
 * diff dist/index.html's <head> against the previous build. The SEO tags carry
 * data-rh and come from the app at render time, not from here; dropping them
 * from this shell is not possible, but shadowing them is.
 */
const phoneLayout = resolveLayout(0);
const phoneType = buildTypeScale(phoneLayout, palettes.light);

const FONT_CSS = `
@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
  src: url('/fonts/plus-jakarta-sans-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
    U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
  src: url('/fonts/plus-jakarta-sans-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
    U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/*
  The <html> element is the one place a base family can be set without fighting
  react-native-web: RNW writes font-family onto each Text via its own class, so
  this does not override those - it catches everything RNW does NOT class, which
  is why the audit found 901 nodes computing Times New Roman. Text nodes get the
  family explicitly from the type scale instead.
*/
html { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
/* Kerning and ligatures are worth having on a display face used at 34px. */
html { text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/*
  THE MOBILE NAVIGATION OVERLAY — the three things a react-native style cannot
  say. The ids come from src/components/public/site-header.tsx (NAV_ID); the
  sheet itself is laid out there, and only what needs real CSS lives here.

  1. A dynamic-viewport height WITH a fallback. A react-native style is one
     value per property, so it can carry 100dvh or 100vh, never both, and the
     older browser that drops dvh would be left with no height at all. Two
     declarations is the only way to express "dvh, else vh".
  2. env(safe-area-inset-bottom) under the pinned actions, which has to sit
     inside a calc() next to the design padding.
  3. overscroll-behavior, so flinging the expanded menu to its end never
     chains into the page behind it.

  Ids, not classes, and deliberately: react-native-web appends its own
  stylesheet AFTER this one (confirmed in the export: <style id="expo-reset">
  then <style id="react-native-stylesheet">), so a single-class selector here
  would lose every tie. An id outranks any atomic class whatever the order.
*/
#fs-nav-root { height: 100vh; height: 100dvh; }
#fs-nav-scroll { overscroll-behavior: contain; }
#fs-nav-top { padding-top: calc(6px + env(safe-area-inset-top, 0px)); }
#fs-nav-actions { padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)); }
#fs-skip-link { text-decoration: none; }
#fs-skip-link:focus { opacity: 1; transform: none; }

/* Select the header that fits even before the static page hydrates. */
#fs-header-row { padding-inline: ${resolveLayout(0).gutter}px; }
#fs-header-navigation, #fs-header-desktop { display: none; }
@media (min-width: ${BP.phone}px) {
  #fs-header-row { padding-inline: ${resolveLayout(BP.phone).gutter}px; }
}
@media (min-width: ${BP.tablet}px) {
  #fs-header-row { padding-inline: ${resolveLayout(BP.tablet).gutter}px; }
  #fs-header-compact { display: none; }
  #fs-header-navigation, #fs-header-desktop { display: flex; }
}
@media (min-width: ${BP.desktop}px) {
  #fs-header-row { padding-inline: ${resolveLayout(BP.desktop).gutter}px; }
}

/* Size the homepage photograph and copy together before hydration. */
#fs-home-hero {
  --hero-gutter: ${resolveLayout(0).gutter}px;
  --hero-bleed: max(0px, calc((100vw - ${BP.maxContent}px) / 2));
  --hero-inset: calc(var(--hero-gutter) + var(--hero-bleed));
  --hero-copy-gap: 14px;
  --hero-display: clamp(28px, 7.9vw, 34px);
  --hero-title-width: 76%;
  --hero-body-size: 17px;
  --hero-body-width: 74%;
  --hero-hub: 88px;
  --hero-system-gap: 14px;
  margin-inline: calc(-1 * var(--hero-bleed));
  padding-inline: var(--hero-inset);
  padding-top: 34px;
}
#fs-home-hero-layout { flex-direction: column; align-items: stretch; gap: 28px; }
#fs-home-hero-copy { flex: none; width: 100%; gap: var(--hero-copy-gap); }
#fs-home-hero h1 {
  font-size: var(--hero-display);
  line-height: 1.14;
  letter-spacing: -0.025em;
  max-width: var(--hero-title-width);
}
#fs-home-hero-detail, #fs-home-hero-wide-actions { display: none; }
#fs-home-hero-detail { gap: var(--hero-copy-gap); }
#fs-home-hero-brief, #fs-home-hero-detail > * {
  font-size: var(--hero-body-size);
  line-height: 1.62;
  max-width: var(--hero-body-width);
}
#fs-home-hero-diagram { flex: none; width: 100%; min-height: 300px; margin: 8px 0 0; align-self: stretch; }
#fs-home-hero-system-row > :not(#fs-home-hero-hub) { gap: var(--hero-system-gap); }
#fs-home-hero-hub { width: var(--hero-hub); height: var(--hero-hub); border-radius: 50%; }
#fs-home-hero-trust { padding-inline: var(--hero-inset); margin-inline: calc(-1 * var(--hero-inset)); }
@media (max-width: ${BP.phone - 1}px) {
  #fs-home-hero-badge { gap: 7px; padding: 5px 10px; }
  #fs-home-hero-badge-text { max-width: 206px; }
  #fs-home-hero-activity { margin-top: 16px; }
  #fs-home-hero-trust { margin-top: 24px; gap: 12px; }
}
@media (min-width: ${BP.phone}px) {
  #fs-home-hero {
    --hero-gutter: ${resolveLayout(BP.phone).gutter}px;
    --hero-display: 41px;
    --hero-title-width: 640px;
    --hero-body-width: 620px;
    --hero-hub: 108px;
    --hero-system-gap: 26px;
    padding-top: 52px;
  }
  #fs-home-hero-brief, #fs-home-hero-phone-actions { display: none; }
  #fs-home-hero-detail, #fs-home-hero-wide-actions { display: flex; }
}
@media (min-width: ${BP.tablet}px) {
  #fs-home-hero {
    --hero-gutter: ${resolveLayout(BP.tablet).gutter}px;
    --hero-display: 47px;
    --hero-body-size: 18px;
  }
}
@media (min-width: ${BP.split}px) {
  #fs-home-hero { --hero-copy-gap: 16px; }
  #fs-home-hero-layout { flex-direction: row; align-items: center; gap: 34px; }
  #fs-home-hero-copy { flex: 0.95 1 0; width: auto; }
  #fs-home-hero-diagram { flex: 1 1 0; width: auto; min-height: 380px; margin: 0 0 4px; align-self: flex-end; }
}
@media (min-width: ${BP.desktop}px) {
  #fs-home-hero { --hero-gutter: ${resolveLayout(BP.desktop).gutter}px; --hero-display: 52px; }
}

/* Match the phone content geometry on Pricing and Product before hydration. */
@media (max-width: ${BP.phone - 1}px) {
  #fs-pricing-intro, [data-testid="fs-product-hero"] {
    padding: ${phoneLayout.sectionSpace}px ${phoneLayout.gutter}px !important;
  }
  :is(#fs-pricing-intro, [data-testid="fs-product-hero"]) h1 {
    font-size: ${phoneType.display.fontSize}px !important;
    line-height: ${phoneType.display.lineHeight}px !important;
    letter-spacing: ${phoneType.display.letterSpacing}px !important;
  }
  :is(#fs-pricing-intro, [data-testid="fs-product-hero"]) h1 + div {
    font-size: ${phoneType.body.fontSize}px !important;
    line-height: ${phoneType.body.lineHeight}px !important;
  }
  #fs-pricing-billing > [role="button"] { padding-inline: 14px !important; }
  #fs-pricing-plans { gap: 12px !important; margin-top: 24px !important; }
  #fs-pricing-plans > div { flex-basis: 100% !important; }
  #fs-pricing-plans > div > div { padding: 18px !important; }
  #fs-product-hero-row { flex-direction: column !important; align-items: stretch !important; gap: 28px !important; }
  #fs-product-hero-row > div { flex: 0 0 auto !important; width: 100% !important; min-width: 0 !important; }
  #fs-product-hero-actions > div { flex-direction: column !important; align-items: stretch !important; }
  #fs-product-hero-actions > div > :is(a, [role="button"]) { width: 100% !important; }
  #fs-product-hero-proof { gap: 10px !important; }
}

/*
  PUBLIC CONTROL FEEDBACK.
  Shared pressable and anchor feedback keeps the site responsive to pointer,
  keyboard and touch input without making decorative mockup chrome interactive.
  Focus remains visible for keyboard users; motion is removed when requested.
*/
:where(#root, body > [role="dialog"]) :where(
  [role="button"],
  a,
  button,
  input[type="button"],
  input[type="submit"],
  input[type="reset"]
):not(:disabled):not([disabled]):not([aria-disabled="true"]) {
  transition:
    transform 160ms cubic-bezier(0.2, 0.75, 0.25, 1),
    outline-offset 120ms ease;
}
@media (hover: hover) and (pointer: fine) {
  :where(#root, body > [role="dialog"]) :where(
    [role="button"],
    a,
    button,
    input[type="button"],
    input[type="submit"],
    input[type="reset"]
  ):not(:disabled):not([disabled]):not([aria-disabled="true"]):hover {
    transform: translateY(-2px);
  }
}
:where(#root, body > [role="dialog"]) :where(
  [role="button"],
  a,
  button,
  input[type="button"],
  input[type="submit"],
  input[type="reset"]
):not(:disabled):not([disabled]):not([aria-disabled="true"]):active {
  transform: translateY(1px) scale(0.985);
}
:where(#root, [role="dialog"]) :where(
  [role="button"],
  a,
  button,
  input[type="button"],
  input[type="submit"],
  input[type="reset"],
  [role="link"],
  [role="tab"],
  [role="checkbox"],
  input:not([type="hidden"]),
  textarea,
  select,
  [tabindex]:not([tabindex="-1"])
):focus-visible {
  /* Two opaque bands preserve a visible boundary on every theme surface. */
  box-shadow: 0 0 0 3px ${FOCUS_INDICATOR.inner};
  outline: 3px solid ${FOCUS_INDICATOR.outer};
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  :where(#root, body > [role="dialog"]) :where(
    [role="button"],
    a,
    button,
    input[type="button"],
    input[type="submit"],
    input[type="reset"]
  ):not(:disabled):not([disabled]):not([aria-disabled="true"]) {
    transition: none !important;
  }
  :where(#root, body > [role="dialog"]) :where(
    [role="button"],
    a,
    button,
    input[type="button"],
    input[type="submit"],
    input[type="reset"]
  ):not(:disabled):not([disabled]):not([aria-disabled="true"]):hover,
  :where(#root, body > [role="dialog"]) :where(
    [role="button"],
    a,
    button,
    input[type="button"],
    input[type="submit"],
    input[type="reset"]
  ):not(:disabled):not([disabled]):not([aria-disabled="true"]):active {
    transform: none !important;
  }
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/*
          Preload only the latin subset. latin-ext is a real dependency for
          accented names but is not on the critical path for an English page,
          so preloading both would delay the one that is.
        */}
        <link
          rel="preload"
          href="/fonts/plus-jakarta-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
        {/* Keeps body scrolling behaving like a native ScrollView. Required. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
