"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Workflow, MessageSquare, Mail, MessageCircle, GitBranch, Plus, Pause,
  Save, X, Users, User, Layers, Repeat, Rocket, RefreshCw, Target, CheckCircle2, Loader2,
  LayoutGrid, ChevronRight, UserRound, ArrowLeft, PhoneOutgoing, AlertTriangle, Link2,
} from "lucide-react";

import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { useCanvasPan } from "@/components/agent-home/shared/use-canvas-pan";

/**
 * Follow-ups — a multi-channel CAMPAIGN builder on the real outreach-sequence
 * engine (OutreachSequence + SequenceEnrollment, run by /api/sequences/run).
 *
 * Everything happens in the UI (no "build with AI" hand-off): start from a BRIEF
 * (name · goal · audience · one-time or recurring), lay out a draggable flow of
 * steps — CALL (your voice agent dials with a purpose) · SMS · Email · WhatsApp ·
 * a wait before each · a condition that gates the next step — then Save and
 * Activate. The audience is enrolled and the scheduler runs each step on time,
 * looping when the campaign is recurring. "Back office" shows live progress.
 * [[surface-buttons-are-ui-actions]] [[agent-operates-account-full-crud]]
 */

// ── flow types ────────────────────────────────────────────────────────────────
type Channel = "call" | "sms" | "email" | "whatsapp";
type NodeType = "audience" | Channel | "condition";
interface FlowNode {
  id: string; type: NodeType; x: number; y: number;
  wait?: number;            // days to wait before this step
  purpose?: string;         // call: what to accomplish
  subject?: string;         // email
  body?: string;            // sms / whatsapp / email body
  requires?: Channel | "any"; // condition: channel the contact must have to run the next step
}
interface FlowLink { from: string; to: string }

interface Seq {
  id: string; name: string; goal?: string; status: string; steps: string;
  audienceKind?: string; contactListId?: string | null; recurring?: boolean; recurrenceDays?: number;
  updatedAt?: string;
}
interface StepCfg { id: string; kind: string; title: string; delayDays?: number; purpose?: string; subject?: string; body?: string; requires?: string }
interface ContactOpt { id: string; name: string; email?: string | null; phone?: string | null }
interface ListOpt { id: string; name: string; totalCount: number }
type AudienceMode = "single" | "multi" | "segment";

const CH_META: Record<NodeType, { icon: ElementType; title: string; tag: string; tone: string }> = {
  audience:  { icon: UserRound,     title: "Audience",  tag: "WHO",   tone: "bg-violet-500/15 text-violet-400" },
  call:      { icon: PhoneOutgoing, title: "Call",      tag: "VOICE", tone: "bg-emerald-500/15 text-emerald-400" },
  sms:       { icon: MessageSquare, title: "SMS",       tag: "TEXT",  tone: "bg-cyan-500/15 text-cyan-400" },
  email:     { icon: Mail,          title: "Email",     tag: "MAIL",  tone: "bg-brand-500/15 text-brand-400" },
  whatsapp:  { icon: MessageCircle, title: "WhatsApp",  tag: "CHAT",  tone: "bg-green-500/15 text-green-500" },
  condition: { icon: GitBranch,     title: "Condition", tag: "GATE",  tone: "bg-amber-500/15 text-amber-500" },
};

const PALETTE: { type: NodeType; blurb: string }[] = [
  { type: "call", blurb: "Your voice agent dials with a purpose" },
  { type: "sms", blurb: "A text message" },
  { type: "email", blurb: "An email (subject + body)" },
  { type: "whatsapp", blurb: "A WhatsApp message" },
  { type: "condition", blurb: "Only run the next step if reachable" },
];

const REQUIRES = [
  { v: "any", label: "any channel" },
  { v: "email", label: "an email address" },
  { v: "sms", label: "a phone number" },
  { v: "whatsapp", label: "WhatsApp" },
];

// Starting points seeded into the brief.
interface Preset { key: string; title: string; desc: string; goal: string; steps: () => FlowNode[] }
let _seq = 0;
const nid = (t: string) => `${t}_${(_seq++).toString(36)}_${Date.now() % 100000}`;
const step = (type: NodeType, x: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id: nid(type), type, x, y: 150, wait: 0, ...extra });

const PRESETS: Preset[] = [
  { key: "nurture", title: "Nurture new leads", desc: "Welcome → follow-up call → check-in", goal: "Introduce the business, build rapport, and move them toward a first booking.",
    steps: () => [step("email", 400, { subject: "Great to meet you", body: "Hi {{first_name}}, thanks for connecting — here's what we can do for you." }), step("call", 730, { wait: 2, purpose: "Introduce the business, answer questions, and offer to book a first consultation." }), step("sms", 1060, { wait: 3, body: "Hi {{first_name}}, following up — want me to book you in this week?" })] },
  { key: "winback", title: "Win back", desc: "Text → wait → call the ones who don't reply", goal: "Re-engage lapsed customers and get them to come back with an offer.",
    steps: () => [step("sms", 400, { body: "Hi {{first_name}}, we miss you! Here's 15% off your next order." }), step("call", 730, { wait: 3, purpose: "Reconnect, remind them of the offer, and book them back in." })] },
  { key: "reminder", title: "Appointment reminder", desc: "Confirm by text, then a reminder call", goal: "Confirm the upcoming appointment and reduce no-shows.",
    steps: () => [step("sms", 400, { body: "Hi {{first_name}}, confirming your appointment. Reply YES to confirm." }), step("call", 730, { wait: 1, purpose: "Confirm the appointment time and answer any questions before it." })] },
  { key: "sell", title: "Sell / upsell", desc: "Call to pitch, follow up by email", goal: "Pitch the offer on a call and close, following up with details by email.",
    steps: () => [step("call", 400, { purpose: "Pitch the offer, handle objections, and close — or book a follow-up." }), step("email", 730, { wait: 1, subject: "The details we discussed", body: "Hi {{first_name}}, as promised, here are the details from our call." })] },
  { key: "collect", title: "Collect details", desc: "Call to gather info, save it back", goal: "Call to collect the missing details (needs, budget, timing) and save them.",
    steps: () => [step("call", 400, { purpose: "Politely collect their requirements, budget, and timeline, and confirm next steps." })] },
  { key: "blank", title: "Start blank", desc: "Build it from scratch", goal: "",
    steps: () => [] },
];

