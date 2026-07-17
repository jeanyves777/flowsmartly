"use client";

/**
 * The plan canvas — the session before it runs.
 *
 * Same design logic as the Video Director: nodes positioned absolutely on a
 * pannable board, wires recomputed from live DOM geometry on every drag, order
 * re-derived left→right from x. The pipeline is
 *   Session brief → The room → segments… → Go live → Invite
 * which is the training equivalent of brief → cast → scenes → film → publish.
 * [[training-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Sparkles, DoorOpen, Presentation, PenLine, FileText, Clapperboard, ImageIcon,
  Users, Radio, Send, Plus, X, Paperclip, Timer, Eye, Play, Link2, Mail, Calendar, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCanvasPan } from "@/components/agent-home/shared/use-canvas-pan";
import type { SegmentKind, TrainingSessionDTO, TrainingSegmentDTO } from "@/lib/training/types";

const KIND_META: Record<SegmentKind, { Icon: typeof PenLine; tag: string; color: string; tint: string }> = {
  slides: { Icon: Presentation, tag: "Slides", color: "#a78bfa", tint: "rgba(167,139,250,.18)" },
  board: { Icon: PenLine, tag: "Board", color: "#22d3ee", tint: "rgba(34,211,238,.18)" },
  doc: { Icon: FileText, tag: "Doc", color: "#94a3b8", tint: "rgba(148,163,184,.18)" },
  video: { Icon: Clapperboard, tag: "Video", color: "#fbbf24", tint: "rgba(251,191,36,.18)" },
  draw: { Icon: ImageIcon, tag: "Illustration", color: "#34d399", tint: "rgba(16,185,129,.18)" },
  discuss: { Icon: Users, tag: "Breakout", color: "#fb7185", tint: "rgba(251,113,133,.18)" },
};
const ADD_ORDER: SegmentKind[] = ["slides", "board", "doc", "video", "draw", "discuss"];
const ADD_LABEL: Record<SegmentKind, string> = {
  slides: "Present slides", board: "Whiteboard it", doc: "Work a document",
  video: "Watch a clip", draw: "Draw over an image", discuss: "Break out in pairs",
};

const DUR_STEPS = [5, 8, 10, 12, 15, 20, 30];

interface Props {
  session: TrainingSessionDTO;
  estimate: { total: number; room: number } | null;
  onEditBrief: () => void;
  onAddMaterial: () => void;
  onAddSegment: (kind: SegmentKind) => void;
  onRemoveSegment: (id: string) => void;
  onPatchSegments: (segs: { id: string; x?: number; y?: number; durationMins?: number }[]) => void;
  onGoLive: () => void;
  onManage: () => void;
  onInvite: () => void;
  busy?: boolean;
}

export function PlanCanvas({
  session, estimate, onEditBrief, onAddMaterial, onAddSegment, onRemoveSegment, onPatchSegments,
  onGoLive, onManage, onInvite, busy,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pan = useCanvasPan(scrollRef);
  const [addOpen, setAddOpen] = useState(false);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});

  const segs = useMemo(
    () => [...session.segments].sort((a, b) => a.order - b.order),
    [session.segments],
  );
  const at = useCallback(
    (s: TrainingSegmentDTO) => pos[s.id] ?? { x: s.x, y: s.y },
    [pos],
  );

  const maxX = useMemo(() => segs.reduce((m, s) => Math.max(m, at(s).x), 534), [segs, at]);
  const livePos = { x: maxX + 300, y: 96 };
  const invitePos = { x: maxX + 300, y: 430 };
  const addPos = { x: maxX + 268, y: 152 };
  const boardWidth = Math.max(2200, livePos.x + 460);

  // ---- wires: brief → room → segments(by x) → live → invite ----
  const [wire, setWire] = useState("");
  const recompute = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const br = board.getBoundingClientRect();
    const anchor = (id: string, side: "l" | "r") => {
      const el = board.querySelector<HTMLElement>(`[data-node="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return side === "r"
        ? { x: r.left - br.left + r.width, y: r.top - br.top + r.height / 2 }
        : { x: r.left - br.left, y: r.top - br.top + r.height / 2 };
    };
    const ordered = [...segs].sort((a, b) => at(a).x - at(b).x).map((s) => s.id);
    const seq = ["__brief", "__room", ...ordered, "__live", "__invite"];
    let d = "";
    for (let i = 0; i < seq.length - 1; i++) {
      const a = anchor(seq[i], "r");
      const b = anchor(seq[i + 1], "l");
      if (!a || !b) continue;
      const dx = Math.max(40, (b.x - a.x) / 2);
      d += `M${a.x} ${a.y} C${a.x + dx} ${a.y},${b.x - dx} ${b.y},${b.x} ${b.y} `;
    }
    setWire(d);
  }, [segs, at]);

  useEffect(() => { recompute(); }, [recompute]);
  useEffect(() => {
    const on = () => recompute();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [recompute]);

  // ---- drag a node ----
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const onHeadDown = (e: ReactPointerEvent, s: TrainingSegmentDTO) => {
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = at(s);
    drag.current = { id: s.id, dx: e.clientX - p.x, dy: e.clientY - p.y };
  };
  const onHeadMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const { id, dx, dy } = drag.current;
    setPos((p) => ({ ...p, [id]: { x: Math.max(0, e.clientX - dx), y: Math.max(0, e.clientY - dy) } }));
    recompute();
  };
  const onHeadUp = () => {
    if (!drag.current) return;
    drag.current = null;
    // persist + let the server re-derive order from x
    onPatchSegments(segs.map((s) => ({ id: s.id, ...at(s) })));
  };

  const cycleDur = (s: TrainingSegmentDTO) => {
    const next = DUR_STEPS[(DUR_STEPS.indexOf(s.durationMins) + 1) % DUR_STEPS.length];
    onPatchSegments([{ id: s.id, durationMins: next }]);
  };

  const allReady = segs.length > 0 && segs.every((s) => s.ready);
  const cohosts = session.participants.filter((p) => p.role === "COHOST");
  const seated = session.participants.filter((p) => p.state === "ADMITTED");
  const link = session.invites.find((i) => i.isActive && !i.email);

  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 cursor-grab overflow-auto"
      style={{
        background:
          // Subtle theme-neutral dots to match the other playgrounds (was a
          // solid dark #20202b that read "too deep" on light theme).
          "radial-gradient(circle at 1px 1px,rgba(130,130,150,0.16) 1px,transparent 0) 0 0/22px 22px, hsl(var(--background))",
      }}
      onPointerDown={pan}
    >
      <div ref={boardRef} className="relative" style={{ width: boardWidth, height: 1050 }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <path d={wire} fill="none" stroke="#38bdf8" strokeWidth={1.6} opacity={0.55} />
        </svg>

        {/* ---- brief ---- */}
        <div data-node="__brief" className="absolute w-[224px] rounded-2xl border border-border bg-card/80 shadow-sm" style={{ left: 24, top: 70 }}>
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <span className="grid h-[19px] w-[19px] place-items-center rounded-md" style={{ background: "rgba(99,102,241,.18)" }}>
              <Sparkles className="h-3 w-3 text-brand-400" />
            </span>
            <b className="truncate text-[12px] font-bold">Session brief</b>
            <span className="ms-auto rounded-full bg-brand-500/15 px-1.5 py-px text-[9px] font-bold text-brand-400">Brief</span>
          </div>
          <p className="line-clamp-3 px-3 text-[10px] leading-relaxed text-muted-foreground">
            {session.brief || "No brief yet — tell the agent what you're training."}
          </p>
          <div className="flex flex-wrap gap-1 px-3 pt-2">
            {[session.sessionType, `${session.plannedMins} min`, `${session.seats} seats`, session.recording ? "Recorded" : "Not recorded"].map((t) => (
              <span key={t} className="rounded-md border border-border bg-card px-1.5 py-px text-[9px] font-bold capitalize text-muted-foreground">{t}</span>
            ))}
          </div>
          <div className="flex gap-1 p-3 pt-2.5">
            <button onClick={onEditBrief} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500">Edit brief</button>
          </div>
        </div>

        {/* ---- room ---- */}
        <div data-node="__room" className="absolute w-[214px] overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-card shadow-sm" style={{ left: 274, top: 70 }}>
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <span className="grid h-[19px] w-[19px] place-items-center rounded-md bg-amber-500/20">
              <DoorOpen className="h-3 w-3 text-amber-400" />
            </span>
            <b className="truncate text-[12px] font-bold">The room</b>
            <span className="ms-auto rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold text-amber-400">Access</span>
          </div>
          <div className="flex px-3 pt-1">
            {seated.slice(0, 4).map((p) => (
              <span key={p.id} className="-me-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-brand-600 text-[9px] font-black text-white">
                {p.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {seated.length > 4 ? (
              <span className="-me-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-black text-muted-foreground">
                +{seated.length - 4}
              </span>
            ) : null}
          </div>
          <p className="px-3 pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
            {cohosts.length ? <>Co-host <b className="text-amber-400">{cohosts.map((c) => c.name).join(", ")}</b> · </> : null}
            Waiting room <b className="text-amber-400">{session.waitingRoom ? "on" : "off"}</b>
            <br />
            Sharing: {session.openShare ? "anyone" : "hosts + who you allow"}.
          </p>
          {link ? (
            <div className="mx-3 mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5">
              <Link2 className="h-2.5 w-2.5 shrink-0 text-amber-400" />
              <code className="flex-1 truncate font-mono text-[8.5px] text-amber-400">/t/{link.token.slice(0, 12)}…</code>
              <button
                onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/t/${link.token}`); }}
                className="rounded p-0.5 text-muted-foreground hover:text-amber-400"
                title="Copy the join link"
              >
                <Paperclip className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : null}
          <div className="flex gap-1 p-3 pt-2.5">
            <button onClick={onManage} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500">Manage</button>
          </div>
        </div>

        {/* ---- segments ---- */}
        {segs.map((s) => {
          const M = KIND_META[s.kind] ?? KIND_META.board;
          const p = at(s);
          return (
            <div key={s.id} data-node={s.id} className="absolute w-[250px] rounded-2xl border border-border bg-card shadow-lg" style={{ left: p.x, top: p.y }}>
              <div
                className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing"
                onPointerDown={(e) => onHeadDown(e, s)}
                onPointerMove={onHeadMove}
                onPointerUp={onHeadUp}
              >
                <span className="grid h-[19px] w-[19px] place-items-center rounded-md" style={{ background: M.tint }}>
                  <M.Icon className="h-3 w-3" style={{ color: M.color }} />
                </span>
                <b className="truncate text-[12px] font-bold">{s.title}</b>
                <span className={cn("ms-auto rounded-full px-1.5 py-px text-[9px] font-bold", s.ready ? "bg-emerald-500/16 text-emerald-400" : "bg-slate-500/14 text-slate-400")}>
                  {M.tag}
                </span>
                <button onClick={() => onRemoveSegment(s.id)} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400" title="Remove this segment">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="relative mx-3 grid aspect-video place-items-center overflow-hidden rounded-xl" style={{ background: `linear-gradient(160deg, ${M.tint}, rgba(20,20,28,.9))` }}>
                <M.Icon className="h-7 w-7 opacity-70" style={{ color: M.color }} />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-px text-[8px] font-extrabold text-white">{M.tag}</span>
                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-px text-[8px] font-extrabold text-white">{s.durationMins} min</span>
                <span className={cn("absolute bottom-1.5 left-1.5 rounded-full px-1.5 py-px text-[8px] font-extrabold", s.ready ? "bg-emerald-500 text-emerald-950" : "bg-amber-400/90 text-amber-950")}>
                  {s.ready ? "Ready" : "Needs setup"}
                </span>
              </div>
              <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-lg border border-brand-500/20 bg-brand-500/[0.06] px-2 py-1.5">
                <span className="mt-px shrink-0 text-[8px] font-extrabold uppercase tracking-wider text-brand-400">Plan</span>
                <span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{s.note}</span>
              </div>
              <div className="mx-3 mt-2 flex flex-wrap gap-1">
                <button onClick={onAddMaterial} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[9.5px] font-semibold hover:border-brand-500 hover:text-brand-400">
                  <Paperclip className="h-2.5 w-2.5" /> Material
                </button>
                <button onClick={() => cycleDur(s)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[9.5px] font-semibold hover:border-amber-500 hover:text-amber-400">
                  <Timer className="h-2.5 w-2.5" /> {s.durationMins} min
                </button>
              </div>
              <div className="flex gap-1 p-3 pt-2.5">
                <button onClick={onGoLive} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500">
                  <Eye className="me-1 inline h-2.5 w-2.5" /> Preview
                </button>
              </div>
            </div>
          );
        })}

        {/* ---- add a segment ---- */}
        <button
          data-nopan
          onClick={() => setAddOpen((v) => !v)}
          className="absolute z-[5] grid h-10 w-10 place-items-center rounded-full border border-dashed border-border bg-background text-muted-foreground hover:border-brand-500 hover:text-brand-400"
          style={{ left: addPos.x, top: addPos.y }}
          title="Add a segment"
        >
          <Plus className="h-4 w-4" />
        </button>
        {addOpen ? (
          <>
            <div className="fixed inset-0 z-[11]" onClick={() => setAddOpen(false)} />
            <div data-nopan className="absolute z-[12] w-[214px] rounded-2xl border border-border bg-card p-1.5 shadow-2xl" style={{ left: addPos.x + 46, top: addPos.y }}>
              <div className="px-2 pb-1 pt-1.5 text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Add a segment</div>
              {ADD_ORDER.map((k) => {
                const M = KIND_META[k];
                return (
                  <button
                    key={k}
                    onClick={() => { setAddOpen(false); onAddSegment(k); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] font-semibold hover:bg-muted"
                  >
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md" style={{ background: M.tint }}>
                      <M.Icon className="h-3 w-3" style={{ color: M.color }} />
                    </span>
                    {ADD_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {/* ---- go live ---- */}
        <div data-node="__live" className="absolute w-[216px] overflow-hidden rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-card shadow-sm" style={{ left: livePos.x, top: livePos.y }}>
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <span className="grid h-[19px] w-[19px] place-items-center rounded-md bg-violet-500/20">
              <Radio className="h-3 w-3 text-violet-400" />
            </span>
            <b className="truncate text-[12px] font-bold">Go live</b>
            <span className={cn("ms-auto rounded-full px-1.5 py-px text-[9px] font-bold", allReady ? "bg-emerald-500/16 text-emerald-400" : "bg-slate-500/14 text-slate-400")}>
              {session.status === "live" ? "Live" : allReady ? "Ready" : "Needs setup"}
            </span>
          </div>
          {[
            ["Segments", String(segs.length)],
            ["Runtime", `${session.plannedMins} min`],
            ["Seats", String(session.seats)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 pt-1.5 text-[10px] text-muted-foreground">
              <span>{k}</span>
              <b className="text-foreground">{v}</b>
            </div>
          ))}
          <p className="mx-3 mt-2.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2 py-1.5 text-[9.5px] leading-relaxed text-muted-foreground">
            Billed for the time people are actually in the room.{" "}
            {estimate ? <b className="text-violet-400">≈ {estimate.total} credits</b> : null}
          </p>
          <button
            onClick={onGoLive}
            disabled={busy}
            className="m-3 mt-2.5 block w-[calc(100%-24px)] rounded-xl bg-gradient-to-br from-rose-600 to-rose-400 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-50"
          >
            <Play className="me-1 inline h-3 w-3" />
            {session.status === "live" ? "Rejoin the room" : "Start the session"}
          </button>
        </div>

        {/* ---- invite ---- */}
        <div data-node="__invite" className="absolute w-[208px] overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-500/10 to-card shadow-sm" style={{ left: invitePos.x, top: invitePos.y }}>
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <span className="grid h-[19px] w-[19px] place-items-center rounded-md bg-cyan-500/20">
              <Send className="h-3 w-3 text-cyan-400" />
            </span>
            <b className="truncate text-[12px] font-bold">Invite</b>
            <span className="ms-auto rounded-full bg-emerald-500/16 px-1.5 py-px text-[9px] font-bold text-emerald-400">
              {session.invites.filter((i) => i.sentAt).length} sent
            </span>
          </div>
          {[
            { Icon: Mail, label: "Email invite" },
            { Icon: Calendar, label: "Calendar hold" },
            { Icon: MessageSquare, label: "Team chat" },
            { Icon: Link2, label: "Public link" },
          ].map(({ Icon, label }) => (
            <button key={label} onClick={onInvite} className="mx-3 mt-1.5 flex w-[calc(100%-24px)] items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-1.5 text-[10px] hover:border-cyan-500">
              <span className="grid h-4 w-4 place-items-center rounded bg-cyan-500/15">
                <Icon className="h-2.5 w-2.5 text-cyan-400" />
              </span>
              {label}
            </button>
          ))}
          <div className="p-3 pt-2.5">
            <button onClick={onInvite} className="w-full rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 py-1.5 text-[9.5px] font-semibold text-white">
              Invite people
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-6 text-[10.5px] text-muted-foreground/50">
        Drag any node · drag empty space to pan · segments run left → right
      </div>
    </div>
  );
}
