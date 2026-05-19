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
  preset: ProposalPreset;
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

async function toPngBuffer(base64: string): Promise<Buffer> {
  const input = Buffer.from(base64, "base64");
  try {
    const sharp = (await import("sharp")).default;
    return sharp(input).png({ compressionLevel: 8 }).toBuffer();
  } catch {
    return input;
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
    "Create a polished background or hero illustration only.",
    "No text, no words, no letters, no numbers, no captions, no fake UI labels, no logos, no brand marks, no placeholder boxes, no white logo spaces, no dashed frames.",
    "Leave natural negative space where our renderer can overlay real text and the real uploaded logo.",
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
  const presetCue: Record<ProposalPreset, string> = {
    "google-business-profile":
      "local search growth, map pin geometry, review-star energy, ranking lift, small-business visibility, clean analytics cards",
    "website-redesign":
      "modern responsive website screens, conversion paths, elegant interface surfaces, performance and trust cues",
    "local-seo":
      "local SEO momentum, area pages, citations, review reputation, organic ranking lift, clean search-market geometry",
    custom:
      "business growth strategy, premium client service, outcome-focused visual metaphors, trustworthy modern consulting",
  };

  const coverFallback = `Premium 3D business-growth hero scene with ${presetCue[input.preset]}, refined lighting, soft depth, crisp professional composition, generous empty space for proposal title.`;
  const aboutFallback = `Elegant brand vision illustration for ${input.proposal.preparedBy}, strategic growth, client partnership, polished dashboard and abstract team collaboration elements.`;
  const impactFallback = `Premium analytics impact visual with rising bars, circular metrics, momentum lines, client growth outcomes, clean brand-colored business dashboard.`;

  return [
    {
      kind: "cover",
      prompt: `${cleanPrompt(input.proposal.design?.coverImagePrompt, coverFallback)} ${guard}`,
      alt: `${input.proposal.serviceTitle} proposal cover visual`,
      width: 1536,
      height: 1024,
    },
    {
      kind: "about",
      prompt: `${cleanPrompt(sectionPrompts[0], aboutFallback)} ${guard}`,
      alt: `${input.proposal.preparedBy} brand vision visual`,
      width: 1536,
      height: 1024,
    },
    {
      kind: "impact",
      prompt: `${cleanPrompt(sectionPrompts[1], impactFallback)} ${guard}`,
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

      const png = await toPngBuffer(generated.base64);
      const key = `pitch-proposals/${input.userId}/${Date.now()}-${spec.kind}.png`;
      await uploadToS3(key, png, "image/png");

      images.push({
        kind: spec.kind,
        url: key,
        alt: spec.alt,
        provider: generated.provider,
        model: generated.model,
        prompt: spec.prompt,
        width: spec.width,
        height: spec.height,
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
