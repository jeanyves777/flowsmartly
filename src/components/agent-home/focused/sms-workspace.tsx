"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import { MessageSquare, Sparkles, Phone, Send, CheckCircle2, Clock, Users, AlertTriangle, ShieldCheck, Gauge, XCircle, ExternalLink, ChevronRight, Trash2, MousePointerClick, CalendarClock, PenLine } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * SMS — a deep new-design SMS-marketing surface (the SMS workspace canvas): the
 * user's number/credit status + their SMS blasts with delivery stats. Read data
 * is real (GET /api/campaigns?type=sms + /api/sms/numbers?action=current).
 * Creating an SMS blast is a heavy generative build (it needs an approved,
 * carrier-registered number and on-brand copy), so it drives the agent via
 * onAsk — never a legacy link. [[surface-buttons-are-ui-actions]]
 */

interface SmsCampaign {
  id: string;
  name: string;
  status: string;
  audience?: number;
  sent?: number;
  delivered?: number;
  failed?: number;
  clicked?: number;
  unsubscribed?: number;
  messageLength?: number;
  segments?: number;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt?: string;
}

// GET /api/campaigns/[id] → data.campaign (a deeper read than the list item).
interface SmsCampaignDetail extends SmsCampaign {
  content?: string | null;
  contactList?: { id: string; name: string; totalCount?: number; activeCount?: number } | null;
  contactListId?: string | null;
  updatedAt?: string;
}

interface SmsStats {
  total?: number;
  active?: number;
  sent?: number;
  draft?: number;
}

interface NumberStatus {
  hasNumber: boolean;
  phoneNumber?: string;
  enabled?: boolean;
  verified?: boolean;
  monthlyLimit?: number | null;
  sentThisMonth?: number | null;
}

