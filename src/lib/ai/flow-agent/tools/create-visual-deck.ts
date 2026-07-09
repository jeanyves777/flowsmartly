import { prisma } from "@/lib/db/client";
import { ai, HAIKU_MODEL } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { getUserPreferredLanguage, languageDirective } from "@/lib/ai/user-language";
import { attachProposalLibraryVisuals } from "@/lib/pitch/proposal-asset-library";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import type { ProposalDeckPlan } from "@/lib/pitch/proposal-deck-types";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";
import type { FlowAgentTool } from "../registry";

type Material = {
  id?: string;
  title?: string;
  sourceType?: string;
  type?: string;
  url?: string;
  details?: string;
};
type ResolvedMaterial = Material & { title: string; url: string };

type VisualDeckBrandKit = {
  id: string;
  name: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  niche: string | null;
  targetAudience: string | null;
  voiceTone: string | null;
  uniqueValue: string | null;
  colors: string | null;
  fonts: string | null;
  products: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

/**
 * create_visual_deck - custom branded visual deck creation from the user's
 * prompt plus existing images/designs/materials. It saves into Pitch Studio as
 * a visual service proposal so the existing inline editor, PDF download, and
 * send_proposal pipeline all work.
 */
export const createVisualDeck: FlowAgentTool = {
  name: "create_visual_deck",
  description:
    "Build a fully branded VISUAL DECK presentation from the user's description and/or selected existing images, designs, media, materials, or previous pitch content. Use after list_visual_deck_materials when the user clicks an item, or directly when the user clearly provided/uploaded the assets. Creates a Pitch Studio visual deck, drafts a matching cold email subject/summary, shows the full inline deck card, and supports PDF download/send. Mutating: pass planId from a confirmed propose_plan. If the user is vague about which existing assets to use, call list_visual_deck_materials first.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED - planId from a confirmed propose_plan." },
      brief: { type: "string", description: "What the deck should communicate, who it is for, and what outcome it should drive." },
      title: { type: "string", description: "Optional deck title." },
      targetName: { type: "string", description: "Optional audience/prospect/client name. Defaults to a general branded presentation." },
      recipientEmail: { type: "string", description: "Optional recipient email to save on the pitch for later sending." },
      recipientName: { type: "string", description: "Optional recipient/person name." },
      sourceIds: { type: "array", items: { type: "string" }, description: "Optional mediaFile/design ids to use as deck material." },
      sourceUrls: { type: "array", items: { type: "string" }, description: "Optional image URLs to use as deck material." },
      materials: {
        type: "array",
        description: "Optional materials selected from the picker. Each may include id, title, sourceType, url, details.",
        items: { type: "object" },
      },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  autoPlanCost: async () => {
    const credits = await getDynamicCreditCost("AI_SERVICE_PROPOSAL");
    return { credits, label: "Create custom visual deck", detail: "Builds a branded Pitch Studio visual deck with PDF/email actions." };
  },
  handler: async (input, ctx) => {
    try {
      const brief = clean(input.brief, 4000) || "Create a branded visual deck presentation from the selected materials.";
      const targetName = clean(input.targetName, 180) || "Visual Deck Presentation";
      const explicitTitle = clean(input.title, 180);
      const recipientEmail = clean(input.recipientEmail, 200) || undefined;
      const recipientName = clean(input.recipientName, 120) || undefined;

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true, name: true, tagline: true, description: true, industry: true,
          niche: true, targetAudience: true, voiceTone: true, uniqueValue: true,
          colors: true, fonts: true, products: true, email: true, phone: true,
          website: true, address: true, city: true, state: true, country: true,
        },
      });
      if (!brandKit?.name) {
        return {
          ok: false,
          error_code: "missing_brand_kit",
          message: "No Brand Kit configured. Ask the user for a one-line business description and set up the Brand Kit first.",
        };
      }

      const cost = await getDynamicCreditCost("AI_SERVICE_PROPOSAL");
      if (!ctx.isAdmin) {
        const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
        if ((user?.aiCredits ?? 0) < cost) {
          return {
            ok: false,
            error_code: "insufficient_credits",
            message: `A custom visual deck costs ${cost} credits. User has ${user?.aiCredits ?? 0}.`,
            meta: { need: cost, have: user?.aiCredits ?? 0 },
          };
        }
      }

      const picked = await resolveMaterials(ctx.userId, input);

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "create_visual_deck",
        input: { targetName, title: explicitTitle, materialCount: picked.length },
        creditCost: cost,
        worker: async (taskId) => {
          publishTaskEvent({ type: "progress", taskId, progress: 15, message: "Reading brand + selected materials..." });

          const language = await getUserPreferredLanguage(ctx.userId);
          const proposal = await draftDeckContent({
            brief,
            targetName,
            title: explicitTitle,
            brandKit,
            materials: picked,
            language,
          });

          publishTaskEvent({ type: "progress", taskId, progress: 70, message: "Laying out the visual deck..." });

          let content: ServiceProposalContent & { studioDocType?: "visual" } = {
            ...proposal,
            studioDocType: "visual",
            visualAssets: picked.length > 0
              ? {
                  generatedAt: new Date().toISOString(),
                  images: picked.slice(0, 6).map((m, i) => ({
                    kind: i === 0 ? "cover" : i === 1 ? "about" : "impact",
                    url: m.url,
                    alt: m.title || `Visual material ${i + 1}`,
                    provider: "user-material",
                    prompt: m.details || m.title || brief,
                  })),
                }
              : proposal.visualAssets,
            deckPlan: makeDeckPlan(proposal, picked),
          };

          if (!content.visualAssets?.images?.length) {
            try {
              content = await attachProposalLibraryVisuals({
                targetName,
                serviceTitle: content.serviceTitle,
                proposal: content,
                brandKit,
              }) as ServiceProposalContent & { studioDocType?: "visual" };
              content.studioDocType = "visual";
              content.deckPlan = makeDeckPlan(content, picked);
            } catch (e) {
              console.warn("[create_visual_deck] visual fallback failed:", e);
            }
          }

          const pitch = await prisma.pitch.create({
            data: {
              userId: ctx.userId,
              businessName: targetName,
              recipientEmail: recipientEmail ?? null,
              recipientName: recipientName ?? null,
              documentType: "service_proposal",
              status: "READY",
              research: JSON.stringify({
                documentType: "service_proposal",
                builderType: "visual-sales-deck",
                generatedAt: new Date().toISOString(),
                source: "flow_ai_visual_deck",
                materialCount: picked.length,
              }),
              pitchContent: JSON.stringify(content),
            },
            select: { id: true },
          });

          if (!ctx.isAdmin && cost > 0) {
            const u = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
            const before = u?.aiCredits ?? 0;
            await prisma.$transaction([
              prisma.user.update({ where: { id: ctx.userId }, data: { aiCredits: { decrement: cost } } }),
              prisma.creditTransaction.create({
                data: {
                  userId: ctx.userId,
                  type: "USAGE",
                  amount: -cost,
                  balanceAfter: before - cost,
                  referenceType: "ai_service_proposal",
                  referenceId: pitch.id,
                  description: `Flow-AI visual deck: ${targetName}`,
                },
              }),
            ]);
          }

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "create_visual_deck",
            ok: true,
            summary: `Your visual deck for ${targetName} is ready`,
            detail: "Review, edit, download, or send it from the inline card.",
            deepLink: `/home/pitchstudio?pitch=${pitch.id}`,
          });

          return {
            output: { pitchId: pitch.id, targetName, link: `/home/pitchstudio?pitch=${pitch.id}` },
            resultRefType: "Pitch",
            resultRefId: pitch.id,
          };
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "create_visual_deck",
        summary: `Building a branded visual deck for ${targetName}. I'll show the full deck card here when it's ready.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          creditCostQuoted: cost,
          materialsUsed: picked.map((m) => ({ title: m.title, url: m.url })).slice(0, 8),
          userMessage: `Started a branded visual deck for ${targetName}. It runs in the background and will render inline when ready.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to create visual deck" };
    }
  },
};

