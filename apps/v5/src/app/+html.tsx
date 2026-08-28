import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

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
