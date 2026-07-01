"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Loader2, Trophy, Building2, User, Plus, GripVertical, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Stage { id: string; name: string; order: number; isWon: boolean; isLost: boolean }
interface Opp {
  id: string; title: string; value: number; currency: string; stageId: string | null; status: string;
  probability: number; expectedCloseAt: string | null; closedAt: string | null;
  savedLead?: { id: string; name: string; title: string | null } | null;
  company?: { id: string; name: string } | null;
}

const usd = (n: number) => `$${(n || 0).toLocaleString()}`;

/**
 * Pipeline board — a draggable Kanban of Opportunities across the user's stages
 * (video-playground feel: grab a deal card and drop it into the next stage). Drops
 * PATCH the deal; moving into Won/Lost auto-closes it. Agent-assisted via onAsk.
 */
export function PipelineBoard({ refreshKey, onAsk }: { refreshKey?: number; onAsk: (prompt: string) => void }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/opportunities").then((r) => r.json());
      if (j?.success) { setStages(j.data.stages || []); setOpps(j.data.opportunities || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const move = async (id: string, stageId: string) => {
    const opp = opps.find((o) => o.id === id);
    if (!opp || opp.stageId === stageId) return;
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, stageId } : o))); // optimistic
    try {
      await fetch(`/api/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId }) });
    } finally { load(); }
  };

  const onDrop = (e: DragEvent, stageId: string) => { e.preventDefault(); setOverStage(null); if (dragId) move(dragId, stageId); setDragId(null); };

  const openRevenue = opps.filter((o) => o.status === "won").reduce((s, o) => s + (o.value || 0), 0);
  const pipelineValue = opps.filter((o) => o.status === "open").reduce((s, o) => s + (o.value || 0), 0);

  if (loading) return <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px]"><TrendingUp className="h-3.5 w-3.5 text-brand-500" /> Pipeline <b className="text-foreground">{usd(pipelineValue)}</b></span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px]"><Trophy className="h-3.5 w-3.5 text-emerald-500" /> Won <b className="text-emerald-500">{usd(openRevenue)}</b></span>
        <span className="text-[12px] text-muted-foreground">Drag a deal to move it. Won / Lost auto-close.</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const cards = opps.filter((o) => o.stageId === stage.id);
          const total = cards.reduce((s, o) => s + (o.value || 0), 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => onDrop(e, stage.id)}
              className={cn(
                "flex w-[240px] shrink-0 flex-col rounded-2xl border bg-muted/20 p-2 transition-colors",
                overStage === stage.id ? "border-brand-500 bg-brand-500/5" : "border-border",
              )}
            >
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className={cn("text-[12.5px] font-bold", stage.isWon ? "text-emerald-500" : stage.isLost ? "text-rose-500" : "text-foreground")}>{stage.name}</span>
                <span className="text-[11px] text-muted-foreground">{cards.length}{total ? ` · ${usd(total)}` : ""}</span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {cards.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => setDragId(o.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    className={cn("group cursor-grab rounded-xl border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing", dragId === o.id && "opacity-50")}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold">{o.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          {o.value ? <span className="font-semibold text-foreground">{usd(o.value)}</span> : null}
                          {o.company?.name && <span className="inline-flex items-center gap-0.5"><Building2 className="h-3 w-3" /> {o.company.name}</span>}
                          {o.savedLead?.name && <span className="inline-flex items-center gap-0.5"><User className="h-3 w-3" /> {o.savedLead.name}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <div className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground/70">Drop deals here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {opps.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><TrendingUp className="h-6 w-6" /></span>
          <p className="mt-3 text-[13.5px] font-semibold">No deals in your pipeline yet</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Turn a lead into a deal — or ask the agent to start tracking one.</p>
          <button onClick={() => onAsk("Create an opportunity/deal in my pipeline for the lead I'm working — set a stage and estimated value.")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a deal</button>
        </div>
      )}
    </div>
  );
}
