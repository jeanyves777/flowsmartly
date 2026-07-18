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
  Send, Check, Square as StopIcon, Save, Volume2, Pause, Play, Focus, Rows3, Columns3, PanelBottom, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TrainingBoard, type BoardCursor, type ShapeKind } from "./training-board";
import { useMedia, type RemoteStream, type DeviceOption } from "./use-media";
import { InviteSheet } from "./invite-sheet";
import { canDraw as canDrawFn, canShareScreen, isHost } from "@/lib/training/access";
import type { BoardItem, BoardTool, StageSource, TrainingParticipantDTO, TrainingSessionDTO, TrainingMessageDTO } from "@/lib/training/types";

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
  connected: boolean;
  onAdd: (item: BoardItem) => void;
  onRemove: (itemId: string) => void;
  onUpdate: (item: BoardItem) => void;
  onPing: (x: number, y: number, laser: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  act: (action: string, participantId?: string) => Promise<string | null>;
  patch: (body: Record<string, unknown>) => Promise<string | null>;
  messages: TrainingMessageDTO[];
  sendMessage: (text: string) => Promise<string | null>;
  onLeave: () => void;
  onManage: () => void;
  /** owner-only — ends the session for everyone */
  onEnd: () => void;
}

type SheetKey = null | "invite";

