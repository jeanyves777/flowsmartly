import { prisma } from "@/lib/db/client";
import { getSiteDir } from "@/lib/website/site-builder";
import { readSiteData, detectSiteSections } from "@/lib/website/site-editor";
import type { FlowAgentTool } from "../registry";

/**
 * get_website_content — read the user's website so the agent can edit it
 * accurately. Returns the site status + current structured content (company,
 * CTA, services, team, FAQ, testimonials, stats, links, contact/map, Google
 * Reviews) AND the sections that can be AI-redesigned. Read-only, free.
 *
 * The agent MUST call this before edit_website whenever it will change a LIST
 * (services/FAQ/testimonials/links) — those are replaced wholesale, so it needs
 * the current list to send back the full new one. One website per account.
 */
export const getWebsiteContent: FlowAgentTool = {
  name: "get_website_content",
  description:
    "Read the user's website content so you can edit it precisely. Returns the site's build/publish status + the CURRENT structured content (company info, CTA button, services, team, FAQ, testimonials, stats, nav/footer links, contact info + Google map, Google Reviews) AND the list of sections you can AI-redesign. Call this BEFORE edit_website whenever you'll change a LIST (services, FAQ, testimonials, nav/footer links, stats) — those get replaced wholesale, so you must send the full new list (existing items + your change). One website per account, so no id is needed. Read-only and free.",
  input_schema: { type: "object", properties: {}, required: [] },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const site = await prisma.website.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, status: true, buildStatus: true, customDomain: true, generatedPath: true, siteData: true },
      });
      if (!site) {
        return { ok: false, error_code: "validation_failed", message: "The user has no website yet. Offer to build one with build_website." };
      }

      const { data, pages } = await readSiteData(site);
      const sections = detectSiteSections(site.generatedPath || getSiteDir(site.id));

      return {
        ok: true,
        data: {
          websiteId: site.id,
          name: site.name,
          status: site.status,
          buildStatus: site.buildStatus,
          url: site.customDomain ? `https://${site.customDomain}` : `/sites/${site.slug}`,
          customDomain: site.customDomain || null,
          pages,
          editableSections: sections,
          content: data ?? {},
          hint: "Use edit_website mode:'content' with a PARTIAL patch to change text/data (lists like services/faq/testimonials/links are replaced wholesale — send the full new list). Use mode:'redesign' with a section + instructions to change layout/design or add a section. The site rebuilds after either.",
        },
        resultRefType: "Website",
        resultRefId: site.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read the website content." };
    }
  },
};
