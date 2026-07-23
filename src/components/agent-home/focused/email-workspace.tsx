"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { Mail, Settings, Send, MailOpen, MousePointerClick, Users, FileText, Clock, CheckCircle2, ChevronRight, X, Percent, Pencil, Trash2, CalendarClock, AlertTriangle, Check, Search, Monitor, Smartphone, Copy, Code2, Plus, ArrowLeft, Save } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { EmailSetupCard } from "./email-setup";
import { cn } from "@/lib/utils/cn";

/**
 * Email — a deep new-design email-marketing surface (the Email workspace canvas),
 * full-width master/detail: a sticky LEFT card (KPI rollups + a real in-surface
 * "New campaign" form trigger + an optional AI-draft assist + status filters +
 * search) and a RIGHT pane that shows the campaign list OR a real CREATE-CAMPAIGN
 * form that creates the draft directly (POST /api/campaigns — name, subject, body,
 * sender, audience). Clicking a campaign opens its detail inline
 * (GET /api/campaigns/[id]) with in-surface edit / send / schedule / delete.
 * The generative "draft it with AI" path stays available via onAsk for users who
 * want the agent to write the copy. The email-provider SETUP gate (when not
 * configured) keeps its dedicated full-width landing. No legacy links.
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]] [[full-width-left-menu-layout]]
 */

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject?: string | null;
  audience?: number;
  sent?: number;
  delivered?: number;
  failed?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  unsubscribed?: number;
  openRate?: number;
  clickRate?: number;
  contactList?: { id: string; name: string; totalCount?: number } | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt?: string;
}
interface Stats { total?: number; active?: number; sent?: number; draft?: number; avgOpenRate?: number; }
interface CampaignDetail extends Campaign {
  preheaderText?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  content?: string | null;
  contentHtml?: string | null;
  contactListId?: string | null;
}
interface ContactListOption { id: string; name: string; totalCount?: number }

// Draft-only management is allowed where the server permits it:
// edit  → any status except SENT; delete → not ACTIVE/SENT; send → not SENT/SENDING.
const canEdit = (s: string) => s?.toLowerCase() !== "sent";
const canDelete = (s: string) => !["active", "sent"].includes(s?.toLowerCase());
const canSend = (s: string) => !["sent", "sending"].includes(s?.toLowerCase());

