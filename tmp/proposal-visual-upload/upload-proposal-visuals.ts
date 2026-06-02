import "dotenv/config";
import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "../../src/lib/db/client";
import { generateImageXaiFirst } from "../../src/lib/ai/image-router";
import { uploadToS3 } from "../../src/lib/utils/s3-client";
import {
  listProposalVisualAssets,
  normalizeKind,
  normalizePreset,
  parseProposalVisualTags,
  PROPOSAL_VISUAL_TAG,
} from "../../src/lib/pitch/proposal-asset-library";

type ProposalVisualKind = "cover" | "about" | "impact" | "general";
type ProposalPreset = "any" | "google-business-profile" | "website-redesign" | "local-seo" | "custom";

interface UploadSpec {
  source: string;
  title: string;
  kind: ProposalVisualKind;
  preset: ProposalPreset;
  tags: string;
  skipReason?: string;
}

interface GenerateSpec {
  title: string;
  kind: ProposalVisualKind;
  preset: ProposalPreset;
  tags: string;
  prompt: string;
}

const inputDir = path.join(process.cwd(), "tmp", "proposal-visual-upload", "input");
const outputDir = path.join(process.cwd(), "tmp", "proposal-visual-upload", "processed");
const dryRun = process.argv.includes("--dry-run");
const candidateMode = process.argv.includes("--candidate");
const uploadCandidateMode = process.argv.includes("--upload-candidate");
const onlyIndex = process.argv.indexOf("--only");
const onlyTitle = onlyIndex >= 0 ? process.argv[onlyIndex + 1]?.toLowerCase() : undefined;

