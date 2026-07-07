import { prisma } from "@/lib/db/client";
import type { Portfolio } from "@prisma/client";

/**
 * portfolio-editor.ts — the ONE shared engine for the Portfolio / Digital
 * Resume Studio. Both the editor API routes AND the flow-agent tools
 * (build_portfolio / get_portfolio_content / edit_portfolio) call these
 * functions, so there is a single implementation of create / read / update /
 * publish. Auth + credit gating stay with each caller.
 *
 * A portfolio is structured JSON (header + sections + contact + theme) rendered
 * by a server component at (public)/pf/[slug] — NOT the heavy Website generator.
 * See the portfolio-studio design mockup + memory.
 */

export type PortfolioKind = "business" | "personal";
export type AccessMode = "public" | "email" | "password";
export type DownloadMode = "public" | "email" | "off";

export type SectionType =
  | "about"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "services"
  | "testimonials"
  | "gallery"
  | "stats"
  | "video"
  | "contact"
  | "custom";

/** One editable block on the page. `data` shape depends on `type` (see below). */
export interface PortfolioSection {
  id: string;
  type: SectionType;
  title: string;
  visible: boolean;
  /**
   * Freeform per-type payload the agent/editor fills. Common shapes:
   *  about       { body: string }
   *  experience  { items: [{ role, company, dates, summary }] }
   *  projects    { items: [{ title, description, imageUrl, url }] }
   *  skills      { items: [{ label, level }] }            // level 0-100
   *  education   { items: [{ degree, school, dates }] }
   *  services    { items: [{ title, description }] }
   *  testimonials{ items: [{ quote, author, role }] }
   *  gallery     { images: [{ url, caption }] }
   *  stats       { items: [{ value, label }] }
   *  custom      { body: string }
   */
  data: Record<string, unknown>;
}

export interface PortfolioTheme {
  accent: string;
  accent2: string;
  font: string;
  /** layout preset: "split" | "bold" | "minimal" | "editorial" */
  template: string;
}

export interface ContactLink {
  label: string;
  url: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  links: ContactLink[];
}

export type HeroMediaType = "image" | "video" | "none";

/** Full-bleed hero media — lets a style read like a digital-ad piece. */
export interface HeroMedia {
  type: HeroMediaType;
  url: string | null;
  poster: string | null; // poster frame for a video
}

export interface PortfolioAccess {
  view: AccessMode;
  download: DownloadMode;
  seoIndex: boolean;
}

/** Fully-parsed portfolio returned to the API + agent. */
export interface PortfolioContent {
  id: string;
  kind: PortfolioKind;
  name: string;
  slug: string;
  customDomain: string | null;
  headline: string | null;
  subheadline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  logoUrl: string | null;
  heroMedia: HeroMedia;
  theme: PortfolioTheme;
  sections: PortfolioSection[];
  contact: ContactInfo;
  resumeFileUrl: string | null;
  access: PortfolioAccess;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  totalViews: number;
  /** Public shareable URL (custom domain when attached, else /pf/<slug>). */
  url: string;
}

export const DEFAULT_THEME: PortfolioTheme = {
  accent: "#6d5cff",
  accent2: "#8b5cf6",
  font: "Inter",
  template: "spotlight",
};

export interface PortfolioTemplate {
  id: string;
  name: string;
  vibe: string;
  supportsVideoHero: boolean;
  /** which kinds this style suits */
  kinds: PortfolioKind[];
}

/**
 * Pickable visual styles. These make the page read like a PORTFOLIO / digital
 * advertisement — bold heroes, full-bleed media — not a generic website. Some
 * styles support a VIDEO hero. The public renderer + Studio switch on `id`.
 */
