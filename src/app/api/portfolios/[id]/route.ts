import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  applyPortfolioUpdate,
  coerceSections,
  isValidTemplate,
  type PortfolioPatch,
  type AccessMode,
  type DownloadMode,
  type HeroMedia,
  type ContactInfo,
} from "@/lib/portfolio/portfolio-editor";

// PATCH /api/portfolios/[id] — apply a partial patch from the Studio (style,
// access/gate, publish, header, sections). Owner-scoped via the engine's
// userId filter. Mirrors the edit_portfolio agent skill.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const patch: PortfolioPatch = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.headline === "string") patch.headline = body.headline;
    if (typeof body.subheadline === "string") patch.subheadline = body.subheadline;
    if (typeof body.bio === "string") patch.bio = body.bio;
    if (typeof body.avatarUrl === "string") patch.avatarUrl = body.avatarUrl;
    if (typeof body.logoUrl === "string") patch.logoUrl = body.logoUrl;
    if (typeof body.customDomain === "string") patch.customDomain = body.customDomain;
    if (typeof body.resumeFileUrl === "string") patch.resumeFileUrl = body.resumeFileUrl;

    const theme: NonNullable<PortfolioPatch["theme"]> = {};
    if (typeof body.template === "string" && isValidTemplate(body.template)) theme.template = body.template;
    if (typeof body.accent === "string" && /^#/.test(body.accent)) theme.accent = body.accent;
    if (typeof body.font === "string") theme.font = body.font;
    if (Object.keys(theme).length) patch.theme = theme;

    if (body.heroMedia && typeof body.heroMedia === "object") patch.heroMedia = body.heroMedia as Partial<HeroMedia>;
    if (Array.isArray(body.sections)) patch.sections = coerceSections(body.sections);
    if (body.contact && typeof body.contact === "object") patch.contact = body.contact as Partial<ContactInfo>;

    if (body.access && typeof body.access === "object") {
      const a = body.access as Record<string, unknown>;
      patch.access = {};
      if (a.view === "public" || a.view === "email") patch.access.view = a.view as AccessMode;
      if (a.download === "public" || a.download === "email" || a.download === "off") patch.access.download = a.download as DownloadMode;
      if (typeof a.seoIndex === "boolean") patch.access.seoIndex = a.seoIndex;
    }
    if (body.seo && typeof body.seo === "object") {
      const s = body.seo as Record<string, unknown>;
      patch.seo = {
        title: typeof s.title === "string" ? s.title : undefined,
        description: typeof s.description === "string" ? s.description : undefined,
        image: typeof s.image === "string" ? s.image : undefined,
      };
    }
    if (body.status === "DRAFT" || body.status === "PUBLISHED") patch.status = body.status;

    const portfolio = await applyPortfolioUpdate({ portfolioId: id, userId: session.userId, patch });
    return NextResponse.json({ portfolio });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const status = msg === "Portfolio not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
