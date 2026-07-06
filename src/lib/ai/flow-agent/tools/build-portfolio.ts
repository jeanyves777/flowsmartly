import { prisma } from "@/lib/db/client";
import { getUserBrand } from "@/lib/brand/get-brand";
import {
  createPortfolio,
  coerceSections,
  isValidTemplate,
  PORTFOLIO_TEMPLATES,
  type PortfolioKind,
  type ContactInfo,
  type HeroMedia,
} from "@/lib/portfolio/portfolio-editor";
import type { FlowAgentTool } from "../registry";

const TEMPLATE_IDS = PORTFOLIO_TEMPLATES.map((t) => t.id);
const SECTION_TYPES = ["about", "experience", "projects", "skills", "education", "services", "testimonials", "gallery", "stats", "video", "contact", "custom"];

/**
 * build_portfolio — create the user's Portfolio / Digital Resume site from
 * content the AGENT has already assembled (typically by reading an uploaded
 * résumé/CV or the Brand Kit). The tool is a thin persist wrapper: it does NOT
 * call the model itself — YOU extract the sections and pass them in, exactly
 * like build_website/build_store. One portfolio per account.
 *
 * kind: "personal" = a résumé site (experience/skills/education); "business" =
 * a portfolio (about/projects/services/testimonials). Theme accent defaults to
 * the Brand Kit colours when not supplied.
 */

export const buildPortfolio: FlowAgentTool = {
  name: "build_portfolio",
  description:
    "Create the user's Portfolio / Digital Resume site — a shareable public page you (the agent) build from their content. Use kind:'personal' for a résumé site (they usually upload a CV — READ it and extract experience/skills/education) or kind:'business' for a company/freelancer portfolio (about/projects/services/testimonials; pull from the Brand Kit). Pass the header (name, headline/role, bio) plus a `sections` array — each { type, title, data } where data matches the type (experience→{items:[{role,company,dates,summary}]}, skills→{items:[{label,level0-100}]}, education→{items:[{degree,school,dates}]}, projects→{items:[{title,description,imageUrl,url}]}, services→{items:[{title,description}]}, about/custom→{body}). Theme accent defaults to their Brand Kit colours. One portfolio per account — if one exists, use edit_portfolio instead. After building, tell them it's a DRAFT they can edit in Portfolio Studio and publish (with a custom domain + branded QR).",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["business", "personal"], description: "personal = résumé site; business = company/freelancer portfolio." },
      name: { type: "string", description: "The person's full name (personal) or the business/studio name (business)." },
      headline: { type: "string", description: "Role or tagline, e.g. 'Senior Product Designer' or 'Brand & product design for teams'." },
      subheadline: { type: "string" },
      bio: { type: "string", description: "A short intro paragraph." },
      avatarUrl: { type: "string", description: "Portrait photo URL (personal)." },
      logoUrl: { type: "string", description: "Logo/monogram URL (business)." },
      sections: {
        type: "array",
        description: "Ordered content blocks. Each { type, title, data }.",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: SECTION_TYPES },
            title: { type: "string" },
            visible: { type: "boolean" },
            data: { type: "object" },
          },
          required: ["type"],
        },
      },
      contact: {
        type: "object",
        description: "{ email, phone, location, website, links:[{label,url}] }",
        properties: {
          email: { type: "string" }, phone: { type: "string" }, location: { type: "string" },
          website: { type: "string" },
          links: { type: "array", items: { type: "object", properties: { label: { type: "string" }, url: { type: "string" } } } },
        },
      },
      accent: { type: "string", description: "Optional hex accent colour override (else the Brand Kit primary is used)." },
      template: {
        type: "string",
        enum: TEMPLATE_IDS,
        description: "Visual STYLE preset — pick one that reads like a portfolio / digital-ad piece, not a plain website. spotlight = bold billboard hero; cinematic = full-bleed VIDEO hero, premium; showcase = gallery-first; editorial = magazine/serif; neon = dark vivid gradients (creative/agency); card = clean résumé card (personal). Default spotlight.",
      },
      heroMedia: {
        type: "object",
        description: "Optional full-bleed hero media for a digital-ad feel. { type:'image'|'video', url, poster }. Use with a video-capable style (spotlight/cinematic/neon).",
        properties: {
          type: { type: "string", enum: ["image", "video", "none"] },
          url: { type: "string" },
          poster: { type: "string" },
        },
      },
    },
    required: ["kind", "name"],
  },
  plans: null,
  costKey: "AGENT_BUILD_PORTFOLIO",
  mutating: true,
  autoPlanCost: async (input) => ({
    credits: 0,
    label: `Build your ${input.kind === "personal" ? "résumé" : "portfolio"} site`,
    detail: "Creates a shareable draft you can edit, then publish on a custom domain.",
  }),
  handler: async (input, ctx) => {
    try {
      const kind = (input.kind === "personal" ? "personal" : "business") as PortfolioKind;
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name) {
        return { ok: false, error_code: "missing_input", message: "A name is required to build the portfolio." };
      }

      const existing = await prisma.portfolio.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true, slug: true },
      });
      if (existing) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "This account already has a portfolio. Use edit_portfolio to change it (get_portfolio_content first to see the current content).",
        };
      }

      // Seed theme accent from the Brand Kit unless the agent overrode it.
      const brand = await getUserBrand(ctx.userId).catch(() => null);
      const accent =
        (typeof input.accent === "string" && /^#/.test(input.accent) ? input.accent : null) ||
        brand?.colors?.accent ||
        brand?.colors?.primary ||
        undefined;
      const font = brand?.fonts?.heading || undefined;
      const template =
        typeof input.template === "string" && isValidTemplate(input.template) ? input.template : undefined;
      const heroMedia =
        input.heroMedia && typeof input.heroMedia === "object"
          ? (input.heroMedia as Partial<HeroMedia>)
          : undefined;

      const contact = (input.contact && typeof input.contact === "object" ? input.contact : {}) as Partial<ContactInfo>;

      const created = await createPortfolio({
        userId: ctx.userId,
        kind,
        name,
        headline: typeof input.headline === "string" ? input.headline : null,
        subheadline: typeof input.subheadline === "string" ? input.subheadline : null,
        bio: typeof input.bio === "string" ? input.bio : null,
        avatarUrl: typeof input.avatarUrl === "string" ? input.avatarUrl : null,
        logoUrl: typeof input.logoUrl === "string" ? input.logoUrl : null,
        heroMedia,
        theme: { ...(accent ? { accent } : {}), ...(font ? { font } : {}), ...(template ? { template } : {}) },
        sections: coerceSections(input.sections),
        contact,
      });

      return {
        ok: true,
        data: {
          portfolioId: created.id,
          kind: created.kind,
          name: created.name,
          status: created.status,
          url: created.url,
          sectionCount: created.sections.length,
          hint: "Draft created. Open Portfolio Studio (/home/portfolio) to edit, add media & sections, then publish. Publishing offers a custom domain + a branded QR to share.",
        },
        resultRefType: "Portfolio",
        resultRefId: created.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to build the portfolio." };
    }
  },
};
