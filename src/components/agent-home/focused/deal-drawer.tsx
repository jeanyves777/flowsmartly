"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X, Loader2, Building2, User, Mail, Trophy, Ban, Send, FileText, StickyNote,
  GitBranch, Phone, ExternalLink, Sparkles, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DealOpp {
  id: string; title: string; value: number; currency: string; stageId: string | null; status: string;
  probability: number; expectedCloseAt: string | null; closedAt: string | null; pitchId?: string | null;
  savedLead?: { id: string; name: string; title: string | null; email?: string | null } | null;
  company?: { id: string; name: string; domain?: string | null } | null;
}
interface Stage { id: string; name: string; order: number; isWon: boolean; isLost: boolean }
interface Activity { id: string; type: string; subject: string | null; body: string | null; at: string }

const usd = (n: number) => `$${(n || 0).toLocaleString()}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const ICON: Record<string, typeof StickyNote> = {
  note: StickyNote, stage_change: GitBranch, pitch: Send, proposal: FileText, email: Mail, call: Phone,
};
const isLink = (s: string | null) => !!s && /^(https?:\/\/|\/)/.test(s.trim());

/**
 * Deal detail drawer — the deal's meta, a one-tap Won/Lost close, the linked
 * pitch/proposal, and the full activity timeline (created → pitched → moved →
 * closed). Log a note or ask the agent to write a proposal right from here.
 */
export function DealDrawer({
  opp, stages, onClose, onChanged, onAsk,
}: {
  opp: DealOpp; stages: Stage[]; onClose: () => void; onChanged: () => void; onAsk: (prompt: string) => void;
}) {
  const [acts, setActs] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/activities?opportunityId=${opp.id}`).then((r) => r.json());
      if (j?.success) setActs(j.data.activities || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [opp.id]);
  useEffect(() => { load(); }, [load]);

  const stage = stages.find((s) => s.id === opp.stageId);
  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);

  const patch = async (stageId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/opportunities/${opp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId }) });
      onChanged();
      await load();
    } finally { setBusy(false); }
  };

  const addNote = async () => {
    const body = note.trim();
    if (!body) return;
    setBusy(true); setNote("");
    try {
      await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "note", subject: body.slice(0, 80), body, opportunityId: opp.id }) });
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative flex h-full w-full max-w-[420px] flex-col border-l border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight">{opp.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
              {opp.value ? <b className="text-foreground">{usd(opp.value)}</b> : null}
              {stage && <span className={cn("rounded-full border px-2 py-0.5", stage.isWon ? "border-emerald-500/40 text-emerald-500" : stage.isLost ? "border-rose-500/40 text-rose-500" : "border-border")}>{stage.name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Meta */}
          <div className="space-y-1.5 text-[12.5px]">
            {opp.company?.name && <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> <span className="text-foreground">{opp.company.name}</span></div>}
            {opp.savedLead?.name && <div className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /> <span className="text-foreground">{opp.savedLead.name}</span>{opp.savedLead.title ? <span>· {opp.savedLead.title}</span> : null}</div>}
            {opp.savedLead?.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> <a href={`mailto:${opp.savedLead.email}`} className="text-brand-500 hover:underline">{opp.savedLead.email}</a></div>}
          </div>

          {/* Close actions */}
          {opp.status === "open" && (wonStage || lostStage) && (
            <div className="flex gap-2">
              {wonStage && <button disabled={busy} onClick={() => patch(wonStage.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12.5px] font-semibold text-emerald-500 disabled:opacity-50"><Trophy className="h-3.5 w-3.5" /> Mark Won</button>}
              {lostStage && <button disabled={busy} onClick={() => patch(lostStage.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] font-semibold text-rose-500 disabled:opacity-50"><Ban className="h-3.5 w-3.5" /> Mark Lost</button>}
            </div>
          )}

          {/* Pitch / proposal */}
          {opp.pitchId ? (
            <a href={`/home?pitch=${opp.pitchId}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-[12.5px] font-semibold hover:border-brand-500/50">
              <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-brand-500" /> Open pitch / proposal</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ) : (
            <button onClick={() => { onAsk(`Write a proposal for the deal "${opp.title}"${opp.company?.name ? ` (${opp.company.name})` : ""} and link it to this opportunity (opportunityId: ${opp.id}).`); onClose(); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-[12.5px] font-semibold hover:border-brand-500/50">
              <Sparkles className="h-4 w-4 text-brand-500" /> Write a proposal for this deal
            </button>
          )}

          {/* Timeline */}
          <div>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
            {loading ? (
              <div className="grid place-items-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : acts.length ? (
              <ol className="space-y-3">
                {acts.map((a) => {
                  const Icon = ICON[a.type] || StickyNote;
                  const link = isLink(a.body) ? a.body!.trim() : null;
                  return (
                    <li key={a.id} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground"><Icon className="h-3 w-3" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium leading-snug">{a.subject || a.type}</p>
                        {a.body && !link && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-muted-foreground">{a.body}</p>}
                        {link && <a href={link} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-brand-500 hover:underline">Open <ExternalLink className="h-3 w-3" /></a>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{when(a.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-4 text-center text-[12px] text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </div>

        {/* Log a note */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
              placeholder="Log a note or next step…"
              className="flex-1 rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/50"
            />
            <button disabled={busy || !note.trim()} onClick={addNote} className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
