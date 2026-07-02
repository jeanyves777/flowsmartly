"use client";

import { useState, type DragEvent, type ReactNode, type MouseEvent } from "react";
import {
  Mail, MessageCircle, GitBranch, CheckSquare, CalendarDays, Sparkles,
  GripVertical, Pause, Play, Repeat, X, Plus, AlertTriangle, Zap, Printer, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

type Kind = "email" | "sms" | "whatsapp" | "cond" | "task" | "book";
type Status = "ready" | "blocked" | "paused" | "waiting" | "smart";

interface Step {
  id: string; kind: Kind; title: string; when: string; status: Status;
}

const CHANNEL_OF: Partial<Record<Kind, "email" | "sms" | "whatsapp">> = { email: "email", book: "email", sms: "sms", whatsapp: "whatsapp" };

const KIND_ICON: Record<Kind, typeof Mail> = {
  email: Mail, sms: MessageCircle, whatsapp: MessageCircle, cond: GitBranch, task: CheckSquare, book: CalendarDays,
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

export function LeadsAutomation({ listName, leadCount, onAsk }: { listName?: string; leadCount?: number; onAsk: (p: string) => void }) {
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [selected, setSelected] = useState<string>("pitch");
  const [dragId, setDragId] = useState<string | null>(null);
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
    <div>
      {/* audience + activate */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Folder /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold">{listName || "Select a list"}</p>
          <p className="text-[11px] text-muted-foreground">{leadCount ?? 0} leads · pitch → follow-ups → booking</p>
        </div>
        <label className="ms-auto inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-emerald-500">
          Automation on
          <span className="relative h-[22px] w-[38px] rounded-full bg-emerald-500/25"><span className="absolute left-[18px] top-0.5 h-[18px] w-[18px] rounded-full bg-emerald-500" /></span>
        </label>
      </div>

      {/* channels */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
        <span className="ms-auto text-[11.5px] text-amber-500">Steps stay blocked until their channel is connected</span>
      </div>

      {/* agent intelligence */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-500/25 bg-gradient-to-r from-brand-500/[0.06] to-violet-500/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-foreground/80">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
        <span>The agent routes <b>each lead down the best channel it has</b> — if the email goes unanswered and discovery found a valid WhatsApp number, it sends a WhatsApp follow-up before moving on. Channels a lead can't receive are skipped.</span>
        <button onClick={() => onAsk("Design the best multi-channel outreach sequence for this list — pitch, follow-ups, WhatsApp/SMS fallbacks, and a booking step.")} className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/50"><Sparkles className="h-3.5 w-3.5" /> Let the agent design the flow</button>
      </div>

      {/* two columns: draggable flow + step brief */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full lg:w-[344px] lg:shrink-0">
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
          <button onClick={() => onAsk("Add a step to my outreach automation — an email, SMS, WhatsApp message, a condition/branch, a manual task, or a wait.")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><Plus className="h-4 w-4" /> Add step</button>
        </div>

        <div className="min-w-0 flex-1">
          <StepBrief step={step} connected={connected} onAsk={onAsk} />
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
function StepBrief({ step, connected, onAsk }: { step: Step; connected: Record<string, boolean>; onAsk: (p: string) => void }) {
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
        ) : (
          <>
            <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">Style</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              <button onClick={() => onAsk(`Write the "${step.title}" ${step.kind === "whatsapp" ? "WhatsApp message" : step.kind === "sms" ? "SMS" : "email"} for my outreach automation in my brand voice, ${presets[style][0].toLowerCase()} style.`)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-4 w-4" /> Let the agent write it</button>
              <button className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold">Save step</button>
              <span className="text-[11.5px] text-muted-foreground">The agent drafts it in your brand voice — you approve before it sends.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BranchEditor({ onAsk }: { onAsk: (p: string) => void }) {
  const whens: [string, string][] = [["No reply", "to the last email"], ["Opened, no reply", "engaged"], ["Email bounced", "bad address"], ["Link clicked", "warm"]];
  const [w, setW] = useState(0);
  return (
    <>
      <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">When</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
