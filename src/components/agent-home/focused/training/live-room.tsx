"use client";

/**
 * The live room — a stage, not a pipeline.
 *
 * Tool rail left, stage centre, roster right, controls below. The host keeps the
 * pen and can draw on top of ANY stage source, including someone else's shared
 * screen — that combination is what makes this a training room rather than a
 * meeting. [[training-studio]]
 */
import { useMemo, useState } from "react";
import {
  MousePointer2, Pencil, Highlighter, Eraser, Square, Type, StickyNote, Flashlight,
  Undo2, Trash2, Presentation, PenLine, FileText, Monitor, Video, Hand, Mic, MicOff,
  VideoOff, Circle, Users, LogOut, Paperclip, ChevronLeft, ChevronRight, Star, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TrainingBoard, type BoardCursor } from "./training-board";
import { canDraw as canDrawFn, canShareScreen, isHost } from "@/lib/training/access";
import type { BoardItem, BoardTool, StageSource, TrainingParticipantDTO, TrainingSessionDTO } from "@/lib/training/types";

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
  onPing: (x: number, y: number, laser: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  act: (action: string, participantId?: string) => Promise<string | null>;
  patch: (body: Record<string, unknown>) => Promise<string | null>;
  onLeave: () => void;
  onManage: () => void;
}

