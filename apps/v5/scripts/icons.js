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
/** the app icon still wants a solid ground behind the mark */
const PLATED = path.join(ROOT, 'assets', 'images', 'icon.png');

/** the brand blue the icon is built on — also the PWA/browser chrome colour */
const BRAND = '#1f6fe5';

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
  if (!fs.existsSync(SOURCE) || !fs.existsSync(PLATED)) {
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
    await sharp(plated ? PLATED : SOURCE)
      .resize(size, size, { fit: 'contain', background: plated ? BRAND : { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(DIST, name));
  }

  /*
   * Maskable is a different image, not a different size: Android crops it to
   * whatever shape the launcher uses, so the mark has to sit inside the middle
   * 80% or the crop eats it. The source is full-bleed, so it is inset onto its
   * own brand ground rather than scaled up.
   */
  const inner = Math.round(512 * 0.8);
  // The ground is the icon's own blur, not a flat brand fill: the source is a
  // gradient, so any single colour seams against it along two edges.
  const ground = await sharp(PLATED).resize(512, 512, { fit: 'cover' }).blur(40).png().toBuffer();
  const scaled = await sharp(PLATED).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
  await sharp(ground)
    .composite([{ input: scaled, gravity: 'center' }])
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
