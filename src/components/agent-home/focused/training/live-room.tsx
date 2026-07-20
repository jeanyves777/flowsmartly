"use client";

/**
 * The live room — a stage, not a pipeline.
 *
 * On desktop: tool rail left, stage centre, roster right, controls below.
 * On a phone: the stage is full-bleed and the rail + roster become overlays,
 * with a Zoom-style control bar (device pickers, more menu). The host keeps the
 * pen and can draw on top of ANY stage source, including someone else's shared
 * screen — that combination is what makes this a training room rather than a
 * meeting. [[training-studio]]
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MousePointer2, Pencil, Highlighter, Eraser, Square, Type, StickyNote, Flashlight,
  Undo2, Trash2, Presentation, PenLine, FileText, Monitor, Video, Hand, Mic, MicOff,
  VideoOff, Circle, Users, LogOut, Paperclip, ChevronLeft, ChevronRight, Star, X,
  Minus, MoveUpRight, Triangle, Diamond, ChevronDown, ChevronUp, PanelLeftClose,
  PanelLeftOpen, Eye, EyeOff, MoreHorizontal,
  Send, Check, Square as StopIcon, Save, Volume2, Pause, Play, Focus, Rows3, Columns3, PanelBottom, MessageSquare, LayoutGrid, HelpCircle,
  SkipForward, RotateCcw, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TrainingBoard, type BoardCursor, type ShapeKind } from "./training-board";
import { useMedia, type RemoteStream, type DeviceOption } from "./use-media";
import { InviteSheet, Sheet } from "./invite-sheet";
import { DeckSlideView } from "./deck-slide-view";
import { VideoSheet } from "./video-sheet";
import { canDraw as canDrawFn, canShareScreen, isHost } from "@/lib/training/access";
import type { BoardItem, BoardTool, LiveStroke, StageSource, TrainingParticipantDTO, TrainingSessionDTO, TrainingMessageDTO, PresenterAnswer } from "@/lib/training/types";

const SHAPES: { id: ShapeKind; Icon: typeof Square; label: string }[] = [
  { id: "rect", Icon: Square, label: "Rectangle" },
  { id: "ellipse", Icon: Circle, label: "Ellipse" },
  { id: "triangle", Icon: Triangle, label: "Triangle" },
  { id: "diamond", Icon: Diamond, label: "Diamond" },
  { id: "line", Icon: Minus, label: "Line" },
  { id: "arrow", Icon: MoveUpRight, label: "Arrow" },
];

/** A live track. Muted for our own preview, or we'd howl with feedback.
 *  Named VideoFeed, not Video — lucide already exports a `Video` icon here. */
function VideoFeed({ stream, mirror, muted, className }: { stream: MediaStream; mirror?: boolean; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn("h-full w-full object-cover", mirror && "-scale-x-100", className)}
    />
  );
}

/** The AI presenter's looping avatar clip. It MOVES only while `speaking` (the narration
 *  audio is playing) and FREEZES otherwise — so the avatar is driven by the voice instead
 *  of looping forever. Muted (the cloned voice plays through the shared narration audio).
 *  Falls back to the still portrait poster before the first play. */
