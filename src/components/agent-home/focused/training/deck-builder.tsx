"use client";

/**
 * Training Room — AI Presentation Builder.
 *
 * A plain-words brief becomes a deck of training slides (document + whiteboard).
 * The host edits the text, regenerates a slide, adds/removes slides, then presents
 * the deck on the Slides stage. Everything is stored on a `slides` material so it's
 * shared + paged by the same stage plumbing as an uploaded file. [[training-studio]]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, Play, X, Presentation, Loader2, PenLine, FileText, Bot, Volume2, Film, Settings2, Mic,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { DeckSlideView } from "./deck-slide-view";
import type { DeckSlide, TrainingDeck, TrainingSessionDTO, PresenterProfileDTO } from "@/lib/training/types";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

interface AutoGen { brief: string; wantDoc: boolean; wantWhiteboard: boolean; wantVisuals: boolean; slideCount: number }

export function DeckBuilder({ session, sessionId, autoGen, onAutoConsumed, presenter, onOpenPresenter, onSession, onPresent, onExit }: {
  session: TrainingSessionDTO;
  sessionId: string;
  autoGen?: AutoGen | null;
  onAutoConsumed?: () => void;
  presenter?: PresenterProfileDTO | null;
  onOpenPresenter?: () => void;
  onSession: (s: TrainingSessionDTO) => void;
  onPresent: (materialId: string) => void;
  onExit: () => void;
}) {
  const { toast } = useToast();
  const decks = session.materials.filter((m) => m.kind === "slides" && m.deck?.slides.length);
  const [matId, setMatId] = useState<string | null>(decks[0]?.id ?? null);
  const mat = decks.find((m) => m.id === matId) ?? decks[0] ?? null;
  const [page, setPage] = useState(0);

  // brief step
  const [brief, setBrief] = useState("");
  const [wantDoc, setWantDoc] = useState(true);
  const [wantWb, setWantWb] = useState(true);
  const [wantVis, setWantVis] = useState(true);
  const [busy, setBusy] = useState<null | "gen" | "regen" | "save" | "narrate" | "animate">(null);

  // local working copy of the deck (edits autosave)
  const [deck, setDeck] = useState<TrainingDeck | null>(mat?.deck ?? null);
  useEffect(() => { setDeck(mat?.deck ?? null); }, [mat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const slide = deck?.slides[Math.min(page, (deck?.slides.length ?? 1) - 1)] ?? null;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: TrainingDeck) => {
    if (!mat) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const j = await fetch(`/api/ai/training/${sessionId}/deck`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: mat.id, deck: next }),
      }).then((r) => r.json()).catch(() => null);
      if (j?.data?.session) onSession(j.data.session as TrainingSessionDTO);
    }, 700);
  }, [mat, sessionId, onSession]);

  const editSlide = (patch: Partial<DeckSlide>) => {
    if (!deck || !slide) return;
    const next: TrainingDeck = { ...deck, slides: deck.slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)) };
    setDeck(next); persist(next);
  };

  // The presenter is part of THIS presentation: when one is chosen, record it on the
  // deck; the step in the rail activates/deactivates it.
  useEffect(() => {
    if (!presenter) return;
    setDeck((d) => {
      if (!d) return d;
      // keep the deck in step with the chosen presenter — id AND its moving-avatar clip
      // (which can be generated after the presenter is already selected).
      if (d.presenterId === presenter.id && (d.presenterVideoUrl ?? null) === (presenter.loopVideoUrl ?? null)) return d;
      const next = { ...d, presenterId: presenter.id, presenterVideoUrl: presenter.loopVideoUrl ?? null, presenterActive: d.presenterActive ?? true };
      persist(next);
      return next;
    });
  }, [presenter?.id, presenter?.loopVideoUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPresenterActive = (v: boolean) => {
    setDeck((d) => { if (!d) return d; const next = { ...d, presenterActive: v, presenterId: presenter?.id ?? d.presenterId }; persist(next); return next; });
  };
  // Generate spoken narration for the whole deck in the presenter's voice.
  const narrate = async () => {
    if (!mat) return;
    setBusy("narrate");
    try {
      const j = await fetch("/api/ai/training/presenter/narrate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't generate narration", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      toast({ title: `Narration ready`, description: `${j.data.narrated} slide${j.data.narrated === 1 ? "" : "s"} voiced in your presenter's voice.` });
    } finally { setBusy(null); }
  };
  const narratedCount = deck?.slides.filter((s) => s.narration).length ?? 0;
  // the presenter's moving-avatar loop (deck copy wins; falls back to the profile)
  const loopUrl = deck?.presenterVideoUrl ?? presenter?.loopVideoUrl ?? null;

  // Turn the presenter photo into a looping "moving avatar" for the room.
  const animate = async () => {
    if (!presenter) { onOpenPresenter?.(); return; }
    setBusy("animate");
    try {
      const j = await fetch("/api/ai/training/presenter/animate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presenterId: presenter.id }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't animate the presenter", variant: "destructive" }); return; }
      setDeck((d) => { if (!d) return d; const next = { ...d, presenterVideoUrl: j.data.loopVideoUrl as string }; persist(next); return next; });
      toast({ title: "Your presenter is moving", description: "A looping avatar is ready for the room." });
    } finally { setBusy(null); }
  };

  const generate = async (o?: AutoGen) => {
    const b = (o?.brief ?? brief).trim();
    if (b.length < 8) { toast({ title: "Tell the agent what the session is about first" }); return; }
    setBusy("gen");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: b, wantDoc: o?.wantDoc ?? wantDoc, wantWhiteboard: o?.wantWhiteboard ?? wantWb, wantVisuals: o?.wantVisuals ?? wantVis, slideCount: o?.slideCount }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't build that deck", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      setMatId(j.data.materialId); setPage(0);
      toast({ title: "Deck ready", description: "Edit any slide, then present it." });
    } finally { setBusy(null); }
  };

  // Built from the brief's "Build with AI" tab — draft the deck automatically once.
  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current || !autoGen || mat) return;
    didAuto.current = true;
    setBrief(autoGen.brief); setWantDoc(autoGen.wantDoc); setWantWb(autoGen.wantWhiteboard); setWantVis(autoGen.wantVisuals);
    void generate(autoGen).finally(() => onAutoConsumed?.());
  }, [autoGen, mat]); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerate = async () => {
    if (!mat || !slide) return;
    setBusy("regen");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: mat.id, regenerateSlideId: slide.id }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't regenerate", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
    } finally { setBusy(null); }
  };

  const addSlide = () => {
    if (!deck) return;
    const s: DeckSlide = { id: uid("s"), type: "doc", title: "New slide", subtitle: "", bullets: ["Point one"], visual: { kind: "emoji", emoji: "✨" } };
    const next = { ...deck, slides: [...deck.slides.slice(0, page + 1), s, ...deck.slides.slice(page + 1)] };
    setDeck(next); persist(next); setPage(page + 1);
  };
  const delSlide = () => {
    if (!deck || !slide || deck.slides.length <= 1) return;
    const next = { ...deck, slides: deck.slides.filter((s) => s.id !== slide.id) };
    setDeck(next); persist(next); setPage(Math.max(0, page - 1));
  };

  // ---- building (manual generate or auto from the brief) ----
  if (busy === "gen" && (!mat || !deck)) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-background p-4">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600"><Loader2 className="h-6 w-6 animate-spin text-white" /></span>
          <p className="mt-3 text-[14px] font-extrabold">Drafting your presentation…</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Writing the slides, sketching the diagrams and making the visuals.</p>
        </div>
      </div>
    );
  }

  // ---- brief step (no deck yet) ----
  if (!mat || !deck) {
    return (
      <div className="absolute inset-0 grid place-items-center overflow-auto bg-background p-4">
        <div className="w-full max-w-[640px] rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Presentation className="h-4.5 w-4.5" /></span>
            <div className="flex-1"><h2 className="text-[16px] font-extrabold">AI Presentation Builder</h2><p className="text-[11.5px] text-muted-foreground">Describe the session — the agent builds your slides.</p></div>
            <button onClick={onExit} className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <textarea
            value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. A 20-minute session teaching new reps how to handle the 'it's too expensive' objection — the reframe, a role-play, and a recap."
            className="mt-3 min-h-[130px] w-full resize-y rounded-xl border border-border bg-muted px-3.5 py-3 text-[13px] leading-relaxed outline-none focus:border-brand-500"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Toggle on={wantDoc} onClick={() => setWantDoc((v) => !v)} Icon={FileText} label="Document slides" />
            <Toggle on={wantWb} onClick={() => setWantWb((v) => !v)} Icon={PenLine} label="Whiteboard slides" />
            <Toggle on={wantVis} onClick={() => setWantVis((v) => !v)} Icon={Sparkles} label="Generate visuals" />
          </div>
          <button onClick={() => generate()} disabled={busy === "gen"} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 py-3 text-[14px] font-extrabold text-white disabled:opacity-60">
            {busy === "gen" ? <><Loader2 className="h-4 w-4 animate-spin" /> Building your presentation…</> : <><Sparkles className="h-4 w-4" /> Turn this into meeting materials</>}
          </button>
          {decks.length ? <button onClick={() => setMatId(decks[0].id)} className="mt-2 w-full text-center text-[11.5px] font-semibold text-brand-400">Open your existing deck</button> : null}
        </div>
      </div>
    );
  }

  // ---- builder ----
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="grid min-h-0 flex-1 grid-cols-[176px_1fr] md:grid-cols-[186px_1fr_260px]">
      {/* slides rail */}
      <div className="flex flex-col overflow-hidden border-e border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
          <Presentation className="h-3.5 w-3.5 text-brand-400" /><b className="text-[12px]">Slides</b>
          <span className="ms-auto text-[10.5px] text-muted-foreground">{deck.slides.length}</span>
        </div>
        <div className="flex-1 space-y-2 overflow-auto p-2.5">
          {deck.slides.map((s, i) => (
            <button key={s.id} onClick={() => setPage(i)} className={cn("relative block w-full overflow-hidden rounded-lg border-2", i === page ? "border-brand-500" : "border-transparent hover:border-border")}>
              <div className="aspect-video w-full"><DeckSlideView slide={s} /></div>
              <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded bg-black/55 px-1 text-[9px] font-extrabold text-white">{i + 1}</span>
            </button>
          ))}
          <button onClick={addSlide} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[11px] font-bold text-muted-foreground hover:border-brand-500 hover:text-brand-400"><Plus className="h-3.5 w-3.5" /> Add slide</button>
        </div>
      </div>

      {/* stage */}
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-[12px] font-bold">{slide?.type === "livedraw" ? "Live Draw" : slide?.type === "whiteboard" ? "Whiteboard slide" : "Document slide"}{slide?.steps && slide.steps > 1 ? <span className="ms-1.5 font-normal text-muted-foreground">· {slide.steps} reveals</span> : null}</span>
          <button onClick={regenerate} disabled={busy === "regen"} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500">
            {busy === "regen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate slide
          </button>
          <div className="ms-auto flex items-center gap-1.5">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} className="grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[70px] text-center text-[11px] text-muted-foreground">Slide {page + 1} / {deck.slides.length}</span>
            <button onClick={() => setPage((p) => Math.min(deck.slides.length - 1, p + 1))} disabled={page >= deck.slides.length - 1} className="grid h-7 w-7 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => onPresent(mat.id)} className="ms-1 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3 py-1.5 text-[12px] font-extrabold text-white"><Play className="h-3.5 w-3.5" /> Present</button>
            <button onClick={onExit} className="rounded-lg border border-border px-2 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid flex-1 place-items-center overflow-auto bg-[#0e0e13] p-4">
          {slide ? <div className="aspect-video w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl"><DeckSlideView slide={slide} /></div> : null}
        </div>
      </div>

      {/* inspector (desktop) */}
      <div className="hidden flex-col overflow-auto border-s border-border bg-card p-3 md:flex">
        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Edit slide</div>
        {slide ? (
          <div className="space-y-2.5">
            <Field label="Title" value={slide.title} onChange={(v) => editSlide({ title: v })} />
            <Field label="Subtitle" value={slide.subtitle ?? ""} onChange={(v) => editSlide({ subtitle: v })} />
            {slide.type === "doc" ? (
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-bold text-muted-foreground">Talking points (one per line)</span>
                <textarea value={(slide.bullets ?? []).join("\n")} onChange={(e) => editSlide({ bullets: e.target.value.split("\n").map((s) => s).filter((_, i, a) => i < a.length) })} className="min-h-[110px] w-full resize-y rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-bold text-muted-foreground">Speaker notes</span>
              <textarea value={slide.notes ?? ""} onChange={(e) => editSlide({ notes: e.target.value })} className="min-h-[70px] w-full resize-y rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
            </label>
            <button onClick={delSlide} disabled={deck.slides.length <= 1} className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[11.5px] font-semibold text-muted-foreground hover:border-rose-500 hover:text-rose-500 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Delete slide</button>
          </div>
        ) : null}
      </div>
      </div>

      {/* AI PRESENTER — a full-width step of this presentation: identity · voice · animation · controls */}
      <PresenterBar
        presenter={presenter ?? null}
        active={!!deck.presenterActive}
        loopUrl={loopUrl}
        slideCount={deck.slides.length}
        narratedCount={narratedCount}
        busy={busy}
        onManage={() => onOpenPresenter?.()}
        onToggle={() => setPresenterActive(!deck.presenterActive)}
        onNarrate={narrate}
        onAnimate={animate}
      />
    </div>
  );
}

