"use client";

import { CheckCircle2, XCircle, Clock, X, RefreshCw, PartyPopper, Megaphone } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * PublishModal — the staged "publishing to N channels" overlay the composer
 * opens on Post now. Each connected destination shows a live status
 * (Queued → Publishing… → Published / Pending / Failed) streamed from
 * /api/content/posts/stream, then a final summary the user can dismiss.
 * The same stream also narrates in the agent panel. [[surface-buttons-are-ui-actions]]
 */

export type ChanState = "queued" | "publishing" | "ok" | "pending" | "fail";
export interface ChanRow {
  id: string;
  label: string;
  username?: string | null;
  state: ChanState;
  stage?: string;
  error?: string;
}

export function PublishModal({
  open,
  phase,
  rows,
  title,
  subtitle,
  onDismiss,
  onRetry,
  retrying,
}: {
  open: boolean;
  phase: "running" | "done";
  rows: ChanRow[];
  title: string;
  subtitle: string;
  onDismiss: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (!open) return null;

  const total = rows.length;
  const settled = rows.filter((r) => r.state === "ok" || r.state === "fail" || r.state === "pending").length;
  const ok = rows.filter((r) => r.state === "ok").length;
  const failed = rows.filter((r) => r.state === "fail").length;
  const pending = rows.filter((r) => r.state === "pending").length;
  const pct = total ? Math.round((settled / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && phase === "done") onDismiss(); }}
    >
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center">
            {phase === "running" ? (
              <FlowLoader size={30} withMark />
            ) : failed || pending ? (
              <Megaphone className="h-6 w-6 text-amber-500" />
            ) : (
              <PartyPopper className="h-6 w-6 text-emerald-500" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">{title}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={phase === "running" ? "Hide — publishing keeps going" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* progress */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        {/* per-channel rows */}
        <div className="max-h-[340px] overflow-y-auto p-2 sm:p-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-start gap-3 rounded-xl px-2.5 py-2.5",
                r.state === "fail" && "bg-rose-500/5",
                r.state === "ok" && "bg-emerald-500/5",
                r.state === "pending" && "bg-amber-500/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{r.label}</p>
                {r.username && <p className="truncate text-[11px] text-muted-foreground">@{r.username}</p>}
                {r.error && (r.state === "fail" || r.state === "pending") && (
                  <p className={cn("mt-0.5 text-[11px] leading-snug", r.state === "pending" ? "text-amber-600" : "text-rose-500")}>{r.error}</p>
                )}
              </div>
              <StatusPill r={r} />
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="flex items-center gap-3 border-t border-border p-3 sm:p-4">
          {phase === "running" ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <FlowLoader size={14} />
              <span>Publishing… {settled}/{total} done</span>
            </div>
          ) : (
            <>
              <span className="text-[12.5px] font-medium">
                <b>{ok}</b>/{total} published
                {failed > 0 && <> · <span className="text-rose-500">{failed} failed</span></>}
                {pending > 0 && <> · <span className="text-amber-600">{pending} pending</span></>}
              </span>
              <span className="flex-1" />
              {failed > 0 && onRetry && (
                <button
                  onClick={onRetry}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-3 py-1.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-60"
                >
                  {retrying ? <FlowLoader size={13} /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Retry {failed}
                </button>
              )}
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-[12px] font-semibold text-white"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ r }: { r: ChanRow }) {
  if (r.state === "queued")
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Queued
      </span>
    );
  if (r.state === "publishing")
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-violet-500">
        <FlowLoader size={14} />{r.stage || "Publishing…"}
      </span>
    );
  if (r.state === "ok")
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-emerald-500">
        <CheckCircle2 className="h-4 w-4" />Published
      </span>
    );
  if (r.state === "pending")
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-amber-600">
        <Clock className="h-4 w-4" />Pending
      </span>
    );
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-rose-500">
      <XCircle className="h-4 w-4" />Failed
    </span>
  );
}