function AvatarVideo({ url, poster, speaking, className }: { url: string; poster?: string | null; speaking: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (speaking) { v.play().catch(() => {}); } else { try { v.pause(); } catch { /* ignore */ } }
  }, [speaking]);
  return (
    <video
      ref={ref}
      src={url}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

/** Remote audio has to be in the DOM to be heard, but must never be seen.
 *  When a speaker device is chosen we route playback there via setSinkId. */
function AudioSink({ remotes, spkId }: { remotes: RemoteStream[]; spkId: string | null }) {
  return (
    <>
      {remotes
        .filter((r) => r.kind === "audio")
        .map((r) => (
          <audio
            key={`${r.participantId}-audio`}
            autoPlay
            ref={(el) => {
              if (!el) return;
              if (el.srcObject !== r.stream) el.srcObject = r.stream;
              const sink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
              if (spkId && typeof sink.setSinkId === "function") sink.setSinkId(spkId).catch(() => {});
            }}
          />
        ))}
    </>
  );
}

const TOOLS: { id: BoardTool; Icon: typeof Pencil; title: string }[] = [
  { id: "sel", Icon: MousePointer2, title: "Select" },
  { id: "pen", Icon: Pencil, title: "Pen" },
  { id: "hi", Icon: Highlighter, title: "Highlighter" },
  { id: "era", Icon: Eraser, title: "Eraser" },
  { id: "shape", Icon: Square, title: "Shape" },
  { id: "text", Icon: Type, title: "Text" },
  { id: "note", Icon: StickyNote, title: "Sticky note" },
  { id: "laser", Icon: Flashlight, title: "Laser pointer" },
];
const INKS = ["#111827", "#6366f1", "#e11d48", "#10b981", "#f59e0b"];
const SOURCES: { id: StageSource; Icon: typeof PenLine; label: string }[] = [
  { id: "slides", Icon: Presentation, label: "Slides" },
  { id: "board", Icon: PenLine, label: "Whiteboard" },
  { id: "doc", Icon: FileText, label: "Document" },
  { id: "screen", Icon: Monitor, label: "Screen" },
  { id: "cam", Icon: Video, label: "Presenter" },
];

interface Props {
  session: TrainingSessionDTO;
  me: TrainingParticipantDTO;
  cursors: BoardCursor[];
  liveStrokes?: Record<string, LiveStroke>;
  liveItems?: Record<string, BoardItem>;
  connected: boolean;
  onAdd: (item: BoardItem) => void;
  onRemove: (itemId: string) => void;
  onUpdate: (item: BoardItem) => void;
  onPing: (x: number, y: number, laser: boolean) => void;
  onLiveStroke?: (stroke: LiveStroke | null) => void;
  onLiveItem?: (item: BoardItem | null) => void;
  onUndo: () => void;
  onClear: () => void;
  act: (action: string, participantId?: string) => Promise<string | null>;
  patch: (body: Record<string, unknown>) => Promise<string | null>;
  messages: TrainingMessageDTO[];
  sendMessage: (text: string) => Promise<string | null>;
  presenterAnswer?: PresenterAnswer | null;
  onAsk?: (question: string) => Promise<string | null>;
  onClearAnswer?: () => void;
  onLeave: () => void;
  onManage: () => void;
  /** owner-only — ends the session for everyone */
  onEnd: () => void;
}

type SheetKey = null | "invite" | "roster";

export function LiveRoom({ session, me, cursors, liveStrokes, liveItems, connected, onAdd, onRemove, onUpdate, onPing, onLiveStroke, onLiveItem, onUndo, onClear, act, patch, messages, sendMessage, presenterAnswer, onAsk, onClearAnswer, onLeave, onManage, onEnd }: Props) {
  const [tool, setTool] = useState<BoardTool>("pen");
  const [ink, setInk] = useState(INKS[0]);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [showTools, setShowTools] = useState(true); // desktop pen rail
  const [toolDock, setToolDock] = useState(false); // mobile overlay dock
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [devMenu, setDevMenu] = useState<null | "audio">(null); // anchored mic/speaker popover
  const [videoSheet, setVideoSheet] = useState(false); // camera + virtual background
  const [moreMenu, setMoreMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChat, setSeenChat] = useState(0); // messages read → drives the unread badge
  const unread = Math.max(0, messages.length - seenChat);
  useEffect(() => { if (chatOpen) setSeenChat(messages.length); }, [chatOpen, messages.length]);
  // A proper new-message notification: a toast pops up when a message lands while
  // the chat is closed (and it isn't your own). Tap it to open the chat.
  const [chatToast, setChatToast] = useState<TrainingMessageDTO | null>(null);
  const prevMsgLen = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgLen.current) {
      const last = messages[messages.length - 1];
      if (last && !chatOpen && last.participantId !== me.id) setChatToast(last);
    }
    prevMsgLen.current = messages.length;
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (chatOpen) setChatToast(null); }, [chatOpen]);
  useEffect(() => {
    if (!chatToast) return;
    const t = setTimeout(() => setChatToast(null), 5000);
    return () => clearTimeout(t);
  }, [chatToast]);
  // How the roster looks on a PHONE — the viewer's own choice (per device): a top
  // strip of tiles, or draggable floating bubbles over the board. Persisted local.
  const [mobileRoster, setMobileRoster] = useState<"float" | "top">("float");
  useEffect(() => { try { const v = localStorage.getItem("tg-mobile-roster"); if (v === "top" || v === "float") setMobileRoster(v); } catch {} }, []);
  const pickMobileRoster = (v: "float" | "top") => { setMobileRoster(v); try { localStorage.setItem("tg-mobile-roster", v); } catch {} };
  const hideItems = session.hideBoard; // synced: when the host hides, everyone hides
  const audioBtnRef = useRef<HTMLDivElement>(null);
  const videoBtnRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLDivElement>(null);

  // The board is measured from the stage and FILLS it — on every screen — so there's
  // no wasted black gutter around a letterboxed box. Marks are stored in fractional
  // (0..1) board coordinates, so a stroke lands in the same relative place on every
  // screen regardless of the board's aspect; the measured box just makes the render
  // deterministic (CSS aspect-video + max-h-full silently broke the ratio before).
  const stageRef = useRef<HTMLDivElement>(null);
  const [boardBox, setBoardBox] = useState<{ w: number; h: number } | null>(null);
  // The host can drag the spotlight tile anywhere over the stage.
  const spotWrapRef = useRef<HTMLDivElement>(null);
  const [spotPos, setSpotPos] = useState<{ x: number; y: number } | null>(null);
  const spotDrag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setBoardBox({ w: Math.round(width), h: Math.round(height) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Camera/mic/screen + device menus. Optional: with no media server this
  // reports enabled:false and the room runs as a whiteboard session.
  const media = useMedia(session.id, session.status === "live");

  const host = isHost(me.role);
  const iCanDraw = canDrawFn(me, session);
  const iHavePen = session.penHolderId === me.id;
  const inRoom = useMemo(() => session.participants.filter((p) => p.state === "ADMITTED"), [session.participants]);
  const waiting = useMemo(() => session.participants.filter((p) => p.state === "WAITING"), [session.participants]);
  const sharer = useMemo(() => session.participants.find((p) => p.sharing) ?? null, [session.participants]);
  const material = useMemo(() => session.materials.find((m) => m.id === session.stageKey) ?? null, [session.materials, session.stageKey]);
  const paged = session.stageSource === "slides" || session.stageSource === "doc";
  const [navOpen, setNavOpen] = useState(false);
  // A generated deck reveals STEP-BY-STEP within each slide; the pager drives both
  // the reveal step and the slide, so "next" builds the current slide up, then moves on.
  const deckSlide = material?.kind === "slides" && material.deck?.slides.length
    ? material.deck.slides[Math.min(session.stagePage, material.deck.slides.length) - 1]
    : null;
  const deckSteps = deckSlide?.steps ?? 0;
  const deckSlides = material?.kind === "slides" ? material.deck?.slides ?? null : null;
  const stepsOf = (page: number) => deckSlides ? (deckSlides[Math.min(page, deckSlides.length) - 1]?.steps ?? 1) : 1;
  // The stored step can be a "show everything" sentinel; work off the clamped value so
  // Prev/Next always move a real step instead of silently decrementing 999→998→…
  const curStep = deckSlide ? Math.min(session.stageStep || 1, deckSteps) : session.stageStep;
  const revealNext = () => {
    if (deckSlide && curStep < deckSteps) return void patch({ stageStep: curStep + 1 });
    const nextPage = Math.min(material?.pages ?? 1, session.stagePage + 1);
    void patch({ stagePage: nextPage, stageStep: nextPage !== session.stagePage ? 1 : curStep });
  };
  const revealPrev = () => {
    if (deckSlide && curStep > 1) return void patch({ stageStep: curStep - 1 });
    const prevPage = Math.max(1, session.stagePage - 1);
    void patch({ stagePage: prevPage, stageStep: stepsOf(prevPage) }); // land the previous slide fully revealed
  };
  // Jump straight to a slide (from the thumbnail navigator), fully revealed.
  const jumpTo = (page: number) => { setNavOpen(false); void patch({ stagePage: page, stageStep: stepsOf(page) }); };
  const atStart = session.stagePage <= 1 && (!deckSlide || curStep <= 1);
  const atEnd = session.stagePage >= (material?.pages ?? 1) && (!deckSlide || curStep >= deckSteps);
  // Auto-reveal: hands-free draw-along — advance a step every few seconds until the
  // current slide is fully revealed, then stop (the host stays in control of slides).
  const [autoReveal, setAutoReveal] = useState(false);
  useEffect(() => {
    if (!autoReveal || !host || !deckSlide || session.stageStep >= deckSteps) return;
    const t = setTimeout(() => void patch({ stageStep: session.stageStep + 1 }), 3200);
    return () => clearTimeout(t);
  }, [autoReveal, host, deckSlide, deckSteps, session.stageStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- AI presenter runtime -----
  // A narrated deck + an active presenter can be DELIVERED by the AI co-host: it plays
  // each slide's narration, reveals the diagram across it, and (host = conductor) moves
  // to the next slide when the audio ends. `aiPlaying` is synced so everyone hears it.
  const aiPresenter = deckSlide && material?.deck?.presenterActive && (material.deck.slides ?? []).some((s) => s.narration);
  const narration = deckSlide?.narration ?? null;
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiPlaying = !!session.aiPlaying;
  const [tookOver, setTookOver] = useState(false);
  // every client plays the current slide's narration while the AI is delivering. On a
  // NEW slide the audio restarts from 0; resuming the SAME slide keeps its position.
  useEffect(() => {
    const a = aiAudioRef.current;
    if (!a) return;
    if (aiPlaying && narration?.audioUrl) {
      if (a.getAttribute("data-src") !== narration.audioUrl) { a.src = narration.audioUrl; a.setAttribute("data-src", narration.audioUrl); a.currentTime = 0; }
      a.play().catch(() => {});
    } else { a.pause(); }
  }, [aiPlaying, narration?.audioUrl]);
  // host = conductor. Reveals track the AUDIO POSITION (so pause/resume/repeat just
  // work), and the deck advances when the narration ends. Latest state via a ref so the
  // listeners attach once and never read stale values.
  const aiStateRef = useRef({ session, deckSteps, pages: material?.pages ?? 1 });
  aiStateRef.current = { session, deckSteps, pages: material?.pages ?? 1 };
  useEffect(() => {
    const a = aiAudioRef.current;
    if (!host || !a) return;
    const onTime = () => {
      const { session: s, deckSteps: steps } = aiStateRef.current;
      if (!s.aiPlaying || !a.duration || !isFinite(a.duration) || steps < 1) return;
      const target = Math.min(steps, Math.max(1, Math.floor((a.currentTime / a.duration) * steps) + 1));
      if (target > (s.stageStep || 1)) void patch({ stageStep: target });
    };
    let advancing = false;
    const onEnd = () => {
      const { session: s, pages } = aiStateRef.current;
      if (advancing || !s.aiPlaying) return;
      advancing = true; setTimeout(() => { advancing = false; }, 900);
      if (s.stagePage < pages) void patch({ stagePage: s.stagePage + 1, stageStep: 1 });
      else void patch({ aiPlaying: false });
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd); };
  }, [host]); // eslint-disable-line react-hooks/exhaustive-deps
  // Controls — audio position IS the saved position, so resume never restarts a slide.
  const resumeAI = () => { setTookOver(false); void patch({ aiPlaying: true }); };
  const pauseAI = () => { aiAudioRef.current?.pause(); void patch({ aiPlaying: false }); };
  const skipAI = () => { const pages = material?.pages ?? 1; if (session.stagePage < pages) void patch({ stagePage: session.stagePage + 1, stageStep: 1, aiPlaying: true }); else void patch({ aiPlaying: false }); };
  const repeatAI = () => { const a = aiAudioRef.current; if (a) { a.currentTime = 0; } void patch({ stageStep: 1, aiPlaying: true }); };
  const takeoverAI = async () => {
    aiAudioRef.current?.pause();
    setTookOver(true);
    await patch({ aiPlaying: false });
    if (media.enabled && !media.micOn) { await media.toggleMic().catch(() => {}); await act("unmute", me.id); }
  };

  // ----- live Q&A ----- the answer plays for everyone (pausing narration) + overlays
  const answerAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = answerAudioRef.current;
    if (!a || !presenterAnswer?.audioUrl) return;
    aiAudioRef.current?.pause();
    a.src = presenterAnswer.audioUrl; a.currentTime = 0; a.play().catch(() => {});
  }, [presenterAnswer?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);
  const submitAsk = async () => {
    const q = askText.trim();
    if (!q || !onAsk || asking) return;
    setAsking(true);
    const e = await onAsk(q);
    setAsking(false);
    if (!e) { setAskText(""); setAskOpen(false); }
  };

  // ---- ASK BY VOICE — record a short clip, transcribe (Whisper), then ask ----
  const [recState, setRecState] = useState<"idle" | "rec" | "stt">("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const stopRec = () => { if (recRef.current && recState === "rec") recRef.current.stop(); };
  const startRec = async () => {
    if (recState !== "idle" || !onAsk) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mr = new MediaRecorder(stream, typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.("audio/webm") ? { mimeType: "audio/webm" } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!blob.size) { setRecState("idle"); return; }
        setRecState("stt");
        try {
          const fd = new FormData();
          fd.append("audio", blob, "question.webm");
          const j = await fetch(`/api/ai/training/${session.id}/presenter/transcribe`, { method: "POST", body: fd }).then((r) => r.json());
          if (j?.success && j.data.text) {
            setAskText(j.data.text);
            // auto-send the spoken question (the answer overlay shows it back)
            setAsking(true);
            const e2 = await onAsk(j.data.text);
            setAsking(false);
            if (!e2) { setAskText(""); setAskOpen(false); } else setAskOpen(true);
          } else {
            setAskOpen(true); // couldn't transcribe — let them type
          }
        } finally { setRecState("idle"); }
      };
      recRef.current = mr;
      mr.start();
      setRecState("rec");
    } catch { setRecState("idle"); }
  };

  const backdrop = useMemo(() => {
    if (session.stageSource === "board") return null;
    if (session.stageSource === "screen") {
      const feed =
        sharer?.id === me.id
          ? media.localScreen
          : media.remotes.find((r) => r.participantId === sharer?.id && r.source === "screen" && r.kind === "video")?.stream;
      if (feed) {
        return (
          <div className="h-full w-full bg-black">
            <VideoFeed stream={feed} muted className="object-contain" />
          </div>
        );
      }
      return (
        <div className="grid h-full w-full place-items-center bg-[#101318]">
          <div className="text-center">
            <Monitor className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-2 text-[12px] font-semibold text-slate-400">
              {sharer ? `Waiting for ${sharer.name}'s screen…` : "Nobody is sharing yet"}
            </p>
          </div>
        </div>
      );
    }
    if (session.stageSource === "cam") {
      const presenter = session.participants.find((p) => p.id === session.penHolderId) ?? me;
      const feed =
        presenter.id === me.id
          ? media.localCam
          : media.remotes.find((r) => r.participantId === presenter.id && r.source === "cam" && r.kind === "video")?.stream;
      return (
        <div className="relative grid h-full w-full place-items-center bg-gradient-to-br from-[#221a3a] to-[#3a2c5e]">
          {feed ? (
            <VideoFeed stream={feed} muted mirror={presenter.id === me.id} className="object-contain" />
          ) : presenter.isAI && presenter.videoUrl ? (
            <AvatarVideo url={presenter.videoUrl} poster={presenter.avatarUrl} speaking={!!session.aiPlaying} className="object-contain" />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-600 text-2xl font-black text-white">
              {presenter.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white">
            {presenter.name} · presenting
          </span>
        </div>
      );
    }
    // A generated AI deck — render the current slide, revealed up to stageStep so it
    // builds progressively as the host presents. The host draws right on top.
    if (material?.kind === "slides" && material.deck?.slides.length) {
      const slide = material.deck.slides[Math.min(session.stagePage, material.deck.slides.length) - 1];
      return slide ? <DeckSlideView slide={slide} reveal={session.stageStep} /> : null;
    }
    if (material?.kind === "image" || material?.kind === "video") {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={material.url} alt={material.name} className="h-full w-full object-contain" />;
    }
    if (material) {
      return (
        <div className="grid h-full w-full place-items-center bg-white">
          <div className="text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-[12px] font-semibold text-slate-600">{material.name}</p>
            <p className="text-[10px] text-slate-400">Page {session.stagePage} of {material.pages}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="grid h-full w-full place-items-center bg-white">
        <p className="text-[12px] text-slate-400">Nothing on the stage yet — add a material.</p>
      </div>
    );
  }, [session.stageSource, session.stagePage, session.penHolderId, session.participants, session.aiPlaying, material, sharer, me, media.localCam, media.localScreen, media.remotes]);

  const layout = session.rosterLayout ?? "side";
  const spotlight = session.spotlightId ? inRoom.find((p) => p.id === session.spotlightId) ?? null : null;
  const spotFeed = spotlight
    ? (spotlight.id === me.id ? media.localCam : media.remotes.find((r) => r.participantId === spotlight.id && r.source === "cam" && r.kind === "video")?.stream ?? null)
    : null;
  const onSpotlight = (id: string) => void patch({ spotlightId: session.spotlightId === id ? null : id });
  const rosterProps = { session, me, host, act, media, waiting, inRoom, onInvite: () => setSheet("invite"), onSpotlight };

  // ---- draggable spotlight (host positions it anywhere over the stage) ----
  const spotDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const wrap = spotWrapRef.current, tile = e.currentTarget;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect(), tr = tile.getBoundingClientRect();
    spotDrag.current = { sx: e.clientX, sy: e.clientY, ox: spotPos?.x ?? tr.left - wr.left, oy: spotPos?.y ?? tr.top - wr.top, moved: false };
    tile.setPointerCapture(e.pointerId);
  };
  const spotMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = spotDrag.current, wrap = spotWrapRef.current;
    if (!d || !wrap) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    const wr = wrap.getBoundingClientRect(), tile = e.currentTarget;
    const x = Math.max(6, Math.min(wr.width - tile.offsetWidth - 6, d.ox + (e.clientX - d.sx)));
    const y = Math.max(6, Math.min(wr.height - tile.offsetHeight - 6, d.oy + (e.clientY - d.sy)));
    setSpotPos({ x, y });
  };
  const spotUp = () => { spotDrag.current = null; };

  return (
    <div className="absolute inset-0 flex bg-background">
      {/* ---- desktop tool rail ---- */}
      {showTools ? (
        <div className="relative hidden w-[52px] shrink-0 flex-col items-center gap-1 border-e border-border bg-card py-2.5 md:flex">
          <ToolRail
            tool={tool} setTool={setTool} shapeKind={shapeKind} setShapeKind={setShapeKind}
            ink={ink} setInk={setInk} iCanDraw={iCanDraw} host={host} onUndo={onUndo} onClear={onClear}
          />
        </div>
      ) : null}

      {/* ---- stage column ---- */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* top: sources */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background/70 px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setShowTools((v) => !v)}
            title={showTools ? "Hide the drawing tools" : "Show the drawing tools"}
            className="hidden h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-foreground md:grid"
          >
            {showTools ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          {host ? (
            <button
              onClick={() => void patch({ hideBoard: !hideItems })}
              title={hideItems ? "Show the board to everyone" : "Hide the board for everyone"}
              className={cn(
                "me-1 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border transition",
                hideItems ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-foreground",
              )}
            >
              {hideItems ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
          {SOURCES.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => void patch({ stageSource: id })}
              disabled={!host}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition",
                session.stageSource === id
                  ? "border-transparent bg-gradient-to-br from-brand-500 to-violet-600 text-white"
                  : "border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-foreground",
                !host && "opacity-50",
              )}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
          <span className={cn(
            "ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold",
            iHavePen ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-border bg-card text-muted-foreground",
          )}>
            <Pencil className="h-3 w-3" />
            <span className="hidden sm:inline">{iHavePen ? "You have the pen" : `${session.participants.find((p) => p.id === session.penHolderId)?.name ?? "Nobody"} has the pen`}</span>
          </span>
        </div>

        {/* attendee strip on TOP — desktop uses it when the host picks the "top"
            layout; on a phone it's one of the two viewer styles (see mobileRoster). */}
        {layout === "top" ? <RosterStrip {...rosterProps} className="hidden md:flex" /> : null}
        {mobileRoster === "top" ? <RosterStrip {...rosterProps} className="md:hidden" /> : null}

        {/* stage — the inner ref measures the space, the board fills it. min-h-0 lets
            it SHRINK so the source bar + lesson card + control bar always stay on
            screen (no page scroll to reach the top tabs or the bottom menu). */}
        <div ref={spotWrapRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0e0e13] p-2.5 sm:p-3.5">
          {/* spotlight — a big tile everyone sees; the host can DRAG it anywhere */}
          {spotlight ? (
            <div className="pointer-events-none absolute z-[14] w-[38%] max-w-[240px]" style={spotPos ? { left: spotPos.x, top: spotPos.y } : { right: 12, top: 12 }}>
              <div
                onPointerDown={host ? spotDown : undefined}
                onPointerMove={host ? spotMove : undefined}
                onPointerUp={host ? spotUp : undefined}
                className={cn("pointer-events-auto relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-amber-400 bg-[#181820] shadow-2xl", host && "cursor-move touch-none")}
              >
                {spotFeed ? <VideoFeed stream={spotFeed} muted mirror={spotlight.id === me.id} /> : spotlight.isAI && spotlight.videoUrl ? (
                  <AvatarVideo url={spotlight.videoUrl} poster={spotlight.avatarUrl} speaking={!!session.aiPlaying} />
                ) : (
                  <div className="grid h-full w-full place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-lg font-black text-white">{spotlight.name.slice(0, 2).toUpperCase()}</span></div>
                )}
                <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-950"><Star className="h-2.5 w-2.5 fill-current" /> Spotlight</span>
                <span className="pointer-events-none absolute inset-x-2 bottom-1 truncate text-[11px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">{spotlight.name}</span>
                {host ? <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onSpotlight(spotlight.id)} title="Remove spotlight" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/55 text-white hover:bg-black/75"><X className="h-3 w-3" /></button> : null}
              </div>
            </div>
          ) : null}
          {/* phone: participants as movable floating bubbles over the board
              (the other phone style is the top strip above) */}
          {mobileRoster === "float" ? (
            <FloatingBubbles
              className="md:hidden"
              inRoom={inRoom}
              me={me}
              media={media}
              session={session}
              host={host}
              onSpotlight={onSpotlight}
              onOpenRoster={() => setSheet("roster")}
            />
          ) : null}
          <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="relative shadow-2xl" style={boardBox ? { width: boardBox.w, height: boardBox.h } : { width: "100%", maxWidth: 980, aspectRatio: "16 / 9" }}>
            <TrainingBoard
              doc={session.boardDoc}
              tool={tool}
              shapeKind={shapeKind}
              hideItems={hideItems}
              onUpdate={onUpdate}
              color={ink}
              canDraw={iCanDraw}
              cursors={cursors}
              liveStrokes={liveStrokes}
              liveItems={liveItems}
              onAdd={onAdd}
              onRemove={onRemove}
              onPing={onPing}
              onLiveStroke={onLiveStroke}
              onLiveItem={onLiveItem}
              backdrop={backdrop}
            />
            {/* AI presenter caption — what the co-host is saying right now */}
            {aiPlaying && narration?.text ? (
              <div className="pointer-events-none absolute bottom-[46px] left-1/2 z-[6] line-clamp-2 w-[min(78%,640px)] -translate-x-1/2 rounded-lg bg-black/60 px-3.5 py-1.5 text-center text-[12px] font-semibold leading-snug text-white shadow-lg backdrop-blur-sm">
                <span className="me-1.5 inline-flex items-center gap-1 rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1.5 py-0.5 align-middle text-[8px] font-black text-[#04222a]"><Volume2 className="h-2.5 w-2.5" /> AI</span>
                {narration.text}
              </div>
            ) : tookOver && aiPresenter ? (
              <div className="pointer-events-none absolute bottom-[92px] left-1/2 z-[6] w-[min(80%,560px)] -translate-x-1/2 rounded-xl border border-amber-500/40 bg-amber-500/[0.16] px-4 py-2 text-center text-[12.5px] font-bold text-amber-200 backdrop-blur-sm">
                <Hand className="me-1.5 inline h-3.5 w-3.5 align-middle" /> You have the floor — the AI is paused at its spot. Press <b>Resume AI</b> to continue.
              </div>
            ) : null}
            {/* live Q&A — the presenter's answer to a raised question */}
            {presenterAnswer ? (
              <div className="absolute bottom-[84px] left-1/2 z-[7] w-[min(86%,660px)] -translate-x-1/2 rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-400"><Hand className="h-2.5 w-2.5" /> {presenterAnswer.askedBy} asked</span>
                  <span className="truncate italic">“{presenterAnswer.question}”</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1.5 py-0.5 text-[8.5px] font-black text-[#04222a]"><Volume2 className="h-2.5 w-2.5" /> AI</span>
                  <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">{presenterAnswer.answer}</p>
                  {host ? <button onClick={() => { answerAudioRef.current?.pause(); onClearAnswer?.(); }} className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground">Dismiss</button> : null}
                </div>
              </div>
            ) : null}
            {/* Ask the presenter — any participant, while the AI presenter is on */}
            {aiPresenter && onAsk ? (
              askOpen ? (
                <div className="absolute bottom-3 right-3 z-[8] flex w-[min(90%,360px)] items-center gap-1 rounded-full border border-border bg-background/95 p-1.5 shadow-2xl backdrop-blur">
                  <button onClick={recState === "rec" ? stopRec : () => void startRec()} disabled={recState === "stt" || asking} title={recState === "rec" ? "Stop & send" : "Ask by voice"} className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full transition disabled:opacity-50", recState === "rec" ? "bg-rose-500 text-white" : "border border-brand-500/50 text-brand-400 hover:border-brand-500")}>
                    {recState === "stt" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : recState === "rec" ? <StopIcon className="h-3 w-3" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                  <input value={askText} onChange={(e) => setAskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submitAsk(); if (e.key === "Escape") setAskOpen(false); }} autoFocus disabled={recState !== "idle"} placeholder={recState === "rec" ? "Listening… tap ■ to send" : recState === "stt" ? "Transcribing…" : "Ask by voice or type…"} className="min-w-0 flex-1 bg-transparent px-2 text-[12px] outline-none placeholder:text-muted-foreground disabled:opacity-60" />
                  <button onClick={() => void submitAsk()} disabled={asking || !askText.trim()} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-brand-500 text-[#04222a] disabled:opacity-50"><Send className={cn("h-3.5 w-3.5", asking && "animate-pulse")} /></button>
                  <button onClick={() => { stopRec(); setAskOpen(false); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <button onClick={() => setAskOpen(true)} className="absolute bottom-3 right-3 z-[6] hidden items-center gap-1.5 rounded-full border border-brand-500/50 bg-background/90 px-3 py-1.5 text-[11px] font-bold text-brand-400 shadow-lg backdrop-blur hover:border-brand-500 md:inline-flex"><MessageSquare className="h-3.5 w-3.5" /> Ask the presenter</button>
              )
            ) : null}
            {paged && material ? (
              <>
                {/* clickable slide navigator — jump straight to any slide */}
                {navOpen && deckSlides ? (
                  <div className="absolute bottom-[52px] left-1/2 z-[7] w-[min(92%,640px)] -translate-x-1/2 rounded-2xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur">
                    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                      {deckSlides.map((s, i) => (
                        <button
                          key={s.id}
                          onClick={() => jumpTo(i + 1)}
                          disabled={!host}
                          title={s.title}
                          className={cn("relative shrink-0 overflow-hidden rounded-lg border-2 disabled:cursor-default", i + 1 === session.stagePage ? "border-brand-500" : "border-transparent hover:border-border")}
                        >
                          <div className="h-[64px] w-[112px]"><DeckSlideView slide={s} /></div>
                          <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded bg-black/60 px-1 text-[9px] font-extrabold text-white">{i + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="absolute bottom-3 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/85 px-2 py-1.5 backdrop-blur">
                  {deckSlides ? (
                    <button onClick={() => setNavOpen((v) => !v)} title="All slides" className={cn("grid h-[22px] w-[22px] place-items-center rounded border transition", navOpen ? "border-brand-500 text-brand-400" : "border-border text-muted-foreground hover:border-brand-500")}>
                      <LayoutGrid className="h-3 w-3" />
                    </button>
                  ) : null}
                  <button onClick={revealPrev} disabled={!host || atStart} className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500 disabled:opacity-30">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="min-w-[62px] text-center text-[10.5px] text-muted-foreground">
                    {deckSlide ? <>Slide {session.stagePage}/{material.pages}{deckSteps > 1 ? ` · reveal ${curStep}/${deckSteps}` : ""}</> : <>Page {session.stagePage} / {material.pages}</>}
                  </span>
                  <button onClick={revealNext} disabled={!host || atEnd} className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500 disabled:opacity-30">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  {host && aiPresenter ? (
                    <span className="ms-0.5 inline-flex items-center gap-1">
                      <button onClick={aiPlaying ? pauseAI : resumeAI} title={aiPlaying ? "Pause the AI presenter" : tookOver ? "Resume the AI presenter from where it paused" : "Let the AI presenter deliver this"} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold", aiPlaying ? "bg-gradient-to-br from-cyan-400 to-brand-500 text-[#04222a]" : "border border-brand-500/50 text-brand-400 hover:border-brand-500")}>
                        {aiPlaying ? <><Pause className="h-2.5 w-2.5" /> Pause AI</> : <><Volume2 className="h-2.5 w-2.5" /> {tookOver ? "Resume AI" : "Present with AI"}</>}
                      </button>
                      <button onClick={repeatAI} title="Repeat this slide" className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500"><RotateCcw className="h-3 w-3" /></button>
                      <button onClick={skipAI} title="Skip to the next slide" className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500"><SkipForward className="h-3 w-3" /></button>
                      <button onClick={takeoverAI} title="Take over — pause the AI and open your mic" className="grid h-[22px] w-[22px] place-items-center rounded border border-amber-500/50 text-amber-400 hover:border-amber-500"><Hand className="h-3 w-3" /></button>
                    </span>
                  ) : host && deckSlide && deckSteps > 1 ? (
                    <button onClick={() => setAutoReveal((v) => !v)} title="Auto-reveal — draw along hands-free" className={cn("ms-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold", autoReveal ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "border border-border text-muted-foreground hover:border-brand-500")}>
                      AUTO
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          </div>

          {/* mobile tool dock — an overlay, so it never steals board width */}
          {iCanDraw ? (
            <>
              {!toolDock ? (
                <button
                  onClick={() => setToolDock(true)}
                  title="Drawing tools"
                  className="absolute bottom-3 left-3 z-[25] grid h-[46px] w-[46px] place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg md:hidden"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              ) : (
                <div className="absolute bottom-3 left-3 z-[25] flex max-h-[calc(100%-24px)] w-[52px] flex-col items-center gap-1 overflow-auto rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => setToolDock(false)} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground"><X className="h-4 w-4" /></button>
                  <ToolRail
                    tool={tool} setTool={setTool} shapeKind={shapeKind} setShapeKind={setShapeKind}
                    ink={ink} setInk={setInk} iCanDraw={iCanDraw} host={host} onUndo={onUndo} onClear={onClear} compact
                  />
                </div>
              )}
            </>
          ) : null}

          {/* recording overlays live over the stage */}
          <RecordingLayer recording={session.recording} host={host} patch={patch} />

          {/* leave-and-return: devices died while away — say so, offer one tap back */}
          {media.needsAttention ? (
            <div className="absolute inset-x-3 bottom-[84px] z-[22] flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xl sm:left-1/2 sm:right-auto sm:w-[380px] sm:-translate-x-1/2">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400"><VideoOff className="h-4 w-4" /></span>
              <p className="flex-1 text-[12.5px] leading-snug"><b className="font-extrabold">Your camera and mic are off.</b> They paused when you left the tab.</p>
              <button onClick={() => void media.resume()} className="shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-2 text-[12.5px] font-extrabold text-white">Turn back on</button>
            </div>
          ) : null}
        </div>

        {/* attendee strip on the BOTTOM (desktop layouts only) */}
        {layout === "bottom" ? <RosterStrip {...rosterProps} className="hidden md:flex" /> : null}

        {/* lesson progress + Next activity — phone only, and only for the host who drives
            it; participants don't need the agenda taking up their small screen. */}
        {host ? <LessonCard session={session} host={host} patch={patch} className="md:hidden" /> : null}

        {/* ---- control bar ---- large touch targets, spread evenly on a phone ---- */}
        <div className="flex shrink-0 items-center justify-between gap-1 overflow-x-auto border-t border-border bg-background/90 px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-start md:gap-1.5 md:px-2.5 md:py-2.5">
          {/* mic + device caret */}
          <div ref={audioBtnRef} className="relative shrink-0">
            <Ctl
              on={me.micOn}
              label="Mic"
              disabled={!media.enabled}
              onClick={async () => {
                const e = await media.toggleMic();
                if (e) return void act("mute", me.id);
                await act(media.micOn ? "mute" : "unmute", me.id);
              }}
              title={!media.enabled ? "Video isn't switched on for this room" : me.micOn ? "Mute" : "Unmute"}
              Icon={me.micOn ? Mic : MicOff}
              danger={!me.micOn}
            />
            {media.enabled ? <Caret onClick={() => setDevMenu((v) => (v === "audio" ? null : "audio"))} title="Audio devices" /> : null}
          </div>
          {/* cam + device caret */}
          <div ref={videoBtnRef} className="relative shrink-0">
            <Ctl
              on={me.camOn}
              label="Camera"
              disabled={!media.enabled}
              onClick={async () => {
                const e = await media.toggleCam();
                if (e) return void act("cam_off", me.id);
                await act(media.camOn ? "cam_off" : "cam_on", me.id);
              }}
              title={!media.enabled ? "Video isn't switched on for this room" : me.camOn ? "Turn your camera off" : "Turn your camera on"}
              Icon={me.camOn ? Video : VideoOff}
              danger={!me.camOn}
            />
            {media.enabled ? <Caret onClick={() => setVideoSheet(true)} title="Camera & background" /> : null}
          </div>
          {/* screen share — desktop bar only (phones reach it from More) */}
          {canShareScreen(me, session) ? (
            <div className="relative hidden shrink-0 md:block">
              <Ctl
                on={me.sharing}
                disabled={!media.enabled}
                onClick={async () => {
                  const e = await media.toggleScreen();
                  if (e) return;
                  await act(media.screenOn ? "stop_share" : "start_share", me.id);
                }}
                title={!media.enabled ? "Video isn't switched on for this room" : me.sharing ? "Stop sharing" : "Share your screen"}
                Icon={Monitor}
              />
            </div>
          ) : null}
          <Ctl on={me.handRaised} label="Raise hand" onClick={() => void act(me.handRaised ? "lower_hand" : "raise_hand", me.id)} title={me.handRaised ? "Lower your hand" : "Raise your hand"} Icon={Hand} />
          {/* people — opens the roster sheet (phone only; desktop has the column/strip) */}
          <div className="shrink-0 md:hidden">
            <Ctl label="People" onClick={() => setSheet("roster")} title="Participants" Icon={Users} badge={inRoom.length} />
          </div>
          {/* ask the presenter — phone quick access when the AI co-host is delivering */}
          {aiPresenter && onAsk ? (
            <div className="shrink-0 md:hidden">
              <Ctl on={askOpen} label="Ask" onClick={() => setAskOpen((v) => !v)} title="Ask the presenter" Icon={HelpCircle} />
            </div>
          ) : null}
          {/* chat — phone quick access (desktop has its own button below) */}
          <div className="relative shrink-0 md:hidden">
            <Ctl on={chatOpen} label="Chat" onClick={() => setChatOpen((v) => !v)} title="Chat" Icon={MessageSquare} />
            {unread ? <span className="pointer-events-none absolute right-0 top-0 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span> : null}
          </div>
          {/* chat — desktop bar only (phones reach it from More) */}
          <div className="relative hidden shrink-0 md:block">
            <Ctl on={chatOpen} onClick={() => setChatOpen((v) => !v)} title="Chat" Icon={MessageSquare} />
            {unread ? <span className="pointer-events-none absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span> : null}
          </div>
          <div ref={moreBtnRef} className="relative shrink-0">
            <Ctl on={moreMenu} label="More" onClick={() => setMoreMenu((v) => !v)} title="More" Icon={MoreHorizontal} />
            {/* unread rides on More for phones, since chat lives inside it there */}
            {unread ? <span className="pointer-events-none absolute right-1 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white md:hidden">{unread > 9 ? "9+" : unread}</span> : null}
          </div>

          {/* leave — the red hang-up */}
          <button onClick={onLeave} title="Leave the session" className="flex shrink-0 flex-col items-center gap-1 md:ms-auto md:flex-row md:gap-1.5 md:rounded-xl md:bg-gradient-to-br md:from-rose-600 md:to-rose-400 md:px-3.5 md:py-2">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-rose-600 to-rose-400 text-white shadow-lg md:h-auto md:w-auto md:bg-none md:shadow-none">
              <LogOut className="h-[19px] w-[19px] md:h-3.5 md:w-3.5" />
            </span>
            <span className="text-[10px] font-semibold leading-none text-rose-400 md:text-[12.5px] md:font-extrabold md:text-white">Leave</span>
          </button>
          {me.role === "HOST" ? (
            <button onClick={onEnd} title="End the session for everyone" className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] font-extrabold text-muted-foreground hover:border-rose-500 hover:text-rose-400 md:inline-flex">
              <StopIcon className="h-3.5 w-3.5" /> End
            </button>
          ) : null}
        </div>
      </div>

      {/* ---- side roster: desktop column only. On a phone the "side" layout
             renders the compact bottom strip above (never a full-height drawer). ---- */}
      {layout === "side" ? (
        <aside className="relative hidden w-[300px] shrink-0 flex-col border-s border-border bg-card md:flex">
          <RosterContent {...rosterProps} />
        </aside>
      ) : null}

      {/* ---- anchored popovers (portalled, so the control bar never clips them) ---- */}
      {devMenu === "audio" ? (
        <AnchoredMenu anchorRef={audioBtnRef} onClose={() => setDevMenu(null)} width={260}>
          <DeviceGroups
            onClose={() => setDevMenu(null)}
            groups={[
              { label: "Microphone", Icon: Mic, items: media.mics, selected: media.micId, onPick: media.pickMic },
              { label: "Speaker", Icon: Volume2, items: media.speakers, selected: media.spkId, onPick: media.pickSpeaker },
            ]}
          />
        </AnchoredMenu>
      ) : null}
      {videoSheet ? (
        <VideoSheet media={media} session={session} onClose={() => setVideoSheet(false)} />
      ) : null}
      {moreMenu ? (
        <AnchoredMenu anchorRef={moreBtnRef} onClose={() => setMoreMenu(false)}>
          <MoreRows
            session={session}
            host={host}
            isOwner={me.role === "HOST"}
            unread={unread}
            patch={patch}
            onManage={onManage}
            onChat={() => setChatOpen(true)}
            onEnd={onEnd}
            mobileRoster={mobileRoster}
            onMobileRoster={pickMobileRoster}
            onClose={() => setMoreMenu(false)}
          />
        </AnchoredMenu>
      ) : null}

      {/* ---- sheets ---- */}
      {sheet === "invite" ? (
        <InviteSheet session={session} onClose={() => setSheet(null)} />
      ) : null}

      {/* roster bottom sheet — the phone's full participant list (People / bubbles chip) */}
      {sheet === "roster" ? (
        <RosterSheet {...rosterProps} onClose={() => setSheet(null)} />
      ) : null}

      {chatOpen ? <ChatPanel messages={messages} me={me} sendMessage={sendMessage} onClose={() => setChatOpen(false)} /> : null}

      {/* new-message notification — pops in above the control bar; tap to open chat */}
      {chatToast && !chatOpen ? (
        <button
          onClick={() => { setChatOpen(true); setChatToast(null); }}
          className="absolute bottom-[86px] right-3 z-[45] flex max-w-[300px] items-start gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 text-left shadow-2xl sm:bottom-[74px]"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <MessageSquare className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-card">{unread > 9 ? "9+" : unread}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-bold">{chatToast.name}</span>
            <span className="line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{chatToast.text}</span>
          </span>
        </button>
      ) : null}

      <AudioSink remotes={media.remotes} spkId={media.spkId} />
      {/* AI presenter narration audio — played on every client, synced by aiPlaying */}
      <audio ref={aiAudioRef} className="hidden" />
      {/* live Q&A answer audio — plays once, then clears the overlay */}
      <audio ref={answerAudioRef} className="hidden" onEnded={() => onClearAnswer?.()} />
    </div>
  );
}

/* ------------------------------------------------------------------ tool rail */
function ToolRail({ tool, setTool, shapeKind, setShapeKind, ink, setInk, iCanDraw, host, onUndo, onClear, compact }: {
  tool: BoardTool; setTool: (t: BoardTool) => void; shapeKind: ShapeKind; setShapeKind: (s: ShapeKind) => void;
  ink: string; setInk: (c: string) => void; iCanDraw: boolean; host: boolean; onUndo: () => void; onClear: () => void; compact?: boolean;
}) {
  const [shapeMenu, setShapeMenu] = useState(false);
  return (
    <>
      {TOOLS.map(({ id, Icon, title }) => {
        const isShape = id === "shape";
        const ShapeIcon = isShape ? (SHAPES.find((s) => s.id === shapeKind)?.Icon ?? Square) : Icon;
        const locked = !iCanDraw && id !== "sel" && id !== "laser";
        const btn = (
          <button
            onClick={() => { setTool(id); setShapeMenu(isShape ? (tool === "shape" ? !shapeMenu : true) : false); }}
            disabled={locked}
            title={locked ? "You don't have the pen" : isShape ? "Shapes — click for more" : title}
            className={cn(
              "relative grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground transition",
              tool === id ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "hover:bg-muted hover:text-foreground",
              locked ? "opacity-30" : "",
            )}
          >
            <ShapeIcon className="h-4 w-4" />
            {isShape ? <ChevronDown className="absolute bottom-0 right-0 h-2 w-2" /> : null}
          </button>
        );
        if (!isShape) return <div key={id}>{btn}</div>;
        return (
          <div key={id} className="relative">
            {btn}
            {shapeMenu && tool === "shape" ? (
              <>
                <div className="fixed inset-0 z-[19]" onClick={() => setShapeMenu(false)} />
                <div className="absolute left-[42px] top-1/2 z-20 grid w-[122px] -translate-y-1/2 grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setShapeKind(s.id); setTool("shape"); setShapeMenu(false); }}
                      title={s.label}
                      className={cn(
                        "grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground transition",
                        shapeKind === s.id ? "bg-brand-500/15 text-brand-400" : "hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <s.Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
      <span className="my-1.5 h-px w-5 bg-border" />
      <div className={cn("flex flex-col gap-1", compact && "gap-0.5")}>
        {INKS.map((c) => (
          <button key={c} onClick={() => setInk(c)} className={cn("h-[18px] w-[18px] rounded-full border-2", ink === c ? "border-white" : "border-transparent")} style={{ background: c }} title="Ink colour" />
        ))}
      </div>
      <span className="my-1.5 h-px w-5 bg-border" />
      <button onClick={onUndo} disabled={!iCanDraw} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" title="Undo"><Undo2 className="h-4 w-4" /></button>
      <button onClick={onClear} disabled={!host} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" title={host ? "Clear the board" : "Only a host can clear the board"}><Trash2 className="h-4 w-4" /></button>
    </>
  );
}

/* ------------------------------------------------------------------- roster */
function RosterContent({ session, me, host, act, media, waiting, inRoom, onInvite, onSpotlight, onCloseDrawer }: {
  session: TrainingSessionDTO; me: TrainingParticipantDTO; host: boolean;
  act: (action: string, participantId?: string) => Promise<string | null>;
  media: ReturnType<typeof useMedia>; waiting: TrainingParticipantDTO[]; inRoom: TrainingParticipantDTO[];
  onInvite: () => void; onSpotlight: (id: string) => void; onCloseDrawer?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5 text-[11px] font-bold">
        <Users className="h-3.5 w-3.5" /> In the room
        <span className="ms-auto text-[10px] text-muted-foreground">{inRoom.length}</span>
        {onCloseDrawer ? (
          <button onClick={onCloseDrawer} className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground md:hidden"><X className="h-3.5 w-3.5" /></button>
        ) : null}
      </div>
      {host && waiting.length ? (
        <div className="border-b border-amber-500/30 bg-amber-500/[0.06]">
          <div className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-wide text-amber-400">Waiting to join · {waiting.length}</div>
          {waiting.map((w) => (
            <div key={w.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-[8.5px] font-black text-white">{w.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{w.name}</span>
              <button onClick={() => void act("admit", w.id)} className="rounded-md bg-gradient-to-br from-brand-500 to-violet-600 px-2 py-1 text-[10px] font-bold text-white">Admit</button>
              <button onClick={() => void act("deny", w.id)} title="Deny" className="grid h-[22px] w-[22px] place-items-center rounded-md border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      ) : null}
      {media.enabled && !media.connected ? (
        <p className="border-b border-border bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-400">Connecting video…</p>
      ) : !media.enabled && media.reason ? (
        <p className="border-b border-border bg-muted px-3 py-1.5 text-[10px] leading-snug text-muted-foreground">{media.reason} The board, your docs and the chat all work as normal.</p>
      ) : null}
      <div className="flex flex-1 flex-col gap-1.5 overflow-auto p-2">
        {inRoom.map((p) => (
          <Tile
            key={p.id} p={p} session={session} me={me} host={host} act={act} onSpotlight={onSpotlight}
            feed={p.id === me.id ? media.localCam : media.remotes.find((r) => r.participantId === p.id && r.source === "cam" && r.kind === "video")?.stream ?? null}
          />
        ))}
      </div>
      {host ? (
        <button onClick={onInvite} className="m-2.5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 py-3 text-[13px] font-extrabold text-white">
          <Send className="h-4 w-4" /> Invite people
        </button>
      ) : null}
    </>
  );
}

/* ------------------------------------------------- roster strip (top / bottom) */
/** A compact horizontal row of attendee tiles — the phone-friendly layout. Small
 *  video/initials thumbnails scroll sideways; the host can admit + invite inline. */
function RosterStrip({ session, me, host, act, media, waiting, inRoom, onInvite, onSpotlight, className }: {
  session: TrainingSessionDTO; me: TrainingParticipantDTO; host: boolean;
  act: (action: string, participantId?: string) => Promise<string | null>;
  media: ReturnType<typeof useMedia>; waiting: TrainingParticipantDTO[]; inRoom: TrainingParticipantDTO[];
  onInvite: () => void; onSpotlight: (id: string) => void; className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5 overflow-x-auto border-y border-border bg-card/60 px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:px-2.5 sm:py-2", className)}>
      {host && waiting.length ? (
        <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
          <span className="text-[10px] font-extrabold text-amber-400">{waiting.length} waiting</span>
          {waiting.slice(0, 3).map((w) => (
            <button key={w.id} onClick={() => void act("admit", w.id)} title={`Admit ${w.name}`} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-2 py-1 text-[10px] font-bold text-white">
              <span className="max-w-[52px] truncate">{w.name}</span> ✓
            </button>
          ))}
        </div>
      ) : null}
      {inRoom.map((p) => {
        const feed = p.id === me.id ? media.localCam : media.remotes.find((r) => r.participantId === p.id && r.source === "cam" && r.kind === "video")?.stream ?? null;
        const spotlit = session.spotlightId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => host && onSpotlight(p.id)}
            title={host ? (spotlit ? `Remove ${p.name}'s spotlight` : `Spotlight ${p.name}`) : p.name}
            className={cn("group relative h-[40px] w-[56px] shrink-0 overflow-hidden rounded-lg border-2 bg-[#181820] sm:h-[56px] sm:w-[78px]", spotlit ? "border-amber-400" : p.role === "HOST" ? "border-brand-500/50" : "border-border")}
          >
            {feed ? <VideoFeed stream={feed} muted mirror={p.id === me.id} /> : p.isAI && p.videoUrl ? (
              <AvatarVideo url={p.videoUrl} poster={p.avatarUrl} speaking={!!session.aiPlaying} />
            ) : p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-[11px] font-black text-white">{p.name.slice(0, 2).toUpperCase()}</span></span>
            )}
            {p.isAI ? <span className="absolute left-1 top-1 rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1 py-px text-[7.5px] font-black text-[#04222a]">AI</span> : null}
            <span className="absolute inset-x-1 bottom-0.5 flex items-center gap-0.5 text-[8.5px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.9)]">
              <span className="truncate">{p.name}</span>
              <span className="ms-auto flex shrink-0 gap-0.5">
                {session.penHolderId === p.id ? <Pill className="bg-emerald-500 text-emerald-950">PEN</Pill> : null}
                {p.handRaised ? <Pill className="bg-amber-400 text-amber-950"><Hand className="h-2 w-2" /></Pill> : null}
                {!p.micOn ? <Pill className="bg-rose-500/85 text-white"><MicOff className="h-2 w-2" /></Pill> : null}
              </span>
            </span>
            {host ? <span className="absolute right-0.5 top-0.5 hidden rounded bg-black/55 p-0.5 text-white group-hover:block"><Star className={cn("h-2.5 w-2.5", spotlit && "fill-amber-400 text-amber-400")} /></span> : null}
          </button>
        );
      })}
      {host ? (
        <button onClick={onInvite} title="Invite people" className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-lg border border-dashed border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-brand-400 sm:h-[56px] sm:w-[46px]">
          <span className="flex flex-col items-center gap-0.5"><Send className="h-3.5 w-3.5" /><span className="text-[8.5px] font-bold">Invite</span></span>
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------- phone: movable participant bubbles */
/** On a phone the roster isn't a strip or a drawer — each person is a small round
 *  video bubble the user can DRAG anywhere over the board, plus a count chip that
 *  opens the full list. Keeps the whiteboard full-bleed. A tap (no drag) spotlights
 *  for a host, or opens the roster for everyone else. [[training-studio]] */
function FloatingBubbles({ inRoom, me, media, session, host, onSpotlight, onOpenRoster, className }: {
  inRoom: TrainingParticipantDTO[]; me: TrainingParticipantDTO; media: ReturnType<typeof useMedia>;
  session: TrainingSessionDTO; host: boolean; onSpotlight: (id: string) => void; onOpenRoster: () => void; className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{ id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const SIZE = 44, GAP = 8, MAX = 5;
  const shown = inRoom.slice(0, MAX);
  const ids = shown.map((p) => p.id).join(",");

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setBox({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  // give every new bubble a home position (top-right cascade); drop those who left
  useEffect(() => {
    if (!box.w) return;
    setPos((prev) => {
      const next = { ...prev };
      let changed = false;
      shown.forEach((p, i) => {
        if (!next[p.id]) { next[p.id] = { x: box.w - SIZE - 12, y: 12 + i * (SIZE + GAP + 12) }; changed = true; }
      });
      for (const id of Object.keys(next)) {
        if (!shown.some((p) => p.id === id)) { delete next[id]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [box.w, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep a little margin so the badges (which sit just outside the circle) and
  // the name label under the bubble are never clipped at an edge.
  const clampPos = (x: number, y: number) => ({
    x: Math.max(8, Math.min(Math.max(8, box.w - SIZE - 8), x)),
    y: Math.max(8, Math.min(Math.max(8, box.h - SIZE - 18), y)),
  });

  const down = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    const p = pos[id] ?? { x: 0, y: 0 };
    drag.current = { id, ox: p.x, oy: p.y, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 5) d.moved = true;
    setPos((prev) => ({ ...prev, [d.id]: clampPos(d.ox + (e.clientX - d.sx), d.oy + (e.clientY - d.sy)) }));
  };
  const up = (id: string) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) { if (host) onSpotlight(id); else onOpenRoster(); }
  };

  return (
    <div ref={boxRef} className={cn("pointer-events-none absolute inset-0 z-[13]", className)}>
      {shown.map((p) => {
        const pp = pos[p.id];
        if (!pp) return null;
        const feed = p.id === me.id ? media.localCam : media.remotes.find((r) => r.participantId === p.id && r.source === "cam" && r.kind === "video")?.stream ?? null;
        const spotlit = session.spotlightId === p.id;
        return (
          <div
            key={p.id}
            onPointerDown={(e) => down(e, p.id)}
            onPointerMove={move}
            onPointerUp={() => up(p.id)}
            className="pointer-events-auto absolute touch-none select-none"
            style={{ left: pp.x, top: pp.y, width: SIZE }}
          >
            {/* the badges sit on THIS wrapper (not the clipped circle) so the
                mute / pen indicators are never cut off inside the bubble */}
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
              <div className={cn("grid h-full w-full place-items-center overflow-hidden rounded-full border-2 bg-[#181820] shadow-lg", spotlit ? "border-amber-400" : p.isAI ? "border-cyan-400" : p.role === "HOST" ? "border-brand-400" : "border-white/70")}>
                {feed ? <VideoFeed stream={feed} muted mirror={p.id === me.id} /> : p.isAI && p.videoUrl ? (
                  <AvatarVideo url={p.videoUrl} poster={p.avatarUrl} speaking={!!session.aiPlaying} />
                ) : p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-600 to-violet-700 text-[14px] font-black text-white">{p.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              {p.isAI ? <span className="absolute -left-0.5 -top-0.5 rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1 py-px text-[7.5px] font-black text-[#04222a] ring-2 ring-[#0e0e13]">AI</span> : session.penHolderId === p.id ? <span className="absolute -left-0.5 -top-0.5 grid h-[17px] w-[17px] place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0e0e13]"><PenLine className="h-2.5 w-2.5" /></span> : null}
              {!p.micOn ? <span className="absolute -bottom-0.5 -right-0.5 grid h-[17px] w-[17px] place-items-center rounded-full bg-rose-500 text-white ring-2 ring-[#0e0e13]"><MicOff className="h-2.5 w-2.5" /></span> : null}
            </div>
            <span className="mx-auto mt-1 block max-w-[54px] truncate rounded bg-black/55 px-1 text-center text-[8.5px] font-bold text-white">{p.id === me.id ? "You" : p.name}</span>
          </div>
        );
      })}
      {/* count chip → opens the full roster sheet */}
      <button onClick={onOpenRoster} title="Participants" className="pointer-events-auto absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-2.5 py-1.5 text-[11px] font-extrabold shadow-lg backdrop-blur">
        <Users className="h-3.5 w-3.5" /> {inRoom.length}
      </button>
    </div>
  );
}

/* ------------------------------------------------- roster bottom sheet (phone) */
function RosterSheet(props: {
  session: TrainingSessionDTO; me: TrainingParticipantDTO; host: boolean;
  act: (action: string, participantId?: string) => Promise<string | null>;
  media: ReturnType<typeof useMedia>; waiting: TrainingParticipantDTO[]; inRoom: TrainingParticipantDTO[];
  onInvite: () => void; onSpotlight: (id: string) => void; onClose: () => void;
}) {
  const { onClose, ...roster } = props;
  return (
    <Sheet
      title="Participants"
      sub={`${roster.inRoom.length} in the room${roster.waiting.length ? ` · ${roster.waiting.length} waiting` : ""}`}
      onClose={onClose}
    >
      <RosterContent {...roster} />
    </Sheet>
  );
}

/* ------------------------------------------------- lesson progress (phone card) */
/** The agenda as a one-line "Lesson N of M" progress strip with a Next button.
 *  The active segment is synced (session.activeSegmentId) so everyone sees the
 *  same lesson; only a host/co-host advances it. Hidden when there's no agenda. */
function LessonCard({ session, host, patch, className }: {
  session: TrainingSessionDTO; host: boolean; patch: (b: Record<string, unknown>) => Promise<string | null>; className?: string;
}) {
  const segs = session.segments;
  if (!segs.length) return null;
  const idx = Math.max(0, segs.findIndex((s) => s.id === session.activeSegmentId));
  const cur = segs[idx];
  const next = segs[idx + 1] ?? null;
  const pct = Math.round(((idx + 1) / segs.length) * 100);
  return (
    <div className={cn("flex shrink-0 items-center gap-3 border-t border-border bg-card px-3 py-2.5", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Star className="h-4 w-4 fill-current" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold">Lesson {idx + 1} of {segs.length}</span>
          <span className="ms-auto text-[11px] font-bold text-muted-foreground">{pct}%</span>
        </div>
        <p className="truncate text-[11.5px] text-muted-foreground">{cur?.note || cur?.title || "—"}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {host ? (
        <button
          onClick={() => { if (next) void patch({ activeSegmentId: next.id }); }}
          disabled={!next}
          title={next ? `Next: ${next.title || next.note}` : "You're on the last activity"}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-40"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------- device menu (anchored popover) */
/** A popover that opens UP from the button it's anchored to. Portalled to <body>
 *  and fixed-positioned from the button's rect, so the control bar's horizontal
 *  scroll (overflow-x-auto, which also clips vertically) can never hide it. */
function AnchoredMenu({ anchorRef, onClose, width = 248, children }: {
  anchorRef: React.RefObject<HTMLElement | null>; onClose: () => void; width?: number; children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    setPos({ left, bottom: window.innerHeight - r.top + 8 });
  }, [anchorRef, width]);
  if (typeof document === "undefined" || !pos) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div className="fixed z-[61] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-2xl" style={{ left: pos.left, bottom: pos.bottom, width }}>
        {children}
      </div>
    </>,
    document.body,
  );
}

/** The mic / speaker / camera list — rendered inside an AnchoredMenu. */
function DeviceGroups({ onClose, groups }: {
  onClose: () => void;
  groups: { label: string; Icon: typeof Mic; items: DeviceOption[]; selected: string | null; onPick: (id: string) => void }[];
}) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="mx-1.5 mb-0.5 mt-1.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            <g.Icon className="h-3 w-3" /> {g.label}
          </div>
          {g.items.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[11.5px] text-muted-foreground">Turn your {g.label.toLowerCase()} on to see the choices.</p>
          ) : g.items.map((d, i) => {
            const isSel = g.selected ? g.selected === d.deviceId : i === 0;
            return (
              <button key={d.deviceId || i} onClick={() => { g.onPick(d.deviceId); onClose(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
                <Check className={cn("h-4 w-4 shrink-0 text-brand-400", !isSel && "invisible")} />
                <span className={cn("truncate text-[12.5px] font-semibold", isSel && "text-brand-400")}>{d.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ---------------------------------------------- more menu content (in a popover) */
function MoreRows({ session, host, isOwner, unread, patch, onManage, onChat, onEnd, mobileRoster, onMobileRoster, onClose }: {
  session: TrainingSessionDTO; host: boolean; isOwner: boolean; unread: number;
  patch: (b: Record<string, unknown>) => Promise<string | null>; onManage: () => void; onChat: () => void; onEnd: () => void;
  mobileRoster: "float" | "top"; onMobileRoster: (v: "float" | "top") => void; onClose: () => void;
}) {
  const Row = ({ Icon, name, meta, onClick, tone }: { Icon: typeof Circle; name: string; meta: string; onClick: () => void; tone?: string }) => (
    <button onClick={() => { onClick(); onClose(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
      <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg", tone ?? "bg-muted text-foreground")}><Icon className="h-3.5 w-3.5" /></span>
      <span className="flex-1"><span className="block text-[12.5px] font-bold">{name}</span><span className="block text-[10.5px] text-muted-foreground">{meta}</span></span>
    </button>
  );
  const LAYOUTS: { id: "side" | "top" | "bottom"; Icon: typeof Columns3; label: string }[] = [
    { id: "side", Icon: Columns3, label: "Side" },
    { id: "top", Icon: Rows3, label: "Top" },
    { id: "bottom", Icon: PanelBottom, label: "Bottom" },
  ];
  return (
    <>
      {/* chat lives here on a phone (it isn't in the phone's control bar) */}
      <div className="md:hidden">
        <Row Icon={MessageSquare} name={unread ? `Chat · ${unread} new` : "Chat"} meta="Message the room" tone={unread ? "bg-rose-500/15 text-rose-400" : undefined} onClick={onChat} />
      </div>
      {/* phone: how YOU see the roster — floating bubbles or a top strip */}
      <div className="mb-1 px-2.5 pt-1.5 md:hidden">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Participants view</div>
        <div className="grid grid-cols-2 gap-1.5">
          {([["float", Users, "Float"], ["top", Rows3, "Top strip"]] as [("float" | "top"), typeof Users, string][]).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => { onMobileRoster(id); onClose(); }}
              className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11.5px] font-bold transition", mobileRoster === id ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border text-muted-foreground hover:border-brand-500")}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      {host && !session.recording ? (
        <Row Icon={Circle} name="Start recording" meta="Nothing records until you start it" tone="bg-rose-500/15 text-rose-400" onClick={() => void patch({ recording: true })} />
      ) : null}
      <Row Icon={PenLine} name="Whiteboard" meta="Put the board on the stage" onClick={() => void patch({ stageSource: "board" })} />
      {host ? <Row Icon={Paperclip} name="Materials" meta="Add a PDF, deck, image or video" onClick={onManage} tone="bg-brand-500/15 text-brand-400" /> : null}
      {host ? (
        <div className="mt-1 hidden px-2.5 pb-1 pt-2 md:block">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Attendee layout</div>
          <div className="grid grid-cols-3 gap-1.5">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => void patch({ rosterLayout: l.id })}
                className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10.5px] font-bold transition", (session.rosterLayout ?? "side") === l.id ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border text-muted-foreground hover:border-brand-500")}
              >
                <l.Icon className="h-4 w-4" /> {l.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {/* owner's End — in the phone menu since it isn't in the phone's control bar */}
      {isOwner ? (
        <div className="mt-1 border-t border-border pt-1 md:hidden">
          <Row Icon={StopIcon} name="End session" meta="Ends the room for everyone" tone="bg-rose-500/15 text-rose-400" onClick={onEnd} />
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- recording UI */
function RecordingLayer({ recording, host, patch }: { recording: boolean; host: boolean; patch: (b: Record<string, unknown>) => Promise<string | null> }) {
  const [phase, setPhase] = useState<"idle" | "countdown" | "live">("idle");
  const [cd, setCd] = useState(3);
  const [secs, setSecs] = useState(0);
  const [confirmStop, setConfirmStop] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [name, setName] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRec = useRef(recording); // seed with the value at mount

  // The 3-2-1 pre-roll is the HOST's "you started recording" cue — only the
  // person who flips it on ever sees it. Everyone else (and anyone joining a
  // room that's already recording, or when the host resumes) goes straight to
  // the live badge — no phantom countdown. OFF resets everything.
  useEffect(() => {
    const was = prevRec.current;
    prevRec.current = recording;
    if (recording && !was && host) {
      setPhase("countdown"); setCd(3);
      let n = 3;
      const iv = setInterval(() => {
        n -= 1;
        if (n <= 0) { clearInterval(iv); setPhase("live"); setSecs(0); }
        else setCd(n);
      }, 900);
      return () => clearInterval(iv);
    }
    if (recording) { setPhase((p) => (p === "idle" ? "live" : p)); return; }
    setPhase("idle"); setPaused(false);
  }, [recording, host]);

  // The timer runs while live and NOT paused.
  useEffect(() => {
    if (phase === "live" && !paused) {
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
  }, [phase, paused]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const stop = () => { setConfirmStop(false); setPaused(false); setName(`${session_name()} — ${today()}`); setSaveOpen(true); void patch({ recording: false }); };

  return (
    <>
      {phase === "countdown" ? (
        <div className="absolute inset-0 z-[40] grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-[120px] font-black leading-none text-white [text-shadow:0_10px_40px_rgba(244,63,94,.5)]">{cd}</div>
            <p className="text-[14px] font-bold text-muted-foreground">Recording starts…</p>
          </div>
        </div>
      ) : null}

      {phase === "live" ? (
        <div className={cn(
          "absolute left-1/2 top-3 z-[16] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-extrabold shadow-lg",
          paused ? "border-amber-500/55 bg-amber-500/20 text-amber-200" : "border-rose-500/55 bg-rose-500/20 text-rose-200",
        )}>
          <span className={cn("h-2 w-2 rounded-full", paused ? "bg-amber-400" : "animate-pulse bg-rose-500")} />
          {paused ? "PAUSED" : "REC"} <span className="min-w-[42px] text-center tabular-nums">{fmt(secs)}</span>
          {host ? (
            <>
              <button onClick={() => setPaused((p) => !p)} title={paused ? "Resume recording" : "Pause recording"} className="grid h-[22px] w-[22px] place-items-center rounded-md bg-white/15 text-white transition hover:bg-white/30">
                {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
              </button>
              <button onClick={() => setConfirmStop(true)} title="Stop recording" className="grid h-[22px] w-[22px] place-items-center rounded-md bg-white/15 text-white transition hover:bg-white/30">
                <StopIcon className="h-3 w-3 fill-current" />
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {confirmStop ? (
        <Modal onClose={() => setConfirmStop(false)}>
          <span className="mb-3 grid h-[46px] w-[46px] place-items-center rounded-xl bg-rose-500/15 text-rose-400"><StopIcon className="h-5 w-5" /></span>
          <h4 className="text-[17px] font-extrabold">Stop recording?</h4>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">This ends the recording for everyone in the room. You’ll be able to name it and save it to your library.</p>
          <div className="mt-4 flex gap-2.5">
            <button onClick={() => setConfirmStop(false)} className="flex-1 rounded-xl border border-border py-3 text-[13.5px] font-extrabold hover:border-brand-500">Keep recording</button>
            <button onClick={stop} className="flex-1 rounded-xl bg-gradient-to-br from-rose-600 to-rose-400 py-3 text-[13.5px] font-extrabold text-white">Stop</button>
          </div>
        </Modal>
      ) : null}

      {saveOpen ? (
        <Modal onClose={() => setSaveOpen(false)}>
          <span className="mb-3 grid h-[46px] w-[46px] place-items-center rounded-xl bg-emerald-500/15 text-emerald-400"><Save className="h-5 w-5" /></span>
          <h4 className="text-[17px] font-extrabold">Save recording</h4>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">It’ll appear in your recordings library, where you can share a public view link later.</p>
          <label className="mt-4 block text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-muted px-3.5 py-3 text-[14px] outline-none focus:border-brand-500" />
          <div className="mt-4 flex gap-2.5">
            <button onClick={() => setSaveOpen(false)} className="flex-1 rounded-xl border border-border py-3 text-[13.5px] font-extrabold hover:border-brand-500">Discard</button>
            <button onClick={() => setSaveOpen(false)} className="flex-1 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 py-3 text-[13.5px] font-extrabold text-white">Save to library</button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[44] grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div className="w-full max-w-[340px] rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function session_name() { return "Training session"; }
function today() {
  const d = new Date();
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* --------------------------------------------------------------- meeting chat */
/** The in-room text chat. A right-side panel on desktop, a bottom sheet on a
 *  phone. History arrives in the stream's first frame; sends broadcast to all. */
function ChatPanel({ messages, me, sendMessage, onClose }: {
  messages: TrainingMessageDTO[]; me: TrainingParticipantDTO; sendMessage: (text: string) => Promise<string | null>; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setText("");
    await sendMessage(t);
    setSending(false);
  };
  return (
    <>
      {/* On a phone: a bottom-sheet overlay (backdrop dims the room only). On desktop:
          a STATIC side column in the flex row, so it sits BESIDE the board and the
          presentation just narrows — never gets covered. */}
      <div className="absolute inset-0 z-[54] bg-black/40 md:hidden" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 z-[55] flex max-h-[72%] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl md:static md:z-auto md:h-full md:max-h-none md:w-[300px] md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-4 w-4 text-brand-400" />
          <b className="text-[14px]">Chat</b>
          <button onClick={onClose} className="ms-auto rounded-lg px-2 py-1 text-[12px] font-bold text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <div ref={listRef} className="flex-1 space-y-2.5 overflow-auto px-3 py-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-muted-foreground">No messages yet — say hello 👋</p>
          ) : messages.map((m) => {
            const mine = m.participantId === me.id;
            return (
              <div key={m.id} className={cn("flex flex-col", mine && "items-end")}>
                {!mine ? <span className="mb-0.5 px-1 text-[10.5px] font-bold text-muted-foreground">{m.name}</span> : null}
                <div className={cn("max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-snug", mine ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "bg-muted")}>{m.text}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-border p-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Message the room…"
            className="flex-1 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500"
          />
          <button onClick={send} disabled={!text.trim() || sending} className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- small controls */
/** A meeting control. On a phone it renders as a big round button with a label
 *  underneath (the Zoom/Meet pattern); on desktop it's a compact square icon. */
function Ctl({ Icon, title, label, onClick, on, danger, disabled, badge }: { Icon: typeof Mic; title: string; label?: string; onClick: () => void; on?: boolean; danger?: boolean; disabled?: boolean; badge?: number }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} className="flex shrink-0 flex-col items-center gap-1 disabled:opacity-40">
      <span
        className={cn(
          "relative grid h-[52px] w-[52px] place-items-center rounded-full border transition sm:h-[42px] sm:w-[42px] sm:rounded-xl",
          danger ? "border-rose-500/45 bg-rose-500/15 text-rose-400" : on ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border bg-card group-hover:border-brand-500",
        )}
      >
        <Icon className="h-[19px] w-[19px] sm:h-4 sm:w-4" />
        {badge ? <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 px-1 text-[10px] font-extrabold text-white">{badge > 9 ? "9+" : badge}</span> : null}
      </span>
      {label ? <span className="max-w-[58px] truncate text-[10px] font-semibold leading-none text-muted-foreground md:hidden">{label}</span> : null}
    </button>
  );
}

function Caret({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="absolute -right-1.5 -top-1.5 grid h-[22px] w-[22px] place-items-center rounded-full border border-border bg-card text-foreground hover:border-brand-500 hover:text-brand-400">
      <ChevronUp className="h-3 w-3" />
    </button>
  );
}

/** One person. Hover reveals the host controls — pen, share, co-host, mute, remove. */
function Tile({ p, session, me, host, act, onSpotlight, feed }: {
  p: TrainingParticipantDTO; session: TrainingSessionDTO; me: TrainingParticipantDTO; host: boolean;
  act: (action: string, participantId?: string) => Promise<string | null>; onSpotlight: (id: string) => void; feed: MediaStream | null;
}) {
  const hasPen = session.penHolderId === p.id;
  const mayShare = canShareScreen(p, session);
  const spotlit = session.spotlightId === p.id;
  return (
    <div className={cn("group relative aspect-[4/3] overflow-hidden rounded-xl border bg-[#181820]", spotlit ? "border-amber-400" : p.sharing ? "border-cyan-500/60" : p.role === "HOST" ? "border-brand-500/50" : "border-border")}>
      {feed ? (
        <VideoFeed stream={feed} muted mirror={p.id === me.id} />
      ) : p.isAI && p.videoUrl ? (
        <AvatarVideo url={p.videoUrl} poster={p.avatarUrl} speaking={!!session.aiPlaying} />
      ) : p.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[#181820]">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-[13px] font-black text-white">{p.name.slice(0, 2).toUpperCase()}</span>
        </div>
      )}
      {p.isAI ? <span className="absolute left-1.5 top-1.5 rounded bg-gradient-to-br from-cyan-400 to-brand-500 px-1.5 py-0.5 text-[8.5px] font-black text-[#04222a]">AI</span> : null}
      <div className="absolute inset-x-1.5 bottom-1 flex items-center gap-1 text-[9.5px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">
        <span className="truncate">{p.name}</span>
        <span className="ms-auto flex shrink-0 gap-0.5">
          {p.role === "COHOST" ? <Pill className="bg-brand-500 text-white">CO</Pill> : null}
          {hasPen ? <Pill className="bg-emerald-500 text-emerald-950">PEN</Pill> : null}
          {p.sharing ? <Pill className="bg-cyan-400 text-cyan-950"><Monitor className="h-2 w-2" /></Pill> : null}
          {p.handRaised ? <Pill className="bg-amber-400 text-amber-950"><Hand className="h-2 w-2" /></Pill> : null}
          {!p.micOn ? <Pill className="bg-rose-500/85 text-white"><MicOff className="h-2 w-2" /></Pill> : null}
        </span>
      </div>
      {host && p.id !== me.id ? (
        <div className="absolute inset-0 hidden flex-wrap content-center justify-center gap-1 bg-background/80 p-1.5 backdrop-blur-sm group-hover:flex">
          <Mini onClick={() => onSpotlight(p.id)} on={spotlit} title={spotlit ? `Remove ${p.name}'s spotlight` : `Spotlight ${p.name} for everyone`} Icon={Focus} />
          <Mini onClick={() => void act("give_pen", p.id)} on={hasPen} title={`Hand ${p.name} the pen`} Icon={Pencil} />
          <Mini onClick={() => void act(mayShare ? "revoke_share" : "grant_share", p.id)} on={mayShare} title={mayShare ? `Stop ${p.name} sharing their screen` : `Let ${p.name} share their screen`} Icon={Monitor} />
          {me.role === "HOST" && p.role !== "HOST" ? (
            <Mini onClick={() => void act(p.role === "COHOST" ? "demote" : "promote", p.id)} on={p.role === "COHOST"} title={p.role === "COHOST" ? `Demote ${p.name}` : `Make ${p.name} a co-host`} Icon={Star} />
          ) : null}
          <Mini onClick={() => void act(p.micOn ? "mute" : "unmute", p.id)} title="Mute / unmute" Icon={p.micOn ? Mic : MicOff} />
          {p.role !== "HOST" ? <Mini onClick={() => void act("remove", p.id)} title={`Remove ${p.name}`} Icon={X} danger /> : null}
        </div>
      ) : null}
    </div>
  );
}

const Pill = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full px-1.5 py-px text-[8px] font-extrabold", className)}>{children}</span>
);

function Mini({ Icon, title, onClick, on, danger }: { Icon: typeof Mic; title: string; onClick: () => void; on?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={cn("grid h-[26px] w-[28px] place-items-center rounded-md border border-border bg-card text-foreground transition", on && "border-emerald-500/50 bg-emerald-500/15 text-emerald-400", danger ? "hover:border-rose-500 hover:text-rose-400" : "hover:border-brand-500 hover:text-brand-400")}>
      <Icon className="h-3 w-3" />
    </button>
  );
}
