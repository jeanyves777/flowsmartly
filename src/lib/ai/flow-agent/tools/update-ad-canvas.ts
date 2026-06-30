import type { FlowAgentTool } from "../registry";

const SOURCES = new Set(["product", "link", "describe"]);
const GOALS = new Set(["AWARENESS", "TRAFFIC", "ENGAGEMENT", "CONVERSIONS", "LEADS"]);
const PLACEMENTS = new Set(["feed", "meta_ads", "google_ads", "tiktok_ads"]);

/**
 * update_ad_canvas — fill the OPEN Ad builder canvas live as the agent works.
 *
 * Only exposed when the Ad builder canvas is open (gated by the `[ADBUILDER]`
 * canvasContext in agent-loop.ts). The handler validates the patch and emits a
 * `canvas_update` event carrying an `__ad` marker the client routes to the ad
 * builder state — so the headline/description/CTA/source/etc. appear in the
 * canvas instantly, each node animating in. Free + non-mutating: it's a live UI
 * fill, not server work, so no plan/confirm gate (the actual launch still goes
 * through propose_plan → the user confirms the spend).
 */
export const updateAdCanvas: FlowAgentTool = {
  name: "update_ad_canvas",
  description:
    "Fill the OPEN Ad builder canvas live — write the campaign INTO the on-screen builder as you work, so the user watches it appear. Pass ONLY the fields you're setting (a patch). Use it to: name the campaign; set the SOURCE ('product' + productName to pick one of their store products, 'link' + destinationUrl, or 'describe'); write the CREATIVE (a punchy headline + a short description + a CTA); set the goal/category; pick the placements (their ENABLED providers only); and set the budget. Write strong, on-brand, specific copy from what the user gave you — NEVER leave the headline as a placeholder. Call this whenever the user asks you to build/generate/write the ad (e.g. after they describe it or paste a link). After filling it, confirm in ONE short sentence and, when they want to launch, go through propose_plan for the spend. This is FREE and instant — fill the canvas first, talk second.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Campaign name." },
      source: { type: "string", description: "'product', 'link', or 'describe' — what they're advertising." },
      productName: { type: "string", description: "When source='product': the name of the store product to advertise (the client matches it from their products and selects it)." },
      destinationUrl: { type: "string", description: "When source='link' (or to set the ad's click-through URL): the product/page URL." },
      headline: { type: "string", description: "The ad headline — short and scroll-stopping (max ~12 words)." },
      description: { type: "string", description: "The ad description/body — one punchy line about the offer." },
      cta: { type: "string", description: "Call-to-action button text, e.g. 'Shop Now', 'Learn More', 'Get Offer', 'Sign Up', 'Book Now'." },
      goal: { type: "string", description: "Campaign goal — one of: AWARENESS, TRAFFIC, ENGAGEMENT, CONVERSIONS, LEADS." },
      category: { type: "string", description: "Ad category, e.g. 'Retail & e-commerce', 'Food & beverage'." },
      budget: { type: "number", description: "Budget in credits (whole number)." },
      placements: { type: "array", items: { type: "string" }, description: "Provider ids to run on — only their ENABLED providers: feed, meta_ads, google_ads, tiktok_ads." },
    },
  },
  plans: null,
  costKey: "AGENT_CANVAS_UPDATE",
  mutating: false,
  handler: async (input, ctx) => {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const patch: Record<string, unknown> = {};

    if (str(input.name)) patch.name = str(input.name);
    const source = str(input.source).toLowerCase();
    if (source && SOURCES.has(source)) patch.source = source;
    if (str(input.productName)) patch.productName = str(input.productName);
    if (str(input.destinationUrl)) patch.destinationUrl = str(input.destinationUrl);
    if (str(input.headline)) patch.headline = str(input.headline);
    if (str(input.description)) patch.description = str(input.description);
    if (str(input.cta)) patch.cta = str(input.cta);

    const goal = str(input.goal).toUpperCase();
    if (goal && GOALS.has(goal)) patch.goal = goal;
    if (str(input.category)) patch.category = str(input.category);

    if (typeof input.budget === "number" && isFinite(input.budget)) patch.budget = Math.max(1, Math.round(input.budget));
    else if (str(input.budget)) { const n = parseInt(str(input.budget), 10); if (isFinite(n)) patch.budget = Math.max(1, n); }

    if (Array.isArray(input.placements)) {
      const ids = input.placements.map((p) => (typeof p === "string" ? p.trim().toLowerCase() : "")).filter((p) => PLACEMENTS.has(p));
      if (ids.length) patch.placements = Array.from(new Set(ids));
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, error_code: "missing_input", message: "Provide at least one ad field to fill: name, source, productName, destinationUrl, headline, description, cta, goal, category, budget, or placements." };
    }

    ctx.emit({ type: "canvas_update", patch: { __ad: patch } });
    return {
      ok: true,
      data: {
        applied: Object.keys(patch),
        userMessage: `Filled the ad canvas (${Object.keys(patch).join(", ")}). Confirm in one short sentence; when the user wants to launch, propose_plan for the spend. Do not repeat the fields back.`,
      },
    };
  },
};
