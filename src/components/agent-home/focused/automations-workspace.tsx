"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Workflow, Sparkles, Mail, MessageSquare, Send, Clock, Cake, Gift, PartyPopper, RotateCcw, AlertTriangle, ShoppingCart, MoonStar, CalendarHeart, RefreshCw, Zap, Pause, Play, ChevronRight, X, Pencil, Trash2, Users, User, Layers, Save, CheckCircle2, XCircle, MinusCircle, Globe, Plus, LayoutGrid, Rocket, Check, Target, ArrowLeft, ArrowRight, ArrowLeftRight } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Follow-ups — an AI FLOW PLAYGROUND (the same canvas language as the Video
 * playground). The canvas BUILDS a campaign: name it, target a single contact /
 * multiple selected contacts / a segment, lay out a multi-step flow (message →
 * wait → message) with PERSONALIZED, merge-field messages, then "Build & launch
 * with AI" hands a structured brief to the agent on the left (onAsk) — it writes
 * & personalizes each message per contact and schedules every step.
 *
 * The right rail shows live campaigns; the toolbar "Library" opens a full
 * gallery of every campaign with status + statistics. Clicking a campaign opens
 * the in-surface DETAIL drawer (GET /api/automations/[id]) — full config,
 * delivery stats, recent activity, inline edit (PATCH), pause/activate (PATCH),
 * delete (DELETE). Audience data: GET /api/contacts, GET /api/contact-lists.
 * [[surface-buttons-are-ui-actions]] [[agent-operates-account-full-crud]]
 * [[new-design-no-legacy]]
 */

interface ContactListRef { id: string; name: string; totalCount: number; }
interface ContactListOption { id: string; name: string; totalCount: number; }
interface ContactOption { id: string; name: string; email?: string | null; phone?: string | null; company?: string | null; }
interface Automation {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  campaignType: string;
  subject?: string | null;
  content?: string;
  sendTime?: string;
  daysOffset?: number;
  timezone?: string;
  contactListId?: string | null;
  contactList?: ContactListRef | null;
  totalSent?: number;
  lastTriggered?: string | null;
}
interface Stats { total?: number; active?: number; totalSent?: number; }

interface AutomationStats {
  totalAttempted: number;
  sent: number;
  failed: number;
  skipped: number;
  successRate: number;
  failureRate: number;
  skipRate: number;
}
interface AutomationLog {
  id: string;
  contactId: string | null;
  status: string;
  error: string | null;
  sentAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}
interface AutomationDetail extends Automation {
  content: string;
  stats: AutomationStats;
  logs: AutomationLog[];
  totalLogs: number;
}

// Per-type display — icon + a friendly label (DB stores UPPER_SNAKE).
const TYPE_META: Record<string, { label: string; icon: ElementType }> = {
  BIRTHDAY: { label: "Birthday", icon: Cake },
  HOLIDAY: { label: "Holiday", icon: Gift },
  WELCOME: { label: "Welcome", icon: PartyPopper },
  RE_ENGAGEMENT: { label: "Re-engagement", icon: RotateCcw },
  CUSTOM: { label: "Custom", icon: Zap },
  TRIAL_ENDING: { label: "Trial ending", icon: Clock },
  PAYMENT_FAILED: { label: "Payment failed", icon: AlertTriangle },
  ABANDONED_CART: { label: "Abandoned cart", icon: ShoppingCart },
  INACTIVITY: { label: "Inactivity", icon: MoonStar },
  ANNIVERSARY: { label: "Anniversary", icon: CalendarHeart },
  SUBSCRIPTION_CHANGE: { label: "Subscription change", icon: RefreshCw },
};
const typeMeta = (t: string) => TYPE_META[t] ?? { label: t.replace(/_/g, " ").toLowerCase(), icon: Workflow };

// Common timezones — a compact, sensible set for the editor select.
const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Africa/Abidjan",
  "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
];

const MERGE_FIELDS = ["first_name", "last_name", "company", "last_order", "email"];
const WAIT_OPTIONS = [0, 1, 2, 3, 5, 7, 14];