// A datetime-local string (local TZ, no seconds) one hour from now — a sane schedule default.
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_META: Record<string, { label: string; icon: ElementType; tone: string }> = {
  draft: { label: "Draft", icon: FileText, tone: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", icon: Clock, tone: "bg-amber-500/10 text-amber-500" },
  active: { label: "Active", icon: Send, tone: "bg-brand-500/10 text-brand-500" },
  sending: { label: "Sending", icon: Send, tone: "bg-brand-500/10 text-brand-500" },
  sent: { label: "Sent", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-500" },
  paused: { label: "Paused", icon: Clock, tone: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", icon: X, tone: "bg-rose-500/10 text-rose-500" },
};
const statusMeta = (s: string) => STATUS_META[s?.toLowerCase()] ?? { label: s || "Draft", icon: FileText, tone: "bg-muted text-muted-foreground" };

// Status filter values map to the route's lowercase `status` param (it uppercases server-side).
type StatusFilter = "all" | "draft" | "scheduled" | "sent" | "failed";
const STATUS_FILTERS: { value: StatusFilter; label: string; icon: ElementType }[] = [
  { value: "all", label: "All campaigns", icon: Mail },
  { value: "draft", label: "Drafts", icon: FileText },
  { value: "scheduled", label: "Scheduled", icon: Clock },
  { value: "sent", label: "Sent", icon: CheckCircle2 },
  { value: "failed", label: "Failed", icon: X },
];

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedEmail({ refreshKey }: { refreshKey?: number; onAsk?: (prompt: string) => void; working?: boolean }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  // null = unknown; false = needs setup; true = configured (show campaigns back office).
  const [configured, setConfigured] = useState<boolean | null>(null);
  // The sending setup opens as a BRIEF sheet when nothing is connected yet, and
  // stays reachable from the back office (like the phone agent's setup).
  const [setupOpen, setSetupOpen] = useState(false);

  // Search (name/subject) + status filter — wired to GET /api/campaigns?type=email&search=&status=.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [listLoading, setListLoading] = useState(false); // a filtered re-fetch is in flight

  // Right-pane mode: the create-campaign form replaces the list when building.
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  // Selected campaign detail: id while loading, the detail object once fetched, null when closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Rendered HTML preview state (per open campaign): visible, viewport, copied flash.
  const [showPreview, setShowPreview] = useState(false);
  const [previewView, setPreviewView] = useState<"desktop" | "mobile">("desktop");
  const [htmlCopied, setHtmlCopied] = useState(false);

  // In-surface management (CRUD) state for the open campaign.
  type ActionMode = null | "edit" | "delete" | "send" | "schedule";
  const [mode, setMode] = useState<ActionMode>(null);
  const [busy, setBusy] = useState(false); // a mutation is in flight
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // Edit form fields (seeded from the detail when entering edit mode).
  const [form, setForm] = useState({ name: "", subject: "", fromName: "", replyTo: "", contactListId: "" });
  const [scheduleAt, setScheduleAt] = useState("");
  // Contact lists for the audience selector — fetched lazily the first time edit/create opens.
  const [lists, setLists] = useState<ContactListOption[] | null>(null);

  const resetActions = useCallback(() => {
    setMode(null); setBusy(false); setActionError(null);
  }, []);

  const loadLists = useCallback(async () => {
    if (lists !== null) return;
    try {
      const j = await fetch("/api/contact-lists").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.lists)) {
        setLists(j.data.lists.map((l: { id: string; name: string; totalCount?: number }) => ({ id: l.id, name: l.name, totalCount: l.totalCount })));
      } else setLists([]);
    } catch { setLists([]); }
  }, [lists]);

  // Latest search/status, read inside load() without making the callback identity churn on each keystroke.
  const queryRef = useRef({ search: "", status: "all" as StatusFilter });
  queryRef.current = { search, status: statusFilter };

  const load = useCallback(async () => {
    try {
      const q = queryRef.current;
      const params = new URLSearchParams({ type: "email", limit: "30" });
      const term = q.search.trim();
      if (term) params.set("search", term);
      if (q.status !== "all") params.set("status", q.status);
      const [cfg, j] = await Promise.all([
        fetch("/api/marketing-config").then((r) => r.json()).catch(() => null),
        fetch(`/api/campaigns?${params.toString()}`).then((r) => r.json()).catch(() => null),
      ]);
      const c = cfg?.data?.config;
      // Ready to send = a provider chosen, a sender on file, and a verified test send.
      setConfigured(!!c && c.emailProvider !== "NONE" && !!c.emailVerified && !!c.defaultFromEmail);
      if (j?.success && j.data) {
        setCampaigns(Array.isArray(j.data.campaigns) ? j.data.campaigns : []);
        if (j.data.stats) setStats(j.data.stats);
      }
    } catch { setConfigured((v) => (v === null ? false : v)); }
  }, []);

  // Becomes true once the initial load (or a refreshKey reload) has run, so the filter effect
  // below knows not to double-fetch on the very first render with default (empty) filters.
  const initialLoaded = useRef(false);
  useEffect(() => {
    let alive = true;
    initialLoaded.current = false;
    load().finally(() => { if (alive) { setLoading(false); initialLoaded.current = true; } });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Debounced re-fetch when the search term or status filter changes (the initial load already
  // covers the default filters; this only fires for actual user-driven filter changes).
  useEffect(() => {
    if (!initialLoaded.current) return;
    let alive = true;
    setListLoading(true);
    const t = setTimeout(() => {
      load().finally(() => { if (alive) setListLoading(false); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [search, statusFilter, load]);

  // Open the setup brief automatically the first time we detect no sender.
  useEffect(() => { if (configured === false) setSetupOpen(true); }, [configured]);

  // Fetch (or re-fetch) a campaign's detail. Returns the detail so callers can seed forms.
  const fetchDetail = useCallback(async (id: string): Promise<CampaignDetail | null> => {
    try {
      const j = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
      if (j?.success && j.data?.campaign) {
        const d = j.data.campaign as CampaignDetail;
        setDetail(d);
        return d;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const openCampaign = useCallback(async (c: Campaign) => {
    setShowPreview(false); setHtmlCopied(false); setPreviewView("desktop");
    if (openId === c.id) { setOpenId(null); setDetail(null); resetActions(); setActionNotice(null); return; }
    setOpenId(c.id); setDetail(null); setDetailLoading(true);
    resetActions(); setActionNotice(null);
    await fetchDetail(c.id);
    setDetailLoading(false);
  }, [openId, fetchDetail, resetActions]);

  // Copy the rendered HTML source of the open campaign to the clipboard.
  const copyHtml = useCallback(async () => {
    const html = detail?.contentHtml;
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setHtmlCopied(true);
      setTimeout(() => setHtmlCopied(false), 1800);
    } catch { /* clipboard may be unavailable; silently ignore */ }
  }, [detail]);

  // Enter edit mode — seed the form from the loaded detail and load the audience options.
  const startEdit = useCallback(() => {
    if (!detail) return;
    setActionError(null); setActionNotice(null);
    setForm({
      name: detail.name ?? "",
      subject: detail.subject ?? "",
      fromName: detail.fromName ?? "",
      replyTo: detail.replyTo ?? "",
      contactListId: detail.contactListId ?? detail.contactList?.id ?? "",
    });
    void loadLists();
    setMode("edit");
  }, [detail, loadLists]);

  // PATCH /api/campaigns/[id] — save name/subject/sender/audience for a draft.
  const saveEdit = useCallback(async () => {
    if (!openId) return;
    if (!form.name.trim()) { setActionError("Campaign name is required."); return; }
    setBusy(true); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${openId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          subject: form.subject,
          fromName: form.fromName || null,
          replyTo: form.replyTo || null,
          contactListId: form.contactListId || null,
        }),
      }).then((r) => r.json());
      if (!j?.success) { setActionError(j?.error?.message || "Could not save changes."); setBusy(false); return; }
      await Promise.all([fetchDetail(openId), load()]);
      setMode(null); setBusy(false);
      setActionNotice("Campaign updated.");
    } catch { setActionError("Could not save changes."); setBusy(false); }
  }, [openId, form, fetchDetail, load]);

  // DELETE /api/campaigns/[id] — remove a draft/scheduled/failed/paused campaign.
  const confirmDelete = useCallback(async () => {
    if (!openId) return;
    setBusy(true); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${openId}`, { method: "DELETE" }).then((r) => r.json());
      if (!j?.success) { setActionError(j?.error?.message || "Could not delete this campaign."); setBusy(false); return; }
      const removedId = openId;
      setCampaigns((prev) => prev.filter((c) => c.id !== removedId));
      setOpenId(null); setDetail(null); resetActions();
      void load();
    } catch { setActionError("Could not delete this campaign."); setBusy(false); }
  }, [openId, load, resetActions]);

  // POST /api/campaigns/[id]/send — send now, or schedule for a future date-time.
  const submitSend = useCallback(async (action: "send" | "schedule") => {
    if (!openId) return;
    if (action === "schedule" && !scheduleAt) { setActionError("Pick a date and time."); return; }
    setBusy(true); setActionError(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "schedule") body.scheduledAt = new Date(scheduleAt).toISOString();
      const j = await fetch(`/api/campaigns/${openId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!j?.success) { setActionError(j?.error?.message || "Could not send this campaign."); setBusy(false); return; }
      await Promise.all([fetchDetail(openId), load()]);
      setMode(null); setBusy(false);
      setActionNotice(
        action === "schedule"
          ? `Scheduled for ${whenLabel(j.data?.scheduledAt) || "the selected time"}.`
          : (typeof j.data?.message === "string" ? j.data.message : "Campaign sent.")
      );
    } catch { setActionError("Could not send this campaign."); setBusy(false); }
  }, [openId, scheduleAt, fetchDetail, load]);

  // Open the in-surface create form (collapse any open detail first).
  const startCreate = useCallback(() => {
    setOpenId(null); setDetail(null); resetActions(); setActionNotice(null);
    setCreateNotice(null);
    void loadLists();
    setCreating(true);
  }, [resetActions, loadLists]);

  // Mobile preview: force a 375px viewport and clamp 600px email tables to the phone width.
  const previewHtml = detail?.contentHtml ?? "";
  const mobileSrcDoc = useMemo(() => {
    if (!previewHtml) return "";
    if (previewHtml.includes("<head>")) {
      return previewHtml.replace(
        "<head>",
        `<head><meta name="viewport" content="width=375, initial-scale=1"><style>body{max-width:375px!important;margin:0 auto!important;}table[style*="width: 600px"]{width:100%!important;max-width:375px!important;}</style>`,
      );
    }
    // Fragment without a document shell — wrap it so the viewport clamp still applies.
    return `<!doctype html><html><head><meta name="viewport" content="width=375, initial-scale=1"><style>body{max-width:375px!important;margin:0 auto!important;font-family:system-ui,sans-serif;}table[style*="width: 600px"]{width:100%!important;max-width:375px!important;}</style></head><body>${previewHtml}</body></html>`;
  }, [previewHtml]);

  // The single-campaign GET route returns raw counts but not open/click rates, so derive
  // them here for the detail Mini cards (same formula the list route uses: opens/sent, clicks/opens).
  const detailOpenRate = detail && (detail.sent ?? 0) > 0 ? Math.round(((detail.opened ?? 0) / (detail.sent ?? 1)) * 100) : 0;
  const detailClickRate = detail && (detail.opened ?? 0) > 0 ? Math.round(((detail.clicked ?? 0) / (detail.opened ?? 1)) * 100) : 0;

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your campaigns…" /></div>;
  }

  const totalCampaigns = stats.total ?? campaigns.length;
  const totalSent = stats.sent ?? campaigns.filter((c) => c.status?.toLowerCase() === "sent").length;
  const totalDrafts = stats.draft ?? campaigns.filter((c) => c.status?.toLowerCase() === "draft").length;
  const avgOpen = stats.avgOpenRate ?? 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + section menu + actions + search */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          {/* identity + KPI rollups */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Mail className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">Email marketing</h2>
                <p className="truncate text-[11.5px] text-muted-foreground">Branded campaigns to your contacts.</p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <StatRow icon={Mail} label="Campaigns" value={totalCampaigns.toLocaleString()} sub={totalDrafts ? `${totalDrafts.toLocaleString()} ${totalDrafts === 1 ? "draft" : "drafts"}` : undefined} />
              <StatRow icon={Send} label="Sent" value={totalSent.toLocaleString()} />
              <StatRow icon={Percent} label="Avg open rate" value={`${avgOpen}%`} />
            </div>
          </div>

          {/* primary actions */}
          <div className="space-y-2">
            <button
              onClick={startCreate}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
            >
              <Plus className="h-4 w-4" /> New campaign
            </button>
            <button
              onClick={() => setSetupOpen(true)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" /> Sending setup{configured ? "" : " · needed"}
            </button>
          </div>

          {/* section menu: status filters as a vertical nav */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value && !creating;
              return (
                <button
                  key={f.value}
                  onClick={() => { setCreating(false); setStatusFilter(f.value); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <f.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{f.label}</span>
                </button>
              );
            })}
          </nav>

          {/* search */}
          <div className="rounded-2xl border border-border bg-card p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or subject…"
                aria-label="Search campaigns"
                className="w-full rounded-[10px] border border-border bg-muted/30 ps-8 pe-8 py-1.5 text-[12.5px] outline-none focus:border-brand-500"
              />
              {search ? (
                <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        {/* RIGHT: create form OR campaign list — full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {creating ? (
            <CreateCampaign
              lists={lists ?? []}
              onCancel={() => setCreating(false)}
              onCreated={(msg) => { setCreating(false); setCreateNotice(msg); load(); }}
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-bold">Campaigns</h3>
                {campaigns.length > 0 && (
                  <button onClick={startCreate} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" /> New campaign
                  </button>
                )}
              </div>

              {createNotice && (
                <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">{createNotice}</p>
              )}

              {listLoading ? (
                <div className="grid place-items-center py-10"><FlowLoader size={24} label="Filtering campaigns…" /></div>
              ) : campaigns.length ? (
                <div className="space-y-2">
                  {campaigns.map((c) => {
                    const m = statusMeta(c.status);
                    const isOpen = openId === c.id;
                    return (
                      <div key={c.id} className={cn("rounded-xl border bg-muted/30 transition", isOpen ? "border-brand-500/40" : "border-border")}>
                        <button onClick={() => openCampaign(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-brand-500"><Mail className="h-[18px] w-[18px]" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{c.name}</p>
                            <p className="truncate text-[11.5px] text-muted-foreground">{c.subject || "No subject yet"}</p>
                          </div>
                          <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold sm:inline-flex", m.tone)}>
                            <m.icon className="h-3 w-3" /> {m.label}
                          </span>
                          <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", isOpen && "rotate-90")} />
                        </button>

                        {/* compact stat row (always visible) */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-3 py-2 text-[11.5px] text-muted-foreground">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold sm:hidden", m.tone)}><m.icon className="h-3 w-3" /> {m.label}</span>
                          <Stat icon={Users} label="Recipients" value={(c.audience ?? c.contactList?.totalCount ?? 0).toLocaleString()} />
                          <Stat icon={MailOpen} label="Opens" value={`${(c.opened ?? 0).toLocaleString()}${c.openRate ? ` (${c.openRate}%)` : ""}`} />
                          <Stat icon={MousePointerClick} label="Clicks" value={`${(c.clicked ?? 0).toLocaleString()}${c.clickRate ? ` (${c.clickRate}%)` : ""}`} />
                          <span className="ms-auto">{c.sentAt ? `Sent ${whenLabel(c.sentAt)}` : c.scheduledAt ? `Scheduled ${whenLabel(c.scheduledAt)}` : whenLabel(c.createdAt)}</span>
                        </div>

                        {/* inline detail */}
                        {isOpen && (
                          <div className="border-t border-border/60 px-3 py-3">
                            {detailLoading ? (
                              <div className="grid place-items-center py-4"><FlowLoader size={22} label="Loading campaign…" /></div>
                            ) : detail ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                  <Mini label="Sent" value={(detail.sent ?? 0).toLocaleString()} />
                                  <Mini label="Delivered" value={(detail.delivered ?? 0).toLocaleString()} />
                                  <Mini label="Opened" value={`${(detail.opened ?? 0).toLocaleString()}${detailOpenRate ? ` · ${detailOpenRate}%` : ""}`} />
                                  <Mini label="Clicked" value={`${(detail.clicked ?? 0).toLocaleString()}${detailClickRate ? ` · ${detailClickRate}%` : ""}`} />
                                </div>
                                {(detail.bounced || detail.unsubscribed || detail.failed) ? (
                                  <div className="grid grid-cols-3 gap-3">
                                    <Mini label="Bounced" value={(detail.bounced ?? 0).toLocaleString()} />
                                    <Mini label="Unsubscribed" value={(detail.unsubscribed ?? 0).toLocaleString()} />
                                    <Mini label="Failed" value={(detail.failed ?? 0).toLocaleString()} />
                                  </div>
                                ) : null}
                                <div className="rounded-xl border border-border bg-background p-3">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                                  <p className="mt-0.5 text-[13px] font-semibold">{detail.subject || "—"}</p>
                                  {detail.preheaderText ? <p className="mt-1 text-[12px] text-muted-foreground">{detail.preheaderText}</p> : null}
                                  {detail.content ? (
                                    <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/90 line-clamp-[12]">{detail.content}</p>
                                  ) : null}
                                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                                    {detail.fromName ? <span>From {detail.fromName}</span> : null}
                                    {detail.replyTo ? <span>Reply-to {detail.replyTo}</span> : null}
                                    {detail.contactList?.name ? <span>Audience: {detail.contactList.name}</span> : null}
                                  </div>
                                </div>

                                {/* rendered HTML email preview */}
                                {detail.contentHtml ? (
                                  <div className="rounded-xl border border-border bg-background overflow-hidden">
                                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                                      <button
                                        onClick={() => setShowPreview((v) => !v)}
                                        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold hover:text-brand-500"
                                      >
                                        <Code2 className="h-3.5 w-3.5" /> {showPreview ? "Hide email preview" : "Preview email"}
                                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition", showPreview && "rotate-90")} />
                                      </button>
                                      {showPreview ? (
                                        <div className="ms-auto flex items-center gap-1.5">
                                          <div className="flex items-center gap-0.5 rounded-[8px] bg-muted/50 p-0.5">
                                            <button
                                              onClick={() => setPreviewView("desktop")}
                                              aria-label="Desktop preview"
                                              aria-pressed={previewView === "desktop"}
                                              className={cn("grid h-6 w-6 place-items-center rounded-[6px] transition", previewView === "desktop" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                              <Monitor className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              onClick={() => setPreviewView("mobile")}
                                              aria-label="Mobile preview"
                                              aria-pressed={previewView === "mobile"}
                                              className={cn("grid h-6 w-6 place-items-center rounded-[6px] transition", previewView === "mobile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                              <Smartphone className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          <button
                                            onClick={copyHtml}
                                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold hover:bg-muted/60"
                                          >
                                            {htmlCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            {htmlCopied ? "Copied" : "Copy HTML"}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                    {showPreview ? (
                                      <div className="flex justify-center bg-muted/30 p-3">
                                        {previewView === "mobile" ? (
                                          <div className="mx-auto" style={{ width: 320 }}>
                                            <div className="overflow-hidden rounded-[2.25rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl dark:border-gray-600 dark:bg-gray-600">
                                              <div className="flex h-6 items-center justify-center bg-gray-800 dark:bg-gray-600"><div className="h-4 w-20 rounded-full bg-black" /></div>
                                              <div className="overflow-hidden bg-white" style={{ width: 308 }}>
                                                <iframe srcDoc={mobileSrcDoc} style={{ width: 308, height: 520, border: "none", display: "block" }} sandbox="allow-same-origin" title="Mobile email preview" />
                                              </div>
                                              <div className="flex h-4 items-center justify-center bg-gray-800 dark:bg-gray-600"><div className="h-1 w-24 rounded-full bg-gray-600 dark:bg-gray-400" /></div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="w-full max-w-[620px]">
                                            <iframe srcDoc={previewHtml} className="w-full rounded-lg border border-border bg-white" style={{ minHeight: 460 }} sandbox="allow-same-origin" title="Desktop email preview" />
                                          </div>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                {actionNotice ? (
                                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-4 w-4 shrink-0" /> {actionNotice}
                                  </div>
                                ) : null}

                                {/* action bar */}
                                {mode === null ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {canEdit(detail.status) && (
                                      <button onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60">
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                      </button>
                                    )}
                                    {canSend(detail.status) && (
                                      <>
                                        <button onClick={() => { setActionError(null); setActionNotice(null); setMode("send"); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm">
                                          <Send className="h-3.5 w-3.5" /> Send now
                                        </button>
                                        <button onClick={() => { setActionError(null); setActionNotice(null); setScheduleAt(defaultScheduleValue()); setMode("schedule"); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60">
                                          <CalendarClock className="h-3.5 w-3.5" /> Schedule
                                        </button>
                                      </>
                                    )}
                                    {canDelete(detail.status) && (
                                      <button onClick={() => { setActionError(null); setActionNotice(null); setMode("delete"); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[12.5px] font-semibold text-rose-500 hover:bg-rose-500/10">
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                      </button>
                                    )}
                                  </div>
                                ) : null}

                                {/* edit form */}
                                {mode === "edit" ? (
                                  <div className="space-y-2.5 rounded-xl border border-border bg-background p-3">
                                    <Field label="Campaign name">
                                      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-500" />
                                    </Field>
                                    <Field label="Subject">
                                      <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-500" />
                                    </Field>
                                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                      <Field label="From name">
                                        <input value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-500" />
                                      </Field>
                                      <Field label="Reply-to">
                                        <input value={form.replyTo} onChange={(e) => setForm((f) => ({ ...f, replyTo: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-500" />
                                      </Field>
                                    </div>
                                    <Field label="Audience">
                                      <select value={form.contactListId} onChange={(e) => setForm((f) => ({ ...f, contactListId: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-500">
                                        <option value="">No list</option>
                                        {(lists ?? []).map((l) => (
                                          <option key={l.id} value={l.id}>{l.name}{typeof l.totalCount === "number" ? ` (${l.totalCount})` : ""}</option>
                                        ))}
                                      </select>
                                    </Field>
                                    {actionError ? <p className="text-[12px] text-rose-500">{actionError}</p> : null}
                                    <div className="flex items-center justify-end gap-2 pt-0.5">
                                      <button disabled={busy} onClick={resetActions} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                                      <button disabled={busy} onClick={saveEdit} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                                        {busy ? <FlowLoader size={14} /> : <Check className="h-3.5 w-3.5" />} Save
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {/* schedule form */}
                                {mode === "schedule" ? (
                                  <div className="space-y-2.5 rounded-xl border border-border bg-background p-3">
                                    <Field label="Send at">
                                      <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-500" />
                                    </Field>
                                    {actionError ? <p className="text-[12px] text-rose-500">{actionError}</p> : null}
                                    <div className="flex items-center justify-end gap-2 pt-0.5">
                                      <button disabled={busy} onClick={resetActions} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                                      <button disabled={busy} onClick={() => submitSend("schedule")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                                        {busy ? <FlowLoader size={14} /> : <CalendarClock className="h-3.5 w-3.5" />} Schedule
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {/* send confirm */}
                                {mode === "send" ? (
                                  <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                                    <div className="flex items-start gap-2 text-[12.5px]">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                      <p>Send <span className="font-semibold">{detail.name}</span> now? This delivers to the selected audience and deducts credits.</p>
                                    </div>
                                    {actionError ? <p className="text-[12px] text-rose-500">{actionError}</p> : null}
                                    <div className="flex items-center justify-end gap-2 pt-0.5">
                                      <button disabled={busy} onClick={resetActions} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                                      <button disabled={busy} onClick={() => submitSend("send")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                                        {busy ? <FlowLoader size={14} /> : <Send className="h-3.5 w-3.5" />} Send now
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {/* delete confirm */}
                                {mode === "delete" ? (
                                  <div className="space-y-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                                    <div className="flex items-start gap-2 text-[12.5px]">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                                      <p>Delete <span className="font-semibold">{detail.name}</span>? This cannot be undone.</p>
                                    </div>
                                    {actionError ? <p className="text-[12px] text-rose-500">{actionError}</p> : null}
                                    <div className="flex items-center justify-end gap-2 pt-0.5">
                                      <button disabled={busy} onClick={resetActions} className="rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60 disabled:opacity-50">Cancel</button>
                                      <button disabled={busy} onClick={confirmDelete} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                                        {busy ? <FlowLoader size={14} /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <p className="py-3 text-center text-[12.5px] text-muted-foreground">Could not load this campaign.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (search.trim() || statusFilter !== "all") ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Search className="h-6 w-6" /></span>
                  <p className="mt-3 text-[13.5px] font-semibold">No matching campaigns</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">No campaigns match {search.trim() ? <span className="font-medium text-foreground">&ldquo;{search.trim()}&rdquo;</span> : "this filter"}{search.trim() && statusFilter !== "all" ? " for this status" : ""}.</p>
                  <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-3.5 py-1.5 text-[12.5px] font-semibold hover:bg-muted/60">
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Mail className="h-7 w-7" /></span>
                  <p className="mt-3 text-[14px] font-semibold">No email campaigns yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">Create a campaign — write the subject and body and pick your audience.</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button onClick={startCreate} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                      <Plus className="h-4 w-4" /> Create a campaign
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>

      {/* Sending setup — a BRIEF sheet (auto-opens when no sender is connected). */}
      {setupOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setSetupOpen(false)} />
          <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-brand-500">SETUP</span>
              <h3 className="text-[14px] font-bold">Email sending</h3>
              <button onClick={() => setSetupOpen(false)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <EmailSetupCard onDone={() => { setSetupOpen(false); setConfigured(null); setLoading(true); load().finally(() => setLoading(false)); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Create campaign ------------------------------ */

const CREATE_FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

// A real in-surface manual builder backed by POST /api/campaigns (type=email).
// Creates a DRAFT — the user then reviews / sends / schedules it from the list.
function CreateCampaign({ lists, onCancel, onCreated }: { lists: ContactListOption[]; onCancel: () => void; onCreated: (msg: string) => void }) {
  const [form, setForm] = useState({ name: "", subject: "", preheaderText: "", fromName: "", replyTo: "", content: "", contactListId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.name.trim()) { setError("Give your campaign a name."); return; }
    if (!form.content.trim()) { setError("Write the email body before saving."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: "EMAIL",
          subject: form.subject.trim() || undefined,
          preheaderText: form.preheaderText.trim() || undefined,
          fromName: form.fromName.trim() || undefined,
          replyTo: form.replyTo.trim() || undefined,
          content: form.content.trim(),
          contactListId: form.contactListId || undefined,
        }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        onCreated(`“${form.name.trim()}” saved as a draft — open it to review, send or schedule.`);
      } else {
        setError(j?.error?.message || "Could not create the campaign. Try again.");
      }
    } catch {
      setError("Could not create the campaign. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h3 className="text-[15px] font-bold">New email campaign</h3>
          <p className="text-[11.5px] text-muted-foreground">Write the subject and body, pick an audience, then save it as a draft to review and send.</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Basics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CreateField label="Campaign name *" full><input value={form.name} onChange={(e) => set("name", e.target.value)} className={CREATE_FIELD} placeholder="Spring sale announcement" /></CreateField>
          <CreateField label="Subject line"><input value={form.subject} onChange={(e) => set("subject", e.target.value)} className={CREATE_FIELD} placeholder="Save 20% this week only" maxLength={200} /></CreateField>
          <CreateField label="Preheader"><input value={form.preheaderText} onChange={(e) => set("preheaderText", e.target.value)} className={CREATE_FIELD} placeholder="The inbox preview line" maxLength={200} /></CreateField>
        </div>

        {/* Body */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Email body</p>
          <textarea value={form.content} onChange={(e) => set("content", e.target.value)} rows={8} className={cn(CREATE_FIELD, "resize-y")} placeholder="Write your email here…" />
        </div>

        {/* Sender & audience */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Users className="h-3.5 w-3.5" /> Sender &amp; audience</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CreateField label="From name"><input value={form.fromName} onChange={(e) => set("fromName", e.target.value)} className={CREATE_FIELD} placeholder="Acme Team" /></CreateField>
            <CreateField label="Reply-to"><input value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} className={CREATE_FIELD} placeholder="hello@acme.com" inputMode="email" /></CreateField>
            <CreateField label="Audience" full>
              <select value={form.contactListId} onChange={(e) => set("contactListId", e.target.value)} className={CREATE_FIELD}>
                <option value="">Choose later</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{typeof l.totalCount === "number" ? ` (${l.totalCount})` : ""}</option>
                ))}
              </select>
            </CreateField>
          </div>
        </div>

        {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button onClick={create} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
            {submitting ? <FlowLoader size={15} tone="white" /> : <Save className="h-4 w-4" />} {submitting ? "Saving…" : "Save draft"}
          </button>
          <button onClick={onCancel} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-[11px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button>
          <span className="ms-auto text-[11px] text-muted-foreground">Saved as a draft — nothing is sent yet.</span>
        </div>
      </div>
    </section>
  );
}

function CreateField({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatRow({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground/80">{sub}</p>}
      </div>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /><span className="sr-only">{label}: </span><span className="font-medium text-foreground/90">{value}</span></span>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}