const uploads: UploadSpec[] = [
  {
    source: "social-media-instagram-facebook-marketing-704081694687672lhrblenquc.png",
    title: "Social media marketing illustration",
    kind: "cover",
    preset: "custom",
    tags: "social, social media, instagram, facebook, youtube, content, creator, engagement, marketing",
  },
  {
    source: "20-social-media-icons.png",
    title: "Social media icon cluster",
    kind: "general",
    preset: "custom",
    tags: "social, social media, channels, icons, content, marketing, engagement",
  },
  {
    source: "Use_of_social_media.png",
    title: "Social media overload illustration",
    kind: "about",
    preset: "custom",
    tags: "social, social media, content, engagement, channels, marketing, audience",
  },
  {
    source: "Legal-Hammer-PNG-HD-Image.png",
    title: "Legal gavel cutout",
    kind: "cover",
    preset: "custom",
    tags: "legal, law, lawyer, attorney, local, trust, professional",
  },
  {
    source: "png-clipart-law-firm-personal-injury-lawyer-legal-aid-lawyer-people-metal-thumbnail.png",
    title: "Legal scales and gavel",
    kind: "impact",
    preset: "custom",
    tags: "legal, law, attorney, lawyer, trust, justice, professional",
  },
  {
    source: "231-2315185_court-hammer-free-png-image-definition-of-a-law.png",
    title: "Law gavel on bench",
    kind: "general",
    preset: "custom",
    tags: "legal, law, attorney, lawyer, trust, courtroom, professional",
  },
  {
    source: "White_Christian_Church_PNG_Clipart-2800.png",
    title: "White church building cutout",
    kind: "cover",
    preset: "custom",
    tags: "church, ministry, faith, nonprofit, local, community, congregation",
  },
  {
    source: "149598-cathedral-church-free-photo.png",
    title: "Cathedral church cutout",
    kind: "about",
    preset: "custom",
    tags: "church, ministry, faith, nonprofit, local, community, congregation",
  },
  {
    source: "pngtree-a-3d-restaurant-isolate-on-transparent-background-png-image_18674748.png",
    title: "Watermarked restaurant storefront",
    kind: "cover",
    preset: "custom",
    tags: "restaurant, local, storefront, food",
    skipReason: "visible stock watermark",
  },
  {
    source: "a-small-brown-restaurant-building-is-isolated-on-transparent-background-png.webp",
    title: "Small restaurant storefront cutout",
    kind: "cover",
    preset: "custom",
    tags: "restaurant, local, food, dining, storefront, small business",
  },
  {
    source: "pngtree-accounting-process-illustration-png-image_17062957.png",
    title: "Watermarked accounting analytics",
    kind: "impact",
    preset: "custom",
    tags: "accounting, tax, finance, analytics",
    skipReason: "visible stock watermark",
  },
  {
    source: "pngtree-financial-accounting-illustration-png-image_17062955.png",
    title: "Watermarked accounting desk",
    kind: "impact",
    preset: "custom",
    tags: "accounting, tax, finance, analytics",
    skipReason: "visible stock watermark",
  },
  {
    source: "cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA1L3JtNjU3LTEwNS5wbmc.webp",
    title: "Accounting calculator and money",
    kind: "cover",
    preset: "custom",
    tags: "accounting, tax, finance, calculator, bookkeeping, money, professional",
  },
  {
    source: "pngtree-google-seo-icon-vector-png-image_9183334.png",
    title: "Google SEO circle icon",
    kind: "impact",
    preset: "local-seo",
    tags: "google, seo, search, ranking, local seo, analytics",
  },
  {
    source: "pngtree-google-seo-promotion-icon-vector-png-image_9183333.png",
    title: "Google SEO promotion icon",
    kind: "impact",
    preset: "local-seo",
    tags: "google, seo, search, ranking, local seo, growth",
  },
  {
    source: "272-2721033_aten-global-showroom-presence-our-presence-in-yemen.png",
    title: "Local presence map pins",
    kind: "cover",
    preset: "google-business-profile",
    tags: "local, presence, map, locations, google maps, business profile",
  },
  {
    source: "pngtree-google-logo-vector-png-image_9183289.png",
    title: "Google logo cutout",
    kind: "general",
    preset: "google-business-profile",
    tags: "google, search, business profile, local, maps",
  },
  {
    source: "png-clipart-logo-google-customer-service-review-google-thumbnail.png",
    title: "Google review stars",
    kind: "impact",
    preset: "google-business-profile",
    tags: "google, reviews, rating, stars, reputation, business profile",
  },
  {
    source: "png-clipart-google-maps-google-search-google-map-maker-computer-icons-map-angle-search-engine-optimization-thumbnail.png",
    title: "Google maps pin cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "google maps, map, location, pin, local, business profile, local seo",
  },
  {
    source: "1639414263519.png",
    title: "Google Business Profile explainer",
    kind: "about",
    preset: "google-business-profile",
    tags: "google business profile, reviews, map, local, online presence, search, mobile",
  },
];

