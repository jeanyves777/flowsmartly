"use client";

import { Video } from "lucide-react";

const NODES = [
  { e: "☕", nm: "Hook", st: "ready" },
  { e: "⚽", nm: "Match moment", st: "run" },
  { e: "🥐", nm: "Offer", st: "queue" },
  { e: "📣", nm: "Stitch + CTA", st: "queue" },
] as const;

const ST_STYLE: Record<string, string> = {
  ready: "bg-emerald-500/15 text-emerald-500",
  run: "bg-amber-500/15 text-amber-500",
  queue: "bg-muted text-muted-foreground",
};
const ST_LABEL: Record<string, string> = { ready: "ready", run: "rendering", queue: "queued" };

/** Story-Ad pipeline rendered inside the chat (the flow-in-chat concept). */
export function PipelineFlowCard({ onToast }: { onToast: (m: string) => void }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        <Video className="h-4 w-4 text-brand-500" /> Or turn it into a video ad · Story-Ad flow
        <span className="ms-auto rounded-full border border-border px-2 py-0.5 text-[10px]">runs inside chat</span>
      </div>
      <div className="p-3.5">
        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {NODES.map((n, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-[152px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted/40">
                <div className="grid h-[74px] place-items-center bg-gradient-to-br from-muted to-card text-xl">{n.e}</div>
                <div className="p-2">
                  <div className="mb-1.5 text-[11.5px] font-semibold">{n.nm}</div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ${ST_STYLE[n.st]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {ST_LABEL[n.st]}
                  </span>
                </div>
              </div>
              {i < NODES.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        <button
          onClick={() => onToast("Opening the video flow inline…")}
          className="mt-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Build the video instead →
        </button>
      </div>
    </div>
  );
}
