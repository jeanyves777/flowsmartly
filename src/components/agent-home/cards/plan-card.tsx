"use client";

import { useState, type ReactNode } from "react";
import { AISpinner } from "@/components/shared/ai-generation-loader";

/** Confirm-before-mutate plan card → live progress → done. */
export function PlanCard({ onToast }: { onToast: (m: string) => void }) {
  const [stage, setStage] = useState<"plan" | "running" | "done">("plan");
  const [pct, setPct] = useState(0);

  const confirm = () => {
    setStage("running");
    setTimeout(() => setPct(100), 60);
    setTimeout(() => {
      setStage("done");
      onToast("Scheduled across 2 channels");
    }, 1500);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        📋 Plan · needs your OK
        <span className="ms-auto rounded-full border border-border px-2 py-0.5 text-[10px]">confirm before publish</span>
      </div>
      <div className="p-3.5">
        {stage === "plan" ? (
          <>
            <Step n={1}>Finalize the design above (your edits are kept).</Step>
            <Step n={2}>
              Schedule to <b>Instagram</b> + <b>Facebook</b> — Sat 9:00 AM.
            </Step>
            <Step n={3}>Add 4 on-brand hashtags from your kit.</Step>
            <p className="mt-2 text-xs text-muted-foreground">
              Est. cost: <b className="text-amber-500">6 credits</b> · reversible until it publishes
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={confirm}
                className="rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
              >
                Confirm &amp; schedule
              </button>
              <button onClick={() => onToast("Plan dismissed")} className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-muted-foreground">
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] text-emerald-500">
              ✓ Scheduled
            </span>
            <div className="my-3 h-[7px] overflow-hidden rounded-md bg-muted">
              <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[13px] text-muted-foreground">
              {stage === "running" ? (
                <span className="inline-flex items-center gap-2">
                  <AISpinner className="h-4 w-4" /> Scheduling to Instagram + Facebook…
                </span>
              ) : (
                <>
                  Done — live <b>Sat 9:00 AM</b> on 2 channels.{" "}
                  <a className="text-brand-500" href="#">
                    View in Publish ↗
                  </a>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-sm">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border bg-muted text-[11px] font-bold text-brand-500">{n}</span>
      <span>{children}</span>
    </div>
  );
}
