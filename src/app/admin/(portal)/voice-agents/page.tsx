"use client";

/**
 * Admin — voice agent build queue.
 *
 * Users request a phone agent; the request lands here with everything needed to
 * hand-build the console agent (the provider's agents API is team-gated). For
 * each request we show the business brief, the greeting, the enabled skills and
 * menu, plus a ready-to-paste MCP relay URL and the console instructions. The
 * admin builds the agent in the console, then approves here with the number +
 * agent id — that flips the agent LIVE and notifies the user. Nothing is charged
 * before approval.
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
  PhoneCall,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Clock,
  Building2,
  MessageSquareQuote,
  Mic,
  Wrench,
  UtensilsCrossed,
  CheckCircle2,
  Inbox,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types — mirror GET /api/admin/voice-agent/agents
// ---------------------------------------------------------------------------

interface AgentRequest {
  id: string;
  requestedAt: string | null;
  user: { id: string; email: string; name: string | null } | null;
  name: string;
  preset: string | null;
  business: string | null;
  greeting: string | null;
  voice: string | null;
  voiceId: string | null;
  escalateTo: string | null;
  skills: string[];
  menu: string[];
  mcpUrl: string;
  consoleInstructions: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1.5 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Approve form (per request)
// ---------------------------------------------------------------------------

function ApproveForm({ req, onApproved }: { req: AgentRequest; onApproved: () => void }) {
  const { toast } = useToast();
  const [e164, setE164] = useState("");
  const [xaiAgentId, setXaiAgentId] = useState("");
  const [xaiPhoneNumberId, setXaiPhoneNumberId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      toast({ title: "Check the number", description: "Full international format, like +14155550142.", variant: "destructive" });
      return;
    }
    if (!xaiAgentId.trim()) {
      toast({ title: "Missing agent id", description: "Paste the agent id from the console.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/voice-agent/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: req.id,
          e164: e164.trim(),
          xaiAgentId: xaiAgentId.trim(),
          xaiPhoneNumberId: xaiPhoneNumberId.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Agent activated", description: `${req.name} is live on ${e164}. The user was notified.` });
        onApproved();
      } else {
        toast({ title: "Could not approve", description: data.error?.message || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not approve", description: "Network error — try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        Activate this agent
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone number (E.164)</label>
          <Input value={e164} onChange={(e) => setE164(e.target.value)} placeholder="+14155550142" className="font-mono text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Console agent id</label>
          <Input value={xaiAgentId} onChange={(e) => setXaiAgentId(e.target.value)} placeholder="agent_…" className="font-mono text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Number id (optional)</label>
          <Input value={xaiPhoneNumberId} onChange={(e) => setXaiPhoneNumberId(e.target.value)} placeholder="phone_…" className="font-mono text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Internal note (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. built on pooled agent #7" className="text-sm" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={submit} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? "Activating…" : "Approve & activate"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request card
// ---------------------------------------------------------------------------

function RequestCard({ req, onApproved }: { req: AgentRequest; onApproved: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{req.name}</h3>
              {req.preset && <Badge variant="secondary" className="capitalize">{req.preset}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {req.user?.name || req.user?.email || "Unknown user"}
              {req.user?.name && req.user?.email ? ` · ${req.user.email}` : ""}
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            {relTime(req.requestedAt)}
          </Badge>
        </div>

        {/* Brief grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {req.business && (
            <Field icon={Building2} label="Business">
              <p className="whitespace-pre-wrap text-sm">{req.business}</p>
            </Field>
          )}
          {req.greeting && (
            <Field icon={MessageSquareQuote} label="Greeting">
              <p className="text-sm italic">“{req.greeting}”</p>
            </Field>
          )}
          <Field icon={Mic} label="Voice">
            <p className="text-sm">
              {req.voice || "Default"}
              {req.voiceId ? <span className="ml-1.5 font-mono text-xs text-muted-foreground">({req.voiceId})</span> : null}
            </p>
          </Field>
          {req.escalateTo && (
            <Field icon={PhoneCall} label="Escalate to">
              <p className="font-mono text-sm">{req.escalateTo}</p>
            </Field>
          )}
        </div>

        {/* Skills */}
        {req.skills.length > 0 && (
          <Field icon={Wrench} label="Skills">
            <div className="flex flex-wrap gap-1.5">
              {req.skills.map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
              ))}
            </div>
          </Field>
        )}

        {/* Menu */}
        {req.menu.length > 0 && (
          <Field icon={UtensilsCrossed} label={`Menu (${req.menu.length})`}>
            <ul className="grid gap-0.5 text-sm sm:grid-cols-2">
              {req.menu.map((m, i) => (
                <li key={i} className="text-muted-foreground">{m}</li>
              ))}
            </ul>
          </Field>
        )}

        {/* Copy-paste setup for the console agent */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Build in console</p>
          <SetupRow label="MCP relay URL" value={req.mcpUrl} copyLabel="Copy URL" mono />
          <SetupRow label="Agent instructions" value={req.consoleInstructions} copyLabel="Copy" />
          <p className="text-xs text-muted-foreground">
            Create the agent in the console, add a Custom MCP connector pointing at the URL above, paste these instructions,
            pick the voice, then approve below with the number + agent id.
          </p>
        </div>

        {/* Approve */}
        <ApproveForm req={req} onApproved={onApproved} />
      </CardContent>
    </Card>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      {children}
    </div>
  );
}

function SetupRow({ label, value, copyLabel, mono }: { label: string; value: string; copyLabel: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton text={value} label={copyLabel} />
      </div>
      <p className={`break-all rounded-md border bg-background p-2 text-xs ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VoiceAgentsQueuePage() {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/voice-agent/agents");
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
        setError(null);
      } else {
        setError(data.error?.message || "Could not load requests");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <PhoneCall className="w-6 h-6 text-brand-500" />
              <h1 className="text-2xl font-bold">Phone Agent Requests</h1>
              {!loading && requests.length > 0 && <Badge variant="secondary">{requests.length}</Badge>}
            </div>
            <p className="mt-1 text-muted-foreground">
              Build each requested agent in the console, then approve with its number + id to activate it.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchRequests} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={fetchRequests} variant="outline">Retry</Button>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <Inbox className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium">No open requests</p>
          <p className="text-sm text-muted-foreground">New phone agent requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <RequestCard key={req.id} req={req} onApproved={fetchRequests} />
          ))}
        </div>
      )}
    </div>
  );
}
