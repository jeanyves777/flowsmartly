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
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Sparkles, X, Presentation, PenLine, FileText, Clapperboard, ImageIcon, Users,
  Upload, Plus, DoorOpen, Circle, Pencil, Monitor, ScrollText, Star, Zap,
  Palette, ChevronRight, Check, Clock, ArrowRight, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { deckPreview, slideCountForDuration, type DeckWants } from "@/lib/training/deck-cost";
import { SEGMENT_KINDS, type SegmentKind, type SessionType, type AccessMode } from "@/lib/training/types";

/** What the "Build with AI" tab collected — consumed after the room is built to draft
 *  the presentation. `sources` are files to attach; never JSON-posted with the room. */
export interface DeckDraft {
  objective: string;
  audience: string;
  durationMins: number;
  experience: string;
  tone: string;
  wants: DeckWants;
  advanced: string;
  brandKit: boolean;
  sources: File[];
}

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
  /** set when the room is built from the "Build with AI" tab — null for a manual room */
  deck: DeckDraft | null;
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
  deck: null,
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

  // Two paths, both visible up front: build with AI (primary), or set up manually.
  const [tab, setTab] = useState<"deck" | "room">("deck");
  const [ai, setAi] = useState<DeckDraft>({
    objective: "",
    audience: "New team members",
    durationMins: 45,
    experience: "Beginner",
    tone: "Practical & engaging",
    wants: { slides: true, photos: true, threeD: true, livedraw: true, whiteboard: true, notes: true },
    advanced: "",
    brandKit: false,
    sources: [],
  });
  const setAiK = <K extends keyof DeckDraft>(k: K, v: DeckDraft[K]) => setAi((p) => ({ ...p, [k]: v }));
  const aiReady = ai.objective.trim().length >= 8;

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

        {/* Two clear paths up front — AI is the primary one. */}
        <div className="flex shrink-0 items-center gap-2.5 px-4 pt-3.5 pb-1">
          <PathBtn on={tab === "room"} onClick={() => setTab("room")} Icon={Pencil} label="Set up manually" />
          <PathBtn on={tab === "deck"} onClick={() => { setTab("deck"); setAiK("objective", ai.objective || d.brief); }} Icon={Wand2} label="Build with AI" primary />
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {tab === "deck" ? (
            <AiTab
              ai={ai} setAi={setAi} setAiK={setAiK}
              seats={d.seats} access={d.access} waitingRoom={d.waitingRoom} recording={d.recording}
              onSeats={(v) => set("seats", v)} onAccess={(v) => set("access", v)}
              onWaiting={() => set("waitingRoom", !d.waitingRoom)} onRecording={() => set("recording", !d.recording)}
            />
          ) : (
          /* Fill the workspace — no centered narrow column. The right rail is
              width-capped so the brief text gets the room to breathe. */
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,440px)]">
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
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-t border-border bg-muted px-4 py-3">
          <span className="text-[10.5px] text-muted-foreground">
            {tab === "deck" ? <>You can edit everything after AI builds it.</> : <>Guests join by link — no account needed.</>}
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500">Cancel</button>
          {tab === "deck" ? (
            <button
              onClick={() => onBuild({ ...d, segments: d.segments, deck: { ...ai, objective: ai.objective.trim() } })}
              disabled={busy || !aiReady}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
              title={aiReady ? "" : "Describe what the training should accomplish first"}
            >
              <Wand2 className="h-3.5 w-3.5" /> {busy ? "Building…" : "Build training with AI"}
            </button>
          ) : (
            <button
              onClick={() => onBuild({ ...d, segments: d.segments, deck: null })}
              disabled={busy || !d.segments.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" /> {busy ? "Building…" : "Build the room"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** One of the two big path pills at the top of the brief. */
function PathBtn({ on, onClick, Icon, label, primary }: { on: boolean; onClick: () => void; Icon: typeof Wand2; label: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[12.5px] font-bold transition",
        on
          ? primary
            ? "border-transparent bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm"
            : "border-brand-500 bg-brand-500/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-brand-500/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

const THUMB = (n: string) => `/Studio_Menus_Thumnail/_training_thumbnail/${n}.png`;
const CREATE: { k: keyof DeckWants; label: string; sub?: string; thumb: string }[] = [
  { k: "slides", label: "Presentation slides", thumb: "presentation-slides" },
  { k: "photos", label: "Photorealistic examples", thumb: "photorealistic-examples" },
  { k: "threeD", label: "3D explainers", thumb: "3d-explainers" },
  { k: "livedraw", label: "Live Draw sections", sub: "Elements appear stroke by stroke while you speak.", thumb: "live-draw-sections" },
  { k: "whiteboard", label: "Interactive whiteboard", thumb: "interactive-whiteboard" },
  { k: "notes", label: "Speaker notes", thumb: "speaker-notes" },
];
const AUDIENCES = ["New team members", "New sales representatives", "Existing staff", "Managers & leads", "Customers", "Partners & resellers"];
const DURATIONS = [15, 30, 45, 60, 90];
const EXPERIENCE = ["Beginner", "Intermediate", "Advanced", "Mixed levels"];
const TONES = ["Practical & engaging", "Formal & precise", "Friendly & casual", "Energetic & motivational"];
const FLOW = ["Hook", "Explain", "Demonstrate", "Draw", "Practice", "Summary"];

/** "Build with AI" — the primary creation path: one objective in, a whole training out. */
function AiTab({ ai, setAi, setAiK, seats, access, waitingRoom, recording, onSeats, onAccess, onWaiting, onRecording }: {
  ai: DeckDraft;
  setAi: Dispatch<SetStateAction<DeckDraft>>;
  setAiK: <K extends keyof DeckDraft>(k: K, v: DeckDraft[K]) => void;
  seats: number; access: AccessMode; waitingRoom: boolean; recording: boolean;
  onSeats: (v: number) => void; onAccess: (v: AccessMode) => void; onWaiting: () => void; onRecording: () => void;
}) {
  const pv = deckPreview(ai.durationMins, ai.wants);
  const toggleWant = (k: keyof DeckWants) => setAi((p) => ({ ...p, wants: { ...p.wants, [k]: !p.wants[k] } }));
  const [showAdv, setShowAdv] = useState(false);
  const onFiles = (files: FileList | null) => { if (!files?.length) return; setAi((p) => ({ ...p, sources: [...p.sources, ...Array.from(files)].slice(0, 8) })); };
  const dropFile = (i: number) => setAi((p) => ({ ...p, sources: p.sources.filter((_, x) => x !== i) }));

  const stats: [number, string][] = [
    [pv.moments, "teaching moments"],
    [pv.reveals, "progressive reveals"],
    [pv.photos, "photorealistic examples"],
    [pv.threeD, "3D explanations"],
    [pv.livedraw, "Live Draw sequences"],
    [pv.practice, "guided practice"],
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,440px)]">
      {/* ---- left: describe it ---- */}
      <div>
        <p className="-mt-1 mb-3 text-[11.5px] text-muted-foreground">Describe your training once. AI creates the agenda, slides, visuals, live drawings and room.</p>

        <Field label="What should this training accomplish?">
          <textarea
            value={ai.objective}
            onChange={(e) => setAiK("objective", e.target.value)}
            placeholder="Train new sales reps to handle objections, demonstrate the value clearly, and practice closing with confidence."
            className="min-h-[96px] w-full resize-y rounded-xl border border-border bg-muted px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500"
          />
        </Field>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {[["Audience", ai.audience], ["Duration", `${ai.durationMins} min`], ["Level", ai.experience], ["Tone", ai.tone.split(" ")[0]]].map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              <span className="text-brand-400">{k}</span> {v}
            </span>
          ))}
        </div>

        <Field label="Training details">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Labeled t="Audience"><Sel value={ai.audience} onChange={(v) => setAiK("audience", v)} options={AUDIENCES} /></Labeled>
            <Labeled t="Duration"><Sel value={String(ai.durationMins)} onChange={(v) => setAiK("durationMins", Number(v))} options={DURATIONS.map(String)} render={(v) => `${v} minutes`} /></Labeled>
            <Labeled t="Experience"><Sel value={ai.experience} onChange={(v) => setAiK("experience", v)} options={EXPERIENCE} /></Labeled>
            <Labeled t="Tone"><Sel value={ai.tone} onChange={(v) => setAiK("tone", v)} options={TONES} /></Labeled>
          </div>
        </Field>

        <Field label="What should AI create?">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
            {CREATE.map((c) => (
              <button
                key={c.k}
                onClick={() => toggleWant(c.k)}
                className={cn("group relative overflow-hidden rounded-xl border-2 bg-card text-left transition", ai.wants[c.k] ? "border-brand-500" : "border-border hover:border-brand-500/50")}
              >
                <span className="relative block aspect-[16/10] w-full overflow-hidden bg-[#0e0e14]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={THUMB(c.thumb)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className={cn("absolute right-1.5 top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full border transition", ai.wants[c.k] ? "border-transparent bg-gradient-to-br from-brand-500 to-violet-600" : "border-white/40 bg-black/30")}>
                    {ai.wants[c.k] ? <Check className="h-3 w-3 text-white" /> : null}
                  </span>
                </span>
                <span className="block px-2.5 py-2">
                  <b className="block text-[11.5px] leading-tight">{c.label}</b>
                  {c.sub ? <span className="mt-0.5 block text-[9.5px] leading-snug text-muted-foreground">{c.sub}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Source materials" hint="AI grounds the training in what you upload">
          <div className="flex flex-wrap gap-2.5">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-dashed border-border bg-muted px-4 py-4 text-center hover:border-brand-500">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span>
                <b className="block text-[11.5px]">Upload PDF, document, image or video</b>
                <span className="text-[10px] text-muted-foreground">They&apos;re attached once the room is built</span>
              </span>
              <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            </label>
            <button onClick={() => setAiK("brandKit", !ai.brandKit)} className={cn("inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[11.5px] font-bold transition", ai.brandKit ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border text-muted-foreground hover:border-brand-500")}>
              <Palette className="h-3.5 w-3.5" /> Use brand kit
            </button>
          </div>
          {ai.sources.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ai.sources.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px]">
                  <FileText className="h-3 w-3 text-brand-400" /> <b className="max-w-[140px] truncate font-semibold">{f.name}</b>
                  <button onClick={() => dropFile(i)} className="text-muted-foreground hover:text-rose-400"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          ) : null}
          <button onClick={() => setShowAdv((v) => !v)} className="mt-2 flex w-full items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-[11.5px] font-semibold hover:border-brand-500">
            <ChevronRight className={cn("h-3.5 w-3.5 transition", showAdv && "rotate-90")} /> Advanced instructions
          </button>
          {showAdv ? (
            <textarea
              value={ai.advanced}
              onChange={(e) => setAiK("advanced", e.target.value)}
              placeholder="Anything specific — must-cover points, terminology, examples to use or avoid, house style…"
              className="mt-1.5 min-h-[70px] w-full resize-y rounded-xl border border-border bg-muted px-3 py-2 text-[12px] outline-none focus:border-brand-500"
            />
          ) : null}
        </Field>
      </div>

      {/* ---- right: preview + room + credits ---- */}
      <div className="flex flex-col gap-2.5">
        <Card title="AI build preview" Icon={Sparkles}>
          <div className="grid grid-cols-[1fr_1.1fr] gap-3">
            <div className="space-y-1">
              <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Your training will include</div>
              {stats.filter(([n]) => n > 0).map(([n, l]) => (
                <div key={l} className="flex items-baseline gap-1.5 text-[11px]"><b className="w-4 text-right text-violet-400">{n}</b><span className="text-muted-foreground">{l}</span></div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-2.5">
              <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Teaching flow</div>
              <div className="flex flex-wrap items-center gap-1">
                {FLOW.map((f, i) => (
                  <span key={f} className="inline-flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold">
                      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[7.5px] text-white">{i + 1}</span>{f}
                    </span>
                    {i < FLOW.length - 1 ? <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" /> : null}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> Estimated duration ≈ {ai.durationMins} min</div>
            </div>
          </div>
        </Card>

        <Card title="Room setup" Icon={DoorOpen}>
          <Field label="Seats" hint="how many can join">
            <input type="number" min={1} max={200} value={seats} onChange={(e) => onSeats(Math.min(200, Math.max(1, +e.target.value || 1)))} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] outline-none focus:border-brand-500" />
          </Field>
          <Field label="Who can join">
            <div className="flex flex-wrap gap-1.5">
              {([["invite", "Invite only"], ["link_email", "Link + email"], ["open", "Open link"]] as [AccessMode, string][]).map(([v, l]) => (
                <Pick key={v} on={access === v} onClick={() => onAccess(v)}>{l}</Pick>
              ))}
            </div>
          </Field>
          <Tg on={waitingRoom} onClick={onWaiting} Icon={DoorOpen} t="Waiting room" s="Admit people yourself" />
          <Tg on={recording} onClick={onRecording} Icon={Circle} t="Record it" s="Saved to your library" />
        </Card>

        <div className="flex items-center gap-3 rounded-2xl border border-brand-500/25 bg-brand-500/[0.06] p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Zap className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <b className="block text-[11.5px]">Estimated generation</b>
            <span className="text-[10px] text-muted-foreground">You&apos;re charged for what&apos;s made — unused credits are refunded.</span>
          </div>
          <b className="shrink-0 text-[16px] font-extrabold text-violet-400">{pv.estCredits} <span className="text-[10px] font-bold text-muted-foreground">credits</span></b>
        </div>
      </div>
    </div>
  );
}

function Labeled({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-muted-foreground">{t}</span>
      {children}
    </label>
  );
}

function Sel({ value, onChange, options, render }: { value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-card px-2.5 py-2 text-[12px] outline-none focus:border-brand-500">
      {options.map((o) => <option key={o} value={o}>{render ? render(o) : o}</option>)}
    </select>
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