export function LiveRoom({ session, me, cursors, connected, onAdd, onPing, onUndo, onClear, act, patch, onLeave, onManage }: Props) {
  const [tool, setTool] = useState<BoardTool>("pen");
  const [ink, setInk] = useState(INKS[0]);

  const host = isHost(me.role);
  const iCanDraw = canDrawFn(me, session);
  const iHavePen = session.penHolderId === me.id;
  const inRoom = useMemo(
    () => session.participants.filter((p) => p.state === "ADMITTED"),
    [session.participants],
  );
  const sharer = useMemo(
    () => session.participants.find((p) => p.sharing) ?? null,
    [session.participants],
  );
  const material = useMemo(
    () => session.materials.find((m) => m.id === session.stageKey) ?? null,
    [session.materials, session.stageKey],
  );
  const paged = session.stageSource === "slides" || session.stageSource === "doc";

  const backdrop = useMemo(() => {
    if (session.stageSource === "board") return null;
    if (session.stageSource === "screen") {
      return (
        <div className="grid h-full w-full place-items-center bg-[#101318]">
          <div className="text-center">
            <Monitor className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-2 text-[12px] font-semibold text-slate-400">
              {sharer ? `${sharer.name} — screen` : "Nobody is sharing yet"}
            </p>
          </div>
        </div>
      );
    }
    if (session.stageSource === "cam") {
      const presenter = session.participants.find((p) => p.id === session.penHolderId) ?? me;
      return (
        <div className="relative grid h-full w-full place-items-center bg-gradient-to-br from-[#221a3a] to-[#3a2c5e]">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-600 text-2xl font-black text-white">
            {presenter.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white">
            {presenter.name} · presenting
          </span>
        </div>
      );
    }
    if (material?.kind === "image" || material?.kind === "video") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={material.url} alt={material.name} className="h-full w-full object-contain" />
      );
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
  }, [session.stageSource, session.stagePage, session.penHolderId, session.participants, material, sharer, me]);

  return (
    <div className="absolute inset-0 grid grid-cols-[52px_1fr_208px] bg-background">
      {/* ---- tool rail ---- */}
      <div className="flex flex-col items-center gap-1 border-e border-border bg-card py-2.5">
        {TOOLS.map(({ id, Icon, title }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            disabled={!iCanDraw && id !== "sel" && id !== "laser"}
            title={!iCanDraw && id !== "sel" && id !== "laser" ? "You don't have the pen" : title}
            className={cn(
              "grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground transition",
              tool === id ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "hover:bg-muted hover:text-foreground",
              !iCanDraw && id !== "sel" && id !== "laser" ? "opacity-30" : "",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <span className="my-1.5 h-px w-5 bg-border" />
        <div className="flex flex-col gap-1">
          {INKS.map((c) => (
            <button
              key={c}
              onClick={() => setInk(c)}
              className={cn("h-[18px] w-[18px] rounded-full border-2", ink === c ? "border-white" : "border-transparent")}
              style={{ background: c }}
              title="Ink colour"
            />
          ))}
        </div>
        <span className="my-1.5 h-px w-5 bg-border" />
        <button onClick={onUndo} disabled={!iCanDraw} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" title="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={onClear} disabled={!host} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" title={host ? "Clear the board" : "Only a host can clear the board"}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* ---- stage ---- */}
      <div className="relative flex min-w-0 flex-col">
        <div className="flex items-center gap-1 border-b border-border bg-background/70 px-3 py-2">
          {SOURCES.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => void patch({ stageSource: id })}
              disabled={!host}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition",
                session.stageSource === id
                  ? "border-transparent bg-gradient-to-br from-brand-500 to-violet-600 text-white"
                  : "border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-foreground",
                !host && "opacity-50",
              )}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}

          {sharer && session.stageSource === "screen" ? (
            <span className="ms-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 py-1 pe-1 ps-2.5 text-[10.5px] font-bold text-cyan-400">
              <Monitor className="h-3 w-3" /> {sharer.name} is sharing
              {host ? (
                <button
                  onClick={() => void act("stop_share", sharer.id)}
                  className="rounded-full border border-cyan-500/40 px-2 py-px text-[9.5px] hover:bg-cyan-500/15"
                >
                  Take back the stage
                </button>
              ) : null}
            </span>
          ) : null}

          <span className={cn(
            "ms-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold",
            iHavePen ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-border bg-card text-muted-foreground",
          )}>
            <Pencil className="h-3 w-3" />
            {iHavePen ? "You have the pen" : `${session.participants.find((p) => p.id === session.penHolderId)?.name ?? "Nobody"} has the pen`}
          </span>
        </div>

        <div className="relative grid flex-1 place-items-center overflow-hidden bg-[#0e0e13] p-3.5">
          <div className="relative aspect-video w-full max-w-[980px] shadow-2xl">
            <TrainingBoard
              doc={session.boardDoc}
              tool={tool}
              color={ink}
              canDraw={iCanDraw}
              cursors={cursors}
              onAdd={onAdd}
              onPing={onPing}
              backdrop={backdrop}
            />
            {paged && material ? (
              <div className="absolute bottom-3 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/85 px-2 py-1.5 backdrop-blur">
                <button onClick={() => void patch({ stagePage: Math.max(1, session.stagePage - 1) })} disabled={!host || session.stagePage <= 1} className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500 disabled:opacity-30">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="min-w-[62px] text-center text-[10.5px] text-muted-foreground">
                  Page {session.stagePage} / {material.pages}
                </span>
                <button onClick={() => void patch({ stagePage: Math.min(material.pages, session.stagePage + 1) })} disabled={!host || session.stagePage >= material.pages} className="grid h-[22px] w-[22px] place-items-center rounded border border-border text-muted-foreground hover:border-brand-500 disabled:opacity-30">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ---- control bar ---- */}
        <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border bg-background/90 p-2.5">
          <span className="me-2 text-[11px] tabular-nums text-muted-foreground">
            {connected ? (
              session.recording ? <><Circle className="me-1 inline h-2 w-2 animate-pulse fill-rose-500 text-rose-500" />REC</> : "Not recording"
            ) : (
              <span className="text-amber-400">Reconnecting…</span>
            )}
          </span>
          <Ctl on={me.micOn} onClick={() => void act(me.micOn ? "mute" : "unmute", me.id)} title={me.micOn ? "Mute" : "Unmute"} Icon={me.micOn ? Mic : MicOff} danger={!me.micOn} />
          <Ctl on={me.camOn} onClick={() => void act(me.camOn ? "cam_off" : "cam_on", me.id)} title={me.camOn ? "Turn your camera off" : "Turn your camera on"} Icon={me.camOn ? Video : VideoOff} danger={!me.camOn} />
          {canShareScreen(me, session) ? (
            <Ctl on={me.sharing} onClick={() => void act(me.sharing ? "stop_share" : "start_share", me.id)} title={me.sharing ? "Stop sharing" : "Share your screen"} Icon={Monitor} />
          ) : null}
          <Ctl onClick={() => void patch({ stageSource: "board" })} title="Whiteboard" Icon={PenLine} />
          {host ? <Ctl onClick={onManage} title="Materials" Icon={Paperclip} /> : null}
          <Ctl on={me.handRaised} onClick={() => void act(me.handRaised ? "lower_hand" : "raise_hand", me.id)} title={me.handRaised ? "Lower your hand" : "Raise your hand"} Icon={Hand} />
          <Ctl onClick={onManage} title="Participants" Icon={Users} />
          <button onClick={onLeave} className="inline-flex h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-br from-rose-600 to-rose-400 px-3.5 text-[12px] font-extrabold text-white">
            <LogOut className="h-3.5 w-3.5" /> Leave
          </button>
        </div>
      </div>

      {/* ---- roster ---- */}
      <div className="flex min-h-0 flex-col border-s border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5 text-[11px] font-bold">
          <Users className="h-3.5 w-3.5" /> In the room
          <span className="ms-auto text-[10px] text-muted-foreground">{inRoom.length}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 overflow-auto p-2">
          {inRoom.map((p) => (
            <Tile key={p.id} p={p} session={session} me={me} host={host} act={act} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Ctl({ Icon, title, onClick, on, danger }: { Icon: typeof Mic; title: string; onClick: () => void; on?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "grid h-[38px] w-[38px] place-items-center rounded-xl border transition",
        danger ? "border-rose-500/45 bg-rose-500/15 text-rose-400" : on ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border bg-card hover:border-brand-500",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** One person. Hover reveals the host controls — pen, share, co-host, mute, remove. */
function Tile({ p, session, me, host, act }: {
  p: TrainingParticipantDTO;
  session: TrainingSessionDTO;
  me: TrainingParticipantDTO;
  host: boolean;
  act: (action: string, participantId?: string) => Promise<string | null>;
}) {
  const hasPen = session.penHolderId === p.id;
  const mayShare = canShareScreen(p, session);
  return (
    <div className={cn(
      "group relative aspect-[4/3] overflow-hidden rounded-xl border bg-[#181820]",
      p.sharing ? "border-cyan-500/60" : p.role === "HOST" ? "border-brand-500/50" : "border-border",
    )}>
      {p.camOn ? (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-600 to-violet-700 text-lg font-black text-white">
          {p.name.slice(0, 2).toUpperCase()}
        </div>
      ) : (
        <div className="grid h-full w-full place-items-center bg-[#181820]">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-[13px] font-black text-white">
            {p.name.slice(0, 2).toUpperCase()}
          </span>
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
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "grid h-[26px] w-[28px] place-items-center rounded-md border border-border bg-card text-foreground transition",
        on && "border-emerald-500/50 bg-emerald-500/15 text-emerald-400",
        danger ? "hover:border-rose-500 hover:text-rose-400" : "hover:border-brand-500 hover:text-brand-400",
      )}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}