// ── canvas <-> engine serialization ──────────────────────────────────────────
const KIND_LABEL: Record<string, string> = { call: "Call", sms: "SMS", email: "Email", whatsapp: "WhatsApp", cond: "Condition" };

/** Walk the main chain from the audience node and flatten it to ordered steps. */
function nodesToSteps(nodes: FlowNode[], links: FlowLink[]): StepCfg[] {
  const aud = nodes.find((n) => n.type === "audience");
  if (!aud) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nextOf = (id: string) => links.find((l) => l.from === id)?.to;
  const out: StepCfg[] = [];
  const seen = new Set<string>();
  let cur = nextOf(aud.id);
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const n = byId.get(cur);
    if (n) {
      if (n.type === "condition") {
        out.push({ id: n.id, kind: "cond", title: `Only if ${REQUIRES.find((r) => r.v === (n.requires || "any"))?.label || "reachable"}`, requires: n.requires === "any" ? undefined : n.requires });
      } else {
        out.push({ id: n.id, kind: n.type, title: `${CH_META[n.type].title}`, delayDays: n.wait || 0, purpose: n.purpose, subject: n.subject, body: n.body });
      }
    }
    cur = nextOf(cur);
  }
  return out;
}

/** Rebuild a draggable node chain from saved steps. */
function stepsToNodes(steps: StepCfg[]): { nodes: FlowNode[]; links: FlowLink[] } {
  const aud: FlowNode = { id: "aud", type: "audience", x: 80, y: 150 };
  const nodes: FlowNode[] = [aud];
  const links: FlowLink[] = [];
  let prev = aud.id;
  steps.forEach((s, i) => {
    const type = (s.kind === "cond" ? "condition" : s.kind) as NodeType;
    if (!CH_META[type]) return;
    const n: FlowNode = { id: s.id || nid(type), type, x: 80 + 330 * (i + 1), y: 150, wait: s.delayDays || 0, purpose: s.purpose, subject: s.subject, body: s.body, requires: (s.requires as Channel) || "any" };
    nodes.push(n);
    links.push({ from: prev, to: n.id });
    prev = n.id;
  });
  return { nodes, links };
}

function timeAgo(iso?: string): string { if (!iso) return ""; try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; } }

