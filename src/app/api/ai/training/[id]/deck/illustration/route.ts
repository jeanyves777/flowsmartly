import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { parseDeck } from "@/lib/training/deck";
import { getSessionDTO } from "@/lib/training/session";
import { INFOGRAPHIC_ICONS, INFOGRAPHIC_LAYOUTS } from "@/lib/training/types";
import type { TrainingDeck, SlideInfographic, InfographicCard, InfographicLayout } from "@/lib/training/types";

const err = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
export const maxDuration = 60;

const ICONSET = new Set<string>(INFOGRAPHIC_ICONS as readonly string[]);
const strip = (s: unknown) => String(s ?? "").replace(/\*\*|__|`|#+/g, "").trim();
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * POST /api/ai/training/[id]/deck/illustration — generate an AGENT-AUTHORED animated illustration
 * for a slide: the model designs an infographic spec (hub / flow / grid / compare of cards with
 * icons + connectors) from the slide's content; the renderer draws + animates it in step with the
 * narration. On-subject and cheap (one text call — no image/video engine). { materialId, slideId }.
 * [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;
  const { materialId, slideId } = (await request.json().catch(() => ({}))) as { materialId?: string; slideId?: string };
  if (!materialId || !slideId) return err("Nothing to illustrate");

  const mat = await prisma.trainingMaterial.findFirst({ where: { id: materialId, session: { id, userId: session.userId } }, select: { id: true, deck: true } });
  if (!mat?.deck) return err("That deck no longer exists", 404);
  const deck: TrainingDeck = parseDeck(mat.deck);
  const idx = deck.slides.findIndex((s) => s.id === slideId);
  if (idx < 0) return err("That slide isn't in the deck", 404);
  const slide = deck.slides[idx];
  const brief = `Title: "${slide.title}". Subtitle: "${slide.subtitle || ""}". Teaching points: ${(slide.bullets || []).join(" | ")}. Notes: ${slide.notes || ""}`.slice(0, 1200);

  const prompt = `Design a clean, MODERN INFOGRAPHIC that TEACHES the concept on this training slide (a real diagram that illustrates it — not decoration). Return ONLY JSON:
{
  "layout": "hub" | "flow" | "grid" | "compare",
  "caption": "one short supporting line",
  "center": { "icon": "<icon>", "label": "1-2 words" },   // HUB only — the middle node
  "cards": [ { "icon": "<icon>", "title": "1-3 words", "desc": "3-7 words", "color": "#RRGGBB" } ],  // 2-6 cards
  "footer": "one short closing line"
}
Rules:
- Choose "layout" by the concept: hub = a central thing with facets / tools / capabilities radiating out; flow = a step-by-step process (order matters); grid = a set of parallel items; compare = two sides / before vs after.
- "icon" MUST be one of: ${(INFOGRAPHIC_ICONS as readonly string[]).join(", ")}. Pick the most fitting icon for each card (e.g. calculator for math, database for data, globe/search for the web, workflow/link for chaining).
- Titles 1-3 words, desc 3-7 words. Concrete and SPECIFIC to this subject. No markdown, no emojis.
- "color": a vivid distinct hex per card (vary the hues — blues, greens, violets, oranges, pinks).
- 3-4 cards is ideal.

"""${brief}"""`;

  let raw: Partial<SlideInfographic> | null = null;
  try { raw = await ai.generateJSON<SlideInfographic>(prompt, { temperature: 0.6, maxTokens: 1400 }); } catch { raw = null; }
  const cardsIn = Array.isArray(raw?.cards) ? raw!.cards : [];
  const cards: InfographicCard[] = cardsIn.slice(0, 6).map((c) => ({
    icon: c && ICONSET.has(String((c as InfographicCard).icon)) ? String((c as InfographicCard).icon) : "sparkles",
    title: strip((c as InfographicCard)?.title).slice(0, 40) || "Point",
    desc: strip((c as InfographicCard)?.desc).slice(0, 90) || undefined,
    color: HEX.test(String((c as InfographicCard)?.color || "")) ? String((c as InfographicCard).color) : undefined,
  })).filter((c) => c.title);
  if (cards.length < 2) return err("Couldn't design an illustration for this slide — try regenerating it, or add more points", 502);

  const layout: InfographicLayout = (INFOGRAPHIC_LAYOUTS as readonly string[]).includes(String(raw?.layout)) ? (raw!.layout as InfographicLayout) : "hub";
  const spec: SlideInfographic = {
    layout,
    caption: strip(raw?.caption).slice(0, 120) || undefined,
    center: layout === "hub" ? { icon: raw?.center && ICONSET.has(String(raw.center.icon)) ? String(raw.center.icon) : "bot", label: strip(raw?.center?.label).slice(0, 24) || undefined } : undefined,
    cards,
    footer: strip(raw?.footer).slice(0, 120) || undefined,
  };

  // steps = card count so the presenter (Preview + live room) reveals the cards one by one in step
  // with the narration.
  deck.slides[idx] = { ...slide, infographic: spec, visualType: "diagram", videoUrl: undefined, steps: Math.max(1, spec.cards.length) };
  await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });
  return NextResponse.json({ success: true, data: { slideId, infographic: spec, session: await getSessionDTO(id) } });
}
