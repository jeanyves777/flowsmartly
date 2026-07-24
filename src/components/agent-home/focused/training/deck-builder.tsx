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
  Sparkles, ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, Play, Pause, X, Presentation, Loader2, PenLine, FileText, Bot, Volume2, VolumeX, Film, Settings2, Mic, RotateCcw, Radio, Check, Palette, ImageIcon, Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { DeckSlideView } from "./deck-slide-view";
import { VISUAL_STYLES, VISUAL_STYLE_LABELS, ANNOTATE_VARIANTS, presenterVideoStyle, STAGE_MODES, STAGE_MODE_LABELS } from "@/lib/training/types";
import { StageLayoutView } from "./stage-layout-view";
import { slideRevealUnits, revealFractions, revealStepAt } from "@/lib/training/reveal-timing";
import { AnimationStudio } from "./animation-studio";
import type { DeckSlide, TrainingDeck, TrainingSessionDTO, PresenterProfileDTO, VisualStyle, VisualType, PresenterFit, StageMode, StageLayout } from "@/lib/training/types";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

interface AutoGen { brief: string; wantDoc: boolean; wantWhiteboard: boolean; wantVisuals: boolean; slideCount: number }
interface PresenterClipDTO { id: string; kind: string; videoUrl: string; thumbnailUrl: string | null; presenterName: string | null; script: string | null; durationMs: number | null; createdAt: string; sameVoice: boolean }

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
  const [busy, setBusy] = useState<null | "gen" | "regen" | "rebuild" | "video" | "save" | "narrate" | "animate" | "introfilm" | "outrofilm" | "moments" | `moment:${string}`>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);

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
  // The current slide's PRESENTER ROLE. `intro` and `closing` are EXCLUSIVE (one each across the
  // deck — setting one clears it from every other slide); `moment` (a between-slide talking bridge)
  // can be on many; `content` is a normal slide. Lets the host fix mis-generated structure — e.g.
  // turn a stray duplicate Welcome into a talking moment, or move the intro/closing. [[training-presenter-talking-video]]
  type SlideRole = "content" | "intro" | "moment" | "closing";
  const roleOf = (s: DeckSlide | null): SlideRole => s?.intro ? "intro" : s?.presenterMoment ? "moment" : s?.outro ? "closing" : "content";
  const setRole = (role: SlideRole) => {
    if (!deck || !slide) return;
    const next: TrainingDeck = { ...deck, slides: deck.slides.map((s) => {
      if (s.id === slide.id) return { ...s, intro: role === "intro", presenterMoment: role === "moment", outro: role === "closing" };
      // clear the exclusive roles from other slides when THIS slide takes them
      return { ...s, intro: role === "intro" ? false : s.intro, outro: role === "closing" ? false : s.outro };
    }) };
    setDeck(next); persist(next);
  };
  const editDeck = (patch: Partial<TrainingDeck>) => {
    if (!deck) return;
    const next: TrainingDeck = { ...deck, ...patch };
    setDeck(next); persist(next);
  };
  // Framing for the on-screen presenter films (intro / moments / outro). Merge a partial into
  // deck.presenterFit; `null` resets to defaults. Saved with the deck (autosaved via persist).
  const setFit = (patch: Partial<PresenterFit> | null) =>
    editDeck({ presenterFit: patch === null ? undefined : { ...(deck?.presenterFit ?? {}), ...patch } });
  // Stage layout — how the co-host video shares the stage with the slides. Merge into deck.stageLayout.
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const setStage = (patch: Partial<StageLayout>) =>
    editDeck({ stageLayout: { ...(deck?.stageLayout ?? { mode: "cohost_right", size: "m", keepVisible: true }), ...patch } });

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
  // If the presenter's VOICE was changed after generating, the existing narration + talking
  // videos still speak in the OLD voice — treat them as not-ready so the builder prompts a
  // regenerate. (The silent loop has no voice, so it's unaffected.)
  const voiceStale = !!(deck?.voiceKey && presenter?.voiceProfileId && deck.voiceKey !== presenter.voiceProfileId);
  const ready = {
    narration: narratedCount > 0 && !voiceStale,
    loop: !!(deck?.presenterVideoUrl ?? presenter?.loopVideoUrl),
    intro: !!deck?.introVideoUrl && !voiceStale,
    outro: !!deck?.outroVideoUrl && !voiceStale,
    moments: momentTotal === 0 || (momentReady === momentTotal && !voiceStale),
  };
  const presenterReady = !presenterOn || (ready.narration && ready.loop && ready.intro && ready.outro && ready.moments);
  const [prepOpen, setPrepOpen] = useState(false);
  // In-place PREVIEW on the build stage — play the exact room experience without leaving the
  // builder. `previewing` plays the current slide (its talking video, or the slide + moving
  // avatar + narration audio); `previewClip` pins a specific asset (from the Prepare modal).
  const [previewing, setPreviewing] = useState(false);
  const [previewClip, setPreviewClip] = useState<string | null>(null);
  // While previewing a slide, STEP through its reveals so it animates the way the room plays it:
  // Live Draw strokes draw (with the hand), diagram elements build, bullets appear one at a time.
  const [previewStep, setPreviewStep] = useState<number | undefined>(undefined);
  // Per-slide reveal timing for the preview: the narration <audio>'s onTimeUpdate reads this to
  // advance the reveals in sync with the voice (content-aware), instead of a blind fixed timer.
  const previewFracsRef = useRef<{ fracs: number[] | null; steps: number }>({ fracs: null, steps: 1 });
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewDurRef = useRef(0); // narration length (s) — drives the per-step hand-writing pace
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
  // The current step's share of the narration → how long the hand takes to draw it, so the pen
  // keeps pace with the voice in the preview too (matches the live room). [[training-presentation-animation]]
  const previewWriteMs = (() => {
    const pf = previewFracsRef.current;
    const durMs = previewDurRef.current * 1000;
    if (!durMs || pf.steps < 1 || (previewStep ?? 0) < 1) return undefined;
    const k = (previewStep ?? 1) - 1;
    if (pf.fracs && pf.fracs.length === pf.steps) {
      const start = pf.fracs[k] ?? 0;
      const end = k + 1 < pf.fracs.length ? pf.fracs[k + 1] : 1;
      return Math.round((end - start) * durMs * 0.82);
    }
    return Math.round((durMs / pf.steps) * 0.82); // even split (whiteboard / diagram)
  })();
  // A host-designated closing slide plays the outro; otherwise the final-Q&A slide auto-plays it
  // (legacy) — but only when NO slide is explicitly flagged, so the outro never plays twice.
  const hasOutroSlide = !!deck?.slides.some((s) => s.outro);
  // Is the outro actually placed anywhere? (an explicit closing slide, or a final-Q&A fallback)
  const outroPlaced = hasOutroSlide || !!deck?.slides.some((s) => s.qa && s.qaKind === "final");
  const previewVideo = previewClip
    ?? (slide?.intro ? (deck?.introVideoUrl ?? null)
      : slide?.presenterMoment ? (slide?.momentVideoUrl ?? null)
      : slide?.outro ? (deck?.outroVideoUrl ?? null)
      : (slide?.qa && slide?.qaKind === "final" && !hasOutroSlide) ? (deck?.outroVideoUrl ?? null)
      : null);
  // Drive the reveal steps while previewing a (non-video) slide so it visibly draws/builds.
  useEffect(() => {
    if (!previewing || previewVideo || !slide) { setPreviewStep(undefined); previewFracsRef.current = { fracs: null, steps: 1 }; return; }
    const steps = Math.max(1, slide.steps ?? 1);
    previewFracsRef.current = { fracs: revealFractions(slideRevealUnits(slide), steps), steps };
    setPreviewStep(1);
    if (steps <= 1) return;
    // With narration, the audio's onTimeUpdate drives the reveals — content-aware and in sync with
    // the voice (see the <audio> below). Without narration, fall back to a steady timer so the
    // build still animates as it draws.
    if (slide.narration?.audioUrl) return;
    let s = 1;
    const pace = slide.type === "livedraw" ? 950 : 850; // a touch slower for the hand to draw
    const t = setInterval(() => { s += 1; setPreviewStep(s); if (s >= steps) clearInterval(t); }, pace);
    return () => clearInterval(t);
  }, [previewing, previewVideo, slide?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ---- Reuse library: drop a previously-generated intro / outro / moment onto this deck (no re-render). ----
  const [reuseKind, setReuseKind] = useState<null | "intro" | "outro" | "moment">(null);
  const [reuseMomentSlide, setReuseMomentSlide] = useState<string | null>(null); // which moment a reused clip attaches to
  const [reuseClips, setReuseClips] = useState<PresenterClipDTO[]>([]);
  const [reuseLoading, setReuseLoading] = useState(false);
  const openReuse = async (kind: "intro" | "outro" | "moment", momentSlideId?: string) => {
    if (!mat) return;
    setReuseMomentSlide(momentSlideId ?? null);
    setReuseKind(kind); setReuseLoading(true); setReuseClips([]);
    try {
      const j = await fetch(`/api/ai/training/presenter/clips?kind=${kind}&materialId=${mat.id}`).then((r) => r.json());
      if (j?.success) setReuseClips((j.data.clips as PresenterClipDTO[]) ?? []);
    } catch { /* ignore — empty list shows the empty state */ } finally { setReuseLoading(false); }
  };
  const applyClip = (c: PresenterClipDTO) => {
    if (reuseKind === "moment" && reuseMomentSlide) {
      const sid = reuseMomentSlide;
      setDeck((d) => { if (!d) return d; const next = { ...d, slides: d.slides.map((x) => (x.id === sid ? { ...x, momentVideoUrl: c.videoUrl } : x)) }; persist(next); return next; });
      const idx = deck?.slides.findIndex((x) => x.id === sid) ?? -1; if (idx >= 0) setPage(idx);
      land(c.videoUrl);
      toast({ title: "Moment reused", description: c.sameVoice ? "Attached from your library — no re-render." : "Attached. Heads up: it's a different voice than this deck." });
    } else if (reuseKind === "intro" || reuseKind === "outro") {
      editDeck(reuseKind === "intro" ? { introVideoUrl: c.videoUrl } : { outroVideoUrl: c.videoUrl });
      land(c.videoUrl);
      toast({ title: `${reuseKind === "intro" ? "Intro" : "Outro"} reused`, description: c.sameVoice ? "Set from your library — no re-render." : "Set from your library. Heads up: it's a different voice than this deck." });
    }
    setReuseKind(null); setReuseMomentSlide(null);
  };
  // Upload your OWN video onto a specific talking moment (attaches as its momentVideoUrl).
  const momentUploadRef = useRef<HTMLInputElement | null>(null);
  const uploadMomentSlideRef = useRef<string | null>(null);
  const uploadMomentVideo = async (slideId: string, file: File) => {
    if (!mat) return;
    setBusy(`moment:${slideId}`);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("materialId", mat.id); fd.append("slideId", slideId); fd.append("target", "moment");
      const j = await fetch(`/api/ai/training/${sessionId}/deck/media`, { method: "POST", body: fd }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't attach that video", variant: "destructive" }); return; }
      if (j.data.session) onSession?.(j.data.session);
      setDeck((d) => { if (!d) return d; const next = { ...d, slides: d.slides.map((x) => (x.id === slideId ? { ...x, momentVideoUrl: j.data.url as string } : x)) }; persist(next); return next; });
      const idx = deck?.slides.findIndex((x) => x.id === slideId) ?? -1; if (idx >= 0) setPage(idx);
      land(j.data.url as string);
      toast({ title: "Moment video attached", description: "Your uploaded video plays on this moment." });
    } finally { setBusy(null); }
  };
  const deleteClip = async (id: string) => {
    setReuseClips((cs) => cs.filter((c) => c.id !== id));
    await fetch(`/api/ai/training/presenter/clips?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  // Between-slide "talking moments": render an Avatar-IV video for ONE presenter-moment slide, so
  // each can be generated + reviewed independently (like intro/outro). Returns success.
  const genMoment = async (slideId: string): Promise<boolean> => {
    if (!presenter) { onOpenPresenter?.(); return false; }
    if (!mat || !deck) return false;
    setBusy(`moment:${slideId}`);
    try {
      const j = await fetch("/api/ai/training/presenter/iv-moment", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, target: slideId }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't render that moment", variant: "destructive" }); return false; }
      if (j.data.deck) { setDeck(j.data.deck as TrainingDeck); persist(j.data.deck as TrainingDeck); }
      const idx = deck.slides.findIndex((x) => x.id === slideId); if (idx >= 0) setPage(idx);
      land((j.data.videoUrl as string) ?? null); // lands on its slide as it renders
      return true;
    } finally { setBusy(null); }
  };
  // "Generate everything" still fills every moment — sequentially, lighting each row in turn.
  const genMoments = async () => {
    if (!presenter) { onOpenPresenter?.(); return; }
    if (!mat || !deck) return;
    const moments = deck.slides.filter((s) => s.presenterMoment);
    if (!moments.length) { toast({ title: "No between-slide moments in this deck" }); return; }
    for (const s of moments) { if (!s.momentVideoUrl && !(await genMoment(s.id))) break; }
  };
  // One Prepare-modal row PER talking moment, so each generates + previews on its own (like
  // intro/outro). Each row is IDENTIFIED by where it plays (the content slide before it) + what it
  // says — so with several moments you always know which video you're attaching to which moment.
  const momentRows = (deck?.slides ?? []).map((s, i) => ({ s, i })).filter(({ s }) => s.presenterMoment).map(({ s, i }, n) => {
    const prev = (deck?.slides ?? []).slice(0, i).reverse().find((x) => !x.intro && !x.presenterMoment && !x.qa && !x.quiz);
    const where = prev?.title ? `after “${prev.title}”` : `slide ${i + 1}`;
    const script = (s.momentScript || "").trim();
    return {
      k: `moment:${s.id}`,
      label: `Talking moment ${n + 1} · ${where}`,
      done: !!s.momentVideoUrl,
      meta: script ? `“${script.slice(0, 70)}${script.length > 70 ? "…" : ""}”` : s.momentVideoUrl ? "Ready" : "Not generated yet",
      busyKey: `moment:${s.id}` as `moment:${string}`,
      run: () => genMoment(s.id),
      preview: (s.momentVideoUrl ?? null) as string | null,
      show: () => { setPage(i); openClipPreview(s.momentVideoUrl ?? null); },
    };
  });

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

  // Regenerate ONE slide — optionally with a new content INSTRUCTION, a forced LAYOUT, and a
  // hand ANIMATION style, applied to the freshly generated slide.
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenInstr, setRegenInstr] = useState("");
  const [regenLayout, setRegenLayout] = useState<string>("auto");
  const [regenAnn, setRegenAnn] = useState<NonNullable<DeckSlide["annotate"]> | "none">("circle");
  const [regenDraw, setRegenDraw] = useState<"keep" | "live" | "build" | "instant">("keep"); // whiteboard/livedraw: how it's drawn on
  const regenerate = async () => {
    if (!mat || !slide) return;
    setRegenOpen(false);
    setBusy("regen");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: mat.id, regenerateSlideId: slide.id, instruction: regenInstr.trim() || undefined }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't regenerate", variant: "destructive" }); return; }
      const s = j.data.session as TrainingSessionDTO;
      onSession(s);
      // apply the chosen layout + hand animation to the regenerated slide
      const fresh = s.materials.find((m) => m.id === mat.id)?.deck;
      if (fresh) {
        // a 2-3 word phrase to mark, if the model didn't give one
        const deriveHl = (x: DeckSlide) => {
          const src = (x.bullets?.[0] || x.subtitle || "").replace(/\*\*/g, "").trim();
          const w = src.split(/\s+/).slice(0, 3).join(" ").replace(/[:.,;]+$/, "");
          return w.length >= 3 ? w : undefined;
        };
        const isBoard = slide.type === "whiteboard" || slide.type === "livedraw";
        const next: TrainingDeck = { ...fresh, slides: fresh.slides.map((x) => {
          if (x.id !== slide.id) return x;
          if (isBoard) {
            const boardPatch =
              regenDraw === "live" ? { type: "livedraw" as const, revealMode: "stroke_by_stroke" as const } :
              regenDraw === "build" ? { type: "whiteboard" as const, revealMode: "build_diagram" as const } :
              regenDraw === "instant" ? { type: "whiteboard" as const, revealMode: "all_at_once" as const } : {};
            return { ...x, ...boardPatch };
          }
          return {
            ...x,
            ...(regenLayout !== "auto" ? { layout: regenLayout as DeckSlide["layout"] } : {}),
            annotate: regenAnn === "none" ? undefined : regenAnn,
            highlight: regenAnn === "none" ? x.highlight : (x.highlight || deriveHl(x)),
          };
        }) };
        setDeck(next); persist(next);
      }
      toast({ title: "Slide regenerated" });
    } finally { setBusy(null); }
  };

  // Rebuild the WHOLE deck — re-run the generator across all slides (new content-aware layouts),
  // keeping the presenter. Narration/moment videos reset (new slides), so re-narrate after.
  const rebuildAll = async () => {
    if (!mat) return;
    setRebuildOpen(false);
    setBusy("rebuild");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, rebuild: true }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't rebuild the presentation", variant: "destructive" }); return; }
      const s = j.data.session as TrainingSessionDTO;
      onSession(s);
      const fresh = s.materials.find((m) => m.id === mat.id)?.deck;
      if (fresh) { setDeck(fresh); setPage(0); }
      toast({ title: "Presentation rebuilt", description: "New content-aware layouts across the deck — regenerate narration to voice the new slides." });
    } finally { setBusy(null); }
  };

  // Generate the short (~15s) demonstration video for a slide flagged as a video demo.
  const genVideo = async () => {
    if (!mat || !slide) return;
    setBusy("video");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck/video`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, slideId: slide.id }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't generate the video", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      const url = j.data.videoUrl as string;
      setDeck((d) => { if (!d) return d; const next = { ...d, slides: d.slides.map((x) => (x.id === slide.id ? { ...x, videoUrl: url, visualType: "video" as const } : x)) }; persist(next); return next; });
      toast({ title: "Demonstration video ready", description: "It plays right on the slide." });
    } finally { setBusy(null); }
  };

  // ---- slide media: upload your own / regenerate the image / turn it into an AI video ----
  const [mediaBusy, setMediaBusy] = useState<null | "upload" | "regen" | "aivideo" | "illustration">(null);
  const [aiVideoOpen, setAiVideoOpen] = useState(false);
  const [aiVideoStyle, setAiVideoStyle] = useState("3d");
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const setSlideMedia = (patch: Partial<DeckSlide>) => setDeck((d) => { if (!d || !slide) return d; const next = { ...d, slides: d.slides.map((x) => (x.id === slide.id ? { ...x, ...patch } : x)) }; persist(next); return next; });
  const styleType = (): VisualType => (slide?.visual?.style === "3d" ? "3d" : slide?.visual?.style === "illustration" ? "illustration" : "photo");

  const uploadMedia = async (file: File) => {
    if (!mat || !slide) return;
    setMediaBusy("upload");
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("materialId", mat.id); fd.append("slideId", slide.id);
      const j = await fetch(`/api/ai/training/${sessionId}/deck/media`, { method: "POST", body: fd }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't add that media", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      const url = j.data.url as string, kind = j.data.kind as string;
      setSlideMedia(kind === "video" ? { videoUrl: url, visualType: "video" } : { visual: { ...(slide.visual ?? { kind: "image" }), kind: "image", url }, videoUrl: undefined, visualType: styleType() });
      toast({ title: kind === "video" ? "Video added to the slide" : "Image replaced" });
    } finally { setMediaBusy(null); }
  };
  const regenImage = async () => {
    if (!mat || !slide) return;
    setMediaBusy("regen");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, slideId: slide.id, action: "regenerate_image" }) }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't regenerate the image", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      setSlideMedia({ visual: { ...(slide.visual ?? { kind: "image" }), kind: "image", url: j.data.url as string }, videoUrl: undefined, visualType: styleType() });
      toast({ title: "New image ready" });
    } finally { setMediaBusy(null); }
  };
  const genAiVideo = async (style: string) => {
    if (!mat || !slide) return;
    setAiVideoOpen(false); setMediaBusy("aivideo");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck/video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, slideId: slide.id, style }) }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't render the video", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      setSlideMedia({ videoUrl: j.data.videoUrl as string, visualType: "video" });
      toast({ title: "Demonstration video ready", description: "It plays right on the slide." });
    } finally { setMediaBusy(null); }
  };
  // Agent-authored animated illustration (infographic) — the on-subject alternative to an AI video.
  const genIllustration = async () => {
    if (!mat || !slide) return;
    setMediaBusy("illustration");
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck/illustration`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId: mat.id, slideId: slide.id }) }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't design an illustration", variant: "destructive" }); return; }
      onSession(j.data.session as TrainingSessionDTO);
      setSlideMedia({ infographic: j.data.infographic as DeckSlide["infographic"], visualType: "diagram", videoUrl: undefined });
      toast({ title: "Animated illustration ready", description: "It reveals in step with the narration — Preview it." });
    } finally { setMediaBusy(null); }
  };

  // insert a blank slide right AFTER the selected one (never at the top).
  const addSlide = () => {
    if (!deck) return;
    const at = Math.min(Math.max(page, 0), deck.slides.length - 1) + 1;
    const s: DeckSlide = { id: uid("s"), type: "doc", title: "New slide", subtitle: "", bullets: ["Point one"], visual: { kind: "emoji", emoji: "✨" } };
    const next = { ...deck, slides: [...deck.slides.slice(0, at), s, ...deck.slides.slice(at)] };
    setDeck(next); persist(next); setPage(at);
  };

  // AI new slide — the agent writes a slide that fits the training, inserted after the selected one.
  const [newSlideOpen, setNewSlideOpen] = useState(false);
  const [newSlidePrompt, setNewSlidePrompt] = useState("");
  const [newSlideBusy, setNewSlideBusy] = useState(false);
  const genNewSlide = async () => {
    if (!mat || !slide) return;
    setNewSlideBusy(true);
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/deck`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: mat.id, insertAfterSlideId: slide.id, instruction: newSlidePrompt.trim() || undefined }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't add the slide", variant: "destructive" }); return; }
      const s = j.data.session as TrainingSessionDTO;
      onSession(s);
      const fresh = s.materials.find((m) => m.id === mat.id)?.deck as TrainingDeck | undefined;
      if (fresh) setDeck(fresh);
      setNewSlideOpen(false); setNewSlidePrompt(""); setPage(page + 1);
      toast({ title: "Slide added", description: narratedCount > 0 ? "Regenerate narration to voice the new slide." : "It fits right into your training." });
    } finally { setNewSlideBusy(false); }
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
          {deck.slides.map((s, i) => {
            // Presenter-role badge so the whole deck structure (intro / moments / closing / Q&A /
            // quiz) is visible at a glance — you can see where each is, even with several moments.
            const badge = s.intro ? { t: "Intro", c: "bg-brand-500" }
              : s.outro ? { t: "Closing", c: "bg-brand-500" }
              : s.presenterMoment ? { t: "Moment", c: "bg-violet-600" }
              : s.qa ? { t: s.qaKind === "final" ? "Wrap-up" : "Q&A", c: "bg-cyan-600" }
              : s.quiz ? { t: "Quiz", c: "bg-amber-600" } : null;
            return (
              <button key={s.id} onClick={() => setPage(i)} className={cn("relative block w-full overflow-hidden rounded-lg border-2", i === page ? "border-brand-500" : "border-transparent hover:border-border")}>
                <div className="aspect-video w-full"><DeckSlideView slide={s} styleKey={deck.visualStyle} board={deck.boardStyle} /></div>
                <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded bg-black/55 px-1 text-[9px] font-extrabold text-white">{i + 1}</span>
                {badge ? <span className={cn("absolute right-1 top-1 rounded px-1 py-px text-[8px] font-black uppercase tracking-wide text-white shadow", badge.c)}>{badge.t}</span> : null}
              </button>
            );
          })}
          <button onClick={() => { setNewSlidePrompt(""); setNewSlideOpen(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[11px] font-bold text-muted-foreground hover:border-brand-500 hover:text-brand-400"><Plus className="h-3.5 w-3.5" /> Add slide</button>
        </div>
      </div>

      {/* stage */}
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 whitespace-nowrap text-[11.5px] font-bold">{slide?.type === "livedraw" ? "Live Draw" : slide?.type === "whiteboard" ? "Whiteboard" : "Document"}{slide?.steps && slide.steps > 1 ? <span className="ms-1 font-normal text-muted-foreground">· {slide.steps} reveals</span> : null}</span>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          <button onClick={() => { setRegenInstr(""); setRegenLayout("auto"); setRegenAnn((slide?.annotate as NonNullable<DeckSlide["annotate"]>) ?? "circle"); setRegenDraw("keep"); setRegenOpen(true); }} disabled={busy !== null} title="Regenerate this slide" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500 disabled:opacity-50">
            {busy === "regen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate
          </button>
          <button onClick={() => setRebuildOpen(true)} disabled={busy !== null} title="Rebuild the whole deck with the new content-aware layouts" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-500/50 px-2.5 py-1.5 text-[11px] font-bold text-brand-300 hover:bg-brand-500/10 disabled:opacity-50">
            {busy === "rebuild" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rebuild
          </button>
          <button onClick={() => setAnimOpen(true)} title="Animation Studio — direct how the presenter's hand marks each slide" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-500/50 px-2.5 py-1.5 text-[11px] font-bold text-brand-300 hover:bg-brand-500/10">
            <PenLine className="h-3.5 w-3.5" /> Animate
          </button>
          <label className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border pl-2 pr-0.5 text-[11px] font-semibold" title="Visual style — re-skins the whole deck">
            <Palette className="h-3.5 w-3.5 shrink-0 text-brand-400" />
            <select value={deck.visualStyle ?? "modern_professional"} onChange={(e) => { const v = e.target.value as VisualStyle; const next: TrainingDeck = { ...deck, visualStyle: v }; setDeck(next); persist(next); }} className="max-w-[92px] cursor-pointer truncate bg-transparent py-1.5 text-[11px] font-semibold outline-none">
              {VISUAL_STYLES.map((s) => <option key={s} value={s} className="bg-card text-foreground">{VISUAL_STYLE_LABELS[s]}</option>)}
            </select>
          </label>
          {/* Stage layout — how the co-host video shares the stage with the slides. */}
          <div className="relative shrink-0">
            <button onClick={() => setStageMenuOpen((o) => !o)} title="Stage layout — how the co-host shares the stage with your slides" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500">
              <Presentation className="h-3.5 w-3.5 shrink-0 text-brand-400" /> {STAGE_MODE_LABELS[deck.stageLayout?.mode ?? "cohost_right"]} ▾
            </button>
            {stageMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStageMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-1.5 w-[236px] rounded-xl border border-border bg-card p-2.5 shadow-2xl">
                  <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Stage layout</div>
                  {STAGE_MODES.map((m) => (
                    <button key={m} onClick={() => setStage({ mode: m })} className={cn("mb-1 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11.5px] font-bold", (deck.stageLayout?.mode ?? "cohost_right") === m ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}>
                      <svg viewBox="0 0 20 14" width="18" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-brand-400"><rect x="1" y="1" width="18" height="12" rx="2" />{m === "cohost_right" ? <line x1="13" y1="1" x2="13" y2="13" /> : null}{m === "cohost_bottom" ? <line x1="1" y1="9" x2="19" y2="9" /> : null}{m === "floating" ? <rect x="12" y="7" width="6" height="5" rx="1" fill="currentColor" /> : null}</svg>
                      {STAGE_MODE_LABELS[m]}
                    </button>
                  ))}
                  <div className="mb-1 mt-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Co-host size</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(["s", "m", "l"] as const).map((z) => <button key={z} onClick={() => setStage({ size: z })} className={cn("rounded-lg border py-1.5 text-[11px] font-bold", (deck.stageLayout?.size ?? "m") === z ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}>{z === "s" ? "Small" : z === "l" ? "Large" : "Medium"}</button>)}
                  </div>
                  <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11px] font-semibold"><input type="checkbox" className="accent-brand-500" checked={deck.stageLayout?.keepVisible ?? true} onChange={(e) => setStage({ keepVisible: e.target.checked })} /> Keep co-host visible</label>
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[11px] font-semibold"><input type="checkbox" className="accent-brand-500" checked={deck.stageLayout?.hideOnFullVisual ?? false} onChange={(e) => setStage({ hideOnFullVisual: e.target.checked })} /> Hide on full-visual slides</label>
                </div>
              </>
            ) : null}
          </div>
          {slide?.videoPrompt && !slide?.videoUrl ? (
            <button onClick={() => void genVideo()} disabled={busy !== null} title="Generate the ~15s demonstration video for this slide" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-500/50 px-2.5 py-1.5 text-[11px] font-bold text-brand-300 hover:bg-brand-500/10 disabled:opacity-50">
              {busy === "video" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering…</> : <><Film className="h-3.5 w-3.5" /> Video</>}
            </button>
          ) : null}
          <div className="ms-auto flex shrink-0 items-center gap-1.5 ps-1.5">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="shrink-0 whitespace-nowrap text-center text-[11px] tabular-nums text-muted-foreground">{page + 1} / {deck.slides.length}</span>
            <button onClick={() => setPage((p) => Math.min(deck.slides.length - 1, p + 1))} disabled={page >= deck.slides.length - 1} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => (previewActive ? closePreview() : (setPreviewClip(null), setPreviewing(true)))} title="Play this slide right here — its narration, moving avatar and any talking video" className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold hover:border-brand-500", previewActive ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-border")}>{previewActive ? <><Pause className="h-3.5 w-3.5" /> Exit</> : <><Play className="h-3.5 w-3.5" /> Preview</>}</button>
            <button onClick={() => onPresent(mat.id)} title="Open the full live stage" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-bold hover:border-brand-500"><Presentation className="h-3.5 w-3.5" /> Present</button>
            {onStartMeeting ? (
              <button onClick={() => (presenterReady || session.status === "live") ? onStartMeeting(mat.id) : setPrepOpen(true)} title={presenterReady || session.status === "live" ? "Go live and start the training now" : "Finish preparing your AI presenter first — voice + on-screen videos"} className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] font-extrabold text-white", (presenterReady || session.status === "live") ? "bg-gradient-to-br from-rose-600 to-rose-400" : "bg-gradient-to-br from-amber-600 to-amber-400")}><Radio className="h-3.5 w-3.5" /> {session.status === "live" ? "Rejoin" : presenterReady ? "Start" : "Prepare"}</button>
            ) : null}
            <button onClick={onExit} title="Exit" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
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
                <>
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
                    <video key={previewVideo} src={previewVideo} autoPlay controls playsInline onEnded={() => { if (!previewClip) setPage((p) => Math.min(deck.slides.length - 1, p + 1)); }} className="absolute inset-0 h-full w-full bg-black" style={presenterVideoStyle(deck.presenterFit)} />
                  </div>
                  {/* Framing — size + position of the on-screen presenter films. Applies to ALL of them
                      (intro, talking moments, outro) and saves with the deck. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-brand-300"><Film className="h-3.5 w-3.5" /> Presenter framing</span>
                    <div className="inline-flex rounded-lg border border-border p-0.5">
                      {(["contain", "cover"] as const).map((m) => (
                        <button key={m} onClick={() => setFit({ fit: m })} className={cn("rounded-md px-2 py-1 font-bold transition", (deck.presenterFit?.fit ?? "contain") === m ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground")}>{m === "contain" ? "Fit whole" : "Fill"}</button>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">Vertical</span>
                      <input type="range" min={0} max={100} value={deck.presenterFit?.y ?? 50} onChange={(e) => setFit({ y: Number(e.target.value) })} className="w-24 accent-brand-500" title="Top ↔ bottom — pull the head into frame" />
                    </label>
                    <label className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">Zoom</span>
                      <input type="range" min={60} max={140} value={Math.round((deck.presenterFit?.zoom ?? 1) * 100)} onChange={(e) => setFit({ zoom: Number(e.target.value) / 100 })} className="w-24 accent-brand-500" title="Zoom the presenter in / out" />
                    </label>
                    <button onClick={() => setFit(null)} className="ms-auto rounded-md border border-border px-2 py-1 font-bold text-muted-foreground hover:border-brand-500">Reset</button>
                    <span className="w-full text-[10px] text-muted-foreground sm:w-auto">Applies to intro, moments &amp; outro</span>
                  </div>
                </>
              ) : (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-2xl">
                  <StageLayoutView
                    layout={deck.stageLayout}
                    fullVisual={["hero_statement", "full_visual", "big_idea", "quote", "section_divider", "closing"].includes(slide.layout ?? "")}
                    slide={<DeckSlideView slide={slide} reveal={previewStep} styleKey={deck.visualStyle} hand={deck.handStyle} board={deck.boardStyle} writeMs={previewWriteMs} />}
                    cohost={loopUrl ? <video src={loopUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" /> : null}
                  />
                  {(slide.steps ?? 1) > 1 ? <button onClick={() => { setPreviewStep(1); const a = previewAudioRef.current; if (a) a.currentTime = 0; }} title="Replay the drawing" className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur hover:bg-black/70"><RotateCcw className="h-3.5 w-3.5" /> Replay</button> : null}
                  {slide.narration?.audioUrl ? (
                    <audio
                      ref={previewAudioRef}
                      key={slide.id}
                      src={slide.narration.audioUrl}
                      autoPlay
                      controls
                      onTimeUpdate={(e) => {
                        // Advance the reveals in step with the voice: reveal each bullet as the
                        // narration crosses its content-aware mark, so the preview matches the room.
                        const a = e.currentTarget;
                        if (!a.duration || !isFinite(a.duration)) return;
                        previewDurRef.current = a.duration; // feeds the per-step hand-writing pace
                        const { fracs, steps } = previewFracsRef.current;
                        if (steps < 2) return;
                        const frac = a.currentTime / a.duration;
                        const target = fracs && fracs.length >= 2 && fracs.length === steps
                          ? revealStepAt(frac, fracs, steps)
                          : Math.min(steps, Math.max(1, Math.floor(frac * steps) + 1));
                        setPreviewStep((p) => (target > (p ?? 1) ? target : p));
                      }}
                      onEnded={() => setPage((p) => Math.min(deck.slides.length - 1, p + 1))}
                      className="absolute inset-x-3 bottom-3 w-[calc(100%-1.5rem)]"
                    />
                  ) : (
                    <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/75 px-3 py-2 text-center text-[11px] font-semibold text-amber-300">No narration for this slide yet — generate it in Prepare presenter.</div>
                  )}
                </div>
              )}
            </div>
          ) : slide ? (
            <div className="aspect-video w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl"><DeckSlideView slide={slide} styleKey={deck.visualStyle} hand={deck.handStyle} board={deck.boardStyle} /></div>
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

            {/* Presenter role — set what this slide IS: normal content, the opening intro, a
                between-slide talking moment, or the closing outro. Fixes mis-generated structure. */}
            <div className="rounded-xl border border-border bg-muted/40 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold"><Film className="h-3.5 w-3.5 text-brand-400" /> Presenter role</div>
              {/* Deck-wide summary — the REAL presenter video on each role slide (intro / moments /
                  closing), hover to play, click to jump. So you SEE what's attached, not just a tag. */}
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {(() => {
                  const items: { label: string; idx: number; url: string | null | undefined }[] = [];
                  const introIdx = deck.slides.findIndex((s) => s.intro);
                  if (introIdx >= 0) items.push({ label: "Intro", idx: introIdx, url: deck.introVideoUrl });
                  let mN = 0;
                  deck.slides.forEach((s, i) => { if (s.presenterMoment) { mN++; items.push({ label: momentTotal > 1 ? `Moment ${mN}` : "Moment", idx: i, url: s.momentVideoUrl }); } });
                  const closingIdx = deck.slides.findIndex((s) => s.outro);
                  if (closingIdx >= 0) items.push({ label: "Closing", idx: closingIdx, url: deck.outroVideoUrl });
                  if (!items.length) return <div className="col-span-3 rounded-lg border border-dashed border-border px-2 py-2 text-[10px] text-muted-foreground">No presenter videos yet — set a slide’s role below, then generate / reuse / upload its video in Prepare presenter.</div>;
                  return items.map((it, k) => (
                    <button key={k} onClick={() => setPage(it.idx)} title={`${it.label} — slide ${it.idx + 1}`} className={cn("group overflow-hidden rounded-lg border text-left", it.idx === page ? "border-brand-500" : "border-border hover:border-brand-500/60")}>
                      <div className="relative aspect-video w-full bg-black">
                        {it.url
                          ? <video src={it.url} muted loop playsInline onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} className="h-full w-full object-cover" />
                          : <div className="grid h-full w-full place-items-center bg-muted text-center text-[8px] font-bold leading-tight text-muted-foreground">not<br/>made</div>}
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[8px] font-black text-white">{it.idx + 1}</span>
                      </div>
                      <div className="truncate px-1.5 py-1 text-[9.5px] font-bold">{it.label}</div>
                    </button>
                  ));
                })()}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {([
                  { r: "content" as const, label: "Content" },
                  { r: "intro" as const, label: "Intro" },
                  { r: "moment" as const, label: "Moment" },
                  { r: "closing" as const, label: "Closing" },
                ]).map(({ r, label }) => {
                  const on = roleOf(slide) === r;
                  return <button key={r} onClick={() => setRole(r)} className={cn("rounded-lg px-1.5 py-1.5 text-[10.5px] font-bold transition", on ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "border border-border text-muted-foreground hover:border-brand-500")}>{label}</button>;
                })}
              </div>
              <div className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                {roleOf(slide) === "intro" ? "The opening — the co-host introduces the session here (plays the intro film). One per deck."
                  : roleOf(slide) === "moment" ? "A between-slide bridge — the co-host appears full-screen and speaks. Generate its clip in Prepare presenter → Talking moments."
                  : roleOf(slide) === "closing" ? "The sign-off — the presenter’s outro film plays here. One per deck, usually your last slide."
                  : "A normal slide with your content, narrated by the co-host."}
              </div>
              {roleOf(slide) === "closing" && !deck.outroVideoUrl ? <p className="mt-1.5 text-[10px] font-semibold text-amber-500">Generate the outro in <b>Prepare presenter</b> and it’ll play right here.</p> : null}
              {roleOf(slide) === "intro" && !deck.introVideoUrl ? <p className="mt-1.5 text-[10px] font-semibold text-amber-500">Generate the intro in <b>Prepare presenter</b>.</p> : null}
            </div>
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

            {/* SLIDE MEDIA — replace with your own image/video, regenerate, or turn into an AI video (in place). */}
            {slide.type === "doc" ? (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-300"><ImageIcon className="h-3.5 w-3.5" /> Slide media</div>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black ring-1 ring-border">
                  {slide.videoUrl ? (
                    <video key={slide.videoUrl} src={slide.videoUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
                  ) : slide.infographic?.cards?.length ? (
                    <div className="h-full w-full"><DeckSlideView slide={slide} styleKey={deck.visualStyle} /></div>
                  ) : slide.visual?.kind === "image" && slide.visual.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={slide.visual.url} src={slide.visual.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#241f38] to-[#14121f] text-[30px]">{slide.visual?.emoji ?? "🎯"}</div>
                  )}
                  {slide.videoUrl ? <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur">▶ Video</span> : slide.infographic?.cards?.length ? <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-brand-300 backdrop-blur">✨ Animated</span> : null}
                  {mediaBusy ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/65 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2 text-white"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-[11px] font-semibold">{mediaBusy === "aivideo" ? "Rendering video…" : mediaBusy === "illustration" ? "Designing illustration…" : mediaBusy === "regen" ? "Generating image…" : "Uploading…"}</span></div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button onClick={() => void genIllustration()} disabled={!!mediaBusy} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-2 py-2 text-[11.5px] font-extrabold text-white hover:opacity-95 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Animate this slide</button>
                  <button onClick={() => mediaInputRef.current?.click()} disabled={!!mediaBusy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-bold hover:border-brand-500 disabled:opacity-50"><Upload className="h-3.5 w-3.5" /> Upload</button>
                  <button onClick={() => void regenImage()} disabled={!!mediaBusy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-bold hover:border-brand-500 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> New image</button>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground"><b className="text-foreground">Animate this slide</b> designs an on-subject diagram (cards, icons, connectors) that draws itself in step with the narration — no video render. Or upload your own image/video. <button onClick={() => setAiVideoOpen(true)} disabled={!!mediaBusy} className="text-brand-400 underline disabled:opacity-50">Prefer a rendered AI video?</button></p>
                <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMedia(f); e.target.value = ""; }} />
              </div>
            ) : null}

            {/* ANIMATION — the AI presenter's hand marks a keyword as it's spoken. */}
            {slide.type === "doc" ? (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-300"><Sparkles className="h-3.5 w-3.5" /> Hand animation</div>
                <label className="block">
                  <span className="mb-1 block text-[10.5px] font-bold text-muted-foreground">Keyword the hand marks</span>
                  <input value={slide.highlight ?? ""} onChange={(e) => editSlide({ highlight: e.target.value })} placeholder="a 2–4 word phrase from the slide" className="w-full rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
                </label>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {[...ANNOTATE_VARIANTS, { v: "none" as const, icon: "∅", label: "None", hint: "" }].map(({ v, icon, label }) => {
                    const cur = slide.highlight ? (slide.annotate ?? "circle") : "none";
                    const on = cur === v;
                    return (
                      <button key={v} onClick={() => {
                        if (v === "none") { editSlide({ annotate: undefined, highlight: undefined }); return; }
                        const src = (slide.bullets?.[0] || slide.subtitle || "").replace(/\*\*/g, "").trim();
                        const hl = slide.highlight || src.split(/\s+/).slice(0, 3).join(" ").replace(/[:.,;]+$/, "");
                        editSlide({ annotate: v as DeckSlide["annotate"], highlight: hl.length >= 3 ? hl : slide.highlight });
                      }} className={cn("inline-flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[10.5px] font-bold", on ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-border hover:border-brand-500")}><span>{icon}</span> {label}</button>
                    );
                  })}
                </div>
                <button onClick={() => { setPreviewClip(null); setPreviewing(true); }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-500/50 py-2 text-[11px] font-bold text-brand-300 hover:bg-brand-500/10"><Play className="h-3.5 w-3.5" /> Preview animation</button>
              </div>
            ) : null}

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

      {/* REGENERATE ONE SLIDE — pick a layout + the hand animation style. */}
      {newSlideOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={() => { if (!newSlideBusy) setNewSlideOpen(false); }}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Plus className="h-5 w-5" /></span><div className="min-w-0"><b className="block text-[15px]">Add a slide</b><span className="text-[11.5px] text-muted-foreground">Inserted after slide {page + 1} and fitted to your training.</span></div></div>
            <div className="space-y-3 p-5">
              <label className="block"><span className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">What should this slide cover?</span>
                <textarea autoFocus value={newSlidePrompt} onChange={(e) => setNewSlidePrompt(e.target.value)} placeholder="e.g. a real-world example of tool use · a comparison of X vs Y · a quick recap of the key points…" className="min-h-[84px] w-full resize-y rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
              </label>
              {narratedCount > 0 ? (
                <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[11.5px] leading-snug text-amber-200"><span className="mt-[1px]">⚠️</span><span>Narration is already generated for {narratedCount} slide{narratedCount === 1 ? "" : "s"}. After adding this slide you’ll need to <b>regenerate the full narration</b> so it’s voiced and the timing stays in sync.</span></div>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3.5">
              <button onClick={() => { setNewSlideOpen(false); addSlide(); }} disabled={newSlideBusy} className="rounded-lg border border-border px-3 py-2 text-[12px] font-bold hover:border-brand-500 disabled:opacity-50">Blank slide</button>
              <div className="flex items-center gap-2">
                <button onClick={() => setNewSlideOpen(false)} disabled={newSlideBusy} className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-bold hover:border-brand-500 disabled:opacity-50">Cancel</button>
                <button onClick={() => void genNewSlide()} disabled={newSlideBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-extrabold text-white disabled:opacity-60">{newSlideBusy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</> : <><Sparkles className="h-3.5 w-3.5" /> Generate slide</>}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {aiVideoOpen && slide ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={() => setAiVideoOpen(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Film className="h-5 w-5" /></span><div className="min-w-0"><b className="block text-[15px]">Turn this into an AI video</b><span className="text-[11.5px] text-muted-foreground">A ~15s muted demonstration clip renders in place on the slide.</span></div></div>
            <div className="p-5">
              <span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Style</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[["3d", "🧊 3D animation"], ["cinematic", "🎬 Cinematic"], ["realistic", "📷 Realistic"], ["illustration", "🎨 Illustration"]].map(([v, lbl]) => (
                  <button key={v} onClick={() => setAiVideoStyle(v)} className={cn("rounded-lg border px-2.5 py-2 text-[11.5px] font-bold", aiVideoStyle === v ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-border hover:border-brand-500")}>{lbl}</button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">Uses credits for the render. The clip replaces this slide’s image and plays muted while you present.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              <button onClick={() => setAiVideoOpen(false)} className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-bold hover:border-brand-500">Cancel</button>
              <button onClick={() => void genAiVideo(aiVideoStyle)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-extrabold text-white"><Film className="h-3.5 w-3.5" /> Generate video</button>
            </div>
          </div>
        </div>
      ) : null}

      {animOpen ? (
        <AnimationStudio
          deck={deck}
          page={page}
          setPage={setPage}
          onEditSlide={editSlide}
          onEditDeck={editDeck}
          styleKey={deck.visualStyle}
          onClose={() => setAnimOpen(false)}
        />
      ) : null}

      {regenOpen && slide ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={() => setRegenOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><RefreshCw className="h-5 w-5" /></span><div className="min-w-0"><b className="block text-[15px]">Regenerate this slide</b><span className="text-[11.5px] text-muted-foreground">{slide.type === "doc" ? "Rewrite it, and choose a layout + how the presenter marks it." : slide.type === "whiteboard" || slide.type === "livedraw" ? "Rewrite the board, and choose how it's drawn on." : "Rewrite this slide."}</span></div></div>
            <div className="space-y-3.5 p-5">
              <label className="block"><span className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">What to change (optional)</span>
                <textarea value={regenInstr} onChange={(e) => setRegenInstr(e.target.value)} placeholder="e.g. make it a comparison, add a real example, simpler language…" className="min-h-[56px] w-full resize-y rounded-lg border border-border bg-muted px-2.5 py-2 text-[12px] outline-none focus:border-brand-500" />
              </label>
              {slide.type === "doc" ? (
                <>
                  <div><span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Layout</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[["auto", "Auto"], ["hero_statement", "Hero"], ["image_explanation", "Image + text"], ["data_spotlight", "Big stat"], ["key_takeaways", "Takeaways"], ["comparison_table", "Comparison"], ["problem_solution_result", "Problem→Solution"], ["step_process", "Steps"], ["question_answer", "Q&A"], ["case_study", "Case study"], ["concept_3d_callouts", "3D callouts"], ["quote", "Quote"]].map(([v, lbl]) => (
                        <button key={v} onClick={() => setRegenLayout(v)} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-bold", regenLayout === v ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-border hover:border-brand-500")}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  <div><span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Hand animation (on the key phrase)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[...ANNOTATE_VARIANTS, { v: "none" as const, icon: "∅", label: "None", hint: "" }].map(({ v, icon, label }) => (
                        <button key={v} onClick={() => setRegenAnn(v as NonNullable<DeckSlide["annotate"]> | "none")} className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold", regenAnn === v ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-border hover:border-brand-500")}><span>{icon}</span> {label}</button>
                      ))}
                    </div>
                  </div>
                </>
              ) : slide.type === "whiteboard" || slide.type === "livedraw" ? (
                <div><span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">How the diagram is drawn</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[["keep", "Keep current", "No change"], ["live", "✍️ Live hand draws it", "Hand sketches each stroke"], ["build", "🧩 Build piece by piece", "Nodes appear as narrated"], ["instant", "⚡ Show all at once", "Whole diagram at once"]].map(([v, lbl, hint]) => (
                      <button key={v} onClick={() => setRegenDraw(v as "keep" | "live" | "build" | "instant")} className={cn("rounded-lg border px-2.5 py-2 text-left", regenDraw === v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500")}>
                        <b className="block text-[11px] font-bold">{lbl}</b><span className="block text-[9.5px] leading-tight text-muted-foreground">{hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">A whiteboard slide animates by how its <b className="text-foreground">diagram</b> is drawn on. The circle / box / arrow hand-marks are for the <b className="text-foreground">text on document slides</b> — set those in the Animation Studio. Preview after.</p>
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              <button onClick={() => setRegenOpen(false)} className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-bold hover:border-brand-500">Cancel</button>
              <button onClick={() => void regenerate()} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-extrabold text-white"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* REBUILD — regenerate the whole deck with the new content-aware layouts. */}
      {rebuildOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={() => setRebuildOpen(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 pt-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Sparkles className="h-5 w-5" /></span><b className="text-[15px]">Rebuild the whole presentation?</b></div>
            <p className="px-5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">The agent regenerates every slide with the new content-aware layouts — hero, comparison, data-spotlight, live-draw and more — keeping your AI presenter. Your narration and talking videos reset for the new slides, so regenerate them after.</p>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              <button onClick={() => setRebuildOpen(false)} className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-bold hover:border-brand-500">Cancel</button>
              <button onClick={() => void rebuildAll()} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-extrabold text-white"><Sparkles className="h-3.5 w-3.5" /> Rebuild</button>
            </div>
          </div>
        </div>
      ) : null}

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
            {voiceStale ? (
              <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/[0.08] px-5 py-2.5 text-[11.5px] font-semibold text-amber-300">
                <RotateCcw className="h-3.5 w-3.5 shrink-0" /> You changed the presenter&apos;s voice{presenter?.voiceName ? ` to ${presenter.voiceName}` : ""}. Regenerate the narration and talking videos so the whole session speaks in the new voice.
              </div>
            ) : null}
            <div className="max-h-[58vh] space-y-2.5 overflow-auto p-4">
              {([
                { k: "narration", label: "Voice narration", done: ready.narration, meta: `${narratedCount}/${deck.slides.length} slides`, busyKey: "narrate" as const, run: narrate, preview: null as string | null, show: () => { setPrepOpen(false); setPreviewClip(null); setPreviewing(true); } },
                { k: "loop", label: "Moving avatar (loops in the corner tile)", done: ready.loop, meta: ready.loop ? "Ready" : "Not generated", busyKey: "animate" as const, run: animate, preview: (deck.presenterVideoUrl ?? presenter?.loopVideoUrl) ?? null, show: () => { setPrepOpen(false); setPreviewClip(null); setPreviewing(true); } },
                { k: "intro", label: "Intro — presenter on screen", done: ready.intro, meta: ready.intro ? "Ready" : "Not generated", busyKey: "introfilm" as const, run: () => genFilm("intro"), preview: deck.introVideoUrl ?? null, show: () => openClipPreview(deck.introVideoUrl ?? null) },
                { k: "outro", label: "Outro — presenter on screen", done: ready.outro, meta: ready.outro ? (outroPlaced ? "Ready" : "Ready · set a Closing slide") : "Not generated", busyKey: "outrofilm" as const, run: () => genFilm("outro"), preview: deck.outroVideoUrl ?? null, show: () => openClipPreview(deck.outroVideoUrl ?? null) },
                ...momentRows,
              ]).map((a) => (
                <div key={a.k} className={cn("flex items-center gap-3 rounded-xl border p-3 transition-colors", busy === a.busyKey ? "border-brand-500 bg-brand-500/5" : "border-border bg-muted/40")}>
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", a.done ? "bg-emerald-500/15 text-emerald-400" : busy === a.busyKey ? "bg-brand-500/15 text-brand-400" : "bg-muted text-muted-foreground")}>{a.done ? <Check className="h-4 w-4" /> : busy === a.busyKey ? <Loader2 className="h-4 w-4 animate-spin" /> : busy !== null ? <Loader2 className="h-4 w-4 animate-spin opacity-25" /> : <Film className="h-4 w-4" />}</span>
                  {a.preview ? <video src={a.preview} muted loop autoPlay playsInline className="h-11 w-[74px] shrink-0 rounded-lg object-cover" /> : null}
                  <div className="min-w-0 flex-1"><b className="block text-[12.5px]">{a.label}</b><span className="text-[11px] text-muted-foreground">{busy === a.busyKey ? "Generating…" : busy !== null && !a.done ? "Queued…" : a.meta}</span></div>
                  {a.done ? <button onClick={a.show} disabled={busy !== null} title="Load it onto the stage to see & hear it" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand-500/50 px-2.5 py-1.5 text-[11px] font-bold text-brand-300 hover:bg-brand-500/10 disabled:opacity-40"><Play className="h-3 w-3" /> Preview</button> : null}
                  {a.k === "intro" || a.k === "outro" ? <button onClick={() => void openReuse(a.k as "intro" | "outro")} disabled={busy !== null} title="Reuse an intro/outro you already generated" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-brand-500 disabled:opacity-40"><RotateCcw className="h-3 w-3" /> Reuse</button> : null}
                  {a.k.startsWith("moment:") ? <>
                    <button onClick={() => void openReuse("moment", a.k.slice(7))} disabled={busy !== null} title="Reuse a talking-moment video from your library" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-brand-500 disabled:opacity-40"><RotateCcw className="h-3 w-3" /> Reuse</button>
                    <button onClick={() => { uploadMomentSlideRef.current = a.k.slice(7); momentUploadRef.current?.click(); }} disabled={busy !== null} title="Upload your own video for this moment" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-brand-500 disabled:opacity-40"><Upload className="h-3 w-3" /> Upload</button>
                  </> : null}
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

      {/* Hidden input for "Upload" on a talking moment — attaches your own video to that moment. */}
      <input ref={momentUploadRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; const sid = uploadMomentSlideRef.current; uploadMomentSlideRef.current = null; if (f && sid) void uploadMomentVideo(sid, f); e.target.value = ""; }} />

      {/* Reuse library — pick a previously-generated intro / outro / moment (no re-render). Sits above Prepare. */}
      {reuseKind ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => setReuseKind(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><RotateCcw className="h-5 w-5" /></span>
              <div className="min-w-0"><b className="block text-[15px]">Reuse a saved {reuseKind}</b><span className="text-[11.5px] text-muted-foreground">Drop in an {reuseKind} you already made — no re-render. Clips in this deck&apos;s voice are marked.</span></div>
              <button onClick={() => setReuseKind(null)} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold hover:border-brand-500"><X className="h-4 w-4" /> Close</button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-4">
              {reuseLoading ? (
                <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : reuseClips.length === 0 ? (
                <div className="grid place-items-center py-12 text-center text-muted-foreground"><Film className="mb-2 h-8 w-8 opacity-40" /><p className="text-[13px]">No saved {reuseKind}s yet.</p><p className="mt-1 text-[11.5px]">Generate one and it&apos;s saved here to reuse on any deck.</p></div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {reuseClips.map((c) => (
                    <div key={c.id} className={cn("group flex flex-col overflow-hidden rounded-xl border bg-muted/40", c.sameVoice ? "border-brand-500/50" : "border-border")}>
                      <div className="relative aspect-video w-full overflow-hidden bg-black">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video src={c.videoUrl} muted loop playsInline onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} className="h-full w-full object-cover" />
                        <span className={cn("absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white", c.sameVoice ? "bg-emerald-500/90" : "bg-amber-500/90")}>{c.sameVoice ? "SAME VOICE" : "OTHER VOICE"}</span>
                        <button onClick={() => void deleteClip(c.id)} title="Remove from library" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-black/55 text-white opacity-0 transition hover:bg-rose-500 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1 p-2.5">
                        <b className="truncate text-[12px]">{c.presenterName || "Presenter"}</b>
                        {c.script ? <span className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{c.script}</span> : null}
                        <button onClick={() => applyClip(c)} className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3 py-1.5 text-[11.5px] font-bold text-white"><Check className="h-3.5 w-3.5" /> Use this {reuseKind}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
  busy: null | "gen" | "regen" | "rebuild" | "video" | "save" | "narrate" | "animate" | "introfilm" | "outrofilm" | "moments" | `moment:${string}`;
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
            <button onClick={onPrepare} title="Talking moments between slides — open Prepare presenter" className={cn("inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold hover:border-brand-500", momentReady === momentTotal ? "border-emerald-500/40 text-emerald-400" : "border-border")}>{busy?.startsWith("moment") ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {momentReady === momentTotal ? `Moments ✓ (${momentTotal})` : `Moments (${momentReady}/${momentTotal})`}</button>
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
