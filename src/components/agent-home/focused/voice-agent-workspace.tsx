"use client";
/**
 * Voice Agent — the phone playground.
 *
 * Pick a preset → tell it about the business → give it a line → it answers.
 * The canvas is the build (brief → voice → skills → line → go live); the back
 * office is the run (calls, transcripts, controls, numbers).
 *
 * Same shell as the other studios: pan hook, DOM-live drag, brief as an
 * absolute sheet scoped to this root. [[voice-agent-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, X, Phone, Mic, Zap, ClipboardList, Plus, Pencil, Power, PhoneCall,
  Search, Coins, ListChecks, Settings, Hash, PauseCircle, PlayCircle, Trash2,
  ChevronRight, AlertTriangle, FileText, Link2, RefreshCw,
} from "lucide-react";

import { useTextPrompt } from "@/components/agent-home/shared/text-prompt";
import { useCanvasPan } from "@/components/agent-home/shared/use-canvas-pan";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import {
  ANSWER_MODES, DAYS, DEFAULT_HOURS, OUTCOME_LABEL, PRESETS, PRESET_BY_KEY,
  SKILL_BY_KEY, SKILL_CATALOG, brandToBusinessBlurb, fmtDuration, fmtNumber,
  greetingFor, skillFromDef, skillPos,
  type AgentCall, type AgentNumber, type AgentSkill, type AnswerMode, type BrandLite,
  type DayKey, type Hours, type KnowledgeItem, type VoiceAgentDraft,
} from "@/lib/voice-agent/types";

const DOTS = "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)";

/** Preset art — gradients stand in until real thumbs land. [[style-selectors-need-visual-thumbnails]] */
const PRESET_ART: Record<string, string> = {
  recep: "from-sky-900 to-brand-500",
  book: "from-emerald-900 to-emerald-500",
  lead: "from-violet-900 to-violet-500",
  supp: "from-cyan-900 to-cyan-500",
  out: "from-amber-900 to-amber-500",
  custom: "from-muted to-muted",
};

const TAG_TONE: Record<string, string> = {
  action: "bg-emerald-500/15 text-emerald-500",
  answer: "bg-brand-500/15 text-brand-400",
  handoff: "bg-amber-500/15 text-amber-500",
};

type Stats = {
  calls: number; answered: number; missed: number; booked: number;
  leads: number; escalated: number; totalSec: number; avgSec: number; credits: number;
};

