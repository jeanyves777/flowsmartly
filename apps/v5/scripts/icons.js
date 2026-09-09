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
/** the brand blue the icon is built on — also the PWA/browser chrome colour */
const BRAND = '#1f6fe5';

/*
 * The app icon still wants a solid ground behind the mark — a transparent glyph
 * disappears against wallpaper. It does not want a *different* mark.
 *
 * ⚠️ This was `assets/images/icon.png`, the blue rounded-square chevron, which
 * contradicted the paragraph above `SOURCE`: the tab showed the F swoosh while
 * every installed-app surface showed a mark from a different identity. It was
 * reported from a home screen, where the tile is the only thing a person sees.
 *
 * The plate is now BUILT from `SOURCE`, so there is one mark and no second file
 * that can drift away from it. `assets/images/icon.png` is no longer read here.
 */
async function platedMark(size, inset) {
  const inner = Math.round(size * inset);
  const mark = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

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

  for (const { name, size } of SIZES) {
    // The tab and the Organization logo take the mark on transparency; the
    // installed-app icons take the plated one, because a home screen shows it
    // against wallpaper and a transparent glyph disappears there.
    const plated = name.startsWith('icon-') || name === 'apple-touch-icon.png';
    if (plated) {
      // 0.68 leaves the mark room to breathe inside iOS's own corner mask.
      fs.writeFileSync(path.join(DIST, name), await platedMark(size, 0.68));
      continue;
    }
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(DIST, name));
  }

  /*
   * Maskable is a different image, not a different size: Android crops it to
   * whatever shape the launcher uses, so the mark has to sit inside the safe
   * zone or the crop eats it.
   *
   * 0.56 rather than 0.8, because the mark is now inset onto the plate rather
   * than being a full-bleed image that was already its own background — the
   * mark itself has to clear the crop, not merely the artwork it sat on. And
   * the blur-ground trick is gone with the second source: a flat brand plate
   * cannot seam against itself.
   */
  fs.writeFileSync(path.join(DIST, 'icon-maskable-512.png'), await platedMark(512, 0.56));

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
