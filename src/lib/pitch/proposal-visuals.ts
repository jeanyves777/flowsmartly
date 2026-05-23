import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { ProposalPreset, ProposalVisualAsset, ServiceProposalContent } from "./proposal-agent";

interface ProposalVisualBrandKit {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  uniqueValue?: string | null;
  colors?: string | null;
  fonts?: string | null;
}

interface GenerateProposalVisualAssetsInput {
  userId: string;
  preset?: ProposalPreset;
  targetName: string;
  serviceTitle: string;
  proposal: ServiceProposalContent;
  brandKit?: ProposalVisualBrandKit | null;
}

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cleanHex(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function cleanPrompt(value: string | undefined, fallback: string): string {
  const text = String(value || fallback).replace(/\s+/g, " ").trim();
  return text.slice(0, 1400);
}

export async function toTransparentPngCutout(
  image: string | Buffer,
): Promise<{ buffer: Buffer; width?: number; height?: number }> {
  const input = Buffer.isBuffer(image) ? image : Buffer.from(image, "base64");
  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(input)
      .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
      .ensureAlpha();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const width = info.width;
    const height = info.height;
    const pixelCount = width * height;
    const seen = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;

    const pixelOffset = (index: number) => index * channels;
    const sample = (index: number) => {
      const offset = pixelOffset(index);
      return {
        r: data[offset],
        g: data[offset + 1],
        b: data[offset + 2],
      };
    };
    const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
    const bg = cornerIndexes.reduce(
      (acc, index) => {
        const px = sample(index);
        acc.r += px.r;
        acc.g += px.g;
        acc.b += px.b;
        return acc;
      },
      { r: 0, g: 0, b: 0 },
    );
    bg.r /= cornerIndexes.length;
    bg.g /= cornerIndexes.length;
    bg.b /= cornerIndexes.length;
    const bgLuma = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114;
    const bgChroma = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b);

    const isBackground = (index: number) => {
      const { r, g, b } = sample(index);
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const distance = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
      return (
        (luma > 242 && chroma < 28) ||
        (bgLuma > 215 && bgChroma < 45 && luma > 205 && distance < 62)
      );
    };

    const push = (index: number) => {
      if (index < 0 || index >= pixelCount || seen[index] || !isBackground(index)) return;
      seen[index] = 1;
      queue[tail++] = index;
    };

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
      const offset = pixelOffset(index);
      data[offset + 3] = 0;
    }

    const buffer = await sharp(data, { raw: { width, height, channels } })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
      .extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const metadata = await sharp(buffer).metadata();
    return { buffer, width: metadata.width, height: metadata.height };
  } catch {
    return { buffer: input };
  }
}

function visualStyleGuard(input: GenerateProposalVisualAssetsInput) {
  const colors =
    input.proposal.design?.colorPalette ||
    safeJSON<Record<string, string>>(input.brandKit?.colors, {});
  const fonts = safeJSON<Record<string, string>>(input.brandKit?.fonts, {});
  const primary = cleanHex(colors.primary, "#0ea5e9");
  const secondary = cleanHex(colors.secondary, "#8b5cf6");
  const accent = cleanHex(colors.accent, "#f59e0b");
  const brandName = input.brandKit?.name || input.proposal.preparedBy || "the brand";
  const audience = input.brandKit?.targetAudience || "business owners";
  const voice = input.brandKit?.voiceTone || input.proposal.design?.brandVoice || "professional and helpful";
  const industry = input.brandKit?.industry || input.brandKit?.niche || "business growth";

  return [
    `Brand: ${brandName}.`,
    input.brandKit?.tagline ? `Tagline mood: ${input.brandKit.tagline}.` : "",
    input.brandKit?.uniqueValue ? `Unique value: ${input.brandKit.uniqueValue}.` : "",
    `Audience: ${audience}. Voice: ${voice}. Industry: ${industry}.`,
    `Use a premium visual language with brand colors ${primary}, ${secondary}, and ${accent}.`,
    fonts.heading ? `Match a ${fonts.heading} headline feel.` : "",
    `The final image will be placed inside a PDF proposal for ${input.targetName} about ${input.serviceTitle}.`,
    "Create one isolated premium 3D PNG-style illustration cutout on a pure white/off-white background so the background can be removed after generation.",
    "Use a clean object cluster with soft contact shadows only; no full rectangular scene, no photo background, no room background, no gradient background, no border frame.",
    "No text, no words, no letters, no numbers, no captions, no fake UI labels, no logos, no brand marks, no placeholder boxes, no white logo spaces, no dashed frames.",
    "The object must remain fully visible, centered, and easy to place on top of a proposal slide.",
  ].filter(Boolean).join(" ");
}

