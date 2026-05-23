import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import type { ProposalPreset, ProposalVisualAsset, ServiceProposalContent } from "./proposal-agent";

export const PROPOSAL_VISUAL_TAG = "proposal-visual";

export type ProposalVisualKind = "cover" | "about" | "impact" | "general";

export interface ProposalLibraryAsset {
  id: string;
  title: string;
  url: string;
  kind: ProposalVisualKind;
  preset: ProposalPreset | "any";
  tags: string[];
  source: "default" | "admin-upload" | "admin-generated";
  prompt?: string;
  width?: number;
  height?: number;
  createdAt?: string;
}

interface SelectProposalVisualInput {
  proposal: ServiceProposalContent;
  preset?: ProposalPreset;
  serviceTitle: string;
  targetName: string;
  brandKit?: {
    industry?: string | null;
    niche?: string | null;
    targetAudience?: string | null;
  } | null;
}

function pregeneratedAsset(
  slug: string,
  title: string,
  kind: ProposalVisualKind,
  preset: ProposalPreset | "any",
  tags: string[],
  width: number,
  height: number,
): ProposalLibraryAsset {
  return {
    id: `pregenerated-${slug}`,
    title,
    url: `/proposal-assets/pregenerated/${slug}.png`,
    kind,
    preset,
    tags: ["pregenerated", "premium", ...tags],
    source: "default",
    width,
    height,
  };
}

export const PREGENERATED_PROPOSAL_VISUAL_ASSETS: ProposalLibraryAsset[] = [
  pregeneratedAsset("growth-leader-bars-wide", "Growth leader with revenue bars", "cover", "any", ["growth", "sales", "revenue", "bars", "strategy", "analytics", "consulting"], 1200, 935),
  pregeneratedAsset("analytics-consultant-man-charts", "Analytics consultant with charts", "about", "custom", ["analytics", "consultant", "strategy", "dashboard", "reporting", "business"], 1150, 1127),
  pregeneratedAsset("growth-arrow-dashboard-leader", "Growth arrow dashboard leader", "impact", "any", ["growth", "analytics", "chart", "performance", "strategy", "revenue"], 1114, 1014),
  pregeneratedAsset("growth-leader-bars-target", "Growth leader with target", "cover", "any", ["growth", "target", "bars", "sales", "performance", "strategy"], 1200, 856),
  pregeneratedAsset("local-store-price-growth", "Local store price growth", "impact", "google-business-profile", ["local", "store", "pricing", "revenue", "growth", "google", "business-profile"], 1040, 794),
  pregeneratedAsset("mobile-local-store-reviews", "Mobile local store reviews", "cover", "google-business-profile", ["local", "store", "mobile", "reviews", "stars", "google", "business-profile"], 852, 1155),
  pregeneratedAsset("local-seo-dashboard-consultant", "Local SEO dashboard consultant", "about", "local-seo", ["local", "seo", "dashboard", "search", "analytics", "consultant"], 1006, 1118),
  pregeneratedAsset("growth-leader-target-analytics", "Growth leader target analytics", "impact", "any", ["growth", "target", "analytics", "chart", "performance"], 982, 1065),
  pregeneratedAsset("growth-leader-bars-target-alt", "Growth leader bars target alt", "cover", "any", ["growth", "bars", "target", "revenue", "sales"], 1182, 942),
  pregeneratedAsset("business-analytics-consultant-man", "Business analytics consultant", "about", "custom", ["business", "analytics", "consultant", "dashboard", "reporting"], 1101, 1178),
  pregeneratedAsset("local-store-revenue-tag", "Local store revenue tag", "impact", "google-business-profile", ["local", "store", "revenue", "pricing", "tag", "growth", "business-profile"], 1200, 685),
  pregeneratedAsset("dashboard-growth-consultant", "Dashboard growth consultant", "about", "custom", ["dashboard", "analytics", "consultant", "growth", "strategy"], 929, 1033),
  pregeneratedAsset("growth-bars-pie-leader", "Growth bars pie leader", "impact", "any", ["growth", "bars", "pie", "analytics", "chart", "performance"], 1137, 1040),
  pregeneratedAsset("silver-growth-leader-analytics", "Silver growth leader analytics", "impact", "any", ["growth", "analytics", "chart", "premium", "performance"], 1117, 1075),
  pregeneratedAsset("local-growth-leader-bars", "Local growth leader bars", "cover", "any", ["local", "growth", "bars", "revenue", "strategy"], 1173, 914),
  pregeneratedAsset("dashboard-analytics-consultant", "Dashboard analytics consultant", "about", "custom", ["dashboard", "analytics", "consultant", "conversion", "performance"], 1139, 933),
  pregeneratedAsset("phone-local-rating", "Phone local rating", "cover", "google-business-profile", ["phone", "local", "store", "reviews", "rating", "stars", "business-profile"], 987, 1175),
  pregeneratedAsset("seo-analytics-consultant", "SEO analytics consultant", "about", "local-seo", ["seo", "analytics", "consultant", "search", "dashboard", "growth"], 1069, 1171),
  pregeneratedAsset("growth-bars-leader-magnifier", "Growth bars leader magnifier", "cover", "any", ["growth", "bars", "magnifier", "analytics", "strategy"], 1200, 985),
  pregeneratedAsset("analytics-consultant-man-blue", "Blue analytics consultant", "about", "custom", ["analytics", "consultant", "dashboard", "growth", "strategy"], 1061, 1093),
  pregeneratedAsset("strategy-dashboard-consultant", "Strategy dashboard consultant", "about", "custom", ["strategy", "dashboard", "analytics", "consultant", "marketing"], 1163, 970),
  pregeneratedAsset("seo-dashboard-researcher", "SEO dashboard researcher", "about", "local-seo", ["seo", "search", "dashboard", "research", "ranking", "analytics"], 1161, 998),
  pregeneratedAsset("local-seo-store-growth", "Local SEO store growth", "impact", "google-business-profile", ["local", "seo", "store", "growth", "reviews", "ranking", "business-profile"], 1096, 989),
  pregeneratedAsset("seo-dashboard-consultant-man", "SEO dashboard consultant man", "about", "local-seo", ["seo", "dashboard", "search", "analytics", "consultant"], 1180, 1147),
  pregeneratedAsset("proposal-metrics-consultant", "Proposal metrics consultant", "about", "custom", ["proposal", "metrics", "analytics", "consultant", "strategy"], 1165, 1055),
  pregeneratedAsset("chart-growth-analytics", "Chart growth analytics", "impact", "any", ["chart", "growth", "analytics", "bars", "performance", "revenue"], 1060, 956),
  pregeneratedAsset("growth-leader-red-jacket", "Growth leader red jacket", "impact", "any", ["growth", "sales", "bars", "revenue", "leader"], 1097, 1054),
  pregeneratedAsset("pricing-growth-tag", "Pricing growth tag", "impact", "any", ["pricing", "tag", "revenue", "growth", "sales", "terms"], 983, 832),
  pregeneratedAsset("chart-growth-bars-pie", "Chart growth bars and pie", "impact", "any", ["chart", "growth", "bars", "pie", "analytics", "performance"], 1064, 1066),
  pregeneratedAsset("business-growth-woman-bars", "Business growth woman bars", "impact", "any", ["business", "growth", "bars", "sales", "revenue", "leader"], 1029, 1155),
  pregeneratedAsset("analytics-consultant-man-white", "White background analytics consultant", "about", "custom", ["analytics", "consultant", "dashboard", "growth", "reporting"], 1137, 1121),
  pregeneratedAsset("red-pricing-tag-blank", "Red pricing tag blank", "impact", "any", ["pricing", "tag", "terms", "offer", "revenue"], 878, 1200),
];

