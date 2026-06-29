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
  Trash2,
  Download,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Pitch board — a deep new-design surface (the Pitch workspace canvas): the
 * user's sales proposals & outreach pitches with status + target, plus KPIs.
 * Real data (GET /api/pitch → j.data.pitches + j.data.stats). Opening a pitch
 * expands its detail INLINE here (GET /api/pitch/[id]) — a click does-it-in-the-UI,
 * never a legacy route. From the inline detail the user can edit the copy
 * (PATCH /api/pitch/[id], mirroring the leads-workspace editor), email it
 * (POST /api/pitch/[id]/send), download the PDF (POST {pdfOnly:true}), and
 * delete it (DELETE /api/pitch/[id], inline confirm). Creating a NEW proposal is
 * a heavy generative build, so that one button drives the agent via onAsk.
 * No legacy links. [[surface-buttons-are-ui-actions]]
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
  pitchContent?: Record<string, unknown> & {
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

// The human-editable copy on a pitch (PitchContent) and proposal
// (ServiceProposalContent) — only the fields actually present on a given
// document render. `kind: "list"` fields are string[] edited one-per-line.
// Everything else in the content object (design, arrays of objects, brand
// snapshot…) is preserved untouched on save.
const EDIT_FIELDS: { key: string; label: string; kind: "short" | "long" | "list" }[] = [
  { key: "subject", label: "Subject", kind: "short" },
  { key: "title", label: "Title", kind: "short" },
  { key: "subtitle", label: "Subtitle", kind: "short" },
  { key: "headline", label: "Headline", kind: "long" },
  { key: "personalizedHook", label: "Opening hook", kind: "long" },
  { key: "executiveSummary", label: "Executive summary", kind: "long" },
  { key: "clientNeed", label: "Client need", kind: "long" },
  { key: "aboutBrand", label: "About us", kind: "long" },
  { key: "opportunityParagraph", label: "The opportunity", kind: "long" },
  { key: "keyFindings", label: "Key findings (one per line)", kind: "list" },
  { key: "solutionBullets", label: "Solution bullets (one per line)", kind: "list" },
  { key: "impactParagraph", label: "Impact", kind: "long" },
  { key: "ctaText", label: "Call to action", kind: "short" },
  { key: "closingLine", label: "Closing line", kind: "long" },
];

const NEW_PROPOSAL_PROMPT =
  "Help me draft a proposal for a client — ask me who the client is, what service I'm pitching, the goals, and the price, then generate it.";

export function FocusedPitch({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [docFilter, setDocFilter] = useState<"all" | "pitch" | "service_proposal">("all");

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

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const j = await fetch(`/api/pitch/${id}`).then((r) => r.json());
      if (j?.success && j.data?.pitch) setDetail(j.data.pitch as PitchDetail);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }, []);

  const open = useCallback(async (p: Pitch) => {
    if (openId === p.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(p.id); setDetail(null);
    await loadDetail(p.id);
  }, [openId, loadDetail]);

  // After an edit, refresh both the list (status/recipient may change) and the
  // open detail so the inline view reflects the saved document immediately.
  const onChanged = useCallback(async (id: string) => {
    await Promise.all([load(), openId === id ? loadDetail(id) : Promise.resolve()]);
  }, [load, loadDetail, openId]);

  // After a delete, collapse the row and drop it from the list locally.
  const onDeleted = useCallback((id: string) => {
    setPitches((ps) => ps.filter((x) => x.id !== id));
    if (openId === id) { setOpenId(null); setDetail(null); }
    load();
  }, [load, openId]);

  const startNew = () => onAsk?.(NEW_PROPOSAL_PROMPT);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your pitch board…" /></div>;
  }

  const total = stats.total ?? pitches.length;
  const shown = pitches.filter((p) => docFilter === "all" || (p.documentType || "pitch") === docFilter);

  // Status-filter strip → vertical nav in the left rail. Counts come from stats
  // (proposals) / the loaded list (pitches), so the menu reflects real numbers.
  const proposalsCount = stats.proposals ?? pitches.filter((p) => p.documentType === "service_proposal").length;
  const pitchesCount = Math.max(0, total - proposalsCount);
  const nav: { id: "all" | "pitch" | "service_proposal"; label: string; icon: ElementType; count: number }[] = [
    { id: "all", label: "All documents", icon: FileText, count: total },
    { id: "pitch", label: "Pitches", icon: FileText, count: pitchesCount },
    { id: "service_proposal", label: "Proposals", icon: Presentation, count: proposalsCount },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + section nav + primary action */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          {onAsk && (
            <button
              onClick={startNew}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
            >
              <Plus className="h-4 w-4" /> New proposal
            </button>
          )}

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start gap-2.5 px-1 pb-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-bold">Pitch board</h2>
                <p className="truncate text-[11px] text-muted-foreground">Proposals & outreach pitches</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <StatRow icon={CheckCircle2} label="Ready" value={(stats.ready ?? 0).toLocaleString()} />
              <StatRow icon={Send} label="Sent" value={(stats.sent ?? 0).toLocaleString()} sub={(stats.pending ?? 0) > 0 ? `${stats.pending} in progress` : undefined} />
            </div>
          </div>

          {/* section nav (was the status-filter strip) */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {nav.map((n) => {
              const active = docFilter === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setDocFilter(n.id)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{n.label}</span>
                  {n.count > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n.count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT: the pitch/proposal list, full width */}
        <div className="min-w-0 flex-1 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-bold">{nav.find((n) => n.id === docFilter)?.label ?? "Your pitches"}</h3>
              {(stats.pending ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500"><Clock className="h-3 w-3" /> {stats.pending} in progress</span>
              )}
              {onAsk && (
                <button onClick={startNew} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-brand-500" /> New proposal
                </button>
              )}
            </div>

            {shown.length ? (
              <div className="space-y-2">
                {shown.map((p) => {
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
                            <PitchDetailView
                              pitch={p}
                              detail={detail}
                              onChanged={() => onChanged(p.id)}
                              onDeleted={() => onDeleted(p.id)}
                            />
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
    </div>
  );
}

function PitchDetailView({
  pitch,
  detail,
  onChanged,
  onDeleted,
}: {
  pitch: Pitch;
  detail: PitchDetail | null;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const content = detail?.pitchContent;
  const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = asStr(content?.title) || asStr(content?.headline);
  const subtitle = asStr(content?.subtitle);
  const summary = asStr(content?.executiveSummary) || asStr(content?.personalizedHook);
  const recipient = detail?.recipientName || pitch.recipientName;
  const email = detail?.recipientEmail || pitch.recipientEmail;
  const status = (detail?.status || pitch.status || "").toUpperCase();
  const failed = status === "FAILED";
  const inProgress = status === "PENDING" || status === "RESEARCHING";
  const sendable = status === "READY" || status === "SENT";

  // Which panel is open in the detail: send / edit / delete-confirm.
  const [panel, setPanel] = useState<"none" | "send" | "edit">("none");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState<null | "send" | "pdf" | "save" | "delete">(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Send form
  const [toEmail, setToEmail] = useState(email || "");
  const [toName, setToName] = useState(recipient || "");
  const [msg, setMsg] = useState("");

  // Edit form — mirrors the leads-workspace in-place editor (EDIT_FIELDS).
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editRaw, setEditRaw] = useState<Record<string, unknown>>({});
  const [editName, setEditName] = useState(recipient || "");
  const [editEmail, setEditEmail] = useState(email || "");

  const closePanels = () => { setPanel("none"); setConfirmDel(false); };

  const openSend = () => {
    setNote(null); setConfirmDel(false);
    setToEmail(email || ""); setToName(recipient || ""); setMsg("");
    setPanel((p) => (p === "send" ? "none" : "send"));
  };

  const openEdit = () => {
    setNote(null); setConfirmDel(false);
    if (panel === "edit") { setPanel("none"); return; }
    const raw = (content && typeof content === "object" && !Array.isArray(content)) ? (content as Record<string, unknown>) : {};
    setEditRaw(raw);
    setEditName(recipient || ""); setEditEmail(email || "");
    const fields: Record<string, string> = {};
    for (const f of EDIT_FIELDS) {
      const v = raw[f.key];
      if (f.kind === "list") {
        if (Array.isArray(v)) fields[f.key] = v.filter((x) => typeof x === "string").join("\n");
      } else if (typeof v === "string") {
        fields[f.key] = v;
      }
    }
    setEditFields(fields);
    setPanel("edit");
  };

  const send = async () => {
    if (!toEmail.trim() || busy) return;
    setBusy("send"); setNote(null);
    try {
      const j = await fetch(`/api/pitch/${pitch.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: toEmail.trim(), recipientName: toName.trim() || undefined, message: msg.trim() || undefined }),
      }).then((r) => r.json());
      if (j?.success) { setNote({ kind: "ok", text: `Sent to ${j.data?.sentTo || toEmail.trim()}.` }); setPanel("none"); onChanged(); }
      else setNote({ kind: "err", text: j?.error?.message || "Could not send." });
    } catch { setNote({ kind: "err", text: "Could not send." }); } finally { setBusy(null); }
  };

  const downloadPdf = async () => {
    if (busy) return;
    setBusy("pdf"); setNote(null);
    try {
      const res = await fetch(`/api/pitch/${pitch.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfOnly: true }),
      });
      if (!res.ok) {
        let m = "Could not generate the PDF.";
        try { const j = await res.json(); m = j?.error?.message || m; } catch { /* binary or empty */ }
        setNote({ kind: "err", text: m });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(pitch.businessName || "proposal").replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setNote({ kind: "err", text: "Could not download the PDF." }); } finally { setBusy(null); }
  };

  const saveEdit = async () => {
    if (busy) return;
    setBusy("save"); setNote(null);
    try {
      // Re-serialize list fields back to string[]; preserve everything else.
      const merged: Record<string, unknown> = { ...editRaw };
      for (const f of EDIT_FIELDS) {
        if (!(f.key in editFields)) continue;
        if (f.kind === "list") {
          merged[f.key] = editFields[f.key].split("\n").map((s) => s.trim()).filter(Boolean);
        } else {
          merged[f.key] = editFields[f.key];
        }
      }
      const j = await fetch(`/api/pitch/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: editName.trim() || null, recipientEmail: editEmail.trim() || null, pitchContent: merged }),
      }).then((r) => r.json());
      if (j?.success) { setNote({ kind: "ok", text: "Changes saved." }); setPanel("none"); onChanged(); }
      else setNote({ kind: "err", text: j?.error?.message || "Could not save." });
    } catch { setNote({ kind: "err", text: "Could not save." }); } finally { setBusy(null); }
  };

  const del = async () => {
    if (busy) return;
    setBusy("delete"); setNote(null);
    try {
      const j = await fetch(`/api/pitch/${pitch.id}`, { method: "DELETE" }).then((r) => r.json());
      if (j?.success) { onDeleted(); return; }
      setNote({ kind: "err", text: j?.error?.message || "Could not delete." });
      setConfirmDel(false);
    } catch { setNote({ kind: "err", text: "Could not delete." }); setConfirmDel(false); } finally { setBusy(null); }
  };

  const editableFields = EDIT_FIELDS.filter((f) => f.key in editFields);

  return (
    <div className="space-y-3">
      {title && <p className="text-[13.5px] font-bold leading-snug">{title}</p>}
      {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}

      {failed && pitch.errorMessage ? (
        <p className="rounded-lg bg-rose-500/5 px-2.5 py-2 text-[12px] text-rose-500">{pitch.errorMessage}</p>
      ) : inProgress ? (
        <p className="text-[12.5px] text-muted-foreground">The agent is still researching and drafting this — it will be ready shortly.</p>
      ) : summary ? (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{summary}</p>
      ) : !title ? (
        <p className="text-[12.5px] text-muted-foreground">This pitch is ready. Use the actions below to edit, email, or export it.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
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

      {/* actions — only once the document is built (READY/SENT). Edit/Delete are
          always available so a failed/in-progress doc can still be removed. */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {sendable && (
          <button onClick={openSend} className={cn("inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm", panel === "send" && "opacity-90 ring-2 ring-brand-500/30")}>
            <Send className="h-3.5 w-3.5" /> {status === "SENT" ? "Send again" : "Send"}
          </button>
        )}
        {sendable && (
          <button onClick={downloadPdf} disabled={busy === "pdf"} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
            {busy === "pdf" ? <FlowLoader size={14} /> : <Download className="h-3.5 w-3.5" />} PDF
          </button>
        )}
        <button onClick={openEdit} className={cn("inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground", panel === "edit" && "border-brand-500/60 text-foreground")}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        {confirmDel ? (
          <span className="inline-flex items-center gap-1.5">
            <button onClick={del} disabled={busy === "delete"} className="inline-flex items-center gap-1.5 rounded-[9px] bg-rose-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
              {busy === "delete" ? <FlowLoader size={14} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm delete
            </button>
            <button onClick={() => setConfirmDel(false)} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
          </span>
        ) : (
          <button onClick={() => { closePanels(); setConfirmDel(true); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:border-rose-500/50 hover:text-rose-500">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>

      {note && (
        <p className={cn("rounded-lg px-2.5 py-2 text-[12px]", note.kind === "ok" ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/5 text-rose-500")}>{note.text}</p>
      )}

      {/* send form */}
      {panel === "send" && sendable && (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Recipient email</label>
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} type="email" placeholder="recipient@email.com" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Recipient name</label>
              <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Optional" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
            </div>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Personal message (optional)</label>
            <textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="A short note to include at the top of the email" className="w-full resize-none rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <button onClick={send} disabled={busy === "send" || !toEmail.trim()} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
              {busy === "send" ? <FlowLoader size={14} tone="white" /> : <Send className="h-3.5 w-3.5" />} Send now
            </button>
            <button onClick={() => setPanel("none")} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
          <p className="mt-1.5 text-[10.5px] text-muted-foreground">The branded PDF is attached automatically. Sending marks this {pitch.documentType === "service_proposal" ? "proposal" : "pitch"} as Sent.</p>
        </div>
      )}

      {/* edit form — in-place copy editor, mirroring leads-workspace */}
      {panel === "edit" && (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Recipient name" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
            <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="recipient@email.com" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
          </div>
          {editableFields.length ? editableFields.map((f) => (
            <div key={f.key} className="mt-2">
              <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</label>
              {f.kind === "short" ? (
                <input value={editFields[f.key]} onChange={(e) => setEditFields((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
              ) : (
                <textarea rows={f.kind === "list" ? 3 : 2} value={editFields[f.key]} onChange={(e) => setEditFields((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full resize-none rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />
              )}
            </div>
          )) : (
            <p className="mt-2 text-[11.5px] text-muted-foreground">This document has no editable text fields yet — it may still be generating.</p>
          )}
          <div className="mt-2.5 flex items-center gap-1.5">
            <button onClick={saveEdit} disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
              {busy === "save" ? <FlowLoader size={14} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save changes
            </button>
            <button onClick={() => setPanel("none")} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
          <p className="mt-1.5 text-[10.5px] text-muted-foreground">Saved changes update the document — then send it to deliver the refreshed version.</p>
        </div>
      )}
    </div>
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
