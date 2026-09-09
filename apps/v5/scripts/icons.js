/* Post-export step: the icon set a browser, a phone and a crawler each ask for.
 *
 *   node scripts/icons.js
 *
 * The export shipped exactly one icon — a 48px `favicon.ico`. That is enough
 * for a browser tab and nothing else: an installed PWA had no icon, iOS had no
 * home-screen icon, Android had no maskable icon, and the `Organization` logo
 * in the JSON-LD pointed at `/icon.png`, which did not exist, so the one image
 * a search engine reads for the brand was a 404.
 *
 * Every file here is a **resize of the icon the user already made**
 * (`assets/images/icon.png`, 1024²). Nothing is drawn or invented — this
 * script only produces the sizes each platform requires from that one source.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
/*
 * The F swoosh, which is what the live site shows in a tab — not the blue
 * rounded-square app icon. They are two different marks and the tab is the one
 * people recognise the site by, so every icon here derives from the same one.
 */
const SOURCE = path.join(ROOT, 'assets', 'images', 'favicon-mark.png');
/*
 * 🛑 **Nothing is added to the mark.** Owner's instruction, 2026-09-09, after the
 * tile was reported as a different brand. No plate, no ground, no fill — every
 * icon here is `favicon-mark.png` resized on transparency, and the mark's own
 * blue/violet/amber is the only colour any of them carries.
 *
 * What was here: `PLATED = assets/images/icon.png`, a blue rounded-square chevron
 * — a *second mark* — which every `icon-*` and `apple-touch-icon` size was cut
 * from, while only the favicons used the swoosh. And a `BRAND = '#1f6fe5'` ground
 * behind it, a colour that appeared **exactly once in this repository**, on the
 * line that declared it: no token file, no stylesheet, nothing else.
 *
 * `BRAND` survives for the one job it should never have shared — the PWA and
 * browser chrome colour, which is a bar around the page and not something drawn
 * on the icon. It is now `brand.primary` from `packages/design-tokens`.
 */
/** brand.primary — the PWA/browser chrome colour. Never drawn on the mark. */
const BRAND = '#0A63D6';

const SIZES = [
  // `icon.png` is what the Organization JSON-LD points at, so it has to exist
  { name: 'icon.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  // iOS renders this at 180 and applies its own mask and corner radius
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
];

async function build() {
  if (!fs.existsSync(SOURCE)) {
    console.error('icons: a source mark is missing — nothing to resize');
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(DIST)) {
    console.error('icons: dist/ is missing — run the export first');
    process.exitCode = 1;
    return;
  }

  // Every size, one rule: the mark, resized, on transparency. No branch, because
  // a branch here is what let the app icons wander off to a different image.
  for (const { name, size } of SIZES) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(DIST, name));
  }

  /*
   * Maskable is the one size that is a different image, not a different scale:
   * Android crops it to whatever shape the launcher uses, so the mark has to sit
   * inside the safe zone or the crop eats its edges. 0.56 of the canvas clears
   * the tightest launcher shape.
   *
   * Still nothing added — the surrounding area is transparent, not filled. The
   * launcher supplies its own ground there, which is the platform's decision to
   * make and not this script's.
   */
  const inner = Math.round(512 * 0.56);
  const mark = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(path.join(DIST, 'icon-maskable-512.png'));

  const manifest = {
    name: 'FlowSmartly',
    short_name: 'FlowSmartly',
    description: 'The AI Business Operating System — one platform to run, connect and grow a business.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: BRAND,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(DIST, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`icons: ${SIZES.length + 1} images + site.webmanifest`);
}

build().catch((error) => {
  console.error('icons:', error.message);
  process.exitCode = 1;
});
