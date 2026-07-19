"use client";

/**
 * Admin — voice agent build queue.
 *
 * Users request a phone agent; the request lands here as a complete console
 * BUILD SHEET (the provider's agents API is team-gated, so the agent is built by
 * hand). The sheet mirrors the xAI console tab-by-tab — Configuration, Speech,
 * Deployment — with every field auto-filled from the tenant's profile + brief
 * and a copy button on each, so setup is pure copy-paste. The admin builds the
 * agent in the console, then approves here with the number + agent id — that
 * flips the agent LIVE and notifies the user. Nothing is charged before approval.
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
  Settings2,
  AudioLines,
  Rocket,
  CheckCircle2,
  Inbox,
  Plug,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types — mirror GET /api/admin/voice-agent/agents
// ---------------------------------------------------------------------------

interface ConsoleSheet {
  configuration: {
    name: string;
    instructions: string;
    welcomeOn: boolean;
    greeting: string;
    callerCanInterrupt: boolean;
    timezone: string;
    nativeTools: string[];
    connector: { type: string; url: string; exposes: string[] };
  };
  speech: {
    voice: string;
    language: string;
    speakingSpeed: string;
    pronunciations: { word: string; say: string }[];
    keyterms: string[];
    followUpAfterSilence: boolean;
  };
  deployment: { escalateTo: string | null };
}

interface LiveAgent {
  id: string;
  name: string;
  status: string;
  user: { id: string; email: string; name: string | null } | null;
  currentE164: string | null;
  currentXaiAgentId: string | null;
  liveSince: string | null;
}

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
  console: ConsoleSheet;
}

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 shrink-0 gap-1.5 text-xs"
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
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A labelled console field with its value and a copy button. */
function CopyField({
  label,
  value,
  mono,
  block,
  copyText,
}: {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
  copyText?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton text={copyText ?? value} />
      </div>
      <p
        className={`rounded-md border bg-background p-2 text-sm ${mono ? "font-mono text-xs" : ""} ${
          block ? "max-h-56 overflow-auto whitespace-pre-wrap" : "break-words"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** A read-only field with no copy (toggles, chips). */
function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function OnOff({ on }: { on: boolean }) {
  return (
    <Badge variant={on ? "default" : "secondary"} className={on ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
      {on ? "On" : "Off"}
    </Badge>
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
// Console tab panel
// ---------------------------------------------------------------------------

function TabPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-brand-500" />
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approve form
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
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        <Rocket className="h-4 w-4" />
        Activate
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        After building the agent and assigning a number in the console, copy the <code>agent_id</code> from the
        Deployment tab&apos;s WebSocket URL (<code>…?agent_id=</code>) and paste it here with the number.
      </p>
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
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? "Activating…" : "Approve & activate"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request card — the console build sheet
// ---------------------------------------------------------------------------

function RequestCard({ req, onApproved }: { req: AgentRequest; onApproved: () => void }) {
  const c = req.console.configuration;
  const s = req.console.speech;

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
            <Clock className="h-3 w-3" />
            {relTime(req.requestedAt)}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Build this agent in the xAI console using the sheet below, then activate it at the bottom. Everything is
          filled from the customer&apos;s brief — just copy each field into the matching console field.
        </p>

        {/* 1 · Configuration */}
        <TabPanel icon={Settings2} title="1 · Configuration">
          <CopyField label="Agent name" value={c.name} />
          <CopyField label="Instructions" value={c.instructions} block />
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Welcome message">
              <div className="flex items-center gap-2">
                <OnOff on={c.welcomeOn} />
                <span className="text-xs text-muted-foreground">
                  {c.greeting ? "with greeting →" : "agent chooses its own opener"}
                </span>
              </div>
            </InfoField>
            <InfoField label="Caller can interrupt">
              <OnOff on={c.callerCanInterrupt} />
            </InfoField>
          </div>
          {c.greeting && <CopyField label="Welcome message text" value={c.greeting} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Timezone">
              <p className="text-sm">{c.timezone}</p>
            </InfoField>
            <InfoField label="Tools to add (built-in)">
              <div className="flex flex-wrap gap-1.5">
                {c.nativeTools.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono font-normal">{t}</Badge>
                ))}
              </div>
            </InfoField>
          </div>

          {/* Connector — the one piece that wires our backend in */}
          <div className="rounded-md border border-brand-500/30 bg-brand-500/[0.04] p-3">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
              <Plug className="h-3.5 w-3.5 text-brand-500" />
              Add connector → {c.connector.type}
            </div>
            <CopyField label="MCP server URL" value={c.connector.url} mono />
            <p className="mt-2 text-xs text-muted-foreground">
              Exposes:{" "}
              {c.connector.exposes.map((t, i) => (
                <span key={t}>
                  <code className="text-[11px]">{t}</code>
                  {i < c.connector.exposes.length - 1 ? ", " : ""}
                </span>
              ))}
              . These are all the caller actions — no need to hand-define any tool.
            </p>
          </div>
        </TabPanel>

        {/* 2 · Speech */}
        <TabPanel icon={AudioLines} title="2 · Speech">
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoField label="Voice">
              <p className="text-sm font-medium">{s.voice}</p>
            </InfoField>
            <InfoField label="Language">
              <p className="text-sm">{s.language}</p>
            </InfoField>
            <InfoField label="Speaking speed">
              <p className="text-sm">{s.speakingSpeed}</p>
            </InfoField>
          </div>
          {s.keyterms.length > 0 && (
            <InfoField label="Keyterms">
              <div className="flex flex-wrap gap-1.5">
                {s.keyterms.map((k) => (
                  <Badge key={k} variant="secondary" className="font-normal">{k}</Badge>
                ))}
              </div>
            </InfoField>
          )}
          {s.pronunciations.length > 0 && (
            <InfoField label="Pronunciation">
              <ul className="space-y-0.5 text-sm">
                {s.pronunciations.map((p) => (
                  <li key={p.word}>
                    <span className="font-medium">{p.word}</span> → <span className="text-muted-foreground">{p.say}</span>
                  </li>
                ))}
              </ul>
            </InfoField>
          )}
          <InfoField label="Follow-up after silence">
            <OnOff on={s.followUpAfterSilence} />
          </InfoField>
        </TabPanel>

        {/* 3 · Deployment */}
        <TabPanel icon={Rocket} title="3 · Deployment">
          <p className="text-sm text-muted-foreground">
            Provision or assign a phone number to this agent, then grab its <code>agent_id</code> for activation below.
          </p>
          {req.console.deployment.escalateTo && (
            <InfoField label="Escalation / transfer number">
              <p className="font-mono text-sm">{req.console.deployment.escalateTo}</p>
            </InfoField>
          )}
          {req.menu.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Menu reference ({req.menu.length} items)
              </summary>
              <ul className="mt-2 grid gap-0.5 sm:grid-cols-2">
                {req.menu.map((m, i) => (
                  <li key={i} className="text-muted-foreground">{m}</li>
                ))}
              </ul>
            </details>
          )}
        </TabPanel>

        {/* Activate */}
        <ApproveForm req={req} onApproved={onApproved} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Direct SIP — connect a client's own number (BYO trunk), one click
// ---------------------------------------------------------------------------

interface NumberReq {
  id: string;
  e164: string | null;
  country: string | null;
  friendlyName: string | null;
  requestNote: string | null;
  requestedAt: string | null;
  user: { id: string; email: string; name: string | null } | null;
  agent: { id: string; name: string } | null;
}
type SipDetails = { host: string | null; uri: string; username: string; password: string };

function SipResult({ sip }: { sip: SipDetails }) {
  return (
    <div className="mt-3 space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="text-xs text-muted-foreground">Relay these to the client&apos;s carrier / PBX so their trunk points at us (the password is shown once):</p>
      <CopyField label="SIP URI" value={sip.uri} mono />
      <CopyField label="Username" value={sip.username} mono />
      <CopyField label="Password" value={sip.password} mono />
    </div>
  );
}

function NumberConnectPanel() {
  const { toast } = useToast();
  const [reqs, setReqs] = useState<NumberReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, SipDetails>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/voice-agent/numbers").then((r) => r.json());
      if (j.success) setReqs(j.requests || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const connect = async (id: string) => {
    setBusyId(id);
    try {
      const j = await fetch("/api/admin/voice-agent/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id }),
      }).then((r) => r.json());
      if (!j.success) {
        toast({ title: j.error?.message || "Could not connect that number", variant: "destructive" });
        return;
      }
      setDone((d) => ({ ...d, [id]: j.sip as SipDetails }));
      toast({ title: "Number connected", description: "The client can switch their agent on now." });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const justDone = Object.entries(done).filter(([id]) => !reqs.some((r) => r.id === id));
  if (!loading && reqs.length === 0 && justDone.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-cyan-500" />
          <h2 className="text-lg font-semibold">Direct SIP — numbers to connect</h2>
          {reqs.length > 0 && <Badge variant="secondary">{reqs.length}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          A client gave us a number they already own. Click Connect to register it over Direct SIP —
          we generate the SIP credentials; relay them to the client&apos;s carrier.
        </p>
        {reqs.map((r) => (
          <div key={r.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono font-semibold">{r.e164 || "—"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.user?.email || "—"}
                  {r.agent ? ` · ${r.agent.name}` : ""}
                  {r.friendlyName ? ` · ${r.friendlyName}` : ""}
                </div>
              </div>
              <Button onClick={() => connect(r.id)} disabled={busyId === r.id} className="shrink-0 gap-2">
                {busyId === r.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Connect (Direct SIP)
              </Button>
            </div>
            {done[r.id] && <SipResult sip={done[r.id]} />}
          </div>
        ))}
        {justDone.map(([id, sip]) => (
          <div key={id} className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Connected
            </div>
            <SipResult sip={sip} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** An approved agent with an inline "replace the number it answers on" form. */
function LiveAgentCard({ agent, onSaved }: { agent: LiveAgent; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [e164, setE164] = useState(agent.currentE164 || "");
  const [xaiAgentId, setXaiAgentId] = useState(agent.currentXaiAgentId || "");
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          e164: e164.trim(),
          xaiAgentId: xaiAgentId.trim(),
          xaiPhoneNumberId: xaiPhoneNumberId.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Number updated", description: `${agent.name} now answers on ${e164}.` });
        setOpen(false);
        onSaved();
      } else {
        toast({ title: "Could not update", description: data.error?.message || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not update", description: "Network error — try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{agent.name}</span>
              <Badge variant={agent.status === "LIVE" ? "default" : "secondary"} className={agent.status === "LIVE" ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                {agent.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{agent.user?.email || agent.user?.name || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-sm">{agent.currentE164 || "no number"}</p>
              {agent.currentXaiAgentId && <p className="font-mono text-[11px] text-muted-foreground">{agent.currentXaiAgentId}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Cancel" : "Replace number"}
            </Button>
          </div>
        </div>

        {open && (
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Assign a different line — releases it from any paused agent that still holds it. Keeps this agent&apos;s status.
            </p>
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
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="why the change" className="text-sm" />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={submit} disabled={saving} className="gap-2">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Saving…" : "Save number"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VoiceAgentsQueuePage() {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [live, setLive] = useState<LiveAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/voice-agent/agents");
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
        setLive(data.live || []);
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
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-6 w-6 text-brand-500" />
              <h1 className="text-2xl font-bold">Phone Agent Requests</h1>
              {!loading && requests.length > 0 && <Badge variant="secondary">{requests.length}</Badge>}
            </div>
            <p className="mt-1 text-muted-foreground">
              Each request is a ready-to-build console sheet. Build the agent in the console, then approve with its
              number + id to activate it.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://console.x.ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors hover:bg-muted"
          >
            xAI console <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button variant="outline" onClick={fetchRequests} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Direct SIP — client-provided numbers waiting to be connected (one click). */}
      <NumberConnectPanel />

      {/* Body */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-32 w-full" />
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

      {/* Approved agents — edit / replace the line they answer on */}
      {!loading && live.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Live agents</h2>
            <Badge variant="secondary">{live.length}</Badge>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">
            Change the number an agent answers on — e.g. after re-provisioning it in the console.
          </p>
          {live.map((a) => (
            <LiveAgentCard key={a.id} agent={a} onSaved={fetchRequests} />
          ))}
        </div>
      )}
    </div>
  );
}
