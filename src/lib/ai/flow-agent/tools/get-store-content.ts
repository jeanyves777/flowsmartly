import { prisma } from "@/lib/db/client";
import { getStoreDir } from "@/lib/store-builder/store-site-builder";
import { readStoreData, detectStoreSections } from "@/lib/store-builder/store-editor";
import type { FlowAgentTool } from "../registry";

/**
 * get_store_content — read the user's storefront so the agent can edit it
 * accurately. Returns the store's build status + current structured content
 * (store info, CTA, hero, categories, nav/footer links, FAQ) AND the sections
 * that can be AI-redesigned. Read-only, free. One store per account.
 *
 * The agent MUST call this before edit_store whenever it will change a LIST
 * (nav/footer links, FAQ, categories) — those are replaced wholesale.
 */
export const getStoreContent: FlowAgentTool = {
  name: "get_store_content",
  description:
    "Read the user's storefront content so you can edit it precisely. Returns the store's build/publish status + the CURRENT structured content (store info, tagline, description, CTA, hero headline/subheadline/style/slides, categories, nav/footer links, FAQ) AND the list of sections you can AI-redesign. Call this BEFORE edit_store whenever you'll change a LIST (nav/footer links, FAQ, categories) — those get replaced wholesale, so you must send the full new list. One store per account, so no id is needed. Read-only and free.",
  input_schema: { type: "object", properties: {}, required: [] },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const store = await prisma.store.findFirst({
        where: { userId: ctx.userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, buildStatus: true, generatedPath: true, siteData: true },
      });
      if (!store) {
        return { ok: false, error_code: "validation_failed", message: "The user has no store yet. Offer to build one with build_store." };
      }

      const content = await readStoreData(store);
      const sections = detectStoreSections(store.generatedPath || getStoreDir(store.id));

      return {
        ok: true,
        data: {
          storeId: store.id,
          name: store.name,
          buildStatus: store.buildStatus,
          url: `/stores/${store.slug}`,
          editableSections: sections,
          content: content ?? {},
          hint: "Use edit_store mode:'content' with a PARTIAL patch to change text/data (storeInfo, heroConfig, navLinks, footerLinks, faq, categories — lists are replaced wholesale, send the full new list). Use mode:'redesign' with a section + instructions to change layout/design. The store rebuilds after either.",
        },
        resultRefType: "Store",
        resultRefId: store.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read the store content." };
    }
  },
};
