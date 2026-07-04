import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * update_brand_identity — the agent WRITES the user's BrandKit.
 *
 * This is the write counterpart to get_brand_identity. When the user hands the
 * agent any business/brand info ("here's my business: …", "set up my brand",
 * "my tagline is …", "change my voice to playful"), the agent must ACT on it —
 * infer EVERY field it reasonably can from the user's words and fill the kit,
 * then save — NOT hand the user a checklist of what to add. The agent is the
 * operator of the account; it owns the brand kit on the user's behalf.
 *
 * Merge semantics: only the fields you pass are written; omitted fields keep
 * their current value, so this is safe for both first-time setup and a small
 * one-field tweak. Pass empty string / empty array only when you intend to
 * clear a field.
 *
 * Mutating but credit-free — persisting brand text is a setting, not AI work
 * (the agent already did the inference inline this turn). Still requires a
 * confirmed propose_plan (planId) because the user expects to confirm changes
 * to their brand before they're saved. After it runs, the Brand surface
 * refreshes to show the filled kit.
 */

const VOICE_TONES = new Set([
  "professional", "casual", "playful", "inspirational", "educational", "friendly", "authoritative",
]);

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : undefined;

export const updateBrandIdentity: FlowAgentTool = {
  name: "update_brand_identity",
  description:
    "Create or UPDATE the user's BrandKit on their behalf — the write counterpart to get_brand_identity. Use this the moment the user provides ANY business/brand information (a description, tagline, voice, audience, products, colors, contact details) or asks you to 'set up'/'fill in'/'fix'/'change' their brand. INFER every field you reasonably can from their words and fill the WHOLE kit — name, tagline, description, industry, niche, targetAudience, voiceTone, personality, uniqueValue, keywords, hashtags, products — do NOT just tell the user what to add. Only the fields you pass are written (merge); omit a field to leave it unchanged. Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Brand / business name." },
      tagline: { type: "string", description: "Short tagline / slogan." },
      description: { type: "string", description: "1–3 sentence description: what they do, for whom, why it matters." },
      industry: { type: "string", description: "Industry, e.g. 'Software', 'Food & beverage'." },
      niche: { type: "string", description: "Specific niche within the industry." },
      targetAudience: { type: "string", description: "Who they serve." },
      audienceAge: { type: "string", description: "Audience age range, e.g. '25–40'." },
      audienceLocation: { type: "string", description: "Where the audience is, e.g. 'US, urban'." },
      uniqueValue: { type: "string", description: "What sets the brand apart." },
      voiceTone: {
        type: "string",
        description: "One of: professional, casual, playful, inspirational, educational, friendly, authoritative.",
      },
      personality: { type: "array", items: { type: "string" }, description: "Personality traits, e.g. ['Bold','Innovative','Approachable']." },
      keywords: { type: "array", items: { type: "string" }, description: "SEO / brand keywords." },
      hashtags: { type: "array", items: { type: "string" }, description: "Brand hashtags (with or without #)." },
      products: { type: "array", items: { type: "string" }, description: "Products / services offered." },
      colors: {
        type: "object",
        description: "Brand colors as hex strings.",
        properties: {
          primary: { type: "string" },
          secondary: { type: "string" },
          accent: { type: "string" },
        },
      },
      handles: {
        type: "object",
        description: "Social handles (username, no URL).",
        properties: {
          instagram: { type: "string" }, twitter: { type: "string" }, linkedin: { type: "string" },
          facebook: { type: "string" }, youtube: { type: "string" }, tiktok: { type: "string" },
        },
      },
      email: { type: "string", description: "Contact email." },
      phone: { type: "string", description: "Contact phone." },
      website: { type: "string", description: "Website URL." },
      address: { type: "string", description: "Street address." },
      city: { type: "string", description: "City." },
      state: { type: "string", description: "State / region." },
      zip: { type: "string", description: "Postal code." },
      country: { type: "string", description: "Country." },
      preferredLanguage: { type: "string", description: "BCP-47 output language for all AI, e.g. 'en', 'fr'." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_BRAND_IDENTITY",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      // Load the existing default kit (or most recent) so we MERGE rather than
      // wipe — omitted fields keep their current value.
      const existing = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });

      const parseArr = (json: string | null | undefined): string[] => {
        if (!json) return [];
        try { const p = JSON.parse(json); return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
      };
      const parseObj = (json: string | null | undefined): Record<string, string> => {
        if (!json) return {};
        try { const p = JSON.parse(json); return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, string>) : {}; } catch { return {}; }
      };

      // For a string field: use the provided value when the key is present,
      // else keep the existing one. `has` distinguishes "omitted" from "clear".
      const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
      const mergeStr = (k: string, current: string | null): string | null => (has(k) ? (str(input[k]) || null) : current);
      const mergeArr = (k: string, current: string[]): string[] => {
        const next = strArr(input[k]);
        return has(k) && next ? next : current;
      };

      const changed: string[] = [];
      const track = (k: string) => { if (has(k)) changed.push(k); };

      const name = mergeStr("name", existing?.name ?? null) ?? existing?.name ?? "My Brand";

      let voiceTone = existing?.voiceTone ?? null;
      if (has("voiceTone")) {
        const v = str(input.voiceTone).toLowerCase();
        if (v && VOICE_TONES.has(v)) { voiceTone = v; changed.push("voiceTone"); }
      }

      const colors = { ...parseObj(existing?.colors), ...(input.colors && typeof input.colors === "object" && !Array.isArray(input.colors) ? input.colors as Record<string, string> : {}) };
      const handles = { ...parseObj(existing?.handles), ...(input.handles && typeof input.handles === "object" && !Array.isArray(input.handles) ? input.handles as Record<string, string> : {}) };
      if (has("colors")) changed.push("colors");
      if (has("handles")) changed.push("handles");

      ["name", "tagline", "description", "industry", "niche", "targetAudience", "audienceAge", "audienceLocation", "uniqueValue", "email", "phone", "website", "address", "city", "state", "zip", "country", "preferredLanguage", "personality", "keywords", "hashtags", "products"].forEach(track);

      const data = {
        name,
        tagline: mergeStr("tagline", existing?.tagline ?? null),
        description: mergeStr("description", existing?.description ?? null),
        industry: mergeStr("industry", existing?.industry ?? null),
        niche: mergeStr("niche", existing?.niche ?? null),
        targetAudience: mergeStr("targetAudience", existing?.targetAudience ?? null),
        audienceAge: mergeStr("audienceAge", existing?.audienceAge ?? null),
        audienceLocation: mergeStr("audienceLocation", existing?.audienceLocation ?? null),
        uniqueValue: mergeStr("uniqueValue", existing?.uniqueValue ?? null),
        voiceTone,
        personality: JSON.stringify(mergeArr("personality", parseArr(existing?.personality))),
        keywords: JSON.stringify(mergeArr("keywords", parseArr(existing?.keywords))),
        hashtags: JSON.stringify(mergeArr("hashtags", parseArr(existing?.hashtags))),
        products: JSON.stringify(mergeArr("products", parseArr(existing?.products))),
        colors: JSON.stringify(colors),
        handles: JSON.stringify(handles),
        email: mergeStr("email", existing?.email ?? null),
        phone: mergeStr("phone", existing?.phone ?? null),
        website: mergeStr("website", existing?.website ?? null),
        address: mergeStr("address", existing?.address ?? null),
        city: mergeStr("city", existing?.city ?? null),
        state: mergeStr("state", existing?.state ?? null),
        zip: mergeStr("zip", existing?.zip ?? null),
        country: mergeStr("country", existing?.country ?? null),
        preferredLanguage: mergeStr("preferredLanguage", existing?.preferredLanguage ?? "en") ?? "en",
        isDefault: true,
      };

      const isComplete = !!(data.name && data.industry && data.targetAudience && data.voiceTone);

      const kit = existing
        ? await prisma.brandKit.update({ where: { id: existing.id }, data: { ...data, isComplete }, select: { id: true } })
        : await prisma.brandKit.create({ data: { ...data, isComplete, userId: ctx.userId }, select: { id: true } });

      const fieldList = [...new Set(changed)].filter((c) => c !== "name" || !existing);
      return {
        ok: true,
        data: {
          saved: true,
          brandName: name,
          updatedFields: fieldList,
          summary: `${existing ? "Updated" : "Created"} the brand kit for "${name}"${fieldList.length ? ` (${fieldList.join(", ")})` : ""}. The Brand surface now shows it. Confirm to the user in ONE short sentence what you set; do not re-list every field. If anything still needs the user's own input (logo, exact colors, contact details), mention it briefly as optional.`,
          link: "/home/brand",
        },
        resultRefType: "BrandKit",
        resultRefId: kit.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to update brand kit",
      };
    }
  },
};
