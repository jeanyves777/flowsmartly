import { readPortfolio, PORTFOLIO_TEMPLATES } from "@/lib/portfolio/portfolio-editor";
import type { FlowAgentTool } from "../registry";

/**
 * get_portfolio_content — read the user's Portfolio / Digital Resume so the
 * agent can edit it accurately. Returns the header, ALL sections (with their
 * data), contact, theme/style, hero media, access settings, publish status +
 * public URL, and the pickable STYLES. Read-only, free. Call BEFORE
 * edit_portfolio whenever changing the sections array (it's replaced wholesale).
 */
export const getPortfolioContent: FlowAgentTool = {
  name: "get_portfolio_content",
  description:
    "Read the user's Portfolio / Digital Resume so you can edit it precisely. Returns kind (business/personal), header (name, headline, bio, avatar/logo), ALL sections with their data, contact, theme + STYLE, hero media, access & privacy settings, publish status + public URL, and the list of pickable styles. Call this BEFORE edit_portfolio whenever you'll change the SECTIONS array (it's replaced wholesale, so you must send the full new list). One portfolio per account, so no id is needed. Read-only and free.",
  input_schema: { type: "object", properties: {}, required: [] },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const p = await readPortfolio(ctx.userId);
      if (!p) {
        return {
          ok: false,
          error_code: "validation_failed",
          message:
            "The user has no portfolio yet. Offer to build one with build_portfolio — ask business vs personal; for a personal résumé, have them upload their CV so you can read it and extract the sections.",
        };
      }
      return {
        ok: true,
        data: {
          ...p,
          styles: PORTFOLIO_TEMPLATES,
          hint:
            "Use edit_portfolio with a PARTIAL patch. `sections` is replaced wholesale — send the full new list (existing + your change). theme/contact/heroMedia/access are merged. To require visitors to verify their email before viewing or downloading, set access.view or access.download to 'email'. To go live, set status:'PUBLISHED'.",
        },
        resultRefType: "Portfolio",
        resultRefId: p.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read the portfolio." };
    }
  },
};
