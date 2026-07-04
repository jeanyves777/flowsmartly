"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode, type MouseEvent } from "react";
import {
  Mail, MessageCircle, GitBranch, CheckSquare, CalendarDays, Sparkles,
  GripVertical, Pause, Play, Repeat, X, Plus, AlertTriangle, Zap, Printer, Clock,
  Check, ChevronDown, Download, Folder as FolderIcon, FileText, Users2,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

const FLD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60";
interface ListLite { id: string; name: string; leadCount?: number; category?: string | null }
interface AudienceLead { id: string; name: string; email?: string | null; phone?: string | null; category?: string | null }

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

/** Map a UI step to the persisted step config the engine runs (delay from `when`).
 * Preserves the agent-written copy (subject/body) and the attached pitchId so an
 * autosave round-trip never wipes what the agent wrote into the step. */
function toCfg(s: Step) {
  const m = /(\d+)/.exec(s.when || "");
  return {
    id: s.id, kind: s.kind, title: s.title, when: s.when,
    delayDays: (s.when || "").includes("day") && m ? Number(m[0]) : 0,
    requires: s.kind === "cond" ? "whatsapp" : undefined,
    status: s.status,
    subject: s.subject, body: s.body, pitchId: s.pitchId,
  };
}

export function LeadsAutomation({ listId, listName, leadCount, onAsk, refreshKey, lists, onSelectList, agentBusy, onPitchLead }: { listId?: string; listName?: string; leadCount?: number; onAsk: (p: string) => void; refreshKey?: number; lists?: ListLite[]; onSelectList?: (l: ListLite) => void; agentBusy?: boolean; onPitchLead?: (lead: { id: string; name: string }) => void }) {
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [selected, setSelected] = useState<string>("pitch");
  const [dragId, setDragId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [writingStep, setWritingStep] = useState<string | null>(null);
  const [designing, setDesigning] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  // Reachability — how many leads have an email OR phone (the pipeline can only
  // run on those). Split by channel: email steps need an email, SMS/WhatsApp a phone.
  const [reach, setReach] = useState<{ total: number; reachable: number; withEmail: number; withPhone: number } | null>(null);
  // Contact selection — who the automation runs for (default: all reachable).
  const [contacts, setContacts] = useState<AudienceLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selOpen, setSelOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [runMode, setRunMode] = useState<"group" | "stagger" | "single">("group");
  const lastListRef = useRef<string | undefined>(undefined);
  const loadedRef = useRef(false);
  const { toast } = useToast();

  const updateStep = (id: string, patch: Partial<Step>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // "Let the agent write it": save the flow so the agent can find it, then ask the
  // agent (hidden) to compose + call build_sequence_step, which writes the copy INTO
  // this step's card (not the chat). A loader shows until the draft lands.
  const write = async (s: Step) => {
    if (!listId) return; // need a target list before the agent can write/personalize
    await fetch("/api/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId, name: `${listName || "List"} outreach`, steps: steps.map(toCfg) }) }).catch(() => {});
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

  // Load the list's contacts (for selection) + reachability. Re-checked after
  // each agent turn (refreshKey) so enrichment lifts the count live. Selection is
  // (re)initialised to all-reachable only when the LIST changes, not on refresh —
  // so a user's include/exclude choices survive.
  useEffect(() => {
    if (!listId) { setReach(null); setContacts([]); return; }
    let cancelled = false;
    (async () => {
      const d = await fetch(`/api/leads/lists/${listId}`).then((r) => r.json()).catch(() => null);
      if (cancelled) return;
      const rows: AudienceLead[] = (d?.data?.leads || []).map((l: AudienceLead) => ({ id: l.id, name: l.name, email: l.email, phone: l.phone, category: l.category }));
      setContacts(rows);
      const reachableIds = rows.filter((l) => (l.email && String(l.email).trim()) || (l.phone && String(l.phone).trim())).map((l) => l.id);
      setReach({ total: rows.length, reachable: reachableIds.length, withEmail: rows.filter((l) => l.email && String(l.email).trim()).length, withPhone: rows.filter((l) => l.phone && String(l.phone).trim()).length });
      if (lastListRef.current !== listId) { lastListRef.current = listId; setSelectedIds(new Set(reachableIds)); }
    })();
    return () => { cancelled = true; };
  }, [listId, refreshKey]);

  const isReachable = (l: AudienceLead) => !!((l.email && String(l.email).trim()) || (l.phone && String(l.phone).trim()));
  const selectedCount = contacts.filter((l) => selectedIds.has(l.id) && isReachable(l)).length;
  const toggleContact = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = (on: boolean) => setSelectedIds(on ? new Set(contacts.filter(isReachable).map((l) => l.id)) : new Set());

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

  // When the agent FINISHES (busy→idle): pull the latest sequence (so a full
  // "design" lands on every step) and clear any loaders — a chat-only turn that
  // wrote nothing must never leave a spinner stuck.
  const wasBusyRef = useRef(false);
  useEffect(() => {
    const justFinished = wasBusyRef.current && !agentBusy;
    wasBusyRef.current = !!agentBusy;
    if (!justFinished || !listId) return;
    (async () => {
      const j = await fetch(`/api/sequences?listId=${listId}`).then((r) => r.json()).catch(() => null);
      const seq = j?.data?.sequence;
      if (seq) { try { const p = JSON.parse(seq.steps || "[]") as Step[]; if (Array.isArray(p) && p.length) setSteps(p); } catch { /* ignore */ } }
      setDesigning(false); setWritingStep(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentBusy]);

  const toggleActive = async () => {
    if (!listId) return;
    // Guard: don't try to turn it on when no SELECTED lead can be reached.
    if (!active && selectedCount === 0) {
      toast({ title: "No one selected to reach", description: reach && reach.reachable === 0 ? `None of these leads have an email or phone. Enrich the list first.` : "Select at least one reachable contact to run the automation." });
      return;
    }
    let id = sequenceId;
    if (!id) {
      const j = await fetch("/api/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId, name: `${listName || "List"} outreach`, steps: steps.map(toCfg) }) }).then((r) => r.json()).catch(() => null);
      id = j?.data?.sequence?.id ?? null; setSequenceId(id);
    }
    if (!id) return;
    const next = !active; setActive(next);
    // Enroll only the selected contacts (the server still skips any unreachable).
    const body = next ? { leadIds: Array.from(selectedIds), mode: runMode } : { paused: true };
    const res = await fetch(`/api/sequences/${id}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
    if (next) {
      if (res && res.success === false) {
        setActive(false);
        toast({ title: "Can't turn on yet", description: res.error?.message || "None of the selected leads have contact info." });
        return;
      }
      const sk = Number(res?.data?.skipped) || 0;
      const en = Number(res?.data?.enrolled) || 0;
      toast({ title: "Automation on", description: `${en} contact${en === 1 ? "" : "s"} enrolled${sk > 0 ? ` · ${sk} skipped (no email/phone)` : ""}.` });
    }
  };
  const addStep = (kind: Kind) => {
    const id = `${kind}-${Date.now().toString(36)}`;
    const n = NEW_STEP[kind];
    setSteps((prev) => [...prev, { id, kind, title: n.title, when: n.when, status: n.status }]);
    setSelected(id); setAddOpen(false);
  };
  // Real channel-connected state (email/SMS via MarketingConfig, WhatsApp via a
  // connected Meta account) — re-checked after each agent turn.
  const [connected, setConnected] = useState<Record<string, boolean>>({ email: false, sms: false, whatsapp: false });
  useEffect(() => {
    fetch("/api/sequences/channels").then((r) => r.json()).then((j) => { if (j?.success) setConnected(j.data as Record<string, boolean>); }).catch(() => {});
  }, [refreshKey]);

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
              <span className="block text-[11px] text-muted-foreground">{reach ? `${reach.withEmail} with email · ${reach.withPhone} with phone · ${reach.total} total` : `${leadCount ?? 0} leads`}</span>
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
        {listId && contacts.length > 0 && (
          <button onClick={() => setSelOpen((v) => !v)} className={cn("ms-auto inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-semibold", selOpen ? "border-brand-500/50 text-brand-500" : "border-border text-muted-foreground hover:text-foreground")}>
            <Users2 className="h-3.5 w-3.5" /> {selectedCount}/{contacts.length} selected <ChevronDown className={cn("h-3.5 w-3.5 transition", selOpen && "rotate-180")} />
          </button>
        )}
        <button onClick={toggleActive} disabled={!listId} title={listId ? "" : "Pick a list first"} className={cn("inline-flex items-center gap-2 text-[12px] font-semibold disabled:opacity-50", contacts.length > 0 ? "" : "ms-auto", active ? "text-emerald-500" : "text-muted-foreground")}>
          {active ? "Automation on" : "Automation off"}
          <span className={cn("relative h-[22px] w-[38px] rounded-full transition-colors", active ? "bg-emerald-500/25" : "bg-muted")}><span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all", active ? "left-[18px] bg-emerald-500" : "left-0.5 bg-muted-foreground")} /></span>
        </button>
      </div>

      {/* contact selection — pick exactly who the automation runs for */}
      {selOpen && listId && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <button onClick={() => selectAll(selectedCount < contacts.filter(isReachable).length)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
              <span className={cn("grid h-4 w-4 place-items-center rounded border", selectedCount === 0 ? "border-[#3a4150]" : "border-brand-500 bg-brand-500 text-white")}>{selectedCount > 0 && (selectedCount === contacts.filter(isReachable).length ? <Check className="h-3 w-3" /> : <span className="h-0.5 w-2 bg-white" />)}</span>
              {selectedCount} selected
            </button>
            <div className="relative min-w-[140px] flex-1">
              <input value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} placeholder="Search this list…" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
            </div>
            <span className="text-[11px] text-muted-foreground">Untick to exclude</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {contacts.filter((l) => !contactQuery.trim() || [l.name, l.category, l.email].some((s) => (s || "").toLowerCase().includes(contactQuery.trim().toLowerCase()))).map((l) => {
              const reachable = isReachable(l);
              const on = selectedIds.has(l.id) && reachable;
              return (
                <div key={l.id} className={cn("flex items-center gap-2.5 border-t border-border px-3 py-2 text-[12.5px]", !reachable && "opacity-50")}>
                  <button disabled={!reachable} onClick={() => toggleContact(l.id)} className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", on ? "border-brand-500 bg-brand-500 text-white" : "border-[#3a4150]", !reachable && "cursor-not-allowed")}>{on && <Check className="h-3 w-3" />}</button>
                  <div className="min-w-0"><span className="block truncate font-semibold">{l.name}</span><span className="block truncate text-[11px] text-muted-foreground">{l.category || "—"}</span></div>
                  <span className="ms-auto truncate text-[11.5px] text-muted-foreground">{l.email || l.phone || (reachable ? "" : "no email/phone")}</span>
                  {onPitchLead && <button onClick={() => onPitchLead({ id: l.id, name: l.name })} title="Full-edit this contact's pitch in Pitch Studio" className="shrink-0 rounded-[7px] border border-border px-2 py-0.5 text-[11px] font-semibold text-brand-400 hover:border-brand-500/50">Customize</button>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-[#0e1117] px-3 py-2">
            <span className="text-[12px] text-muted-foreground"><b className="text-foreground">{selectedCount}</b> will be enrolled</span>
            <div className="ms-auto inline-flex overflow-hidden rounded-[8px] border border-border">
              {([["group", "Group"], ["stagger", "One at a time"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => setRunMode(m)} className={cn("px-2.5 py-1 text-[11px] font-bold", runMode === m ? "bg-brand-500/15 text-brand-400" : "text-muted-foreground")}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* reachability guard — the pitch step is EMAIL, so email coverage matters most;
          phone-only leads can still be reached on the SMS/WhatsApp branch. */}
      {reach && reach.total > 0 && (reach.reachable < reach.total || reach.withEmail < reach.total) && (
        <div className={cn("mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2 text-[12px]", reach.reachable === 0 || reach.withEmail === 0 ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-border bg-card text-muted-foreground")}>
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          {reach.reachable === 0
            ? <span>None of these <b className="text-foreground">{reach.total}</b> leads have an email or phone — the automation can’t reach anyone yet.</span>
            : reach.withEmail === 0
              ? <span>None have an <b className="text-foreground">email</b> yet, so the email pitch can’t send — {reach.withPhone} have a phone (SMS/WhatsApp only). Enrich to find emails.</span>
              : <span>Only <b className="text-foreground">{reach.withEmail}</b> of {reach.total} have an <b className="text-foreground">email</b> for the pitch{reach.total - reach.reachable > 0 ? `; ${reach.total - reach.reachable} have neither and are skipped` : `; the other ${reach.total - reach.withEmail} are phone-only (SMS/WhatsApp)`}. Enrich for emails to pitch everyone.</span>}
          <button onClick={() => onAsk(`Enrich every lead in the "${listName || "list"}" list${listId ? ` (listId: ${listId})` : ""} that has no email or phone. Call propose_plan first (two AI_WEB_SEARCH per lead — the search + the save) so I can approve the cost, then find each one's WORK EMAIL (the priority — the email pitch needs it) and PHONE, plus website + address. The email is rarely in search results — web_fetch their WEBSITE + its /contact page and read it out (info@ / bookings@ / the owner's). Call enrich_lead with the SAME confirmed planId and every field you found (email, phone, website, address, linkedin). If you hit the per-turn search limit, enrich the ones you found and tell me you'll continue the rest. Do not paste the details in chat — they must land in each lead's row.`)} className="ms-auto inline-flex items-center gap-1.5 rounded-[8px] border border-amber-500/50 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/15"><Sparkles className="h-3 w-3" /> Enrich list</button>
        </div>
      )}

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
        <button onClick={() => { if (!listId) return; setDesigning(true); onAsk(`Design the best multi-channel outreach sequence for the "${listName || "lead"}" list${listId ? ` (listId: ${listId})` : ""} — pitch, follow-ups, WhatsApp/SMS fallbacks, and a booking step — then call build_sequence_step for each step so the copy lands in the step cards (not the chat).`); }} disabled={!listId || designing} title={listId ? "" : "Select a list first"} className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold hover:border-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50">{designing ? <FlowLoader size={12} /> : <Sparkles className="h-3 w-3" />} {designing ? "Designing…" : "Let the agent design"}</button>
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
          <StepBrief step={step} connected={connected} onAsk={onAsk} onWrite={() => write(step)} hasList={!!listId} />
          {(writingStep === step.id || step.body) && (
            <>
              <div className="ms-6 h-4 w-0.5 bg-gradient-to-b from-brand-500/50 to-violet-500/40" />
              <ResultCard step={step} writing={writingStep === step.id} onUpdate={(patch) => updateStep(step.id, patch)} onAsk={onAsk} listName={listName} agentBusy={agentBusy} />
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
function StepBrief({ step, connected, onAsk, onWrite, hasList }: { step: Step; connected: Record<string, boolean>; onAsk: (p: string) => void; onWrite: () => void; hasList: boolean }) {
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
              <button onClick={onWrite} disabled={!hasList} title={hasList ? "" : "Select a list first"} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="h-4 w-4" /> Let the agent write it</button>
              <span className="text-[11.5px] text-muted-foreground">{hasList ? "The agent drafts it below — you edit + approve before it sends." : "Select a list first — the agent personalizes each step to it."}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The agent-written draft — shown in the playground (never the chat), editable + savable, collapsible. */
function ResultCard({ step, writing, onUpdate, onAsk, listName, agentBusy }: { step: Step; writing: boolean; onUpdate: (p: Partial<Step>) => void; onAsk: (p: string) => void; listName?: string; agentBusy?: boolean }) {
  const [open, setOpen] = useState(true);
  const [subject, setSubject] = useState(step.subject || "");
  const [body, setBody] = useState(step.body || "");
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
          </div>
          {/* Editable, collapsible PITCH PDF attachment — only on email steps. */}
          {isEmail && <PitchPanel step={step} listName={listName} onAsk={onAsk} agentBusy={agentBusy} />}
        </div>
      )}
    </div>
  );
}

/** The branded pitch PDF attached to an email step — generate via the agent, then
 * see/edit/save/download it right here (collapsible), instead of dumping in chat. */
function PitchPanel({ step, listName, onAsk, agentBusy }: { step: Step; listName?: string; onAsk: (p: string) => void; agentBusy?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pitch, setPitch] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [requested, setRequested] = useState(false);

  // Fetch the pitch content the first time the panel is expanded.
  useEffect(() => {
    if (!open || !step.pitchId || pitch) return;
    setLoading(true);
    fetch(`/api/pitch/${step.pitchId}`).then((r) => r.json()).then((j) => { if (j?.success) setPitch((j.data?.pitch?.pitchContent as Record<string, unknown>) || {}); }).catch(() => {}).finally(() => setLoading(false));
  }, [open, step.pitchId, pitch]);
  // A new pitch was attached → drop the cache so the editor re-hydrates, and open.
  useEffect(() => { setPitch(null); if (step.pitchId && requested) { setRequested(false); setOpen(true); } }, [step.pitchId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Clear the generating state if the agent finished without attaching one.
  const wasBusy = useRef(false);
  useEffect(() => { const done = wasBusy.current && !agentBusy; wasBusy.current = !!agentBusy; if (done && requested && !step.pitchId) setRequested(false); }, [agentBusy, requested, step.pitchId]);

  const set = (k: string, v: unknown) => setPitch((p) => ({ ...(p || {}), [k]: v }));
  const str = (k: string) => (typeof pitch?.[k] === "string" ? (pitch[k] as string) : "");
  const bullets = Array.isArray(pitch?.solutionBullets) ? (pitch!.solutionBullets as string[]) : [];

  const save = async () => {
    if (!step.pitchId || !pitch) return;
    setSaving(true);
    const j = await fetch(`/api/pitch/${step.pitchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pitchContent: pitch }) }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    toast(j?.success ? { title: "Pitch saved", description: "Your edits to the attached pitch PDF are saved." } : { title: "Couldn't save the pitch", description: "Please try again in a moment." });
  };
  const download = async () => {
    if (!step.pitchId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/pitch/${step.pitchId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfOnly: true }) });
      if (res.ok) {
        const blob = await res.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${(step.title || "pitch").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ } finally { setDownloading(false); }
  };
  const generate = () => {
    setRequested(true);
    onAsk(`Create a branded pitch PDF for the "${listName || "lead"}" audience and ATTACH it to the "${step.title}" email step (stepId: ${step.id}) — call create_pitch (draw from my Brand Kit), then call build_sequence_step with stepId="${step.id}" and the new pitchId so the pitch lands on this step. Don't paste it in the chat.`);
  };

  // Not attached yet → CTA (or a generating state while the agent builds it).
  if (!step.pitchId) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <FileText className="h-4 w-4 shrink-0 text-brand-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold">Attach a pitch PDF</p>
            <p className="text-[11.5px] text-muted-foreground">A branded one-pager the agent writes from your Brand Kit — sent with this email.</p>
          </div>
          <button onClick={generate} disabled={requested} className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 disabled:opacity-60">
            {requested ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} {requested ? "Generating…" : "Generate pitch"}
          </button>
        </div>
      </div>
    );
  }

  // Attached → collapsible editor.
  return (
    <div className="mt-3 rounded-xl border border-border">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start">
        <FileText className="h-4 w-4 shrink-0 text-brand-500" />
        <b className="text-[12.5px]">Pitch PDF attached</b>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">— edit the attachment, save, or download</span>
        <ChevronDown className={cn("ms-auto h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border p-3.5">
          {loading || !pitch ? (
            <div className="grid place-items-center py-8"><FlowLoader size={22} withMark /></div>
          ) : (
            <div className="space-y-3">
              <PL label="PDF subject line"><input value={str("subject")} onChange={(e) => set("subject", e.target.value)} className={FLD} /></PL>
              <PL label="Headline"><input value={str("headline")} onChange={(e) => set("headline", e.target.value)} className={FLD} /></PL>
              <PL label="Opening hook"><textarea rows={2} value={str("personalizedHook")} onChange={(e) => set("personalizedHook", e.target.value)} className={cn(FLD, "resize-y")} /></PL>
              <PL label="What you'll do (one per line)"><textarea rows={4} value={bullets.join("\n")} onChange={(e) => set("solutionBullets", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} className={cn(FLD, "resize-y")} /></PL>
              <div className="grid gap-3 sm:grid-cols-2">
                <PL label="Call to action"><input value={str("ctaText")} onChange={(e) => set("ctaText", e.target.value)} className={FLD} /></PL>
                <PL label="Closing line"><input value={str("closingLine")} onChange={(e) => set("closingLine", e.target.value)} className={FLD} /></PL>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">{saving ? <FlowLoader size={13} tone="white" /> : <Check className="h-4 w-4" />} Save pitch</button>
                <button onClick={download} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><Download className="h-4 w-4" /> {downloading ? "Preparing…" : "Download PDF"}</button>
                <button onClick={generate} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><Sparkles className="h-3.5 w-3.5" /> Regenerate</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PL({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</label>{children}</div>;
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
