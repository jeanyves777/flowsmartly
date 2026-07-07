import { searchDomains } from "@/lib/domains/manager";
import type { FlowAgentTool } from "../registry";

/**
 * find_domain — search available custom domains + yearly prices (for the
 * Portfolio Studio, or any purpose). Read-only. After presenting options, use
 * buy_portfolio_domain to purchase + auto-attach one, or connect_portfolio_domain
 * if the user already owns a domain.
 */
export const findDomain: FlowAgentTool = {
  name: "find_domain",
  description:
    "Search for AVAILABLE custom domains + prices. Pass a `query` (the person's name or brand, TLD optional) and get back available domains with yearly prices. Read-only and cheap. After showing 3-5 options, call buy_portfolio_domain to purchase + auto-attach the one the user picks, or connect_portfolio_domain if they already own a domain.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The name to search, e.g. 'jordanlee' or 'northwind studio' (TLD optional)." },
      tlds: { type: "array", items: { type: "string" }, description: "Optional TLDs to check, e.g. ['com','co','me']." },
    },
    required: ["query"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input) => {
    try {
      const query = typeof input.query === "string" ? input.query.trim() : "";
      if (!query) return { ok: false, error_code: "missing_input", message: "Give a name to search for." };
      const tlds = Array.isArray(input.tlds) ? input.tlds.filter((t): t is string => typeof t === "string") : undefined;

      const results = await searchDomains(query, tlds);
      const available = results
        .filter((r) => r.available)
        .map((r) => ({ domain: `${r.domain}.${r.tld}`, tld: r.tld, priceUsd: (r.retailCents / 100).toFixed(2), freeEligible: r.isFreeEligible }));

      return {
        ok: true,
        data: {
          available,
          count: available.length,
          hint:
            "Present a few options with their yearly prices. To buy + attach one to the portfolio, call buy_portfolio_domain with { domain, tld }. If the user already owns a domain, use connect_portfolio_domain instead.",
        },
      };
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: e instanceof Error ? e.message : "Domain search failed." };
    }
  },
};
