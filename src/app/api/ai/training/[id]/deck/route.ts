import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import { generateDeck, parseDeck, deckSlideCount, deckImageCount } from "@/lib/training/deck";
import { DECK_BASE_CREDITS, DECK_IMAGE_CREDITS } from "@/lib/training/deck-cost";
import { creditService } from "@/lib/credits";
import type { TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300; // deck + illustrations can take a bit
// Generation cost basis lives in deck-cost.ts so the client estimate and the server
// charge stay in lock-step: base (AI outline + deterministic diagrams) + one image
// per document slide that carries a generated visual.

async function guard(id: string) {
  const session = await getSession();
  if (!session) return { err: err("Unauthorized", 401) } as const;
  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role || !canControlRoom({ role: access.role })) {
    return { err: err("Only a host can build a presentation", 403) } as const;
  }
  return { ok: true } as const;
}

/**
 * POST — build a presentation deck from a brief (or regenerate a slide).
 *
 * { brief, wantDoc?, wantWhiteboard?, wantVisuals?, slideCount? }
 *   → generate a new deck, store it as a `slides` material, return the session.
 * { materialId, regenerateSlideId, instruction? }
 *   → regenerate one slide of an existing deck. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.err) return g.err;

  const body = (await request.json().catch(() => ({}))) as {
    brief?: string;
    wantDoc?: boolean;
    wantWhiteboard?: boolean;
    wantVisuals?: boolean;
    slideCount?: number;
    materialId?: string;
    regenerateSlideId?: string;
    instruction?: string;
  };

  // ---- regenerate a single slide ----
  if (body.materialId && body.regenerateSlideId) {
    const mat = await prisma.trainingMaterial.findFirst({ where: { id: body.materialId, sessionId: id } });
    if (!mat?.deck) return err("That deck no longer exists", 404);
    const deck = parseDeck(mat.deck);
    const idx = deck.slides.findIndex((s) => s.id === body.regenerateSlideId);
    if (idx < 0) return err("That slide isn't in the deck", 404);
    const one = await generateDeck({
      brief: `${body.instruction || "Rewrite this training slide, keeping it on-topic"}. Slide title: "${deck.slides[idx].title}". Context: ${deck.slides[idx].subtitle || ""} ${(deck.slides[idx].bullets || []).join("; ")}`,
      sessionId: id,
      wantDoc: deck.slides[idx].type === "doc",
      wantWhiteboard: deck.slides[idx].type === "whiteboard",
      wantVisuals: deck.slides[idx].type === "doc" && deck.slides[idx].visual?.kind === "image",
      slideCount: 3,
    });
    const fresh = one?.slides.find((s) => s.type === deck.slides[idx].type) ?? one?.slides[0];
    if (!fresh) return err("Couldn't regenerate that slide — try again", 502);
    deck.slides[idx] = { ...fresh, id: deck.slides[idx].id };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck), pages: deck.slides.length } });
    const dto = await getSessionDTO(id);
    return NextResponse.json({ success: true, data: { session: dto, materialId: mat.id } });
  }

  // ---- generate a fresh deck ----
  const session = await getSession();
  const brief = (body.brief || "").trim();
  if (brief.length < 8) return err("Tell the agent what the session is about first.");

  // Scale the deck to the session length so a 45-min room isn't a 5-min deck.
  const room = await prisma.trainingSession.findUnique({ where: { id }, select: { plannedMins: true } });
  const minutes = room?.plannedMins ?? undefined;

  // Charge the MAX up front (every slide could carry an image), then refund the
  // unused part once we know how many illustrations were actually generated. The
  // number the client showed as "Estimated generation" is this same basis.
  const n = deckSlideCount(body.slideCount, minutes);
  const maxCharge = DECK_BASE_CREDITS + (body.wantVisuals !== false ? n * DECK_IMAGE_CREDITS : 0);
  if (session) {
    const charge = await creditService.deductCredits({
      userId: session.userId, type: "USAGE", amount: maxCharge,
      description: "Training Room: AI presentation", referenceType: "training_deck", referenceId: id,
    });
    if (!charge.success) return err(charge.error || "Not enough credits to build the presentation", 402);
  }
  const refund = async (amount: number) => {
    if (session && amount > 0) await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount, description: "Refund: unused presentation credits", referenceType: "training_deck", referenceId: id }).catch(() => {});
  };

  const deck = await generateDeck({
    brief,
    sessionId: id,
    wantDoc: body.wantDoc,
    wantWhiteboard: body.wantWhiteboard,
    wantVisuals: body.wantVisuals,
    slideCount: body.slideCount,
    minutes,
  });
  if (!deck?.slides.length) { await refund(maxCharge); return err("The agent couldn't build a deck from that — add a little more detail.", 502); }

  // Refund the difference between the max and what was really generated.
  const actualCharge = DECK_BASE_CREDITS + deckImageCount(deck) * DECK_IMAGE_CREDITS;
  await refund(maxCharge - actualCharge);

  const title = deck.slides[0]?.title?.slice(0, 80) || "Training deck";
  const mat = await prisma.trainingMaterial.create({
    data: { sessionId: id, name: title, kind: "slides", url: "", pages: deck.slides.length, deck: JSON.stringify(deck) },
    select: { id: true },
  });

  const dto = await getSessionDTO(id);
  return NextResponse.json({ success: true, data: { session: dto, materialId: mat.id } });
}

/** PATCH — save inline edits / reorder / add / delete slides. { materialId, deck } */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.err) return g.err;

  const body = (await request.json().catch(() => ({}))) as { materialId?: string; deck?: TrainingDeck };
  if (!body.materialId || !body.deck?.slides) return err("Nothing to save");

  const mat = await prisma.trainingMaterial.findFirst({ where: { id: body.materialId, sessionId: id }, select: { id: true } });
  if (!mat) return err("That deck no longer exists", 404);

  const slides = body.deck.slides.slice(0, 40);
  // Preserve the presenter wiring (which lives on the deck, not the slides) — dropping
  // it here is what made narration say "add a presenter first" and left the co-host out
  // of the live room even though the UI showed one active.
  const deck: TrainingDeck = {
    v: 1,
    slides,
    presenterId: body.deck.presenterId ?? null,
    presenterActive: body.deck.presenterActive ?? false,
    presenterVideoUrl: body.deck.presenterVideoUrl ?? null,
  };
  await prisma.trainingMaterial.update({
    where: { id: mat.id },
    data: { deck: JSON.stringify(deck), pages: Math.max(1, slides.length), name: slides[0]?.title?.slice(0, 80) || "Training deck" },
  });
  const dto = await getSessionDTO(id);
  return NextResponse.json({ success: true, data: { session: dto } });
}
