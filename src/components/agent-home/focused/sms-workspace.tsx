"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { MessageSquare, Sparkles, Phone, Send, CheckCircle2, Clock, Users, AlertTriangle, ShieldCheck, Gauge, XCircle, ExternalLink, ChevronRight, Trash2, MousePointerClick, CalendarClock, PenLine, Search, Pause, Play, RefreshCw, RotateCw, ShieldAlert, Hourglass, ListFilter, ClipboardList, X, UserRound, Timer, Plus, GitBranch, Zap, MessageCircle, Mail, Tag, UserPlus, Wand2 } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useCanvasPan } from "@/components/agent-home/shared/use-canvas-pan";
import { cn } from "@/lib/utils/cn";
import { SmsVerify } from "./sms-verify";

/**
 * SMS Studio — a real in-UI flow builder (same canvas pattern as the Call agent):
 * data-driven draggable nodes, insert-a-step after any node, if/else branches,
 * multi-channel actions, and message copy drafted inline (no agent hand-off).
 * Everything happens in the UI. The back office (blasts + carrier registration +
 * release) lives in a slide-over. Runs on Telnyx.
 * [[surface-buttons-are-ui-actions]] [[sms-studio-telnyx-redesign]]
 */

// ── data types (back office) ────────────────────────────────────────────────
interface SmsCampaign {
  id: string; name: string; status: string;
  audience?: number; sent?: number; delivered?: number; failed?: number; clicked?: number; unsubscribed?: number;
  messageLength?: number; segments?: number; scheduledAt?: string | null; sentAt?: string | null; createdAt?: string;
}
interface SmsCampaignDetail extends SmsCampaign {
  content?: string | null; contactList?: { id: string; name: string; totalCount?: number; activeCount?: number } | null; contactListId?: string | null;
}
interface SmsStats { total?: number; active?: number; sent?: number; draft?: number; }
interface NumberStatus { hasNumber: boolean; phoneNumber?: string; enabled?: boolean; verified?: boolean; monthlyLimit?: number | null; sentThisMonth?: number | null; }
interface A2pStatus { hasRegistration: boolean; brandStatus?: string | null; brandFailureReason?: string | null; campaignStatus?: string | null; campaignFailureReason?: string | null; isApproved?: boolean; }
interface TollfreeStatus { hasVerification: boolean; status?: string | null; rejectionReason?: string | null; }

// ── flow-builder types ──────────────────────────────────────────────────────
type NodeType = "audience" | "message" | "wait" | "condition" | "action" | "send";
interface FlowNode {
  id: string; type: NodeType; x: number; y: number;
  segment?: string; skipOptedOut?: boolean; dedupe?: boolean;
  text?: string; personalize?: boolean; generating?: boolean;
  amount?: string; unit?: string;
  on?: string;
  channel?: string; actionText?: string;
  schedule?: string; throttle?: string; quietHours?: boolean;
}
interface FlowLink { from: string; to: string; branch: "main" | "yes" | "no"; }

const NODE_META: Record<NodeType, { icon: ElementType; title: string; tag: string; tone: string; tagTone: string }> = {
  audience:  { icon: UserRound,     title: "Audience",  tag: "WHO",      tone: "bg-violet-500/15 text-violet-400",  tagTone: "bg-violet-500/15 text-violet-400" },
  message:   { icon: Sparkles,      title: "Message",   tag: "SMS COPY", tone: "bg-cyan-500/15 text-cyan-400",      tagTone: "bg-cyan-500/15 text-cyan-400" },
  wait:      { icon: Timer,         title: "Wait",      tag: "DELAY",    tone: "bg-brand-500/15 text-brand-400",    tagTone: "bg-brand-500/15 text-brand-400" },
  condition: { icon: GitBranch,     title: "If / else", tag: "BRANCH",   tone: "bg-amber-500/15 text-amber-500",    tagTone: "bg-amber-500/15 text-amber-500" },
  action:    { icon: Zap,           title: "Action",    tag: "DO",       tone: "bg-emerald-500/15 text-emerald-400",tagTone: "bg-emerald-500/15 text-emerald-400" },
  send:      { icon: Clock,         title: "Send",      tag: "SCHEDULE", tone: "bg-amber-500/15 text-amber-500",    tagTone: "bg-amber-500/15 text-amber-500" },
};

const SEGMENTS = ["Lapsed customers · 60+ days", "All opted-in subscribers", "VIPs · last 90 days", "New this month"];
const CONDITIONS = [
  { v: "delivered", label: "Message was delivered" },
  { v: "replied", label: "Contact replied" },
  { v: "clicked", label: "A link was clicked" },
  { v: "optout", label: "Contact opted out" },
];
const CHANNELS = [
  { v: "whatsapp", label: "Send a WhatsApp message", icon: MessageCircle },
  { v: "email", label: "Send an email", icon: Mail },
  { v: "tag", label: "Add a tag", icon: Tag },
  { v: "lead", label: "Add to Leads", icon: UserPlus },
];
const PALETTE: { type: NodeType; blurb: string }[] = [
  { type: "audience", blurb: "Who receives it — list or segment" },
  { type: "message", blurb: "SMS copy, written or AI-drafted" },
  { type: "wait", blurb: "Delay before the next step" },
  { type: "condition", blurb: "Branch on delivered · replied · clicked" },
  { type: "action", blurb: "WhatsApp · email · tag · add to Leads" },
  { type: "send", blurb: "Throttle + quiet hours" },
];

const DEFAULT_NODES: FlowNode[] = [
  { id: "aud", type: "audience", x: 80, y: 150, segment: SEGMENTS[0], skipOptedOut: true, dedupe: true },
  { id: "msg", type: "message", x: 400, y: 130, text: "Hi {first_name}, it's been a while! Here's 15% off your next order — reply STOP to opt out.", personalize: true },
  { id: "snd", type: "send", x: 720, y: 150, schedule: "now", throttle: "auto", quietHours: true },
];
const DEFAULT_LINKS: FlowLink[] = [
  { from: "aud", to: "msg", branch: "main" },
  { from: "msg", to: "snd", branch: "main" },
];
const FLOW_KEY = "fs.sms.flow.v1";

