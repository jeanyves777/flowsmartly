"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import Image from "next/image";
import { MessageCircle, Plus, RefreshCw, Sparkles, Zap, MessagesSquare, FileText, CheckCircle2, Power, ArrowRight, ChevronRight, Pencil, Trash2, Check, AlertTriangle, X, Send, Inbox } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * WhatsApp — a deep new-design surface (the WhatsApp workspace canvas): connection
 * status of the WhatsApp Business number(s) + the automations/auto-replies the user
 * has (live on/off toggles, in-surface edit + delete via PATCH/DELETE
 * /api/whatsapp/automations), the message templates (list + filter by category/status,
 * create & submit for approval, delete — /api/whatsapp/templates), and a live inbox
 * (read conversations + reply — /api/whatsapp/conversations, /messages/[id], /send).
 * Real data — GET /api/social-accounts?platform=whatsapp. Connecting a number uses
 * WhatsApp's official login (/api/social/whatsapp/connect) and returns here; drafting a
 * brand-new automation/broadcast is a generative task, so it drives the agent. No legacy
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
  triggerConfig?: string | null;
  actionType: string;
  actionValue?: string | null;
  isActive: boolean;
  usageCount?: number;
  createdAt?: string;
  socialAccount?: { platformUsername?: string | null; platformDisplayName?: string | null } | null;
}
interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  headerText?: string | null;
  bodyText: string;
  footerText?: string | null;
  usageCount?: number;
  createdAt?: string;
}
interface ConversationRow {
  id: string;
  customerPhone: string;
  customerName?: string | null;
  customerAvatarUrl?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  status?: string;
  lastMessage?: { content?: string | null; messageType?: string | null; direction?: string | null; timestamp?: string | null } | null;
}
interface ConversationMessage {
  id: string;
  direction: string;
  messageType: string;
  content: string;
  mediaUrl?: string | null;
  status?: string;
  timestamp?: string | null;
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

// Triggers/actions offered in the edit form — kept to the set the surface understands.
const TRIGGER_OPTIONS = ["keyword", "new_conversation", "inbound_message", "missed_chat"] as const;
const ACTION_OPTIONS = ["send_message", "send_template", "assign_to", "add_tag", "ai_agent_reply"] as const;

const TEMPLATE_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
const TEMPLATE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const TEMPLATE_LANGUAGES = [
  { code: "en", label: "English (en)" },
  { code: "en_US", label: "English US (en_US)" },
  { code: "es", label: "Spanish (es)" },
  { code: "fr", label: "French (fr)" },
  { code: "pt_BR", label: "Portuguese BR (pt_BR)" },
  { code: "de", label: "German (de)" },
  { code: "ar", label: "Arabic (ar)" },
];

const TEMPLATE_STATUS_TONE: Record<string, string> = {
  APPROVED: "bg-emerald-500/10 text-emerald-500",
  PENDING: "bg-amber-500/10 text-amber-500",
  REJECTED: "bg-rose-500/10 text-rose-500",
};
const templateStatusTone = (s: string) => TEMPLATE_STATUS_TONE[s?.toUpperCase()] ?? "bg-muted text-muted-foreground";

// Parse a stored automation triggerConfig (JSON) and surface its keyword list as a string.
function keywordsFromConfig(raw?: string | null): string {
  if (!raw) return "";
  try {
    const cfg = JSON.parse(raw);
    const kw = cfg?.keywords ?? cfg?.keyword;
    if (Array.isArray(kw)) return kw.join(", ");
    if (typeof kw === "string") return kw;
  } catch { /* ignore */ }
  return "";
}

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}
function timeLabel(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ""; }
}

