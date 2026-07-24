import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import { generateDeck, parseDeck, deckSlideCount, deckImageCount } from "@/lib/training/deck";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService } from "@/lib/credits";
import type { TrainingDeck, DeckSlide } from "@/lib/training/types";

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
    /** insert a NEW AI-generated slide right after this slide id (fits it into the deck). */
    insertAfterSlideId?: string;
    /** rebuild the WHOLE deck in place (new content-aware layouts), keeping the presenter. */
    rebuild?: boolean;
  };

  // ---- rebuild the ENTIRE deck in place (re-run the generator for all slides) ----
  if (body.materialId && body.rebuild) {
    const mat = await prisma.trainingMaterial.findFirst({ where: { id: body.materialId, sessionId: id }, select: { id: true, deck: true } });
    if (!mat?.deck) return err("That deck no longer exists", 404);
    const prev = parseDeck(mat.deck);
    const room = await prisma.trainingSession.findUnique({ where: { id }, select: { plannedMins: true, brief: true } });
    const brief = (body.brief || room?.brief || "").trim();
    if (brief.length < 8) return err("Add a session brief first so the agent knows what to rebuild.");
    const minutes = room?.plannedMins ?? undefined;
    // keep the original faces/visual choices unless the client overrides them
    const hadBoard = prev.slides.some((s) => s.type === "whiteboard" || s.type === "livedraw");
    const hadImg = prev.slides.some((s) => s.visual?.kind === "image");

    const session = await getSession();
    const n = deckSlideCount(body.slideCount, minutes);
    const [DECK_BASE, DECK_IMG] = await Promise.all([getDynamicCreditCost("TRAINING_DECK_BASE"), getDynamicCreditCost("TRAINING_DECK_IMAGE")]);
    const maxCharge = DECK_BASE + ((body.wantVisuals ?? hadImg) ? n * DECK_IMG : 0);
    if (session) {
      const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: maxCharge, description: "Training Room: rebuild presentation", referenceType: "training_deck", referenceId: id });
      if (!charge.success) return err(charge.error || "Not enough credits to rebuild the presentation", 402);
    }
    const refund = async (amount: number) => { if (session && amount > 0) await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount, description: "Refund: unused rebuild credits", referenceType: "training_deck", referenceId: id }).catch(() => {}); };

    const fresh = await generateDeck({ brief, sessionId: id, wantDoc: body.wantDoc ?? true, wantWhiteboard: body.wantWhiteboard ?? hadBoard, wantVisuals: body.wantVisuals ?? hadImg, slideCount: body.slideCount, minutes });
    if (!fresh?.slides.length) { await refund(maxCharge); return err("Couldn't rebuild the deck — try again.", 502); }
    await refund(maxCharge - (DECK_BASE + deckImageCount(fresh) * DECK_IMG));

    // New slides (new ids) → the old narration + moment videos no longer match, so clear the
    // voice stamp (the builder will prompt a re-narrate). Keep the presenter + its deck-level
    // intro/outro/loop videos (still valid) and the deck's visual style / hand defaults.
    const merged: TrainingDeck = {
      ...fresh,
      presenterId: prev.presenterId ?? null,
      presenterActive: prev.presenterActive ?? false,
      presenterVideoUrl: prev.presenterVideoUrl ?? null,
      introVideoUrl: prev.introVideoUrl ?? null,
      outroVideoUrl: prev.outroVideoUrl ?? null,
      visualStyle: prev.visualStyle ?? fresh.visualStyle,
      handStyle: prev.handStyle,
      voiceKey: null,
    };
    const title = fresh.slides[0]?.title?.slice(0, 80) || "Training deck";
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(merged), pages: fresh.slides.length, name: title } });
    const dto = await getSessionDTO(id);
    return NextResponse.json({ success: true, data: { session: dto, materialId: mat.id } });
  }

  // ---- regenerate a single slide ----
  if (body.materialId && body.regenerateSlideId) {
    const mat = await prisma.trainingMaterial.findFirst({ where: { id: body.materialId, sessionId: id } });
    if (!mat?.deck) return err("That deck no longer exists", 404);
    const deck = parseDeck(mat.deck);
    const idx = deck.slides.findIndex((s) => s.id === body.regenerateSlideId);
    if (idx < 0) return err("That slide isn't in the deck", 404);
    const cur = deck.slides[idx];
    const instr = (body.instruction || "").trim();
    const directive = instr
      ? instr
      : "Redesign this training slide with a DISTINCTLY different treatment — a fresh structure, angle and wording. Keep the same teaching point and topic, but do NOT reproduce the current layout or phrasing.";
    const one = await generateDeck({
      brief: `${directive}. Slide title: "${cur.title}". The slide currently covers: ${cur.subtitle || ""} ${(cur.bullets || []).join("; ")}. Produce a clearly different, better version of this one teaching moment.`,
      sessionId: id,
      wantDoc: cur.type === "doc",
      wantWhiteboard: cur.type === "whiteboard" || cur.type === "livedraw",
      wantVisuals: cur.type === "doc" && cur.visual?.kind === "image",
      slideCount: 3,
      variation: true,
    });
    // generateDeck WEAVES in interaction slides (intro / moments / Q&A); skip those so we grab the
    // real CONTENT slide, never the auto-prepended intro (that duplicated the Welcome slide).
    const isContent = (s: DeckSlide) => !s.intro && !s.presenterMoment && !s.qa && !s.quiz;
    const fresh = one?.slides.find((s) => s.type === deck.slides[idx].type && isContent(s)) ?? one?.slides.find(isContent);
    if (!fresh) return err("Couldn't regenerate that slide — try again", 502);
    deck.slides[idx] = { ...fresh, id: deck.slides[idx].id };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck), pages: deck.slides.length } });
    const dto = await getSessionDTO(id);
    return NextResponse.json({ success: true, data: { session: dto, materialId: mat.id } });
  }

  // ---- insert a NEW slide that fits the deck (from a plain-words prompt) ----
  if (body.materialId && body.insertAfterSlideId) {
    const mat = await prisma.trainingMaterial.findFirst({ where: { id: body.materialId, sessionId: id } });
    if (!mat?.deck) return err("That deck no longer exists", 404);
    const deck = parseDeck(mat.deck);
    const after = deck.slides.findIndex((s) => s.id === body.insertAfterSlideId);
    if (after < 0) return err("That slide isn't in the deck", 404);
    const nearby = deck.slides.slice(Math.max(0, after - 1), after + 2).map((s) => s.title).filter(Boolean).join(" → ");
    const topic = deck.slides.map((s) => s.title).filter(Boolean).slice(0, 8).join("; ");
    const instr = (body.instruction || "").trim();
    const one = await generateDeck({
      brief: `${instr || "Add one more helpful teaching slide that advances the training."}. This is ONE NEW slide to INSERT into an existing training presentation, right after the slide titled "${deck.slides[after].title || "(untitled)"}". The training covers: ${topic}. Nearby slides: ${nearby}. Make it fit NATURALLY into the flow — match the tone and depth, and do NOT repeat the neighbouring slides.`,
      sessionId: id,
      wantDoc: true,
      wantWhiteboard: false,
      wantVisuals: body.wantVisuals !== false,
      slideCount: 3,
      variation: true,
    });
    // Skip the auto-woven interaction slides (intro / moment / Q&A) generateDeck prepends — grab the
    // real content slide, so "add slide" never inserts a duplicate Welcome/intro.
    const fresh = one?.slides.find((s) => s.type === "doc" && !s.intro && !s.presenterMoment && !s.qa && !s.quiz) ?? one?.slides.find((s) => !s.intro && !s.presenterMoment && !s.qa && !s.quiz);
    if (!fresh) return err("Couldn't create that slide — try again", 502);
    const newId = `s_${Math.random().toString(36).slice(2, 10)}`;
    deck.slides.splice(after + 1, 0, { ...fresh, id: newId });
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck), pages: deck.slides.length } });
    const dto = await getSessionDTO(id);
    return NextResponse.json({ success: true, data: { session: dto, materialId: mat.id, newSlideId: newId } });
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
  // Admin-tunable (was hardcoded deck-cost.ts constants; client estimate still
  // uses the deck-cost.ts defaults, which match these keys' defaults 12/15).
  const [DECK_BASE, DECK_IMG] = await Promise.all([
    getDynamicCreditCost("TRAINING_DECK_BASE"),
    getDynamicCreditCost("TRAINING_DECK_IMAGE"),
  ]);
  const maxCharge = DECK_BASE + (body.wantVisuals !== false ? n * DECK_IMG : 0);
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
  const actualCharge = DECK_BASE + deckImageCount(deck) * DECK_IMG;
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

  const mat = await prisma.trainingMaterial.findFirst({ where: { id: body.materialId, sessionId: id }, select: { id: true, deck: true } });
  if (!mat) return err("That deck no longer exists", 404);

  // The deck has TWO writers: this client autosave, and the server routes (iv-moment / narrate)
  // that write generated MEDIA (intro/outro/moment videos, narration audio, loop, voiceKey)
  // directly. A stale client save must never wipe that media — so MERGE against the stored deck:
  // the client owns the content (text, order, presenter on/off), but any server-generated field
  // the client didn't send is preserved. (Dropping intro/outro here is what wiped fresh videos:
  // the old rebuild only kept presenterId/presenterActive/presenterVideoUrl.)
  const prev = parseDeck(mat.deck);
  const prevSlides = new Map(prev.slides.map((s) => [s.id, s]));
  const slides = body.deck.slides.slice(0, 40).map((s) => {
    const p = prevSlides.get(s.id);
    if (!p) return s;
    return {
      ...s,
      momentVideoUrl: s.momentVideoUrl ?? p.momentVideoUrl,
      momentScript: s.momentScript ?? p.momentScript,
      narration: s.narration ?? p.narration,
      quizReveal: s.quizReveal ?? p.quizReveal,
      videoUrl: s.videoUrl ?? p.videoUrl,
      infographic: s.infographic ?? p.infographic,
    };
  });
  const deck: TrainingDeck = {
    v: 1,
    slides,
    presenterId: body.deck.presenterId ?? prev.presenterId ?? null,
    presenterActive: body.deck.presenterActive ?? prev.presenterActive ?? false,
    presenterVideoUrl: body.deck.presenterVideoUrl ?? prev.presenterVideoUrl ?? null,
    introVideoUrl: body.deck.introVideoUrl ?? prev.introVideoUrl ?? null,
    outroVideoUrl: body.deck.outroVideoUrl ?? prev.outroVideoUrl ?? null,
    voiceKey: body.deck.voiceKey ?? prev.voiceKey ?? null,
    visualStyle: body.deck.visualStyle ?? prev.visualStyle,
    handStyle: body.deck.handStyle ?? prev.handStyle,
    boardStyle: body.deck.boardStyle ?? prev.boardStyle,
    presenterFit: body.deck.presenterFit ?? prev.presenterFit,
  };
  await prisma.trainingMaterial.update({
    where: { id: mat.id },
    data: { deck: JSON.stringify(deck), pages: Math.max(1, slides.length), name: slides[0]?.title?.slice(0, 80) || "Training deck" },
  });
  const dto = await getSessionDTO(id);
  return NextResponse.json({ success: true, data: { session: dto } });
}