export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  { id: "spotlight", name: "Spotlight", vibe: "Big bold hero — a personal billboard", supportsVideoHero: true, kinds: ["business", "personal"] },
  { id: "cinematic", name: "Cinematic", vibe: "Full-bleed video hero, dramatic & premium", supportsVideoHero: true, kinds: ["business", "personal"] },
  { id: "showcase", name: "Showcase", vibe: "Gallery-first — your work up front", supportsVideoHero: false, kinds: ["business", "personal"] },
  { id: "editorial", name: "Editorial", vibe: "Magazine layout with serif accents", supportsVideoHero: false, kinds: ["business", "personal"] },
  { id: "neon", name: "Neon", vibe: "Dark, vivid gradients — creative/agency energy", supportsVideoHero: true, kinds: ["business", "personal"] },
  { id: "card", name: "Résumé Card", vibe: "Clean, recruiter-ready résumé card", supportsVideoHero: false, kinds: ["personal"] },
];

export function isValidTemplate(id: string): boolean {
  return PORTFOLIO_TEMPLATES.some((t) => t.id === id);
}

// ── JSON helpers ─────────────────────────────────────────────────────────────
function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sid(prefix = "sec"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Slug ─────────────────────────────────────────────────────────────────────
export function slugifyName(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniquePortfolioSlug(name: string): Promise<string> {
  const base = slugifyName(name).substring(0, 48) || "portfolio";
  for (let i = 0; i < 6; i++) {
    const suffix = i === 0 ? "" : `-${Math.random().toString(36).substring(2, 6)}`;
    const slug = `${base}${suffix}`;
    const existing = await prisma.portfolio.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${Math.random().toString(36).substring(2, 8)}`;
}

// ── Default scaffolds (used when the agent doesn't supply full sections) ──────
export function defaultSections(kind: PortfolioKind): PortfolioSection[] {
  if (kind === "personal") {
    return [
      { id: sid(), type: "experience", title: "Experience", visible: true, data: { items: [] } },
      { id: sid(), type: "skills", title: "Skills", visible: true, data: { items: [] } },
      { id: sid(), type: "education", title: "Education", visible: true, data: { items: [] } },
    ];
  }
  return [
    { id: sid(), type: "about", title: "About", visible: true, data: { body: "" } },
    { id: sid(), type: "projects", title: "Selected work", visible: true, data: { items: [] } },
    { id: sid(), type: "services", title: "Services", visible: true, data: { items: [] } },
    { id: sid(), type: "testimonials", title: "Testimonials", visible: false, data: { items: [] } },
  ];
}

const VALID_SECTION_TYPES: SectionType[] = [
  "about", "experience", "projects", "skills", "education",
  "services", "testimonials", "gallery", "stats", "video", "contact", "custom",
];

/** Normalise loosely-typed section input (from the agent/editor) into sections. */
export function coerceSections(raw: unknown): PortfolioSection[] {
  if (!Array.isArray(raw)) return [];
  const out: PortfolioSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const type = String(s.type || "custom") as SectionType;
    if (!VALID_SECTION_TYPES.includes(type)) continue;
    out.push({
      id: typeof s.id === "string" && s.id ? s.id : sid(),
      type,
      title: typeof s.title === "string" && s.title ? s.title : type[0].toUpperCase() + type.slice(1),
      visible: s.visible === undefined ? true : Boolean(s.visible),
      data: s.data && typeof s.data === "object" ? (s.data as Record<string, unknown>) : {},
    });
  }
  return out;
}

// ── Public URL ───────────────────────────────────────────────────────────────
export function portfolioPublicUrl(p: { slug: string; customDomain: string | null }): string {
  return p.customDomain ? `https://${p.customDomain}` : `/pf/${p.slug}`;
}

// ── Serialize a DB row → PortfolioContent ────────────────────────────────────
export function serializePortfolio(row: Portfolio): PortfolioContent {
  const theme = { ...DEFAULT_THEME, ...parseJson<Partial<PortfolioTheme>>(row.theme, {}) };
  const contact = parseJson<ContactInfo>(row.contact, { links: [] });
  if (!Array.isArray(contact.links)) contact.links = [];
  return {
    id: row.id,
    kind: (row.kind as PortfolioKind) || "business",
    name: row.name,
    slug: row.slug,
    customDomain: row.customDomain,
    headline: row.headline,
    subheadline: row.subheadline,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    logoUrl: row.logoUrl,
    heroMedia: {
      type: (row.heroMediaType as HeroMediaType) || "none",
      url: row.heroMediaUrl,
      poster: row.heroPosterUrl,
    },
    theme,
    sections: parseJson<PortfolioSection[]>(row.sections, []),
    contact,
    resumeFileUrl: row.resumeFileUrl,
    access: {
      view: (row.viewAccess as AccessMode) || "public",
      download: (row.downloadAccess as DownloadMode) || "public",
      seoIndex: row.seoIndex,
    },
    status: (row.status as "DRAFT" | "PUBLISHED") || "DRAFT",
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    totalViews: row.totalViews,
    url: portfolioPublicUrl(row),
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────
/** The user's portfolio (one per account, like Website/Store). */
export async function readPortfolio(userId: string): Promise<PortfolioContent | null> {
  const row = await prisma.portfolio.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return row ? serializePortfolio(row) : null;
}

export async function readPortfolioById(id: string, userId: string): Promise<PortfolioContent | null> {
  const row = await prisma.portfolio.findFirst({ where: { id, userId, deletedAt: null } });
  return row ? serializePortfolio(row) : null;
}

/** Public read by slug (no auth) — used by the public page. */
export async function getPortfolioBySlug(slug: string): Promise<Portfolio | null> {
  return prisma.portfolio.findFirst({ where: { slug, deletedAt: null } });
}

/** A published portfolio for the "Discover portfolios" rail (network/cross-promo). */
export interface DiscoveryItem {
  slug: string;
  name: string;
  headline: string | null;
  kind: PortfolioKind;
  thumb: string | null;
}

/** Other published portfolios to show in the discovery rail (excludes the current one). */
export async function listPublicPortfolios(excludeId: string, limit = 6): Promise<DiscoveryItem[]> {
  const rows = await prisma.portfolio.findMany({
    where: { status: "PUBLISHED", deletedAt: null, id: { not: excludeId } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { slug: true, name: true, headline: true, kind: true, logoUrl: true, avatarUrl: true, heroMediaUrl: true },
  });
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    headline: r.headline,
    kind: (r.kind as PortfolioKind) || "business",
    thumb: r.logoUrl || r.avatarUrl || r.heroMediaUrl || null,
  }));
}

// ── Create ───────────────────────────────────────────────────────────────────
export interface CreatePortfolioInput {
  userId: string;
  kind: PortfolioKind;
  name: string;
  headline?: string | null;
  subheadline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  heroMedia?: Partial<HeroMedia>;
  theme?: Partial<PortfolioTheme>;
  sections?: PortfolioSection[];
  contact?: Partial<ContactInfo>;
  resumeFileUrl?: string | null;
  brandKitId?: string | null;
}

export async function createPortfolio(input: CreatePortfolioInput): Promise<PortfolioContent> {
  const slug = await generateUniquePortfolioSlug(input.name);
  const theme: PortfolioTheme = { ...DEFAULT_THEME, ...(input.theme || {}) };
  const sections =
    input.sections && input.sections.length > 0 ? input.sections : defaultSections(input.kind);
  const contact: ContactInfo = { links: [], ...(input.contact || {}) };
  if (!Array.isArray(contact.links)) contact.links = [];

  const row = await prisma.portfolio.create({
    data: {
      userId: input.userId,
      brandKitId: input.brandKitId || null,
      kind: input.kind,
      name: input.name.trim(),
      slug,
      headline: input.headline ?? null,
      subheadline: input.subheadline ?? null,
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
      logoUrl: input.logoUrl ?? null,
      heroMediaType: input.heroMedia?.type ?? null,
      heroMediaUrl: input.heroMedia?.url ?? null,
      heroPosterUrl: input.heroMedia?.poster ?? null,
      theme: JSON.stringify(theme),
      sections: JSON.stringify(sections),
      contact: JSON.stringify(contact),
      resumeFileUrl: input.resumeFileUrl ?? null,
    },
  });
  return serializePortfolio(row);
}

// ── Update (partial patch) ───────────────────────────────────────────────────
export interface PortfolioPatch {
  name?: string;
  kind?: PortfolioKind;
  headline?: string | null;
  subheadline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  /** Hero media (image/video/none) — merged onto existing. */
  heroMedia?: Partial<HeroMedia>;
  /** Merged onto the existing theme. */
  theme?: Partial<PortfolioTheme>;
  /** Replaces the whole sections array (send the full new list). */
  sections?: PortfolioSection[];
  /** Merged onto the existing contact. */
  contact?: Partial<ContactInfo>;
  resumeFileUrl?: string | null;
  customDomain?: string | null;
  access?: Partial<PortfolioAccess>;
  password?: string | null;
  seo?: { title?: string | null; description?: string | null; image?: string | null };
  status?: "DRAFT" | "PUBLISHED";
}

/**
 * Apply a partial patch. Scalars overwrite; `theme` and `contact` merge;
 * `sections` is replaced wholesale (the caller sends the full new list, exactly
 * like the Website content lists). Returns the updated PortfolioContent.
 */
export async function applyPortfolioUpdate(args: {
  portfolioId: string;
  userId: string;
  patch: PortfolioPatch;
}): Promise<PortfolioContent> {
  const current = await prisma.portfolio.findFirst({
    where: { id: args.portfolioId, userId: args.userId, deletedAt: null },
  });
  if (!current) throw new Error("Portfolio not found");

  const { patch } = args;
  const data: Record<string, unknown> = {};

  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.kind !== undefined) data.kind = patch.kind;
  if (patch.headline !== undefined) data.headline = patch.headline;
  if (patch.subheadline !== undefined) data.subheadline = patch.subheadline;
  if (patch.bio !== undefined) data.bio = patch.bio;
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
  if (patch.logoUrl !== undefined) data.logoUrl = patch.logoUrl;
  if (patch.resumeFileUrl !== undefined) data.resumeFileUrl = patch.resumeFileUrl;
  if (patch.customDomain !== undefined) data.customDomain = patch.customDomain;
  if (patch.password !== undefined) data.password = patch.password;

  if (patch.heroMedia) {
    if (patch.heroMedia.type !== undefined) data.heroMediaType = patch.heroMedia.type;
    if (patch.heroMedia.url !== undefined) data.heroMediaUrl = patch.heroMedia.url;
    if (patch.heroMedia.poster !== undefined) data.heroPosterUrl = patch.heroMedia.poster;
  }

  if (patch.theme) {
    const merged = { ...parseJson<Partial<PortfolioTheme>>(current.theme, {}), ...patch.theme };
    data.theme = JSON.stringify({ ...DEFAULT_THEME, ...merged });
  }
  if (patch.contact) {
    const merged = { ...parseJson<ContactInfo>(current.contact, { links: [] }), ...patch.contact };
    if (!Array.isArray(merged.links)) merged.links = [];
    data.contact = JSON.stringify(merged);
  }
  if (patch.sections) data.sections = JSON.stringify(patch.sections);

  if (patch.access) {
    if (patch.access.view !== undefined) data.viewAccess = patch.access.view;
    if (patch.access.download !== undefined) data.downloadAccess = patch.access.download;
    if (patch.access.seoIndex !== undefined) data.seoIndex = patch.access.seoIndex;
  }
  if (patch.seo) {
    if (patch.seo.title !== undefined) data.seoTitle = patch.seo.title;
    if (patch.seo.description !== undefined) data.seoDescription = patch.seo.description;
    if (patch.seo.image !== undefined) data.seoImage = patch.seo.image;
  }
  if (patch.status !== undefined) {
    data.status = patch.status;
    if (patch.status === "PUBLISHED" && !current.publishedAt) data.publishedAt = new Date();
  }

  const row = await prisma.portfolio.update({ where: { id: current.id }, data });
  return serializePortfolio(row);
}

/** Convenience: flip status to PUBLISHED (stamps publishedAt on first publish). */
export async function publishPortfolio(portfolioId: string, userId: string): Promise<PortfolioContent> {
  return applyPortfolioUpdate({ portfolioId, userId, patch: { status: "PUBLISHED" } });
}
