"use client";

/**
 * Training Library — the owner's full shelf of training sessions and their recordings.
 * Replaces the old 360px "Your sessions" drawer with a searchable, filterable grid: each
 * card shows the session, its status and (when present) its recording, with watch / download /
 * share / rename / delete. Recordings are registered by the recorder bot (server-side capture);
 * this is where they land. [[training-studio]] [[training-recording]]
 */
import { useMemo, useState } from "react";
import { X, Search, Play, Download, Link2, Pencil, Trash2, GraduationCap, Clock, Users, Radio, Calendar, Check, Loader2, Film } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

export interface LibrarySession {
  id: string;
  title: string;
  status: string;
  sessionType?: string;
  plannedMins: number;
  seats: number;
  startsAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  recordingUrl?: string | null;
  participantCount?: number;
  segmentCount?: number;
}

const FILTERS = ["All", "Recorded", "Live", "Scheduled", "Ended", "Draft"] as const;
type Filter = (typeof FILTERS)[number];

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return null; }
};
const durationMins = (r: LibrarySession) => {
  if (r.startedAt && r.endedAt) { try { return Math.max(1, Math.round((new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()) / 60000)); } catch { /* fall through */ } }
  return r.plannedMins;
};
const statusStyle = (s: string) => s === "live" ? "bg-rose-500 text-white" : s === "ended" ? "bg-white/10 text-muted-foreground" : s === "scheduled" ? "bg-amber-500/20 text-amber-300" : "bg-brand-500/15 text-brand-300";

export function TrainingLibrary({ rows, currentId, onOpen, onWatch, onClose, reload }: {
  rows: LibrarySession[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onWatch: (r: LibrarySession) => void;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !r.title.toLowerCase().includes(needle)) return false;
      if (filter === "All") return true;
      if (filter === "Recorded") return !!r.recordingUrl;
      return r.status === filter.toLowerCase();
    });
  }, [rows, q, filter]);

  const rename = async (id: string) => {
    const title = renameVal.trim();
    setRenaming(null);
    if (!title) return;
    setBusy(id);
    try {
      const j = await fetch(`/api/ai/training/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't rename", variant: "destructive" }); return; }
      await reload();
    } finally { setBusy(null); }
  };
  const del = async (r: LibrarySession) => {
    if (!confirm(`Delete “${r.title}”? This can't be undone.`)) return;
    setBusy(r.id);
    try {
      const j = await fetch(`/api/ai/training/${r.id}`, { method: "DELETE" }).then((x) => x.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't delete", variant: "destructive" }); return; }
      toast({ title: "Session deleted" });
      await reload();
    } finally { setBusy(null); }
  };
  const copyLink = (url: string) => { navigator.clipboard?.writeText(url).catch(() => {}); toast({ title: "Recording link copied" }); };

  const recordedCount = rows.filter((r) => r.recordingUrl).length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0b10]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><GraduationCap className="h-4.5 w-4.5" /></span>
        <div className="min-w-0"><b className="block text-[15px] leading-tight">Training library</b><span className="text-[11px] text-muted-foreground">{rows.length} session{rows.length === 1 ? "" : "s"}{recordedCount ? ` · ${recordedCount} recorded` : ""}</span></div>
        <label className="ms-auto hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 sm:flex">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions…" className="w-[180px] bg-transparent text-[12px] outline-none" />
        </label>
        <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold hover:border-brand-500"><X className="h-4 w-4" /> Done</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
        {FILTERS.map((f) => {
          const n = f === "All" ? rows.length : f === "Recorded" ? recordedCount : rows.filter((r) => r.status === f.toLowerCase()).length;
          return <button key={f} onClick={() => setFilter(f)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", filter === f ? "border-brand-500 bg-brand-500/15 text-brand-200" : "border-border text-muted-foreground hover:border-brand-500")}>{f}<span className="text-[9.5px] opacity-70">{n}</span></button>;
        })}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-sm text-muted-foreground">
              <Film className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-[13px]">{rows.length === 0 ? "No training sessions yet." : "Nothing matches that filter."}</p>
              {filter === "Recorded" && rows.length > 0 && recordedCount === 0 ? <p className="mt-1.5 text-[11.5px]">Recordings appear here after you record a live session — start one from the room’s controls.</p> : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => {
              const date = fmtDate(r.endedAt || r.startedAt || r.startsAt);
              return (
                <div key={r.id} className={cn("group flex flex-col overflow-hidden rounded-2xl border bg-card transition", r.id === currentId ? "border-brand-500" : "border-border hover:border-brand-500/50")}>
                  {/* preview */}
                  <button onClick={() => (r.recordingUrl ? onWatch(r) : onOpen(r.id))} className="relative block aspect-video w-full overflow-hidden bg-gradient-to-br from-[#241f38] to-[#14121f] text-left">
                    {r.recordingUrl ? (
                      <>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video src={`${r.recordingUrl}#t=1`} preload="metadata" muted className="h-full w-full object-cover" />
                        <span className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/40"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg"><Play className="h-5 w-5 translate-x-[1px] fill-current" /></span></span>
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-black text-white"><Film className="h-2.5 w-2.5" /> REC</span>
                      </>
                    ) : (
                      <span className="grid h-full w-full place-items-center"><GraduationCap className="h-9 w-9 text-brand-400/50" /></span>
                    )}
                    <span className={cn("absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase", statusStyle(r.status))}>{r.status === "live" ? <span className="inline-flex items-center gap-1"><Radio className="h-2.5 w-2.5" /> live</span> : r.status}</span>
                  </button>

                  {/* meta */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
                    {renaming === r.id ? (
                      <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void rename(r.id); if (e.key === "Escape") setRenaming(null); }} onBlur={() => void rename(r.id)} className="w-full rounded-md border border-brand-500 bg-muted px-2 py-1 text-[12.5px] font-bold outline-none" />
                    ) : (
                      <b className="truncate text-[12.5px] leading-tight" title={r.title}>{r.title}</b>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                      {date ? <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {date}</span> : null}
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {durationMins(r)} min</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {r.participantCount ?? r.seats}</span>
                    </div>
                    <div className="mt-auto flex items-center gap-1 pt-1.5">
                      <button onClick={() => onOpen(r.id)} className="rounded-lg border border-border px-2 py-1 text-[10.5px] font-bold hover:border-brand-500">Open</button>
                      {r.recordingUrl ? (
                        <>
                          <button onClick={() => onWatch(r)} title="Watch" className="grid h-6.5 w-6.5 place-items-center rounded-lg border border-border text-brand-400 hover:border-brand-500"><Play className="h-3 w-3 fill-current" /></button>
                          <a href={r.recordingUrl} download target="_blank" rel="noreferrer" title="Download" className="grid h-6.5 w-6.5 place-items-center rounded-lg border border-border hover:border-brand-500"><Download className="h-3 w-3" /></a>
                          <button onClick={() => copyLink(r.recordingUrl!)} title="Copy link" className="grid h-6.5 w-6.5 place-items-center rounded-lg border border-border hover:border-brand-500"><Link2 className="h-3 w-3" /></button>
                        </>
                      ) : null}
                      <button onClick={() => { setRenameVal(r.title); setRenaming(r.id); }} title="Rename" className="ms-auto grid h-6.5 w-6.5 place-items-center rounded-lg border border-border hover:border-brand-500">{busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}</button>
                      <button onClick={() => void del(r)} title="Delete" className="grid h-6.5 w-6.5 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
