"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import { Mail, Sparkles, Send, MailOpen, MousePointerClick, Users, FileText, Clock, CheckCircle2, ChevronRight, X, Percent, Pencil, Trash2, CalendarClock, AlertTriangle, Check } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { EmailSetupCard } from "./email-setup";
import { cn } from "@/lib/utils/cn";

/**
 * Email — a deep new-design email-marketing surface (the Email workspace canvas):
 * KPI rollups + the campaign list with status (draft/scheduled/sent) and stats
 * (recipients, opens, clicks). Clicking a campaign opens its detail inline
 * (GET /api/campaigns/[id]) — a click means do-it-in-the-UI, not a chat prompt.
 * Creating a campaign is a heavy generative build (subject, body, audience), so
 * "New campaign" drives the agent via onAsk. No legacy links.
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
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

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedEmail({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  // null = unknown; false = needs setup (gate); true = configured (show campaigns).
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Selected campaign detail: id while loading, the detail object once fetched, null when closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // In-surface management (CRUD) state for the open campaign.
  type ActionMode = null | "edit" | "delete" | "send" | "schedule";
  const [mode, setMode] = useState<ActionMode>(null);
  const [busy, setBusy] = useState(false); // a mutation is in flight
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // Edit form fields (seeded from the detail when entering edit mode).
  const [form, setForm] = useState({ name: "", subject: "", fromName: "", replyTo: "", contactListId: "" });
  const [scheduleAt, setScheduleAt] = useState("");
  // Contact lists for the audience selector — fetched lazily the first time edit opens.
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

  const load = useCallback(async () => {
    try {
      const [cfg, j] = await Promise.all([
        fetch("/api/marketing-config").then((r) => r.json()).catch(() => null),
        fetch("/api/campaigns?type=email&limit=30").then((r) => r.json()).catch(() => null),
      ]);
      const c = cfg?.data?.config;
      // Ready to send = a provider chosen, a sender on file, and a verified test send.
      setConfigured(!!c && c.emailProvider !== "NONE" && !!c.emailVerified && !!c.defaultFromEmail);
      if (j?.success && j.data) {
        if (Array.isArray(j.data.campaigns)) setCampaigns(j.data.campaigns);
        if (j.data.stats) setStats(j.data.stats);
      }
    } catch { setConfigured((v) => (v === null ? false : v)); }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

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
    if (openId === c.id) { setOpenId(null); setDetail(null); resetActions(); setActionNotice(null); return; }
    setOpenId(c.id); setDetail(null); setDetailLoading(true);
    resetActions(); setActionNotice(null);
    await fetchDetail(c.id);
    setDetailLoading(false);
  }, [openId, fetchDetail, resetActions]);

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

  const newCampaignPrompt = "Help me create a new email campaign — ask me the goal and audience, then draft the subject line and email body and set it up.";

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your campaigns…" /></div>;
  }

  // Config gate: no sending setup → show the setup landing, not the campaigns menu.
  if (configured === false) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <EmailSetupCard onDone={() => { setConfigured(null); setLoading(true); load().finally(() => setLoading(false)); }} />
      </div>
    );
  }

  const totalCampaigns = stats.total ?? campaigns.length;
  const totalSent = stats.sent ?? campaigns.filter((c) => c.status?.toLowerCase() === "sent").length;
  const avgOpen = stats.avgOpenRate ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* header */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Mail className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold">Email marketing</h2>
              <p className="truncate text-[12px] text-muted-foreground">Reach your contacts with branded email campaigns.</p>
            </div>
            {onAsk && (
              <button onClick={() => onAsk(newCampaignPrompt)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> New campaign
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kpi icon={Mail} label="Campaigns" value={totalCampaigns.toLocaleString()} />
            <Kpi icon={Send} label="Sent" value={totalSent.toLocaleString()} />
            <Kpi icon={Percent} label="Avg open rate" value={`${avgOpen}%`} />
          </div>
        </section>

        {/* campaigns */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Campaigns</h3>

          {campaigns.length ? (
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
                              <Mini label="Opened" value={`${(detail.opened ?? 0).toLocaleString()}${detail.openRate ? ` · ${detail.openRate}%` : ""}`} />
                              <Mini label="Clicked" value={`${(detail.clicked ?? 0).toLocaleString()}${detail.clickRate ? ` · ${detail.clickRate}%` : ""}`} />
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
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Mail className="h-7 w-7" /></span>
              <p className="mt-3 text-[14px] font-semibold">No email campaigns yet</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Tell the agent your goal and audience — it drafts the subject and body and sets the campaign up for you.</p>
              {onAsk && (
                <button onClick={() => onAsk(newCampaignPrompt)} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Create a campaign
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
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <p className="mt-1 text-[18px] font-extrabold leading-none">{value}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /><span className="sr-only">{label}: </span><span className="font-medium text-foreground/90">{value}</span></span>
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
