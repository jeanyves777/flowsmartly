/**
 * Generate starter design templates using gpt-image-1
 *
 * Usage: npx tsx scripts/generate-starter-templates.ts
 *
 * Generates 3 templates per category (18 total) as starting points.
 * Each template is a generic, professional design with placeholder content.
 * You can also manually add templates downloaded from Canva.com.
 */

import OpenAI from "openai";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TemplateEntry {
  id: string;
  name: string;
  category: string;
  preset: string;
  thumbnail: string;
  image: string;
  tags: string[];
}

interface TemplateManifest {
  templates: TemplateEntry[];
}

const TEMPLATE_DEFINITIONS = [
  // Social Media Posts
  {
    category: "social_post",
    preset: "Instagram Square",
    size: "1024x1024" as const,
    templates: [
      {
        name: "Summer Sale Promo",
        prompt: "Professional Instagram square post design for a summer sale promotion. Bold '50% OFF' text, vibrant orange-pink gradient background, palm leaf decorative elements, clean modern typography, prominent CTA button saying 'Shop Now'. Include floating sale badge. No brand logos.",
        tags: ["sale", "summer", "promo"],
      },
      {
        name: "New Product Launch",
        prompt: "Clean Instagram square post design for a new product launch announcement. Minimalist layout with 'NEW ARRIVAL' headline, soft neutral background with geometric accents, placeholder product area on right side, modern sans-serif typography, subtle grid pattern. No brand logos.",
        tags: ["launch", "product", "modern"],
      },
      {
        name: "Motivational Quote",
        prompt: "Elegant Instagram square post with motivational quote layout. Large quotation marks, centered inspirational text area, dark background with gold accent lines, sophisticated serif-sans mix typography, subtle bokeh light effects in corners. No brand logos.",
        tags: ["quote", "motivation", "elegant"],
      },
    ],
  },
  // Advertisements
  {
    category: "ad",
    preset: "Facebook Ad",
    size: "1536x1024" as const,
    templates: [
      {
        name: "Business Service Ad",
        prompt: "Professional Facebook ad design for a business service. Split layout: left side has headline 'Grow Your Business', subtitle, and CTA button; right side has a professional person in business attire. Blue-white color scheme, clean corporate look, testimonial badge. No brand logos.",
        tags: ["business", "service", "corporate"],
      },
      {
        name: "E-commerce Product Ad",
        prompt: "Eye-catching Facebook ad for e-commerce product promotion. Left: bold discount percentage '30% OFF', product features list, orange CTA button. Right: product photography placeholder with white background. Modern flat design with accent colors. No brand logos.",
        tags: ["ecommerce", "product", "discount"],
      },
      {
        name: "App Download Ad",
        prompt: "Modern Facebook ad promoting a mobile app download. Phone mockup on right showing app interface, left side: catchy headline, star rating display, 'Download Free' button. Purple-blue gradient background, clean tech aesthetic. No brand logos.",
        tags: ["app", "tech", "download"],
      },
    ],
  },
  // Flyers
  {
    category: "flyer",
    preset: "A5 Portrait",
    size: "1024x1536" as const,
    templates: [
      {
        name: "Event Announcement",
        prompt: "Professional A5 flyer design for an event announcement. Large event title at top, date/time/venue details in the middle, speaker/performer photo area, bottom section with registration info and QR code placeholder. Dark theme with accent color highlights. No brand logos.",
        tags: ["event", "announcement", "dark"],
      },
      {
        name: "Restaurant Menu",
        prompt: "Elegant restaurant menu flyer design. Decorative header with restaurant name placeholder, food categories with pricing areas, food photography spots, elegant serif typography, warm earth-tone color scheme with gold accents, ornamental dividers. No brand logos.",
        tags: ["restaurant", "menu", "food"],
      },
      {
        name: "Fitness Class",
        prompt: "Dynamic fitness class promotional flyer. Energetic diagonal layout, person exercising in background, bold 'JOIN NOW' headline, class schedule grid, pricing section, neon green accents on dark background, athletic modern typography. No brand logos.",
        tags: ["fitness", "gym", "health"],
      },
    ],
  },
  // Posters
  {
    category: "poster",
    preset: "Event Poster",
    size: "1024x1536" as const,
    templates: [
      {
        name: "Music Concert",
        prompt: "Dramatic music concert poster design. Large artist name area at top, concert venue and date at bottom, atmospheric dark background with neon light streaks, electric blue and magenta color scheme, bold display typography, ticket info section. No brand logos.",
        tags: ["music", "concert", "entertainment"],
      },
      {
        name: "Tech Conference",
        prompt: "Modern tech conference poster. Futuristic geometric design, large conference title, speaker lineup area with photo circles, date/venue information, registration URL, dark navy with cyan/teal accents, clean sans-serif typography, subtle circuit pattern. No brand logos.",
        tags: ["tech", "conference", "modern"],
      },
      {
        name: "Art Exhibition",
        prompt: "Sophisticated art exhibition poster. Minimalist white space design, large artwork showcase area in center, gallery name and dates in refined typography, thin black border frame, subtle gradient background, editorial layout feel. No brand logos.",
        tags: ["art", "exhibition", "gallery"],
      },
    ],
  },
  // Banners
  {
    category: "banner",
    preset: "Facebook Cover",
    size: "1536x1024" as const,
    templates: [
      {
        name: "Company Profile",
        prompt: "Professional company profile Facebook cover banner. Cityscape background with blue overlay, company tagline area on left, team silhouettes, modern corporate look, gradient from dark blue to light blue, clean white text areas. No brand logos.",
        tags: ["corporate", "company", "professional"],
      },
      {
        name: "Sale Event Banner",
        prompt: "Bold sale event Facebook cover banner. Large 'MEGA SALE' text centered, countdown timer area, scattered shopping elements (bags, tags), vibrant red and yellow color scheme, confetti decorations, urgency-driven design. No brand logos.",
        tags: ["sale", "event", "retail"],
      },
      {
        name: "Creative Portfolio",
        prompt: "Creative portfolio Facebook cover banner. Split into 4-5 angled photo placeholder areas showing different work samples, colorful overlay gradients, creative professional tagline, modern playful typography, dark charcoal background. No brand logos.",
        tags: ["portfolio", "creative", "showcase"],
      },
    ],
  },
  // Signboards
  {
    category: "signboard",
    preset: "Horizontal Sign",
    size: "1536x1024" as const,
    templates: [
      {
        name: "Store Front Sign",
        prompt: "Clean storefront signboard design. Large business name placeholder in center, tagline below, contact info at bottom, solid dark background with elegant gold or white text, decorative border, simple and readable from distance. No brand logos.",
        tags: ["store", "retail", "sign"],
      },
      {
        name: "Real Estate Sign",
        prompt: "Professional real estate signboard. 'FOR SALE' or 'NOW OPEN' banner at top, property photo area, agent name and contact section, clean blue-white color scheme, bold readable typography, QR code placeholder. No brand logos.",
        tags: ["realestate", "property", "sign"],
      },
      {
        name: "Restaurant Sign",
        prompt: "Warm restaurant signboard design. Restaurant name in elegant script font, 'OPEN' indicator, cuisine type subtitle, operating hours, warm lighting effects, wood or brick texture background, cozy inviting feel. No brand logos.",
        tags: ["restaurant", "food", "warm"],
      },
    ],
  },
];