// Per-status pill styling (mirrors the campaign state machine).
const STATUS_META: Record<string, { tone: string; icon: ElementType }> = {
  sent: { tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  active: { tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  sending: { tone: "bg-brand-500/10 text-brand-500", icon: Send },
  scheduled: { tone: "bg-brand-500/10 text-brand-500", icon: Clock },
  paused: { tone: "bg-amber-500/10 text-amber-500", icon: Clock },
  failed: { tone: "bg-rose-500/10 text-rose-500", icon: XCircle },
  draft: { tone: "bg-muted text-muted-foreground", icon: Clock },
};
const statusMeta = (s: string) => STATUS_META[s.toLowerCase()] ?? { tone: "bg-muted text-muted-foreground", icon: Clock };

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

function dateTimeLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

// A draft (or scheduled/failed/paused) blast can still be sent or deleted; once it's
// actively sending or already sent the send/delete routes reject it.
const SENDABLE = new Set(["draft", "scheduled", "paused", "failed"]);
const DELETABLE = new Set(["draft", "scheduled", "paused", "failed", "sending"]);

const NEW_BLAST_PROMPT =
  "Help me send an SMS blast. Ask me who to send it to and what offer or update I want to share, then write the message (with an opt-out line) and set it up. If my SMS number or compliance isn't ready yet, walk me through getting set up first.";

const SMS_SETUP_PROMPT =
  "Help me set up SMS sending — walk me through getting a verified sender number and confirming opt-in compliance so I can start sending blasts.";

export function FocusedSms({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [stats, setStats] = useState<SmsStats>({});
  const [number, setNumber] = useState<NumberStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline blast detail: id while loading, the detail object once fetched, null when closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SmsCampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Two-step inline confirms (no window.confirm) + the busy action per row.
  const [confirmSend, setConfirmSend] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cj, nj] = await Promise.all([
      fetch("/api/campaigns?type=sms&limit=30").then((r) => r.json()).catch(() => null),
      fetch("/api/sms/numbers?action=current").then((r) => r.json()).catch(() => null),
    ]);
    if (cj?.success && cj.data) {
      if (Array.isArray(cj.data.campaigns)) setCampaigns(cj.data.campaigns as SmsCampaign[]);
      if (cj.data.stats) setStats(cj.data.stats as SmsStats);
    }
    if (nj?.success && nj.data) {
      setNumber(nj.data as NumberStatus);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Toggle a blast's inline detail panel; fetch the deeper record on open.
  const openBlast = useCallback(async (c: SmsCampaign) => {
    setActionError(null);
    setConfirmSend(null);
    setConfirmDelete(null);
    if (openId === c.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(c.id); setDetail(null); setDetailLoading(true);
    try {
      const j = await fetch(`/api/campaigns/${c.id}`).then((r) => r.json());
      if (j?.success && j.data?.campaign) setDetail(j.data.campaign as SmsCampaignDetail);
    } catch { /* leave detail null → fallback message */ } finally {
      setDetailLoading(false);
    }
  }, [openId]);

  // Send a draft blast now (after inline confirm). Refresh list + detail on success.
  const sendBlast = useCallback(async (id: string) => {
    setBusyId(id); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      }).then((r) => r.json()).catch(() => null);
      if (j?.success) {
        setConfirmSend(null);
        await load();
        // Refresh the open detail so its stats/status reflect the send.
        if (openId === id) {
          const dj = await fetch(`/api/campaigns/${id}`).then((r) => r.json()).catch(() => null);
          if (dj?.success && dj.data?.campaign) setDetail(dj.data.campaign as SmsCampaignDetail);
        }
      } else {
        setActionError(j?.error?.message || "Could not send this blast.");
      }
    } catch {
      setActionError("Could not send this blast.");
    } finally {
      setBusyId(null);
    }
  }, [load, openId]);

  // Delete a blast (after inline confirm). Remove it from the list + close detail.
  const deleteBlast = useCallback(async (id: string) => {
    setBusyId(id); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
      if (j?.success) {
        setConfirmDelete(null);
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        if (openId === id) { setOpenId(null); setDetail(null); }
        await load();
      } else {
        setActionError(j?.error?.message || "Could not delete this blast.");
      }
    } catch {
      setActionError("Could not delete this blast.");
    } finally {
      setBusyId(null);
    }
  }, [load, openId]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your SMS…" /></div>;
  }

  const askNew = () => onAsk?.(NEW_BLAST_PROMPT);

  // Aggregate delivery across blasts for the KPI row.
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent ?? 0), 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered ?? 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  const hasNumber = !!number?.hasNumber;
  const monthlyLimit = number?.monthlyLimit ?? 0;
  const sentThisMonth = number?.sentThisMonth ?? 0;
  const usagePct = monthlyLimit > 0 ? Math.min(100, Math.round((sentThisMonth / monthlyLimit) * 100)) : 0;

  // Config gate: no verified sender number yet → show a clean setup landing,
  // not the blasts UI (you can't send without one). [[unprovisioned-feature-shows-cta]]
  if (!hasNumber) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-lg">
          <div className="rounded-2xl border border-border bg-card p-5 text-center sm:p-6">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Phone className="h-7 w-7" /></span>
            <h2 className="mt-3 text-[18px] font-extrabold">Set up SMS sending</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">To send SMS blasts you need a verified sender number. It takes a few steps:</p>
            <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left">
              <SetupStep n={1} title="Get a dedicated number" desc="A sender number your recipients will see." />
              <SetupStep n={2} title="Confirm opt-in compliance" desc="Show how your contacts consented to texts." />
              <SetupStep n={3} title="Carrier registration" desc="Required so your messages actually deliver." />
            </ol>
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-left">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Costs:</span> a monthly number rental plus a small per-message rate — both vary by country. Recipients must opt in before you text them.</p>
            </div>
            {onAsk && (
              <button onClick={() => onAsk(SMS_SETUP_PROMPT)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <Sparkles className="h-4 w-4" /> Set up SMS
              </button>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">The agent guides you through it — nothing sends until your number is verified.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* number / credit status hero */}
        <section className={cn(
          "rounded-2xl border p-5",
          hasNumber
            ? "border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent"
            : "border-border bg-card"
        )}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-violet-500/20 text-brand-500"><Phone className="h-6 w-6" /></span>
            {hasNumber ? (
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-muted-foreground">Your SMS number</p>
                <p className="text-[24px] font-extrabold leading-none">{number?.phoneNumber}</p>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="text-[15px] font-bold">No SMS number yet</p>
                <p className="text-[12.5px] text-muted-foreground">Get a verified number to start sending blasts.</p>
              </div>
            )}
            {hasNumber && (
              <span className={cn(
                "ms-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold",
                number?.verified ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-amber-500/30 bg-amber-500/10 text-amber-500"
              )}>
                {number?.verified ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {number?.verified ? "Verified" : "Verification pending"}
              </span>
            )}
          </div>

          {hasNumber && monthlyLimit > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Sent this month</span>
                <span className="tabular-nums text-foreground">{sentThisMonth.toLocaleString()} / {monthlyLimit.toLocaleString()}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(2, usagePct)}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4">
            <button onClick={askNew} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> {hasNumber ? "New SMS blast" : "Set up SMS"}
            </button>
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={MessageSquare} label="Blasts" value={(stats.total ?? campaigns.length).toLocaleString()} />
          <Kpi icon={Send} label="Sent" value={(stats.sent ?? 0).toLocaleString()} />
          <Kpi icon={Users} label="Messages delivered" value={totalDelivered.toLocaleString()} />
          <Kpi icon={CheckCircle2} label="Delivery rate" value={`${deliveryRate}%`} />
        </div>

        {/* campaigns */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">SMS blasts</h3>
            <button onClick={askNew} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> New blast
            </button>
          </div>

          {campaigns.length ? (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const m = statusMeta(c.status);
                const status = c.status.toLowerCase();
                const isOpen = openId === c.id;
                const sent = c.sent ?? 0;
                const delivered = c.delivered ?? 0;
                const rate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
                const when = whenLabel(c.sentAt) || (c.scheduledAt ? `scheduled ${whenLabel(c.scheduledAt)}` : whenLabel(c.createdAt));
                const busy = busyId === c.id;
                const canSend = hasNumber && SENDABLE.has(status);
                const canDelete = DELETABLE.has(status);
                return (
                  <div key={c.id} className={cn("rounded-xl border bg-muted/30 transition", isOpen ? "border-brand-500/40" : "border-border")}>
                    <button onClick={() => openBlast(c)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left">
                      <span className="truncate text-[13px] font-semibold">{c.name}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", m.tone)}>
                        <m.icon className="h-3 w-3" /> {status}
                      </span>
                      {when && <span className="text-[11.5px] text-muted-foreground">{when}</span>}
                      <span className="ms-auto text-[12px] text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">{(c.audience ?? 0).toLocaleString()}</span> recipients
                      </span>
                      <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", isOpen && "rotate-90")} />
                    </button>
                    {sent > 0 && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-3 py-2 text-[11.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> {sent.toLocaleString()} sent</span>
                        <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> {delivered.toLocaleString()} delivered <span className="text-muted-foreground">({rate}%)</span></span>
                        {!!c.failed && <span className="inline-flex items-center gap-1 text-rose-500"><XCircle className="h-3 w-3" /> {c.failed.toLocaleString()} failed</span>}
                        {!!c.clicked && <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {c.clicked.toLocaleString()} clicked</span>}
                        {!!c.unsubscribed && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {c.unsubscribed.toLocaleString()} opted out</span>}
                        {!!c.segments && <span>{c.segments} segment{c.segments > 1 ? "s" : ""}</span>}
                      </div>
                    )}

                    {/* inline detail panel */}
                    {isOpen && (
                      <div className="border-t border-border/60 px-3 py-3">
                        {detailLoading ? (
                          <div className="grid place-items-center py-6"><FlowLoader size={22} label="Loading blast…" /></div>
                        ) : detail && detail.id === c.id ? (
                          <BlastDetail detail={detail} senderNumber={number?.phoneNumber} />
                        ) : (
                          <p className="py-3 text-center text-[12.5px] text-muted-foreground">Could not load this blast.</p>
                        )}

                        {actionError && busyId === null && (confirmSend === c.id || confirmDelete === c.id || !canSend) === false && (
                          // (handled below near the action buttons)
                          null
                        )}

                        {/* management actions — never the agent; these are CRUD */}
                        {(canSend || canDelete) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                            {canSend && (
                              confirmSend === c.id ? (
                                <span className="inline-flex items-center gap-2 rounded-[10px] border border-brand-500/40 bg-brand-500/5 px-2 py-1">
                                  <span className="text-[11.5px] font-medium">Send to {(detail?.contactList?.activeCount ?? detail?.contactList?.totalCount ?? c.audience ?? 0).toLocaleString()} now?</span>
                                  <button
                                    onClick={() => sendBlast(c.id)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60"
                                  >
                                    {busy ? <FlowLoader size={13} /> : <Send className="h-3 w-3" />} Confirm
                                  </button>
                                  <button onClick={() => setConfirmSend(null)} disabled={busy} className="rounded-[8px] px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setConfirmDelete(null); setActionError(null); setConfirmSend(c.id); }}
                                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"
                                >
                                  <Send className="h-3.5 w-3.5" /> Send now
                                </button>
                              )
                            )}

                            {canDelete && (
                              confirmDelete === c.id ? (
                                <span className="inline-flex items-center gap-2 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-2 py-1">
                                  <span className="text-[11.5px] font-medium">Delete this blast?</span>
                                  <button
                                    onClick={() => deleteBlast(c.id)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60"
                                  >
                                    {busy ? <FlowLoader size={13} /> : <Trash2 className="h-3 w-3" />} Confirm
                                  </button>
                                  <button onClick={() => setConfirmDelete(null)} disabled={busy} className="rounded-[8px] px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setConfirmSend(null); setActionError(null); setConfirmDelete(c.id); }}
                                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-rose-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                              )
                            )}

                            {onAsk && (status === "draft" || status === "scheduled") && (
                              <button
                                onClick={() => onAsk(`Help me edit my SMS blast "${c.name}" — let me change the message copy, audience, or schedule, then save it.`)}
                                className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                <PenLine className="h-3.5 w-3.5" /> Edit with agent
                              </button>
                            )}
                          </div>
                        )}

                        {actionError && (openId === c.id) && (
                          <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] text-rose-500"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {actionError}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><MessageSquare className="h-6 w-6" /></span>
              <p className="mt-3 text-[13px] font-medium">No SMS blasts yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{hasNumber ? "Send your first blast — tell the agent who to reach and what to say." : "Set up a verified SMS number, then send your first blast."}</p>
              <button onClick={askNew} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <Sparkles className="h-4 w-4" /> {hasNumber ? "Create a blast" : "Set up SMS"}
              </button>
            </div>
          )}
        </section>

        {/* compliance hint — SMS sending is gated on carrier approval; no legacy link */}
        {hasNumber && !number?.verified && (
          <section className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500"><AlertTriangle className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">Carrier verification in progress</p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">Your number is registered and pending carrier approval. Sending unlocks once it&apos;s verified — the agent will let you know.</p>
            </div>
          </section>
        )}

        <p className="flex items-center justify-center gap-1.5 pb-1 text-center text-[11.5px] text-muted-foreground">
          <ExternalLink className="h-3 w-3" /> SMS rates and carrier rules vary by country. Recipients must opt in.
        </p>
      </div>
    </div>
  );
}

// The inline blast detail: message preview (phone bubble), performance breakdown,
// timeline, and audience — a deeper read than the list row.
function BlastDetail({ detail, senderNumber }: { detail: SmsCampaignDetail; senderNumber?: string }) {
  const sent = detail.sent ?? 0;
  const delivered = detail.delivered ?? 0;
  const failed = detail.failed ?? 0;
  const clicked = detail.clicked ?? 0;
  const unsub = detail.unsubscribed ?? 0;
  const deliveredRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
  const audience = detail.contactList?.activeCount ?? detail.contactList?.totalCount ?? detail.audience ?? 0;
  return (
    <div className="space-y-3">
      {/* message preview */}
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Message{senderNumber ? ` · from ${senderNumber}` : ""}
        </div>
        {detail.content ? (
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-brand-500/10 px-3 py-2 text-[12.5px] leading-relaxed text-foreground">{detail.content}</div>
        ) : (
          <p className="text-[12px] italic text-muted-foreground">No message content saved.</p>
        )}
        {typeof detail.messageLength === "number" && detail.messageLength > 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">{detail.messageLength} chars{detail.segments ? ` · ${detail.segments} segment${detail.segments > 1 ? "s" : ""}` : ""}</p>
        )}
      </div>

      {/* performance (only once it's been sent) */}
      {sent > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DetailStat icon={Send} label="Sent" value={sent.toLocaleString()} />
          <DetailStat icon={CheckCircle2} label="Delivered" value={`${delivered.toLocaleString()} · ${deliveredRate}%`} tone="text-emerald-500" />
          <DetailStat icon={MousePointerClick} label="Clicked" value={`${clicked.toLocaleString()} · ${clickRate}%`} />
          <DetailStat icon={XCircle} label="Failed" value={failed.toLocaleString()} tone={failed > 0 ? "text-rose-500" : undefined} />
        </div>
      )}

      {/* audience + timeline */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {detail.contactList?.name ? `${detail.contactList.name} · ` : ""}{audience.toLocaleString()} recipients</span>
        {unsub > 0 && <span className="inline-flex items-center gap-1.5">{unsub.toLocaleString()} opted out</span>}
        {detail.scheduledAt && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Scheduled {dateTimeLabel(detail.scheduledAt)}</span>}
        {detail.sentAt && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Sent {dateTimeLabel(detail.sentAt)}</span>}
        {!detail.sentAt && detail.createdAt && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Created {dateTimeLabel(detail.createdAt)}</span>}
      </div>
    </div>
  );
}

function DetailStat({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className={cn("flex items-center gap-1 text-muted-foreground", tone)}><Icon className="h-3 w-3" /><span className="text-[10.5px] font-medium uppercase tracking-wide">{label}</span></div>
      <p className={cn("mt-0.5 text-[14px] font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function SetupStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/12 text-[11px] font-bold text-brand-500">{n}</span>
      <span>
        <span className="block text-[12.5px] font-semibold">{title}</span>
        <span className="block text-[11.5px] text-muted-foreground">{desc}</span>
      </span>
    </li>
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