function buildVisualSpecs(input: GenerateProposalVisualAssetsInput): Array<{
  kind: ProposalVisualAsset["kind"];
  prompt: string;
  alt: string;
  width: number;
  height: number;
}> {
  const sectionPrompts = input.proposal.design?.sectionImagePrompts || [];
  const guard = visualStyleGuard(input);
  const industry = (input.brandKit?.industry || input.brandKit?.niche || "professional services").toLowerCase();
  const audience = (input.brandKit?.targetAudience || "clients in this industry").toLowerCase();
  const motifs = (input.proposal.design?.visualMotifs || []).slice(0, 4).join(", ");

  const motifLine = motifs ? `Visual motifs to lean on: ${motifs}.` : "";
  const coverFallback = `Premium 3D hero illustration cluster appropriate for ${industry} serving ${audience}. Refined lighting, soft depth, crisp professional composition, generous empty space for the proposal title. ${motifLine}`;
  const aboutFallback = `Elegant illustration representing ${input.proposal.preparedBy}'s practice in ${industry} — competence, partnership, and clarity. Object-cluster composition, no scene background.`;
  const impactFallback = `Premium impact visual showing the outcomes ${input.proposal.preparedBy} delivers in ${industry}. Use abstract geometric metaphors (rising forms, momentum, structure) rather than literal charts unless the offering is analytics-driven. Object cluster, no background.`;

  return [
    {
      kind: "cover",
      prompt: `${cleanPrompt(input.proposal.design?.coverImagePrompt, coverFallback)} Render as an isolated 3D illustration object cluster, not a background. ${guard}`,
      alt: `${input.proposal.serviceTitle} proposal cover visual`,
      width: 1536,
      height: 1024,
    },
    {
      kind: "about",
      prompt: `${cleanPrompt(sectionPrompts[0], aboutFallback)} Render as an isolated 3D illustration object cluster, not a background. ${guard}`,
      alt: `${input.proposal.preparedBy} brand vision visual`,
      width: 1536,
      height: 1024,
    },
    {
      kind: "impact",
      prompt: `${cleanPrompt(sectionPrompts[1], impactFallback)} Render as an isolated 3D illustration object cluster, not a background. ${guard}`,
      alt: `${input.proposal.serviceTitle} expected impact visual`,
      width: 1536,
      height: 1024,
    },
  ];
}

export async function generateProposalVisualAssets(
  input: GenerateProposalVisualAssetsInput,
): Promise<ServiceProposalContent> {
  const specs = buildVisualSpecs(input);
  const images: ProposalVisualAsset[] = [];

  for (const spec of specs) {
    try {
      const generated = await generateImageXaiFirst(spec.prompt, spec.width, spec.height, {
        quality: "high",
      });

      if (!generated.base64) continue;

      const png = await toTransparentPngCutout(generated.base64);
      const key = `pitch-proposals/${input.userId}/${Date.now()}-${spec.kind}.png`;
      await uploadToS3(key, png.buffer, "image/png");

      images.push({
        kind: spec.kind,
        url: key,
        alt: spec.alt,
        provider: generated.provider,
        model: generated.model,
        prompt: spec.prompt,
        width: png.width || spec.width,
        height: png.height || spec.height,
      });
    } catch (error) {
      console.warn(`[ProposalVisuals] ${spec.kind} image generation failed:`, error);
    }
  }

  if (!images.length) return input.proposal;

  return {
    ...input.proposal,
    visualAssets: {
      generatedAt: new Date().toISOString(),
      images,
    },
  };
}