/** The presentation's AI Presenter, as a full-width bar under the builder: who's
 *  delivering, their voice, their moving-avatar animation, and the on/off + generate
 *  controls — all in one place instead of a cramped rail card. */
function PresenterBar({ presenter, active, loopUrl, slideCount, narratedCount, busy, onManage, onToggle, onNarrate, onAnimate }: {
  presenter: PresenterProfileDTO | null;
  active: boolean;
  loopUrl: string | null;
  slideCount: number;
  narratedCount: number;
  busy: null | "gen" | "regen" | "save" | "narrate" | "animate";
  onManage: () => void;
  onToggle: () => void;
  onNarrate: () => void;
  onAnimate: () => void;
}) {
  if (!presenter) {
    return (
      <div className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-4 py-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <b className="block text-[12.5px]">AI Presenter</b>
          <span className="block truncate text-[11px] text-muted-foreground">Add a co-host that delivers this presentation in your voice &amp; likeness.</span>
        </div>
        <button onClick={onManage} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-extrabold text-white"><Sparkles className="h-4 w-4" /> Set up presenter</button>
      </div>
    );
  }
  return (
    <div className={cn("flex shrink-0 items-stretch overflow-x-auto border-t-2 bg-card transition-colors", active ? "border-brand-500" : "border-border")}>
      {/* identity + live avatar */}
      <div className="flex min-w-[230px] items-center gap-3 px-4 py-2.5">
        <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#241f38] to-[#14121f] ring-1 ring-white/10">
          {loopUrl ? (
            <video src={loopUrl} autoPlay muted loop playsInline poster={presenter.portraitUrl ?? undefined} className="h-full w-full object-cover" />
          ) : presenter.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={presenter.portraitUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-white"><Bot className="h-5 w-5" /></span>
          )}
          {loopUrl ? <span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-px text-[7px] font-black text-white backdrop-blur">● LIVE</span> : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><b className="text-[12.5px] leading-tight">AI Presenter</b><span className="rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1 py-px text-[7.5px] font-black text-[#04222a]">AI</span></div>
          <span className="block truncate text-[11px] text-muted-foreground">{presenter.name} · {presenter.role === "host" ? "Host" : presenter.role === "assistant" ? "Assistant" : "Co-host"}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold"><span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-400" : "bg-muted-foreground/40")} />{active ? "Active in room" : "Off"}</span>
        </div>
      </div>

      {/* voice */}
      <div className="flex min-w-[240px] flex-1 items-center gap-3 border-s border-border px-4 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-brand-400"><Mic className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Voice</span>
            <span className="truncate text-[11px] font-semibold">{presenter.voiceName || "Preset voice"}</span>
          </div>
          <Bars active={busy === "narrate"} />
        </div>
        <button onClick={onNarrate} disabled={!active || busy === "narrate"} title={active ? "" : "Turn the presenter On first"} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-bold hover:border-brand-500 disabled:opacity-40">
          {busy === "narrate" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Voicing…</> : <><Volume2 className="h-3.5 w-3.5" /> {narratedCount ? `${narratedCount}/${slideCount} voiced` : "Generate narration"}</>}
        </button>
      </div>

      {/* animation */}
      <div className="flex min-w-[230px] items-center gap-3 border-s border-border px-4 py-2.5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#241f38] to-[#14121f]">
          {loopUrl ? (
            <video src={loopUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
          ) : presenter.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={presenter.portraitUrl} alt="" className="h-full w-full object-cover opacity-70" />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted-foreground"><Film className="h-4 w-4" /></span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Animation</span>
          <span className={cn("block truncate text-[11px] font-semibold", loopUrl ? "text-emerald-400" : "text-muted-foreground")}>{loopUrl ? "Moving avatar ready" : "Still photo"}</span>
        </div>
        <button onClick={onAnimate} disabled={busy === "animate"} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-bold hover:border-brand-500 disabled:opacity-40">
          {busy === "animate" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Animating…</> : <><Film className="h-3.5 w-3.5" /> {loopUrl ? "Re-animate" : "Animate"}</>}
        </button>
      </div>

      {/* controls */}
      <div className="ms-auto flex shrink-0 items-center gap-2 border-s border-border px-4 py-2.5">
        <button onClick={onManage} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11.5px] font-bold hover:border-brand-500"><Settings2 className="h-3.5 w-3.5" /> Manage</button>
        <button onClick={onToggle} className={cn("inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11.5px] font-extrabold transition", active ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "border border-border text-muted-foreground hover:border-brand-500")}>{active ? "On" : "Off"}</button>
      </div>
    </div>
  );
}

/** a tiny static voice waveform — animates while narration is generating */
function Bars({ active }: { active: boolean }) {
  const hs = [40, 70, 100, 60, 85, 45, 95, 55, 75, 35, 65, 90, 50, 80, 60];
  return (
    <div className="flex h-4 items-center gap-[2px]">
      {hs.map((h, i) => (
        <span key={i} className={cn("w-[2.5px] rounded-full bg-brand-400/70", active && "animate-pulse")} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function Toggle({ on, onClick, Icon, label }: { on: boolean; onClick: () => void; Icon: typeof Sparkles; label: string }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition", on ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border text-muted-foreground hover:border-brand-500")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-bold text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
    </label>
  );
}