export function LiveRoom({ session, me, cursors, connected, onAdd, onRemove, onUpdate, onPing, onUndo, onClear, act, patch, messages, sendMessage, onLeave, onManage, onEnd }: Props) {
  const [tool, setTool] = useState<BoardTool>("pen");
  const [ink, setInk] = useState(INKS[0]);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [showTools, setShowTools] = useState(true); // desktop pen rail
  const [toolDock, setToolDock] = useState(false); // mobile overlay dock
  const [rosterOpen, setRosterOpen] = useState(false); // mobile roster drawer
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [devMenu, setDevMenu] = useState<null | "audio" | "video">(null); // anchored device popover
  const [moreMenu, setMoreMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChat, setSeenChat] = useState(0); // messages read → drives the unread badge
  const unread = Math.max(0, messages.length - seenChat);
  useEffect(() => { if (chatOpen) setSeenChat(messages.length); }, [chatOpen, messages.length]);
  const hideItems = session.hideBoard; // synced: when the host hides, everyone hides
  const audioBtnRef = useRef<HTMLDivElement>(null);
  const videoBtnRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLDivElement>(null);

  // The board is a strict, always-16:9 box computed from the stage's real size.
  // (CSS aspect-video + max-h-full silently BREAKS the ratio when height binds,
  // so the same fractional coordinate landed on different pixels in the studio vs
  // the /m attendee view — marks looked "slightly off". A measured box is 16:9 on
  // every mount, so coordinates agree everywhere.)
  const stageRef = useRef<HTMLDivElement>(null);
  const [boardBox, setBoardBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      let w = Math.min(width, 980);
      let h = (w * 9) / 16;
      if (h > height) { h = height; w = (h * 16) / 9; }
      setBoardBox({ w: Math.round(w), h: Math.round(h) });
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
  }, [session.stageSource, session.stagePage, session.penHolderId, session.participants, material, sharer, me, media.localCam, media.localScreen, media.remotes]);

  const layout = session.rosterLayout ?? "side";
  const spotlight = session.spotlightId ? inRoom.find((p) => p.id === session.spotlightId) ?? null : null;
  const spotFeed = spotlight
    ? (spotlight.id === me.id ? media.localCam : media.remotes.find((r) => r.participantId === spotlight.id && r.source === "cam" && r.kind === "video")?.stream ?? null)
    : null;
  const onSpotlight = (id: string) => void patch({ spotlightId: session.spotlightId === id ? null : id });
  const rosterProps = { session, me, host, act, media, waiting, inRoom, onInvite: () => setSheet("invite"), onSpotlight };

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
      <div className="relative flex min-w-0 flex-1 flex-col">
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

        {/* attendee strip on TOP */}
        {layout === "top" ? <RosterStrip {...rosterProps} /> : null}

        {/* stage — the inner ref measures the space, the board is a fitted 16:9 box */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0e0e13] p-2.5 sm:p-3.5">
          {/* spotlight — a big pinned tile everyone sees */}
          {spotlight ? (
            <div className="pointer-events-none absolute right-3 top-3 z-[14] w-[38%] max-w-[240px]">
              <div className="pointer-events-auto relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-amber-400 bg-[#181820] shadow-2xl">
                {spotFeed ? <VideoFeed stream={spotFeed} muted mirror={spotlight.id === me.id} /> : (
                  <div className="grid h-full w-full place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-lg font-black text-white">{spotlight.name.slice(0, 2).toUpperCase()}</span></div>
                )}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-950"><Star className="h-2.5 w-2.5 fill-current" /> Spotlight</span>
                <span className="absolute inset-x-2 bottom-1 truncate text-[11px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">{spotlight.name}</span>
                {host ? <button onClick={() => onSpotlight(spotlight.id)} title="Remove spotlight" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/55 text-white hover:bg-black/75"><X className="h-3 w-3" /></button> : null}
              </div>
            </div>
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
              onAdd={onAdd}
              onRemove={onRemove}
              onPing={onPing}
              backdrop={backdrop}
            />
            {paged && material ? (
              <div className="absolute bottom-3 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/85 px-2 py-1.5 backdrop-blur">
                <button onClick={() => void patch({ stagePage: Math.max(1, session.stagePage - 1) })} disabled={!host || session.stagePage <= 1} className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500 disabled:opacity-30">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="min-w-[62px] text-center text-[10.5px] text-muted-foreground">Page {session.stagePage} / {material.pages}</span>
                <button onClick={() => void patch({ stagePage: Math.min(material.pages, session.stagePage + 1) })} disabled={!host || session.stagePage >= material.pages} className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500 disabled:opacity-30">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
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
                  className="absolute bottom-3 left-3 grid h-[46px] w-[46px] place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg md:hidden"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              ) : (
                <div className="absolute bottom-3 left-3 z-[13] flex max-h-[calc(100%-24px)] w-[52px] flex-col items-center gap-1 overflow-auto rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {/* attendee strip on the BOTTOM */}
        {layout === "bottom" ? <RosterStrip {...rosterProps} /> : null}

        {/* ---- control bar ---- */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-background/90 p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* mic + device caret */}
          <div ref={audioBtnRef} className="relative shrink-0">
            <Ctl
              on={me.micOn}
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
            {media.enabled ? <Caret onClick={() => setDevMenu((v) => (v === "video" ? null : "video"))} title="Camera devices" /> : null}
          </div>
          {canShareScreen(me, session) ? (
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
          ) : null}
          <Ctl on={me.handRaised} onClick={() => void act(me.handRaised ? "lower_hand" : "raise_hand", me.id)} title={me.handRaised ? "Lower your hand" : "Raise your hand"} Icon={Hand} />
          <div className="relative shrink-0">
            <Ctl on={chatOpen} onClick={() => setChatOpen((v) => !v)} title="Chat" Icon={MessageSquare} />
            {unread ? <span className="pointer-events-none absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span> : null}
          </div>
          {layout === "side" ? (
            <div className="relative shrink-0">
              <Ctl on={rosterOpen} onClick={() => setRosterOpen((v) => !v)} title="Participants" Icon={Users} />
              {inRoom.length ? <span className="pointer-events-none absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 px-1 text-[10px] font-extrabold text-white">{inRoom.length}</span> : null}
            </div>
          ) : null}
          <div ref={moreBtnRef} className="relative shrink-0">
            <Ctl on={moreMenu} onClick={() => setMoreMenu((v) => !v)} title="More" Icon={MoreHorizontal} />
          </div>

          <button onClick={onLeave} className="ms-auto inline-flex h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-rose-600 to-rose-400 px-3.5 text-[12.5px] font-extrabold text-white sm:h-[38px]">
            <LogOut className="h-3.5 w-3.5" /> Leave
          </button>
          {me.role === "HOST" ? (
            <button onClick={onEnd} title="End the session for everyone" className="inline-flex h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[12.5px] font-extrabold text-muted-foreground hover:border-rose-500 hover:text-rose-400 sm:h-[38px]">
              <StopIcon className="h-3.5 w-3.5" /> End
            </button>
          ) : null}
        </div>
      </div>

      {/* ---- side roster: desktop column + mobile drawer (only in the "side" layout) ---- */}
      {layout === "side" ? (
        <>
          <aside className="relative hidden w-[300px] shrink-0 flex-col border-s border-border bg-card md:flex">
            <RosterContent {...rosterProps} />
          </aside>
          {rosterOpen ? <div className="absolute inset-0 z-[20] bg-black/50 md:hidden" onClick={() => setRosterOpen(false)} /> : null}
          <aside className={cn(
            "absolute inset-y-0 right-0 z-[21] flex w-[86%] max-w-[340px] flex-col border-s border-border bg-card shadow-2xl transition-transform duration-300 md:hidden",
            rosterOpen ? "translate-x-0" : "translate-x-full",
          )}>
            <RosterContent {...rosterProps} onCloseDrawer={() => setRosterOpen(false)} />
          </aside>
        </>
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
      {devMenu === "video" ? (
        <AnchoredMenu anchorRef={videoBtnRef} onClose={() => setDevMenu(null)} width={260}>
          <DeviceGroups
            onClose={() => setDevMenu(null)}
            groups={[{ label: "Camera", Icon: Video, items: media.cameras, selected: media.camId, onPick: media.pickCamera }]}
          />
        </AnchoredMenu>
      ) : null}
      {moreMenu ? (
        <AnchoredMenu anchorRef={moreBtnRef} onClose={() => setMoreMenu(false)}>
          <MoreRows session={session} host={host} patch={patch} onManage={onManage} onClose={() => setMoreMenu(false)} />
        </AnchoredMenu>
      ) : null}

      {/* ---- sheets ---- */}
      {sheet === "invite" ? (
        <InviteSheet session={session} onClose={() => setSheet(null)} />
      ) : null}

      {chatOpen ? <ChatPanel messages={messages} me={me} sendMessage={sendMessage} onClose={() => setChatOpen(false)} /> : null}

      <AudioSink remotes={media.remotes} spkId={media.spkId} />
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
function RosterStrip({ session, me, host, act, media, waiting, inRoom, onInvite, onSpotlight }: {
  session: TrainingSessionDTO; me: TrainingParticipantDTO; host: boolean;
  act: (action: string, participantId?: string) => Promise<string | null>;
  media: ReturnType<typeof useMedia>; waiting: TrainingParticipantDTO[]; inRoom: TrainingParticipantDTO[];
  onInvite: () => void; onSpotlight: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-y border-border bg-card/60 px-2.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className={cn("group relative h-[64px] w-[86px] shrink-0 overflow-hidden rounded-lg border-2 bg-[#181820]", spotlit ? "border-amber-400" : p.role === "HOST" ? "border-brand-500/50" : "border-border")}
          >
            {feed ? <VideoFeed stream={feed} muted mirror={p.id === me.id} /> : (
              <span className="grid h-full w-full place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-[11px] font-black text-white">{p.name.slice(0, 2).toUpperCase()}</span></span>
            )}
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
        <button onClick={onInvite} title="Invite people" className="grid h-[64px] w-[52px] shrink-0 place-items-center rounded-lg border border-dashed border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-brand-400">
          <span className="flex flex-col items-center gap-0.5"><Send className="h-3.5 w-3.5" /><span className="text-[8.5px] font-bold">Invite</span></span>
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
function MoreRows({ session, host, patch, onManage, onClose }: {
  session: TrainingSessionDTO; host: boolean; patch: (b: Record<string, unknown>) => Promise<string | null>; onManage: () => void; onClose: () => void;
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
      {host && !session.recording ? (
        <Row Icon={Circle} name="Start recording" meta="Nothing records until you start it" tone="bg-rose-500/15 text-rose-400" onClick={() => void patch({ recording: true })} />
      ) : null}
      <Row Icon={PenLine} name="Whiteboard" meta="Put the board on the stage" onClick={() => void patch({ stageSource: "board" })} />
      {host ? <Row Icon={Paperclip} name="Materials" meta="Add a PDF, deck, image or video" onClick={onManage} tone="bg-brand-500/15 text-brand-400" /> : null}
      {host ? (
        <div className="mt-1 px-2.5 pb-1 pt-2">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Attendees</div>
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
      <div className="fixed inset-0 z-[54] bg-black/40 md:pointer-events-none md:bg-transparent" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[55] flex max-h-[72%] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[360px] md:rounded-none md:border-l md:border-t-0">
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
function Ctl({ Icon, title, onClick, on, danger, disabled }: { Icon: typeof Mic; title: string; onClick: () => void; on?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "grid h-[48px] w-[48px] shrink-0 place-items-center rounded-xl border transition disabled:opacity-40 sm:h-[42px] sm:w-[42px]",
        danger ? "border-rose-500/45 bg-rose-500/15 text-rose-400" : on ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border bg-card hover:border-brand-500",
      )}
    >
      <Icon className="h-4 w-4" />
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
      ) : (
        <div className="grid h-full w-full place-items-center bg-[#181820]">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-[13px] font-black text-white">{p.name.slice(0, 2).toUpperCase()}</span>
        </div>
      )}
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
