"use client";

import { useState } from "react";
import { Sparkles, Check, RotateCcw } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * BriefSuggest — the "Suggest ideas" AI helper that sits at the top of a brief
 * modal (Campaign brief, Lead Studio Search brief, …). Click it and the agent
 * reads the user's Brand Kit and proposes 2-3 ready-to-use briefs; pick one and
 * it fills the form so the user just continues. [[agent-writes-into-ui-element-not-chat]]
 */

export type BriefProposal = Record<string, unknown> & { title?: string; summary?: string };

export function BriefSuggest({ kind, context, onApply }: {
  kind: "campaign" | "leads" | "proposal";
  context?: string;
  onApply: (p: BriefProposal) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<BriefProposal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setAppliedIdx(null);
    try {
      const j = await fetch("/api/ai/brief-suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, context }) }).then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.proposals) && j.data.proposals.length) setProposals(j.data.proposals);
      else setErr(j?.error?.message || "Couldn't come up with ideas.");
    } catch { setErr("Couldn't reach the agent."); } finally { setLoading(false); }
  };

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const preview = (p: BriefProposal) => kind === "leads"
    ? [str(p.industry), str(p.jobTitle)].filter(Boolean).join(" · ")
    : kind === "proposal"
      ? str(p.brief)
      : [str(p.name), str(p.tone)].filter(Boolean).join(" · ");
  const whatText = kind === "leads" ? "who to target" : kind === "proposal" ? "who to pitch + what to offer" : "campaign ideas";

  return (
    <div className="rounded-[12px] border border-brand-500/30 bg-gradient-to-br from-brand-500/[0.07] to-violet-500/[0.05] p-3">
      {!proposals ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-500"><Sparkles className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold">Not sure where to start?</p>
            <p className="text-[11.5px] text-muted-foreground">Let the agent suggest {whatText} from your brand — pick one and it fills the form.</p>
          </div>
          <button onClick={run} disabled={loading} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">
            {loading ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} {loading ? "Thinking…" : "Suggest ideas"}
          </button>
          {err && <p className="w-full text-[11.5px] text-rose-500">{err}</p>}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            <p className="text-[12px] font-bold">Pick an idea — the agent fills the rest</p>
            <button onClick={run} disabled={loading} className="ms-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">{loading ? <FlowLoader size={12} /> : <RotateCcw className="h-3 w-3" />} More ideas</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {proposals.map((p, i) => (
              <button key={i} onClick={() => { onApply(p); setAppliedIdx(i); }} className={cn("group rounded-[10px] border p-2.5 text-left transition", appliedIdx === i ? "border-brand-500 bg-brand-500/10" : "border-border bg-card hover:border-brand-500/50")}>
                <div className="flex items-center gap-1.5"><span className="line-clamp-1 text-[12.5px] font-bold">{str(p.title)}</span>{appliedIdx === i && <Check className="ms-auto h-3.5 w-3.5 shrink-0 text-brand-500" />}</div>
                {str(p.summary) && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{str(p.summary)}</p>}
                {preview(p) && <p className="mt-1.5 line-clamp-1 text-[10.5px] font-semibold capitalize text-brand-500">{preview(p)}</p>}
              </button>
            ))}
          </div>
          {appliedIdx !== null && <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">✓ Applied — tweak anything below, then continue.</p>}
        </div>
      )}
    </div>
  );
}