export function FocusedVoiceAgent({ onOpenView }: { onOpenView?: (key: string) => void }) {
  const { toast } = useToast();
  const { ask, promptNode } = useTextPrompt();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);

  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<VoiceAgentDraft | null>(null);
  const [agents, setAgents] = useState<VoiceAgentDraft[]>([]);
  const [calls, setCalls] = useState<AgentCall[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pan = useCanvasPan(scrollRef);
  const wireRef = useRef<SVGPathElement>(null);

  const skills = useMemo(() => agent?.skills || [], [agent]);

  // ── load ──
  const loadAgents = useCallback(async () => {
    try {
      const j = await fetch("/api/voice-agent/agents").then((r) => r.json());
      if (j?.success) {
        setAgents(j.agents);
        return j.agents as VoiceAgentDraft[];
      }
    } catch { /* leave the empty state up */ }
    return [];
  }, []);

  const loadAgent = useCallback(async (id: string) => {
    try {
      const j = await fetch(`/api/voice-agent/agents/${id}`).then((r) => r.json());
      if (j?.success) { setAgent(j.agent); setCalls(j.calls); setStats(j.stats); }
    } catch { /* keep what's on screen */ }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadAgents();
      if (list.length) await loadAgent(list[0].id);
      else setBriefOpen(true); // nothing yet → straight into the brief, like Director
      setLoading(false);
    })();
  }, [loadAgents, loadAgent]);

  // Poll while live so the back office reflects calls as they land.
  useEffect(() => {
    if (!agent || agent.status !== "LIVE") return;
    const id = agent.id;
    const t = setInterval(() => { void loadAgent(id); }, 15000);
    return () => clearInterval(t);
  }, [agent?.id, agent?.status, loadAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── save ──
  const save = useCallback(async (patch: Partial<VoiceAgentDraft>) => {
    if (!agent) return;
    setAgent((a) => (a ? { ...a, ...patch } : a));
    try {
      const j = await fetch(`/api/voice-agent/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => r.json());
      if (!j?.success) {
        toast({ title: j?.error?.message || "Could not save that change", variant: "destructive" });
        await loadAgent(agent.id); // don't leave the UI showing a change that didn't stick
      } else {
        setAgent(j.agent);
      }
    } catch {
      toast({ title: "Could not save that change", variant: "destructive" });
    }
  }, [agent, toast, loadAgent]);

  const patchSkill = (id: string, next: Partial<AgentSkill>) => {
    const updated = skills.map((s) => (s.id === id ? { ...s, ...next } : s));
    void save({ skills: updated });
  };

  const removeSkill = (id: string) => void save({ skills: skills.filter((s) => s.id !== id) });

  const addSkill = async () => {
    const unused = SKILL_CATALOG.filter((d) => !skills.some((s) => s.key === d.key));
    if (!unused.length) {
      toast({ title: "It already has every skill", description: "Edit one instead." });
      return;
    }
    const pick = await ask(
      `Which skill? ${unused.map((u, i) => `${i + 1}. ${u.title}`).join("  ")}`,
      "1",
    );
    const idx = Number(pick) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= unused.length) return;
    void save({ skills: [...skills, skillFromDef(unused[idx], `sk_${unused[idx].key}_${Date.now()}`)] });
  };

  // ── wires: recomputed from live DOM rects so dragging updates at 60fps ──
  const recomputeWires = useCallback(() => {
    const board = boardRef.current;
    const path = wireRef.current;
    if (!board || !path) return;
    const b = board.getBoundingClientRect();
    const at = (id: string, side: "l" | "r") => {
      const el = board.querySelector(`[data-node="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: (side === "r" ? r.right : r.left) - b.left, y: r.top - b.top + r.height / 2 };
    };
    const seq = ["__brief", "__voice", ...skills.map((s) => s.id), "__out", "__live"];
    let d = "";
    for (let i = 0; i < seq.length - 1; i++) {
      const a = at(seq[i], "r"), c = at(seq[i + 1], "l");
      if (!a || !c) continue;
      const dx = Math.max(40, (c.x - a.x) / 2);
      d += `M${a.x} ${a.y} C${a.x + dx} ${a.y},${c.x - dx} ${c.y},${c.x} ${c.y} `;
    }
    path.setAttribute("d", d);
  }, [skills]);

  useEffect(() => { recomputeWires(); }, [recomputeWires, agent]);

  const boardW = Math.max(2200, 596 + Math.ceil(skills.length / 2) * 292 + 700);

  // ── header ──
  const header = headerSlot && createPortal(
    <div className="flex items-center gap-2">
      {agent && (
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
          {skills.filter((s) => s.enabled).length} skills
          {stats ? ` · ${stats.calls} calls this month` : ""}
        </span>
      )}
      {agent && (
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-bold",
          agent.status === "LIVE"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            : "border-border text-muted-foreground",
        )}>
          <i className={cn("h-1.5 w-1.5 rounded-full", agent.status === "LIVE" ? "animate-pulse bg-emerald-500" : "bg-muted-foreground")} />
          {agent.status === "LIVE" ? "LIVE" : agent.status === "PAUSED" ? "PAUSED" : "DRAFT"}
        </span>
      )}
      {agent && (
        <button onClick={() => setBackOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500">
          <ClipboardList className="h-3.5 w-3.5" /> Back office
        </button>
      )}
      <button onClick={() => setAgentsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500">
        <ListChecks className="h-3.5 w-3.5" /> Agents
      </button>
      <button onClick={() => setBriefOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1.5 text-[12px] font-bold text-white">
        <Sparkles className="h-3.5 w-3.5" /> New agent
      </button>
    </div>,
    headerSlot,
  );

  if (loading) {
    return (
      <div className="grid h-full w-full place-items-center">
        <FlowLoader size={30} withMark label="Loading studio…" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {header}

      <div ref={scrollRef} onPointerDown={pan}
        className="absolute inset-0 cursor-grab overflow-auto"
        style={{ backgroundImage: DOTS, backgroundSize: "22px 22px" }}>
        <div ref={boardRef} className="relative" style={{ width: boardW, height: 1000 }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
            <path ref={wireRef} fill="none" stroke="#38bdf8" strokeWidth={2} opacity={0.45} />
          </svg>

          {!agent ? (
            <div className="absolute left-[44%] top-[38%] w-[420px] -translate-x-1/2 -translate-y-1/2 text-center">
              <h2 className="mb-1 text-[18px] font-bold">An agent that answers your phone</h2>
              <p className="mb-4 text-[12.5px] text-muted-foreground">
                Pick what it should do, tell it about your business, give it a number. It books, takes
                messages and logs every call.
              </p>
              <button onClick={() => setBriefOpen(true)}
                className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-3 text-[14px] font-extrabold text-white">
                Build my agent
              </button>
            </div>
          ) : (
            <>
              <BriefNode agent={agent} onOpen={() => setBriefOpen(true)} onMove={recomputeWires} />
              <VoiceNode agent={agent} onOpen={() => setBriefOpen(true)} onMove={recomputeWires} />

              {skills.map((s, i) => (
                <SkillNode key={s.id} skill={s} index={i} agent={agent}
                  onPatch={(n) => patchSkill(s.id, n)}
                  onDelete={() => removeSkill(s.id)}
                  onMove={recomputeWires}
                  ask={ask} />
              ))}

              <button onClick={addSkill} title="Add a skill"
                style={{ left: 596 + Math.ceil(skills.length / 2) * 292, top: 260 }}
                className="absolute grid h-11 w-11 place-items-center rounded-full border border-dashed border-border text-muted-foreground hover:border-brand-500 hover:text-brand-500">
                <Plus className="h-5 w-5" />
              </button>

              <LineNode agent={agent}
                x={596 + Math.ceil(skills.length / 2) * 292 + 82}
                onOpen={() => { setBackOpen(true); }}
                onMove={recomputeWires} />

              <LiveNode agent={agent} stats={stats}
                x={596 + Math.ceil(skills.length / 2) * 292 + 358}
                onToggle={() => {
                  if (!agent.phoneNumberId) {
                    toast({
                      title: "It needs a number first",
                      description: "Give the agent a line to answer, then switch it on.",
                    });
                    setBriefOpen(true);
                    return;
                  }
                  void save({ status: agent.status === "LIVE" ? "PAUSED" : "LIVE" });
                }}
                onCalls={() => setBackOpen(true)}
                onMove={recomputeWires} />
            </>
          )}
        </div>
      </div>

      {agent && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
          Drag empty space to pan · drag a node to rearrange · drag the corner to resize
        </div>
      )}

      {briefOpen && (
        <BriefSheet
          agent={agent}
          onClose={() => setBriefOpen(false)}
          onSaved={async (id) => { setBriefOpen(false); await loadAgents(); await loadAgent(id); }}
          onPatch={save}
          ask={ask}
        />
      )}

      {backOpen && agent && (
        <BackOffice agent={agent} calls={calls} stats={stats}
          onClose={() => setBackOpen(false)}
          onPatch={save}
          onRefresh={() => loadAgent(agent.id)}
          onOpenView={onOpenView} />
      )}

      {agentsOpen && (
        <AgentsDrawer agents={agents} activeId={agent?.id}
          onPick={async (id) => { setAgentsOpen(false); await loadAgent(id); }}
          onNew={() => { setAgentsOpen(false); setBriefOpen(true); }}
          onClose={() => setAgentsOpen(false)} />
      )}

      {promptNode}
    </div>
  );
}

// ── shared node chrome ─────────────────────────────────────────────────────

/** Header-as-drag-handle: mutate the DOM live, commit nothing (position is local). */
function useNodeDrag(onMove: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const start = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, .resize")) return;
    const card = ref.current;
    if (!card) return;
    const sx = e.clientX, sy = e.clientY;
    const ox = parseFloat(card.style.left || "0"), oy = parseFloat(card.style.top || "0");
    const mv = (ev: PointerEvent) => {
      card.style.left = `${ox + ev.clientX - sx}px`;
      card.style.top = `${oy + ev.clientY - sy}px`;
      onMove();
    };
    const up = () => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
    e.preventDefault();
  };
  return { ref, start };
}

function NodeHead({ icon, tone, title, tag, tagTone, onDelete, onPointerDown }: {
  icon: React.ReactNode; tone: string; title: string; tag?: string; tagTone?: string;
  onDelete?: () => void; onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <div onPointerDown={onPointerDown}
      className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing">
      <span className={cn("grid h-5 w-5 flex-none place-items-center rounded-md", tone)}>{icon}</span>
      <b className="truncate text-[12px]">{title}</b>
      {tag && (
        <span className={cn("ml-auto flex-none rounded-full px-2 py-0.5 text-[9px] font-extrabold", tagTone)}>
          {tag}
        </span>
      )}
      {onDelete && (
        <button onClick={onDelete}
          className="ml-1 grid h-[17px] w-[17px] flex-none place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ── nodes ──────────────────────────────────────────────────────────────────

function BriefNode({ agent, onOpen, onMove }: { agent: VoiceAgentDraft; onOpen: () => void; onMove: () => void }) {
  const { ref, start } = useNodeDrag(onMove);
  const preset = PRESET_BY_KEY[agent.preset] || PRESET_BY_KEY.recep;
  return (
    <div ref={ref} data-node="__brief" style={{ left: 40, top: 88 }}
      className="absolute w-[236px] overflow-hidden rounded-2xl border border-brand-500/35 bg-card shadow-sm">
      <NodeHead icon={<ClipboardList className="h-3 w-3" />} tone="bg-brand-500/15 text-brand-400"
        title="Agent brief" tag="SETUP" tagTone="bg-brand-500/15 text-brand-400" onPointerDown={start} />
      <button onClick={onOpen} className="w-full px-3 text-left">
        <span className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/12 to-violet-500/8 p-2.5">
          <span className="text-[19px]">{preset.emoji}</span>
          <span>
            <b className="block text-[11.5px]">{preset.title}</b>
            <span className="text-[9.5px] text-muted-foreground">{agent.name}</span>
          </span>
        </span>
        <span className="mt-1.5 block truncate text-[9.5px] text-muted-foreground">
          {agent.business || "Tell it about your business…"}
        </span>
      </button>
      {agent.knowledge.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 px-3">
          {agent.knowledge.slice(0, 3).map((k, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {k.kind === "url" ? <Link2 className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
              <span className="max-w-[76px] truncate">{k.label}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1 p-3">
        <button onClick={onOpen} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500">
          <Pencil className="mx-auto h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function VoiceNode({ agent, onOpen, onMove }: { agent: VoiceAgentDraft; onOpen: () => void; onMove: () => void }) {
  const { ref, start } = useNodeDrag(onMove);
  const [playing, setPlaying] = useState(false);
  const label = agent.voice?.label || "Not picked yet";
  const initials = label.slice(0, 2).toUpperCase();
  return (
    <div ref={ref} data-node="__voice" style={{ left: 316, top: 88 }}
      className="absolute w-[224px] overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-card shadow-sm">
      <NodeHead icon={<Mic className="h-3 w-3" />} tone="bg-amber-500/15 text-amber-500"
        title="Voice" tag="VOICE" tagTone="bg-amber-500/15 text-amber-500" onPointerDown={start} />
      <div className="mx-3 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-[11px] font-black text-white">
          {initials}
        </span>
        <span className="min-w-0">
          <b className="block truncate text-[11.5px]">{label}</b>
          <span className="text-[9.5px] text-muted-foreground">
            {agent.voice ? "Answers as this voice" : "Pick one in the brief"}
          </span>
        </span>
      </div>
      <div className="mx-3 mt-2 flex h-[34px] items-center gap-[2px] overflow-hidden rounded-lg border border-border bg-muted/40 px-2">
        {Array.from({ length: 42 }, (_, n) => (
          <i key={n}
            className={cn("flex-1 rounded-sm bg-gradient-to-b from-amber-400 to-amber-600 opacity-75", playing && "animate-pulse")}
            style={{ height: `${20 + Math.abs(Math.sin(n * 0.7) * 70)}%`, minWidth: 2 }} />
        ))}
      </div>
      <div className="flex gap-1 p-3">
        <button onClick={() => { setPlaying(true); setTimeout(() => setPlaying(false), 2000); }}
          className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-amber-500">
          <PlayCircle className="mx-auto h-3 w-3" />
        </button>
        <button onClick={onOpen} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-amber-500">
          <RefreshCw className="mx-auto h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function SkillNode({ skill, index, agent, onPatch, onDelete, onMove, ask }: {
  skill: AgentSkill; index: number; agent: VoiceAgentDraft;
  onPatch: (n: Partial<AgentSkill>) => void; onDelete: () => void; onMove: () => void;
  ask: (t: string, d?: string, m?: boolean) => Promise<string | null>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const def = SKILL_BY_KEY[skill.key];
  const pos = skillPos(index);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, .resize")) return;
    const card = cardRef.current;
    if (!card) return;
    const sx = e.clientX, sy = e.clientY;
    const ox = parseFloat(card.style.left || "0"), oy = parseFloat(card.style.top || "0");
    const mv = (ev: PointerEvent) => {
      card.style.left = `${ox + ev.clientX - sx}px`;
      card.style.top = `${oy + ev.clientY - sy}px`;
      onMove();
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      onPatch({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
    };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
    e.preventDefault();
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    const card = cardRef.current;
    if (!card) return;
    const sx = e.clientX, ow = card.offsetWidth;
    const mv = (ev: PointerEvent) => {
      card.style.width = `${Math.min(520, Math.max(240, ow + ev.clientX - sx))}px`;
      onMove();
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      onPatch({ w: Math.min(520, Math.max(240, ow + ev.clientX - sx)) });
    };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
  };

  const editRules = async () => {
    const next = await ask("What should it do when this comes up?", skill.rules, true);
    if (next === null || !next.trim() || next.trim() === skill.rules) return;
    onPatch({ rules: next.trim() });
  };

  const editTrigger = async () => {
    const next = await ask("When the caller…", skill.trigger, true);
    if (next === null || !next.trim() || next.trim() === skill.trigger) return;
    onPatch({ trigger: next.trim() });
  };

  return (
    <div ref={cardRef} data-node={skill.id}
      style={{ left: skill.x ?? pos.left, top: skill.y ?? pos.top, width: skill.w ?? 264 }}
      className={cn(
        "absolute overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        !skill.enabled && "opacity-45",
      )}>
      <NodeHead
        icon={<ListChecks className="h-3 w-3" />}
        tone={TAG_TONE[skill.kind]}
        title={def?.title || skill.key}
        tag={skill.kind.toUpperCase()}
        tagTone={TAG_TONE[skill.kind]}
        onDelete={onDelete}
        onPointerDown={startDrag}
      />

      <button onClick={editTrigger}
        className="mx-3 block w-[calc(100%-24px)] rounded-lg border border-border bg-muted/40 p-2 text-left hover:border-brand-500/50">
        <span className="mb-0.5 block text-[8px] font-extrabold uppercase tracking-wide text-muted-foreground">
          When the caller
        </span>
        <span className="line-clamp-2 text-[10px] leading-snug">{skill.trigger}</span>
      </button>

      <button onClick={editRules}
        className="mx-3 mt-2 flex w-[calc(100%-24px)] items-start gap-1.5 rounded-lg border border-brand-500/20 bg-brand-500/5 p-1.5 text-left hover:border-brand-500">
        <span className="mt-px flex-none text-[8px] font-extrabold uppercase tracking-wide text-brand-400">Rules</span>
        <span className="line-clamp-2 flex-1 text-[9px] leading-snug text-muted-foreground">{skill.rules}</span>
        <Pencil className="h-2.5 w-2.5 flex-none text-muted-foreground" />
      </button>

      {def && def.options.length > 0 && (
        <div className="mx-3 mt-2 space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
          {def.options.map((o) => (
            <div key={o.key} className="flex items-center gap-2">
              <span className="flex-1 text-[8.5px] font-extrabold uppercase text-muted-foreground">{o.label}</span>
              <button
                onClick={() => onPatch({ opts: { ...skill.opts, [o.key]: !skill.opts[o.key] } })}
                className={cn(
                  "relative h-4 w-7 flex-none rounded-full transition",
                  skill.opts[o.key] ? "bg-brand-500/35" : "bg-muted",
                )}>
                <span className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full transition-all",
                  skill.opts[o.key] ? "left-3.5 bg-brand-400" : "left-0.5 bg-muted-foreground",
                )} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 p-3">
        <button onClick={editRules} className="flex-1 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 py-1.5 text-[9.5px] font-bold text-white">
          <Pencil className="mx-auto h-3 w-3" />
        </button>
        <button onClick={() => onPatch({ enabled: !skill.enabled })}
          className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500">
          <Power className="mx-auto h-3 w-3" />
        </button>
      </div>

      <div onPointerDown={startResize} title="Drag to resize"
        className="resize absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize text-muted-foreground">
        <svg viewBox="0 0 10 10" className="h-full w-full">
          <path d="M9 1 L1 9 M9 5 L5 9" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </div>
    </div>
  );
}

function LineNode({ agent, x, onOpen, onMove }: {
  agent: VoiceAgentDraft; x: number; onOpen: () => void; onMove: () => void;
}) {
  const { ref, start } = useNodeDrag(onMove);
  const n = agent.number;
  return (
    <div ref={ref} data-node="__out" style={{ left: x, top: 120 }}
      className="absolute w-[236px] overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-cyan-500/10 to-card shadow-sm">
      <NodeHead icon={<Phone className="h-3 w-3" />} tone="bg-cyan-500/15 text-cyan-500"
        title="Your line" tag="NUMBER" tagTone="bg-cyan-500/15 text-cyan-500" onPointerDown={start} />
      <div className="mx-3 rounded-xl border border-border bg-muted/40 p-3 text-center">
        {n ? (
          <>
            <b className="block font-mono text-[15px] font-extrabold">{fmtNumber(n.e164)}</b>
            <span className="text-[9.5px] text-muted-foreground">
              {n.source === "FORWARDED" ? "Forwarded" : n.source === "SMS_LINKED" ? "Shared with texts" : "Dedicated"}
              {n.region ? ` · ${n.region}` : ""}
            </span>
            <div className={cn(
              "mt-1.5 flex items-center justify-center gap-1.5 text-[9px] font-bold",
              agent.status === "LIVE" ? "text-emerald-500" : "text-muted-foreground",
            )}>
              <i className={cn("h-1 w-1 rounded-full", agent.status === "LIVE" ? "bg-emerald-500" : "bg-muted-foreground")} />
              {agent.status === "LIVE" ? "Receiving calls" : "Not answering yet"}
            </div>
          </>
        ) : (
          <>
            <b className="block text-[12px]">No number yet</b>
            <span className="text-[9.5px] text-muted-foreground">It needs a line to answer.</span>
          </>
        )}
      </div>
      <div className="flex gap-1 p-3">
        <button onClick={onOpen} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-cyan-500">
          <Settings className="mx-auto h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function LiveNode({ agent, stats, x, onToggle, onCalls, onMove }: {
  agent: VoiceAgentDraft; stats: Stats | null; x: number;
  onToggle: () => void; onCalls: () => void; onMove: () => void;
}) {
  const { ref, start } = useNodeDrag(onMove);
  const live = agent.status === "LIVE";
  return (
    <div ref={ref} data-node="__live" style={{ left: x, top: 120 }}
      className="absolute w-[212px] overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-card shadow-sm">
      <NodeHead icon={<Zap className="h-3 w-3" />} tone="bg-emerald-500/15 text-emerald-500"
        title={live ? "Live" : "Go live"} tag={live ? "LIVE" : "OFF"}
        tagTone={live ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}
        onPointerDown={start} />
      <div className="mx-3 grid place-items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500/16 to-background/20 p-3.5 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-emerald-600 shadow-lg">
          {live ? <PhoneCall className="h-5 w-5" /> : <Power className="h-5 w-5" />}
        </span>
        <span>
          <b className="block text-[11.5px]">
            {live && agent.liveSince
              ? `Answering since ${new Date(agent.liveSince).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : live ? "Answering" : "Not answering"}
          </b>
          <span className="text-[9.5px] text-muted-foreground">
            {ANSWER_MODES.find((m) => m.key === agent.answerMode)?.title}
          </span>
        </span>
      </div>
      {stats && (
        <div className="mx-3 mt-2 flex gap-1.5">
          {[
            { v: stats.calls, k: "calls" },
            { v: stats.booked, k: "booked" },
            { v: stats.avgSec ? fmtDuration(stats.avgSec) : "—", k: "avg" },
          ].map((t) => (
            <div key={t.k} className="flex-1 rounded-lg border border-border bg-muted/40 px-1 py-1.5 text-center">
              <b className="block text-[11.5px] tabular-nums">{t.v}</b>
              <span className="text-[8px] font-extrabold uppercase text-muted-foreground">{t.k}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1 p-3">
        <button onClick={onCalls} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-emerald-500">
          <ClipboardList className="mx-auto h-3 w-3" />
        </button>
        <button onClick={onToggle}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-[9.5px] font-bold text-white",
            live ? "border border-border bg-transparent text-foreground hover:border-amber-500" : "bg-gradient-to-r from-emerald-500 to-emerald-600",
          )}>
          {live ? <PauseCircle className="mx-auto h-3 w-3" /> : <Power className="mx-auto h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ── brief sheet ────────────────────────────────────────────────────────────

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
      {children}
      {hint && <span className="font-semibold normal-case tracking-normal text-muted-foreground/70"> — {hint}</span>}
    </p>
  );
}

function BriefSheet({ agent, onClose, onSaved, onPatch, ask }: {
  agent: VoiceAgentDraft | null;
  onClose: () => void;
  onSaved: (id: string) => void | Promise<void>;
  onPatch: (p: Partial<VoiceAgentDraft>) => Promise<void>;
  ask: (t: string, d?: string, m?: boolean) => Promise<string | null>;
}) {
  const { toast } = useToast();
  const editing = Boolean(agent);
  const [preset, setPreset] = useState(agent?.preset || "recep");
  const [business, setBusiness] = useState(agent?.business || "");
  const [greeting, setGreeting] = useState(agent?.greeting || "");
  const [brand, setBrand] = useState<BrandLite | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>(agent?.knowledge || []);
  const [skillKeys, setSkillKeys] = useState<string[]>(
    agent?.skills.map((s) => s.key) || PRESET_BY_KEY.recep.skills,
  );
  const [answerMode, setAnswerMode] = useState<AnswerMode>(agent?.answerMode || "always");
  const [busy, setBusy] = useState(false);

  // Numbers.
  const [numbers, setNumbers] = useState<AgentNumber[]>([]);
  const [linkable, setLinkable] = useState<{ e164: string; twilioSid: string } | null>(null);
  const [numMode, setNumMode] = useState<"have" | "new" | "forward">("new");
  const [numberId, setNumberId] = useState<string | null>(agent?.phoneNumberId || null);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/voice-agent/numbers?action=mine").then((r) => r.json());
        if (j?.success) {
          setNumbers(j.numbers);
          setLinkable(j.linkable);
          if (j.numbers.length && !numberId) setNumMode("have");
          else if (j.linkable) setNumMode("have");
        }
      } catch { /* the picker just starts empty */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The account already knows who the business is — never make them type it
  // again. Prefills only what's still blank, so it can't clobber typed input
  // or an existing agent's saved brief.
  useEffect(() => {
    let alive = true;
    fetch("/api/brand")
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.success) return;
        const bk = j.data?.brandKit as BrandLite | null;
        if (!bk?.name) return;
        setBrand(bk);

        // Decide from the values captured at mount, NOT from inside a state
        // updater — an updater's body runs during the next render, so a flag
        // flipped in there always reads back stale right here.
        const blurb = brandToBusinessBlurb(bk);
        const site = bk.website ? String(bk.website) : "";
        const fillBusiness = !business.trim() && Boolean(blurb);
        const fillGreeting = !greeting.trim();
        // Their own site is the one link worth reading by default.
        const fillSite = Boolean(site) && !knowledge.some((x) => x.url === site);

        if (fillBusiness) setBusiness(blurb);
        if (fillGreeting) setGreeting(greetingFor(preset, bk.name));
        if (fillSite) {
          setKnowledge((k) => [
            ...k,
            { kind: "url", label: site.replace(/^https?:\/\//, "").slice(0, 40), url: site },
          ]);
        }
        if (fillBusiness || fillGreeting || fillSite) setPrefilled(true);
      })
      .catch(() => { /* the brief just starts blank */ });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Picking a preset reseeds the skills, unless the user has already tuned them.
  const pickPreset = (key: string) => {
    setPreset(key);
    setSkillKeys(PRESET_BY_KEY[key]?.skills || []);
    if (!greeting.trim()) setGreeting(greetingFor(key, brand?.name));
  };

  const addKnowledge = async () => {
    const url = await ask("Paste a link the agent should read (your site, a price list…)", "https://");
    if (!url || !/^https?:\/\//i.test(url)) return;
    setKnowledge((k) => [...k, { kind: "url", label: url.replace(/^https?:\/\//, "").slice(0, 40), url }]);
  };

  const submit = async () => {
    if (!business.trim()) {
      toast({ title: "Tell it about your business first", description: "A line or two is enough." });
      return;
    }
    setBusy(true);
    try {
      if (editing && agent) {
        await onPatch({
          preset, business, greeting, knowledge, answerMode,
          skills: skillKeys
            .map((k) => SKILL_BY_KEY[k])
            .filter(Boolean)
            .map((d, i) => agent.skills.find((s) => s.key === d.key) || skillFromDef(d, `sk_${d.key}_${i}`)),
          ...(numberId !== agent.phoneNumberId ? { phoneNumberId: numberId } : {}),
        });
        await onSaved(agent.id);
        return;
      }
      const j = await fetch("/api/voice-agent/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset, business, greeting, knowledge, skillKeys, answerMode,
          phoneNumberId: numberId,
          name: PRESET_BY_KEY[preset]?.title,
        }),
      }).then((r) => r.json());
      if (!j?.success) {
        toast({ title: j?.error?.message || "Could not build that agent", variant: "destructive" });
        return;
      }
      await onSaved(j.agent.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-400">BRIEF</span>
          <b className="text-[13.5px]">{editing ? "Edit your agent" : "Voice agent"}</b>
          <button onClick={onClose}
            className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SectionLabel hint="pick a starting point, then tune it — everything below is pre-filled for you">
            What should it do?
          </SectionLabel>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => pickPreset(p.key)}
                className={cn(
                  "w-[158px] flex-none overflow-hidden rounded-xl border-2 text-left transition",
                  preset === p.key ? "border-brand-500" : p.key === "custom" ? "border-dashed border-border hover:-translate-y-0.5" : "border-transparent hover:-translate-y-0.5",
                )}>
                <span className={cn("relative grid aspect-[16/9] w-full place-items-center bg-gradient-to-br text-[30px]", PRESET_ART[p.key])}>
                  {p.emoji}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  {preset === p.key && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[8px] font-bold text-white">✓</span>
                  )}
                </span>
                <span className={cn("block p-2.5", preset === p.key ? "bg-brand-500/5" : "bg-muted/30")}>
                  <b className="block text-[11px]">{p.title}</b>
                  <span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{p.blurb}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <SectionLabel hint="the agent reads this before every call">Tell it about your business</SectionLabel>
            {prefilled && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-brand-500/25 bg-brand-500/5 px-2 py-1 text-[10px] font-semibold text-brand-400">
                <Sparkles className="h-3 w-3" />
                Filled in from your Brand Kit — edit anything
              </p>
            )}
            <textarea value={business} onChange={(e) => setBusiness(e.target.value)}
              placeholder="What you do, where you are, who's who, anything a caller might ask…"
              className="min-h-[74px] w-full resize-y rounded-xl border border-border bg-muted/40 p-3 text-[12.5px] leading-relaxed outline-none focus:border-brand-500" />
            <div className="mt-2 flex flex-wrap gap-1">
              {knowledge.map((k, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                  {k.kind === "url" ? <Link2 className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                  {k.label}
                  <button onClick={() => setKnowledge((x) => x.filter((_, n) => n !== i))} className="hover:text-rose-500">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <button onClick={addKnowledge}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground hover:border-brand-500 hover:text-brand-500">
                <Plus className="h-2.5 w-2.5" /> Add a link
              </button>
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel hint="the first thing every caller hears">Greeting</SectionLabel>
            <input value={greeting} onChange={(e) => setGreeting(e.target.value)}
              placeholder="Thanks for calling — how can I help?"
              className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" />
          </div>

          <div className="mt-5">
            <SectionLabel hint="each one uses a part of your account you already have">
              What it&apos;s allowed to do
            </SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SKILL_CATALOG.map((d) => {
                const on = skillKeys.includes(d.key);
                return (
                  <button key={d.key}
                    onClick={() => setSkillKeys((k) => (on ? k.filter((x) => x !== d.key) : [...k, d.key]))}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition",
                      on ? "border-brand-500 bg-brand-500/5" : "border-border bg-muted/30 hover:border-brand-500/40",
                    )}>
                    <span className={cn(
                      "mt-0.5 grid h-[15px] w-[15px] flex-none place-items-center rounded border text-[9px] text-white",
                      on ? "border-brand-500 bg-brand-500" : "border-border",
                    )}>
                      {on && "✓"}
                    </span>
                    <span className="min-w-0">
                      <b className="block text-[11px]">{d.title}</b>
                      <span className="block text-[9.5px] leading-snug text-muted-foreground">{d.blurb}</span>
                      <span className="mt-1 inline-block rounded bg-violet-500/12 px-1.5 py-0.5 text-[8.5px] font-bold text-violet-400">
                        {d.via}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel hint="the agent needs a line to answer">Your number</SectionLabel>
            <NumberPicker
              numbers={numbers} linkable={linkable}
              mode={numMode} onMode={setNumMode}
              numberId={numberId} onNumberId={setNumberId}
              onRefresh={async () => {
                const j = await fetch("/api/voice-agent/numbers?action=mine").then((r) => r.json());
                if (j?.success) { setNumbers(j.numbers); setLinkable(j.linkable); }
              }}
              ask={ask}
            />
          </div>

          <div className="mt-5">
            <SectionLabel>When should it answer?</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {ANSWER_MODES.map((m) => (
                <button key={m.key} onClick={() => setAnswerMode(m.key)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-center transition",
                    answerMode === m.key
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-border text-muted-foreground hover:border-brand-500/40",
                  )}>
                  <span className="block text-[12px] font-bold">{m.title}</span>
                  <span className="text-[10px] text-muted-foreground">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted-foreground">
            Building is free · calls cost <b className="text-amber-500">9 cr / min</b>
            {numMode === "new" && <> · new number <b className="text-amber-500">500 cr / month</b></>}
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold">
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
            {busy ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />}
            {editing ? "Save" : "Build my agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── number picker ──────────────────────────────────────────────────────────

type Available = {
  phoneNumber: string; locality: string; region: string;
  capabilities: { voice: boolean; sms: boolean };
};

function NumberPicker({ numbers, linkable, mode, onMode, numberId, onNumberId, onRefresh, ask }: {
  numbers: AgentNumber[];
  linkable: { e164: string; twilioSid: string } | null;
  mode: "have" | "new" | "forward";
  onMode: (m: "have" | "new" | "forward") => void;
  numberId: string | null;
  onNumberId: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  ask: (t: string, d?: string, m?: boolean) => Promise<string | null>;
}) {
  const { toast } = useToast();
  const [areaCode, setAreaCode] = useState("");
  const [numberType, setNumberType] = useState<"local" | "tollFree">("local");
  const [results, setResults] = useState<Available[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState(false);

  const free = numbers.filter((n) => !n.agent);

  const search = async () => {
    setSearching(true);
    try {
      const q = new URLSearchParams({ numberType });
      if (areaCode.trim()) q.set("areaCode", areaCode.trim());
      const j = await fetch(`/api/voice-agent/numbers?${q}`).then((r) => r.json());
      if (!j?.success) {
        toast({ title: j?.error?.message || "Could not search for numbers", variant: "destructive" });
        return;
      }
      setResults(j.numbers);
      setPicked(j.numbers[0]?.phoneNumber || null);
      if (!j.numbers.length) toast({ title: "No numbers there", description: "Try another area code." });
    } finally {
      setSearching(false);
    }
  };

  const subscribe = async () => {
    if (!picked) return;
    setBuying(true);
    try {
      const found = results.find((r) => r.phoneNumber === picked);
      const j = await fetch("/api/voice-agent/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "subscribe",
          phoneNumber: picked,
          numberType,
          region: found ? [found.locality, found.region].filter(Boolean).join(", ") : undefined,
          smsCapable: found?.capabilities.sms,
        }),
      }).then((r) => r.json());
      if (!j?.success) {
        toast({ title: j?.error?.message || "Could not get that number", variant: "destructive" });
        return;
      }
      toast({ title: `${fmtNumber(j.number.e164)} is yours`, description: "It's ready to answer." });
      await onRefresh();
      onNumberId(j.number.id);
      onMode("have");
      setResults([]);
    } finally {
      setBuying(false);
    }
  };

  const link = async () => {
    const j = await fetch("/api/voice-agent/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "link" }),
    }).then((r) => r.json());
    if (!j?.success) {
      toast({ title: j?.error?.message || "Could not add voice to that number", variant: "destructive" });
      return;
    }
    toast({ title: "Voice added", description: "No extra rent — it's the number you already have." });
    await onRefresh();
    onNumberId(j.number.id);
  };

  const forward = async () => {
    const e164 = await ask("What's your business number? Include the country code.", "+1");
    if (!e164) return;
    const j = await fetch("/api/voice-agent/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "forward", phoneNumber: e164.trim() }),
    }).then((r) => r.json());
    if (!j?.success) {
      toast({ title: j?.error?.message || "Could not add that number", variant: "destructive" });
      return;
    }
    toast({ title: "Number added", description: "Forward your line to it and the agent will answer." });
    await onRefresh();
    onNumberId(j.number.id);
    onMode("have");
  };

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {(free.length > 0 || linkable) && (
          <button onClick={() => onMode("have")}
            className={cn(
              "min-w-[210px] flex-1 rounded-xl border-2 p-3 text-left",
              mode === "have" ? "border-brand-500 bg-brand-500/5" : "border-transparent bg-muted/30",
            )}>
            <b className="flex items-center gap-1.5 text-[11.5px]">
              <Hash className="h-3.5 w-3.5" /> Use a number I have
              <span className="ml-auto text-[10px] font-extrabold text-emerald-500">Free</span>
            </b>
            <span className="mt-1 block text-[9.5px] leading-snug text-muted-foreground">
              {free.length
                ? `${free.length} of your numbers ${free.length === 1 ? "isn't" : "aren't"} answering yet.`
                : `You already rent ${linkable ? fmtNumber(linkable.e164) : "a number"} for texts — no extra rent.`}
            </span>
          </button>
        )}
        <button onClick={() => onMode("new")}
          className={cn(
            "min-w-[210px] flex-1 rounded-xl border-2 p-3 text-left",
            mode === "new" ? "border-brand-500 bg-brand-500/5" : "border-transparent bg-muted/30",
          )}>
          <b className="flex items-center gap-1.5 text-[11.5px]">
            <Phone className="h-3.5 w-3.5" /> Subscribe to a new number
            <span className="ml-auto text-[10px] font-extrabold text-amber-500">500 cr / month</span>
          </b>
          <span className="mt-1 block text-[9.5px] leading-snug text-muted-foreground">
            Pick an area code, pick a number, live in about a minute.
          </span>
        </button>
        <button onClick={() => { onMode("forward"); void forward(); }}
          className={cn(
            "min-w-[210px] flex-1 rounded-xl border-2 p-3 text-left",
            mode === "forward" ? "border-brand-500 bg-brand-500/5" : "border-transparent bg-muted/30",
          )}>
          <b className="flex items-center gap-1.5 text-[11.5px]">
            <Link2 className="h-3.5 w-3.5" /> Forward my existing line
            <span className="ml-auto text-[10px] font-extrabold text-emerald-500">Free</span>
          </b>
          <span className="mt-1 block text-[9.5px] leading-snug text-muted-foreground">
            Keep the number on your cards — forward it here and the agent answers.
          </span>
        </button>
      </div>

      {mode === "have" && (
        <div className="mt-2.5 space-y-2">
          {free.map((n) => (
            <button key={n.id} onClick={() => onNumberId(n.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left",
                numberId === n.id ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-brand-500/50",
              )}>
              <Phone className="h-3.5 w-3.5 flex-none text-cyan-500" />
              <span className="min-w-0 flex-1">
                <b className="block font-mono text-[12px]">{fmtNumber(n.e164)}</b>
                <span className="text-[9.5px] text-muted-foreground">
                  {n.source === "SMS_LINKED" ? "Shared with your texts" : n.source === "FORWARDED" ? "Forwarded" : "Dedicated"}
                  {n.region ? ` · ${n.region}` : ""}
                </span>
              </span>
              {numberId === n.id && <span className="text-[10px] font-bold text-brand-400">Selected</span>}
            </button>
          ))}
          {linkable && (
            <button onClick={link}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border p-2.5 text-left hover:border-brand-500">
              <Plus className="h-3.5 w-3.5 flex-none text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <b className="block font-mono text-[12px]">{fmtNumber(linkable.e164)}</b>
                <span className="text-[9.5px] text-muted-foreground">
                  You rent this for texts — add voice to it for no extra rent.
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          {!free.length && !linkable && (
            <p className="text-[11px] text-muted-foreground">No spare numbers — subscribe to one instead.</p>
          )}
        </div>
      )}

      {mode === "new" && (
        <div className="mt-2.5 overflow-hidden rounded-xl border border-border bg-muted/30">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Find a number</span>
            <input value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Area code"
              className="w-[96px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500" />
            <select value={numberType} onChange={(e) => setNumberType(e.target.value as "local" | "tollFree")}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] outline-none focus:border-brand-500">
              <option value="local">Local</option>
              <option value="tollFree">Toll-free</option>
            </select>
            <button onClick={search} disabled={searching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500 disabled:opacity-60">
              {searching ? <FlowLoader size={12} /> : <Search className="h-3.5 w-3.5" />} Search
            </button>
            {results.length > 0 && (
              <span className="ml-auto text-[9.5px] text-muted-foreground">{results.length} available</span>
            )}
          </div>

          {results.length > 0 ? (
            <>
              <div className="grid gap-1.5 p-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r) => (
                  <button key={r.phoneNumber} onClick={() => setPicked(r.phoneNumber)}
                    className={cn(
                      "rounded-lg border-2 bg-card p-2.5 text-left transition hover:-translate-y-0.5",
                      picked === r.phoneNumber ? "border-brand-500 bg-brand-500/5" : "border-transparent hover:border-brand-500/40",
                    )}>
                    <b className="block font-mono text-[12.5px] font-extrabold">{fmtNumber(r.phoneNumber)}</b>
                    <span className="block text-[9.5px] text-muted-foreground">
                      {[r.locality, r.region].filter(Boolean).join(", ") || "—"}
                    </span>
                    <span className="mt-1.5 flex gap-1">
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-extrabold text-emerald-500">Voice</span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[8px] font-extrabold",
                        r.capabilities.sms ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
                      )}>
                        Texts
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
                <span className="text-[10.5px] text-muted-foreground">
                  Selected <b className="font-mono text-foreground">{picked ? fmtNumber(picked) : "—"}</b>
                </span>
                <div className="flex-1" />
                <span className="text-[10.5px] text-muted-foreground">
                  First month <b className="text-amber-500">500 cr</b> · then 500 cr/month
                </span>
                <button onClick={subscribe} disabled={!picked || buying}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
                  {buying ? <FlowLoader size={12} tone="white" /> : <Coins className="h-3.5 w-3.5" />} Subscribe
                </button>
              </div>
            </>
          ) : (
            <p className="p-3 text-[11px] text-muted-foreground">
              Search an area code to see what&apos;s free. You&apos;re only charged when you pick one.
            </p>
          )}
        </div>
      )}

      <p className="mt-2 rounded-r-lg border-l-2 border-brand-500/40 bg-brand-500/5 py-2 pl-2.5 pr-3 text-[10px] leading-relaxed text-muted-foreground">
        The number is yours for as long as you keep it — cancel any time from the back office and you
        aren&apos;t charged again. Only calls the agent actually answers cost minutes.
      </p>
    </>
  );
}

// ── back office ────────────────────────────────────────────────────────────

function BackOffice({ agent, calls, stats, onClose, onPatch, onRefresh, onOpenView }: {
  agent: VoiceAgentDraft; calls: AgentCall[]; stats: Stats | null;
  onClose: () => void;
  onPatch: (p: Partial<VoiceAgentDraft>) => Promise<void>;
  onRefresh: () => void | Promise<void>;
  onOpenView?: (key: string) => void;
}) {
  const [tab, setTab] = useState<"calls" | "controls" | "number">("calls");
  const [sel, setSel] = useState<string | null>(calls[0]?.id || null);
  const [filter, setFilter] = useState<string>("all");

  const shown = useMemo(
    () => (filter === "all" ? calls : calls.filter((c) => c.outcome === filter)),
    [calls, filter],
  );
  const call = shown.find((c) => c.id === sel) || shown[0] || null;
  const live = agent.status === "LIVE";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-bold">{agent.name}</h3>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {agent.number ? fmtNumber(agent.number.e164) : "No number yet"}
            {agent.liveSince && ` · answering since ${new Date(agent.liveSince).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
          </p>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
          live ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground",
        )}>
          <i className={cn("h-1.5 w-1.5 rounded-full", live && "animate-pulse bg-emerald-500")} />
          {live ? "LIVE" : agent.status}
        </span>
        <button onClick={() => onPatch({ status: live ? "PAUSED" : "LIVE" })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500">
          {live ? <><PauseCircle className="h-3.5 w-3.5" /> Pause</> : <><Power className="h-3.5 w-3.5" /> Go live</>}
        </button>
        <button onClick={() => void onRefresh()}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-brand-500">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-border px-4">
        {([
          { k: "calls", label: "Calls", icon: <PhoneCall className="h-3.5 w-3.5" /> },
          { k: "controls", label: "Controls", icon: <Settings className="h-3.5 w-3.5" /> },
          { k: "number", label: "Number", icon: <Hash className="h-3.5 w-3.5" /> },
        ] as const).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-[12.5px] font-bold",
              tab === t.k ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "calls" && (
          <>
            {stats && (
              <div className="mb-3.5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { k: "Calls answered", v: stats.answered, d: `of ${stats.calls} · ${stats.missed} missed` },
                  { k: "Booked", v: stats.booked, d: "→ your calendar", tone: "text-emerald-500" },
                  { k: "Leads saved", v: stats.leads, d: "→ your lead list" },
                  { k: "Handed to you", v: stats.escalated, d: stats.calls ? `${Math.round((stats.escalated / stats.calls) * 100)}% of calls` : "—", tone: "text-amber-500" },
                  { k: "Avg length", v: stats.avgSec ? fmtDuration(stats.avgSec) : "—", d: `${Math.round(stats.totalSec / 60)} min total` },
                  { k: "Spent", v: `${stats.credits} cr`, d: `of ${agent.spendCapCredits.toLocaleString()} cap`, tone: "text-amber-500" },
                ].map((t) => (
                  <div key={t.k} className="rounded-xl border border-border bg-card p-3">
                    <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-muted-foreground">{t.k}</div>
                    <div className={cn("mt-0.5 text-[19px] font-extrabold tabular-nums", t.tone)}>{t.v}</div>
                    <div className="text-[9.5px] text-muted-foreground">{t.d}</div>
                  </div>
                ))}
              </div>
            )}

            {calls.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
                <PhoneCall className="mb-2 h-7 w-7 text-muted-foreground" />
                <b className="text-[13px]">No calls yet</b>
                <p className="mt-1 max-w-[320px] text-[11.5px] text-muted-foreground">
                  {live
                    ? "The agent is answering. Every call will land here with its transcript and what it did."
                    : "Switch the agent on and calls will start landing here."}
                </p>
              </div>
            ) : (
              <div className="grid items-start gap-3 lg:grid-cols-[1.15fr_1fr]">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
                    <b className="text-[12px]">Recent calls</b>
                    <div className="ml-auto flex gap-1">
                      {["all", "booked", "lead", "escalated", "missed"].map((f) => (
                        <button key={f} onClick={() => setFilter(f)}
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[9.5px] font-semibold capitalize",
                            filter === f ? "border-brand-500 bg-brand-500/8 text-brand-400" : "border-border text-muted-foreground",
                          )}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {shown.map((c) => (
                    <button key={c.id} onClick={() => setSel(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left last:border-b-0",
                        call?.id === c.id ? "bg-brand-500/7 shadow-[inset_2px_0_0_var(--brand-500,#0ea5e9)]" : "hover:bg-muted/40",
                      )}>
                      <span className={cn(
                        "grid h-6 w-6 flex-none place-items-center rounded-md text-[11px]",
                        c.direction === "inbound" ? "bg-brand-500/15 text-brand-400" : "bg-violet-500/15 text-violet-400",
                      )}>
                        {c.direction === "inbound" ? "↙" : "↗"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[11.5px]">{c.callerName || fmtNumber(c.fromE164)}</b>
                        <span className="text-[9.5px] text-muted-foreground">
                          {new Date(c.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      {c.outcome && <OutcomeChip outcome={c.outcome} />}
                      <span className="w-[34px] flex-none text-right font-mono text-[10px] text-muted-foreground">
                        {fmtDuration(c.durationSec)}
                      </span>
                      <span className="w-[38px] flex-none text-right text-[9.5px] font-bold text-amber-500">
                        {c.creditsCharged} cr
                      </span>
                    </button>
                  ))}
                </div>

                {call && <CallDetail call={call} onOpenView={onOpenView} />}
              </div>
            )}
          </>
        )}

        {tab === "controls" && <Controls agent={agent} onPatch={onPatch} />}
        {tab === "number" && <NumberTab agent={agent} onPatch={onPatch} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: string }) {
  const tone: Record<string, string> = {
    booked: "bg-emerald-500/15 text-emerald-500",
    lead: "bg-brand-500/15 text-brand-400",
    message: "bg-violet-500/15 text-violet-400",
    escalated: "bg-amber-500/15 text-amber-500",
    missed: "bg-rose-500/15 text-rose-500",
    spam: "bg-muted text-muted-foreground",
    answered: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("flex-none rounded-full px-2 py-0.5 text-[8.5px] font-extrabold", tone[outcome] || tone.answered)}>
      {OUTCOME_LABEL[outcome as keyof typeof OUTCOME_LABEL] || outcome.toUpperCase()}
    </span>
  );
}

function CallDetail({ call, onOpenView }: { call: AgentCall; onOpenView?: (key: string) => void }) {
  const linkView: Record<string, string> = { lead: "leads", booking: "calendar", contact: "customers", order: "sell" };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <b className="font-mono text-[12px]">{call.callerName || fmtNumber(call.fromE164)}</b>
        {call.outcome && <span className="ml-auto"><OutcomeChip outcome={call.outcome} /></span>}
        <span className="text-[10px] text-muted-foreground">
          {fmtDuration(call.durationSec)} · {call.creditsCharged} cr
        </span>
      </div>

      {call.outcomeDetail && (
        <div className="mx-3 mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/7 px-2.5 py-2 text-[10.5px]">
          <span className="text-emerald-500">✓</span>
          <span className="text-muted-foreground">{call.outcomeDetail}</span>
        </div>
      )}

      <div className="max-h-[396px] overflow-y-auto p-3">
        {call.transcript.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">No transcript for this call.</p>
        ) : (
          call.transcript.map((t, i) => (
            <div key={i} className="mb-2.5 flex gap-2">
              <span className={cn(
                "grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[8px] font-black text-white",
                t.role === "agent" ? "bg-gradient-to-br from-brand-500 to-violet-500" : "bg-muted text-muted-foreground",
              )}>
                {t.role === "agent" ? "AI" : "?"}
              </span>
              <span className={cn(
                "flex-1 rounded-[10px] border px-2.5 py-1.5 text-[11px] leading-relaxed",
                t.role === "agent" ? "border-brand-500/18 bg-brand-500/6" : "border-border bg-muted/40",
              )}>
                <span className="mb-0.5 block text-[8.5px] tabular-nums text-muted-foreground">{fmtDuration(t.at)}</span>
                {t.text}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2.5">
        {call.recordingUrl && (
          <a href={call.recordingUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500">
            <PlayCircle className="h-3.5 w-3.5" /> Play recording
          </a>
        )}
        {call.linkedType && call.linkedId && onOpenView && linkView[call.linkedType] && (
          <button onClick={() => onOpenView(linkView[call.linkedType!])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500">
            <ChevronRight className="h-3.5 w-3.5" /> Open {call.linkedType}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 border-t border-border py-2.5 first:border-t-0">{children}</div>;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("relative h-4 w-7 flex-none rounded-full transition", on ? "bg-brand-500/35" : "bg-muted")}>
      <span className={cn(
        "absolute top-0.5 h-3 w-3 rounded-full transition-all",
        on ? "left-3.5 bg-brand-400" : "left-0.5 bg-muted-foreground",
      )} />
    </button>
  );
}

function Group({ title, sub, children, danger }: {
  title: string; sub: string; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-3.5", danger ? "border-rose-500/30" : "border-border")}>
      <h4 className="text-[12.5px] font-bold">{title}</h4>
      <p className="mb-2.5 text-[10px] text-muted-foreground">{sub}</p>
      {children}
    </div>
  );
}

function Controls({ agent, onPatch }: { agent: VoiceAgentDraft; onPatch: (p: Partial<VoiceAgentDraft>) => Promise<void> }) {
  const hours: Hours = agent.hours || DEFAULT_HOURS;
  const setDay = (d: DayKey, next: Partial<{ open: string; close: string; on: boolean }>) => {
    const cur = hours[d] || { open: "09:00", close: "17:00", on: false };
    void onPatch({ hours: { ...hours, [d]: { ...cur, ...next } } });
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <Group title="Answering" sub="When the agent picks up instead of you.">
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Let me pick up first</b>
            <span className="text-[9.5px] text-muted-foreground">It answers after {agent.ringFirstSec || 0}s</span></span>
          <Toggle on={agent.ringFirstSec > 0} onClick={() => void onPatch({ ringFirstSec: agent.ringFirstSec > 0 ? 0 : 20 })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Say it&apos;s an AI assistant</b>
            <span className="text-[9.5px] text-muted-foreground">Required in some regions</span></span>
          <Toggle on={agent.discloseAi} onClick={() => void onPatch({ discloseAi: !agent.discloseAi })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">When it answers</b></span>
          <select value={agent.answerMode} onChange={(e) => void onPatch({ answerMode: e.target.value as AnswerMode })}
            className="w-[172px] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500">
            {ANSWER_MODES.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
          </select>
        </Row>
      </Group>

      <Group title="Opening hours" sub="The agent only books inside these.">
        <div className="grid gap-1.5">
          {DAYS.map((d) => {
            const h = hours[d.key] || { open: "09:00", close: "17:00", on: false };
            return (
              <div key={d.key} className="flex items-center gap-2 text-[10px]">
                <span className="w-[30px] font-bold text-muted-foreground">{d.label}</span>
                <input type="time" value={h.open} disabled={!h.on}
                  onChange={(e) => setDay(d.key, { open: e.target.value })}
                  className="w-[86px] rounded-md border border-border bg-muted/40 px-1.5 py-1 text-[11px] outline-none focus:border-brand-500 disabled:opacity-40" />
                <span className="text-muted-foreground">–</span>
                <input type="time" value={h.close} disabled={!h.on}
                  onChange={(e) => setDay(d.key, { close: e.target.value })}
                  className="w-[86px] rounded-md border border-border bg-muted/40 px-1.5 py-1 text-[11px] outline-none focus:border-brand-500 disabled:opacity-40" />
                <span className="ml-auto"><Toggle on={h.on} onClick={() => setDay(d.key, { on: !h.on })} /></span>
              </div>
            );
          })}
        </div>
      </Group>

      <Group title="Escalation" sub="Who the agent rings when it's out of its depth.">
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Ring this number</b></span>
          <input value={agent.escalateTo || ""} placeholder="+1 415 555 0142"
            onChange={(e) => void onPatch({ escalateTo: e.target.value })}
            className="w-[142px] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500" />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Hand off if the caller sounds upset</b></span>
          <Toggle on={agent.escalateOnUpset} onClick={() => void onPatch({ escalateOnUpset: !agent.escalateOnUpset })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Hand off if it&apos;s unsure twice</b></span>
          <Toggle on={agent.escalateOnUnsure} onClick={() => void onPatch({ escalateOnUnsure: !agent.escalateOnUnsure })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Hand off if they ask for a person</b></span>
          <Toggle on={agent.escalateOnAsk} onClick={() => void onPatch({ escalateOnAsk: !agent.escalateOnAsk })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">If nobody picks up</b>
            <span className="text-[9.5px] text-muted-foreground">After 20 seconds</span></span>
          <select value={agent.noAnswerAction}
            onChange={(e) => void onPatch({ noAnswerAction: e.target.value as "message" | "voicemail" | "callback" })}
            className="w-[142px] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500">
            <option value="message">Take a message</option>
            <option value="voicemail">Send to voicemail</option>
            <option value="callback">Offer a callback</option>
          </select>
        </Row>
      </Group>

      <Group title="Spend" sub="A hard cap — the agent stops answering when it's hit.">
        <div className="flex items-center gap-2">
          <input type="range" min={500} max={20000} step={500} value={agent.spendCapCredits}
            onChange={(e) => void onPatch({ spendCapCredits: Number(e.target.value) })}
            className="h-1 flex-1 accent-brand-500" />
          <b className="w-[78px] text-right text-[11.5px] tabular-nums text-amber-500">
            {agent.spendCapCredits.toLocaleString()} cr
          </b>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          ≈ {Math.floor(agent.spendCapCredits / 9)} minutes of calls · {agent.spentThisPeriod.toLocaleString()} cr used this period
        </p>
        {agent.spentThisPeriod > agent.spendCapCredits * 0.8 && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500">
            <AlertTriangle className="h-3 w-3" /> You&apos;re close to the cap — the agent stops answering at it.
          </p>
        )}
        <div className="mt-2">
          <Row>
            <span className="flex-1"><b className="block text-[11px]">Warn me at 80%</b></span>
            <Toggle on={agent.warnAt80} onClick={() => void onPatch({ warnAt80: !agent.warnAt80 })} />
          </Row>
          <Row>
            <span className="flex-1"><b className="block text-[11px]">Top up automatically</b>
              <span className="text-[9.5px] text-muted-foreground">Keeps it answering past the cap</span></span>
            <Toggle on={agent.autoTopUp} onClick={() => void onPatch({ autoTopUp: !agent.autoTopUp })} />
          </Row>
        </div>
      </Group>

      <Group title="Privacy & recording" sub="What the agent keeps after a call.">
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Record calls</b>
            <span className="text-[9.5px] text-muted-foreground">You can play any call back</span></span>
          <Toggle on={agent.recordCalls} onClick={() => void onPatch({ recordCalls: !agent.recordCalls })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Announce recording</b>
            <span className="text-[9.5px] text-muted-foreground">Read at the start of the call</span></span>
          <Toggle on={agent.announceRecording} onClick={() => void onPatch({ announceRecording: !agent.announceRecording })} />
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Keep recordings for</b></span>
          <select value={agent.retainDays} onChange={(e) => void onPatch({ retainDays: Number(e.target.value) })}
            className="w-[112px] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500">
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
        </Row>
        <Row>
          <span className="flex-1"><b className="block text-[11px]">Block known spam callers</b></span>
          <Toggle on={agent.blockSpam} onClick={() => void onPatch({ blockSpam: !agent.blockSpam })} />
        </Row>
      </Group>
    </div>
  );
}

function NumberTab({ agent, onPatch, onRefresh }: {
  agent: VoiceAgentDraft;
  onPatch: (p: Partial<VoiceAgentDraft>) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<AgentNumber[]>([]);
  const load = useCallback(async () => {
    const j = await fetch("/api/voice-agent/numbers?action=mine").then((r) => r.json());
    if (j?.success) setNumbers(j.numbers);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cancel = async (n: AgentNumber) => {
    const j = await fetch(`/api/voice-agent/numbers?id=${n.id}`, { method: "DELETE" }).then((r) => r.json());
    if (!j?.success) {
      toast({ title: j?.error?.message || "Could not cancel that number", variant: "destructive" });
      return;
    }
    toast({
      title: j.released ? "Number released" : "Cancelled",
      description: j.released
        ? "It's gone back to the pool."
        : "You keep it until the end of the month you've paid for.",
    });
    await load();
    await onRefresh();
  };

  return (
    <div className="max-w-[640px] space-y-3">
      {agent.number && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Your number</div>
            <div className="mt-0.5 font-mono text-[15px] font-extrabold">{fmtNumber(agent.number.e164)}</div>
            <div className="text-[9.5px] text-muted-foreground">{agent.number.region || "—"}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Status</div>
            <div className={cn("mt-0.5 text-[15px] font-extrabold", agent.status === "LIVE" ? "text-emerald-500" : "")}>
              {agent.status === "LIVE" ? "Receiving" : "Not answering"}
            </div>
            <div className="text-[9.5px] text-muted-foreground">
              {agent.number.rentPaidUntil
                ? `${agent.number.cancelAtPeriodEnd ? "Ends" : "Renews"} ${new Date(agent.number.rentPaidUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${agent.number.rentCredits} cr`
                : "No rent — it's your own line"}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-3 py-2.5"><b className="text-[12px]">Numbers</b></div>
        <div className="p-3">
          {numbers.length === 0 && <p className="text-[11.5px] text-muted-foreground">No numbers yet.</p>}
          {numbers.map((n) => (
            <Row key={n.id}>
              <span className="min-w-0 flex-1">
                <b className="block font-mono text-[11.5px]">{fmtNumber(n.e164)}</b>
                <span className="text-[9.5px] text-muted-foreground">
                  {n.agent ? `${n.agent.name} answers it` : "No agent answering it yet"}
                  {n.source === "SMS_LINKED" && " · shared with your texts"}
                  {n.source === "FORWARDED" && " · forwarded"}
                  {n.cancelAtPeriodEnd && " · cancels at the end of the month"}
                </span>
              </span>
              {!n.agent && agent.phoneNumberId !== n.id && (
                <button onClick={() => onPatch({ phoneNumberId: n.id })}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500">
                  Use this
                </button>
              )}
              <button onClick={() => cancel(n)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-rose-500 hover:text-rose-500">
                <Trash2 className="h-3 w-3" /> {n.source === "RENTED" ? "Cancel" : "Remove"}
              </button>
            </Row>
          ))}
        </div>
      </div>

      <p className="rounded-r-lg border-l-2 border-brand-500/40 bg-brand-500/5 py-2 pl-2.5 pr-3 text-[10px] leading-relaxed text-muted-foreground">
        Prefer to keep the number on your cards? Forward your existing line here and the agent answers
        it — your number stays yours, and there&apos;s no rent.
      </p>
    </div>
  );
}

// ── agents drawer ──────────────────────────────────────────────────────────

function AgentsDrawer({ agents, activeId, onPick, onNew, onClose }: {
  agents: VoiceAgentDraft[]; activeId?: string;
  onPick: (id: string) => void; onNew: () => void; onClose: () => void;
}) {
  return (
    <>
      <div className="absolute inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 z-50 w-[340px] overflow-auto border-l border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <b className="text-[13.5px]">Your agents</b>
          <button onClick={onClose}
            className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
        {agents.length === 0 && <p className="text-[11.5px] text-muted-foreground">Nothing yet.</p>}
        <div className="space-y-2">
          {agents.map((a) => (
            <button key={a.id} onClick={() => onPick(a.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left",
                a.id === activeId ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-brand-500/60",
              )}>
              <span className="text-[19px]">{PRESET_BY_KEY[a.preset]?.emoji || "☎"}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[12.5px]">{a.name}</b>
                <span className="text-[10.5px] text-muted-foreground">
                  {a.number ? fmtNumber(a.number.e164) : "No number"} · {a.status.toLowerCase()}
                </span>
              </span>
              {a.status === "LIVE" && <i className="h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-emerald-500" />}
            </button>
          ))}
        </div>
        <button onClick={onNew}
          className="mt-3 w-full rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-bold text-white">
          New agent
        </button>
      </div>
    </>
  );
}