function whenLabel(iso?: string | null): string {
  if (!iso) return "Not run yet";
  try { return `Last run ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`; } catch { return ""; }
}
function logWhen(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}
function offsetLabel(n?: number): string {
  if (typeof n !== "number" || n === 0) return "on the day";
  if (n < 0) return `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"} before`;
  return `${n} day${n === 1 ? "" : "s"} after`;
}
function waitLabel(n: number): string {
  if (!n || n <= 0) return "No wait";
  return `Wait ${n} day${n === 1 ? "" : "s"}`;
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";
const AVATAR_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4"];

/** Render a message with {{merge_field}} tokens highlighted. */
function Highlighted({ text }: { text: string }) {
  if (!text) return <span className="text-muted-foreground">No message yet</span>;
  const parts = text.split(/(\{\{.*?\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{.*\}\}$/.test(p)
          ? <span key={i} className="rounded bg-violet-500/15 px-1 font-semibold text-violet-300">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

type Channel = "EMAIL" | "SMS";
interface FlowStep { id: string; channel: Channel; subject: string; msg: string; wait: number; personalize: boolean; }
type AudienceMode = "single" | "multi" | "segment";
type LibFilter = "all" | "active" | "paused";

let _seq = 0;
const stepId = () => `st-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

const DEFAULT_STEPS = (): FlowStep[] => [
  { id: stepId(), channel: "EMAIL", subject: "", msg: "Hi {{first_name}}, ", wait: 0, personalize: true },
];

export function FocusedAutomations({ refreshKey, onAsk, agentBusy, canvasRef }: { refreshKey?: number; onAsk?: (prompt: string) => void; agentBusy?: boolean; canvasRef?: { current: { getContext: () => string; applyPatch: (patch: Record<string, unknown>) => void } | null } }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  // Portal the header actions into the FocusedView shell header (#fv-header-slot)
  // so there's ONE top bar instead of a second full-width toolbar under it.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [libFilter, setLibFilter] = useState<LibFilter>("all");
  const [working, setWorking] = useState(false);

  // Audience data.
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [lists, setLists] = useState<ContactListOption[]>([]);

  // Flow-builder state.
  const [name, setName] = useState("Untitled follow-up campaign");
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<AudienceMode>("multi");
  const [single, setSingle] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [segment, setSegment] = useState<string | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>(DEFAULT_STEPS);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/automations").then((r) => r.json());
      if (j?.success && j.data) {
        if (Array.isArray(j.data.automations)) setAutomations(j.data.automations);
        if (j.data.stats) setStats(j.data.stats);
        setError("");
      } else {
        setError(j?.error?.message || "Could not load your campaigns.");
      }
    } catch {
      setError("Could not load your campaigns.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Audience sources — segments (lists) + a first page of contacts for the picker.
  useEffect(() => {
    let alive = true;
    fetch("/api/contact-lists").then((r) => r.json()).then((j) => {
      if (alive && j?.success && Array.isArray(j.data?.lists)) setLists(j.data.lists as ContactListOption[]);
    }).catch(() => {});
    fetch("/api/contacts?limit=50").then((r) => r.json()).then((j) => {
      if (alive && j?.success && Array.isArray(j.data?.contacts)) setContacts(j.data.contacts as ContactOption[]);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Toggle active/paused inline — optimistic, then reconcile.
  const toggle = async (a: Automation) => {
    const next = !a.enabled;
    setBusyId(a.id);
    setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: next } : x)));
    setStats((s) => ({ ...s, active: Math.max(0, (s.active ?? 0) + (next ? 1 : -1)) }));
    try {
      const r = await fetch(`/api/automations/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success === false) {
        setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: a.enabled } : x)));
        setStats((s) => ({ ...s, active: Math.max(0, (s.active ?? 0) + (next ? -1 : 1)) }));
      } else {
        await load();
      }
    } catch {
      setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: a.enabled } : x)));
      setStats((s) => ({ ...s, active: Math.max(0, (s.active ?? 0) + (next ? -1 : 1)) }));
    } finally {
      setBusyId(null);
    }
  };

  const openAutomation = automations.find((a) => a.id === openId) || null;

  const contactById = useCallback((id: string) => contacts.find((c) => c.id === id), [contacts]);

  // Build the structured brief and hand it to the agent (the launch).
  const buildWithAI = () => {
    if (!onAsk) return;
    let aud = "";
    if (mode === "single") {
      const c = single ? contactById(single) : null;
      aud = c ? `a single contact — ${c.name}${c.email ? ` <${c.email}>` : c.phone ? ` (${c.phone})` : ""}` : "a single contact (I'll pick)";
    } else if (mode === "segment") {
      const s = lists.find((l) => l.id === segment);
      aud = s ? `the segment "${s.name}" (${s.totalCount.toLocaleString()} contacts)` : "a segment of contacts";
    } else {
      const names = selected.map((id) => contactById(id)).filter(Boolean).map((c) => `${c!.name}${c!.email ? ` <${c!.email}>` : c!.phone ? ` (${c!.phone})` : ""}`);
      aud = names.length ? `${names.length} selected contacts: ${names.join("; ")}` : "the contacts I select";
    }
    const stepLines = steps.map((s, i) => {
      const timing = i === 0 ? (s.wait === 0 ? "send immediately" : `after ${s.wait} day${s.wait === 1 ? "" : "s"}`) : `wait ${s.wait} day${s.wait === 1 ? "" : "s"}`;
      const subj = s.channel === "EMAIL" && s.subject.trim() ? ` — subject: ${JSON.stringify(s.subject.trim())}` : "";
      const body = s.msg.trim() ? ` — message: ${JSON.stringify(s.msg.trim())}` : " — (write the copy)";
      return `${i + 1}. [${s.channel}] ${timing}${subj}${body}${s.personalize ? " — personalize per contact" : ""}`;
    });
    const prompt = [
      `Set up and launch a follow-up campaign called "${name.trim() || "Untitled follow-up"}".`,
      brief.trim() ? `What I want: ${brief.trim()}` : "",
      `Audience: ${aud}.`,
      steps.length ? `Flow steps (in order):\n${stepLines.join("\n")}` : `Design the right sequence of steps yourself based on what I described.`,
      `Personalize each message to the contact (use their real first name, company, and history — replace any {{merge_fields}} with their actual data). Propose the plan + the exact credit cost first; on my confirm, create and schedule the sequence so each step goes out at the right time. Tell me when it's set up.`,
    ].filter(Boolean).join("\n");
    onAsk(prompt);
    setWorking(true);
    setTimeout(() => setWorking(false), 6000);
  };

  const addStep = () => {
    const s: FlowStep = { id: stepId(), channel: steps[steps.length - 1]?.channel ?? "EMAIL", subject: "", msg: "", wait: 2, personalize: true };
    setSteps((prev) => [...prev, s]);
    setEditingStep(s.id);
  };
  const patchStep = (id: string, patch: Partial<FlowStep>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeStep = (id: string) => setSteps((prev) => prev.filter((s) => s.id !== id));
  const newFlow = () => { setName("Untitled follow-up campaign"); setBrief(""); setSteps(DEFAULT_STEPS()); setSelected([]); setSingle(null); setSegment(null); setMode("multi"); setCur(0); };

  // Progressive wizard: reveal ONE node at a time. `cur` is the frontier/active
  // index into the virtual node list [audience(0), ...messages(1..N), launch(N+1)].
  // Only nodes 0..cur render; Continue/Back move the frontier.
  const trackRef = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  useEffect(() => {
    const el = trackRef.current?.querySelector(`[data-vi="${cur}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [cur, steps.length]);

  // ── Live agent-fill bridge ─────────────────────────────────────────────
  // getContext serializes the open flow (tagged [FOLLOWUP]) for the agent;
  // applyPatch lands the agent's update_followup_canvas fields live (name,
  // audience mode, the personalized steps) so the user watches it build.
  const [flashSteps, setFlashSteps] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildFollowupContext = (): string => {
    const segs = lists.slice(0, 20).map((l) => `${l.name} (${l.totalCount} contacts)`).join("; ");
    const aud = mode === "single" ? (single ? `single contact ${contactById(single)?.name ?? ""}` : "a single contact (none picked)")
      : mode === "multi" ? `${selected.length} selected contacts`
        : `segment ${segment ? (lists.find((l) => l.id === segment)?.name ?? "") : "(none picked)"}`;
    const stepsDesc = steps.map((s, i) => `${i + 1}. [${s.channel}] wait ${s.wait}d — ${s.channel === "EMAIL" && s.subject ? `subject ${JSON.stringify(s.subject)}; ` : ""}${JSON.stringify(s.msg)}${s.personalize ? " (personalized)" : ""}`).join("  |  ");
    return [
      "[FOLLOWUP] The Follow-ups flow canvas is OPEN. Build it live with update_followup_canvas — set the audience mode and write the personalized steps; they appear on screen.",
      `Campaign name: ${JSON.stringify(name)}.`,
      `Audience mode: ${mode} — ${aud}.`,
      `Steps now: ${stepsDesc || "(none yet)"}.`,
      lists.length ? `Available segments/lists (for 'segment' mode): ${segs}.` : "No contact lists yet — use 'multi' selected contacts or 'single'.",
    ].join("\n");
  };
  const applyFollowupPatch = (p: Record<string, unknown>) => {
    if (typeof p.name === "string") setName(p.name);
    if (p.audienceMode === "single" || p.audienceMode === "multi" || p.audienceMode === "segment") setMode(p.audienceMode);
    if (Array.isArray(p.steps)) {
      const mapped: FlowStep[] = (p.steps as Array<Record<string, unknown>>).map((s) => ({
        id: stepId(),
        channel: (s.channel === "SMS" ? "SMS" : "EMAIL") as Channel,
        subject: typeof s.subject === "string" ? s.subject : "",
        msg: typeof s.msg === "string" ? s.msg : (typeof s.message === "string" ? s.message : ""),
        wait: typeof s.wait === "number" ? s.wait : (typeof s.waitDays === "number" ? s.waitDays : 0),
        personalize: s.personalize !== false,
      })).filter((s) => s.msg.trim());
      if (mapped.length) {
        setSteps(mapped);
        setCur(mapped.length + 1); // reveal all the messages the agent wrote + launch
        setFlashSteps(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashSteps(false), 1500);
      }
    }
  };
  useEffect(() => {
    if (!canvasRef) return;
    canvasRef.current = { getContext: buildFollowupContext, applyPatch: applyFollowupPatch };
    return () => { if (canvasRef) canvasRef.current = null; };
  });

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your campaigns…" /></div>;
  }

  const total = stats.total ?? automations.length;
  const active = stats.active ?? automations.filter((a) => a.enabled).length;
  const totalSent = stats.totalSent ?? automations.reduce((sum, a) => sum + (a.totalSent ?? 0), 0);
  const editing = steps.find((s) => s.id === editingStep) || null;
  // Wizard validation: a node must be complete before Continue advances.
  const N = steps.length;
  const audienceValid = mode === "single" ? !!single : mode === "multi" ? selected.length > 0 : !!segment;
  const audienceHint = mode === "single" ? "Pick a contact to continue" : mode === "multi" ? "Select at least one contact" : "Pick a segment to continue";
  const msgValid = (i: number) => (steps[i]?.msg.trim().length ?? 0) > 0;
  const launchVi = N + 1;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header actions live in the shell header (#fv-header-slot) — one top bar. */}
      {(() => {
        const header = (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="w-[180px] min-w-0 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-[13.5px] font-bold outline-none hover:border-border focus:border-brand-500/60 focus:bg-background" />
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-amber-500">Draft</span>
            <button onClick={buildWithAI} disabled={!onAsk} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Build with AI</button>
            <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><LayoutGrid className="h-3.5 w-3.5" /> Library{total > 0 ? ` · ${total}` : ""}</button>
            <button onClick={newFlow} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> New</button>
          </>
        );
        return headerSlot ? createPortal(header, headerSlot) : (
          <div className="z-10 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-border bg-card/40 px-4 py-2 backdrop-blur">{header}</div>
        );
      })()}
      {error && <p className="mx-4 mb-2 mt-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>}

      {/* horizontal node canvas */}
      <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden" style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={trackRef} className="flex h-full min-w-max items-start gap-0 px-5 pb-6 pt-4">

          {/* AUDIENCE node (vi 0) — always the first step */}
          <div data-vi={0} className="flex h-full items-start animate-in fade-in slide-in-from-right-4 duration-300">
            <div className={cn("flex max-h-full w-[340px] shrink-0 flex-col self-start overflow-hidden rounded-2xl border bg-card", cur === 0 ? "border-brand-500/55 shadow-[0_16px_50px_-26px_rgba(14,165,233,0.5)]" : "border-border")}>
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                <span className={cn("grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 text-[12px] font-extrabold", cur > 0 ? "border-emerald-500 bg-emerald-500 text-white" : "border-transparent bg-gradient-to-r from-brand-500 to-violet-500 text-white")}>{cur > 0 ? <Check className="h-3.5 w-3.5" /> : 1}</span>
                <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audience</div><div className="text-[13px] font-bold">Who this targets</div></div>
              </div>
              <div className="flex gap-1.5 px-3.5 pb-2.5">
                {([["single", "Single", User], ["multi", "Selected", Users], ["segment", "Segment", Layers]] as const).map(([m, label, Icon]) => (
                  <button key={m} onClick={() => setMode(m)} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition", mode === m ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted text-muted-foreground hover:text-foreground")}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3">
                {mode === "single" ? (
                  <AudienceCard icon={single ? undefined : <User className="h-4 w-4" />} avatar={single ? contactById(single)?.name : undefined} title={single ? (contactById(single)?.name ?? "Contact") : "No contact picked"} sub={single ? (contactById(single)?.email ?? contactById(single)?.phone ?? "") : "Choose who to message"} onPick={() => setPickerOpen(true)} />
                ) : mode === "segment" ? (
                  <AudienceCard icon={<Layers className="h-4 w-4" />} violet title={segment ? (lists.find((l) => l.id === segment)?.name ?? "Segment") : "No segment picked"} sub={segment ? `${(lists.find((l) => l.id === segment)?.totalCount ?? 0).toLocaleString()} contacts match` : "Choose a list/segment"} onPick={() => setPickerOpen(true)} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selected.map((id, i) => {
                        const c = contactById(id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted py-0.5 pe-2.5 ps-0.5 text-[11.5px] font-semibold">
                            <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{initials(c?.name ?? "?")}</span>
                            {c?.name ?? "Contact"}
                          </span>
                        );
                      })}
                      <button onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground"><Plus className="h-3 w-3" /> {selected.length ? "Add / change" : "Select contacts"}</button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Each contact gets their own personalized copy of every message.</p>
                  </>
                )}
              </div>
              {cur === 0 && (
                <div className="flex items-center gap-2 border-t border-border bg-card/40 px-3.5 py-2.5">
                  <span className={cn("min-w-0 truncate text-[10.5px]", audienceValid ? "text-muted-foreground" : "text-amber-500")}>{audienceValid ? "Step 1 of " + (N + 2) : audienceHint}</span>
                  <button onClick={() => audienceValid && setCur(1)} disabled={!audienceValid} title={audienceValid ? "" : audienceHint} className={cn("ms-auto inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1 text-[11px] font-semibold text-white", !audienceValid && "cursor-not-allowed opacity-50")}>Continue <ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          </div>

          {/* MESSAGE step nodes — revealed one at a time up to cur */}
          {steps.map((s, i) => {
            const vi = i + 1;
            if (vi > cur) return null;
            const isActive = vi === cur;
            const isLast = i === N - 1;
            return (
              <div key={s.id} data-vi={vi} className="flex h-full items-start animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex h-full flex-col items-center justify-center px-1">
                  <button onClick={() => setEditingStep(s.id)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground"><Clock className="h-3 w-3" /> {i === 0 ? (s.wait === 0 ? "Start" : `${s.wait}d in`) : waitLabel(s.wait)}</button>
                </div>
                <div className={cn(
                  "flex max-h-full w-[340px] shrink-0 flex-col self-start overflow-hidden rounded-2xl border bg-card transition",
                  isActive ? "border-brand-500/55 shadow-[0_16px_50px_-26px_rgba(14,165,233,0.5)]" : "border-border",
                  flashSteps && "border-brand-500 ring-2 ring-brand-500/70 shadow-[0_0_34px_-6px_rgba(14,165,233,0.6)]",
                )}>
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                    <span className={cn("grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold", isActive ? "border-transparent bg-gradient-to-r from-brand-500 to-violet-500 text-white" : "border-emerald-500 bg-emerald-500 text-white")}>{isActive ? i + 2 : <Check className="h-3.5 w-3.5" />}</span>
                    <span className={cn("grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[9px]", s.channel === "EMAIL" ? "bg-brand-500/10 text-brand-500" : "bg-violet-500/10 text-violet-400")}>{s.channel === "EMAIL" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1} · {s.channel === "EMAIL" ? "Email" : "SMS"}</div><div className="truncate text-[12.5px] font-bold">{s.channel === "EMAIL" ? (s.subject || "Email message") : "SMS message"}</div></div>
                    <button onClick={() => setEditingStep(s.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit step"><Pencil className="h-3.5 w-3.5" /></button>
                    {steps.length > 1 && <button onClick={() => { removeStep(s.id); setCur((c) => Math.max(1, Math.min(c, steps.length - 1 + 1))); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-rose-500" aria-label="Remove step"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="rounded-[11px] border border-border bg-background px-3 py-2.5 text-[12px] leading-relaxed text-foreground/90">
                      {s.channel === "EMAIL" && s.subject && <div className="mb-1 font-bold text-foreground"><Highlighted text={s.subject} /></div>}
                      <Highlighted text={s.msg} />
                    </div>
                    {s.personalize && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-gradient-to-r from-brand-500/10 to-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300"><Sparkles className="h-3 w-3" /> Personalized</span>}
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-2 border-t border-border bg-card/40 px-3 py-2.5">
                      <button onClick={() => setCur((c) => Math.max(0, c - 1))} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
                      <span className={cn("min-w-0 truncate text-[10.5px]", msgValid(i) ? "text-muted-foreground" : "text-amber-500")}>{msgValid(i) ? `Step ${i + 2}` : "Write the message (or Build with AI)"}</span>
                      <span className="ms-auto" />
                      {isLast && (
                        <button onClick={() => { if (!msgValid(i)) return; addStep(); setCur(N + 1); }} disabled={!msgValid(i)} className={cn("inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground", !msgValid(i) && "cursor-not-allowed opacity-50")}><Plus className="h-3.5 w-3.5" /> Add step</button>
                      )}
                      <button onClick={() => msgValid(i) && setCur((c) => c + 1)} disabled={!msgValid(i)} className={cn("inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1 text-[11px] font-semibold text-white", !msgValid(i) && "cursor-not-allowed opacity-50")}>Continue <ArrowRight className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* LAUNCH node — revealed once every step is done */}
          {cur >= launchVi && (
            <div data-vi={launchVi} className="flex h-full items-start animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex h-full items-center px-1"><div className="h-0.5 w-6 rounded-full bg-gradient-to-r from-violet-500/45 to-brand-500/50" /></div>
              <div className="flex w-[320px] shrink-0 flex-col self-start rounded-2xl border border-brand-500/40 bg-gradient-to-b from-brand-500/10 to-violet-500/10 p-4 text-center">
                <div className="mb-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-bold"><Rocket className="h-4 w-4 text-brand-500" /> Launch flow</div>
                <p className="mb-2.5 text-[12px] text-muted-foreground">The agent finalizes the copy, <b className="text-violet-300">personalizes each message</b>, and schedules the steps. You confirm cost first.</p>
                <button onClick={buildWithAI} disabled={!onAsk} className="mx-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50"><Sparkles className="h-4 w-4" /> Build &amp; launch with AI</button>
                <button onClick={() => setCur((c) => Math.max(0, c - 1))} className="mx-auto mt-2 inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
              </div>
            </div>
          )}

        </div>
        <span className="pointer-events-none absolute bottom-3 right-3.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[10.5px] text-muted-foreground"><ArrowLeftRight className="h-3 w-3" /> Next / Back to move through · scroll sideways</span>
      </div>

      {/* step editor sheet */}
      {editing && (
        <StepSheet
          step={editing}
          index={steps.indexOf(editing) + 1}
          isFirst={steps.indexOf(editing) === 0}
          onPatch={(p) => patchStep(editing.id, p)}
          onClose={() => setEditingStep(null)}
        />
      )}

      {/* audience picker sheet */}
      {pickerOpen && (
        <AudiencePicker
          mode={mode}
          contacts={contacts}
          lists={lists}
          single={single}
          selected={selected}
          segment={segment}
          onPickSingle={(id) => { setSingle(id); setPickerOpen(false); }}
          onToggleContact={(id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
          onPickSegment={(id) => setSegment(id)}
          onSearch={async (q) => {
            try {
              const j = await fetch(`/api/contacts?limit=50&search=${encodeURIComponent(q)}`).then((r) => r.json());
              if (j?.success && Array.isArray(j.data?.contacts)) setContacts((prev) => mergeContacts(prev, j.data.contacts));
            } catch { /* keep current */ }
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* campaign library */}
      {libOpen && (
        <CampaignLibrary
          automations={automations}
          filter={libFilter}
          totals={{ total, active, totalSent }}
          busyId={busyId}
          onFilter={setLibFilter}
          onToggle={toggle}
          onOpen={(id) => { setLibOpen(false); setOpenId(id); }}
          onNew={() => { setLibOpen(false); newFlow(); }}
          onClose={() => setLibOpen(false)}
        />
      )}

      {/* agent working banner */}
      {(working || agentBusy) && (
        <div className="absolute bottom-4 left-1/2 z-[55] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-brand-500/40 bg-card px-4 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <FlowLoader size={15} />
          <span className="text-[12px]">The agent is building &amp; personalizing your flow — it’ll appear here. Reply in the chat to keep going.</span>
        </div>
      )}

      {/* detail drawer */}
      {openAutomation && (
        <AutomationDetailDrawer
          summary={openAutomation}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}

function mergeContacts(prev: ContactOption[], next: ContactOption[]): ContactOption[] {
  const byId = new Map(prev.map((c) => [c.id, c]));
  for (const c of next) byId.set(c.id, c);
  return Array.from(byId.values());
}

function Dot() { return <span className="inline-block h-[3px] w-[3px] rounded-full bg-current opacity-50" />; }

function AudienceCard({ icon, avatar, title, sub, violet, onPick }: { icon?: ReactNode; avatar?: string; title: string; sub: string; violet?: boolean; onPick: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[11px] border border-border bg-muted px-3 py-2.5">
      {avatar
        ? <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: AVATAR_COLORS[0] }}>{initials(avatar)}</span>
        : <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px]", violet ? "bg-violet-500/10 text-violet-400" : "bg-brand-500/10 text-brand-500")}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold">{title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <button onClick={onPick} className="shrink-0 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold hover:border-brand-500/60 hover:text-foreground">Change</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step editor — a bottom sheet (channel, subject, message + merge fields, wait,
// personalize toggle). Edits the in-memory flow; the agent renders it on launch.
// ---------------------------------------------------------------------------

const SHEET_FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

function StepSheet({ step, index, isFirst, onPatch, onClose }: { step: FlowStep; index: number; isFirst: boolean; onPatch: (p: Partial<FlowStep>) => void; onClose: () => void }) {
  const insertMerge = (f: string) => onPatch({ msg: `${step.msg}${step.msg && !step.msg.endsWith(" ") ? " " : ""}{{${f}}}` });
  return (
    <div className="absolute inset-0 z-50 flex justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute bottom-0 flex max-h-[80%] w-full max-w-[720px] flex-col rounded-t-[18px] border border-b-0 border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center gap-2 px-4 pb-2 pt-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Step {index}</span>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          <label className="mb-1.5 mt-1 block text-[11.5px] font-semibold text-muted-foreground">Channel</label>
          <div className="grid grid-cols-2 gap-2">
            {(["EMAIL", "SMS"] as const).map((ch) => (
              <button key={ch} onClick={() => onPatch({ channel: ch })} className={cn("inline-flex items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold transition", step.channel === ch ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted text-muted-foreground hover:text-foreground")}>
                {ch === "EMAIL" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} {ch === "EMAIL" ? "Email" : "SMS"}
              </button>
            ))}
          </div>

          {step.channel === "EMAIL" && (
            <>
              <label className="mb-1.5 mt-3.5 block text-[11.5px] font-semibold text-muted-foreground">Subject</label>
              <input value={step.subject} onChange={(e) => onPatch({ subject: e.target.value })} className={SHEET_FIELD} placeholder="Subject line" />
            </>
          )}

          <label className="mb-1.5 mt-3.5 block text-[11.5px] font-semibold text-muted-foreground">Message <span className="font-normal text-muted-foreground/70">— use merge fields to personalize</span></label>
          <textarea value={step.msg} onChange={(e) => onPatch({ msg: e.target.value })} rows={4} className={cn(SHEET_FIELD, "resize-y leading-relaxed")} placeholder="Write the message…" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((f) => (
              <button key={f} onClick={() => insertMerge(f)} className="rounded-[7px] border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/15">+ {`{{${f}}}`}</button>
            ))}
          </div>

          <label className="mb-1.5 mt-3.5 block text-[11.5px] font-semibold text-muted-foreground">{isFirst ? "Start the flow" : "Wait before this step"}</label>
          <select value={step.wait} onChange={(e) => onPatch({ wait: parseInt(e.target.value, 10) || 0 })} className={SHEET_FIELD}>
            {WAIT_OPTIONS.map((n) => <option key={n} value={n}>{n === 0 ? (isFirst ? "Send immediately" : "No wait") : `${n} day${n === 1 ? "" : "s"}${isFirst ? " after start" : ""}`}</option>)}
          </select>

          <div className="mt-3.5 flex items-center gap-2.5 rounded-[11px] border border-violet-500/30 bg-gradient-to-r from-brand-500/10 to-violet-500/10 px-3 py-2.5">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-violet-500/10 text-violet-400"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold">Personalize per contact</div>
              <div className="text-[11px] text-muted-foreground">The agent tailors this message to each contact&apos;s name, history &amp; context.</div>
            </div>
            <button onClick={() => onPatch({ personalize: !step.personalize })} className={cn("relative h-5 w-9 shrink-0 rounded-full border transition", step.personalize ? "border-transparent bg-gradient-to-r from-brand-500 to-violet-500" : "border-border bg-muted")}>
              <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all", step.personalize ? "left-[18px]" : "left-0.5")} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="ms-auto" />
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm"><Check className="h-4 w-4" /> Done</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audience picker — a bottom sheet. Single contact (radio), multi (checkbox), or
// a segment (contact list). Live search hits /api/contacts.
// ---------------------------------------------------------------------------

function AudiencePicker({ mode, contacts, lists, single, selected, segment, onPickSingle, onToggleContact, onPickSegment, onSearch, onClose }: {
  mode: AudienceMode;
  contacts: ContactOption[];
  lists: ContactListOption[];
  single: string | null;
  selected: string[];
  segment: string | null;
  onPickSingle: (id: string) => void;
  onToggleContact: (id: string) => void;
  onPickSegment: (id: string) => void;
  onSearch: (q: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => onSearch(q), 250); return () => clearTimeout(t); }, [q, onSearch]);
  const title = mode === "segment" ? "Choose a segment" : mode === "single" ? "Choose a contact" : "Select contacts";
  return (
    <div className="absolute inset-0 z-50 flex justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute bottom-0 flex max-h-[80%] w-full max-w-[720px] flex-col rounded-t-[18px] border border-b-0 border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center gap-2 px-4 pb-2 pt-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold"><Target className="h-4 w-4 text-brand-500" /> {title}</span>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-4 pb-3">
          {mode === "segment" ? (
            lists.length ? lists.map((l) => (
              <button key={l.id} onClick={() => onPickSegment(l.id)} className={cn("mt-2 flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left", segment === l.id ? "border-brand-500/60 bg-brand-500/10" : "border-border bg-muted hover:border-brand-500/40")}>
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-violet-500/10 text-violet-400"><Layers className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold">{l.name}</span><span className="block text-[11px] text-muted-foreground">{l.totalCount.toLocaleString()} contacts</span></span>
                <span className={cn("grid h-[18px] w-[18px] place-items-center rounded-[5px] border", segment === l.id ? "border-brand-500 bg-brand-500 text-white" : "border-border")}>{segment === l.id && <Check className="h-3 w-3" />}</span>
              </button>
            )) : <p className="py-8 text-center text-[12px] text-muted-foreground">No contact lists yet. Create a list under Contacts, or use “Selected contacts”.</p>
          ) : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="mt-1 w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
              {contacts.length ? contacts.map((c, i) => {
                const sel = mode === "single" ? single === c.id : selected.includes(c.id);
                return (
                  <button key={c.id} onClick={() => mode === "single" ? onPickSingle(c.id) : onToggleContact(c.id)} className={cn("mt-2 flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left", sel ? "border-brand-500/60 bg-brand-500/10" : "border-border bg-muted hover:border-brand-500/40")}>
                    <span className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border", sel ? "border-brand-500 bg-brand-500 text-white" : "border-border")}>{sel && <Check className="h-3 w-3" />}</span>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{initials(c.name)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{c.name}</span><span className="block truncate text-[11px] text-muted-foreground">{c.email || c.phone || ""}</span></span>
                  </button>
                );
              }) : <p className="py-8 text-center text-[12px] text-muted-foreground">No contacts found.</p>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted-foreground">{mode === "multi" ? `${selected.length} selected` : ""}</span>
          <button onClick={onClose} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm"><Check className="h-4 w-4" /> Done</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign library — a full-surface gallery of every campaign with KPIs, status
// filter, per-campaign status + statistics, and pause/activate + open.
// ---------------------------------------------------------------------------

function CampaignLibrary({ automations, filter, totals, busyId, onFilter, onToggle, onOpen, onNew, onClose }: {
  automations: Automation[];
  filter: LibFilter;
  totals: { total: number; active: number; totalSent: number };
  busyId: string | null;
  onFilter: (f: LibFilter) => void;
  onToggle: (a: Automation) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const counts = {
    all: automations.length,
    active: automations.filter((a) => a.enabled).length,
    paused: automations.filter((a) => !a.enabled).length,
  };
  const list = automations.filter((a) => filter === "all" ? true : filter === "active" ? a.enabled : !a.enabled);
  const kpis = [
    { n: totals.total.toLocaleString(), l: "Campaigns" },
    { n: totals.active.toLocaleString(), l: "Active" },
    { n: totals.totalSent.toLocaleString(), l: "Messages sent" },
    { n: counts.paused.toLocaleString(), l: "Paused" },
  ];
  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold"><LayoutGrid className="h-4 w-4 text-brand-500" /> Campaign library</span>
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">every follow-up campaign — status &amp; statistics</span>
        <div className="ms-auto flex items-center gap-2">
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> New campaign</button>
          <button onClick={onClose} aria-label="Close library" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-[13px] border border-border bg-card px-3.5 py-3">
              <div className="text-[22px] font-extrabold leading-none tabular-nums">{k.n}</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">{k.l}</div>
            </div>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "active", "paused"] as const).map((f) => (
            <button key={f} onClick={() => onFilter(f)} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold capitalize transition", filter === f ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted text-muted-foreground hover:text-foreground")}>
              {f} · {counts[f]}
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => {
              const m = typeMeta(a.type);
              const isEmail = (a.campaignType || "EMAIL").toUpperCase() === "EMAIL";
              const reach = a.contactList?.totalCount;
              return (
                <div key={a.id} className="overflow-hidden rounded-[14px] border border-border bg-card transition hover:border-brand-500/50">
                  <div className="flex items-center gap-2.5 px-3.5 py-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", a.enabled ? "bg-brand-500/10 text-brand-500" : "bg-muted text-muted-foreground")}><m.icon className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">{a.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">{isEmail ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}{m.label}</span>
                        {a.contactList?.name ? <><Dot /> <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{a.contactList.name}</span></> : null}
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", a.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{a.enabled ? "Active" : "Paused"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-t border-border">
                    <LibStat value={(a.totalSent ?? 0).toLocaleString()} label="Sent" tone="emerald" />
                    <LibStat value={typeof reach === "number" ? reach.toLocaleString() : "—"} label="Audience" border />
                    <LibStat value={whenLabel(a.lastTriggered).replace("Last run ", "") || "—"} label={a.lastTriggered ? "Last run" : ""} small />
                  </div>
                  <div className="flex items-center gap-2 border-t border-border bg-card/40 px-3.5 py-2.5">
                    <button onClick={() => onToggle(a)} disabled={busyId === a.id} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1 text-[11.5px] font-semibold transition disabled:opacity-60", a.enabled ? "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" : "border-brand-500/40 bg-brand-500/5 text-brand-500 hover:bg-brand-500/10")}>
                      {busyId === a.id ? <FlowLoader size={13} /> : a.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {a.enabled ? "Pause" : "Activate"}
                    </button>
                    <button onClick={() => onOpen(a.id)} className="ms-auto inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-brand-500">Open <ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid place-items-center py-20 text-center">
            <div className="max-w-xs">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Workflow className="h-6 w-6" /></span>
              <p className="mt-3 text-[13px] font-semibold">No {filter === "all" ? "" : filter} campaigns</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Build a flow on the canvas and launch it — it shows up here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LibStat({ value, label, tone, border, small }: { value: string; label: string; tone?: "emerald"; border?: boolean; small?: boolean }) {
  return (
    <div className={cn("px-2 py-2.5 text-center", border && "border-x border-border")}>
      <div className={cn("font-extrabold tabular-nums", small ? "text-[12px]" : "text-[16px]", tone === "emerald" && "text-emerald-500")}>{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer — full config, stats, recent activity log, plus inline edit
// (PATCH) and a two-step delete (DELETE). Opened from a campaign click.
// ---------------------------------------------------------------------------

interface EditState {
  name: string;
  subject: string;
  content: string;
  sendTime: string;
  daysOffset: string;
  timezone: string;
  contactListId: string;
}

const LOG_PAGE = 25;
const LOG_LIMIT_MAX = 200;

function AutomationDetailDrawer({ summary, onClose, onChanged, onDeleted }: {
  summary: Automation;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lists, setLists] = useState<ContactListOption[]>([]);
  const [form, setForm] = useState<EditState | null>(null);
  const [logLimit, setLogLimit] = useState(LOG_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);

  const m = typeMeta(summary.type);
  const isEmail = (summary.campaignType || "EMAIL").toUpperCase() === "EMAIL";

  const loadDetail = useCallback(async () => {
    try {
      const j = await fetch(`/api/automations/${summary.id}?logLimit=${logLimit}`).then((r) => r.json());
      if (j?.success && j.data?.automation) { setDetail(j.data.automation as AutomationDetail); setError(""); }
      else setError(j?.error?.message || "Could not load this campaign.");
    } catch {
      setError("Could not load this campaign.");
    }
  }, [summary.id, logLimit]);

  useEffect(() => {
    let alive = true;
    setDetail((d) => { if (!d) setLoading(true); return d; });
    loadDetail().finally(() => { if (alive) { setLoading(false); setLoadingMore(false); } });
    return () => { alive = false; };
  }, [loadDetail]);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    fetch("/api/contact-lists").then((r) => r.json()).then((j) => {
      if (alive && j?.success && Array.isArray(j.data?.lists)) setLists(j.data.lists as ContactListOption[]);
    }).catch(() => {});
    return () => { alive = false; };
  }, [editing]);

  const beginEdit = () => {
    const d = detail;
    setForm({
      name: d?.name ?? summary.name ?? "",
      subject: d?.subject ?? summary.subject ?? "",
      content: d?.content ?? "",
      sendTime: d?.sendTime ?? summary.sendTime ?? "09:00",
      daysOffset: String(d?.daysOffset ?? summary.daysOffset ?? 0),
      timezone: d?.timezone ?? summary.timezone ?? "UTC",
      contactListId: d?.contactListId ?? summary.contactListId ?? "",
    });
    setSaveError("");
    setEditing(true);
  };

  const setField = <K extends keyof EditState>(key: K, value: EditState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { setSaveError("Give the campaign a name."); return; }
    if (!form.content.trim()) { setSaveError("The message content can't be empty."); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.sendTime)) { setSaveError("Send time must be HH:mm (e.g. 09:00)."); return; }
    const offsetNum = Number.parseInt(form.daysOffset, 10);
    if (!Number.isFinite(offsetNum)) { setSaveError("Days offset must be a number."); return; }

    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch(`/api/automations/${summary.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          subject: isEmail ? (form.subject || null) : undefined,
          content: form.content,
          sendTime: form.sendTime,
          daysOffset: Math.max(-30, Math.min(30, offsetNum)),
          timezone: form.timezone || "UTC",
          contactListId: form.contactListId ? form.contactListId : null,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success === false) {
        setSaveError(j?.error?.message || "Could not save your changes.");
      } else {
        setEditing(false);
        await loadDetail();
        await onChanged();
      }
    } catch {
      setSaveError("Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const r = await fetch(`/api/automations/${summary.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success === false) {
        setSaveError(j?.error?.message || "Could not delete this campaign.");
        setConfirmDelete(false);
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch {
      setSaveError("Could not delete this campaign.");
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  const audienceLabel = detail?.contactList?.name ?? summary.contactList?.name ?? "All eligible contacts";
  const audienceReach = detail?.contactList?.totalCount ?? summary.contactList?.totalCount;

  return (
    <div className="absolute inset-0 z-[70] flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", summary.enabled ? "bg-brand-500/10 text-brand-500" : "bg-muted text-muted-foreground")}><m.icon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[14px] font-bold">{detail?.name ?? summary.name}</p>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", summary.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{summary.enabled ? "Active" : "Paused"}</span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">{isEmail ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}{m.label}</span>
              <span>· {isEmail ? "Email" : "SMS"}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="grid place-items-center py-16"><FlowLoader size={30} withMark label="Loading details…" /></div>
          ) : error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>
          ) : editing && form ? (
            <EditForm
              form={form} isEmail={isEmail} lists={lists}
              currentListName={audienceLabel}
              currentListId={(detail?.contactListId ?? summary.contactListId) || ""}
              saving={saving} saveError={saveError}
              onField={setField} onCancel={() => { setEditing(false); setSaveError(""); }} onSave={save}
            />
          ) : detail ? (
            <div className="space-y-4">
              {saveError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{saveError}</p>}
              <div>
                <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Delivery</h4>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile icon={CheckCircle2} tone="emerald" label="Sent" value={detail.stats.sent} rate={detail.stats.successRate} />
                  <StatTile icon={XCircle} tone="rose" label="Failed" value={detail.stats.failed} rate={detail.stats.failureRate} />
                  <StatTile icon={MinusCircle} tone="amber" label="Skipped" value={detail.stats.skipped} rate={detail.stats.skipRate} />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Settings</h4>
                <dl className="space-y-1.5 text-[12px]">
                  {isEmail && <Row label="Subject"><span className="text-foreground">{detail.subject || <span className="text-muted-foreground">—</span>}</span></Row>}
                  <Row label="Timing"><span className="inline-flex items-center gap-1 text-foreground"><Clock className="h-3 w-3 text-muted-foreground" />{detail.sendTime} · {offsetLabel(detail.daysOffset)}</span></Row>
                  <Row label="Timezone"><span className="inline-flex items-center gap-1 text-foreground"><Globe className="h-3 w-3 text-muted-foreground" />{detail.timezone || "UTC"}</span></Row>
                  <Row label="Audience"><span className="inline-flex items-center gap-1 text-foreground"><Users className="h-3 w-3 text-muted-foreground" />{audienceLabel}{typeof audienceReach === "number" ? ` (${audienceReach.toLocaleString()})` : ""}</span></Row>
                  <Row label="Last run"><span className="text-foreground">{whenLabel(detail.lastTriggered).replace(/^Last run /, "") === "Not run yet" ? "Not run yet" : new Date(detail.lastTriggered as string).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></Row>
                </dl>
                {detail.content && (
                  <div className="mt-2.5 border-t border-border pt-2.5">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/90">{detail.content}</p>
                  </div>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Recent activity</h4>
                {detail.logs.length ? (
                  <div className="space-y-1.5">
                    {detail.logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 rounded-[10px] border border-border bg-muted/20 px-2.5 py-2">
                        <LogBadge status={log.status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">{log.contactName || log.contactEmail || log.contactPhone || "Contact"}</p>
                          {log.error ? <p className="truncate text-[11px] text-rose-500">{log.error}</p>
                            : log.contactEmail || log.contactPhone ? <p className="truncate text-[11px] text-muted-foreground">{log.contactEmail || log.contactPhone}</p> : null}
                        </div>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">{logWhen(log.sentAt)}</span>
                      </div>
                    ))}
                    {detail.totalLogs > detail.logs.length && logLimit < LOG_LIMIT_MAX && (
                      <button type="button" onClick={() => { setLoadingMore(true); setLogLimit((n) => Math.min(LOG_LIMIT_MAX, n + LOG_PAGE)); }} disabled={loadingMore}
                        className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-muted/30 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60">
                        {loadingMore && <FlowLoader size={13} />} Load more ({(detail.totalLogs - detail.logs.length).toLocaleString()} left)
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">No deliveries logged yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {!loading && !error && !editing && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
            {confirmDelete ? (
              <>
                <button type="button" onClick={doDelete} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60">
                  {deleting ? <FlowLoader size={14} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60">Cancel</button>
              </>
            ) : (
              <>
                <button type="button" onClick={beginEdit} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm"><Pencil className="h-3.5 w-3.5" /> Edit settings</button>
                <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 px-3 py-2 text-[12px] font-semibold text-rose-500 transition hover:bg-rose-500/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function StatTile({ icon: Icon, tone, label, value, rate }: { icon: ElementType; tone: "emerald" | "rose" | "amber"; label: string; value: number; rate: number }) {
  const toneCls = tone === "emerald" ? "text-emerald-500" : tone === "rose" ? "text-rose-500" : "text-amber-500";
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-center">
      <Icon className={cn("mx-auto h-4 w-4", toneCls)} />
      <p className="mt-1 text-[18px] font-extrabold leading-none">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10.5px] text-muted-foreground">{label} · {rate}%</p>
    </div>
  );
}

function LogBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "SENT") return <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-3 w-3" /></span>;
  if (s === "FAILED") return <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-rose-500/10 text-rose-500"><XCircle className="h-3 w-3" /></span>;
  return <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-500"><MinusCircle className="h-3 w-3" /></span>;
}

function EditForm({ form, isEmail, lists, currentListName, currentListId, saving, saveError, onField, onCancel, onSave }: {
  form: EditState;
  isEmail: boolean;
  lists: ContactListOption[];
  currentListName: string;
  currentListId: string;
  saving: boolean;
  saveError: string;
  onField: <K extends keyof EditState>(key: K, value: EditState[K]) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const listOptions = useMemo(() => {
    const opts = [...lists];
    if (currentListId && !opts.some((l) => l.id === currentListId)) opts.unshift({ id: currentListId, name: currentListName, totalCount: 0 });
    return opts;
  }, [lists, currentListId, currentListName]);

  const F = "w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
  return (
    <div className="space-y-3.5">
      {saveError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{saveError}</p>}
      <Field label="Name"><input value={form.name} onChange={(e) => onField("name", e.target.value)} className={F} placeholder="Welcome series" /></Field>
      {isEmail && <Field label="Subject"><input value={form.subject} onChange={(e) => onField("subject", e.target.value)} className={F} placeholder="Welcome to the family 👋" /></Field>}
      <Field label={isEmail ? "Message body" : "Message"}><textarea value={form.content} onChange={(e) => onField("content", e.target.value)} rows={5} className={cn(F, "resize-y leading-relaxed")} placeholder="Write the message that goes out…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Send time"><input type="time" value={form.sendTime} onChange={(e) => onField("sendTime", e.target.value)} className={F} /></Field>
        <Field label="Days offset" hint="− before, + after"><input type="number" min={-30} max={30} value={form.daysOffset} onChange={(e) => onField("daysOffset", e.target.value)} className={F} /></Field>
      </div>
      <Field label="Timezone">
        <select value={TIMEZONES.includes(form.timezone) ? form.timezone : "__current"} onChange={(e) => onField("timezone", e.target.value === "__current" ? form.timezone : e.target.value)} className={F}>
          {!TIMEZONES.includes(form.timezone) && form.timezone && <option value="__current">{form.timezone}</option>}
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Field>
      <Field label="Audience list">
        <select value={form.contactListId} onChange={(e) => onField("contactListId", e.target.value)} className={F}>
          <option value="">All eligible contacts</option>
          {listOptions.map((l) => <option key={l.id} value={l.id}>{l.name}{l.totalCount ? ` (${l.totalCount.toLocaleString()})` : ""}</option>)}
        </select>
      </Field>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={onSave} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-60">
          {saving ? <FlowLoader size={15} tone="white" /> : <Save className="h-4 w-4" />} Save changes
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-[10px] border border-border px-3 py-2 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60">Cancel</button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-muted-foreground">
        <span>{label}</span>
        {hint && <span className="font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