const generated: GenerateSpec[] = [
  {
    title: "Premium restaurant local growth cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "restaurant, local, storefront, reviews, map, growth, google business profile, small business",
    prompt:
      "Premium 3D illustration cutout of a friendly local restaurant storefront with a subtle map pin, five-star review card, and rising growth chart elements around it. Clean modern proposal asset, polished SaaS marketing style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium legal local trust cutout",
    kind: "cover",
    preset: "custom",
    tags: "legal, law, attorney, lawyer, local, reviews, trust, professional",
    prompt:
      "Premium 3D illustration cutout for a law firm proposal: courthouse column, gavel, location pin, trust badge shape, and small review-star card arranged as one clean object cluster. Professional, authoritative, warm lighting, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium tax accounting growth cutout",
    kind: "impact",
    preset: "custom",
    tags: "tax, accounting, finance, calculator, growth, analytics, local business, professional",
    prompt:
      "Premium 3D illustration cutout for an accounting and tax service proposal: calculator, ledger, coins, upward analytics chart, and local map pin as one cohesive object cluster. Clean and trustworthy, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium social content growth cutout",
    kind: "impact",
    preset: "custom",
    tags: "social, social media, content, engagement, analytics, campaign, marketing, creator",
    prompt:
      "Premium 3D illustration cutout for a social media proposal: content calendar cards, engagement icons, short-video tile, analytics chart, and scheduling elements in one clean object cluster. Modern bright SaaS style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium dental appointment growth cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "dental, dentist, clinic, appointments, local, reviews, google business profile, healthcare",
    prompt:
      "Premium 3D illustration cutout for a dental practice proposal: friendly dental clinic facade, tooth icon shape, appointment calendar card, five-star review card, and local map pin as one cohesive object cluster. Clean healthcare look, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium beauty salon booking growth cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "salon, beauty, spa, appointments, local, reviews, booking, small business",
    prompt:
      "Premium 3D illustration cutout for a beauty salon or spa proposal: stylish salon storefront, appointment calendar card, beauty tools, review-star card, and local map pin arranged as one polished object cluster. Modern warm style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium auto repair local trust cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "auto repair, mechanic, local, reviews, map, appointments, service business, trust",
    prompt:
      "Premium 3D illustration cutout for an auto repair shop proposal: mechanic garage facade, wrench and tire elements, local map pin, review-star card, and small growth chart as one clean object cluster. Trustworthy local service style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium real estate lead growth cutout",
    kind: "impact",
    preset: "custom",
    tags: "real estate, realtor, property, leads, local, map, reviews, growth",
    prompt:
      "Premium 3D illustration cutout for a real estate proposal: modern house, sold-sign shape without text, local map pin, lead notification card, and upward analytics chart as one cohesive object cluster. Polished professional style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium fitness studio membership cutout",
    kind: "impact",
    preset: "custom",
    tags: "fitness, gym, wellness, local, memberships, bookings, reviews, growth",
    prompt:
      "Premium 3D illustration cutout for a gym or fitness studio proposal: boutique fitness studio facade, dumbbell and membership card shapes, review-star card, local map pin, and rising growth chart in one clean object cluster. Energetic modern style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium home services lead growth cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "home services, plumber, hvac, contractor, local, reviews, map, leads",
    prompt:
      "Premium 3D illustration cutout for a home services contractor proposal: service van, house outline, wrench and pipe elements, local map pin, review-star card, and incoming lead notification as one cohesive object cluster. Clean trustworthy style, no readable text, no logos, no watermark.",
  },
  {
    title: "Premium medical clinic patient growth cutout",
    kind: "cover",
    preset: "google-business-profile",
    tags: "medical, clinic, healthcare, patients, appointments, local, reviews, map",
    prompt:
      "Premium 3D illustration cutout for a medical clinic proposal: clinic building, appointment calendar card, simple health cross shape, local map pin, and review-star card as one polished object cluster. Calm healthcare palette, no readable text, no logos, no watermark.",
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "proposal-visual";
}

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function ensureFlowSmartlyUser() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: "flowsmartly" }, { email: "system@flowsmartly.local" }],
    },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: "system@flowsmartly.local",
      username: "flowsmartly",
      name: "FlowSmartly",
      avatarUrl: "/icon.png",
      plan: "ENTERPRISE",
      aiCredits: 0,
      freeCredits: 0,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
}