// ── back-office status helpers ──────────────────────────────────────────────
const STATUS_META: Record<string, { tone: string; icon: ElementType }> = {
  sent: { tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  active: { tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  sending: { tone: "bg-brand-500/10 text-brand-500", icon: Send },
  scheduled: { tone: "bg-brand-500/10 text-brand-500", icon: Clock },
  paused: { tone: "bg-amber-500/10 text-amber-500", icon: Clock },
  failed: { tone: "bg-rose-500/10 text-rose-500", icon: XCircle },
  draft: { tone: "bg-muted text-muted-foreground", icon: Clock },
};
const statusMeta = (s: string) => STATUS_META[s.toLowerCase()] ?? { tone: "bg-muted text-muted-foreground", icon: Clock };
function whenLabel(iso?: string | null): string { if (!iso) return ""; try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; } }
function dateTimeLabel(iso?: string | null): string { if (!iso) return ""; try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; } }
const SENDABLE = new Set(["draft", "scheduled", "paused", "failed"]);
const DELETABLE = new Set(["draft", "scheduled", "paused", "failed", "sending"]);
const PAUSABLE = new Set(["scheduled", "active"]);
const RESUMABLE = new Set(["paused"]);
const STATUS_FILTERS = [{ value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "scheduled", label: "Scheduled" }, { value: "paused", label: "Paused" }, { value: "sent", label: "Sent" }, { value: "failed", label: "Failed" }];
function regTone(status?: string | null): string {
  const s = (status || "").toUpperCase();
  if (["APPROVED", "VERIFIED", "SUCCESSFUL", "TWILIO_APPROVED"].includes(s)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
  if (["FAILED", "REJECTED", "TWILIO_REJECTED", "SUSPENDED"].includes(s)) return "border-rose-500/30 bg-rose-500/10 text-rose-500";
  return "border-amber-500/30 bg-amber-500/10 text-amber-500";
}
function regLabel(status?: string | null): string { if (!status) return "Not started"; return status.replace(/^TWILIO_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }
function isRegFailed(status?: string | null): boolean { return ["FAILED", "REJECTED", "TWILIO_REJECTED", "SUSPENDED"].includes((status || "").toUpperCase()); }
function isRegApproved(status?: string | null): boolean { return ["APPROVED", "VERIFIED", "SUCCESSFUL", "TWILIO_APPROVED"].includes((status || "").toUpperCase()); }


// ── component ────────────────────────────────────────────────────────────────
export function FocusedSms({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void; working?: boolean }) {
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [stats, setStats] = useState<SmsStats>({});
  const [number, setNumber] = useState<NumberStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [listLoading, setListLoading] = useState(false);

  const [a2p, setA2p] = useState<A2pStatus | null>(null);
  const [tollfree, setTollfree] = useState<TollfreeStatus | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const [confirmRelease, setConfirmRelease] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SmsCampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmSend, setConfirmSend] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [section, setSection] = useState<"blasts" | "registration">("blasts");
  const [backOpen, setBackOpen] = useState(false);

  // flow-builder state
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_NODES);
  const [links, setLinks] = useState<FlowLink[]>(DEFAULT_LINKS);
  const [selId, setSelId] = useState<string | null>("msg");
  const [paletteAt, setPaletteAt] = useState<{ afterId: string; branch: "main" | "yes" | "no"; x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const wireRef = useRef<SVGSVGElement>(null);
  const pan = useCanvasPan(scrollRef);
  const seq = useRef(0);

  // restore/save the flow locally so a build survives a reload
  useEffect(() => {
    try { const raw = localStorage.getItem(FLOW_KEY); if (raw) { const j = JSON.parse(raw); if (j.nodes?.length) { setNodes(j.nodes); setLinks(j.links || []); } } } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(FLOW_KEY, JSON.stringify({ nodes, links })); } catch { /* ignore */ } }, [nodes, links]);

  const loadNumber = useCallback(async () => {
    const nj = await fetch("/api/sms/numbers?action=current").then((r) => r.json()).catch(() => null);
    if (nj?.success && nj.data) setNumber(nj.data as NumberStatus);
  }, []);
  const loadCampaigns = useCallback(async () => {
    const params = new URLSearchParams({ type: "sms", limit: "30" });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const cj = await fetch(`/api/campaigns?${params.toString()}`).then((r) => r.json()).catch(() => null);
    if (cj?.success && cj.data) { if (Array.isArray(cj.data.campaigns)) setCampaigns(cj.data.campaigns as SmsCampaign[]); if (cj.data.stats) setStats(cj.data.stats as SmsStats); }
  }, [search, statusFilter]);
  const load = useCallback(async () => { await Promise.all([loadCampaigns(), loadNumber()]); }, [loadCampaigns, loadNumber]);
  const loadRegistration = useCallback(async () => {
    setRegLoading(true); setRegError(null);
    try {
      const [aj, tj] = await Promise.all([
        fetch("/api/sms/numbers/a2p-status").then((r) => r.json()).catch(() => null),
        fetch("/api/sms/numbers/verify").then((r) => r.json()).catch(() => null),
      ]);
      if (aj?.success && aj.data) setA2p(aj.data as A2pStatus);
      if (tj?.success && tj.data) setTollfree(tj.data as TollfreeStatus);
    } finally { setRegLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadCampaigns(), loadNumber(), loadRegistration()]).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadCampaigns, loadNumber, loadRegistration, refreshKey]);
  useEffect(() => {
    if (loading) return; let alive = true; setListLoading(true);
    loadCampaigns().finally(() => { if (alive) setListLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  // ── back-office mutations ──
  const openBlast = useCallback(async (c: SmsCampaign) => {
    setActionError(null); setConfirmSend(null); setConfirmDelete(null);
    if (openId === c.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(c.id); setDetail(null); setDetailLoading(true);
    try { const j = await fetch(`/api/campaigns/${c.id}`).then((r) => r.json()); if (j?.success && j.data?.campaign) setDetail(j.data.campaign as SmsCampaignDetail); }
    catch { /* fallback */ } finally { setDetailLoading(false); }
  }, [openId]);
  const sendBlast = useCallback(async (id: string) => {
    setBusyId(id); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send" }) }).then((r) => r.json()).catch(() => null);
      if (j?.success) { setConfirmSend(null); await load(); if (openId === id) { const dj = await fetch(`/api/campaigns/${id}`).then((r) => r.json()).catch(() => null); if (dj?.success && dj.data?.campaign) setDetail(dj.data.campaign as SmsCampaignDetail); } }
      else setActionError(j?.error?.message || "Could not send this blast.");
    } catch { setActionError("Could not send this blast."); } finally { setBusyId(null); }
  }, [load, openId]);
  const deleteBlast = useCallback(async (id: string) => {
    setBusyId(id); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
      if (j?.success) { setConfirmDelete(null); setCampaigns((prev) => prev.filter((c) => c.id !== id)); if (openId === id) { setOpenId(null); setDetail(null); } await load(); }
      else setActionError(j?.error?.message || "Could not delete this blast.");
    } catch { setActionError("Could not delete this blast."); } finally { setBusyId(null); }
  }, [load, openId]);
  const setBlastStatus = useCallback(async (id: string, nextStatus: "PAUSED" | "DRAFT") => {
    setBusyId(id); setActionError(null);
    try {
      const j = await fetch(`/api/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }).then((r) => r.json()).catch(() => null);
      if (j?.success) { await load(); if (openId === id) { const dj = await fetch(`/api/campaigns/${id}`).then((r) => r.json()).catch(() => null); if (dj?.success && dj.data?.campaign) setDetail(dj.data.campaign as SmsCampaignDetail); } }
      else setActionError(j?.error?.message || (nextStatus === "PAUSED" ? "Could not pause this blast." : "Could not resume this blast."));
    } catch { setActionError(nextStatus === "PAUSED" ? "Could not pause this blast." : "Could not resume this blast."); } finally { setBusyId(null); }
  }, [load, openId]);
  const releaseNumber = useCallback(async () => {
    setReleaseBusy(true); setReleaseError(null);
    try {
      const j = await fetch("/api/sms/numbers", { method: "DELETE" }).then((r) => r.json()).catch(() => null);
      if (j?.success) { setConfirmRelease(false); setA2p(null); setTollfree(null); await loadNumber(); }
      else setReleaseError(j?.error?.message || "Could not release this number.");
    } catch { setReleaseError("Could not release this number."); } finally { setReleaseBusy(false); }
  }, [loadNumber]);
  const retryA2pRegistration = useCallback(async () => {
    setRegBusy(true); setRegError(null);
    try {
      const j = await fetch("/api/sms/numbers/a2p-status", { method: "POST" }).then((r) => r.json()).catch(() => null);
      if (j?.success) await loadRegistration(); else setRegError(j?.error?.message || "Could not resubmit registration.");
    } catch { setRegError("Could not resubmit registration."); } finally { setRegBusy(false); }
  }, [loadRegistration]);

  // ── flow-builder ops (all in-UI) ──
  const recomputeWires = useCallback(() => {
    const board = boardRef.current, svg = wireRef.current; if (!board || !svg) return;
    const b = board.getBoundingClientRect();
    const at = (id: string, side: "l" | "r", yBias = 0.5) => {
      const el = board.querySelector(`[data-node="${id}"]`); if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: (side === "r" ? r.right : r.left) - b.left, y: r.top - b.top + r.height * yBias };
    };
    let d = "";
    for (const l of links) {
      const yb = l.branch === "yes" ? 0.72 : l.branch === "no" ? 0.86 : 0.5;
      const a = at(l.from, "r", yb), c = at(l.to, "l"); if (!a || !c) continue;
      const dx = Math.max(38, (c.x - a.x) / 2);
      const stroke = l.branch === "yes" ? "rgba(34,197,94,.55)" : l.branch === "no" ? "rgba(244,63,94,.5)" : "var(--sms-wire, #2a3550)";
      d += `<path fill="none" stroke="${stroke}" stroke-width="2.5" d="M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${c.x - dx} ${c.y}, ${c.x} ${c.y}"/>`;
      if (l.branch !== "main") { const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2 - 5; d += `<text x="${mx}" y="${my}" fill="#8b93a4" font-size="9" font-weight="800">${l.branch === "yes" ? "YES" : "NO"}</text>`; }
    }
    svg.innerHTML = d;
  }, [links]);
  useEffect(() => { recomputeWires(); }, [recomputeWires, nodes]);

  const patchNode = useCallback((id: string, patch: Partial<FlowNode>) => { setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n))); }, []);
  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setLinks((ls) => {
      const incoming = ls.find((l) => l.to === id); const outgoing = ls.find((l) => l.from === id && l.branch === "main");
      let next = ls.filter((l) => l.from !== id && l.to !== id);
      if (incoming && outgoing) next = [...next, { from: incoming.from, to: outgoing.to, branch: incoming.branch }];
      return next;
    });
    if (selId === id) setSelId(null);
  }, [selId]);
  const newNode = (type: NodeType, x: number, y: number): FlowNode => {
    const id = `${type}_${seq.current++}_${Date.now() % 100000}`;
    const base: FlowNode = { id, type, x, y };
    if (type === "audience") return { ...base, segment: SEGMENTS[0], skipOptedOut: true, dedupe: true };
    if (type === "message") return { ...base, text: "", personalize: true };
    if (type === "wait") return { ...base, amount: "1", unit: "days" };
    if (type === "condition") return { ...base, on: "delivered" };
    if (type === "action") return { ...base, channel: "whatsapp", actionText: "" };
    if (type === "send") return { ...base, schedule: "now", throttle: "auto", quietHours: true };
    return base;
  };
  const insertAfter = (afterId: string, branch: "main" | "yes" | "no", type: NodeType) => {
    const src = nodes.find((n) => n.id === afterId); if (!src) return;
    const dy = branch === "yes" ? -110 : branch === "no" ? 130 : 20;
    const nn = newNode(type, src.x + 330, src.y + dy);
    setNodes((ns) => [...ns, nn]);
    setLinks((ls) => {
      if (branch === "main") {
        const out = ls.find((l) => l.from === afterId && l.branch === "main");
        let next = ls.filter((l) => !(l.from === afterId && l.branch === "main"));
        next = [...next, { from: afterId, to: nn.id, branch: "main" }];
        if (out) next = [...next, { from: nn.id, to: out.to, branch: "main" }];
        return next;
      }
      // yes/no branch is a distinct output — replace any existing one on that branch
      const next = ls.filter((l) => !(l.from === afterId && l.branch === branch));
      return [...next, { from: afterId, to: nn.id, branch }];
    });
    setSelId(nn.id); setPaletteAt(null);
  };
  const addLoose = (type: NodeType) => {
    const cx = scrollRef.current; const x = (cx?.scrollLeft || 0) + 340; const y = (cx?.scrollTop || 0) + 260;
    const nn = newNode(type, x, y); setNodes((ns) => [...ns, nn]); setSelId(nn.id); setPaletteAt(null);
  };
  const genMessage = useCallback(async (id: string) => {
    patchNode(id, { generating: true });
    const goal = "a short, friendly promotional SMS with a 15% off offer and an opt-out line";
    let text = "";
    try {
      const r = await fetch("/api/campaigns/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "sms", channel: "sms", goal, prompt: goal }) }).then((x) => x.json()).catch(() => null);
      text = r?.data?.content || r?.data?.message || r?.content || r?.message || "";
    } catch { /* fallback below */ }
    if (!text) text = "Hey {first_name}! A little thank-you — 15% off anything this week with code THANKS15. Reply STOP to opt out.";
    patchNode(id, { text, generating: false });
  }, [patchNode]);

  if (loading) return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your SMS…" /></div>;

  const hasNumber = !!number?.hasNumber;
  const monthlyLimit = number?.monthlyLimit ?? 0;
  const sentThisMonth = number?.sentThisMonth ?? 0;
  const usagePct = monthlyLimit > 0 ? Math.min(100, Math.round((sentThisMonth / monthlyLimit) * 100)) : 0;
  const isTollFreeNumber = !!number?.phoneNumber && /^\+1(800|833|844|855|866|877|888)/.test(number.phoneNumber);
  const regApproved = isTollFreeNumber ? isRegApproved(tollfree?.status) : !!a2p?.isApproved;
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered ?? 0), 0);
  const totalSent = campaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const filtersActive = search !== "" || statusFilter !== "all";
  const audienceReach = 1284;

  // setup gate — no verified number
  // No verified number yet → the structured "Get verified to send" intake
  // (business + opt-in proof + samples → /api/sms/compliance), then rent a number.
  if (!hasNumber) {
    return <SmsVerify onDone={() => { void loadNumber(); void loadRegistration(); }} />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"><MessageSquare className="h-3 w-3" /> {(stats.total ?? campaigns.length).toLocaleString()} blasts · {totalDelivered.toLocaleString()} delivered</span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", regApproved ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-amber-500/30 bg-amber-500/10 text-amber-500")}>{regApproved ? <ShieldCheck className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />} {number?.phoneNumber}</span>
        <div className="ms-auto flex items-center gap-2">
          <button onClick={() => { setNodes(DEFAULT_NODES); setLinks(DEFAULT_LINKS); setSelId("msg"); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><RotateCw className="h-3.5 w-3.5" /> New flow</button>
          <button onClick={() => setBackOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><ClipboardList className="h-3.5 w-3.5" /> Back office</button>
        </div>
      </div>

      {/* verify banner */}
      {!regApproved && (
        <div className="flex items-center gap-3 border-b border-amber-500/25 bg-amber-500/[0.06] px-4 py-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-[12px] text-muted-foreground"><b className="text-foreground">Registration in review.</b> US carriers unlock sending once your {isTollFreeNumber ? "toll-free verification" : "A2P 10DLC campaign"} is approved (usually a few days).</p>
          <button onClick={() => { setBackOpen(true); setSection("registration"); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Review setup</button>
        </div>
      )}

      {/* CANVAS */}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle, var(--sms-dot, rgba(120,130,150,.16)) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={scrollRef} onPointerDown={pan} className="absolute inset-0 cursor-grab overflow-auto">
          <div ref={boardRef} className="relative" style={{ width: 2200, height: 1200 }}>
            <svg ref={wireRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }} />
            {nodes.map((n) => (
              <FlowNodeView key={n.id} node={n} selected={selId === n.id}
                onSelect={() => setSelId(n.id)} onMove={recomputeWires} onPatch={(p) => patchNode(n.id, p)}
                onDelete={() => deleteNode(n.id)} onGenerate={() => genMessage(n.id)}
                onAddAfter={(branch) => { const el = boardRef.current?.querySelector(`[data-node="${n.id}"]`) as HTMLElement | null; const r = el?.getBoundingClientRect(); const br = boardRef.current?.getBoundingClientRect(); setPaletteAt({ afterId: n.id, branch, x: (r && br ? r.left - br.left + r.width + 8 : n.x + 260), y: (r && br ? r.top - br.top : n.y) }); }}
                audienceReach={audienceReach} />
            ))}
          </div>
        </div>

        {/* insert palette */}
        {paletteAt && (
          <>
            <button aria-label="Close" className="absolute inset-0 z-10 cursor-default" onClick={() => setPaletteAt(null)} />
            <div className="absolute z-20 w-[236px] rounded-2xl border border-border bg-card p-1.5 shadow-2xl" style={{ left: Math.min(paletteAt.x, 1900), top: Math.min(paletteAt.y, 900) }}>
              <p className="px-2 pb-1 pt-1.5 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Insert a step</p>
              {PALETTE.map((p) => { const M = NODE_META[p.type]; return (
                <button key={p.type} onClick={() => insertAfter(paletteAt.afterId, paletteAt.branch, p.type)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60">
                  <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-lg", M.tone)}><M.icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0"><b className="block text-[11.5px]">{M.title}</b><span className="block text-[9.5px] text-muted-foreground">{p.blurb}</span></span>
                </button>
              ); })}
            </div>
          </>
        )}

        {/* add-loose FAB */}
        <div className="absolute bottom-4 right-4 z-20">
          <details className="group">
            <summary className="grid h-12 w-12 cursor-pointer list-none place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-lg shadow-brand-500/40 [&::-webkit-details-marker]:hidden"><Plus className="h-6 w-6" /></summary>
            <div className="absolute bottom-14 right-0 w-[228px] rounded-2xl border border-border bg-card p-1.5 shadow-2xl">
              <p className="px-2 pb-1 pt-1.5 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Add a step</p>
              {PALETTE.map((p) => { const M = NODE_META[p.type]; return (
                <button key={p.type} onClick={() => addLoose(p.type)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60">
                  <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-lg", M.tone)}><M.icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0"><b className="block text-[11.5px]">{M.title}</b><span className="block text-[9.5px] text-muted-foreground">{p.blurb}</span></span>
                </button>
              ); })}
            </div>
          </details>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">Drag empty space to pan · drag a node to move it · click ＋ on a node to insert a step after it</div>
      </div>

      {/* bottom bar */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-2.5">
        <span className="text-[11.5px] text-muted-foreground"><b className="text-foreground">{nodes.length}</b> steps · reaches <b className="text-foreground">{audienceReach.toLocaleString()}</b> opted-in · est. <b className="text-amber-500">~{Math.round(audienceReach * 1.2).toLocaleString()} cr</b></span>
        <div className="ms-auto flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Save draft</button>
          <button className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><Play className="h-3.5 w-3.5" /> Test to me</button>
          <button disabled={!regApproved} className={cn("inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-white", regApproved ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-muted text-muted-foreground")}><Send className="h-3.5 w-3.5" /> Launch flow</button>
        </div>
      </div>

      {/* BACK OFFICE */}
      {backOpen && (
        <BackOffice
          onClose={() => setBackOpen(false)} number={number} stats={stats} campaigns={campaigns}
          totalDelivered={totalDelivered} deliveryRate={deliveryRate} monthlyLimit={monthlyLimit} sentThisMonth={sentThisMonth} usagePct={usagePct}
          section={section} setSection={setSection} isTollFreeNumber={isTollFreeNumber} a2p={a2p} tollfree={tollfree}
          search={search} searchInput={searchInput} setSearchInput={setSearchInput} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} listLoading={listLoading} filtersActive={filtersActive}
          openId={openId} detail={detail} detailLoading={detailLoading} openBlast={openBlast}
          confirmSend={confirmSend} setConfirmSend={setConfirmSend} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
          busyId={busyId} actionError={actionError} setActionError={setActionError} sendBlast={sendBlast} deleteBlast={deleteBlast} setBlastStatus={setBlastStatus}
          confirmRelease={confirmRelease} setConfirmRelease={setConfirmRelease} releaseBusy={releaseBusy} releaseError={releaseError} setReleaseError={setReleaseError} releaseNumber={releaseNumber}
          regLoading={regLoading} regBusy={regBusy} regError={regError} loadRegistration={loadRegistration} retryA2pRegistration={retryA2pRegistration}
          onAsk={onAsk}
        />
      )}
    </div>
  );
}

// ── flow node card (draggable, menu-edited, insert-after) ────────────────────
function FlowNodeView({ node, selected, onSelect, onMove, onPatch, onDelete, onGenerate, onAddAfter, audienceReach }: {
  node: FlowNode; selected: boolean; onSelect: () => void; onMove: () => void;
  onPatch: (p: Partial<FlowNode>) => void; onDelete: () => void; onGenerate: () => void; onAddAfter: (branch: "main" | "yes" | "no") => void; audienceReach: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const M = NODE_META[node.type];
  const start = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, .sw")) return;
    onSelect();
    const card = ref.current; if (!card) return;
    const sx = e.clientX, sy = e.clientY, ox = node.x, oy = node.y;
    const mv = (ev: PointerEvent) => { card.style.left = `${ox + ev.clientX - sx}px`; card.style.top = `${oy + ev.clientY - sy}px`; onMove(); };
    const up = (ev: PointerEvent) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); onPatch({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy }); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); e.preventDefault();
  };
  return (
    <div ref={ref} data-node={node.id} onPointerDown={() => onSelect()} style={{ left: node.x, top: node.y, width: 250 }}
      className={cn("absolute rounded-2xl border bg-card shadow-lg", selected ? "border-brand-500 shadow-[0_0_0_3px_rgba(79,140,255,.18)]" : "border-border")}>
      <div onPointerDown={start} className="flex cursor-grab items-center gap-2 border-b border-border px-3 py-2.5 active:cursor-grabbing">
        <span className={cn("grid h-6 w-6 flex-none place-items-center rounded-md", M.tone)}><M.icon className="h-3.5 w-3.5" /></span>
        <b className="flex-1 truncate text-[12.5px]">{M.title}</b>
        <span className={cn("rounded-full px-2 py-0.5 text-[8.5px] font-extrabold tracking-wider", M.tagTone)}>{M.tag}</span>
        <button onClick={onDelete} title="Delete" className="grid h-[18px] w-[18px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
      </div>
      <div className="space-y-2 p-3">
        {node.type === "audience" && (<>
          <Labeled k="List / segment"><Select value={node.segment} onChange={(v) => onPatch({ segment: v })} options={SEGMENTS.map((s) => ({ v: s, label: s }))} /></Labeled>
          <Toggle label="Skip opted-out" on={!!node.skipOptedOut} onClick={() => onPatch({ skipOptedOut: !node.skipOptedOut })} />
          <Toggle label="Dedupe by number" on={!!node.dedupe} onClick={() => onPatch({ dedupe: !node.dedupe })} />
          <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Reaches</span><b className="text-violet-400">{audienceReach.toLocaleString()}</b></div>
        </>)}
        {node.type === "message" && (<>
          <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-brand-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-foreground">{node.text || <span className="text-muted-foreground">Write the message, or generate it →</span>}</div>
          <textarea rows={2} value={node.text || ""} onChange={(e) => onPatch({ text: e.target.value })} placeholder="Message copy…" className="w-full resize-y rounded-lg border border-border bg-muted/40 p-2 text-[11.5px] outline-none focus:border-brand-500" />
          <button onClick={onGenerate} className={cn("flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 py-1.5 text-[11.5px] font-bold text-white", node.generating && "opacity-70")}>
            {node.generating ? <FlowLoader size={13} /> : <Wand2 className="h-3.5 w-3.5" />} {node.generating ? "Writing…" : "Generate with AI"}
          </button>
          <Toggle label="Personalize per contact" on={!!node.personalize} onClick={() => onPatch({ personalize: !node.personalize })} />
        </>)}
        {node.type === "wait" && (
          <Labeled k="Wait before next step">
            <div className="flex gap-1.5">
              <input value={node.amount || "1"} onChange={(e) => onPatch({ amount: e.target.value.replace(/[^0-9]/g, "") })} className="w-[64px] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500" />
              <Select value={node.unit} onChange={(v) => onPatch({ unit: v })} options={[{ v: "hours", label: "hours" }, { v: "days", label: "days" }]} />
            </div>
          </Labeled>
        )}
        {node.type === "condition" && (
          <Labeled k="Branch when…"><Select value={node.on} onChange={(v) => onPatch({ on: v })} options={CONDITIONS} /></Labeled>
        )}
        {node.type === "action" && (<>
          <Labeled k="Do this"><Select value={node.channel} onChange={(v) => onPatch({ channel: v })} options={CHANNELS.map((c) => ({ v: c.v, label: c.label }))} /></Labeled>
          {(node.channel === "whatsapp" || node.channel === "email") && (
            <textarea rows={2} value={node.actionText || ""} onChange={(e) => onPatch({ actionText: e.target.value })} placeholder="What to send…" className="w-full resize-y rounded-lg border border-border bg-muted/40 p-2 text-[11.5px] outline-none focus:border-brand-500" />
          )}
        </>)}
        {node.type === "send" && (<>
          <Labeled k="When"><Select value={node.schedule} onChange={(v) => onPatch({ schedule: v })} options={[{ v: "now", label: "Send now" }, { v: "schedule", label: "Schedule for later" }]} /></Labeled>
          <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Throttle (carrier-safe)</span><b>auto</b></div>
          <Toggle label="Quiet hours 8pm–9am" on={!!node.quietHours} onClick={() => onPatch({ quietHours: !node.quietHours })} />
        </>)}
      </div>

      {node.type === "condition" ? (
        <div className="flex gap-1.5 px-3 pb-3">
          <button onClick={() => onAddAfter("yes")} className="flex-1 rounded-lg border border-dashed border-emerald-500/40 py-1.5 text-[9px] font-extrabold tracking-wide text-emerald-400 hover:bg-emerald-500/5">✓ IF YES ＋</button>
          <button onClick={() => onAddAfter("no")} className="flex-1 rounded-lg border border-dashed border-rose-500/40 py-1.5 text-[9px] font-extrabold tracking-wide text-rose-400 hover:bg-rose-500/5">✕ IF NO ＋</button>
        </div>
      ) : (
        <button onClick={() => onAddAfter("main")} title="Insert a step after this" className="absolute -bottom-3 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-brand-500"><Plus className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

// ── small in-node controls ───────────────────────────────────────────────────
function Labeled({ k, children }: { k: string; children: ReactNode }) {
  return <div><div className="mb-1 text-[8.5px] font-extrabold uppercase tracking-wider text-muted-foreground">{k}</div>{children}</div>;
}
function Select({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500">{options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select>;
}
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <button onClick={onClick} className={cn("sw relative h-4 w-7 flex-none rounded-full transition", on ? "bg-brand-500/40" : "bg-muted")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full transition-all", on ? "left-3.5 bg-brand-400" : "left-0.5 bg-muted-foreground")} />
      </button>
    </div>
  );
}

// ── back office (blasts list + registration + release) ───────────────────────
interface BackOfficeProps {
  onClose: () => void; number: NumberStatus | null; stats: SmsStats; campaigns: SmsCampaign[];
  totalDelivered: number; deliveryRate: number; monthlyLimit: number; sentThisMonth: number; usagePct: number;
  section: "blasts" | "registration"; setSection: (s: "blasts" | "registration") => void; isTollFreeNumber: boolean; a2p: A2pStatus | null; tollfree: TollfreeStatus | null;
  search: string; searchInput: string; setSearchInput: (s: string) => void; setSearch: (s: string) => void; statusFilter: string; setStatusFilter: (s: string) => void; listLoading: boolean; filtersActive: boolean;
  openId: string | null; detail: SmsCampaignDetail | null; detailLoading: boolean; openBlast: (c: SmsCampaign) => void;
  confirmSend: string | null; setConfirmSend: (s: string | null) => void; confirmDelete: string | null; setConfirmDelete: (s: string | null) => void;
  busyId: string | null; actionError: string | null; setActionError: (s: string | null) => void; sendBlast: (id: string) => void; deleteBlast: (id: string) => void; setBlastStatus: (id: string, s: "PAUSED" | "DRAFT") => void;
  confirmRelease: boolean; setConfirmRelease: (b: boolean) => void; releaseBusy: boolean; releaseError: string | null; setReleaseError: (s: string | null) => void; releaseNumber: () => void;
  regLoading: boolean; regBusy: boolean; regError: string | null; loadRegistration: () => void; retryA2pRegistration: () => void;
  onAsk?: (p: string) => void;
}
function BackOffice(p: BackOfficeProps) {
  const hasNumber = !!p.number?.hasNumber;
  return (
    <div className="absolute inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={p.onClose} />
      <div className="flex h-full w-full max-w-[860px] flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ClipboardList className="h-4 w-4 text-brand-500" /><h2 className="text-[14px] font-bold">SMS back office</h2>
          <button onClick={p.onClose} className="ms-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
            <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
              <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent p-4">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/25 to-violet-500/20 text-brand-500"><Phone className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-muted-foreground">Your SMS number</p><p className="truncate text-[17px] font-extrabold leading-tight">{p.number?.phoneNumber}</p></div>
                </div>
                <span className={cn("mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", p.number?.verified ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-amber-500/30 bg-amber-500/10 text-amber-500")}>{p.number?.verified ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{p.number?.verified ? "Verified" : "Verification pending"}</span>
                {p.monthlyLimit > 0 && (<div className="mt-3"><div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Gauge className="h-3 w-3" /> This month</span><span className="tabular-nums text-foreground">{p.sentThisMonth.toLocaleString()} / {p.monthlyLimit.toLocaleString()}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(2, p.usagePct)}%` }} /></div></div>)}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniStat label="Sent" value={(p.stats.sent ?? 0).toLocaleString()} /><MiniStat label="Delivered" value={p.totalDelivered.toLocaleString()} />
                  <MiniStat label="Delivery" value={`${p.deliveryRate}%`} /><MiniStat label="Blasts" value={(p.stats.total ?? p.campaigns.length).toLocaleString()} />
                </div>
              </div>
              <nav className="rounded-2xl border border-border bg-card p-1.5">
                {([{ id: "blasts" as const, label: "SMS blasts", icon: MessageSquare, count: p.stats.total ?? p.campaigns.length }, { id: "registration" as const, label: "Carrier registration", icon: ShieldCheck }]).map((n) => {
                  const active = p.section === n.id;
                  return (<button key={n.id} onClick={() => p.setSection(n.id)} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}><n.icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-start">{n.label}</span>{typeof n.count === "number" && n.count > 0 && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n.count}</span>}</button>);
                })}
              </nav>
              {p.section === "blasts" && (
                <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
                  <form onSubmit={(e) => { e.preventDefault(); p.setSearch(p.searchInput.trim()); }} className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={p.searchInput} onChange={(e) => p.setSearchInput(e.target.value)} onBlur={() => p.setSearch(p.searchInput.trim())} placeholder="Search blasts…" className="w-full rounded-[10px] border border-border bg-background py-1.5 pl-8 pr-8 text-[12.5px] outline-none focus:border-brand-500/50" />
                    {p.searchInput && <button type="button" onClick={() => { p.setSearchInput(""); p.setSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><XCircle className="h-3.5 w-3.5" /></button>}
                  </form>
                  <div className="flex flex-wrap items-center gap-1">
                    <ListFilter className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    {STATUS_FILTERS.map((f) => <button key={f.value} onClick={() => p.setStatusFilter(f.value)} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition", p.statusFilter === f.value ? "border-brand-500/40 bg-brand-500/10 text-brand-500" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{f.label}</button>)}
                    {p.listLoading && <FlowLoader size={16} />}
                  </div>
                </div>
              )}
              {p.confirmRelease ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-3">
                  <p className="text-[11.5px] font-medium">Release {p.number?.phoneNumber}? This frees the number — you&apos;ll need to rent a new one to send again.</p>
                  <div className="mt-2 flex items-center gap-2"><button onClick={p.releaseNumber} disabled={p.releaseBusy} className="inline-flex items-center gap-1.5 rounded-[8px] bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">{p.releaseBusy ? <FlowLoader size={13} /> : <Trash2 className="h-3 w-3" />} Release</button><button onClick={() => { p.setConfirmRelease(false); p.setReleaseError(null); }} disabled={p.releaseBusy} className="rounded-[8px] px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">Keep</button></div>
                  {p.releaseError && <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] text-rose-500"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {p.releaseError}</p>}
                </div>
              ) : (
                <button onClick={() => { p.setReleaseError(null); p.setConfirmRelease(true); }} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Release number</button>
              )}
            </aside>

            <div className="min-w-0 flex-1 space-y-4">
              {p.section === "registration" ? (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="inline-flex items-center gap-1.5 text-[13px] font-bold"><ShieldCheck className="h-4 w-4 text-brand-500" /> Carrier registration</h3>
                    <span className="text-[11.5px] text-muted-foreground">{p.isTollFreeNumber ? "Toll-free verification" : "A2P 10DLC"}</span>
                    <button onClick={p.loadRegistration} disabled={p.regLoading || p.regBusy} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"><RefreshCw className={cn("h-3.5 w-3.5", p.regLoading && "animate-spin")} /> Refresh</button>
                  </div>
                  {p.regLoading && !p.a2p && !p.tollfree ? (
                    <div className="grid place-items-center py-5"><FlowLoader size={20} label="Checking registration…" /></div>
                  ) : p.isTollFreeNumber ? (
                    <RegRow label="Toll-free verification" status={p.tollfree?.status} detail={p.tollfree?.rejectionReason} pending={!p.tollfree?.hasVerification} pendingText="Verification not submitted yet — the agent submits it when you rent a toll-free number." />
                  ) : (
                    <div className="space-y-2">
                      <RegRow label="Brand registration" status={p.a2p?.brandStatus} detail={p.a2p?.brandFailureReason} pending={!p.a2p?.hasRegistration} pendingText="A2P brand not registered yet." />
                      <RegRow label="Campaign registration" status={p.a2p?.campaignStatus} detail={p.a2p?.campaignFailureReason} pending={!p.a2p?.hasRegistration} pendingText="Created once your brand is approved." />
                    </div>
                  )}
                  {!p.isTollFreeNumber && p.a2p?.isApproved && <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Fully approved — your number can send marketing SMS.</p>}
                  {!p.isTollFreeNumber && p.a2p?.hasRegistration && (isRegFailed(p.a2p.brandStatus) || isRegFailed(p.a2p.campaignStatus)) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3"><span className="inline-flex items-center gap-1.5 text-[12px] text-rose-500"><ShieldAlert className="h-3.5 w-3.5" /> Registration failed.</span><button onClick={p.retryA2pRegistration} disabled={p.regBusy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{p.regBusy ? <FlowLoader size={13} /> : <RotateCw className="h-3.5 w-3.5" />} Resubmit registration</button></div>
                  )}
                  {p.regError && <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] text-rose-500"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {p.regError}</p>}
                  <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><ExternalLink className="h-3 w-3 shrink-0" /> SMS rates and carrier rules vary by country. Recipients must opt in.</p>
                </section>
              ) : (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="mb-3 text-[13px] font-bold">SMS blasts</h3>
                  {p.campaigns.length ? (
                    <div className="space-y-2">
                      {p.campaigns.map((c) => {
                        const m = statusMeta(c.status); const status = c.status.toLowerCase(); const isOpen = p.openId === c.id;
                        const sent = c.sent ?? 0; const delivered = c.delivered ?? 0; const rate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
                        const when = whenLabel(c.sentAt) || (c.scheduledAt ? `scheduled ${whenLabel(c.scheduledAt)}` : whenLabel(c.createdAt));
                        const busy = p.busyId === c.id; const canSend = hasNumber && SENDABLE.has(status); const canDelete = DELETABLE.has(status); const canPause = PAUSABLE.has(status); const canResume = RESUMABLE.has(status);
                        return (
                          <div key={c.id} className={cn("rounded-xl border bg-muted/30 transition", isOpen ? "border-brand-500/40" : "border-border")}>
                            <button onClick={() => p.openBlast(c)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left">
                              <span className="truncate text-[13px] font-semibold">{c.name}</span>
                              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", m.tone)}><m.icon className="h-3 w-3" /> {status}</span>
                              {when && <span className="text-[11.5px] text-muted-foreground">{when}</span>}
                              <span className="ms-auto text-[12px] text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{(c.audience ?? 0).toLocaleString()}</span> recipients</span>
                              <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", isOpen && "rotate-90")} />
                            </button>
                            {sent > 0 && (<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-3 py-2 text-[11.5px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> {sent.toLocaleString()} sent</span><span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> {delivered.toLocaleString()} delivered <span className="text-muted-foreground">({rate}%)</span></span>{!!c.failed && <span className="inline-flex items-center gap-1 text-rose-500"><XCircle className="h-3 w-3" /> {c.failed.toLocaleString()} failed</span>}{!!c.clicked && <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {c.clicked.toLocaleString()} clicked</span>}</div>)}
                            {isOpen && (
                              <div className="border-t border-border/60 px-3 py-3">
                                {p.detailLoading ? <div className="grid place-items-center py-6"><FlowLoader size={22} label="Loading blast…" /></div>
                                  : p.detail && p.detail.id === c.id ? <BlastDetail detail={p.detail} senderNumber={p.number?.phoneNumber} />
                                  : <p className="py-3 text-center text-[12.5px] text-muted-foreground">Could not load this blast.</p>}
                                {(canSend || canDelete || canPause || canResume) && (
                                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                                    {canPause && <button onClick={() => { p.setConfirmSend(null); p.setConfirmDelete(null); p.setActionError(null); p.setBlastStatus(c.id, "PAUSED"); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-amber-500 disabled:opacity-60">{busy ? <FlowLoader size={13} /> : <Pause className="h-3.5 w-3.5" />} Pause</button>}
                                    {canResume && <button onClick={() => { p.setConfirmSend(null); p.setConfirmDelete(null); p.setActionError(null); p.setBlastStatus(c.id, "DRAFT"); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-500/40 bg-emerald-500/5 px-3 py-1.5 text-[12px] font-medium text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-60">{busy ? <FlowLoader size={13} /> : <Play className="h-3.5 w-3.5" />} Resume</button>}
                                    {canSend && (p.confirmSend === c.id ? (
                                      <span className="inline-flex items-center gap-2 rounded-[10px] border border-brand-500/40 bg-brand-500/5 px-2 py-1"><span className="text-[11.5px] font-medium">Send now?</span><button onClick={() => p.sendBlast(c.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">{busy ? <FlowLoader size={13} /> : <Send className="h-3 w-3" />} Confirm</button><button onClick={() => p.setConfirmSend(null)} disabled={busy} className="rounded-[8px] px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button></span>
                                    ) : <button onClick={() => { p.setConfirmDelete(null); p.setActionError(null); p.setConfirmSend(c.id); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Send className="h-3.5 w-3.5" /> Send now</button>)}
                                    {canDelete && (p.confirmDelete === c.id ? (
                                      <span className="inline-flex items-center gap-2 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-2 py-1"><span className="text-[11.5px] font-medium">Delete?</span><button onClick={() => p.deleteBlast(c.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[8px] bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">{busy ? <FlowLoader size={13} /> : <Trash2 className="h-3 w-3" />} Confirm</button><button onClick={() => p.setConfirmDelete(null)} disabled={busy} className="rounded-[8px] px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button></span>
                                    ) : <button onClick={() => { p.setConfirmSend(null); p.setActionError(null); p.setConfirmDelete(c.id); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Delete</button>)}
                                    {p.onAsk && (status === "draft" || status === "scheduled") && <button onClick={() => p.onAsk!(`Help me edit my SMS blast "${c.name}".`)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"><PenLine className="h-3.5 w-3.5" /> Edit</button>}
                                  </div>
                                )}
                                {p.actionError && p.openId === c.id && <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] text-rose-500"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {p.actionError}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : p.filtersActive ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center"><p className="text-[13px] font-medium">No blasts match your filters</p><button onClick={() => { p.setSearchInput(""); p.setSearch(""); p.setStatusFilter("all"); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /> Clear filters</button></div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><MessageSquare className="h-6 w-6" /></span><p className="mt-3 text-[13px] font-medium">No SMS blasts yet</p><p className="mt-1 text-[12px] text-muted-foreground">Build a flow on the canvas and launch it — it lands here.</p></div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlastDetail({ detail, senderNumber }: { detail: SmsCampaignDetail; senderNumber?: string }) {
  const sent = detail.sent ?? 0; const delivered = detail.delivered ?? 0; const failed = detail.failed ?? 0; const clicked = detail.clicked ?? 0; const unsub = detail.unsubscribed ?? 0;
  const deliveredRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0; const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
  const audience = detail.contactList?.activeCount ?? detail.contactList?.totalCount ?? detail.audience ?? 0;
  const charCount = detail.messageLength ?? (detail.content ? detail.content.length : 0);
  const segmentCount = detail.segments ?? (charCount > 0 ? Math.max(1, Math.ceil(charCount / 160)) : 0);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> Message{senderNumber ? ` · from ${senderNumber}` : ""}</div>
        {detail.content ? <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-brand-500/10 px-3 py-2 text-[12.5px] leading-relaxed text-foreground">{detail.content}</div> : <p className="text-[12px] italic text-muted-foreground">No message content saved.</p>}
        {charCount > 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">{charCount} chars{segmentCount ? ` · ${segmentCount} segment${segmentCount > 1 ? "s" : ""}` : ""}</p>}
      </div>
      {sent > 0 && (<div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><DetailStat icon={Send} label="Sent" value={sent.toLocaleString()} /><DetailStat icon={CheckCircle2} label="Delivered" value={`${delivered.toLocaleString()} · ${deliveredRate}%`} tone="text-emerald-500" /><DetailStat icon={MousePointerClick} label="Clicked" value={`${clicked.toLocaleString()} · ${clickRate}%`} /><DetailStat icon={XCircle} label="Failed" value={failed.toLocaleString()} tone={failed > 0 ? "text-rose-500" : undefined} /></div>)}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {detail.contactList?.name ? `${detail.contactList.name} · ` : ""}{audience.toLocaleString()} recipients</span>{unsub > 0 && <span>{unsub.toLocaleString()} opted out</span>}{detail.scheduledAt && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Scheduled {dateTimeLabel(detail.scheduledAt)}</span>}{detail.sentAt && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Sent {dateTimeLabel(detail.sentAt)}</span>}</div>
    </div>
  );
}
function DetailStat({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string; tone?: string }) {
  return <div className="rounded-lg border border-border bg-muted/30 p-2.5"><div className={cn("flex items-center gap-1 text-muted-foreground", tone)}><Icon className="h-3 w-3" /><span className="text-[10.5px] font-medium uppercase tracking-wide">{label}</span></div><p className={cn("mt-0.5 text-[14px] font-bold tabular-nums", tone)}>{value}</p></div>;
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-muted/30 px-1.5 py-2 text-center"><p className="text-[15px] font-extrabold leading-none tabular-nums">{value}</p><p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p></div>;
}
function RegRow({ label, status, detail, pending, pendingText }: { label: string; status?: string | null; detail?: string | null; pending?: boolean; pendingText?: string }) {
  if (pending) return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5"><span className="text-[12.5px] font-semibold">{label}</span><span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground"><Hourglass className="h-3 w-3" /> Not started</span>{pendingText && <span className="w-full text-[11px] text-muted-foreground">{pendingText}</span>}</div>;
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5"><span className="text-[12.5px] font-semibold">{label}</span><span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", regTone(status))}>{isRegFailed(status) ? <ShieldAlert className="h-3 w-3" /> : isRegApproved(status) ? <ShieldCheck className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}{regLabel(status)}</span>{detail && <span className="w-full text-[11px] text-rose-500">{detail}</span>}</div>;
}
