"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import { Workflow, Sparkles, Mail, MessageSquare, Power, Send, Clock, Cake, Gift, PartyPopper, RotateCcw, AlertTriangle, ShoppingCart, MoonStar, CalendarHeart, RefreshCw, Zap, Pause, Play } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Follow-ups — a deep new-design automations surface (the Outreach workspace
 * canvas): the automated follow-up sequences that run on their own. Real data
 * (GET /api/automations) with KPIs, then each automation listed with its type +
 * channel and a real active/pause toggle (PATCH /api/automations/[id]
 * { enabled }). Toggling is do-it-in-the-UI, not a chat prompt. Building a new
 * sequence is generative, so that drives the agent. No legacy links.
 * [[surface-buttons-are-ui-actions]]
 */

interface ContactListRef { id: string; name: string; totalCount: number; }
interface Automation {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  campaignType: string;
  subject?: string | null;
  sendTime?: string;
  daysOffset?: number;
  contactList?: ContactListRef | null;
  totalSent?: number;
  lastTriggered?: string | null;
}
interface Stats { total?: number; active?: number; totalSent?: number; }

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

function whenLabel(iso?: string | null): string {
  if (!iso) return "Not run yet";
  try { return `Last run ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`; } catch { return ""; }
}

const CREATE_PROMPT = "Set up a new automated follow-up sequence for me — ask me what the trigger should be (welcome, birthday, abandoned cart, re-engagement…), what channel (email or SMS), and draft the message.";

export function FocusedAutomations({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your follow-ups…" /></div>;
  }

  const totalSent = stats.totalSent ?? automations.reduce((sum, a) => sum + (a.totalSent ?? 0), 0);
  const total = stats.total ?? automations.length;
  const active = stats.active ?? automations.filter((a) => a.enabled).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Workflow} label="Sequences" value={total.toLocaleString()} />
          <Kpi icon={Zap} label="Active" value={active.toLocaleString()} />
          <Kpi icon={Pause} label="Paused" value={Math.max(0, total - active).toLocaleString()} />
          <Kpi icon={Send} label="Messages sent" value={totalSent.toLocaleString()} />
        </div>

        {/* Follow-ups list */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Follow-up sequences</h3>
            {onAsk && (
              <button
                onClick={() => onAsk(CREATE_PROMPT)}
                className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> New sequence
              </button>
            )}
          </div>

          {error && (
            <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>
          )}

          {automations.length ? (
            <div className="space-y-2">
              {automations.map((a) => {
                const m = typeMeta(a.type);
                const isEmail = (a.campaignType || "EMAIL").toUpperCase() === "EMAIL";
                const reach = a.contactList?.totalCount;
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", a.enabled ? "bg-brand-500/10 text-brand-500" : "bg-muted text-muted-foreground")}>
                      <m.icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold">{a.name}</p>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", a.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{a.enabled ? "Active" : "Paused"}</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">{isEmail ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}{m.label}</span>
                        <span>· {whenLabel(a.lastTriggered)}</span>
                        {typeof reach === "number" ? <span>· {reach.toLocaleString()} contacts</span> : a.contactList?.name ? <span>· {a.contactList.name}</span> : null}
                      </p>
                    </div>
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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Power className="h-6 w-6" /></span>
              <p className="mt-3 text-[13px] font-medium">No follow-ups yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">Automated sequences send the right message at the right moment — a welcome on signup, a birthday note, a nudge for an abandoned cart.</p>
              {onAsk && (
                <button
                  onClick={() => onAsk(CREATE_PROMPT)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
                >
                  <Sparkles className="h-4 w-4" /> Build a sequence
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
