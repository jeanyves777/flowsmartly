"use client";

/**
 * Admin — Phone Agents (ElevenLabs era).
 *
 * A management console: platform totals + every agent with its full detail,
 * this-month call volume + credits, its number, and controls (pause / resume /
 * resync to ElevenLabs / replace number / delete).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  PhoneCall, ArrowLeft, RefreshCw, Inbox, Mic, Wrench, Languages, PhoneForwarded,
  Clock, Trash2, Pause, Play, RotateCw, Hash, AlertTriangle,
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  preset: string | null;
  status: string;
  user: { id: string; email: string; name: string | null } | null;
  createdAt: string;
  liveSince: string | null;
  elevenAgentId: string | null;
  elevenSyncState: string;
  elevenSyncError: string | null;
  number: { e164: string | null; origin: string; status: string; elevenPhoneNumberId: string | null } | null;
  voice: string;
  language: string;
  extraLanguages: string[];
  skills: string[];
  followUpCount: number;
  escalateTo: string | null;
  spendCapCredits: number;
  spentThisPeriod: number;
  stats: { calls: number; minutes: number; credits: number; lastCallAt: string | null };
}
interface Platform {
  totalAgents: number; live: number; paused: number; draft: number; onEleven: number;
  activeNumbers: number; callsThisMonth: number; minutesThisMonth: number; creditsThisMonth: number;
  perMinuteCredits: number; numberRentalCredits: number;
}

function rel(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    LIVE: "bg-emerald-600 hover:bg-emerald-600 text-white",
    PAUSED: "bg-amber-500/15 text-amber-500",
    DRAFT: "bg-muted text-muted-foreground",
    REQUESTED: "bg-sky-500/15 text-sky-500",
  };
  return <Badge className={map[status] || map.DRAFT}>{status}</Badge>;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function AgentCard({ agent, onChanged }: { agent: Agent; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showReplace, setShowReplace] = useState(false);
  const [e164, setE164] = useState(agent.number?.e164 || "");

  const act = async (action: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(action);
    try {
      const res = await fetch("/api/admin/voice-agent/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, action }),
      });
      const data = await res.json();
      if (data.success) { toast({ title: `Agent ${action}d` }); onChanged(); }
      else toast({ title: "Failed", description: data.error?.message, variant: "destructive" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const replaceNumber = async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) { toast({ title: "Full international format, like +14155550142.", variant: "destructive" }); return; }
    setBusy("replace");
    try {
      const res = await fetch("/api/admin/voice-agent/agents", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, e164: e164.trim() }),
      });
      const data = await res.json();
      if (data.success) { toast({ title: "Number updated" }); setShowReplace(false); onChanged(); }
      else toast({ title: "Failed", description: data.error?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const synced = agent.elevenSyncState === "synced" && agent.elevenAgentId;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <StatusBadge status={agent.status} />
              {agent.preset && <Badge variant="secondary" className="capitalize">{agent.preset}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{agent.user?.email || agent.user?.name || "—"}</p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            {synced ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">ElevenLabs · synced</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> not on ElevenLabs
              </Badge>
            )}
            {agent.elevenAgentId && <p className="mt-1 font-mono">{agent.elevenAgentId}</p>}
          </div>
        </div>

        {agent.elevenSyncError && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[11px] text-rose-500">Sync error: {agent.elevenSyncError}</p>
        )}

        {/* This-month usage */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "Calls (mo)", v: agent.stats.calls },
            { l: "Minutes", v: agent.stats.minutes },
            { l: "Credits", v: agent.stats.credits },
            { l: "Spend cap", v: `${agent.spentThisPeriod}/${agent.spendCapCredits}` },
          ].map((t) => (
            <div key={t.l} className="rounded-lg border bg-muted/30 p-2 text-center">
              <p className="text-lg font-bold tabular-nums">{t.v}</p>
              <p className="text-[9px] font-semibold uppercase text-muted-foreground">{t.l}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field icon={Hash} label="Number">
            {agent.number?.e164 ? (
              <span>
                <span className="font-mono">{agent.number.e164}</span>{" "}
                <span className="text-[10px] text-muted-foreground">({agent.number.origin})</span>
              </span>
            ) : <span className="text-muted-foreground">no number</span>}
          </Field>
          <Field icon={Mic} label="Voice"><span>{agent.voice}</span></Field>
          <Field icon={Languages} label="Language">
            {agent.language}{agent.extraLanguages.length ? ` +${agent.extraLanguages.join(", ")}` : ""}
          </Field>
          <Field icon={Wrench} label="Skills">
            <div className="flex flex-wrap gap-1">
              {agent.skills.map((s) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}
            </div>
          </Field>
          <Field icon={PhoneForwarded} label="Follow-ups"><span>{agent.followUpCount} rule{agent.followUpCount === 1 ? "" : "s"}</span></Field>
          <Field icon={Clock} label="Last call"><span>{rel(agent.stats.lastCallAt)}</span></Field>
        </div>

        {/* Replace-number inline */}
        {showReplace && (
          <div className="flex items-end gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">New number (E.164)</label>
              <Input value={e164} onChange={(e) => setE164(e.target.value)} placeholder="+14155550142" className="font-mono text-sm" />
            </div>
            <Button size="sm" onClick={replaceNumber} disabled={busy === "replace"}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReplace(false)}>Cancel</Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {agent.status === "LIVE" ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => act("pause")} disabled={!!busy}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => act("resume")} disabled={!!busy}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => act("resync")} disabled={!!busy}>
            <RotateCw className={`h-3.5 w-3.5 ${busy === "resync" ? "animate-spin" : ""}`} /> Resync to ElevenLabs
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowReplace((v) => !v)} disabled={!!busy}>
            <Hash className="h-3.5 w-3.5" /> Replace number
          </Button>
          <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-rose-500 hover:text-rose-600"
            onClick={() => act("delete", `Delete "${agent.name}" and its ElevenLabs agent? This can't be undone.`)} disabled={!!busy}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VoiceAgentsAdminPage() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/voice-agent/agents");
      const data = await res.json();
      if (data.success) { setPlatform(data.platform); setAgents(data.agents || []); setError(null); }
      else setError(data.error?.message || "Could not load");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg p-2 transition-colors hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-6 w-6 text-brand-500" />
              <h1 className="text-2xl font-bold">Phone Agents</h1>
            </div>
            <p className="mt-1 text-muted-foreground">Every voice agent on ElevenLabs — usage, numbers, and controls.</p>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Platform audit */}
      {platform && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Agents" value={platform.totalAgents} sub={`${platform.live} live · ${platform.paused} paused`} />
          <Stat label="On ElevenLabs" value={`${platform.onEleven}/${platform.totalAgents}`} />
          <Stat label="Active numbers" value={platform.activeNumbers} />
          <Stat label="Calls (mo)" value={platform.callsThisMonth} sub={`${platform.minutesThisMonth} min`} />
          <Stat label="Credits (mo)" value={platform.creditsThisMonth} />
          <Stat label="Rates" value={`${platform.perMinuteCredits} cr/min`} sub={`${platform.numberRentalCredits} cr/number`} />
        </div>
      )}

      {/* Agents */}
      {loading ? (
        <div className="space-y-4">{[0, 1].map((i) => <Card key={i}><CardContent className="space-y-3 p-5"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center"><div className="text-center"><p className="mb-4 text-muted-foreground">{error}</p><Button onClick={load} variant="outline">Retry</Button></div></div>
      ) : agents.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <Inbox className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium">No agents yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((a) => <AgentCard key={a.id} agent={a} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}
