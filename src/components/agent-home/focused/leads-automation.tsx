"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode, type MouseEvent } from "react";
import {
  Mail, MessageCircle, GitBranch, CheckSquare, CalendarDays, Sparkles,
  GripVertical, Pause, Play, Repeat, X, Plus, AlertTriangle, Zap, Printer, Clock,
  Check, ChevronDown, Download, Folder as FolderIcon,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

const FLD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60";
interface ListLite { id: string; name: string; leadCount?: number; category?: string | null }

/**
 * Lead automation flow — the approved playground: a draggable vertical step
 * sequence (initial pitch → follow-ups → agent condition-branch → WhatsApp/SMS →
 * manual task → request-a-time) with a per-step brief on the right. Each channel
 * step is gated until its channel is connected; the agent writes each step.
 *
 * This is the UI layer (Build B). Persisting the sequence + the delayed-send
 * scheduler is Build C — for now steps are local and "write with agent" calls
 * onAsk so the agent drafts the copy in the chat.
 */

type Kind = "email" | "sms" | "whatsapp" | "cond" | "task" | "book" | "wait";
type Status = "ready" | "blocked" | "paused" | "waiting" | "smart";

interface Step {
  id: string; kind: Kind; title: string; when: string; status: Status;
  subject?: string; body?: string; pitchId?: string;
}

const CHANNEL_OF: Partial<Record<Kind, "email" | "sms" | "whatsapp">> = { email: "email", book: "email", sms: "sms", whatsapp: "whatsapp" };

const KIND_ICON: Record<Kind, typeof Mail> = {
  email: Mail, sms: MessageCircle, whatsapp: MessageCircle, cond: GitBranch, task: CheckSquare, book: CalendarDays, wait: Clock,
};
// Step types offered by the "Add step" menu (a real UI action, not an agent prompt).
const ADD_TYPES: { kind: Kind; label: string; icon: typeof Mail }[] = [
  { kind: "email", label: "Email step", icon: Mail },
  { kind: "sms", label: "SMS step", icon: MessageCircle },
  { kind: "whatsapp", label: "WhatsApp step", icon: MessageCircle },
  { kind: "cond", label: "Condition / branch", icon: GitBranch },
  { kind: "task", label: "Manual task", icon: CheckSquare },
  { kind: "wait", label: "Wait / delay", icon: Clock },
];
const NEW_STEP: Record<Kind, { title: string; when: string; status: Status }> = {
  email: { title: "New email", when: "+3 days", status: "blocked" },
  sms: { title: "New SMS", when: "+3 days", status: "blocked" },
  whatsapp: { title: "New WhatsApp", when: "+3 days", status: "blocked" },
  cond: { title: "If no reply", when: "agent routes per lead", status: "smart" },
  task: { title: "Manual task", when: "blocks until done", status: "waiting" },
  wait: { title: "Wait", when: "delay before next step", status: "ready" },
  book: { title: "Request a time", when: "on reply", status: "ready" },
};

const CHANNELS = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

const CH_COPY: Record<"email" | "sms" | "whatsapp", { warn: string; cta: string }> = {
  email: { warn: "Email marketing isn't connected — this step can't send yet.", cta: "Set up email" },
  sms: { warn: "SMS marketing isn't connected — this step is blocked until you enable SMS.", cta: "Set up SMS" },
  whatsapp: { warn: "WhatsApp isn't connected — connect it under Social accounts to send this step.", cta: "Connect WhatsApp" },
};

const DEFAULT_STEPS: Step[] = [
  { id: "pitch", kind: "email", title: "Initial pitch", when: "sends immediately", status: "blocked" },
  { id: "f1", kind: "email", title: "Follow-up 1", when: "+2 days", status: "blocked" },
  { id: "cond", kind: "cond", title: "If no reply · has WhatsApp", when: "agent routes per lead", status: "smart" },
  { id: "wa", kind: "whatsapp", title: "WhatsApp nudge", when: "if no reply", status: "blocked" },
  { id: "sms", kind: "sms", title: "SMS nudge", when: "+5 days", status: "paused" },
  { id: "task", kind: "task", title: "Mail a 3-fold flyer", when: "manual · print + post", status: "waiting" },
  { id: "book", kind: "book", title: "Request a time", when: "on reply", status: "ready" },
];

const STATUS_PILL: Record<Status, string> = {
  ready: "bg-emerald-500/15 text-emerald-500",
  blocked: "bg-amber-500/15 text-amber-500",
  paused: "bg-muted text-muted-foreground",
  waiting: "bg-amber-500/15 text-amber-500",
  smart: "bg-violet-500/15 text-violet-400",
};
const STATUS_LABEL: Record<Status, string> = { ready: "Ready", blocked: "Blocked", paused: "Paused", waiting: "Waiting", smart: "Smart" };

/** Map a UI step to the persisted step config the engine runs (delay from `when`). */
function toCfg(s: Step) {
  const m = /(\d+)/.exec(s.when || "");
  return {
    id: s.id, kind: s.kind, title: s.title, when: s.when,
    delayDays: (s.when || "").includes("day") && m ? Number(m[0]) : 0,
    requires: s.kind === "cond" ? "whatsapp" : undefined,
    status: s.status,
  };
}

export function LeadsAutomation({ listId, listName, leadCount, onAsk, refreshKey, lists, onSelectList }: { listId?: string; listName?: string; leadCount?: number; onAsk: (p: string) => void; refreshKey?: number; lists?: ListLite[]; onSelectList?: (l: ListLite) => void }) {
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [selected, setSelected] = useState<string>("pitch");
  const [dragId, setDragId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [writingStep, setWritingStep] = useState<string | null>(null);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const loadedRef = useRef(false);

  const updateStep = (id: string, patch: Partial<Step>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // "Let the agent write it": save the flow so the agent can find it, then ask the
  // agent (hidden) to compose + call build_sequence_step, which writes the copy INTO
  // this step's card (not the chat). A loader shows until the draft lands.
  const write = async (s: Step) => {
    if (listId) await fetch("/api/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId, name: `${listName || "List"} outreach`, steps: steps.map(toCfg) }) }).catch(() => {});
    setWritingStep(s.id);
    const w = s.kind === "sms" ? "SMS" : s.kind === "whatsapp" ? "WhatsApp message" : s.kind === "book" ? "booking request" : "email";
    onAsk(`Write the "${s.title}" ${w} for the "${listName || "lead"}" outreach automation${listId ? ` (listId: ${listId})` : ""} — personalize it for the audience's industry, in my brand voice. Then call build_sequence_step with listId="${listId || ""}", stepId="${s.id}" and the ${s.kind === "email" || s.kind === "book" ? "subject + " : ""}body so it lands in the step card. Don't paste it in the chat.`);
  };

  // Load the saved sequence for this list (steps + on/off state).
  useEffect(() => {
    loadedRef.current = false;
    if (!listId) { loadedRef.current = true; return; }
    let cancelled = false;
    (async () => {
      const j = await fetch(`/api/sequences?listId=${listId}`).then((r) => r.json()).catch(() => null);
      if (cancelled) return;
      const seq = j?.data?.sequence;
      if (seq) {
        setSequenceId(seq.id);
        setActive(seq.status === "active");
        try { const p = JSON.parse(seq.steps || "[]"); if (Array.isArray(p) && p.length) setSteps(p as Step[]); } catch { /* ignore */ }
      } else { setSequenceId(null); setActive(false); }
      loadedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [listId]);

  // Debounced autosave of the step list.
  useEffect(() => {
    if (!loadedRef.current || !listId) return;
    const t = setTimeout(async () => {
      const j = await fetch("/api/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId, name: `${listName || "List"} outreach`, steps: steps.map(toCfg) }) }).then((r) => r.json()).catch(() => null);
      if (j?.data?.sequence?.id) setSequenceId(j.data.sequence.id);
    }, 800);
    return () => clearTimeout(t);
  }, [steps, listId, listName]);

  // When we're waiting on the agent to write a step, reload after each agent turn
  // and clear the loader once the draft has landed on that step.
  useEffect(() => {
    if (!writingStep || !listId) return;
    (async () => {
      const j = await fetch(`/api/sequences?listId=${listId}`).then((r) => r.json()).catch(() => null);
      const seq = j?.data?.sequence;
      if (!seq) return;
      try {
        const p = JSON.parse(seq.steps || "[]") as Step[];
        const w = p.find((s) => s.id === writingStep);
        if (w && (w.body || w.subject)) { setSteps(p); setWritingStep(null); }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const toggleActive = async () => {
    if (!listId) return;
    let id = sequenceId;
    if (!id) {
      const j = await fetch("/api/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId, name: `${listName || "List"} outreach`, steps: steps.map(toCfg) }) }).then((r) => r.json()).catch(() => null);
      id = j?.data?.sequence?.id ?? null; setSequenceId(id);
    }
    if (!id) return;
    const next = !active; setActive(next);
    await fetch(`/api/sequences/${id}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next ? {} : { paused: true }) }).catch(() => {});
  };
  const addStep = (kind: Kind) => {
    const id = `${kind}-${Date.now().toString(36)}`;
    const n = NEW_STEP[kind];
    setSteps((prev) => [...prev, { id, kind, title: n.title, when: n.when, status: n.status }]);
    setSelected(id); setAddOpen(false);
  };
  // Channel connection state (mock — wired to MarketingConfig / social in Build C2).
  const [connected] = useState<Record<string, boolean>>({ email: false, sms: false, whatsapp: false });

  const step = steps.find((s) => s.id === selected) ?? steps[0];

  const move = (id: string, overId: string) => {
    if (id === overId) return;
    setSteps((prev) => {
      const from = prev.findIndex((s) => s.id === id);
      const to = prev.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };
  const onDrop = (e: DragEvent, overId: string) => { e.preventDefault(); if (dragId) move(dragId, overId); setDragId(null); };

  const togglePause = (id: string) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === "paused" ? "blocked" : "paused" } : s)));
  const removeStep = (id: string) => setSteps((prev) => prev.filter((s) => s.id !== id));

  return (
    <div
      className="-mx-4 -mt-3.5 -mb-6 min-h-full px-4 pb-6 pt-3.5 sm:-mx-5 sm:px-5"
      style={{ backgroundImage: "radial-gradient(circle, rgba(140,140,160,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
    >
      {/* audience + activate */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="relative">
          <button onClick={() => setListPickerOpen((v) => !v)} className="flex items-center gap-2.5 text-start">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Folder /></span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[13px] font-bold"><span className="truncate">{listName || "Select a list"}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></span>
              <span className="block text-[11px] text-muted-foreground">{leadCount ?? 0} leads · pitch → follow-ups → booking</span>
            </span>
          </button>
          {listPickerOpen && (
            <>
              <button aria-label="Close" onClick={() => setListPickerOpen(false)} className="fixed inset-0 z-10 cursor-default" />
              <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
                {(lists || []).length === 0 && <p className="px-2.5 py-2 text-[12px] text-muted-foreground">No lists yet — find or upload leads first.</p>}
                {(lists || []).map((l) => (
                  <button key={l.id} onClick={() => { onSelectList?.(l); setListPickerOpen(false); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start hover:bg-muted", l.id === listId && "text-brand-500")}>
                    <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{l.name}</span><span className="block text-[11px] text-muted-foreground">{l.leadCount ?? 0} leads</span></span>
                    {l.id === listId && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={toggleActive} disabled={!listId} title={listId ? "" : "Pick a list first"} className={cn("ms-auto inline-flex items-center gap-2 text-[12px] font-semibold disabled:opacity-50", active ? "text-emerald-500" : "text-muted-foreground")}>
          {active ? "Automation on" : "Automation off"}
          <span className={cn("relative h-[22px] w-[38px] rounded-full transition-colors", active ? "bg-emerald-500/25" : "bg-muted")}><span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all", active ? "left-[18px] bg-emerald-500" : "left-0.5 bg-muted-foreground")} /></span>
        </button>
      </div>

      {/* channels — compact row (the Blocked pills already flag disconnected steps) */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Channels</span>
        {CHANNELS.map((c) => {
          const on = connected[c.key];
          return (
            <button key={c.key} onClick={() => onAsk(`Help me connect ${c.label} so my outreach automation can send ${c.label} steps.`)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold", on ? "border-emerald-500/40" : "border-amber-500/40")}>
              <span className={cn("h-2 w-2 rounded-full", on ? "bg-emerald-500" : "bg-amber-500")} /> {c.label}
              <span className={cn("text-[11px] font-medium", on ? "text-emerald-500" : "text-amber-500")}>{on ? "connected" : c.key === "whatsapp" ? "connect in Social" : "set up"}</span>
            </button>
          );
        })}
      </div>

      {/* agent intelligence — compact one-liner */}
      <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-violet-500/25 bg-gradient-to-r from-brand-500/[0.06] to-violet-500/[0.06] px-3 py-1.5 text-[11.5px] text-foreground/70">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
        <span className="min-w-0 truncate">The agent routes each lead down the best channel it has — email → WhatsApp → SMS — skipping ones they can't receive.</span>
        <button onClick={() => onAsk("Design the best multi-channel outreach sequence for this list — pitch, follow-ups, WhatsApp/SMS fallbacks, and a booking step.")} className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold hover:border-brand-500/50"><Sparkles className="h-3 w-3" /> Let the agent design</button>
      </div>

      {/* draggable flow + step brief — stacks until there's real width (chat + menu open) */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="w-full xl:w-[330px] xl:shrink-0">
          {steps.map((s, i) => {
            const Icon = KIND_ICON[s.kind];
            return (
              <div key={s.id}>
                {i > 0 && <div className="ms-[26px] h-4 w-0.5 bg-gradient-to-b from-brand-500/50 to-violet-500/40" />}
                <div
                  onClick={() => setSelected(s.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, s.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-[13px] border bg-card p-3 transition",
                    selected === s.id ? "border-brand-500 shadow-[0_0_0_3px_rgba(46,166,255,0.14)]" : "border-border hover:border-brand-500/50",
                    s.status === "paused" && "opacity-60",
                    s.kind === "cond" && "border-dashed border-violet-500/40",
                    dragId === s.id && "opacity-40",
                  )}
                >
                  <span
                    draggable
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                    title="Drag to reorder"
                  ><GripVertical className="h-4 w-4" /></span>
                  <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg", tone(s.kind))}><Icon className="h-[15px] w-[15px]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold leading-tight">{s.title}</p>
                    <p className="text-[10.5px] text-muted-foreground">{s.when}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide", STATUS_PILL[s.status])}>{STATUS_LABEL[s.status]}</span>
                  <div className="flex shrink-0 gap-1">
                    {s.kind !== "cond" && s.kind !== "task" && (
                      <IconBtn title={s.status === "paused" ? "Activate" : "Pause"} onClick={(e) => { e.stopPropagation(); togglePause(s.id); }}>{s.status === "paused" ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}</IconBtn>
                    )}
                    <IconBtn title="Replace" onClick={(e) => e.stopPropagation()}><Repeat className="h-3 w-3" /></IconBtn>
                    <IconBtn title="Remove" onClick={(e) => { e.stopPropagation(); removeStep(s.id); }}><X className="h-3 w-3" /></IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="relative mt-3">
            <button onClick={() => setAddOpen((v) => !v)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><Plus className="h-4 w-4" /> Add step</button>
            {addOpen && (
              <>
                <button aria-label="Close" onClick={() => setAddOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
                  {ADD_TYPES.map((t) => (
                    <button key={t.kind} onClick={() => addStep(t.kind)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[12.5px] font-semibold hover:bg-muted">
                      <span className={cn("grid h-6 w-6 place-items-center rounded-md", tone(t.kind))}><t.icon className="h-3.5 w-3.5" /></span> {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <StepBrief step={step} connected={connected} onAsk={onAsk} onWrite={() => write(step)} />
          {(writingStep === step.id || step.body) && (
            <>
              <div className="ms-6 h-4 w-0.5 bg-gradient-to-b from-brand-500/50 to-violet-500/40" />
              <ResultCard step={step} writing={writingStep === step.id} onUpdate={(patch) => updateStep(step.id, patch)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function tone(k: Kind) {
  return {
    email: "bg-brand-500/12 text-brand-500",
    book: "bg-emerald-500/14 text-emerald-500",
    sms: "bg-violet-500/16 text-violet-400",
    whatsapp: "bg-emerald-500/16 text-emerald-400",
    cond: "bg-violet-500/16 text-violet-400",
    task: "bg-amber-500/14 text-amber-500",
    wait: "bg-muted text-muted-foreground",
  }[k];
}

function IconBtn({ children, title, onClick }: { children: ReactNode; title: string; onClick: (e: MouseEvent) => void }) {
  return <button title={title} onClick={onClick} className="grid h-[22px] w-[22px] place-items-center rounded-md border border-border text-muted-foreground hover:border-border/80 hover:text-foreground">{children}</button>;
}

const STYLE_PRESETS: Record<string, [string, string][]> = {
  email: [["Warm intro", "friendly"], ["Direct", "to the point"], ["Problem-led", "name a pain"], ["Story", "short anecdote"]],
  whatsapp: [["Short & friendly", "1–2 lines"], ["Question", "invite reply"], ["Voice note", "record"], ["Offer", "incentive"]],
  sms: [["Short & friendly", "1 line"], ["Question", "invite reply"], ["Reminder", "gentle"], ["Offer", "incentive"]],
  book: [["Discovery call", "15 min"], ["Demo", "screen-share"], ["Consult", "30 min"], ["Store visit", "in person"]],
};
const TASK_RECS: [string, string][] = [
  ["Call the lead", "phone"], ["Print & mail flyer", "3-fold · post"], ["Hand-deliver", "in person"], ["Send a mailer", "gift / package"],
];

/** Per-step brief — style/type + agent-build + channel gating, or the branch/task editors. */
function StepBrief({ step, connected, onAsk, onWrite }: { step: Step; connected: Record<string, boolean>; onAsk: (p: string) => void; onWrite: () => void }) {
  const [style, setStyle] = useState(0);
  const ch = CHANNEL_OF[step.kind];
  const isMsg = step.kind === "email" || step.kind === "sms" || step.kind === "whatsapp" || step.kind === "book";
  const presets = STYLE_PRESETS[step.kind] ?? STYLE_PRESETS.email;

  return (
    <div className="rounded-2xl border border-brand-500 bg-gradient-to-b from-brand-500/[0.05] to-transparent shadow-[0_20px_50px_-30px_rgba(46,166,255,0.6)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-500">{step.kind === "cond" ? "Branch" : step.kind === "task" ? "Task" : "Step"}</span>
        <b className="text-[13.5px]">{step.title}</b>
        <span className="text-[11px] text-muted-foreground">· {step.when}</span>
      </div>
      <div className="p-4">
        {step.kind === "cond" ? (
          <BranchEditor onAsk={onAsk} />
        ) : step.kind === "task" ? (
          <TaskEditor onAsk={onAsk} />
        ) : step.kind === "wait" ? (
          <WaitEditor />
        ) : (
          <>
            <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Style</p>
            <div className="grid grid-cols-2 gap-2">
              {presets.map(([t, h], i) => (
                <button key={t} onClick={() => setStyle(i)} className={cn("rounded-[10px] border p-2 text-center text-[12px] font-bold", i === style ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border")}>{t}<span className="block text-[10px] font-medium text-muted-foreground">{h}</span></button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-[11px] font-bold text-muted-foreground">Goal / offer for this step</p>
            <textarea rows={2} placeholder="What should this message achieve? Draw from your Brand Kit's services." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
            {isMsg && ch && !connected[ch] && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-3.5 py-2.5 text-[12.5px] text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{CH_COPY[ch].warn}</span>
                <button onClick={() => onAsk(`Help me ${CH_COPY[ch].cta.toLowerCase()} for my outreach automation.`)} className="ms-auto shrink-0 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white">{CH_COPY[ch].cta} →</button>
              </div>
            )}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button onClick={onWrite} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-4 w-4" /> Let the agent write it</button>
              <span className="text-[11.5px] text-muted-foreground">The agent drafts it below — you edit + approve before it sends.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The agent-written draft — shown in the playground (never the chat), editable + savable, collapsible. */
function ResultCard({ step, writing, onUpdate }: { step: Step; writing: boolean; onUpdate: (p: Partial<Step>) => void }) {
  const [open, setOpen] = useState(true);
  const [subject, setSubject] = useState(step.subject || "");
  const [body, setBody] = useState(step.body || "");
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { setSubject(step.subject || ""); setBody(step.body || ""); }, [step.id, step.subject, step.body]);
  const isEmail = step.kind === "email" || step.kind === "book";

  if (writing && !step.body) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mx-auto w-fit"><FlowLoader size={30} withMark /></div>
        <p className="mt-3 text-center text-[12.5px] text-muted-foreground">The agent is writing this step in your brand voice…</p>
      </div>
    );
  }
  const downloadPdf = async () => {
    if (!step.pitchId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/pitch/${step.pitchId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfOnly: true }) });
      if (!res.ok) return;
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${step.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally { setDownloading(false); }
  };
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-start">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500/15 text-emerald-500"><Check className="h-3.5 w-3.5" /></span>
        <b className="text-[13px]">Draft ready</b>
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">— edit &amp; save; it personalizes per lead on send</span>
        <ChevronDown className={cn("ms-auto h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          {isEmail && (
            <>
              <label className="mb-1.5 block text-[11px] font-bold text-muted-foreground">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={FLD} />
            </>
          )}
          <label className="mb-1.5 mt-3 block text-[11px] font-bold text-muted-foreground">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={cn(FLD, "resize-y leading-relaxed")} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => onUpdate({ subject, body })} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white">Save</button>
            {step.pitchId && <button onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><Download className="h-4 w-4" /> {downloading ? "Preparing…" : "Download PDF"}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function WaitEditor() {
  return (
    <>
      <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Wait before the next step</p>
      <div className="flex items-center gap-2">
        <input type="number" defaultValue={3} min={0} className="w-20 rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
        <span className="text-[12.5px] text-muted-foreground">days</span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"><Clock className="h-4 w-4" /> Holds each lead here, then continues the sequence.</p>
      <div className="mt-3.5"><button className="rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white">Save</button></div>
    </>
  );
}

function BranchEditor({ onAsk }: { onAsk: (p: string) => void }) {
  const whens: [string, string][] = [["No reply", "to the last email"], ["Opened, no reply", "engaged"], ["Email bounced", "bad address"], ["Link clicked", "warm"]];
  const [w, setW] = useState(0);
  return (
    <>
      <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">When</p>
      <div className="grid grid-cols-2 gap-2">
        {whens.map(([t, h], i) => (
          <button key={t} onClick={() => setW(i)} className={cn("rounded-[10px] border p-2 text-center text-[12px] font-bold", i === w ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border")}>{t}<span className="block text-[10px] font-medium text-muted-foreground">{h}</span></button>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-[11px] font-bold text-muted-foreground">Then</p>
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-[12px]"><MessageCircle className="h-4 w-4 text-emerald-400" /> Send the <b>WhatsApp nudge</b> — else skip to the next email</div>
      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"><Zap className="h-4 w-4 text-violet-400" /> The agent evaluates this per lead from the contact info found in discovery, and skips channels a lead can't receive.</div>
      <button onClick={() => onAsk("Configure the branch: if a lead doesn't reply and has a WhatsApp number, route them to the WhatsApp step.")} className="mt-3.5 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-4 w-4" /> Save branch</button>
    </>
  );
}

function TaskEditor({ onAsk }: { onAsk: (p: string) => void }) {
  const [rec, setRec] = useState(1);
  return (
    <>
      <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Task type — <span className="text-brand-500">the agent suggests</span></p>
      <div className="grid grid-cols-2 gap-2">
        {TASK_RECS.map(([t, h], i) => (
          <button key={t} onClick={() => setRec(i)} className={cn("rounded-[10px] border p-2 text-center text-[12px] font-bold", i === rec ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border")}>{t}<span className="block text-[10px] font-medium text-muted-foreground">{h}</span></button>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-[11px] font-bold text-muted-foreground">What needs to happen?</p>
      <textarea rows={2} defaultValue="Print the pitch as a 3-fold flyer in Print Studio and post it to the prospect's mailing address. Mark done once it's in the mail — then the next step triggers." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
      {rec === 1 && <p className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground"><Printer className="h-4 w-4" /> Opens Print Studio with the pitch as a tri-fold — order print + mail, or fulfil it yourself.</p>}
      <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"><Clock className="h-4 w-4" /> The sequence pauses here until this task is marked done — then the next step triggers.</p>
      <button onClick={() => onAsk(`Set up a manual task step: "${TASK_RECS[rec][0]}" — it should pause the sequence until I mark it done.`)} className="mt-3.5 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-4 w-4" /> Save task</button>
    </>
  );
}

function Folder() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l2-3h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7z" /></svg>;
}
