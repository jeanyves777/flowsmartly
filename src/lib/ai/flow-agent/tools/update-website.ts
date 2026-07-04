import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * update_website — the agent manages the user's website on their behalf:
 * publish / unpublish, rename, and SEO (title/description). Mirrors POST
 * /api/websites/[id]/publish and PATCH /api/websites/[id]. One site per account,
 * so it resolves the user's single website automatically.
 *
 * Scope is intentionally the DB-level actions that don't require a rebuild.
 * Deep content editing (rewrite a page's copy, add a section) goes through the
 * Website Builder's section APIs and is a separate, larger tool — for those the
 * agent should point the user to open the site editor for now.
 *
 * Mutating + confirmed plan, free. Links to /home/web.
 * [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const has = (input: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(input, k);

export const updateWebsite: FlowAgentTool = {
  name: "update_website",
  description:
    "Manage the user's website: publish it live, unpublish (back to draft), rename it, or set its SEO title/description. One website per account, so you don't need an id. Use for 'publish my site', 'take my site offline', 'rename my website to X', 'set my homepage SEO title'. For deep content edits (rewriting a page's text, adding a section), tell the user to open the site editor — that's not this tool. Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      publish: { type: "boolean", description: "true = publish the site live (and its draft pages); false = unpublish back to draft." },
      name: { type: "string", description: "New website name." },
      seoTitle: { type: "string", description: "New SEO/browser-tab title." },
      seoDescription: { type: "string", description: "New SEO meta description." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_WEBSITE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const site = await prisma.website.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true, publishedVersion: true },
      });
      if (!site) {
        return { ok: false, error_code: "validation_failed", message: "The user has no website yet. Offer to build one with build_website." };
      }

      const changed: string[] = [];

      if (has(input, "publish") && typeof input.publish === "boolean") {
        if (input.publish) {
          await prisma.$transaction([
            prisma.website.update({ where: { id: site.id }, data: { status: "PUBLISHED", publishedAt: new Date(), publishedVersion: (site.publishedVersion ?? 0) + 1 } }),
            prisma.websitePage.updateMany({ where: { websiteId: site.id, status: "DRAFT" }, data: { status: "PUBLISHED" } }),
          ]);
          changed.push("published live");
        } else {
          await prisma.website.update({ where: { id: site.id }, data: { status: "DRAFT" } });
          changed.push("unpublished (now draft)");
        }
      }

      const data: Record<string, unknown> = {};
      if (has(input, "name") && clean(input.name, 120)) { data.name = clean(input.name, 120); changed.push("name"); }
      if (has(input, "seoTitle")) { data.seoTitle = clean(input.seoTitle, 200) || null; changed.push("SEO title"); }
      if (has(input, "seoDescription")) { data.seoDescription = clean(input.seoDescription, 400) || null; changed.push("SEO description"); }
      if (Object.keys(data).length > 0) {
        await prisma.website.update({ where: { id: site.id }, data });
      }

      if (changed.length === 0) {
        return { ok: false, error_code: "missing_input", message: "Nothing to change. Provide publish (true/false), name, seoTitle, or seoDescription." };
      }

      return {
        ok: true,
        data: {
          websiteId: site.id,
          updatedFields: changed,
          summary: `Updated the website "${(data.name as string) ?? site.name}" (${changed.join(", ")}). The Web surface will reflect it. Confirm to the user in ONE short sentence.`,
          link: "/home/web",
        },
        resultRefType: "Website",
        resultRefId: site.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to update website" };
    }
  },
};