// ── component ────────────────────────────────────────────────────────────────
export function FocusedAutomations({ refreshKey }: {
  refreshKey?: number; onAsk?: (prompt: string) => void; agentBusy?: boolean;
  canvasRef?: { current: unknown }; onOpenView?: (key: string) => void;
}) {
  const { toast } = useToast();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Seq[]>([]);
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [lists, setLists] = useState<ListOpt[]>([]);
  // Which channels can actually send right now (so the flow can warn about steps
  // that would silently wait). call = a LIVE voice agent with a number.
  const [ready, setReady] = useState<{ call: boolean; sms: boolean; email: boolean; whatsapp: boolean }>({ call: false, sms: false, email: false, whatsapp: false });

  // the campaign being edited
  const [seqId, setSeqId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState("draft");
  const [audMode, setAudMode] = useState<AudienceMode>("single");
  const [single, setSingle] = useState<ContactOpt | null>(null);
  const [selected, setSelected] = useState<ContactOpt[]>([]);
  const [segment, setSegment] = useState<string | null>(null); // contactListId
  const [recurring, setRecurring] = useState(false);
  const [everyDays, setEveryDays] = useState(30);
  const [bookingLink, setBookingLink] = useState(""); // optional — offered on calls + {{booking_link}} in messages
  const [startAt, setStartAt] = useState(""); // optional datetime-local — when the campaign begins (else now)

  const [nodes, setNodes] = useState<FlowNode[]>([{ id: "aud", type: "audience", x: 80, y: 150 }]);
  const [links, setLinks] = useState<FlowLink[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [paletteAt, setPaletteAt] = useState<{ afterId: string; x: number; y: number } | null>(null);

  const [briefOpen, setBriefOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const wireRef = useRef<SVGSVGElement>(null);
  const pan = useCanvasPan(scrollRef);

  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sq, ct, ls, ch, ag] = await Promise.all([
        fetch("/api/sequences").then((r) => r.json()).catch(() => null),
        fetch("/api/contacts?limit=50").then((r) => r.json()).catch(() => null),
        fetch("/api/contact-lists").then((r) => r.json()).catch(() => null),
        fetch("/api/sequences/channels").then((r) => r.json()).catch(() => null),
        fetch("/api/voice-agent/agents").then((r) => r.json()).catch(() => null),
      ]);
      const chd = ch?.data || {};
      const agents = Array.isArray(ag?.agents) ? ag.agents : [];
      setReady({
        call: agents.some((a: Record<string, unknown>) => a.status === "LIVE" && a.number),
        sms: !!chd.sms, email: !!chd.email, whatsapp: !!chd.whatsapp,
      });
      const seqs: Seq[] = (sq?.data?.sequences || []).filter((s: Seq) => (s.audienceKind || "contact") === "contact");
      setCampaigns(seqs);
      const cs: ContactOpt[] = (ct?.contacts || ct?.data?.contacts || []).map((c: Record<string, unknown>) => ({ id: String(c.id), name: String(c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Contact"), email: (c.email as string) || null, phone: (c.phone as string) || null }));
      setContacts(cs);
      const lo: ListOpt[] = (ls?.data?.lists || ls?.lists || []).map((l: Record<string, unknown>) => ({ id: String(l.id), name: String(l.name), totalCount: Number(l.totalCount || l.count || 0) }));
      setLists(lo);
      // Nothing built yet → straight into the brief.
      if (!seqs.length) { resetDraft(); setBriefOpen(true); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  // ── wires ──
  const recompute = useCallback(() => {
    const board = boardRef.current, svg = wireRef.current; if (!board || !svg) return;
    const b = board.getBoundingClientRect();
    const at = (id: string, side: "l" | "r") => { const el = board.querySelector(`[data-node="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: (side === "r" ? r.right : r.left) - b.left, y: r.top - b.top + r.height / 2 }; };
    let d = "";
    for (const l of links) { const a = at(l.from, "r"), c = at(l.to, "l"); if (!a || !c) continue; const dx = Math.max(38, (c.x - a.x) / 2); d += `<path fill="none" stroke="var(--sms-wire,#2a3550)" stroke-width="2.5" d="M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${c.x - dx} ${c.y}, ${c.x} ${c.y}"/>`; }
    svg.innerHTML = d;
  }, [links]);
  // Draw AFTER layout (double rAF) and whenever the canvas becomes visible again
  // (e.g. the brief sheet closes) — otherwise the wires compute against a hidden
  // board and render blank until the next interaction.
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(recompute); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [recompute, nodes, briefOpen, backOpen]);
  useEffect(() => { const onR = () => recompute(); window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR); }, [recompute]);

  // ── node ops ──
  const patchNode = useCallback((id: string, p: Partial<FlowNode>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...p } : n))), []);
  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setLinks((ls) => { const inc = ls.find((l) => l.to === id); const out = ls.find((l) => l.from === id); let next = ls.filter((l) => l.from !== id && l.to !== id); if (inc && out) next = [...next, { from: inc.from, to: out.to }]; return next; });
    if (selId === id) setSelId(null);
  }, [selId]);
  const insertAfter = (afterId: string, type: NodeType) => {
    const src = nodes.find((n) => n.id === afterId); if (!src) return;
    const nn = step(type, src.x + 330, { y: src.y + 20 });
    setNodes((ns) => [...ns, nn]);
    setLinks((ls) => { const old = ls.find((l) => l.from === afterId); let next = ls.filter((l) => l.from !== afterId); next = [...next, { from: afterId, to: nn.id }]; if (old) next = [...next, { from: nn.id, to: old.to }]; return next; });
    setPaletteAt(null); setSelId(nn.id);
  };

  function resetDraft() {
    setSeqId(null); setName(""); setGoal(""); setStatus("draft"); setAudMode("single"); setSingle(null); setSelected([]); setSegment(null);
    setRecurring(false); setEveryDays(30); setBookingLink(""); setStartAt(""); setNodes([{ id: "aud", type: "audience", x: 80, y: 150 }]); setLinks([]); setSelId(null);
  }

  /** Bake the booking link into the steps: replace {{booking_link}} everywhere and,
   *  for call steps, offer it as part of the agent's goal. */
  function withBookingLink(steps: StepCfg[]): StepCfg[] {
    const link = bookingLink.trim();
    if (!link) return steps;
    const sub = (t?: string) => (t ? t.replace(/\{\{\s*booking_link\s*\}\}/gi, link) : t);
    return steps.map((s) => {
      const purpose = s.kind === "call" ? `${sub(s.purpose) || ""}${(s.purpose || "").toLowerCase().includes(link.toLowerCase()) ? "" : ` If they'd like to book, offer this link: ${link}.`}`.trim() : sub(s.purpose);
      return { ...s, body: sub(s.body), subject: sub(s.subject), purpose };
    });
  }

  function openCampaign(s: Seq) {
    setSeqId(s.id); setName(s.name); setGoal(s.goal || ""); setStatus(s.status);
    setRecurring(!!s.recurring); setEveryDays(s.recurrenceDays || 30);
    setSegment(s.contactListId || null); setAudMode(s.contactListId ? "segment" : "single");
    let steps: StepCfg[] = []; try { steps = JSON.parse(s.steps || "[]"); } catch { steps = []; }
    const { nodes: nn, links: ll } = stepsToNodes(steps);
    setNodes(nn); setLinks(ll); setSelId(null); setLibOpen(false); setBriefOpen(false);
  }

  const audienceCount = audMode === "single" ? (single ? 1 : 0) : audMode === "multi" ? selected.length : (lists.find((l) => l.id === segment)?.totalCount || 0);
  const audienceLabel = audMode === "single" ? (single?.name || "Pick a contact") : audMode === "multi" ? `${selected.length} selected` : (lists.find((l) => l.id === segment)?.name || "Pick a list");

  // Channels this flow uses that can't send yet — the campaign will still enroll,
  // but those steps wait until the channel is connected. This is what was silently
  // missing before (a call/SMS step with no live agent / no number just parks).
  const usedChannels = Array.from(new Set(nodes.filter((n) => n.type !== "audience" && n.type !== "condition").map((n) => n.type as Channel)));
  const notReady = usedChannels.filter((c) => !ready[c]);
  const SETUP_HINT: Record<Channel, string> = { call: "Go to Call agent, give it a number and switch it live.", sms: "Go to Grow → SMS and set up a sender number.", email: "Go to Grow → Email and connect a sender.", whatsapp: "Connect a WhatsApp Business number." };

  // ── save / activate ──
  async function save(then?: "activate"): Promise<string | null> {
    const steps = withBookingLink(nodesToSteps(nodes, links));
    setBusy(true); setFlash(null);
    try {
      const body: Record<string, unknown> = {
        id: seqId || undefined, name: name.trim() || "Follow-up campaign", goal: goal.trim(),
        audienceKind: "contact", steps, recurring, recurrenceDays: recurring ? everyDays : 0,
        contactListId: audMode === "segment" ? segment : null,
      };
      const r = await fetch("/api/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
      if (!r?.success) { setFlash({ ok: false, text: r?.error?.message || "Could not save the campaign" }); return null; }
      const id = r.data.sequence.id as string; setSeqId(id); setStatus(r.data.sequence.status);
      if (then === "activate") return id;
      setFlash({ ok: true, text: "Saved." }); void load();
      return id;
    } catch { setFlash({ ok: false, text: "Could not save the campaign" }); return null; } finally { setBusy(false); }
  }

  async function activate() {
    if (!nodesToSteps(nodes, links).length) { toast({ title: "Add at least one step before launching.", variant: "destructive" }); return; }
    const id = await save("activate"); if (!id) return;
    // Resolve the audience selection into an enrollment target set.
    const contactIds = audMode === "single" ? (single ? [single.id] : []) : audMode === "multi" ? selected.map((c) => c.id) : [];
    if (audMode !== "segment" && contactIds.length === 0) { toast({ title: "Pick who this targets first.", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const startISO = startAt ? new Date(startAt).toISOString() : undefined;
      const r = await fetch(`/api/sequences/${id}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactIds: audMode === "segment" ? undefined : contactIds, startAt: startISO }) }).then((x) => x.json());
      if (r?.success) {
        setStatus("active");
        // Fire the first due steps NOW rather than waiting for the 5-min scheduler.
        void fetch("/api/sequences/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
        const skip = r.data.skipped ? `, ${r.data.skipped} skipped (no email/phone)` : "";
        const wait = notReady.length ? ` ${notReady.map((c) => CH_META[c].title).join(" & ")} step${notReady.length > 1 ? "s" : ""} will wait until you connect ${notReady.length > 1 ? "those channels" : "that channel"}.` : " The first step is running now.";
        setFlash({ ok: true, text: `Live — ${r.data.enrolled} enrolled${skip}.${wait}` });
        void load();
      }
      else setFlash({ ok: false, text: r?.error?.message || "Could not activate" });
    } catch { setFlash({ ok: false, text: "Could not activate" }); } finally { setBusy(false); }
  }

  async function pause() {
    if (!seqId) return; setBusy(true);
    try { const r = await fetch(`/api/sequences/${seqId}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: true }) }).then((x) => x.json()); if (r?.success) { setStatus("paused"); setFlash({ ok: true, text: "Paused." }); void load(); } } finally { setBusy(false); }
  }

  const header = headerSlot && createPortal(
    <div className="flex items-center gap-2">
      <button onClick={() => { resetDraft(); setBriefOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12.5px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> New campaign</button>
      <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><LayoutGrid className="h-3.5 w-3.5" /> Campaigns</button>
    </div>, headerSlot);

  if (loading) return <div className="grid h-full place-items-center"><FlowLoader /></div>;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {header}

      {/* flow header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-violet-500/15 text-violet-400"><Workflow className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled campaign" className="w-full truncate bg-transparent text-[14px] font-bold outline-none placeholder:text-muted-foreground/60" />
          <p className="truncate text-[11px] text-muted-foreground">{goal || "No goal yet — open the brief to set one"}{recurring ? ` · repeats every ${everyDays}d` : " · one-time"}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold", status === "active" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : status === "paused" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground")}>
          <i className={cn("h-1.5 w-1.5 rounded-full", status === "active" && "animate-pulse bg-emerald-500", status === "paused" && "bg-amber-500")} /> {status.toUpperCase()}
        </span>
        <button onClick={() => setBriefOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500"><Target className="h-3.5 w-3.5" /> Brief</button>
        {seqId && <button onClick={() => setBackOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500"><LayoutGrid className="h-3.5 w-3.5" /> Back office</button>}
      </div>

      {/* channel-readiness banner — a step whose channel isn't connected will wait */}
      {notReady.length > 0 && (
        <div className="flex items-start gap-2.5 border-b border-amber-500/25 bg-amber-500/[0.06] px-4 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">{notReady.map((c) => CH_META[c].title).join(" & ")} {notReady.length > 1 ? "aren't" : "isn't"} set up yet.</b> The campaign still enrolls, but {notReady.length > 1 ? "those steps" : "that step"} will wait until connected. {notReady.map((c) => SETUP_HINT[c]).join(" ")}
          </p>
        </div>
      )}

      {/* CANVAS */}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle, var(--sms-dot, rgba(120,130,150,.16)) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={scrollRef} onPointerDown={pan} className="absolute inset-0 cursor-grab overflow-auto">
          <div ref={boardRef} className="relative" style={{ width: 2600, height: 1200 }}>
            <svg ref={wireRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }} />
            {nodes.map((n) => (
              <NodeCard key={n.id} node={n} selected={selId === n.id} audienceMode={audMode} audienceLabel={audienceLabel} audienceCount={audienceCount}
                onSelect={() => setSelId(n.id)} onMove={recompute} onPatch={(p) => patchNode(n.id, p)} onDelete={() => deleteNode(n.id)}
                onOpenAudience={() => setBriefOpen(true)}
                onAddAfter={() => { const el = boardRef.current?.querySelector(`[data-node="${n.id}"]`) as HTMLElement | null; const r = el?.getBoundingClientRect(); const br = boardRef.current?.getBoundingClientRect(); setPaletteAt({ afterId: n.id, x: (r && br ? r.left - br.left + r.width + 8 : n.x + 260), y: (r && br ? r.top - br.top : n.y) }); }} />
            ))}
          </div>
        </div>

        {paletteAt && (
          <>
            <button aria-label="Close" className="absolute inset-0 z-10 cursor-default" onClick={() => setPaletteAt(null)} />
            <div className="absolute z-20 w-[248px] rounded-2xl border border-border bg-card p-1.5 shadow-2xl" style={{ left: Math.min(paletteAt.x, 2200), top: Math.min(paletteAt.y, 900) }}>
              <p className="px-2 pb-1 pt-1.5 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Add a step</p>
              {PALETTE.map((p) => { const M = CH_META[p.type]; return (
                <button key={p.type} onClick={() => insertAfter(paletteAt.afterId, p.type)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60">
                  <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-lg", M.tone)}><M.icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0"><b className="block text-[11.5px]">{M.title}</b><span className="block text-[9.5px] text-muted-foreground">{p.blurb}</span></span>
                </button>
              ); })}
            </div>
          </>
        )}

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">Drag empty space to pan · drag a node to move it · click ＋ on a node to add a step after it</div>
      </div>

      {/* bottom bar */}
      <div className="flex flex-col gap-2 border-t border-border bg-card px-4 py-2.5">
        {flash && (
          <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11.5px]", flash.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" : "border-rose-500/30 bg-rose-500/5 text-rose-500")}>
            {flash.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}<span>{flash.text}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11.5px] text-muted-foreground">
            <b className="text-foreground">{nodesToSteps(nodes, links).length}</b> step{nodesToSteps(nodes, links).length === 1 ? "" : "s"} · <b className="text-foreground">{audienceCount}</b> {audMode === "segment" ? "in list" : "target" + (audienceCount === 1 ? "" : "s")}{recurring ? " · recurring" : ""}
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</button>
            {status === "active" ? (
              <button onClick={() => void pause()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-[12.5px] font-bold text-amber-600 disabled:opacity-50"><Pause className="h-3.5 w-3.5" /> Pause</button>
            ) : (
              <button onClick={() => void activate()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} Activate</button>
            )}
          </div>
        </div>
      </div>

      {briefOpen && (
        <BriefSheet
          name={name} setName={setName} goal={goal} setGoal={setGoal}
          audMode={audMode} setAudMode={setAudMode} single={single} selected={selected} segment={segment} lists={lists}
          onPick={() => setPickerOpen(true)} recurring={recurring} setRecurring={setRecurring} everyDays={everyDays} setEveryDays={setEveryDays}
          bookingLink={bookingLink} setBookingLink={setBookingLink} startAt={startAt} setStartAt={setStartAt}
          hasSteps={nodesToSteps(nodes, links).length > 0}
          onPreset={(p) => {
            if (p.key !== "blank" && !name.trim()) setName(p.title);
            setGoal(p.goal || goal);
            const aud: FlowNode = { id: "aud", type: "audience", x: 80, y: 150 };
            const laid = p.steps().map((n, i) => ({ ...n, x: 80 + 330 * (i + 1), y: 150 }));
            const ll: FlowLink[] = []; let prev = aud.id;
            for (const n of laid) { ll.push({ from: prev, to: n.id }); prev = n.id; }
            setNodes([aud, ...laid]); setLinks(ll);
          }}
          onClose={() => setBriefOpen(false)}
          onSave={async () => { await save(); setBriefOpen(false); }}
        />
      )}

      {pickerOpen && (
        <AudiencePicker mode={audMode} contacts={contacts} lists={lists} single={single} selected={selected} segment={segment}
          onSingle={(c) => { setSingle(c); setPickerOpen(false); }} onSelected={setSelected} onSegment={(id) => { setSegment(id); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)} />
      )}

      {backOpen && seqId && <BackOffice seqId={seqId} name={name} onClose={() => setBackOpen(false)} />}

      {libOpen && (
        <Library campaigns={campaigns} onOpen={openCampaign} onClose={() => setLibOpen(false)} onNew={() => { resetDraft(); setLibOpen(false); setBriefOpen(true); }} />
      )}
    </div>
  );
}

// ── brief sheet (canonical bottom-sheet) ─────────────────────────────────────
function BriefSheet(props: {
  name: string; setName: (v: string) => void; goal: string; setGoal: (v: string) => void;
  audMode: AudienceMode; setAudMode: (m: AudienceMode) => void; single: ContactOpt | null; selected: ContactOpt[]; segment: string | null; lists: ListOpt[];
  onPick: () => void; recurring: boolean; setRecurring: (v: boolean) => void; everyDays: number; setEveryDays: (v: number) => void;
  bookingLink: string; setBookingLink: (v: string) => void; startAt: string; setStartAt: (v: string) => void;
  hasSteps: boolean; onPreset: (p: Preset) => void; onClose: () => void; onSave: () => Promise<void>;
}) {
  const { name, setName, goal, setGoal, audMode, setAudMode, single, selected, segment, lists, onPick, recurring, setRecurring, everyDays, setEveryDays, bookingLink, setBookingLink, startAt, setStartAt, hasSteps, onPreset, onClose, onSave } = props;
  const [saving, setSaving] = useState(false);
  const audienceLabel = audMode === "single" ? (single?.name || "Pick a contact") : audMode === "multi" ? (selected.length ? `${selected.length} selected` : "Select contacts") : (lists.find((l) => l.id === segment)?.name || "Pick a list");
  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-violet-400">BRIEF</span>
          <h3 className="text-[14px] font-bold">{hasSteps ? "Edit campaign" : "New follow-up campaign"}</h3>
          <button onClick={onClose} className="ml-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {!hasSteps && (
            <div>
              <SectionLabel>Start from</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PRESETS.map((p) => (
                  <button key={p.key} onClick={() => onPreset(p)} className="rounded-xl border border-border bg-muted/30 p-3 text-left hover:border-brand-500">
                    <b className="block text-[12.5px]">{p.title}</b>
                    <span className="block text-[10.5px] text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div><SectionLabel>Campaign name</SectionLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Win back lapsed customers" className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" /></div>
          <div><SectionLabel hint="what you want this campaign to achieve — the agent uses it on calls">Goal</SectionLabel>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="e.g. Reconnect and book them in for a consultation" className="w-full resize-y rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" /></div>
          <div><SectionLabel>Who this targets</SectionLabel>
            <div className="mb-2 inline-flex rounded-lg border border-border p-0.5">
              {([["single", "One contact", User], ["multi", "Selected", Users], ["segment", "A list", Layers]] as const).map(([m, label, Icon]) => (
                <button key={m} onClick={() => setAudMode(m)} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold", audMode === m ? "bg-brand-500/15 text-brand-400" : "text-muted-foreground")}><Icon className="h-3.5 w-3.5" /> {label}</button>
              ))}
            </div>
            <button onClick={onPick} className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-[12.5px] hover:border-brand-500">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-500/15 text-violet-400"><UserRound className="h-3.5 w-3.5" /></span>
              <span className="flex-1 truncate">{audienceLabel}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div><SectionLabel>Cadence</SectionLabel>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setRecurring(false)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold", !recurring ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border text-muted-foreground")}>One-time</button>
              <button onClick={() => setRecurring(true)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold", recurring ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border text-muted-foreground")}><Repeat className="h-3.5 w-3.5" /> Recurring</button>
              {recurring && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">every
                  <input value={everyDays} onChange={(e) => setEveryDays(Math.max(1, Math.min(365, Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))} className="w-[56px] rounded-lg border border-border bg-muted/40 px-2 py-1 text-center text-[12px] outline-none focus:border-brand-500" /> days
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><SectionLabel hint="when the campaign begins — leave empty to start now">Start</SectionLabel>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" />
            </div>
            <div><SectionLabel hint="offered on calls + use {{booking_link}} in messages">Booking link</SectionLabel>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 focus-within:border-brand-500">
                <Link2 className="h-4 w-4 flex-none text-muted-foreground" />
                <input value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} placeholder="https://cal.com/you/consult" className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/50" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted-foreground">Nothing sends until you Activate.</span>
          <button onClick={async () => { setSaving(true); await onSave(); setSaving(false); }} disabled={saving || !name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save &amp; build the flow</button>
        </div>
      </div>
    </div>
  );
}

// ── draggable node card ──────────────────────────────────────────────────────
function NodeCard({ node, selected, audienceMode, audienceLabel, audienceCount, onSelect, onMove, onPatch, onDelete, onAddAfter, onOpenAudience }: {
  node: FlowNode; selected: boolean; audienceMode: AudienceMode; audienceLabel: string; audienceCount: number;
  onSelect: () => void; onMove: () => void; onPatch: (p: Partial<FlowNode>) => void; onDelete: () => void; onAddAfter: () => void; onOpenAudience: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const M = CH_META[node.type];
  const start = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    onSelect();
    const card = ref.current; if (!card) return;
    const sx = e.clientX, sy = e.clientY, ox = node.x, oy = node.y;
    const mv = (ev: PointerEvent) => { card.style.left = `${ox + ev.clientX - sx}px`; card.style.top = `${oy + ev.clientY - sy}px`; onMove(); };
    const up = (ev: PointerEvent) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); onPatch({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy }); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); e.preventDefault();
  };
  return (
    <div ref={ref} data-node={node.id} style={{ left: node.x, top: node.y, width: 250 }}
      className={cn("absolute rounded-2xl border bg-card shadow-lg", selected ? "border-brand-500 shadow-[0_0_0_3px_rgba(79,140,255,.18)]" : "border-border")}>
      <div onPointerDown={start} className="flex cursor-grab items-center gap-2 border-b border-border px-3 py-2.5 active:cursor-grabbing">
        <span className={cn("grid h-6 w-6 flex-none place-items-center rounded-md", M.tone)}><M.icon className="h-3.5 w-3.5" /></span>
        <b className="flex-1 truncate text-[12.5px]">{M.title}</b>
        <span className={cn("rounded-full px-2 py-0.5 text-[8.5px] font-extrabold tracking-wider", M.tone)}>{M.tag}</span>
        {node.type !== "audience" && <button onClick={onDelete} title="Delete" className="grid h-[18px] w-[18px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>}
      </div>
      <div className="space-y-2 p-3">
        {node.type === "audience" && (
          <button onClick={onOpenAudience} className="w-full rounded-lg border border-dashed border-border px-2.5 py-2 text-left hover:border-brand-500">
            <div className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">{audienceMode === "segment" ? "List" : audienceMode === "multi" ? "Selected contacts" : "Contact"}</div>
            <div className="truncate text-[12px] font-semibold">{audienceLabel}</div>
            <div className="text-[10.5px] text-violet-400">{audienceCount.toLocaleString()} {audienceMode === "segment" ? "in list" : "target" + (audienceCount === 1 ? "" : "s")}</div>
          </button>
        )}

        {node.type !== "audience" && node.type !== "condition" && (
          <Labeled k="Wait before this step">
            <div className="flex items-center gap-1.5">
              <input value={node.wait ?? 0} onChange={(e) => onPatch({ wait: Math.max(0, Number(e.target.value.replace(/[^0-9]/g, "")) || 0) })} className="w-[60px] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500" />
              <span className="text-[11px] text-muted-foreground">days</span>
            </div>
          </Labeled>
        )}

        {node.type === "call" && (
          <Labeled k="What the agent should do">
            <textarea rows={3} value={node.purpose || ""} onChange={(e) => onPatch({ purpose: e.target.value })} placeholder="e.g. Follow up on their quote and book a consultation" className="w-full resize-y rounded-lg border border-border bg-muted/40 p-2 text-[11.5px] outline-none focus:border-brand-500" />
          </Labeled>
        )}
        {node.type === "email" && (<>
          <input value={node.subject || ""} onChange={(e) => onPatch({ subject: e.target.value })} placeholder="Subject" className="w-full rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500" />
          <textarea rows={3} value={node.body || ""} onChange={(e) => onPatch({ body: e.target.value })} placeholder="Email body — use {{first_name}}" className="w-full resize-y rounded-lg border border-border bg-muted/40 p-2 text-[11.5px] outline-none focus:border-brand-500" />
        </>)}
        {(node.type === "sms" || node.type === "whatsapp") && (
          <textarea rows={3} value={node.body || ""} onChange={(e) => onPatch({ body: e.target.value })} placeholder={node.type === "sms" ? "Text message — {{first_name}} supported" : "WhatsApp message"} className="w-full resize-y rounded-lg border border-border bg-muted/40 p-2 text-[11.5px] outline-none focus:border-brand-500" />
        )}
        {node.type === "condition" && (
          <Labeled k="Only run the next step if the contact has">
            <Select value={node.requires || "any"} onChange={(v) => onPatch({ requires: v as Channel })} options={REQUIRES} />
          </Labeled>
        )}
      </div>

      <div className="px-3 pb-3">
        <button onClick={onAddAfter} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-[10px] font-extrabold tracking-wide text-muted-foreground hover:border-brand-500 hover:text-brand-400"><Plus className="h-3 w-3" /> STEP AFTER</button>
      </div>
    </div>
  );
}

// ── audience picker ──────────────────────────────────────────────────────────
function AudiencePicker({ mode, contacts, lists, single, selected, segment, onSingle, onSelected, onSegment, onClose }: {
  mode: AudienceMode; contacts: ContactOpt[]; lists: ListOpt[]; single: ContactOpt | null; selected: ContactOpt[]; segment: string | null;
  onSingle: (c: ContactOpt) => void; onSelected: (cs: ContactOpt[]) => void; onSegment: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => contacts.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.email || "").toLowerCase().includes(q.toLowerCase())), [contacts, q]);
  const isSel = (id: string) => selected.some((c) => c.id === id);
  return (
    <div className="absolute inset-0 z-50">
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-3 bottom-3 top-14 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-8 sm:bottom-6">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h3 className="text-[13.5px] font-bold">{mode === "segment" ? "Pick a list" : mode === "multi" ? "Select contacts" : "Pick a contact"}</h3>
          <button onClick={onClose} className="ml-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {mode === "segment" ? (
            <div className="grid gap-2">
              {lists.length ? lists.map((l) => (
                <button key={l.id} onClick={() => onSegment(l.id)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left", segment === l.id ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-brand-500")}>
                  <Layers className="h-4 w-4 text-violet-400" /><b className="flex-1 text-[12.5px]">{l.name}</b><span className="text-[11px] text-muted-foreground">{l.totalCount} contacts</span>
                </button>
              )) : <p className="p-4 text-center text-[12px] text-muted-foreground">No lists yet — create one in Contacts.</p>}
            </div>
          ) : (<>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="mb-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px] outline-none focus:border-brand-500" />
            <div className="grid gap-1.5">
              {shown.map((c) => {
                const active = mode === "single" ? single?.id === c.id : isSel(c.id);
                return (
                  <button key={c.id} onClick={() => { if (mode === "single") onSingle(c); else onSelected(isSel(c.id) ? selected.filter((x) => x.id !== c.id) : [...selected, c]); }}
                    className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left", active ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-brand-500")}>
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">{c.name.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{c.name}</b><span className="block truncate text-[10.5px] text-muted-foreground">{c.email || c.phone || "No contact info"}</span></span>
                    {active && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
                  </button>
                );
              })}
              {!shown.length && <p className="p-4 text-center text-[12px] text-muted-foreground">No contacts found.</p>}
            </div>
          </>)}
        </div>
        {mode === "multi" && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <span className="text-[11.5px] text-muted-foreground">{selected.length} selected</span>
            <button onClick={onClose} className="rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-[12px] font-bold text-white">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── back office ──────────────────────────────────────────────────────────────
function BackOffice({ seqId, name, onClose }: { seqId: string; name: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<Record<string, number>>({});
  const [seq, setSeq] = useState<Seq | null>(null);
  const reload = useCallback(async () => { setLoading(true); try { const r = await fetch(`/api/sequences/${seqId}`).then((x) => x.json()); if (r?.success) { setEnroll(r.data.enrollments || {}); setSeq(r.data.sequence); } } finally { setLoading(false); } }, [seqId]);
  useEffect(() => { void reload(); }, [reload]);
  let steps: StepCfg[] = []; try { steps = JSON.parse(seq?.steps || "[]"); } catch { steps = []; }
  const total = Object.values(enroll).reduce((a, b) => a + b, 0);
  const cards = [
    { k: "Enrolled", v: total, tone: "" },
    { k: "In progress", v: enroll.active || 0, tone: "text-brand-500" },
    { k: "Completed", v: enroll.completed || 0, tone: "text-emerald-500" },
    { k: "Waiting", v: enroll.waiting || 0, tone: "text-amber-500" },
    { k: "Stopped", v: enroll.stopped || 0, tone: "text-muted-foreground" },
  ];
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1"><h3 className="truncate text-[14px] font-bold">{name || "Campaign"}</h3><p className="text-[11.5px] text-muted-foreground">Back office · live progress</p></div>
        <button onClick={() => void reload()} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><RefreshCw className="h-3.5 w-3.5" /></button>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? <div className="grid place-items-center py-16"><FlowLoader /></div> : (<>
          <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.k} className="rounded-xl border border-border bg-card p-3">
                <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-muted-foreground">{c.k}</div>
                <div className={cn("mt-0.5 text-[20px] font-extrabold tabular-nums", c.tone)}>{c.v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-3 py-2.5"><b className="text-[12.5px]">The flow</b> <span className="text-[11px] text-muted-foreground">· {steps.length} steps{seq?.recurring ? ` · repeats every ${seq.recurrenceDays}d` : ""}</span></div>
            {steps.length ? steps.map((s, i) => (
              <div key={s.id || i} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1"><b className="text-[12px]">{KIND_LABEL[s.kind] || s.kind}</b> <span className="text-[11px] text-muted-foreground">{s.delayDays ? `· after ${s.delayDays}d` : "· immediately"}</span>
                  <div className="truncate text-[10.5px] text-muted-foreground">{s.purpose || s.subject || s.body || (s.kind === "cond" ? s.title : "")}</div>
                </div>
              </div>
            )) : <p className="p-4 text-center text-[12px] text-muted-foreground">No steps.</p>}
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── library ──────────────────────────────────────────────────────────────────
function Library({ campaigns, onOpen, onClose, onNew }: { campaigns: Seq[]; onOpen: (s: Seq) => void; onClose: () => void; onNew: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h3 className="flex-1 text-[14px] font-bold">Campaigns</h3>
        <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> New</button>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {campaigns.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((s) => {
              let n = 0; try { n = JSON.parse(s.steps || "[]").length; } catch { n = 0; }
              return (
                <button key={s.id} onClick={() => onOpen(s)} className="rounded-xl border border-border bg-card p-3 text-left hover:border-brand-500">
                  <div className="flex items-center gap-2">
                    <b className="flex-1 truncate text-[13px]">{s.name}</b>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-extrabold", s.status === "active" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : s.status === "paused" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground")}>{s.status.toUpperCase()}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.goal || "No goal set"}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground"><Workflow className="h-3 w-3" /> {n} steps{s.recurring ? " · recurring" : ""} · {timeAgo(s.updatedAt)}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid place-items-center py-16 text-center">
            <Workflow className="mb-2 h-8 w-8 text-muted-foreground" />
            <b className="text-[13px]">No campaigns yet</b>
            <p className="mt-1 max-w-[320px] text-[11.5px] text-muted-foreground">Build a multi-channel follow-up that calls, texts, and emails your contacts on a schedule.</p>
            <button onClick={onNew} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-bold text-white"><Plus className="h-4 w-4" /> New campaign</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────────────────
function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className="mb-1.5 flex items-baseline gap-2"><span className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">{children}</span>{hint && <span className="text-[9.5px] text-muted-foreground/70">{hint}</span>}</div>;
}
function Labeled({ k, children }: { k: string; children: ReactNode }) {
  return <div><div className="mb-1 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">{k}</div>{children}</div>;
}
function Select({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500">{options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select>;
}
function Check({ className }: { className?: string }) { return <CheckCircle2 className={className} />; }