async function existingTitles() {
  const files = await prisma.mediaFile.findMany({
    where: { type: "image", tags: { contains: PROPOSAL_VISUAL_TAG } },
    select: { metadata: true, originalName: true },
  });
  return new Set(files.map((file) => String(safeJSON<Record<string, unknown>>(file.metadata, {}).title || file.originalName || "").toLowerCase()));
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

async function toCleanCutout(buffer: Buffer) {
  const image = sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
    .ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixelCount = width * height;
  const seen = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const bgSamples: [number, number, number][] = [];

  const offset = (index: number) => index * channels;
  const rgb = (index: number): [number, number, number] => {
    const i = offset(index);
    return [data[i], data[i + 1], data[i + 2]];
  };
  const alpha = (index: number) => data[offset(index) + 3];
  const luma = ([r, g, b]: [number, number, number]) => r * 0.299 + g * 0.587 + b * 0.114;
  const chroma = ([r, g, b]: [number, number, number]) => Math.max(r, g, b) - Math.min(r, g, b);

  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 80))) {
    for (const y of [0, height - 1]) {
      const index = y * width + x;
      if (alpha(index) > 8) bgSamples.push(rgb(index));
    }
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 80))) {
    for (const x of [0, width - 1]) {
      const index = y * width + x;
      if (alpha(index) > 8) bgSamples.push(rgb(index));
    }
  }
  const bg = bgSamples.length
    ? ([
        bgSamples.reduce((sum, sample) => sum + sample[0], 0) / bgSamples.length,
        bgSamples.reduce((sum, sample) => sum + sample[1], 0) / bgSamples.length,
        bgSamples.reduce((sum, sample) => sum + sample[2], 0) / bgSamples.length,
      ] as [number, number, number])
    : ([255, 255, 255] as [number, number, number]);
  const bgLuma = luma(bg);
  const bgChroma = chroma(bg);

  const isLikelyBackground = (index: number) => {
    if (alpha(index) < 12) return true;
    const color = rgb(index);
    const pxLuma = luma(color);
    const pxChroma = chroma(color);
    const nearSample = distance(color, bg) < (bgChroma < 35 ? 72 : 92);
    const whiteOrGray = pxLuma > 230 && pxChroma < 42;
    const checkerGray = pxLuma > 176 && pxLuma < 245 && pxChroma < 16 && bgLuma > 170;
    const black = pxLuma < 28 && pxChroma < 25 && bgLuma < 55;
    return nearSample || whiteOrGray || checkerGray || black;
  };

  const push = (index: number) => {
    if (index < 0 || index >= pixelCount || seen[index] || !isLikelyBackground(index)) return;
    seen[index] = 1;
    queue[tail++] = index;
  };

  let head = 0;
  let tail = 0;
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (!seen[index]) continue;
    data[offset(index) + 3] = 0;
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const cleaned = await sharp(data, { raw: { width, height, channels } })
    .trim({ background: transparent, threshold: 2 })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: transparent })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(cleaned).metadata();
  return { buffer: cleaned, width: meta.width, height: meta.height };
}

async function saveVisualAsset(input: {
  title: string;
  source: "admin-upload" | "admin-generated";
  originalName: string;
  originalSize: number;
  buffer: Buffer;
  kind: ProposalVisualKind;
  preset: ProposalPreset;
  tags: string;
  prompt?: string;
}) {
  const systemUser = await ensureFlowSmartlyUser();
  const kind = normalizeKind(input.kind);
  const preset = normalizePreset(input.preset);
  const tags = Array.from(new Set([
    PROPOSAL_VISUAL_TAG,
    kind,
    preset,
    ...parseProposalVisualTags(input.tags),
  ].filter(Boolean)));
  const filename = `${slugify(input.title)}-${randomUUID().slice(0, 8)}.png`;
  const key = `proposal-visual-assets/${filename}`;
  const url = await uploadToS3(key, input.buffer, "image/png");
  const metadata = await sharp(input.buffer).metadata();
  const file = await prisma.mediaFile.create({
    data: {
      userId: systemUser.id,
      filename,
      originalName: input.originalName,
      url,
      type: "image",
      mimeType: "image/png",
      size: input.buffer.length || input.originalSize,
      width: metadata.width || undefined,
      height: metadata.height || undefined,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify({
        title: input.title,
        kind,
        preset,
        source: input.source,
        prompt: input.prompt,
        transparentCutout: true,
      }),
    },
  });
  return file;
}

async function uploadLocalAsset(spec: UploadSpec, titles: Set<string>) {
  if (spec.skipReason) return { title: spec.title, status: "skipped", reason: spec.skipReason };
  if (titles.has(spec.title.toLowerCase())) return { title: spec.title, status: "exists" };
  const sourcePath = path.join(inputDir, spec.source);
  const original = await readFile(sourcePath);
  const cutout = await toCleanCutout(original);
  const processedPath = path.join(outputDir, `${slugify(spec.title)}.png`);
  await writeFile(processedPath, cutout.buffer);
  if (dryRun) {
    titles.add(spec.title.toLowerCase());
    return { title: spec.title, status: "processed", width: cutout.width, height: cutout.height };
  }
  const file = await saveVisualAsset({
    title: spec.title,
    source: "admin-upload",
    originalName: spec.source,
    originalSize: original.length,
    buffer: cutout.buffer,
    kind: spec.kind,
    preset: spec.preset,
    tags: spec.tags,
  });
  titles.add(spec.title.toLowerCase());
  return { title: spec.title, status: "uploaded", id: file.id, width: file.width, height: file.height };
}