export function FocusedWhatsApp({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);

  // ── automation in-surface management ──────────────────────────────────────────
  const [openAutoId, setOpenAutoId] = useState<string | null>(null);
  type AutoMode = null | "edit" | "delete";
  const [autoMode, setAutoMode] = useState<AutoMode>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoForm, setAutoForm] = useState({ name: "", triggerType: "keyword", keywords: "", actionType: "send_message", actionValue: "" });

  // ── templates ─────────────────────────────────────────────────────────────────
  const [tmplCategory, setTmplCategory] = useState<string>("");
  const [tmplStatus, setTmplStatus] = useState<string>("");
  const [tmplLoading, setTmplLoading] = useState(false);
  const [tmplCreating, setTmplCreating] = useState(false);
  const [tmplBusy, setTmplBusy] = useState(false);
  const [tmplError, setTmplError] = useState<string | null>(null);
  const [tmplNotice, setTmplNotice] = useState<string | null>(null);
  const [tmplDeleteId, setTmplDeleteId] = useState<string | null>(null);
  const [tmplForm, setTmplForm] = useState({ name: "", category: "MARKETING", language: "en", headerText: "", bodyText: "", footerText: "" });

  // ── inbox ─────────────────────────────────────────────────────────────────────
  const [inboxOpen, setInboxOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [activeConv, setActiveConv] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

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
    if (tmpls?.success && Array.isArray(tmpls.templates)) setTemplates(tmpls.templates as Template[]);
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const connect = () => { window.location.href = "/api/social/whatsapp/connect"; };

  const primaryAccountId = accounts[0]?.id ?? null;

  // ── automation toggle (existing) ──────────────────────────────────────────────
  const toggleAutomation = async (a: Automation) => {
    setBusyToggle(a.id);
    setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: !x.isActive } : x)));
    try {
      const r = await fetch("/api/whatsapp/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId: a.id, isActive: !a.isActive }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) {
        setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: a.isActive } : x)));
      }
    } catch {
      setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: a.isActive } : x)));
    } finally {
      setBusyToggle(null);
    }
  };

  // Refresh just the automations list after a mutation.
  const reloadAutomations = useCallback(async () => {
    try {
      const j = await fetch("/api/whatsapp/automations").then((r) => r.json());
      if (j?.success && Array.isArray(j.automations)) setAutomations(j.automations as Automation[]);
    } catch { /* ignore */ }
  }, []);

  const toggleAutoRow = (a: Automation) => {
    if (openAutoId === a.id) { setOpenAutoId(null); setAutoMode(null); setAutoError(null); return; }
    setOpenAutoId(a.id); setAutoMode(null); setAutoError(null);
  };

  const startEditAuto = (a: Automation) => {
    setAutoError(null);
    setAutoForm({
      name: a.name ?? "",
      triggerType: a.triggerType ?? "keyword",
      keywords: keywordsFromConfig(a.triggerConfig),
      actionType: a.actionType ?? "send_message",
      actionValue: a.actionValue ?? "",
    });
    setAutoMode("edit");
  };

  // PATCH /api/whatsapp/automations — save name / trigger / keywords / action.
  const saveAuto = async (a: Automation) => {
    if (!autoForm.name.trim()) { setAutoError("Name is required."); return; }
    setAutoBusy(true); setAutoError(null);
    const body: Record<string, unknown> = {
      automationId: a.id,
      name: autoForm.name.trim(),
      triggerType: autoForm.triggerType,
      actionType: autoForm.actionType,
      actionValue: autoForm.actionValue || null,
    };
    if (autoForm.triggerType === "keyword") {
      const keywords = autoForm.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      body.triggerConfig = { keywords };
    }
    try {
      const r = await fetch("/api/whatsapp/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) { setAutoError(j?.error || "Could not save changes."); setAutoBusy(false); return; }
      await reloadAutomations();
      setAutoMode(null); setAutoBusy(false);
    } catch { setAutoError("Could not save changes."); setAutoBusy(false); }
  };

  // DELETE /api/whatsapp/automations?automationId= — remove the automation.
  const confirmDeleteAuto = async (a: Automation) => {
    setAutoBusy(true); setAutoError(null);
    try {
      const r = await fetch(`/api/whatsapp/automations?automationId=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) { setAutoError(j?.error || "Could not delete this automation."); setAutoBusy(false); return; }
      setAutomations((list) => list.filter((x) => x.id !== a.id));
      setOpenAutoId(null); setAutoMode(null); setAutoBusy(false);
    } catch { setAutoError("Could not delete this automation."); setAutoBusy(false); }
  };

  // ── templates ─────────────────────────────────────────────────────────────────
  // GET /api/whatsapp/templates?category=&status= — re-fetch with the active filters.
  const reloadTemplates = useCallback(async (category: string, status: string) => {
    setTmplLoading(true);
    try {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (status) qs.set("status", status);
      const url = `/api/whatsapp/templates${qs.toString() ? `?${qs.toString()}` : ""}`;
      const j = await fetch(url).then((r) => r.json());
      if (j?.success && Array.isArray(j.templates)) setTemplates(j.templates as Template[]);
    } catch { /* ignore */ } finally { setTmplLoading(false); }
  }, []);

  const applyTmplFilter = (category: string, status: string) => {
    setTmplCategory(category); setTmplStatus(status);
    void reloadTemplates(category, status);
  };

  // POST /api/whatsapp/templates — create + submit for approval.
  const submitTemplate = async () => {
    if (!primaryAccountId) { setTmplError("No connected WhatsApp number."); return; }
    const name = tmplForm.name.trim();
    if (!name) { setTmplError("Template name is required."); return; }
    if (!/^[a-z0-9_]+$/.test(name)) { setTmplError("Name must be lowercase letters, numbers, and underscores only."); return; }
    if (!tmplForm.bodyText.trim()) { setTmplError("Body text is required."); return; }
    setTmplBusy(true); setTmplError(null); setTmplNotice(null);
    try {
      const r = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: tmplForm.category,
          language: tmplForm.language,
          bodyText: tmplForm.bodyText.trim(),
          headerText: tmplForm.headerText.trim() || undefined,
          footerText: tmplForm.footerText.trim() || undefined,
          socialAccountId: primaryAccountId,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) { setTmplError(j?.error || "Could not submit this template."); setTmplBusy(false); return; }
      setTmplForm({ name: "", category: "MARKETING", language: "en", headerText: "", bodyText: "", footerText: "" });
      setTmplCreating(false); setTmplBusy(false);
      setTmplNotice("Template submitted for approval.");
      await reloadTemplates(tmplCategory, tmplStatus);
    } catch { setTmplError("Could not submit this template."); setTmplBusy(false); }
  };

  // DELETE /api/whatsapp/templates?templateId= — remove the template.
  const confirmDeleteTemplate = async (t: Template) => {
    setTmplBusy(true); setTmplError(null);
    try {
      const r = await fetch(`/api/whatsapp/templates?templateId=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) { setTmplError(j?.error || "Could not delete this template."); setTmplBusy(false); return; }
      setTemplates((list) => list.filter((x) => x.id !== t.id));
      setTmplDeleteId(null); setTmplBusy(false);
      setTmplNotice("Template deleted.");
    } catch { setTmplError("Could not delete this template."); setTmplBusy(false); }
  };

  // ── inbox ─────────────────────────────────────────────────────────────────────
  // GET /api/whatsapp/conversations — load the inbox list.
  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const j = await fetch("/api/whatsapp/conversations?limit=50").then((r) => r.json());
      if (j?.success && Array.isArray(j.conversations)) {
        setConversations(j.conversations as ConversationRow[]);
        if (j?.pagination?.total != null) setConversationCount(Number(j.pagination.total) || 0);
      }
    } catch { /* ignore */ } finally { setConvLoading(false); }
  }, []);

  const openInbox = () => {
    setInboxOpen(true);
    setActiveConv(null); setMessages([]); setSendError(null);
    void loadConversations();
  };

  // GET /api/whatsapp/messages/[id] — load a thread (also marks it read server-side).
  const openConversation = useCallback(async (c: ConversationRow) => {
    setActiveConv(c); setMessages([]); setMsgLoading(true); setSendError(null); setReply("");
    try {
      const j = await fetch(`/api/whatsapp/messages/${encodeURIComponent(c.id)}?limit=100`).then((r) => r.json());
      if (j?.success && Array.isArray(j.messages)) setMessages(j.messages as ConversationMessage[]);
      // Optimistically clear the unread badge (the GET marks it read).
      setConversations((list) => list.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
    } catch { /* ignore */ } finally { setMsgLoading(false); }
  }, []);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  // POST /api/whatsapp/send — send a text reply on the active conversation.
  const sendReply = async () => {
    if (!activeConv || !primaryAccountId) return;
    const text = reply.trim();
    if (!text) return;
    setSending(true); setSendError(null);
    try {
      const r = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConv.id, socialAccountId: primaryAccountId, message: text, messageType: "text" }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success !== true) { setSendError(j?.error || "Could not send your reply."); setSending(false); return; }
      // Append the saved outbound message returned by the route.
      const saved = j.message as ConversationMessage | undefined;
      if (saved) setMessages((m) => [...m, saved]);
      else setMessages((m) => [...m, { id: `tmp-${Date.now()}`, direction: "outbound", messageType: "text", content: text, status: "sent", timestamp: new Date().toISOString() }]);
      setReply(""); setSending(false);
      setConversations((list) => list.map((x) => (x.id === activeConv.id ? { ...x, lastMessage: { content: text, direction: "outbound", timestamp: new Date().toISOString() }, lastMessageAt: new Date().toISOString() } : x)));
    } catch { setSendError("Could not send your reply."); setSending(false); }
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
          <Kpi icon={FileText} label="Templates" value={String(templates.length)} />
        </div>

        {/* inbox */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Inbox</h3>
            <span className="text-[11.5px] text-muted-foreground">{conversationCount.toLocaleString()} {conversationCount === 1 ? "conversation" : "conversations"}</span>
            <button onClick={inboxOpen ? () => { setInboxOpen(false); setActiveConv(null); } : openInbox} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-emerald-500/60 hover:text-foreground">
              <Inbox className="h-3.5 w-3.5" /> {inboxOpen ? "Close inbox" : "Open inbox"}
            </button>
          </div>

          {inboxOpen ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:divide-x sm:divide-border">
                {/* conversation list */}
                <div className="max-h-[360px] overflow-y-auto">
                  {convLoading ? (
                    <div className="grid place-items-center py-10"><FlowLoader size={22} label="Loading chats…" /></div>
                  ) : conversations.length ? (
                    conversations.map((c) => {
                      const name = c.customerName || c.customerPhone || "Unknown";
                      const isActive = activeConv?.id === c.id;
                      return (
                        <button key={c.id} onClick={() => openConversation(c)} className={cn("flex w-full items-center gap-2.5 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40", isActive && "bg-emerald-500/5")}>
                          {c.customerAvatarUrl ? (
                            <Image src={c.customerAvatarUrl} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" unoptimized />
                          ) : (
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-[12px] font-bold text-white">{name.slice(0, 1).toUpperCase()}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[12.5px] font-semibold">{name}</p>
                              <span className="ms-auto shrink-0 text-[10.5px] text-muted-foreground">{timeLabel(c.lastMessageAt ?? c.lastMessage?.timestamp)}</span>
                            </div>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                              {c.lastMessage?.direction === "outbound" ? "You: " : ""}{c.lastMessage?.content || (c.lastMessage?.messageType ? `[${c.lastMessage.messageType}]` : "No messages yet")}
                            </p>
                          </div>
                          {c.unreadCount ? <span className="ms-1 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">{c.unreadCount}</span> : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><MessagesSquare className="h-5 w-5" /></span>
                      <p className="text-[12.5px] font-medium">No conversations yet</p>
                      <p className="mt-1 text-[11.5px] text-muted-foreground">Inbound chats will appear here once customers message you.</p>
                    </div>
                  )}
                </div>

                {/* thread + reply */}
                <div className="flex min-h-[300px] flex-col bg-muted/20">
                  {!activeConv ? (
                    <div className="grid flex-1 place-items-center px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                      Select a conversation to read and reply.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-[11px] font-bold text-white">{(activeConv.customerName || activeConv.customerPhone || "?").slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold">{activeConv.customerName || activeConv.customerPhone}</p>
                          {activeConv.customerName && <p className="truncate text-[11px] text-muted-foreground">{activeConv.customerPhone}</p>}
                        </div>
                        <button onClick={() => { setActiveConv(null); setMessages([]); }} className="ms-auto grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden" aria-label="Back to list"><X className="h-4 w-4" /></button>
                      </div>

                      <div ref={threadRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ maxHeight: 260 }}>
                        {msgLoading ? (
                          <div className="grid place-items-center py-8"><FlowLoader size={20} label="Loading messages…" /></div>
                        ) : messages.length ? (
                          messages.map((m) => {
                            const out = m.direction === "outbound";
                            return (
                              <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                                <div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-[12.5px] leading-snug", out ? "rounded-br-sm bg-emerald-500 text-white" : "rounded-bl-sm border border-border bg-card text-foreground")}>
                                  {m.messageType !== "text" && !m.content ? <span className="italic opacity-80">[{m.messageType}]</span> : <span className="whitespace-pre-wrap break-words">{m.content}</span>}
                                  <span className={cn("mt-0.5 block text-[9.5px]", out ? "text-white/70" : "text-muted-foreground")}>{timeLabel(m.timestamp)}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="py-8 text-center text-[12px] text-muted-foreground">No messages in this conversation yet.</p>
                        )}
                      </div>

                      <div className="border-t border-border bg-card px-3 py-2">
                        {sendError ? <p className="mb-1.5 text-[11.5px] text-rose-500">{sendError}</p> : null}
                        <div className="flex items-end gap-2">
                          <textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                            rows={1}
                            placeholder="Type a reply…"
                            className="max-h-28 min-h-[36px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:border-emerald-500"
                          />
                          <button onClick={sendReply} disabled={sending || !reply.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm disabled:opacity-50" aria-label="Send reply">
                            {sending ? <FlowLoader size={16} /> : <Send className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-5 text-center">
              <p className="text-[12.5px] text-muted-foreground">{conversationCount ? "Open the inbox to read inbound chats and reply." : "Replies will appear here once chats come in."}</p>
            </div>
          )}
        </section>

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
                const isOpen = openAutoId === a.id;
                return (
                  <div key={a.id} className={cn("rounded-xl border transition", a.isActive ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/30", isOpen && "border-emerald-500/50")}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                      <button onClick={() => toggleAutoRow(a)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", a.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
                          <Zap className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{a.name}</p>
                          <p className="flex items-center gap-1 truncate text-[11.5px] text-muted-foreground">
                            {triggerLabel(a.triggerType)} <ArrowRight className="h-3 w-3 shrink-0 opacity-60" /> {actionLabel(a.actionType)}
                          </p>
                        </div>
                        <ChevronRight className={cn("hidden h-4 w-4 shrink-0 text-muted-foreground transition sm:block", isOpen && "rotate-90")} />
                      </button>
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

                    {isOpen && (
                      <div className="border-t border-border/60 px-3 py-3">
                        {autoMode === null ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <Mini label="Trigger" value={triggerLabel(a.triggerType)} />
                              <Mini label="Action" value={actionLabel(a.actionType)} />
                              <Mini label="Times run" value={(a.usageCount ?? 0).toLocaleString()} />
                            </div>
                            {a.triggerType === "keyword" && keywordsFromConfig(a.triggerConfig) ? (
                              <div className="rounded-xl border border-border bg-background p-3">
                                <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Keywords</p>
                                <p className="mt-0.5 text-[12.5px]">{keywordsFromConfig(a.triggerConfig)}</p>
                              </div>
                            ) : null}
                            {a.actionValue ? (
                              <div className="rounded-xl border border-border bg-background p-3">
                                <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{actionLabel(a.actionType)}</p>
                                <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">{a.actionValue}</p>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2">
                              <button onClick={() => startEditAuto(a)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button onClick={() => { setAutoError(null); setAutoMode("delete"); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[12.5px] font-semibold text-rose-500 hover:bg-rose-500/10">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {autoMode === "edit" ? (
                          <div className="space-y-2.5 rounded-xl border border-border bg-background p-3">
                            <Field label="Name">
                              <input value={autoForm.name} onChange={(e) => setAutoForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
                            </Field>
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                              <Field label="Trigger">
                                <select value={autoForm.triggerType} onChange={(e) => setAutoForm((f) => ({ ...f, triggerType: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500">
                                  {TRIGGER_OPTIONS.map((t) => <option key={t} value={t}>{triggerLabel(t)}</option>)}
                                </select>
                              </Field>
                              <Field label="Action">
                                <select value={autoForm.actionType} onChange={(e) => setAutoForm((f) => ({ ...f, actionType: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500">
                                  {ACTION_OPTIONS.map((t) => <option key={t} value={t}>{actionLabel(t)}</option>)}
                                </select>
                              </Field>
                            </div>
                            {autoForm.triggerType === "keyword" ? (
                              <Field label="Keywords (comma-separated)">
                                <input value={autoForm.keywords} onChange={(e) => setAutoForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="hours, price, location" className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
                              </Field>
                            ) : null}
                            <Field label={autoForm.actionType === "send_message" ? "Reply message" : "Action value"}>
                              <textarea value={autoForm.actionValue} onChange={(e) => setAutoForm((f) => ({ ...f, actionValue: e.target.value }))} rows={3} className="w-full resize-none rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
                            </Field>
                            {autoError ? <p className="text-[12px] text-rose-500">{autoError}</p> : null}
                            <div className="flex items-center justify-end gap-2 pt-0.5">
                              <button disabled={autoBusy} onClick={() => { setAutoMode(null); setAutoError(null); }} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                              <button disabled={autoBusy} onClick={() => saveAuto(a)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-green-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                                {autoBusy ? <FlowLoader size={14} /> : <Check className="h-3.5 w-3.5" />} Save
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {autoMode === "delete" ? (
                          <div className="space-y-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                            <div className="flex items-start gap-2 text-[12.5px]">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                              <p>Delete <span className="font-semibold">{a.name}</span>? This automation will stop running and can&apos;t be undone.</p>
                            </div>
                            {autoError ? <p className="text-[12px] text-rose-500">{autoError}</p> : null}
                            <div className="flex items-center justify-end gap-2 pt-0.5">
                              <button disabled={autoBusy} onClick={() => { setAutoMode(null); setAutoError(null); }} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                              <button disabled={autoBusy} onClick={() => confirmDeleteAuto(a)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                                {autoBusy ? <FlowLoader size={14} /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
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

        {/* templates */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Message templates</h3>
            <button onClick={() => { setTmplCreating((v) => !v); setTmplError(null); setTmplNotice(null); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-green-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              {tmplCreating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {tmplCreating ? "Cancel" : "New template"}
            </button>
            {onAsk && (
              <button onClick={() => onAsk("Help me send a WhatsApp broadcast — ask me the audience, the message, and any media, then draft an approved message template and schedule it.")} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Draft with agent
              </button>
            )}
          </div>

          {/* filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Category</span>
            <FilterPill label="All" active={tmplCategory === ""} onClick={() => applyTmplFilter("", tmplStatus)} />
            {TEMPLATE_CATEGORIES.map((c) => (
              <FilterPill key={c} label={c.charAt(0) + c.slice(1).toLowerCase()} active={tmplCategory === c} onClick={() => applyTmplFilter(c, tmplStatus)} />
            ))}
            <span className="ms-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <FilterPill label="All" active={tmplStatus === ""} onClick={() => applyTmplFilter(tmplCategory, "")} />
            {TEMPLATE_STATUSES.map((s) => (
              <FilterPill key={s} label={s.charAt(0) + s.slice(1).toLowerCase()} active={tmplStatus === s} onClick={() => applyTmplFilter(tmplCategory, s)} />
            ))}
          </div>

          {tmplNotice ? (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" /> {tmplNotice}
            </div>
          ) : null}

          {/* create form */}
          {tmplCreating ? (
            <div className="mb-3 space-y-2.5 rounded-xl border border-border bg-background p-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field label="Template name (a-z, 0-9, _)">
                  <input value={tmplForm.name} onChange={(e) => setTmplForm((f) => ({ ...f, name: e.target.value.toLowerCase() }))} placeholder="order_confirmation" className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
                </Field>
                <Field label="Category">
                  <select value={tmplForm.category} onChange={(e) => setTmplForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500">
                    {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field label="Language">
                  <select value={tmplForm.language} onChange={(e) => setTmplForm((f) => ({ ...f, language: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500">
                    {TEMPLATE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </Field>
                <Field label="Header (optional)">
                  <input value={tmplForm.headerText} onChange={(e) => setTmplForm((f) => ({ ...f, headerText: e.target.value }))} placeholder="Short title at the top" className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
                </Field>
              </div>
              <Field label="Body">
                <textarea value={tmplForm.bodyText} onChange={(e) => setTmplForm((f) => ({ ...f, bodyText: e.target.value }))} rows={4} placeholder="Hi {{1}}, your order {{2}} is on its way!" className="w-full resize-none rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
              </Field>
              <Field label="Footer (optional)">
                <input value={tmplForm.footerText} onChange={(e) => setTmplForm((f) => ({ ...f, footerText: e.target.value }))} placeholder="Reply STOP to unsubscribe" className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500" />
              </Field>
              <p className="text-[11px] text-muted-foreground">WhatsApp reviews new templates before they can be sent. Use <span className="font-medium">{"{{1}}"}</span>, <span className="font-medium">{"{{2}}"}</span> for personalized variables.</p>
              {tmplError ? <p className="text-[12px] text-rose-500">{tmplError}</p> : null}
              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button disabled={tmplBusy} onClick={() => { setTmplCreating(false); setTmplError(null); }} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                <button disabled={tmplBusy} onClick={submitTemplate} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-green-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                  {tmplBusy ? <FlowLoader size={14} /> : <Send className="h-3.5 w-3.5" />} Submit for approval
                </button>
              </div>
            </div>
          ) : null}

          {/* template list */}
          {tmplLoading ? (
            <div className="grid place-items-center py-8"><FlowLoader size={22} label="Loading templates…" /></div>
          ) : templates.length ? (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500"><FileText className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{t.name}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{t.category?.charAt(0) + (t.category?.slice(1).toLowerCase() ?? "")} · {t.language}{t.usageCount ? ` · sent ${t.usageCount}` : ""}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", templateStatusTone(t.status))}>{t.status}</span>
                    {tmplDeleteId === t.id ? null : (
                      <button onClick={() => { setTmplDeleteId(t.id); setTmplError(null); setTmplNotice(null); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-500/10" aria-label={`Delete ${t.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  {t.bodyText ? <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[12px] text-foreground/80">{t.headerText ? `${t.headerText}\n` : ""}{t.bodyText}</p> : null}

                  {tmplDeleteId === t.id ? (
                    <div className="mt-2 space-y-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                      <div className="flex items-start gap-2 text-[12.5px]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                        <p>Delete template <span className="font-semibold">{t.name}</span>? {t.status === "APPROVED" ? "It will be removed from WhatsApp and can no longer be sent." : "This removes the pending submission."}</p>
                      </div>
                      {tmplError ? <p className="text-[12px] text-rose-500">{tmplError}</p> : null}
                      <div className="flex items-center justify-end gap-2">
                        <button disabled={tmplBusy} onClick={() => { setTmplDeleteId(null); setTmplError(null); }} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                        <button disabled={tmplBusy} onClick={() => confirmDeleteTemplate(t)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                          {tmplBusy ? <FlowLoader size={14} /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><FileText className="h-5 w-5" /></span>
              <p className="text-[13px] font-medium">{tmplCategory || tmplStatus ? "No templates match these filters" : "No templates yet"}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{tmplCategory || tmplStatus ? "Clear the filters or create a new template." : "Create a reusable message template and submit it to WhatsApp for approval."}</p>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-bold leading-tight">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition",
        active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
