import { prisma } from "@/lib/db/client";
import {
  applyPortfolioUpdate,
  coerceSections,
  isValidTemplate,
  PORTFOLIO_TEMPLATES,
  type PortfolioPatch,
  type AccessMode,
  type DownloadMode,
  type HeroMedia,
  type ContactInfo,
  type PortfolioKind,
} from "@/lib/portfolio/portfolio-editor";
import type { FlowAgentTool } from "../registry";

const TEMPLATE_IDS = PORTFOLIO_TEMPLATES.map((t) => t.id);

/**
 * edit_portfolio — apply a partial patch to the user's Portfolio / Digital
 * Resume. Scalars overwrite; theme/contact/heroMedia merge; `sections` is
 * REPLACED wholesale (send the full new list). Also flips access/privacy
 * (email-verification gate), the visual style, hero media, and publish status.
 * Thin wrapper over the shared engine — mirrors edit_website/edit_store.
 */
export const editPortfolio: FlowAgentTool = {
  name: "edit_portfolio",
  description:
    "Edit the user's Portfolio / Digital Resume. Call get_portfolio_content FIRST. Send a PARTIAL patch: header fields (name, headline, subheadline, bio, avatarUrl, logoUrl); `sections` (the FULL new list — it's replaced wholesale, so include existing items you keep); `contact`; `template` (a style: " + TEMPLATE_IDS.join("/") + "); `heroMedia` ({type:'image'|'video',url,poster} — pairs with spotlight/cinematic/neon); `accent` (hex); `access` to control the visitor gate ({ view:'public'|'email', download:'public'|'email'|'off', seoIndex } — set view or download to 'email' to require email verification, which also captures every verified visitor as a Contact); `seo`; `customDomain`; and `status:'PUBLISHED'` to go live. Returns the updated portfolio + public URL.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      kind: { type: "string", enum: ["business", "personal"] },
      headline: { type: "string" },
      subheadline: { type: "string" },
      bio: { type: "string" },
      avatarUrl: { type: "string" },
      logoUrl: { type: "string" },
      template: { type: "string", enum: TEMPLATE_IDS, description: "Visual style preset (portfolio/ad feel, not a plain website)." },
      accent: { type: "string", description: "Hex accent colour." },
      heroMedia: {
        type: "object",
        description: "Full-bleed hero media. { type:'image'|'video'|'none', url, poster }.",
        properties: { type: { type: "string", enum: ["image", "video", "none"] }, url: { type: "string" }, poster: { type: "string" } },
      },
      sections: {
        type: "array",
        description: "The FULL new sections list (replaces the current one). Each { type, title, data }.",
        items: { type: "object", properties: { type: { type: "string" }, title: { type: "string" }, visible: { type: "boolean" }, data: { type: "object" } }, required: ["type"] },
      },
      contact: {
        type: "object",
        properties: { email: { type: "string" }, phone: { type: "string" }, location: { type: "string" }, website: { type: "string" }, links: { type: "array", items: { type: "object" } } },
      },
      access: {
        type: "object",
        description: "Visitor access / email-verification gate.",
        properties: {
          view: { type: "string", enum: ["public", "email"] },
          download: { type: "string", enum: ["public", "email", "off"] },
          seoIndex: { type: "boolean" },
        },
      },
      seo: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, image: { type: "string" } } },
      customDomain: { type: "string" },
      status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
    },
    required: [],
  },
  plans: null,
  costKey: "AGENT_UPDATE_PORTFOLIO",
  mutating: true,
  autoPlanCost: async (input) => ({
    credits: 0,
    label: input.status === "PUBLISHED" ? "Publish your portfolio" : "Update your portfolio",
    detail: input.status === "PUBLISHED" ? "Makes it live at its public URL." : undefined,
  }),
  handler: async (input, ctx) => {
    try {
      const portfolio = await prisma.portfolio.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        select: { id: true },
      });
      if (!portfolio) {
        return { ok: false, error_code: "validation_failed", message: "No portfolio to edit yet — use build_portfolio first." };
      }

      const patch: PortfolioPatch = {};
      if (typeof input.name === "string") patch.name = input.name;
      if (input.kind === "business" || input.kind === "personal") patch.kind = input.kind as PortfolioKind;
      if (typeof input.headline === "string") patch.headline = input.headline;
      if (typeof input.subheadline === "string") patch.subheadline = input.subheadline;
      if (typeof input.bio === "string") patch.bio = input.bio;
      if (typeof input.avatarUrl === "string") patch.avatarUrl = input.avatarUrl;
      if (typeof input.logoUrl === "string") patch.logoUrl = input.logoUrl;
      if (typeof input.customDomain === "string") patch.customDomain = input.customDomain;

      const theme: NonNullable<PortfolioPatch["theme"]> = {};
      if (typeof input.template === "string" && isValidTemplate(input.template)) theme.template = input.template;
      if (typeof input.accent === "string" && /^#/.test(input.accent)) theme.accent = input.accent;
      if (Object.keys(theme).length) patch.theme = theme;

      if (input.heroMedia && typeof input.heroMedia === "object") patch.heroMedia = input.heroMedia as Partial<HeroMedia>;
      if (Array.isArray(input.sections)) patch.sections = coerceSections(input.sections);
      if (input.contact && typeof input.contact === "object") patch.contact = input.contact as Partial<ContactInfo>;

      if (input.access && typeof input.access === "object") {
        const a = input.access as Record<string, unknown>;
        patch.access = {};
        if (a.view === "public" || a.view === "email") patch.access.view = a.view as AccessMode;
        if (a.download === "public" || a.download === "email" || a.download === "off") patch.access.download = a.download as DownloadMode;
        if (typeof a.seoIndex === "boolean") patch.access.seoIndex = a.seoIndex;
      }
      if (input.seo && typeof input.seo === "object") {
        const s = input.seo as Record<string, unknown>;
        patch.seo = {
          title: typeof s.title === "string" ? s.title : undefined,
          description: typeof s.description === "string" ? s.description : undefined,
          image: typeof s.image === "string" ? s.image : undefined,
        };
      }
      if (input.status === "DRAFT" || input.status === "PUBLISHED") patch.status = input.status;

      const updated = await applyPortfolioUpdate({ portfolioId: portfolio.id, userId: ctx.userId, patch });

      return {
        ok: true,
        data: {
          portfolioId: updated.id,
          status: updated.status,
          url: updated.url,
          access: updated.access,
          template: updated.theme.template,
          sectionCount: updated.sections.length,
          hint: updated.status === "PUBLISHED"
            ? "Live. Share the URL or generate a branded QR from Portfolio Studio."
            : "Saved as draft. Set status:'PUBLISHED' to go live.",
        },
        resultRefType: "Portfolio",
        resultRefId: updated.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to edit the portfolio." };
    }
  },
};
