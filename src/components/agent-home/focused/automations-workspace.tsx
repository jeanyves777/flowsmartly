"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { Workflow, Sparkles, Mail, MessageSquare, Power, Send, Clock, Cake, Gift, PartyPopper, RotateCcw, AlertTriangle, ShoppingCart, MoonStar, CalendarHeart, RefreshCw, Zap, Pause, Play, ChevronRight, X, Pencil, Trash2, Users, Save, CheckCircle2, XCircle, MinusCircle, Globe, Plus } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Follow-ups — a deep new-design automations surface (the Outreach workspace
 * canvas): the automated follow-up sequences that run on their own. Full-width
 * master/detail — a sticky left card (KPIs + section nav + "New sequence" +
 * status filter) and a right pane that shows the sequences list OR a real
 * in-surface SEQUENCE BUILDER form that creates the automation directly
 * (POST /api/automations — trigger + channel + message + timing). Toggling
 * active/paused is a do-it-in-the-UI action (PATCH /api/automations/[id]
 * { enabled }), not a chat prompt.
 *
 * Click a row to open an in-surface DETAIL panel (GET /api/automations/[id])
 * with full config, delivery stats and the recent activity log; edit its
 * settings (name, subject, content, send time, days offset, timezone, audience
 * list) via PATCH, or delete it (two-step inline confirm) via DELETE. The agent
 * only helps when the user asks it via the composer. No legacy links.
 * [[surface-buttons-are-ui-actions]] [[full-width-left-menu-layout]]
 */

interface ContactListRef { id: string; name: string; totalCount: number; }
interface ContactListOption { id: string; name: string; totalCount: number; }
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

// Trigger types offered in the in-surface builder. HOLIDAY is intentionally
// excluded — the API requires a specific holidayId in the trigger (a holiday
// picker), so that richer flow stays with the agent; everything here creates a
// valid automation directly.
const BUILDER_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "WELCOME", label: "Welcome", hint: "New signups & subscribers" },
  { value: "BIRTHDAY", label: "Birthday", hint: "On a contact's birthday" },
  { value: "ANNIVERSARY", label: "Anniversary", hint: "On their anniversary date" },
  { value: "RE_ENGAGEMENT", label: "Re-engagement", hint: "Win back quiet contacts" },
  { value: "ABANDONED_CART", label: "Abandoned cart", hint: "Left items behind" },
  { value: "INACTIVITY", label: "Inactivity", hint: "No activity for a while" },
  { value: "CUSTOM", label: "Custom", hint: "A schedule you define" },
];

// Common timezones — a compact, sensible set for the editor select.
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Abidjan",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

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

type StatusFilter = "all" | "active" | "paused";

