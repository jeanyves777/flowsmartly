"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { MessageCircle, Plus, RefreshCw, Sparkles, Zap, MessagesSquare, FileText, CheckCircle2, Power, Clock, ArrowRight } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * WhatsApp — a deep new-design surface (the WhatsApp workspace canvas): connection
 * status of the WhatsApp Business number(s) + the automations/auto-replies the user
 * has, with live on/off toggles (PATCH /api/whatsapp/automations), plus conversation
 * and template counts. Real data — GET /api/social-accounts?platform=whatsapp,
 * /api/whatsapp/automations, /conversations, /templates. Connecting a number uses
 * WhatsApp's official login (/api/social/whatsapp/connect) and returns here; building
 * a brand-new automation is a generative task, so it drives the agent. No legacy
 * links. [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

interface WaAccount {
  id: string;
  platformUsername?: string | null;
  platformDisplayName?: string | null;
  platformAvatarUrl?: string | null;
  connectedAt?: string | null;
  needsReconnect?: boolean;
}
interface Automation {
  id: string;
  name: string;
  description?: string | null;
  triggerType: string;
  actionType: string;
  actionValue?: string | null;
  isActive: boolean;
  usageCount?: number;
  createdAt?: string;
  socialAccount?: { platformUsername?: string | null; platformDisplayName?: string | null } | null;
}

const TRIGGER_LABEL: Record<string, string> = {
  keyword: "Keyword match",
  new_conversation: "New conversation",
  inbound_message: "Any inbound message",
  missed_chat: "Missed chat",
  schedule: "Scheduled",
};
const ACTION_LABEL: Record<string, string> = {
  send_message: "Auto-reply",
  send_template: "Send template",
  assign_to: "Assign chat",
  add_tag: "Add tag",
  webhook: "Webhook",
  ai_agent_reply: "AI agent reply",
};
const triggerLabel = (t: string) => TRIGGER_LABEL[t] ?? t.replace(/_/g, " ");
const actionLabel = (a: string) => ACTION_LABEL[a] ?? a.replace(/_/g, " ");

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedWhatsApp({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [acc, autos, convs, tmpls] = await Promise.all([
      fetch("/api/social-accounts?platform=whatsapp").then((r) => r.json()).catch(() => null),
      fetch("/api/whatsapp/automations").then((r) => r.json()).catch(() => null),
      fetch("/api/whatsapp/conversations?limit=1").then((r) => r.json()).catch(() => null),
      fetch("/api/whatsapp/templates").then((r) => r.json()).catch(() => null),
    ]);
    if (acc?.success && Array.isArray(acc.accounts)) setAccounts(acc.accounts as WaAccount[]);
    if (autos?.success && Array.isArray(autos.automations)) setAutomations(autos.automations as Automation[]);
    if (convs?.success) setConversationCount(Number(convs?.pagination?.total ?? (Array.isArray(convs.conversations) ? convs.conversations.length : 0)) || 0);
    if (tmpls?.success && Array.isArray(tmpls.templates)) setTemplateCount(tmpls.templates.length);
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const connect = () => { window.location.href = "/api/social/whatsapp/connect"; };

  const toggleAutomation = async (a: Automation) => {
    setBusyToggle(a.id);
    // optimistic flip
    setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: !x.isActive } : x)));
    try {
      const r = await fetch("/api/whatsapp/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId: a.id, isActive: !a.isActive }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) {
        // revert on failure
        setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: a.isActive } : x)));
      }
    } catch {
      setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: a.isActive } : x)));
    } finally {
      setBusyToggle(null);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading WhatsApp…" /></div>;
  }

  const connected = accounts.length > 0;
  const activeCount = automations.filter((a) => a.isActive).length;

  // Not connected yet → connect the WhatsApp Business number first.
  if (!connected) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 text-emerald-500"><MessageCircle className="h-8 w-8" /></span>
          <h2 className="mt-4 text-[20px] font-extrabold">Connect WhatsApp Business</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Link your WhatsApp Business number to send broadcasts, set up auto-replies, and let the agent answer chats for you. We use WhatsApp&apos;s official login — you&apos;ll come right back here.</p>
          <button onClick={connect} className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-emerald-500/30">
            <MessageCircle className="h-4 w-4" /> Connect WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* connection header */}
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-green-600/5 to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/25 to-green-600/20 text-emerald-500"><MessageCircle className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[16px] font-bold">WhatsApp Business</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Connected</span>
              </div>
              <p className="truncate text-[12px] text-muted-foreground">{accounts.length === 1 ? "1 number linked" : `${accounts.length} numbers linked`}</p>
            </div>
            <button onClick={connect} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background/60 px-3 py-1.5 text-[12.5px] font-semibold hover:border-emerald-500/60 hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> Add number
            </button>
          </div>

          {/* connected numbers */}
          <div className="mt-3 space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-2">
                {a.platformAvatarUrl ? (
                  <Image src={a.platformAvatarUrl} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" unoptimized />
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-[11px] font-bold text-white">{(a.platformDisplayName || a.platformUsername || "?").slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{a.platformDisplayName || a.platformUsername || "WhatsApp number"}</p>
                  {a.connectedAt && <p className="truncate text-[11px] text-muted-foreground">Connected {whenLabel(a.connectedAt)}</p>}
                </div>
                {a.needsReconnect && (
                  <button onClick={connect} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-500 hover:text-amber-400"><RefreshCw className="h-3 w-3" /> Reconnect</button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Zap} label="Automations" value={String(automations.length)} />
          <Kpi icon={Power} label="Active" value={String(activeCount)} />
          <Kpi icon={MessagesSquare} label="Conversations" value={conversationCount.toLocaleString()} />
          <Kpi icon={FileText} label="Templates" value={String(templateCount)} />
        </div>

        {/* automations */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Automations & auto-replies</h3>
            {onAsk && (
              <button onClick={() => onAsk("Set up a WhatsApp automation — ask me the trigger (keyword, new conversation, or missed chat) and what reply or action it should take, then create it.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> New automation
              </button>
            )}
          </div>

          {automations.length ? (
            <div className="space-y-2">
              {automations.map((a) => {
                const subtitle = [triggerLabel(a.triggerType), actionLabel(a.actionType)].filter(Boolean).join(" → ");
                return (
                  <div key={a.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2.5", a.isActive ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/30")}>
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", a.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
                      <Zap className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{a.name}</p>
                      <p className="flex items-center gap-1 truncate text-[11.5px] text-muted-foreground">
                        {triggerLabel(a.triggerType)} <ArrowRight className="h-3 w-3 shrink-0 opacity-60" /> {actionLabel(a.actionType)}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", a.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{a.isActive ? "On" : "Off"}</span>
                    <button
                      onClick={() => toggleAutomation(a)}
                      disabled={busyToggle === a.id}
                      role="switch"
                      aria-checked={a.isActive}
                      aria-label={a.isActive ? `Turn off ${a.name}` : `Turn on ${a.name}`}
                      title={subtitle}
                      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-60", a.isActive ? "bg-emerald-500" : "bg-muted-foreground/30")}
                    >
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition", a.isActive ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><Zap className="h-5 w-5" /></span>
              <p className="text-[13px] font-medium">No automations yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Set up an auto-reply or let the agent answer inbound chats automatically.</p>
              {onAsk && (
                <button onClick={() => onAsk("Set up a WhatsApp automation — ask me the trigger (keyword, new conversation, or missed chat) and what reply or action it should take, then create it.")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Create an automation
                </button>
              )}
            </div>
          )}
        </section>

        {/* broadcasts / templates */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Broadcasts & templates</h3>
            {onAsk && (
              <button onClick={() => onAsk("Help me send a WhatsApp broadcast — ask me the audience, the message, and any media, then draft an approved message template and schedule it.")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Draft a broadcast
              </button>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Stat icon={FileText} label="Message templates" value={String(templateCount)} hint={templateCount ? "Approved templates ready to send" : "No templates yet — drafting one starts the agent"} />
            <Stat icon={Clock} label="Open conversations" value={conversationCount.toLocaleString()} hint={conversationCount ? "Inbound chats handled here" : "Replies will appear here once chats come in"} />
          </div>
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

function Stat({ icon: Icon, label, value, hint }: { icon: ElementType; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500"><Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{value} <span className="font-medium text-muted-foreground">{label}</span></p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
