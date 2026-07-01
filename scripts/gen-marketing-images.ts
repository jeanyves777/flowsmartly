/**
 * Dev tool — generate on-brand marketing images with the Gemini image client and
 * save them under public/marketing/generated/. Reuses the app's own
 * geminiImageClient (Nano Banana `gemini-2.5-flash-image` for graphic-design
 * layouts; pass an `imagen-*` model for photoreal).
 *
 * Usage (from repo root):
 *   npx tsx scripts/gen-marketing-images.ts            # generate all jobs
 *   npx tsx scripts/gen-marketing-images.ts asset-ad   # only matching job(s)
 *
 * Requires GEMINI_API_KEY in .env / .env.local (loaded below).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Load .env(.local) into process.env BEFORE importing the client (its singleton
// reads GEMINI_API_KEY at module-eval time).
for (const f of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* file may not exist */ }
}

const OUT_DIR = path.join(ROOT, "public/marketing/generated");
const NANO_BANANA = "gemini-2.5-flash-image"; // graphic-design layouts + text
const IMAGEN = "imagen-4.0-generate-001";     // photorealism
// asset-* / gallery-* are designed outputs & UI (text/layout) → Nano Banana;
// personas/surfaces are photos → Imagen.
const modelFor = (name: string) => (name.startsWith("asset-") || name.startsWith("gallery-") ? NANO_BANANA : IMAGEN);

type Aspect = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
type Job = { name: string; aspect: Aspect; prompt: string; model?: string };

// Cohesive art direction — realistic, premium photography on a soft neutral
// background so the images sit on the site's own surface (no loud colour blocks;
// the UI supplies the accent, not the image).
const REAL = "Professional photorealistic photograph, natural soft lighting, shallow depth of field, clean minimal composition, a soft neutral light background (seamless light warm-grey studio backdrop, no bold or saturated background colour), high-end commercial marketing photography, tack sharp, subject filling most of the frame. No text, no logos, no watermarks.";
const PERSONA = (who: string, _color?: string) => `${who}. ${REAL}`;
const SCENE = (what: string, _color?: string) => `${what}. ${REAL}`;

/** The marketing assets we generate. Extend this list and re-run as needed. */
const JOBS: Job[] = [
  // ── hero / workspace "produced asset" mockups (these DO carry text) ──
  { name: "asset-design", aspect: "3:4", prompt: "A polished modern Instagram post graphic for a bakery's autumn promotion. Warm fall palette. Bold headline 'FALL FAVORITES', a line '20% off all pastries this week', an appetizing photo of autumn pastries and a latte, and a rounded pill button 'Order now'. Clean professional flat graphic design, crisp legible text, fills the frame." },
  { name: "asset-ad", aspect: "3:4", prompt: "A high-converting social ad creative for a bakery's fall promo. Mouth-watering photo of cinnamon rolls and pumpkin muffins, a bold headline 'Cozy up with fall treats', a subline 'Fresh-baked daily', and a bright rounded CTA button 'Shop the sale'. Warm autumn colors, modern ad layout, crisp readable text, fills the frame." },
  { name: "asset-flyer", aspect: "3:4", prompt: "A print-ready flyer for a neighborhood bakery's autumn event. Decorative header 'Autumn at the Bakery', a warm photo of seasonal pastries, three short bullet lines, the date 'Every weekend in October', a small footer. Refined warm palette, tasteful typography, clear margins, fills the frame." },
  { name: "asset-posts", aspect: "1:1", prompt: "A neat 2x2 grid of four bakery social posts for an autumn campaign: pumpkin muffins flat-lay; a bold typographic 'Fall Favorites 20% off' tile; a barista handing over coffee; a close-up cinnamon roll. Cohesive warm palette, four separated tiles with thin gaps, fills the frame." },
  { name: "asset-website", aspect: "3:4", prompt: "A clean modern website homepage for a neighborhood bakery, shown as a browser window. A top nav bar with a small logo and menu, a hero section with a big warm photo of fresh pastries, a headline 'Freshly Baked Every Morning', a subline and a rounded 'Order online' button, then a row of three product cards below. Professional bright web design, warm palette, crisp legible text, realistic UI, fills the frame." },
  { name: "asset-video-poster", aspect: "9:16", prompt: "A cinematic vertical video thumbnail for a bakery fall ad: a mouth-watering close-up of cinnamon rolls and pumpkin muffins with steam and warm morning light, rich and appetizing, film-still look, soft vignette. Fills the frame." },

  // ── use-case personas (realistic people, neutral background) ──
  { name: "persona-creator", aspect: "3:4", prompt: PERSONA("A young female content creator smiling while holding a smartphone, casual stylish outfit") },
  { name: "persona-local", aspect: "3:4", prompt: PERSONA("A cheerful local bakery owner wearing an apron, holding a tablet in her shop") },
  { name: "persona-agency", aspect: "3:4", prompt: PERSONA("A confident professional marketing agency woman in a smart blazer holding a laptop") },
  { name: "persona-ecommerce", aspect: "3:4", prompt: PERSONA("A small online store owner happily packing product boxes for shipping at a work table") },

  // ── surface concept scenes (realistic workspace photography, neutral background) ──
  { name: "surface-create", aspect: "1:1", prompt: SCENE("A creative graphic designer working on a colorful social media post design on a laptop at a bright modern desk") },
  { name: "surface-print", aspect: "1:1", prompt: SCENE("A neat flat-lay of freshly printed marketing materials on a designer's desk — a flyer, business cards and a folded brochure") },
  { name: "surface-publish", aspect: "1:1", prompt: SCENE("A social media manager scheduling posts on a laptop showing a content calendar, phone beside it") },
  { name: "surface-grow", aspect: "1:1", prompt: SCENE("A marketer reviewing a rising sales and ads analytics dashboard on a laptop and smartphone at a desk") },
  { name: "surface-sell", aspect: "1:1", prompt: SCENE("A laptop on a clean desk displaying a modern online store with product photos, next to a shopping bag and a small parcel") },
  { name: "surface-web", aspect: "1:1", prompt: SCENE("A web designer building a website on a large monitor that shows stacked page sections of a landing page") },
  { name: "surface-outreach", aspect: "1:1", prompt: SCENE("A close-up of hands holding a smartphone showing email and text-message notification bubbles, warm modern setting") },
  { name: "surface-leads", aspect: "1:1", prompt: SCENE("A laptop screen showing a city map with local business location pins next to a contact list, on a desk") },
  { name: "surface-business", aspect: "1:1", prompt: SCENE("A tidy desk with a laptop showing a clean analytics dashboard, a brand color swatch card and a cup of coffee") },
];