async function generateTemplate(
  prompt: string,
  size: "1024x1024" | "1536x1024" | "1024x1536",
  outputPath: string
): Promise<boolean> {
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality: "high",
    });

    const imageData = response.data?.[0];
    let base64: string | undefined;

    if (imageData?.b64_json) {
      base64 = imageData.b64_json;
    } else if (imageData?.url) {
      const res = await fetch(imageData.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      base64 = buffer.toString("base64");
    }

    if (!base64) {
      console.error(`  Failed: no image data returned`);
      return false;
    }

    const buffer = Buffer.from(base64, "base64");
    await writeFile(outputPath, buffer);
    console.log(`  Saved: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (error) {
    console.error(`  Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log("=== FlowSmartly Design Template Generator ===\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    console.error("Set it in your .env file or export it directly.");
    process.exit(1);
  }

  const publicDir = path.join(process.cwd(), "public", "templates");

  // Load existing manifest
  const manifestPath = path.join(publicDir, "manifest.json");
  let manifest: TemplateManifest = { templates: [] };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
  }

  const existingIds = new Set(manifest.templates.map((t) => t.id));
  let generated = 0;
  let skipped = 0;

  for (const categoryDef of TEMPLATE_DEFINITIONS) {
    const categoryDir = path.join(publicDir, categoryDef.category);
    if (!existsSync(categoryDir)) {
      await mkdir(categoryDir, { recursive: true });
    }

    console.log(`\nCategory: ${categoryDef.category}`);

    for (let i = 0; i < categoryDef.templates.length; i++) {
      const tmpl = categoryDef.templates[i];
      const slug = tmpl.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const id = `${categoryDef.category}-${slug}`;
      const filename = `${slug}.png`;
      const filePath = path.join(categoryDir, filename);
      const publicUrl = `/templates/${categoryDef.category}/${filename}`;

      if (existingIds.has(id)) {
        console.log(`  Skipping "${tmpl.name}" (already in manifest)`);
        skipped++;
        continue;
      }

      console.log(`  Generating "${tmpl.name}"...`);
      const success = await generateTemplate(tmpl.prompt, categoryDef.size, filePath);

      if (success) {
        manifest.templates.push({
          id,
          name: tmpl.name,
          category: categoryDef.category,
          preset: categoryDef.preset,
          thumbnail: publicUrl,
          image: publicUrl,
          tags: tmpl.tags,
        });
        generated++;
      }

      // Brief pause between API calls
      if (i < categoryDef.templates.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Save updated manifest
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}, Total in manifest: ${manifest.templates.length}`);
}

main().catch(console.error);