async function resolveMaterials(userId: string, input: Record<string, unknown>): Promise<ResolvedMaterial[]> {
  const fromPicker = Array.isArray(input.materials) ? input.materials : [];
  const pickerMaterials = fromPicker
    .map((m) => normalizeMaterial(m))
    .filter((m): m is Material & { url: string; title: string } => !!m.url && !!m.title);

  const sourceUrls = Array.isArray(input.sourceUrls)
    ? input.sourceUrls.map((u) => clean(u, 800)).filter((u) => /^https?:\/\//i.test(u) || u.startsWith("/"))
    : [];

  const sourceIds = Array.isArray(input.sourceIds) ? input.sourceIds.map((x) => clean(x, 120)).filter(Boolean).slice(0, 24) : [];
  const row = normalizeMaterial((input as { value?: unknown }).value);
  const clicked = row.url ? [row as Material & { url: string; title: string }] : [];

  const [media, designs] = sourceIds.length
    ? await Promise.all([
        prisma.mediaFile.findMany({
          where: { userId, id: { in: sourceIds } },
          select: { id: true, originalName: true, filename: true, url: true, type: true, width: true, height: true },
        }),
        prisma.design.findMany({
          where: { userId, id: { in: sourceIds }, imageUrl: { not: null } },
          select: { id: true, name: true, category: true, size: true, imageUrl: true, type: true },
        }),
      ])
    : [[], []] as const;

  const resolved: Array<Material & { title: string; url: string }> = [
    ...clicked,
    ...pickerMaterials,
    ...sourceUrls.map((url, i) => ({ title: `Reference image ${i + 1}`, url, sourceType: "url" })),
    ...media.map((m) => ({
      id: m.id,
      title: m.originalName || m.filename || "Media image",
      sourceType: "media",
      type: m.type,
      url: m.url,
      details: m.width && m.height ? `${m.width}x${m.height}` : undefined,
    })),
    ...designs.map((d) => ({
      id: d.id,
      title: d.name || "Saved design",
      sourceType: "design",
      type: d.type,
      url: d.imageUrl || "",
      details: [d.category, d.size].filter(Boolean).join(" - "),
    })),
  ].filter((m) => !!m.url);

  const seen = new Set<string>();
  return resolved.filter((m): m is ResolvedMaterial => {
    const key = m.url;
    if (!key || !m.title) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function normalizeMaterial(value: unknown): Material {
  if (!value || typeof value !== "object") return {};
  const o = value as Record<string, unknown>;
  return {
    id: clean(o.id, 120) || undefined,
    title: clean(o.title || o.name, 180) || "Selected material",
    sourceType: clean(o.sourceType, 40) || undefined,
    type: clean(o.type, 40) || undefined,
    url: clean(o.url || o.imageUrl || o.thumb, 900) || undefined,
    details: clean(o.details, 240) || undefined,
  };
}

async function draftDeckContent(input: {
  brief: string;
  targetName: string;
  title: string;
  brandKit: VisualDeckBrandKit;
  materials: ResolvedMaterial[];
  language: string;
}): Promise<ServiceProposalContent> {
  const products = parseArray(input.brandKit.products).slice(0, 8);
  const colors = parseJson<Record<string, string>>(input.brandKit.colors, {});
  const fonts = parseJson<Record<string, string>>(input.brandKit.fonts, {});
  const materialNotes = input.materials.map((m, i) => `${i + 1}. ${m.title}${m.details ? ` (${m.details})` : ""}`).join("\n") || "No user-selected images; choose fitting proposal visuals.";
  const prompt = [
    "Create JSON for a branded visual sales deck stored as ServiceProposalContent.",
    "Return ONLY valid JSON. No markdown.",
    languageDirective(input.language),
    `Brand: ${input.brandKit.name}`,
    `Brand description: ${input.brandKit.description || ""}`,
    `Industry: ${input.brandKit.industry || input.brandKit.niche || ""}`,
    `Voice: ${input.brandKit.voiceTone || "clear, confident, useful"}`,
    `Unique value: ${input.brandKit.uniqueValue || ""}`,
    `Products/services: ${products.join(", ")}`,
    `Deck brief: ${input.brief}`,
    `Audience/prospect: ${input.targetName}`,
    `Selected materials:\n${materialNotes}`,
    "JSON shape: {subject,title,subtitle,serviceTitle,executiveSummary,aboutBrand,clientNeed,commitments:string[4],benefits:string[4],deliverables:[{title,description}],timeline:[{label,title,description}],proofPoints:[{metric,label,note}],pricing:{name,amount,originalAmount,interval,note},terms:string[2],nextSteps:string[4],customSections:[{title,body,bullets:string[]}],design:{themeName,brandVoice,visualStyle,visualMotifs:string[],layoutNotes:string[]}}.",
    "Write a short cold email subject in subject. Keep copy deck-ready: punchy, visual, concise, no placeholders.",
  ].join("\n\n");

  let parsed: Partial<ServiceProposalContent> = {};
  try {
    const raw = await ai.generate(prompt, { model: HAIKU_MODEL, maxTokens: 1800, temperature: 0.45 });
    parsed = parseJsonBlock<Partial<ServiceProposalContent>>(raw, {});
  } catch (e) {
    console.warn("[create_visual_deck] AI draft failed:", e);
  }

  const serviceTitle = clean(parsed.serviceTitle, 180) || input.title || "Custom Visual Deck";
  return {
    documentType: "service_proposal",
    subject: clean(parsed.subject, 180) || `${serviceTitle} for ${input.targetName}`,
    title: clean(parsed.title, 180) || input.title || serviceTitle,
    subtitle: clean(parsed.subtitle, 220) || `Prepared for ${input.targetName}`,
    preparedFor: input.targetName,
    preparedBy: input.brandKit.name || "FlowSmartly",
    builderType: "visual-sales-deck",
    serviceTitle,
    executiveSummary: clean(parsed.executiveSummary, 1200) || `${input.brandKit.name} can turn these materials into a clear, branded story that explains the offer, the proof, and the next step.`,
    aboutBrand: clean(parsed.aboutBrand, 1200) || input.brandKit.description || `${input.brandKit.name} helps customers move from idea to action with branded marketing systems.`,
    clientNeed: clean(parsed.clientNeed, 1200) || input.brief,
    commitments: cleanStringArray(parsed.commitments, 6, ["Clarify the core story", "Shape the materials into a visual narrative", "Package the offer for review", "Prepare a PDF-ready deck"]),
    benefits: cleanStringArray(parsed.benefits, 6, ["A clearer message", "A stronger branded presentation", "Reusable sales material", "A faster path to follow-up"]),
    deliverables: cleanDeliverables(parsed.deliverables),
    timeline: cleanTimeline(parsed.timeline),
    proofPoints: cleanProof(parsed.proofPoints),
    pricing: {
      name: clean(parsed.pricing?.name, 160) || serviceTitle,
      amount: typeof parsed.pricing?.amount === "number" ? parsed.pricing.amount : undefined,
      originalAmount: typeof parsed.pricing?.originalAmount === "number" ? parsed.pricing.originalAmount : undefined,
      interval: clean(parsed.pricing?.interval, 60) || "project",
      note: clean(parsed.pricing?.note, 240) || "Final scope can be adjusted before sending.",
    },
    terms: cleanStringArray(parsed.terms, 4, ["Proposal is valid for 14 days.", "Final timing begins after approval and material access."]),
    nextSteps: cleanStringArray(parsed.nextSteps, 5, ["Review the deck", "Request any edits", "Confirm the recipient", "Send the PDF with the drafted email"]),
    customSections: cleanCustomSections(parsed.customSections),
    contact: {
      name: input.brandKit.name || undefined,
      email: input.brandKit.email || undefined,
      phone: input.brandKit.phone || undefined,
      website: input.brandKit.website || undefined,
      address: [input.brandKit.address, input.brandKit.city, input.brandKit.state, input.brandKit.country].filter(Boolean).join(", ") || undefined,
    },
    design: {
      ...parsed.design,
      themeName: clean(parsed.design?.themeName, 120) || "Branded visual deck",
      brandVoice: clean(parsed.design?.brandVoice, 120) || input.brandKit.voiceTone || undefined,
      visualStyle: clean(parsed.design?.visualStyle, 160) || "Modern visual presentation with strong image-led sections",
      colorPalette: {
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
      },
      typography: {
        headline: fonts.heading,
        body: fonts.body,
      },
    },
    proposalTypes: ["visual-sales-deck"],
    servicePackages: products,
    customAdditions: input.materials.map((m) => m.title),
    brandSnapshot: {
      name: input.brandKit.name,
      tagline: input.brandKit.tagline,
      industry: input.brandKit.industry,
      voiceTone: input.brandKit.voiceTone,
      colors,
      fonts,
      products,
    },
  };
}

function makeDeckPlan(content: ServiceProposalContent, materials: ResolvedMaterial[]): ProposalDeckPlan {
  const visuals = materials.slice(0, 6).map((m, i) => ({
    id: `material-${i + 1}`,
    title: m.title,
    url: m.url,
    role: i === 0 ? "primary" as const : i === 1 ? "secondary" as const : "accent" as const,
    fit: "contain" as const,
  }));
  return {
    generatedBy: "fallback",
    styleSummary: content.design.visualStyle || "Custom branded visual deck",
    styleVariant: "clean-light",
    calloutColor: "primary",
    backgroundStyle: "soft-tint",
    markerStyle: "small-pill",
    copyDensity: "balanced",
    colorUse: "Use brand colors for headings, chips, metric rings, and callout bands.",
    designerNotes: ["Use selected materials as first-class visuals.", "Keep the PDF image-led and easy to scan."],
    selectedAssetIds: visuals.map((v) => v.id),
    slides: [
      { role: "cover", headline: content.title, subhead: content.executiveSummary, layout: "hero-split", visuals },
      { role: "about", headline: "Why this matters", body: content.clientNeed, layout: "visual-right", visuals: visuals.slice(1, 3) },
      { role: "commitments", headline: "What you get", bullets: content.commitments, layout: "two-visuals", visuals: visuals.slice(0, 2) },
      { role: "proof", headline: "Proof and impact", bullets: content.proofPoints.map((p) => `${p.metric} ${p.label}`), layout: "metrics", visuals: visuals.slice(2, 4) },
      { role: "closing", headline: "Next steps", bullets: content.nextSteps, layout: "closing", visuals: visuals.slice(0, 1) },
    ],
  };
}

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function parseArray(raw: string | null | undefined): string[] {
  return parseJson<unknown[]>(raw, []).map((x) => typeof x === "string" ? x : typeof x === "object" && x ? clean((x as Record<string, unknown>).name || (x as Record<string, unknown>).title, 160) : "").filter(Boolean);
}

function parseJsonBlock<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(trimmed) as T; } catch { return fallback; }
}

function cleanStringArray(value: unknown, max: number, fallback: string[]): string[] {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = arr.map((x) => clean(x, 260)).filter(Boolean).slice(0, max);
  return cleaned.length ? cleaned : fallback;
}

function cleanDeliverables(value: unknown): ServiceProposalContent["deliverables"] {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = arr.map((x) => {
    const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
    return { title: clean(o.title, 160), description: clean(o.description, 420) };
  }).filter((x) => x.title && x.description).slice(0, 6);
  return cleaned.length ? cleaned : [
    { title: "Visual deck strategy", description: "A branded presentation structure that turns the selected materials into a clear story." },
    { title: "Image-led proposal PDF", description: "A polished visual deck that can be downloaded or attached to outreach email." },
    { title: "Cold email draft", description: "A concise email subject and opening message aligned with the deck." },
  ];
}

function cleanTimeline(value: unknown): ServiceProposalContent["timeline"] {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = arr.map((x) => {
    const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
    return { label: clean(o.label, 80), title: clean(o.title, 160), description: clean(o.description, 360) };
  }).filter((x) => x.label && x.title).slice(0, 5);
  return cleaned.length ? cleaned : [
    { label: "Step 1", title: "Shape the story", description: "Confirm audience, offer, and key visual direction." },
    { label: "Step 2", title: "Finalize the deck", description: "Apply edits and prepare the PDF-ready visual deck." },
    { label: "Step 3", title: "Send or reuse", description: "Download, email, or use the deck as outreach material." },
  ];
}

function cleanProof(value: unknown): ServiceProposalContent["proofPoints"] {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = arr.map((x) => {
    const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
    return { metric: clean(o.metric, 24), label: clean(o.label, 120), note: clean(o.note, 220) };
  }).filter((x) => x.metric && x.label).slice(0, 4);
  return cleaned.length ? cleaned : [
    { metric: "1", label: "Brand story", note: "One clear narrative for sales follow-up." },
    { metric: "PDF", label: "Ready to send", note: "Downloadable and email-ready from Pitch Studio." },
  ];
}

function cleanCustomSections(value: unknown): ServiceProposalContent["customSections"] {
  const arr = Array.isArray(value) ? value : [];
  return arr.map((x) => {
    const o = x && typeof x === "object" ? x as Record<string, unknown> : {};
    return { title: clean(o.title, 160), body: clean(o.body, 700), bullets: cleanStringArray(o.bullets, 5, []) };
  }).filter((x) => x.title && (x.body || x.bullets.length)).slice(0, 4);
}