export const DEFAULT_PROPOSAL_VISUAL_ASSETS: ProposalLibraryAsset[] = [
  ...PREGENERATED_PROPOSAL_VISUAL_ASSETS,
  {
    id: "default-local-listings-cutout",
    title: "Local listing and reputation cutout",
    url: "/proposal-assets/flowsmartly-listsmartly-local-listings-cutout.png",
    kind: "cover",
    preset: "google-business-profile",
    tags: ["local", "listing", "map", "reviews", "reputation", "google", "business-profile", "seo"],
    source: "default",
    width: 1536,
    height: 1024,
  },
  {
    id: "default-growth-consultant-cutout",
    title: "Growth consultant cutout",
    url: "/proposal-assets/flowsmartly-home-agent-consultant.png",
    kind: "about",
    preset: "any",
    tags: ["consultant", "strategy", "analytics", "review", "growth", "marketing", "advisor"],
    source: "default",
    width: 978,
    height: 1442,
  },
  {
    id: "default-commerce-cutout",
    title: "Commerce and product growth cutout",
    url: "/proposal-assets/flowsmartly-flowshop-commerce-cutout.png",
    kind: "impact",
    preset: "website-redesign",
    tags: ["commerce", "website", "store", "checkout", "products", "analytics", "conversion"],
    source: "default",
    width: 1536,
    height: 1024,
  },
  {
    id: "default-creator-dashboard-cutout",
    title: "Creator dashboard cutout",
    url: "/proposal-assets/flowsmartly-human-creator-cutout.png",
    kind: "general",
    preset: "custom",
    tags: ["creator", "social", "content", "campaign", "dashboard", "growth", "analytics"],
    source: "default",
    width: 1309,
    height: 1023,
  },
  {
    id: "default-business-analytics-cutout",
    title: "Business analytics cutout",
    url: "/marketing/transparent/flowsmartly-dashboard-cutout.png",
    kind: "impact",
    preset: "local-seo",
    tags: ["analytics", "target", "chart", "seo", "business", "lead", "performance"],
    source: "default",
    width: 1536,
    height: 1024,
  },
  {
    id: "default-ai-assistant-cutout",
    title: "AI assistant proposal cutout",
    url: "/marketing/transparent/flowsmartly-ai-assistant-cutout.png",
    kind: "about",
    preset: "any",
    tags: ["ai", "assistant", "automation", "support", "workflow", "strategy"],
    source: "default",
    width: 1536,
    height: 1024,
  },
  {
    id: "default-human-marketer-cutout",
    title: "Human marketer cutout",
    url: "/marketing/transparent/flowsmartly-human-marketer-cutout.png",
    kind: "cover",
    preset: "custom",
    tags: ["marketing", "campaign", "content", "social", "growth", "creator"],
    source: "default",
    width: 1309,
    height: 1023,
  },
  {
    id: "default-approval-cutout",
    title: "Approval workflow cutout",
    url: "/marketing/transparent/flowsmartly-approval-cutout.png",
    kind: "impact",
    preset: "any",
    tags: ["approval", "checklist", "workflow", "quality", "reporting", "trust"],
    source: "default",
    width: 1536,
    height: 1024,
  },
  {
    id: "default-growth-bars-scene",
    title: "Growth strategy visual panel",
    url: "/proposal-assets/flowsmartly-growth-bars-scene.png",
    kind: "impact",
    preset: "any",
    tags: ["growth", "sales", "analytics", "revenue", "strategy", "bars", "scene", "performance"],
    source: "default",
    width: 1536,
    height: 1024,
  },
];

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTag(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function parseProposalVisualTags(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map(normalizeTag)
    .filter(Boolean)
    .slice(0, 24);
}

export async function listProposalVisualAssets(options: { presign?: boolean } = {}): Promise<ProposalLibraryAsset[]> {
  const files = await prisma.mediaFile.findMany({
    where: {
      type: "image",
      tags: { contains: PROPOSAL_VISUAL_TAG },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const adminAssets = await Promise.all(files.map(async (file) => {
    const metadata = safeJSON<Record<string, unknown>>(file.metadata, {});
    const rawTags = safeJSON<string[]>(file.tags, []);
    const tags = rawTags
      .filter((tag) => tag !== PROPOSAL_VISUAL_TAG)
      .map(normalizeTag)
      .filter(Boolean);
    const url = options.presign && !file.url.startsWith("/")
      ? await getPresignedUrl(file.url).catch(() => file.url)
      : file.url;

    return {
      id: file.id,
      title: String(metadata.title || file.originalName || "Proposal visual"),
      url,
      kind: normalizeKind(metadata.kind),
      preset: normalizePreset(metadata.preset),
      tags,
      source: metadata.source === "admin-generated" ? "admin-generated" : "admin-upload",
      prompt: typeof metadata.prompt === "string" ? metadata.prompt : undefined,
      width: file.width || undefined,
      height: file.height || undefined,
      createdAt: file.createdAt.toISOString(),
    } satisfies ProposalLibraryAsset;
  }));

  return [...adminAssets, ...DEFAULT_PROPOSAL_VISUAL_ASSETS];
}

export function normalizeKind(value: unknown): ProposalVisualKind {
  const raw = String(value || "").toLowerCase();
  if (raw === "cover" || raw === "about" || raw === "impact") return raw;
  return "general";
}

export function normalizePreset(value: unknown): ProposalPreset | "any" {
  const raw = String(value || "").toLowerCase().trim();
  return raw || "any";
}

function scoreAsset(asset: ProposalLibraryAsset, context: string, desiredKind: ProposalVisualAsset["kind"]) {
  let score = 0;
  if (asset.kind === desiredKind) score += 36;
  if (asset.kind === "general") score += 12;
  if (asset.source !== "default") score += 6;
  if (asset.tags.includes("pregenerated")) score += 18;
  if (asset.tags.includes("premium")) score += 6;
  for (const tag of asset.tags) {
    if (tag && context.includes(tag)) score += 10;
  }
  return score;
}

export async function selectProposalVisualAssets(
  input: SelectProposalVisualInput,
): Promise<ServiceProposalContent["visualAssets"]> {
  const assets = await listProposalVisualAssets({ presign: false });
  const context = [
    input.preset,
    input.serviceTitle,
    input.targetName,
    input.proposal.title,
    input.proposal.subtitle,
    input.proposal.serviceTitle,
    input.proposal.executiveSummary,
    input.brandKit?.industry,
    input.brandKit?.niche,
    input.brandKit?.targetAudience,
    ...(input.proposal.design?.visualMotifs || []),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const used = new Set<string>();
  const selected = (["cover", "about", "impact"] as const).map((kind) => {
    const asset = [...assets]
      .sort((a, b) => scoreAsset(b, context, kind) - scoreAsset(a, context, kind))
      .find((candidate) => !used.has(candidate.id)) || assets[0];
    used.add(asset.id);
    return {
      kind,
      url: asset.url,
      alt: asset.title,
      provider: "library",
      model: asset.source,
      prompt: asset.prompt,
      width: asset.width,
      height: asset.height,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    images: selected,
  };
}

export async function attachProposalLibraryVisuals(
  input: SelectProposalVisualInput,
): Promise<ServiceProposalContent> {
  return {
    ...input.proposal,
    visualAssets: await selectProposalVisualAssets(input),
  };
}
