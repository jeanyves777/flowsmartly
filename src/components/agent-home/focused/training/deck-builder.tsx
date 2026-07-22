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
  Sparkles, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, Play, Pause, X, Presentation, Loader2, PenLine, FileText, Bot, Volume2, VolumeX, Film, Settings2, Mic, RotateCcw, Radio, Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { DeckSlideView } from "./deck-slide-view";
import type { DeckSlide, TrainingDeck, TrainingSessionDTO, PresenterProfileDTO } from "@/lib/training/types";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

interface AutoGen { brief: string; wantDoc: boolean; wantWhiteboard: boolean; wantVisuals: boolean; slideCount: number }

export function DeckBuilder({ session, sessionId, autoGen, onAutoConsumed, presenter, onOpenPresenter, onSession, onPresent, onStartMeeting, onExit }: {
  session: TrainingSessionDTO;
  sessionId: string;
  autoGen?: AutoGen | null;
  onAutoConsumed?: () => void;
  presenter?: PresenterProfileDTO | null;
  onOpenPresenter?: () => void;
  onSession: (s: TrainingSessionDTO) => void;
  onPresent: (materialId: string) => void;
  onStartMeeting?: (materialId: string) => void;
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
  const [busy, setBusy] = useState<null | "gen" | "regen" | "save" | "narrate" | "animate" | "introfilm" | "outrofilm" | "moments">(null);

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
      // The deck is the source of truth for its intro/outro videos (generated per-deck via
      // iv-moment); the profile's are only a fallback, so a freshly generated URL isn't wiped.
      // NOTE: intro/outro/moment videos are DECK-managed (generated per-deck via iv-moment)
      // and preserved via `...d` — this effect must NOT touch them, or it wipes a freshly
      // generated URL on the next presenter change (that's the bug that lost introVideoUrl).
      const loop = presenter.loopVideoUrl ?? d.presenterVideoUrl ?? null;
      if (d.presenterId === presenter.id && (d.presenterVideoUrl ?? null) === loop) return d;
      const next = { ...d, presenterId: presenter.id, presenterVideoUrl: loop, presenterActive: d.presenterActive ?? true };
      persist(next);
      return next;
    });
  }, [presenter?.id, presenter?.loopVideoUrl, presenter?.introVideoUrl, presenter?.outroVideoUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPresenterActive = (v: boolean) => {
    setDeck((d) => { if (!d) return d; const next = { ...d, presenterActive: v, presenterId: presenter?.id ?? d.presenterId }; persist(next); return next; });
  };
  // Generate spoken narration for the whole deck in the presenter's voice.
  const narrate = async () => {
    if (!mat) return;
    // Guardrail: narration is already generated → confirm before re-voicing (it costs credits).
    if (narratedCount > 0 && !(await confirmAction({
      title: "Regenerate narration?",
      body: `Narration is already generated for ${narratedCount} slide${narratedCount === 1 ? "" : "s"}. Regenerating re-voices the whole deck and uses credits.`,
      confirmLabel: "Regenerate",
    }))) return;
    setBusy("narrate");
    try {
      const j = await fetch("/api/ai/training/presenter/narrate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't generate narration", variant: "destructive" }); return; }
      const s = j.data.session as TrainingSessionDTO;
      onSession(s);
      // pull the freshly-narrated deck into the local copy so the preview + counts update now
      const fresh = s.materials.find((m) => m.id === mat.id)?.deck;
      if (fresh) setDeck(fresh);
      land(null); // hear it in place on the current slide
      toast({ title: `Narration ready`, description: j.data.usedPreset
        ? `${j.data.narrated} slide${j.data.narrated === 1 ? "" : "s"} voiced with a preset voice — your cloned voice couldn't be reached this time.`
        : `${j.data.narrated} slide${j.data.narrated === 1 ? "" : "s"} voiced in your presenter's voice.` });
    } finally { setBusy(null); }
  };
  const narratedCount = deck?.slides.filter((s) => s.narration).length ?? 0;
  // Presenter readiness — when the AI co-host is ON, its voice + on-screen videos must all be
  // generated before you can start the meeting (so the room isn't half-built).
  const momentTotal = deck?.slides.filter((s) => s.presenterMoment).length ?? 0;
  const momentReady = deck?.slides.filter((s) => s.presenterMoment && s.momentVideoUrl).length ?? 0;
  const presenterOn = !!deck?.presenterActive && !!presenter;
  const ready = {
    narration: narratedCount > 0,
    loop: !!(deck?.presenterVideoUrl ?? presenter?.loopVideoUrl),
    intro: !!deck?.introVideoUrl,
    outro: !!deck?.outroVideoUrl,
    moments: momentTotal === 0 || momentReady === momentTotal,
  };
  const presenterReady = !presenterOn || (ready.narration && ready.loop && ready.intro && ready.outro && ready.moments);
  const [prepOpen, setPrepOpen] = useState(false);
  // In-place PREVIEW on the build stage — play the exact room experience without leaving the
  // builder. `previewing` plays the current slide (its talking video, or the slide + moving
  // avatar + narration audio); `previewClip` pins a specific asset (from the Prepare modal).
  const [previewing, setPreviewing] = useState(false);
  const [previewClip, setPreviewClip] = useState<string | null>(null);
  const closePreview = () => { setPreviewing(false); setPreviewClip(null); };
  const openClipPreview = (url: string | null) => { if (!url) return; setPrepOpen(false); setPreviewing(true); setPreviewClip(url); };
  const runningAll = useRef(false);
  // After an asset finishes generating, load it onto the stage so it "lands in place": a video
  // clip pins to the stage; null previews the current slide (narration + moving avatar). During a
  // full "Generate everything" run we keep the modal open and let the final asset land at the end.
  const land = (clip: string | null) => { setPreviewClip(clip); setPreviewing(true); if (!runningAll.current) setPrepOpen(false); };

  // In-app confirm dialog (no native window.confirm) — returns a promise the caller awaits.
  const [confirmBox, setConfirmBox] = useState<null | { title: string; body: string; confirmLabel: string; resolve: (ok: boolean) => void }>(null);
  const confirmAction = (opts: { title: string; body: string; confirmLabel?: string }) =>
    new Promise<boolean>((resolve) => setConfirmBox({ title: opts.title, body: opts.body, confirmLabel: opts.confirmLabel ?? "Continue", resolve }));
  const resolveConfirm = (ok: boolean) => { setConfirmBox((c) => { c?.resolve(ok); return null; }); };
  // Generate every missing presenter asset in sequence (voice → loop → intro → outro → moments).
  const runAll = async () => {
    runningAll.current = true;
    try {
      if (!ready.narration) await narrate();
      if (!ready.loop) await animate();
      if (!ready.intro) await genFilm("intro");
      if (!ready.outro) await genFilm("outro");
      if (!ready.moments) await genMoments();
    } finally { runningAll.current = false; setPrepOpen(false); } // land the finished set on the stage
  };
  // the presenter's moving-avatar loop (deck copy wins; falls back to the profile)
  const loopUrl = deck?.presenterVideoUrl ?? presenter?.loopVideoUrl ?? null;
  // What the in-place stage preview should play for the current slide: a pinned clip (from the
  // Prepare modal / a fresh generation) wins; otherwise the slide's own talking video (intro /
  // moment / closing outro), else null → play the slide with narration + the moving avatar.
  const previewActive = previewing || !!previewClip;
  const previewVideo = previewClip
    ?? (slide?.intro ? (deck?.introVideoUrl ?? null)
      : slide?.presenterMoment ? (slide?.momentVideoUrl ?? null)
      : (slide?.qa && slide?.qaKind === "final") ? (deck?.outroVideoUrl ?? null)
      : null);

  // large avatar player (inspector) controls
  const avatarRef = useRef<HTMLVideoElement | null>(null);
  const [avPlaying, setAvPlaying] = useState(true);
  const [avMuted, setAvMuted] = useState(true);
  const avToggle = () => { const v = avatarRef.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); };
  const avRestart = () => { const v = avatarRef.current; if (!v) return; v.currentTime = 0; void v.play(); };
  const avMute = () => { const v = avatarRef.current; if (!v) return; v.muted = !v.muted; setAvMuted(v.muted); };

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
      land(null); // show the moving avatar in place over the current slide
      toast({ title: "Your presenter is moving", description: "A looping avatar is ready for the room." });
    } finally { setBusy(null); }
  };

  // Generate a full-body, gesture-rich intro/outro FILM (film pipeline, audio-free).
  // Intro / outro: a REALISTIC Avatar-IV talking video — the presenter actually speaks the
  // line in their cloned voice (not a muted film, not the loop). Rendered + stored server-side.
  const genFilm = async (kind: "intro" | "outro") => {
    if (!presenter) { onOpenPresenter?.(); return; }
    if (!mat) return;
    setBusy(kind === "intro" ? "introfilm" : "outrofilm");
    try {
      const j = await fetch("/api/ai/training/presenter/iv-moment", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, target: kind }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || `Couldn't generate the ${kind} video`, variant: "destructive" }); return; }
      if (j.data.deck) { setDeck(j.data.deck as TrainingDeck); persist(j.data.deck as TrainingDeck); }
      land((j.data.videoUrl as string) ?? null); // play the fresh talking video in place
      toast({ title: `${kind === "intro" ? "Intro" : "Outro"} video ready`, description: "A realistic talking presenter video is set." });
    } finally { setBusy(null); }
  };

  // Between-slide "talking moments": render an Avatar-IV video for each presenter-moment slide.
  const genMoments = async () => {
    if (!presenter) { onOpenPresenter?.(); return; }
    if (!mat || !deck) return;
    const moments = deck.slides.filter((s) => s.presenterMoment);
    if (!moments.length) { toast({ title: "No between-slide moments in this deck" }); return; }
    setBusy("moments");
    try {
      for (const s of moments) {
        const j = await fetch("/api/ai/training/presenter/iv-moment", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, target: s.id }),
        }).then((r) => r.json());
        if (!j?.success) { toast({ title: j?.error?.message || "Couldn't render a moment", variant: "destructive" }); break; }
        if (j.data.deck) { setDeck(j.data.deck as TrainingDeck); persist(j.data.deck as TrainingDeck); }
        const idx = deck.slides.findIndex((x) => x.id === s.id); if (idx >= 0) setPage(idx);
        land((j.data.videoUrl as string) ?? null); // each moment lands on its slide as it renders
      }
      toast({ title: "Talking moments ready", description: "Your co-host now appears on screen between slides." });
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
            <button onClick={() => (previewActive ? closePreview() : (setPreviewClip(null), setPreviewing(true)))} title="Play this slide right here — its narration, moving avatar and any talking video" className={cn("ms-1 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold hover:border-brand-500", previewActive ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-border")}>{previewActive ? <><Pause className="h-3.5 w-3.5" /> Exit preview</> : <><Play className="h-3.5 w-3.5" /> Preview</>}</button>
            <button onClick={() => onPresent(mat.id)} title="Open the full live stage" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold hover:border-brand-500"><Presentation className="h-3.5 w-3.5" /> Present</button>
            {onStartMeeting ? (
              <button onClick={() => (presenterReady || session.status === "live") ? onStartMeeting(mat.id) : setPrepOpen(true)} title={presenterReady || session.status === "live" ? "Go live and start the training now" : "Finish preparing your AI presenter first — voice + on-screen videos"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-extrabold text-white", (presenterReady || session.status === "live") ? "bg-gradient-to-br from-rose-600 to-rose-400" : "bg-gradient-to-br from-amber-600 to-amber-400")}><Radio className="h-3.5 w-3.5" /> {session.status === "live" ? "Rejoin room" : presenterReady ? "Start meeting" : "Prepare presenter"}</button>
            ) : null}
            <button onClick={onExit} className="rounded-lg border border-border px-2 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid flex-1 place-items-center overflow-auto bg-[#0e0e13] p-4">
          {previewActive && slide ? (
            <div className="w-full max-w-[900px]">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-bold text-brand-300"><Radio className="h-3 w-3" /> Previewing — as the room plays it</span>
                <span className="truncate text-[11px] text-muted-foreground">{previewVideo ? (previewClip ? "Talking presenter video" : "On-screen presenter") : "Slide · narration · moving avatar"}</span>
                <button onClick={closePreview} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-brand-500"><X className="h-3.5 w-3.5" /> Exit preview</button>
              </div>
              {previewVideo ? (
                <video key={previewVideo} src={previewVideo} autoPlay controls playsInline onEnded={() => { if (!previewClip) setPage((p) => Math.min(deck.slides.length - 1, p + 1)); }} className="aspect-video w-full rounded-xl bg-black object-contain shadow-2xl" />
              ) : (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-2xl">
                  <DeckSlideView slide={slide} />
                  {loopUrl ? <video src={loopUrl} autoPlay muted loop playsInline className="absolute bottom-3 right-3 aspect-video w-[24%] rounded-lg object-cover shadow-lg ring-2 ring-brand-500/50" /> : null}
                  {slide.narration?.audioUrl ? (
                    <audio key={slide.id} src={slide.narration.audioUrl} autoPlay controls onEnded={() => setPage((p) => Math.min(deck.slides.length - 1, p + 1))} className="absolute inset-x-3 bottom-3 w-[calc(100%-1.5rem)]" />
                  ) : (
                    <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/75 px-3 py-2 text-center text-[11px] font-semibold text-amber-300">No narration for this slide yet — generate it in Prepare presenter.</div>
                  )}
                </div>
              )}
            </div>
          ) : slide ? (
            <div className="aspect-video w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl"><DeckSlideView slide={slide} /></div>
          ) : null}
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

        {/* the finished MOVING AVATAR — large, playing, with controls (lower-right) */}
        {loopUrl ? (
          <div className="mt-auto pt-4">
            <div className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/[0.06] to-transparent p-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-300"><Film className="h-3.5 w-3.5" /> AI Presenter · Live avatar</div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                <video ref={avatarRef} src={loopUrl} autoPlay muted loop playsInline onPlay={() => setAvPlaying(true)} onPause={() => setAvPlaying(false)} className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[8px] font-black text-white backdrop-blur">● LIVE</span>
                <span className="absolute right-2 top-2 rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1.5 py-0.5 text-[8px] font-black text-[#04222a]">AI</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <button onClick={avToggle} title={avPlaying ? "Pause" : "Play"} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-brand-500">{avPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button onClick={avRestart} title="Restart" className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-brand-500"><RotateCcw className="h-3.5 w-3.5" /></button>
                <button onClick={avMute} title={avMuted ? "Unmute" : "Mute"} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-brand-500">{avMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                <button onClick={animate} disabled={busy === "animate"} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[10.5px] font-bold hover:border-brand-500 disabled:opacity-50">{busy === "animate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />} Re-animate</button>
              </div>
            </div>
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
        onPrepare={() => setPrepOpen(true)}
        hasIntro={!!deck.introVideoUrl}
        hasOutro={!!deck.outroVideoUrl}
        momentTotal={deck.slides.filter((s) => s.presenterMoment).length}
        momentReady={deck.slides.filter((s) => s.presenterMoment && s.momentVideoUrl).length}
      />

      {/* PREPARE PRESENTER — a large modal that generates every on-screen asset (voice, loop,
          intro, outro, talking moments) with progress + preview. "Start meeting" is locked
          until they're all ready. */}
      {prepOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" onClick={() => setPrepOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Bot className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><b className="block text-[15px]">Prepare your AI presenter</b><span className="text-[11.5px] text-muted-foreground">These are generated before the training goes live.</span></div>
              <button onClick={() => setPrepOpen(false)} className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500">Close</button>
            </div>
            <div className="max-h-[58vh] space-y-2.5 overflow-auto p-4">
              {([
                { k: "narration", label: "Voice narration", done: ready.narration, meta: `${narratedCount}/${deck.slides.length} slides`, busyKey: "narrate" as const, run: narrate, preview: null as string | null, show: () => { setPrepOpen(false); setPreviewClip(null); setPreviewing(true); } },
                { k: "loop", label: "Moving avatar (loops in the corner tile)", done: ready.loop, meta: ready.loop ? "Ready" : "Not generated", busyKey: "animate" as const, run: animate, preview: (deck.presenterVideoUrl ?? presenter?.loopVideoUrl) ?? null, show: () => { setPrepOpen(false); setPreviewClip(null); setPreviewing(true); } },
                { k: "intro", label: "Intro — presenter on screen", done: ready.intro, meta: ready.intro ? "Ready" : "Not generated", busyKey: "introfilm" as const, run: () => genFilm("intro"), preview: deck.introVideoUrl ?? null, show: () => openClipPreview(deck.introVideoUrl ?? null) },
                { k: "outro", label: "Outro — presenter on screen", done: ready.outro, meta: ready.outro ? "Ready" : "Not generated", busyKey: "outrofilm" as const, run: () => genFilm("outro"), preview: deck.outroVideoUrl ?? null, show: () => openClipPreview(deck.outroVideoUrl ?? null) },
                { k: "moments", label: "Talking moments between slides", done: ready.moments, meta: `${momentReady}/${momentTotal} ready`, busyKey: "moments" as const, run: genMoments, preview: null as string | null, hide: momentTotal === 0, show: () => { const m = deck.slides.find((s) => s.presenterMoment && s.momentVideoUrl); const idx = deck.slides.findIndex((s) => s.id === m?.id); if (idx >= 0) setPage(idx); openClipPreview(m?.momentVideoUrl ?? null); } },
              ]).filter((a) => !a.hide).map((a) => (
                <div key={a.k} className={cn("flex items-center gap-3 rounded-xl border p-3 transition-colors", busy === a.busyKey ? "border-brand-500 bg-brand-500/5" : "border-border bg-muted/40")}>
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", a.done ? "bg-emerald-500/15 text-emerald-400" : busy === a.busyKey ? "bg-brand-500/15 text-brand-400" : "bg-muted text-muted-foreground")}>{a.done ? <Check className="h-4 w-4" /> : busy === a.busyKey ? <Loader2 className="h-4 w-4 animate-spin" /> : busy !== null ? <Loader2 className="h-4 w-4 animate-spin opacity-25" /> : <Film className="h-4 w-4" />}</span>
                  {a.preview ? <video src={a.preview} muted loop autoPlay playsInline className="h-11 w-[74px] shrink-0 rounded-lg object-cover" /> : null}
                  <div className="min-w-0 flex-1"><b className="block text-[12.5px]">{a.label}</b><span className="text-[11px] text-muted-foreground">{busy === a.busyKey ? "Generating…" : busy !== null && !a.done ? "Queued…" : a.meta}</span></div>
                  {a.done ? <button onClick={a.show} disabled={busy !== null} title="Load it onto the stage to see & hear it" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand-500/50 px-2.5 py-1.5 text-[11px] font-bold text-brand-300 hover:bg-brand-500/10 disabled:opacity-40"><Play className="h-3 w-3" /> Preview</button> : null}
                  <button onClick={a.run} disabled={busy !== null} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold hover:border-brand-500 disabled:opacity-40">{busy === a.busyKey ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : a.done ? "Regenerate" : "Generate"}</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-4">
              <button onClick={() => void runAll()} disabled={busy !== null || presenterReady} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40">{busy !== null ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : presenterReady ? <><Check className="h-4 w-4" /> All set</> : <><Sparkles className="h-4 w-4" /> Generate everything</>}</button>
              <button onClick={() => { setPrepOpen(false); if (presenterReady) onStartMeeting?.(mat.id); }} disabled={!presenterReady} className="flex-1 rounded-xl bg-gradient-to-br from-rose-600 to-rose-400 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"><Radio className="me-1 inline h-3.5 w-3.5" /> Start meeting</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* In-app confirm (replaces window.confirm) — sits above the Prepare modal. */}
      {confirmBox ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => resolveConfirm(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pb-2 pt-5"><b className="text-[15px]">{confirmBox.title}</b></div>
            <p className="px-5 pb-4 text-[12.5px] leading-relaxed text-muted-foreground">{confirmBox.body}</p>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              <button onClick={() => resolveConfirm(false)} className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-bold hover:border-brand-500">Cancel</button>
              <button onClick={() => resolveConfirm(true)} className="rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-extrabold text-white">{confirmBox.confirmLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The presentation's AI Presenter, as a full-width bar under the builder: who's
 *  delivering, their voice, their moving-avatar animation, and the on/off + generate
 *  controls — all in one place instead of a cramped rail card. */
function PresenterBar({ presenter, active, loopUrl, slideCount, narratedCount, busy, onManage, onToggle, onPrepare, hasIntro, hasOutro, momentTotal, momentReady }: {
  presenter: PresenterProfileDTO | null;
  active: boolean;
  loopUrl: string | null;
  slideCount: number;
  narratedCount: number;
  busy: null | "gen" | "regen" | "save" | "narrate" | "animate" | "introfilm" | "outrofilm" | "moments";
  hasOutro: boolean;
  momentTotal: number;
  momentReady: number;
  onManage: () => void;
  onToggle: () => void;
  onPrepare: () => void;
  hasIntro: boolean;
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
            <button onClick={onManage} title="Replace the voice — record, upload or re-clone" className="shrink-0 text-[9.5px] font-bold text-brand-400 hover:underline">Change</button>
          </div>
          <Bars active={busy === "narrate"} />
        </div>
        <button onClick={onPrepare} title="Open Prepare presenter" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-bold hover:border-brand-500">
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
        <button onClick={onPrepare} title="Open Prepare presenter" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-bold hover:border-brand-500">
          {busy === "animate" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Animating…</> : <><Film className="h-3.5 w-3.5" /> {loopUrl ? "Re-animate" : "Animate"}</>}
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-muted-foreground">On‑screen talking</span>
          <div className="flex gap-1">
            <button onClick={onPrepare} title="Realistic talking intro video — open Prepare presenter" className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold hover:border-brand-500", hasIntro ? "border-emerald-500/40 text-emerald-400" : "border-border")}>{busy === "introfilm" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />} {hasIntro ? "Intro ✓" : "Intro"}</button>
            <button onClick={onPrepare} title="Realistic talking outro video — open Prepare presenter" className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold hover:border-brand-500", hasOutro ? "border-emerald-500/40 text-emerald-400" : "border-border")}>{busy === "outrofilm" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />} {hasOutro ? "Outro ✓" : "Outro"}</button>
          </div>
          {momentTotal > 0 ? (
            <button onClick={onPrepare} title="Talking moments between slides — open Prepare presenter" className={cn("inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold hover:border-brand-500", momentReady === momentTotal ? "border-emerald-500/40 text-emerald-400" : "border-border")}>{busy === "moments" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {momentReady === momentTotal ? `Moments ✓ (${momentTotal})` : `Moments (${momentReady}/${momentTotal})`}</button>
          ) : null}
        </div>
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