async function generateAsset(spec: GenerateSpec, titles: Set<string>) {
  if (titles.has(spec.title.toLowerCase())) return { title: spec.title, status: "exists" };
  if (dryRun) return { title: spec.title, status: "skipped", reason: "dry-run generation disabled" };
  const prompt = [
    spec.prompt,
    "Create one isolated premium 3D PNG-style illustration cutout on a pure white/off-white background.",
    "Use a clean object cluster with soft contact shadows only.",
    "No full background scene, no room background, no gradient background, no border frame.",
    "No text, no words, no letters, no numbers, no captions, no logos, no brand marks, no placeholder boxes.",
    "Keep the subject fully visible and centered so the background can be removed after generation.",
  ].join(" ");
  const generatedImage = await generateImageXaiFirst(prompt, 1536, 1024, {
    quality: "high",
    strictProvider: true,
    preferredProvider: "xai",
  });
  if (!generatedImage.base64) throw new Error(`Generation returned no image for ${spec.title}`);
  const cutout = await toCleanCutout(Buffer.from(generatedImage.base64, "base64"));
  const processedPath = path.join(outputDir, `${slugify(spec.title)}.png`);
  await writeFile(processedPath, cutout.buffer);
  if (candidateMode) {
    titles.add(spec.title.toLowerCase());
    return { title: spec.title, status: "candidate", path: processedPath, width: cutout.width, height: cutout.height };
  }
  const file = await saveVisualAsset({
    title: spec.title,
    source: "admin-generated",
    originalName: "xai-generated-proposal-visual.png",
    originalSize: cutout.buffer.length,
    buffer: cutout.buffer,
    kind: spec.kind,
    preset: spec.preset,
    tags: spec.tags,
    prompt: spec.prompt,
  });
  titles.add(spec.title.toLowerCase());
  return { title: spec.title, status: "generated", id: file.id, width: file.width, height: file.height };
}

async function uploadGeneratedCandidate(spec: GenerateSpec, titles: Set<string>) {
  if (titles.has(spec.title.toLowerCase())) return { title: spec.title, status: "exists" };
  const processedPath = path.join(outputDir, `${slugify(spec.title)}.png`);
  const buffer = await readFile(processedPath);
  const file = await saveVisualAsset({
    title: spec.title,
    source: "admin-generated",
    originalName: `${slugify(spec.title)}.png`,
    originalSize: buffer.length,
    buffer,
    kind: spec.kind,
    preset: spec.preset,
    tags: spec.tags,
    prompt: spec.prompt,
  });
  titles.add(spec.title.toLowerCase());
  return { title: spec.title, status: "uploaded-candidate", id: file.id, width: file.width, height: file.height };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const titles = dryRun ? new Set<string>() : await existingTitles();
  const results = [];
  const uploadSpecs = onlyTitle ? uploads.filter((spec) => spec.title.toLowerCase() === onlyTitle) : uploads;
  const generatedSpecs = onlyTitle ? generated.filter((spec) => spec.title.toLowerCase() === onlyTitle) : generated;
  if (onlyTitle && uploadSpecs.length + generatedSpecs.length === 0) {
    throw new Error(`No upload or generation spec found for ${onlyTitle}`);
  }
  if (!candidateMode && !uploadCandidateMode) {
    for (const spec of uploadSpecs) {
      results.push(await uploadLocalAsset(spec, titles));
    }
  }
  for (const spec of generatedSpecs) {
    results.push(uploadCandidateMode ? await uploadGeneratedCandidate(spec, titles) : await generateAsset(spec, titles));
  }
  const assets = dryRun ? null : await listProposalVisualAssets({ presign: false });
  console.log(JSON.stringify({ dryRun, results, totalAssets: assets?.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
