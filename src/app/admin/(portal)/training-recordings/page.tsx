"use client";

/**
 * Admin — Training Room recordings + recorder-bot control.
 *
 * Recorder health (the headless-Chrome bot on the media box), a one-click end-to-end pipeline
 * self-test, platform recording totals, and every recorded session with watch / download and a
 * force-stop for stuck live recordings.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Radio, RefreshCw, PlayCircle, Download, Film, CheckCircle2, XCircle, Loader2, StopCircle, Video, HardDrive, Clock, Users, Wifi, WifiOff } from "lucide-react";

interface Health { configured: boolean; ok: boolean; jobs?: number; sessions?: string[]; resolution?: string; fps?: number; error?: string }
interface Rec {
  id: string; title: string; status: string; plannedMins: number; seats: number;
  startedAt: string | null; endedAt: string | null; recordingUrl: string | null; creditsSpent: number;
  participantCount: number; ownerEmail: string | null; ownerName: string | null; durationMins: number;
}
interface Data { health: Health; recordings: Rec[]; totals: { recorded: number; liveRecording: number } }

const fmtDate = (iso: string | null) => { if (!iso) return "—"; try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return "—"; } };

export default function TrainingRecordingsAdmin() {
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [testFail, setTestFail] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const j = await fetch("/api/admin/training-recordings").then((r) => r.json()); if (j?.success) setData(j.data as Data); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selfTest = async () => {
    setTesting(true); setTestUrl(null); setTestFail(null);
    try {
      const j = await fetch("/api/admin/training-recordings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "selftest" }) }).then((r) => r.json());
      if (j?.success && j.data?.url) { setTestUrl(j.data.url); toast({ title: "Self-test passed", description: `${j.data.resolution} · ${Math.round((j.data.sizeBytes || 0) / 1024)} KB` }); }
      else { setTestFail(j?.error?.message || j?.data?.error || "Self-test failed"); toast({ title: "Self-test failed", description: j?.error?.message || j?.data?.error, variant: "destructive" }); }
    } catch (e) { setTestFail(String(e)); } finally { setTesting(false); void load(); }
  };

  const forceStop = async (id: string) => {
    setStopping(id);
    try { await fetch("/api/admin/training-recordings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", sessionId: id }) }); toast({ title: "Recording stopped" }); await load(); }
    finally { setStopping(null); }
  };

  const h = data?.health;
  const online = !!h?.ok;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold"><Video className="h-5 w-5 text-brand-500" /> Training recordings</h1>
          <p className="text-sm text-muted-foreground">The headless-Chrome recorder bot + every recorded session.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
      </div>

      {/* recorder status */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className={online ? "border-emerald-500/40" : "border-rose-500/40"}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${online ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>{online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}</span>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Recorder bot</div>
              <div className="text-base font-bold">{loading ? "…" : !h?.configured ? "Not configured" : online ? "Online" : "Offline"}</div>
              {h && !online && h.error ? <div className="truncate text-[10.5px] text-rose-400" title={h.error}>{h.error}</div> : null}
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-500"><Radio className="h-5 w-5" /></span><div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Recording now</div><div className="text-base font-bold">{h?.jobs ?? 0} active</div></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-500"><HardDrive className="h-5 w-5" /></span><div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Saved recordings</div><div className="text-base font-bold">{data?.totals.recorded ?? 0}</div></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-500"><Film className="h-5 w-5" /></span><div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Quality</div><div className="text-base font-bold">{h?.resolution || "1920×1080"}<span className="text-muted-foreground"> · {h?.fps || 30}fps</span></div></div></CardContent></Card>
      </div>

      {/* self-test */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">End-to-end self-test</div>
              <div className="text-sm text-muted-foreground">Records a ~7s test clip (video + a 440 Hz tone) → S3. Proves Xvfb → Chrome → ffmpeg → upload without needing a live room.</div>
            </div>
            <Button onClick={() => void selfTest()} disabled={testing || !h?.configured}>{testing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Running… (~20s)</> : <><PlayCircle className="mr-1.5 h-4 w-4" /> Run self-test</>}</Button>
          </div>
          {testUrl ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Passed — the full pipeline works.</div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={testUrl} controls className="aspect-video w-full max-w-md rounded-lg bg-black" />
              <a href={testUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-500 underline">{testUrl}</a>
            </div>
          ) : testFail ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 text-sm font-semibold text-rose-500"><XCircle className="h-4 w-4" /> {testFail}</div>
          ) : null}
        </CardContent>
      </Card>

      {/* recordings */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">All recordings {data ? <span className="text-muted-foreground">({data.recordings.length})</span> : null}</div>
          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.recordings.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Film className="mx-auto mb-2 h-7 w-7 opacity-40" />No recordings yet. Record a live session (or run the self-test above).</div>
          ) : (
            <div className="divide-y divide-border">
              {data.recordings.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><b className="truncate">{r.title}</b><Badge variant="outline" className="shrink-0 text-[10px]">{r.status}</Badge>{r.status === "live" ? <Badge className="shrink-0 bg-rose-500 text-[10px] text-white">REC</Badge> : null}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{r.ownerName || r.ownerEmail || "—"} · {fmtDate(r.endedAt || r.startedAt)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.durationMins}m</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {r.participantCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.recordingUrl ? <>
                      <a href={r.recordingUrl} target="_blank" rel="noreferrer" title="Watch" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-brand-500 hover:border-brand-500"><PlayCircle className="h-4 w-4" /></a>
                      <a href={`/api/ai/training/${r.id}/recording/download`} title="Download" className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-brand-500"><Download className="h-4 w-4" /></a>
                    </> : null}
                    {r.status === "live" ? <Button size="sm" variant="outline" onClick={() => void forceStop(r.id)} disabled={stopping === r.id}>{stopping === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><StopCircle className="mr-1 h-4 w-4" /> Stop</>}</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
