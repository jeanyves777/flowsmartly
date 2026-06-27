"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import {
  FileText,
  Sparkles,
  Plus,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  Target,
  Mail,
  ExternalLink,
  ChevronDown,
  Presentation,
  Trophy,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Pitch board — a deep new-design surface (the Pitch workspace canvas): the
 * user's sales proposals & outreach pitches with status + target, plus KPIs.
 * Real data (GET /api/pitch → j.data.pitches + j.data.stats). Opening a pitch
 * expands its detail INLINE here (GET /api/pitch/[id]) — a click does-it-in-the-UI,
 * never a legacy route. Creating a NEW proposal is a heavy generative build, so
 * that one button drives the agent via onAsk. No legacy links.
 * [[surface-buttons-are-ui-actions]]
 */

type PitchStatus = "PENDING" | "RESEARCHING" | "READY" | "SENT" | "FAILED";

interface Pitch {
  id: string;
  businessName: string;
  businessUrl?: string | null;
  status?: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  sentAt?: string | null;
  errorMessage?: string | null;
  documentType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Stats {
  total?: number;
  pending?: number;
  ready?: number;
  sent?: number;
  failed?: number;
  proposals?: number;
}

// Detail (parsed pitchContent) — defensively typed; only the bits we surface.
interface PitchDetail {
  id: string;
  businessName?: string;
  status?: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  pitchContent?: {
    title?: string;
    subtitle?: string;
    executiveSummary?: string;
    documentType?: string;
  };
}

const STATUS_META: Record<PitchStatus, { label: string; icon: ElementType; cls: string; spin?: boolean }> = {
  PENDING: { label: "Queued", icon: Clock, cls: "bg-muted text-muted-foreground" },
  RESEARCHING: { label: "Researching", icon: Clock, cls: "bg-brand-500/10 text-brand-500", spin: true },
  READY: { label: "Ready", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-500" },
  SENT: { label: "Sent", icon: Send, cls: "bg-violet-500/10 text-violet-500" },
  FAILED: { label: "Failed", icon: AlertCircle, cls: "bg-rose-500/10 text-rose-500" },
};
const statusMeta = (s?: string) => STATUS_META[(s || "PENDING").toUpperCase() as PitchStatus] ?? STATUS_META.PENDING;

function whenLabel(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; }
}

const NEW_PROPOSAL_PROMPT =
  "Help me draft a proposal for a client — ask me who the client is, what service I'm pitching, the goals, and the price, then generate it.";

export function FocusedPitch({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);

  // Inline "open": which pitch is expanded, its loaded detail, and load state.
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PitchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/pitch?limit=30").then((r) => r.json());
      if (j?.success && j.data) {
        if (Array.isArray(j.data.pitches)) setPitches(j.data.pitches);
        if (j.data.stats) setStats(j.data.stats);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const open = useCallback(async (p: Pitch) => {
    if (openId === p.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(p.id); setDetail(null); setDetailLoading(true);
    try {
      const j = await fetch(`/api/pitch/${p.id}`).then((r) => r.json());
      if (j?.success && j.data?.pitch) setDetail(j.data.pitch as PitchDetail);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }, [openId]);

  const startNew = () => onAsk?.(NEW_PROPOSAL_PROMPT);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your pitch board…" /></div>;
  }

  const total = stats.total ?? pitches.length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* header */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold">Pitch board</h2>
              <p className="truncate text-[12px] text-muted-foreground">Your sales proposals & outreach pitches</p>
            </div>
            {onAsk && (
              <button onClick={startNew} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Plus className="h-3.5 w-3.5" /> New proposal
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={FileText} label="Total" value={total.toLocaleString()} />
            <Kpi icon={Presentation} label="Proposals" value={(stats.proposals ?? 0).toLocaleString()} />
            <Kpi icon={CheckCircle2} label="Ready" value={(stats.ready ?? 0).toLocaleString()} />
            <Kpi icon={Send} label="Sent" value={(stats.sent ?? 0).toLocaleString()} />
          </div>
        </section>

        {/* list */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Your pitches</h3>
            {(stats.pending ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500"><Clock className="h-3 w-3" /> {stats.pending} in progress</span>
            )}
            {onAsk && (
              <button onClick={startNew} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" /> New proposal
              </button>
            )}
          </div>

          {pitches.length ? (
            <div className="space-y-2">
              {pitches.map((p) => {
                const m = statusMeta(p.status);
                const isProposal = p.documentType === "service_proposal";
                const isOpen = openId === p.id;
                return (
                  <div key={p.id} className={cn("rounded-xl border bg-muted/30 transition", isOpen ? "border-brand-500/40" : "border-border")}>
                    <button onClick={() => open(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", isProposal ? "bg-violet-500/10 text-violet-500" : "bg-brand-500/10 text-brand-500")}>
                        {isProposal ? <Presentation className="h-[18px] w-[18px]" /> : <FileText className="h-[18px] w-[18px]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{p.businessName || "Untitled pitch"}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {[isProposal ? "Proposal" : "Pitch", p.recipientName || p.recipientEmail, whenLabel(p.createdAt)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", m.cls)}>
                        {m.spin ? <FlowLoader size={11} /> : <m.icon className="h-3 w-3" />} {m.label}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", isOpen && "rotate-180")} />
                    </button>

                    {/* inline detail — opening a pitch expands it here, no navigation */}
                    {isOpen && (
                      <div className="border-t border-border/70 px-3 py-3">
                        {detailLoading ? (
                          <div className="py-3"><FlowLoader size={18} label="Opening pitch…" /></div>
                        ) : (
                          <PitchDetailView pitch={p} detail={detail} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Trophy className="h-7 w-7" /></span>
              <p className="mt-3 text-[14px] font-semibold">No pitches yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">Win more deals — let the agent research a prospect and draft a tailored proposal for you.</p>
              {onAsk && (
                <button onClick={startNew} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Draft my first proposal
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PitchDetailView({ pitch, detail }: { pitch: Pitch; detail: PitchDetail | null }) {
  const content = detail?.pitchContent;
  const title = content?.title?.trim();
  const subtitle = content?.subtitle?.trim();
  const summary = content?.executiveSummary?.trim();
  const recipient = detail?.recipientName || pitch.recipientName;
  const email = detail?.recipientEmail || pitch.recipientEmail;
  const status = (detail?.status || pitch.status || "").toUpperCase();
  const failed = status === "FAILED";
  const inProgress = status === "PENDING" || status === "RESEARCHING";

  return (
    <div className="space-y-2.5">
      {title && <p className="text-[13.5px] font-bold leading-snug">{title}</p>}
      {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}

      {failed && pitch.errorMessage ? (
        <p className="rounded-lg bg-rose-500/5 px-2.5 py-2 text-[12px] text-rose-500">{pitch.errorMessage}</p>
      ) : inProgress ? (
        <p className="text-[12.5px] text-muted-foreground">The agent is still researching and drafting this — it will be ready shortly.</p>
      ) : summary ? (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{summary}</p>
      ) : !title ? (
        <p className="text-[12.5px] text-muted-foreground">This pitch is ready. Ask the agent in the chat to refine, send, or export it.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> {pitch.businessName || "Target"}</span>
        {(recipient || email) && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {recipient || email}</span>}
        {pitch.businessUrl && (
          <a
            href={/^https?:\/\//i.test(pitch.businessUrl) ? pitch.businessUrl : `https://${pitch.businessUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-brand-500 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Visit site
          </a>
        )}
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