export function FocusedAutomations({ refreshKey, onAsk: _onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/automations").then((r) => r.json());
      if (j?.success && j.data) {
        if (Array.isArray(j.data.automations)) setAutomations(j.data.automations);
        if (j.data.stats) setStats(j.data.stats);
        setError("");
      } else {
        setError(j?.error?.message || "Could not load your follow-ups.");
      }
    } catch {
      setError("Could not load your follow-ups.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Toggle active/paused inline — optimistic, then reconcile from the server.
  const toggle = async (a: Automation) => {
    const next = !a.enabled;
    setBusyId(a.id);
    setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: next } : x)));
    setStats((s) => ({ ...s, active: Math.max(0, (s.active ?? 0) + (next ? 1 : -1)) }));
    try {
      const r = await fetch(`/api/automations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success === false) {
        // revert on failure
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

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your follow-ups…" /></div>;
  }

  const totalSent = stats.totalSent ?? automations.reduce((sum, a) => sum + (a.totalSent ?? 0), 0);
  const total = stats.total ?? automations.length;
  const active = stats.active ?? automations.filter((a) => a.enabled).length;
  const paused = Math.max(0, total - active);

  const visible = automations.filter((a) =>
    filter === "active" ? a.enabled : filter === "paused" ? !a.enabled : true
  );

  const nav: { id: StatusFilter; label: string; icon: ElementType; count: number }[] = [
    { id: "all", label: "All sequences", icon: Workflow, count: total },
    { id: "active", label: "Active", icon: Zap, count: active },
    { id: "paused", label: "Paused", icon: Pause, count: paused },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky card — new sequence + KPIs + section nav */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <button
            onClick={() => { setBuilding(true); setNotice(""); setOpenId(null); }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Plus className="h-4 w-4" /> New sequence
          </button>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><Workflow className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Follow-ups</span></div>
            <div className="space-y-1.5">
              <SummaryRow icon={Send} label="Messages sent" value={totalSent.toLocaleString()} />
            </div>
          </div>

          {/* section menu — status filter as a vertical nav */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {nav.map((n) => {
              const isActive = filter === n.id && !building;
              return (
                <button
                  key={n.id}
                  onClick={() => { setBuilding(false); setFilter(n.id); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", isActive ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{n.label}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", isActive ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n.count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT: builder OR the sequences list, full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {building ? (
            <SequenceBuilder
              onCancel={() => setBuilding(false)}
              onCreated={(msg) => { setBuilding(false); setNotice(msg); setLoading(true); load().finally(() => setLoading(false)); }}
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-bold">Follow-up sequences</h3>
                {automations.length > 0 && (
                  <button
                    onClick={() => { setBuilding(true); setNotice(""); }}
                    className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> New sequence
                  </button>
                )}
              </div>

              {notice && (
                <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">{notice}</p>
              )}
              {error && (
                <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>
              )}

              {automations.length ? (
                visible.length ? (
                  <div className="space-y-2">
                    {visible.map((a) => {
                      const m = typeMeta(a.type);
                      const isEmail = (a.campaignType || "EMAIL").toUpperCase() === "EMAIL";
                      const reach = a.contactList?.totalCount;
                      return (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", a.enabled ? "bg-brand-500/10 text-brand-500" : "bg-muted text-muted-foreground")}>
                            <m.icon className="h-[18px] w-[18px]" />
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenId(a.id)}
                            className="group min-w-0 flex-1 text-left"
                            aria-label={`Open ${a.name}`}
                          >
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-semibold group-hover:text-brand-500">{a.name}</p>
                              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", a.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{a.enabled ? "Active" : "Paused"}</span>
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">{isEmail ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}{m.label}</span>
                              <span>· {whenLabel(a.lastTriggered)}</span>
                              {typeof reach === "number" ? <span>· {reach.toLocaleString()} contacts</span> : a.contactList?.name ? <span>· {a.contactList.name}</span> : null}
                            </p>
                          </button>
                          <button
                            onClick={() => toggle(a)}
                            disabled={busyId === a.id}
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border px-2.5 py-1 text-[11.5px] font-semibold transition disabled:opacity-60",
                              a.enabled ? "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" : "border-brand-500/40 bg-brand-500/5 text-brand-500 hover:bg-brand-500/10"
                            )}
                          >
                            {busyId === a.id ? <FlowLoader size={13} /> : a.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {a.enabled ? "Pause" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenId(a.id)}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label="View details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-[13px] font-medium">No {filter} sequences</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">Switch the filter to see your other follow-ups.</p>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Power className="h-6 w-6" /></span>
                  <p className="mt-3 text-[13px] font-medium">No follow-ups yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">Automated sequences send the right message at the right moment — a welcome on signup, a birthday note, a nudge for an abandoned cart.</p>
                  <button
                    onClick={() => { setBuilding(true); setNotice(""); }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
                  >
                    <Sparkles className="h-4 w-4" /> Build a sequence
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

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

function SummaryRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sequence builder — a real in-surface form that creates an automation directly
// (POST /api/automations). Collects the trigger, channel, message and timing.
// No agent prompt. [[surface-buttons-are-ui-actions]]
// ---------------------------------------------------------------------------

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

interface BuilderState {
  name: string;
  type: string;
  campaignType: "EMAIL" | "SMS";
  subject: string;
  content: string;
  sendTime: string;
  daysOffset: string;
  timezone: string;
  contactListId: string;
  enabled: boolean;
}

function SequenceBuilder({ onCancel, onCreated }: { onCancel: () => void; onCreated: (msg: string) => void }) {
  const [form, setForm] = useState<BuilderState>({
    name: "",
    type: "WELCOME",
    campaignType: "EMAIL",
    subject: "",
    content: "",
    sendTime: "09:00",
    daysOffset: "0",
    timezone: "UTC",
    contactListId: "",
    enabled: true,
  });
  const [lists, setLists] = useState<ContactListOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEmail = form.campaignType === "EMAIL";

  // Pull contact lists once for the audience selector.
  useEffect(() => {
    let alive = true;
    fetch("/api/contact-lists")
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.success && Array.isArray(j.data?.lists)) {
          setLists(j.data.lists as ContactListOption[]);
        }
      })
      .catch(() => { /* selector still works with the default "all contacts" */ });
    return () => { alive = false; };
  }, []);

  const setField = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) { setError("Give the sequence a name."); return; }
    if (!form.content.trim()) { setError("The message content can't be empty."); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.sendTime)) { setError("Send time must be HH:mm (e.g. 09:00)."); return; }
    const offsetNum = Number.parseInt(form.daysOffset, 10);
    if (!Number.isFinite(offsetNum)) { setError("Days offset must be a number."); return; }

    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          campaignType: form.campaignType,
          subject: isEmail ? (form.subject.trim() || null) : undefined,
          content: form.content,
          sendTime: form.sendTime,
          daysOffset: Math.max(-30, Math.min(30, offsetNum)),
          timezone: form.timezone || "UTC",
          contactListId: form.contactListId || null,
          enabled: form.enabled,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success === false) {
        setError(j?.error?.message || "Could not create the sequence.");
      } else {
        const label = typeMeta(form.type).label;
        onCreated(`“${form.name.trim()}” created — your ${label.toLowerCase()} ${isEmail ? "email" : "SMS"} follow-up is ${form.enabled ? "live" : "saved as paused"}.`);
      }
    } catch {
      setError("Could not create the sequence.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Workflow className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold">New follow-up sequence</h3>
          <p className="text-[11.5px] text-muted-foreground">It runs on its own — pick the trigger, channel and message.</p>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>
      )}

      <div className="space-y-3.5">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className={FIELD}
            placeholder="Welcome series"
          />
        </Field>

        {/* Trigger picker */}
        <div>
          <span className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">Trigger</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {BUILDER_TYPES.map((t) => {
              const Icon = typeMeta(t.value).icon;
              const selected = form.type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setField("type", t.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition",
                    selected ? "border-brand-500/60 bg-brand-500/5 text-brand-500" : "border-border bg-muted/30 hover:border-brand-500/40 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-[12px] font-semibold leading-tight">{t.label}</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">{t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel */}
        <div>
          <span className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">Channel</span>
          <div className="grid grid-cols-2 gap-2">
            {(["EMAIL", "SMS"] as const).map((ch) => {
              const selected = form.campaignType === ch;
              const Icon = ch === "EMAIL" ? Mail : MessageSquare;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setField("campaignType", ch)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition",
                    selected ? "border-brand-500/60 bg-brand-500/5 text-brand-500" : "border-border bg-muted/30 hover:border-brand-500/40 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" /> {ch === "EMAIL" ? "Email" : "SMS"}
                </button>
              );
            })}
          </div>
        </div>

        {isEmail && (
          <Field label="Subject">
            <input
              value={form.subject}
              onChange={(e) => setField("subject", e.target.value)}
              className={FIELD}
              placeholder="Welcome to the family 👋"
            />
          </Field>
        )}

        <Field label={isEmail ? "Message body" : "Message"}>
          <textarea
            value={form.content}
            onChange={(e) => setField("content", e.target.value)}
            rows={5}
            className={cn(FIELD, "resize-y leading-relaxed")}
            placeholder="Write the message that goes out…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Send time">
            <input
              type="time"
              value={form.sendTime}
              onChange={(e) => setField("sendTime", e.target.value)}
              className={FIELD}
            />
          </Field>
          <Field label="Days offset" hint="− before, + after">
            <input
              type="number"
              min={-30}
              max={30}
              value={form.daysOffset}
              onChange={(e) => setField("daysOffset", e.target.value)}
              className={FIELD}
            />
          </Field>
        </div>

        <Field label="Timezone">
          <select
            value={form.timezone}
            onChange={(e) => setField("timezone", e.target.value)}
            className={FIELD}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>

        <Field label="Audience list">
          <select
            value={form.contactListId}
            onChange={(e) => setField("contactListId", e.target.value)}
            className={FIELD}
          >
            <option value="">All eligible contacts</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}{l.totalCount ? ` (${l.totalCount.toLocaleString()})` : ""}</option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setField("enabled", e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold">Activate immediately</span>
            <span className="block text-[11px] text-muted-foreground">Leave off to create it paused and turn it on later.</span>
          </span>
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {submitting ? <FlowLoader size={15} tone="white" /> : <Sparkles className="h-4 w-4" />}
            Create sequence
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-[10px] border border-border px-3 py-2 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer — full config, stats, recent activity log, plus inline edit
// (PATCH) and a two-step delete (DELETE). Opened from a row click.
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
// The detail route hard-caps `logLimit` at 200 — never ask for more than it
// will return, or "Load more" becomes a dead button that never grows the list.
const LOG_LIMIT_MAX = 200;

function AutomationDetailDrawer({
  summary,
  onClose,
  onChanged,
  onDeleted,
}: {
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
      if (j?.success && j.data?.automation) {
        setDetail(j.data.automation as AutomationDetail);
        setError("");
      } else {
        setError(j?.error?.message || "Could not load this follow-up.");
      }
    } catch {
      setError("Could not load this follow-up.");
    }
  }, [summary.id, logLimit]);

  useEffect(() => {
    let alive = true;
    // Only show the full-body loader on the very first fetch — paginating the
    // activity log (logLimit bump) should refresh in place, not flash a spinner
    // and collapse the panel the user is reading.
    setDetail((d) => { if (!d) setLoading(true); return d; });
    loadDetail().finally(() => { if (alive) { setLoading(false); setLoadingMore(false); } });
    return () => { alive = false; };
  }, [loadDetail]);

  // Pull contact lists once for the audience selector (only when editing opens).
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    fetch("/api/contact-lists")
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.success && Array.isArray(j.data?.lists)) {
          setLists(j.data.lists as ContactListOption[]);
        }
      })
      .catch(() => { /* selector still works with the current value */ });
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

  const setField = <K extends keyof EditState>(key: K, value: EditState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { setSaveError("Give the sequence a name."); return; }
    if (!form.content.trim()) { setSaveError("The message content can't be empty."); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.sendTime)) { setSaveError("Send time must be HH:mm (e.g. 09:00)."); return; }
    const offsetNum = Number.parseInt(form.daysOffset, 10);
    if (!Number.isFinite(offsetNum)) { setSaveError("Days offset must be a number."); return; }

    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch(`/api/automations/${summary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
        setSaveError(j?.error?.message || "Could not delete this follow-up.");
        setConfirmDelete(false);
        setDeleting(false);
        return;
      }
      onDeleted();
    } catch {
      setSaveError("Could not delete this follow-up.");
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  const audienceLabel = detail?.contactList?.name ?? summary.contactList?.name ?? "All eligible contacts";
  const audienceReach = detail?.contactList?.totalCount ?? summary.contactList?.totalCount;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", summary.enabled ? "bg-brand-500/10 text-brand-500" : "bg-muted text-muted-foreground")}>
            <m.icon className="h-[18px] w-[18px]" />
          </span>
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
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="grid place-items-center py-16"><FlowLoader size={30} withMark label="Loading details…" /></div>
          ) : error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>
          ) : editing && form ? (
            <EditForm
              form={form}
              isEmail={isEmail}
              lists={lists}
              currentListName={audienceLabel}
              currentListId={(detail?.contactListId ?? summary.contactListId) || ""}
              saving={saving}
              saveError={saveError}
              onField={setField}
              onCancel={() => { setEditing(false); setSaveError(""); }}
              onSave={save}
            />
          ) : detail ? (
            <div className="space-y-4">
              {saveError && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{saveError}</p>
              )}

              {/* Delivery stats */}
              <div>
                <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Delivery</h4>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile icon={CheckCircle2} tone="emerald" label="Sent" value={detail.stats.sent} rate={detail.stats.successRate} />
                  <StatTile icon={XCircle} tone="rose" label="Failed" value={detail.stats.failed} rate={detail.stats.failureRate} />
                  <StatTile icon={MinusCircle} tone="amber" label="Skipped" value={detail.stats.skipped} rate={detail.stats.skipRate} />
                </div>
              </div>

              {/* Config */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Settings</h4>
                <dl className="space-y-1.5 text-[12px]">
                  {isEmail && (
                    <Row label="Subject"><span className="text-foreground">{detail.subject || <span className="text-muted-foreground">—</span>}</span></Row>
                  )}
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

              {/* Recent activity */}
              <div>
                <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Recent activity</h4>
                {detail.logs.length ? (
                  <div className="space-y-1.5">
                    {detail.logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 rounded-[10px] border border-border bg-muted/20 px-2.5 py-2">
                        <LogBadge status={log.status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">{log.contactName || log.contactEmail || log.contactPhone || "Contact"}</p>
                          {log.error ? (
                            <p className="truncate text-[11px] text-rose-500">{log.error}</p>
                          ) : log.contactEmail || log.contactPhone ? (
                            <p className="truncate text-[11px] text-muted-foreground">{log.contactEmail || log.contactPhone}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">{logWhen(log.sentAt)}</span>
                      </div>
                    ))}
                    {detail.totalLogs > detail.logs.length && logLimit < LOG_LIMIT_MAX && (
                      <button
                        type="button"
                        onClick={() => { setLoadingMore(true); setLogLimit((n) => Math.min(LOG_LIMIT_MAX, n + LOG_PAGE)); }}
                        disabled={loadingMore}
                        className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-muted/30 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                      >
                        {loadingMore && <FlowLoader size={13} />}
                        Load more ({(detail.totalLogs - detail.logs.length).toLocaleString()} left)
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

        {/* Footer actions */}
        {!loading && !error && !editing && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60"
                >
                  {deleting ? <FlowLoader size={14} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={beginEdit}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit settings
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 px-3 py-2 text-[12px] font-semibold text-rose-500 transition hover:bg-rose-500/5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
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

function EditForm({
  form,
  isEmail,
  lists,
  currentListName,
  currentListId,
  saving,
  saveError,
  onField,
  onCancel,
  onSave,
}: {
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
  // If the automation's current list isn't in the fetched options yet (still
  // loading, or scoped differently), keep it selectable so we don't lose it.
  const listOptions = useMemo(() => {
    const opts = [...lists];
    if (currentListId && !opts.some((l) => l.id === currentListId)) {
      opts.unshift({ id: currentListId, name: currentListName, totalCount: 0 });
    }
    return opts;
  }, [lists, currentListId, currentListName]);

  return (
    <div className="space-y-3.5">
      {saveError && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{saveError}</p>
      )}

      <Field label="Name">
        <input
          value={form.name}
          onChange={(e) => onField("name", e.target.value)}
          className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
          placeholder="Welcome series"
        />
      </Field>

      {isEmail && (
        <Field label="Subject">
          <input
            value={form.subject}
            onChange={(e) => onField("subject", e.target.value)}
            className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
            placeholder="Welcome to the family 👋"
          />
        </Field>
      )}

      <Field label={isEmail ? "Message body" : "Message"}>
        <textarea
          value={form.content}
          onChange={(e) => onField("content", e.target.value)}
          rows={5}
          className="w-full resize-y rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-brand-500/60"
          placeholder="Write the message that goes out…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Send time">
          <input
            type="time"
            value={form.sendTime}
            onChange={(e) => onField("sendTime", e.target.value)}
            className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
          />
        </Field>
        <Field label="Days offset" hint="− before, + after">
          <input
            type="number"
            min={-30}
            max={30}
            value={form.daysOffset}
            onChange={(e) => onField("daysOffset", e.target.value)}
            className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
          />
        </Field>
      </div>

      <Field label="Timezone">
        <select
          value={TIMEZONES.includes(form.timezone) ? form.timezone : "__current"}
          onChange={(e) => onField("timezone", e.target.value === "__current" ? form.timezone : e.target.value)}
          className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
        >
          {!TIMEZONES.includes(form.timezone) && form.timezone && (
            <option value="__current">{form.timezone}</option>
          )}
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Field>

      <Field label="Audience list">
        <select
          value={form.contactListId}
          onChange={(e) => onField("contactListId", e.target.value)}
          className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60"
        >
          <option value="">All eligible contacts</option>
          {listOptions.map((l) => (
            <option key={l.id} value={l.id}>{l.name}{l.totalCount ? ` (${l.totalCount.toLocaleString()})` : ""}</option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {saving ? <FlowLoader size={15} tone="white" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-[10px] border border-border px-3 py-2 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