/** Compress a raw PNG buffer to a web-ready webp under OUT_DIR. */
async function saveWebp(buf: Buffer, name: string): Promise<number> {
  const out = await sharp(buf).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  writeFileSync(path.join(OUT_DIR, `${name}.webp`), out);
  return out.length;
}

// Per-surface sample OUTPUTS shown in each deep-dive's gallery (3 each). Designed
// artefacts / UI mockups so every product page is visually rich and distinct.
const GALLERY_STYLE = "The design/screen FILLS THE ENTIRE FRAME edge to edge with NO empty background borders, margins or padding around it — a full-bleed screenshot that touches all four edges. Clean modern professional graphic/UI design, crisp legible text, realistic, high quality, no watermarks.";
const GALLERY: Record<string, string[]> = {
  create: ["A polished Instagram post design for a coffee shop with a photo and a headline", "A bold typographic 'Weekend Sale' social media graphic", "A clean minimalist brand logo shown on a business card"],
  print: ["A printed event flyer mockup standing on a wooden desk", "A modern business card design, front and back, on a table", "An open tri-fold brochure mockup for a small business"],
  publish: ["A social media content calendar interface on a laptop screen", "A scheduled Instagram post preview card with caption and time", "A grid of social posts across Instagram, Facebook and TikTok"],
  grow: ["A Facebook ad creative for a product sale with a CTA button", "A marketing analytics dashboard UI with charts and metrics", "A vertical story-ad frame with a bold offer"],
  sell: ["A modern online store homepage UI with product cards", "A product detail page UI with an add-to-cart button", "An e-commerce orders dashboard UI with a list of orders"],
  web: ["A modern SaaS landing page UI in a browser window", "A local business website homepage UI with a hero section", "A clean contact / lead-capture form UI"],
  outreach: ["A branded marketing email newsletter design", "A smartphone showing an SMS marketing message from a shop", "A WhatsApp Business chat conversation UI"],
  leads: ["A map interface with local business location pins and a sidebar list", "A CRM lead list UI with contacts and status tags", "A clean sales pitch deck title slide"],
  business: ["A brand-kit board with a color palette, fonts and a logo", "An analytics report dashboard UI with KPI cards", "A credits and billing wallet UI with a balance"],
};
const GALLERY_JOBS: Job[] = Object.entries(GALLERY).flatMap(([key, items]) =>
  items.map((desc, i) => ({ name: `gallery-${key}-${i + 1}`, aspect: "4:3" as Aspect, prompt: `${desc}. ${GALLERY_STYLE}` })),
);
JOBS.push(...GALLERY_JOBS);

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);

  // --compress-existing: convert any leftover *.png in OUT_DIR to webp (no API calls).
  if (args.includes("--compress-existing")) {
    for (const f of readdirSync(OUT_DIR).filter((n) => n.endsWith(".png"))) {
      const size = await saveWebp(readFileSync(path.join(OUT_DIR, f)), f.replace(/\.png$/, ""));
      console.log(`✓ ${f} → webp  ${(size / 1024).toFixed(0)}KB`);
    }
    return;
  }

  const filter = args.filter((a) => !a.startsWith("--"));
  const jobs = filter.length ? JOBS.filter((j) => filter.some((f) => j.name.includes(f))) : JOBS;
  if (!jobs.length) { console.error("No matching jobs for:", filter.join(", ")); process.exit(1); }

  const clientUrl = new URL("../src/lib/ai/gemini-image-client.ts", import.meta.url).href;
  const { geminiImageClient } = await import(clientUrl);
  if (!geminiImageClient.isAvailable()) { console.error("Gemini image client unavailable — set GEMINI_API_KEY"); process.exit(1); }

  for (const j of jobs) {
    const t0 = Date.now();
    try {
      const b64: string | null = await geminiImageClient.generateImage(j.prompt, { aspectRatio: j.aspect, model: j.model ?? modelFor(j.name) });
      if (!b64) { console.log(`— no image: ${j.name}`); continue; }
      const size = await saveWebp(Buffer.from(b64, "base64"), j.name);
      console.log(`✓ ${j.name}  ${(size / 1024).toFixed(0)}KB  ${Date.now() - t0}ms`);
    } catch (e) {
      console.log(`✗ ${j.name}: ${String(e instanceof Error ? e.message : e).slice(0, 180)}`);
    }
  }
  console.log("done →", path.relative(ROOT, OUT_DIR));
}

main();
