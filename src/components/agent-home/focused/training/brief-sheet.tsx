"use client";

/**
 * The session brief — the canonical full-width bottom sheet.
 * [[brief-modals-unified]] — inset-x-3 bottom-3 … sm:inset-x-5 sm:bottom-4, z-40.
 *
 * Collects what the room needs, drafts an agenda from it, and shows the live
 * credit estimate BEFORE anything is built. Co-hosts are picked here, before
 * anyone joins — a co-host you can only make mid-session isn't much use.
 * [[training-studio]]
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles, X, Presentation, PenLine, FileText, Clapperboard, ImageIcon, Users,
  Upload, Plus, DoorOpen, Circle, Pencil, Monitor, ScrollText, Star, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SEGMENT_KINDS, type SegmentKind, type SessionType, type AccessMode } from "@/lib/training/types";

export interface BriefDraft {
  brief: string;
  sessionType: SessionType;
  seats: number;
  access: AccessMode;
  startsAt: string;
  recording: boolean;
  transcript: boolean;
  openDraw: boolean;
  openShare: boolean;
  waitingRoom: boolean;
  boardBg: "blank" | "grid" | "dark";
  segments: { kind: SegmentKind; title: string; durationMins: number }[];
  cohostEmails: string[];
}

const TYPES: { v: SessionType; label: string }[] = [
  { v: "training", label: "Training" },
  { v: "workshop", label: "Workshop" },
  { v: "webinar", label: "Webinar" },
  { v: "onboarding", label: "Onboarding" },
  { v: "coaching", label: "1-on-1 coaching" },
];
const KIND_ICON = { slides: Presentation, board: PenLine, doc: FileText, video: Clapperboard, draw: ImageIcon, discuss: Users } as const;
const BOARDS: { v: BriefDraft["boardBg"]; label: string; sub: string }[] = [
  { v: "grid", label: "Grid board", sub: "Diagrams, flows" },
  { v: "blank", label: "Blank board", sub: "Draw from scratch" },
  { v: "dark", label: "Dark board", sub: "Easy on the eyes" },
];

export const DEFAULT_BRIEF: BriefDraft = {
  brief: "",
  sessionType: "training",
  seats: 12,
  access: "invite",
  startsAt: "",
  recording: true,
  transcript: true,
  openDraw: false,
  openShare: false,
  waitingRoom: true,
  boardBg: "grid",
  segments: [
    { kind: "slides", title: "Walk the deck", durationMins: 12 },
    { kind: "board", title: "Whiteboard it together", durationMins: 15 },
    { kind: "discuss", title: "Questions & practice", durationMins: 10 },
  ],
  cohostEmails: [],
};

interface Estimate {
  total: number;
  breakdown: { label: string; credits: number }[];
  availableCredits: number;
  hasEnoughCredits: boolean;
}

interface Props {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onBuild: (d: BriefDraft) => void;
}

export function BriefSheet({ open, busy, onClose, onBuild }: Props) {
  const [d, setD] = useState<BriefDraft>(DEFAULT_BRIEF);
  const [est, setEst] = useState<Estimate | null>(null);
  const set = <K extends keyof BriefDraft>(k: K, v: BriefDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const mins = useMemo(() => d.segments.reduce((m, s) => m + s.durationMins, 0), [d.segments]);

  // Re-price on every change, so the number they agree to is the number charged.
  const price = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/training/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: d.seats, plannedMins: mins, recording: d.recording, transcript: d.transcript }),
      }).then((x) => x.json());
      if (r?.success) setEst(r.data as Estimate);
    } catch {
      /* the estimate is a nicety — never block the brief on it */
    }
  }, [d.seats, mins, d.recording, d.transcript]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void price(), 250);
    return () => clearTimeout(t);
  }, [open, price]);

  if (!open) return null;

  const addSeg = (kind: SegmentKind) => {
    const meta = SEGMENT_KINDS[kind];
    set("segments", [...d.segments, { kind, title: meta.label, durationMins: meta.mins }]);
  };
  const dropSeg = (i: number) => set("segments", d.segments.filter((_, x) => x !== i));

  return (
    <>
      <div className="absolute inset-0 z-[39] bg-black/55" onClick={onClose} />
      <div className="absolute inset-x-3 bottom-3 top-4 z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <div>
            <b className="block text-[13px] leading-tight">New training session</b>
            <span className="text-[11px] text-muted-foreground">Describe it — we&apos;ll draft the agenda, the board and the room</span>
          </div>
          <button onClick={onClose} className="ms-auto grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400">
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto grid max-w-[1080px] gap-5 lg:grid-cols-[1.35fr_1fr]">
            {/* ---- left: the brief ---- */}
            <div>
              <Field label="What are you training, and who's in the room?">
                <textarea
                  value={d.brief}
                  onChange={(e) => set("brief", e.target.value)}
                  placeholder="Onboard new sales reps on the pitch — walk the deck, whiteboard the objection-handling loop, then role-play in pairs."
                  className="min-h-[86px] w-full resize-y rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] leading-relaxed outline-none focus:border-brand-500"
                />
              </Field>

              <Field label="Session type">
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <Pick key={t.v} on={d.sessionType === t.v} onClick={() => set("sessionType", t.v)}>{t.label}</Pick>
                  ))}
                </div>
              </Field>

              <Field label="Agenda" hint="the segments become the nodes on your canvas">
                <div className="flex flex-col gap-1.5">
                  {d.segments.map((s, i) => {
                    const Icon = KIND_ICON[s.kind];
                    return (
                      <div key={`${s.kind}-${i}`} className="flex items-center gap-2 rounded-xl border border-border bg-muted px-2.5 py-2">
                        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-card">
                          <Icon className="h-3 w-3 text-brand-400" />
                        </span>
                        <input
                          value={s.title}
                          onChange={(e) => set("segments", d.segments.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                          className="flex-1 border-none bg-transparent text-[11px] font-semibold outline-none"
                        />
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={s.durationMins}
                          onChange={(e) => set("segments", d.segments.map((x, j) => (j === i ? { ...x, durationMins: Math.max(1, +e.target.value || 1) } : x)))}
                          className="w-[52px] rounded-md border border-border bg-card px-1.5 py-0.5 text-right text-[10px] text-muted-foreground outline-none focus:border-brand-500"
                        />
                        <span className="text-[10px] text-muted-foreground">min</span>
                        <button onClick={() => dropSeg(i)} className="grid h-[18px] w-[18px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(Object.keys(SEGMENT_KINDS) as SegmentKind[]).map((k) => {
                      const Icon = KIND_ICON[k];
                      return (
                        <button key={k} onClick={() => addSeg(k)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-[9.5px] font-semibold hover:border-brand-500 hover:text-brand-400">
                          <Icon className="h-2.5 w-2.5" /> {SEGMENT_KINDS[k].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Field>

              <Field label="What's on the board?">
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))" }}>
                  {BOARDS.map((b) => (
                    <button key={b.v} onClick={() => set("boardBg", b.v)} className={cn("overflow-hidden rounded-xl border bg-muted text-left", d.boardBg === b.v ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}>
                      <span
                        className={cn("block aspect-[16/10]", b.v === "dark" ? "bg-[#12141a]" : "bg-[#f8f8f5]")}
                        style={b.v === "grid" ? { backgroundImage: "radial-gradient(circle at 1px 1px,#d8d8d0 1px,transparent 0)", backgroundSize: "9px 9px" } : undefined}
                      />
                      <span className="block px-2 py-1.5">
                        <b className="block text-[10px]">{b.label}</b>
                        <span className="block text-[8.5px] leading-tight text-muted-foreground">{b.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Materials" hint="PDF, deck, image or video — add them once the room exists">
                <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-5 text-center">
                  <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                  <b className="mt-1.5 block text-[11.5px]">Build the room first</b>
                  <span className="text-[10px] text-muted-foreground">Then drop files in — they become board backdrops you annotate live</span>
                </div>
              </Field>
            </div>

            {/* ---- right: setup + estimate ---- */}
            <div className="flex flex-col gap-2.5">
              <Card title="Room setup" Icon={DoorOpen}>
                <Field label="Seats" hint="how many can join">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={d.seats}
                    onChange={(e) => set("seats", Math.min(200, Math.max(1, +e.target.value || 1)))}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Co-hosts" hint="they can share, draw & admit">
                  <CohostPicker emails={d.cohostEmails} onChange={(v) => set("cohostEmails", v)} />
                </Field>
                <Field label="Who can join">
                  <div className="flex flex-wrap gap-1.5">
                    {([["invite", "Invite only"], ["link_email", "Link + email"], ["open", "Open link"]] as [AccessMode, string][]).map(([v, l]) => (
                      <Pick key={v} on={d.access === v} onClick={() => set("access", v)}>{l}</Pick>
                    ))}
                  </div>
                </Field>
                <Field label="Starts">
                  <input
                    type="datetime-local"
                    value={d.startsAt}
                    onChange={(e) => set("startsAt", e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] outline-none focus:border-brand-500"
                  />
                </Field>
              </Card>

              <Card title="During the session" Icon={Pencil}>
                <Tg on={d.waitingRoom} onClick={() => set("waitingRoom", !d.waitingRoom)} Icon={DoorOpen} t="Waiting room" s="Admit people yourself" />
                <Tg on={d.recording} onClick={() => set("recording", !d.recording)} Icon={Circle} t="Record it" s="Saved to your library" />
                <Tg on={d.openDraw} onClick={() => set("openDraw", !d.openDraw)} Icon={Pencil} t="Anyone can draw" s="Or hand the pen out yourself" />
                <Tg on={d.openShare} onClick={() => set("openShare", !d.openShare)} Icon={Monitor} t="Anyone can share screen" s="Off = hosts, plus who you allow" />
                <Tg on={d.transcript} onClick={() => set("transcript", !d.transcript)} Icon={ScrollText} t="Live transcript" s="Notes + summary after" />
              </Card>

              <Card title="What this costs" Icon={Zap}>
                {(est?.breakdown ?? []).map((b) => (
                  <div key={b.label} className="flex justify-between border-b border-border/70 py-1.5 text-[11px] last:border-b-0">
                    <span className="text-muted-foreground">{b.label}</span>
                    <b>{b.credits}</b>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-[13px] font-extrabold">
                  <span>Estimated</span>
                  <b className="text-violet-400">{est ? `${est.total} credits` : "—"}</b>
                </div>
                {est ? (
                  <p className={cn("mt-1 text-right text-[10px]", est.hasEnoughCredits ? "text-muted-foreground" : "text-rose-400")}>
                    {est.hasEnoughCredits ? <>You have <b className="text-emerald-400">{est.availableCredits}</b> credits</> : <>You have {est.availableCredits} — that&apos;s not enough yet</>}
                  </p>
                ) : null}
                <p className="mt-2 rounded-lg border border-brand-500/25 bg-brand-500/[0.07] px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  You&apos;re billed for the time people are <b className="text-brand-400">actually in the room</b>, as it runs — not for seats that stay empty.
                </p>
              </Card>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-t border-border bg-muted px-4 py-3">
          <span className="text-[10.5px] text-muted-foreground">Guests join by link — no account needed.</span>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500">Cancel</button>
          <button
            onClick={() => onBuild({ ...d, segments: d.segments })}
            disabled={busy || !d.segments.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" /> {busy ? "Building…" : "Build the room"}
          </button>
        </div>
      </div>
    </>
  );
}

function CohostPicker({ emails, onChange }: { emails: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const e = draft.trim().toLowerCase();
    if (!e || !e.includes("@") || emails.includes(e)) return;
    onChange([...emails, e]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {emails.map((e) => (
        <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pe-1.5 ps-1 text-[10.5px]">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 text-[8px] font-black text-white">
            {e.slice(0, 2).toUpperCase()}
          </span>
          <b className="font-semibold">{e}</b>
          <button onClick={() => onChange(emails.filter((x) => x !== e))} className="text-muted-foreground hover:text-rose-400">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1">
        <Star className="h-2.5 w-2.5 text-muted-foreground" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          onBlur={add}
          placeholder="co-host email"
          className="w-[110px] border-none bg-transparent text-[10.5px] outline-none placeholder:text-muted-foreground"
        />
        <button onClick={add} className="text-muted-foreground hover:text-brand-400"><Plus className="h-2.5 w-2.5" /></button>
      </span>
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="mb-3.5">
    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold">
      {label}
      {hint ? <span className="ms-auto text-[10px] font-normal text-muted-foreground">{hint}</span> : null}
    </label>
    {children}
  </div>
);

const Card = ({ title, Icon, children }: { title: string; Icon: typeof DoorOpen; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-muted p-3.5">
    <h4 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold"><Icon className="h-3 w-3" /> {title}</h4>
    {children}
  </div>
);

const Pick = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition",
      on ? "border-transparent bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-foreground",
    )}
  >
    {children}
  </button>
);

function Tg({ on, onClick, Icon, t, s }: { on: boolean; onClick: () => void; Icon: typeof DoorOpen; t: string; s: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 py-1.5 text-left">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-card"><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[11.5px] leading-tight">{t}</b>
        <span className="block text-[10px] leading-snug text-muted-foreground">{s}</span>
      </span>
      <span className={cn("relative h-[19px] w-[34px] shrink-0 rounded-full transition", on ? "bg-brand-500/90" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all", on ? "left-[17px] bg-white" : "left-0.5 bg-muted-foreground")} />
      </span>
    </button>
  );
}
