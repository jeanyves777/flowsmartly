"use client";

/**
 * Back office — the host's control surface.
 *
 * KPIs, the waiting room, the roster with per-person controls, room-wide policy,
 * materials, and past sessions. Every number here is DERIVED from the roster, so
 * the KPI and the table can never disagree. [[training-studio]]
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, DoorOpen, Circle, Pencil, Monitor, Mic, Star, X, Hand, SlidersHorizontal,
  Download, Puzzle, Square, FileText, Presentation, Clapperboard, ImageIcon, Plus, Eye,
  Link as LinkIcon, Check, Upload, Sparkles, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { canShareScreen } from "@/lib/training/access";
import type { TrainingParticipantDTO, TrainingSessionDTO } from "@/lib/training/types";

const ROLE_STYLE: Record<string, string> = {
  HOST: "bg-brand-500/16 text-brand-400",
  COHOST: "bg-cyan-500/14 text-cyan-400",
  TRAINEE: "bg-slate-500/14 text-slate-400",
  GUEST: "bg-amber-500/14 text-amber-400",
};
const ROLE_LABEL: Record<string, string> = { HOST: "Host", COHOST: "Co-host", TRAINEE: "Trainee", GUEST: "Guest" };
const MAT_ICON = { slides: Presentation, doc: FileText, video: Clapperboard, image: ImageIcon } as const;

interface Props {
  session: TrainingSessionDTO;
  me: TrainingParticipantDTO | null;
  estimate: { total: number } | null;
  act: (action: string, participantId?: string) => Promise<string | null>;
  patch: (body: Record<string, unknown>) => Promise<string | null>;
  onSession: (session: TrainingSessionDTO) => void;
  onAddMaterial: () => void;
  onBuildDeck?: () => void;
  uploading?: boolean;
  onPushMaterial: (materialId: string) => void;
  onEnd: () => void;
}

export function BackOffice({ session, me, estimate, act, patch, onSession, onAddMaterial, onBuildDeck, uploading, onPushMaterial, onEnd }: Props) {
  const owner = me?.role === "HOST";
  const waiting = useMemo(() => session.participants.filter((p) => p.state === "WAITING"), [session.participants]);
  const inRoom = useMemo(() => session.participants.filter((p) => p.state === "ADMITTED"), [session.participants]);
  const hands = useMemo(() => inRoom.filter((p) => p.handRaised), [inRoom]);
  const attention = inRoom.length ? Math.round(inRoom.reduce((m, p) => m + p.focusPct, 0) / inRoom.length) : 0;
  const elapsed = session.startedAt ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000) : 0;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtDur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

  // Export the attendance as a real .csv (opens straight into Excel/Sheets) — NOT a print dialog.
  // Uses session.attendance, which persists everyone who ever joined, even after they leave.
  const exportAttendance = () => {
    const header = ["Name", "Email", "Role", "Status", "Joined", "Left", "Time in room", "Attention %"];
    const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = session.attendance.map((p) => [
      p.name,
      p.email ?? "",
      ROLE_LABEL[p.role] ?? p.role,
      p.state === "ADMITTED" ? "In room" : p.state === "LEFT" ? "Left" : p.state === "REMOVED" ? "Removed" : p.state === "WAITING" ? "Waiting" : p.state === "DENIED" ? "Denied" : p.state,
      p.joinedAt ? new Date(p.joinedAt).toLocaleString() : "",
      p.leftAt ? new Date(p.leftAt).toLocaleString() : p.state === "ADMITTED" ? "Still in room" : "",
      fmtDur(p.secondsIn),
      p.focusPct,
    ]);
    // BOM so Excel reads UTF-8 (accents, etc.) correctly.
    const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-${(session.title || "session").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48) || "session"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="absolute inset-0 overflow-auto bg-background">
      <div className="mx-auto max-w-[1180px] px-6 pb-16 pt-5">
        <H>
          <Circle className={cn("h-3 w-3", session.status === "live" ? "animate-pulse fill-rose-500 text-rose-500" : "text-muted-foreground")} />
          This session
          <span className="ms-auto text-[10.5px] font-normal text-muted-foreground">
            {session.status === "live" ? "Live" : session.status} · {session.title}
          </span>
        </H>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(178px,1fr))" }}>
          <Kpi k="In the room" v={`${inRoom.length} / ${session.seats}`} d={`${waiting.length} in the waiting room`} tone="em" />
          <Kpi k="Avg. attention" v={`${attention}%`} d="tab focused, camera on" />
          <Kpi k="Hands raised" v={String(hands.length)} d={hands.map((h) => h.name).join(", ") || "nobody"} tone="am" />
          <Kpi k="Elapsed" v={session.startedAt ? fmt(elapsed) : "—"} d={`of ${session.plannedMins}:00 planned`} />
          <Kpi k="Credits used" v={String(session.creditsSpent)} d={estimate ? `of ~${estimate.total} estimated` : "—"} tone="vi" />
        </div>

        {waiting.length ? (
          <>
            <H><DoorOpen className="h-3.5 w-3.5" /> Waiting room <span className="ms-auto text-[10.5px] font-normal text-muted-foreground">Nobody enters until you admit them</span></H>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {waiting.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2.5 last:border-b-0">
                  <Av name={p.name} />
                  <div>
                    <b className="block text-[11.5px]">{p.name}</b>
                    <span className="text-[10px] text-muted-foreground">{p.email || "joined by link"}</span>
                  </div>
                  <button onClick={() => void act("admit", p.id)} className="ms-auto rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3 py-1.5 text-[10.5px] font-bold text-white">Admit</button>
                  <button onClick={() => void act("deny", p.id)} className="rounded-lg border border-border px-2.5 py-1.5 text-[10.5px] font-bold text-muted-foreground hover:border-rose-500 hover:text-rose-400">Deny</button>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <H>
          <Users className="h-3.5 w-3.5" /> Roster
          <span className="ms-auto text-[10.5px] font-normal text-muted-foreground">pen · may share screen · co-host</span>
        </H>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted">
                {["Person", "Role", "Status", "Joined", "Attention", ""].map((h, i) => (
                  <th key={h} className={cn("px-3 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground", i === 5 ? "text-right" : "text-left")}>{h || "Controls"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inRoom.map((p) => {
                const hasPen = session.penHolderId === p.id;
                const mayShare = canShareScreen(p, session);
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-b-0 hover:bg-brand-500/[0.04]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Av name={p.name} />
                        <div>
                          <b className="block text-[12px] leading-tight">{p.name}</b>
                          <span className="text-[10px] text-muted-foreground">{p.email || "joined by link"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-extrabold", ROLE_STYLE[p.role])}>{ROLE_LABEL[p.role]}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <i className={cn("block h-1.5 w-1.5 rounded-full", p.handRaised ? "bg-amber-400" : p.camOn ? "bg-emerald-500" : "bg-slate-600")} />
                        {p.handRaised ? "Hand raised" : p.sharing ? "Sharing" : p.camOn ? "In the room" : "Camera off"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                      {p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px]">{p.focusPct}%</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Ia onClick={() => void act(hasPen ? "take_pen" : "give_pen", p.id)} on={hasPen} tone="em" title={hasPen ? "Take the pen back" : `Hand ${p.name} the pen`} Icon={Pencil} />
                        <Ia onClick={() => void act(mayShare ? "revoke_share" : "grant_share", p.id)} on={mayShare} tone="te" title={mayShare ? "Revoke screen share" : `Let ${p.name} share their screen`} Icon={Monitor} />
                        <Ia onClick={() => void act(p.micOn ? "mute" : "unmute", p.id)} title="Mute / unmute" Icon={Mic} />
                        {owner && p.role !== "HOST" ? (
                          <Ia onClick={() => void act(p.role === "COHOST" ? "demote" : "promote", p.id)} on={p.role === "COHOST"} tone="vi" title={p.role === "COHOST" ? "Demote to trainee" : `Make ${p.name} a co-host`} Icon={Star} />
                        ) : null}
                        {p.role !== "HOST" ? <Ia onClick={() => void act("remove", p.id)} title="Remove" Icon={X} danger /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <H>
          <Download className="h-3.5 w-3.5" /> Attendance
          <span className="ms-auto flex items-center gap-2 text-[10.5px] font-normal text-muted-foreground">
            {session.attendance.length} joined · saved to this session
            <button onClick={exportAttendance} disabled={!session.attendance.length} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10.5px] font-semibold text-foreground hover:border-brand-500 disabled:opacity-40"><Download className="h-3 w-3" /> Export (Excel)</button>
          </span>
        </H>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {session.attendance.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  {["Person", "Role", "Joined", "Left", "Time in room", "Status"].map((h, i) => (
                    <th key={h} className={cn("px-3 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground", i >= 4 ? "text-left" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {session.attendance.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-b-0 hover:bg-brand-500/[0.04]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Av name={p.name} />
                        <div>
                          <b className="block text-[12px] leading-tight">{p.name}</b>
                          <span className="text-[10px] text-muted-foreground">{p.email || "joined by link"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-[9px] font-extrabold", ROLE_STYLE[p.role])}>{ROLE_LABEL[p.role]}</span></td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{p.joinedAt ? new Date(p.joinedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{p.leftAt ? new Date(p.leftAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : p.state === "ADMITTED" ? <span className="font-semibold text-emerald-400">In room</span> : "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{fmtDur(p.secondsIn)}</td>
                    <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground">{p.state === "ADMITTED" ? "In room" : p.state === "LEFT" ? "Left" : p.state === "REMOVED" ? "Removed" : p.state === "WAITING" ? "Waiting" : p.state === "DENIED" ? "Denied" : p.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">Nobody has joined yet — your attendance list builds here and stays saved to this session, viewable anytime.</div>
          )}
        </div>

        <H><SlidersHorizontal className="h-3.5 w-3.5" /> Room controls</H>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(258px,1fr))" }}>
          <Tg on={session.waitingRoom} onClick={() => void patch({ waitingRoom: !session.waitingRoom })} Icon={DoorOpen} t="Waiting room" s="Knock before entering" />
          <Tg on={session.recording} onClick={() => void patch({ recording: !session.recording })} Icon={Circle} t="Record the session" s="Saved to your library when it ends" />
          <Tg on={session.openDraw} onClick={() => void patch({ openDraw: !session.openDraw })} Icon={Pencil} t="Anyone can draw" s="Off = only the pen-holder draws" />
          <Tg on={session.openShare} onClick={() => void patch({ openShare: !session.openShare })} Icon={Monitor} t="Anyone can share screen" s="Off = hosts, plus whoever you allow" />
          <Tg on={session.openMic} onClick={() => void patch({ openMic: !session.openMic })} Icon={Mic} t="Trainees can unmute" s="Off = raise hand to speak" />
          <Tg on={session.locked} onClick={() => void patch({ locked: !session.locked })} Icon={Square} t="Lock the room" s="No new joins, even with the link" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Btn onClick={() => void act("mute_all")} Icon={Mic}>Mute all</Btn>
          <Btn onClick={() => void act("take_pen")} Icon={Pencil}>Take the pen back</Btn>
          <Btn onClick={() => void act("revoke_all_share")} Icon={Monitor}>Revoke all sharing</Btn>
          <Btn onClick={() => void patch({ stageSource: "board" })} Icon={Eye}>Pull to my view</Btn>
          <Btn onClick={exportAttendance} Icon={Download}>Export attendance (Excel)</Btn>
          {owner && session.status === "live" ? (
            <button onClick={onEnd} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-600 to-rose-400 px-3 py-1.5 text-[11px] font-bold text-white">
              <Square className="h-3 w-3" /> End session
            </button>
          ) : null}
        </div>

        <H><LinkIcon className="h-3.5 w-3.5" /> Join page <span className="ms-auto text-[10.5px] font-normal text-muted-foreground">What people see at your link — no account needed to join</span></H>
        <JoinPageCard session={session} patch={patch} onSession={onSession} />

        <H>
          <Puzzle className="h-3.5 w-3.5" /> Materials
          <span className="ms-auto text-[10.5px] font-normal text-muted-foreground">Anything here can go on the board mid-session</span>
        </H>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))" }}>
          {session.materials.map((m) => {
            const Icon = MAT_ICON[m.kind] ?? FileText;
            return (
              <button key={m.id} onClick={() => onPushMaterial(m.id)} className="overflow-hidden rounded-xl border border-border bg-card text-left hover:border-brand-500">
                <span className="grid aspect-[16/10] place-items-center bg-muted">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </span>
                <span className="block px-2.5 py-2">
                  <b className="block truncate text-[10.5px]">{m.name}</b>
                  <span className="text-[9px] text-muted-foreground">{m.pages > 1 ? `${m.pages} pages` : m.kind}</span>
                </span>
              </button>
            );
          })}
          <button onClick={onAddMaterial} disabled={uploading} className="overflow-hidden rounded-xl border border-dashed border-border bg-card text-left hover:border-brand-500 disabled:opacity-60">
            <span className="grid aspect-[16/10] place-items-center bg-muted/40">
              {uploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-brand-500" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
            <span className="block px-2.5 py-2">
              <b className="block text-[10.5px]">{uploading ? "Uploading…" : "Add material"}</b>
              <span className="text-[9px] text-muted-foreground">PDF, deck, image, video</span>
            </span>
          </button>
          {onBuildDeck ? (
            <button onClick={onBuildDeck} className="overflow-hidden rounded-xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-violet-500/10 text-left hover:border-brand-500">
              <span className="grid aspect-[16/10] place-items-center">
                <Sparkles className="h-5 w-5 text-brand-400" />
              </span>
              <span className="block px-2.5 py-2">
                <b className="block text-[10.5px] text-brand-400">Build with AI</b>
                <span className="text-[9px] text-muted-foreground">A presentation from a brief</span>
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Brand the public join page + choose what to collect before someone enters. */
function JoinPageCard({ session, patch, onSession }: { session: TrainingSessionDTO; patch: (b: Record<string, unknown>) => Promise<string | null>; onSession: (s: TrainingSessionDTO) => void }) {
  const [headline, setHeadline] = useState(session.joinHeadline ?? "");
  const [message, setMessage] = useState(session.joinMessage ?? "");
  // Keep the editor in sync with the SAVED values — after reopening/reusing the session, or a refresh
  // over SSE — so a persisted headline/welcome never shows blank. But never clobber an edit in progress:
  // adopt a server value only when the field still equals the LAST server value we showed.
  const lastSaved = useRef({ h: session.joinHeadline ?? "", m: session.joinMessage ?? "" });
  useEffect(() => {
    const h = session.joinHeadline ?? "", m = session.joinMessage ?? "";
    setHeadline((cur) => (h !== lastSaved.current.h && cur === lastSaved.current.h ? h : cur));
    setMessage((cur) => (m !== lastSaved.current.m && cur === lastSaved.current.m ? m : cur));
    lastSaved.current = { h, m };
  }, [session.joinHeadline, session.joinMessage]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "logo" | "banner">(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const link = session.invites.find((i) => i.isActive && !i.email);
  const url = link ? `${typeof window !== "undefined" ? window.location.origin : ""}/t/${link.token}` : "";

  // The join page shows an uploaded logo if there is one, otherwise the Brand Kit
  // logo — never a blank "paste a URL" box.
  const logo = session.joinLogoUrl || session.brandLogoUrl || "";
  const usingBrandLogo = !session.joinLogoUrl && !!session.brandLogoUrl;

  const save = async () => {
    await patch({ joinHeadline: headline || null, joinMessage: message || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const upload = async (kind: "logo" | "banner", file: File) => {
    setBusy(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const j = await fetch(`/api/ai/training/${session.id}/branding`, { method: "POST", body: form }).then((r) => r.json());
      if (j?.success && j.data?.session) onSession(j.data.session as TrainingSessionDTO);
    } finally { setBusy(null); }
  };
  const clearBrand = async (kind: "logo" | "banner") => {
    const j = await fetch(`/api/ai/training/${session.id}/branding`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear: kind }) }).then((r) => r.json());
    if (j?.success && j.data?.session) onSession(j.data.session as TrainingSessionDTO);
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5">
          <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          <code className="flex-1 truncate font-mono text-[10px] text-muted-foreground">{url.replace(/^https?:\/\//, "")}</code>
          <button
            onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className={cn("rounded px-2 py-0.5 text-[10px] font-bold", copied ? "bg-emerald-500/15 text-emerald-400" : "bg-brand-500/15 text-brand-400 hover:bg-brand-500/25")}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        {/* banner — a wide cover image, uploaded */}
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload("banner", f); }} />
        {session.joinBannerUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={session.joinBannerUrl} alt="" className="h-20 w-full object-cover" />
            <button onClick={() => void clearBrand("banner")} title="Remove banner" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/55 text-white hover:bg-black/75"><Trash2 className="h-3 w-3" /></button>
            <button onClick={() => bannerRef.current?.click()} className="absolute bottom-1.5 right-1.5 rounded-md bg-black/55 px-2 py-1 text-[10px] font-bold text-white hover:bg-black/75">Replace</button>
          </div>
        ) : (
          <button onClick={() => bannerRef.current?.click()} disabled={busy === "banner"} className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted text-[11px] font-semibold text-muted-foreground hover:border-brand-500 hover:text-foreground disabled:opacity-60">
            {busy === "banner" ? "Uploading…" : <><ImageIcon className="h-4 w-4" /> Add a top banner (cover image)</>}
          </button>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-2">
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload("logo", f); }} />
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          ) : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Users className="h-4 w-4" /></span>}
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold">Logo</p>
            <p className="truncate text-[10px] text-muted-foreground">{usingBrandLogo ? <><Sparkles className="mb-0.5 inline h-2.5 w-2.5 text-brand-400" /> From your Brand Kit</> : session.joinLogoUrl ? "Uploaded for this room" : "No logo yet"}</p>
          </div>
          {session.joinLogoUrl && session.brandLogoUrl ? (
            <button onClick={() => void clearBrand("logo")} className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold hover:border-brand-500">Use Brand Kit</button>
          ) : null}
          <button onClick={() => logoRef.current?.click()} disabled={busy === "logo"} className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-2.5 py-1 text-[10px] font-bold text-brand-400 hover:bg-brand-500/25 disabled:opacity-60">
            <Upload className="h-3 w-3" /> {busy === "logo" ? "…" : usingBrandLogo || session.joinLogoUrl ? "Change" : "Upload"}
          </button>
        </div>

        <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline — e.g. Welcome to onboarding" className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-[12px] outline-none focus:border-brand-500" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A short welcome message (optional)" className="min-h-[54px] w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-[12px] outline-none focus:border-brand-500" />
        <div className="flex items-center gap-2">
          <Tg on={session.joinCollectEmail} onClick={() => void patch({ joinCollectEmail: !session.joinCollectEmail })} Icon={Mic} t="Collect email before joining" s="Guests give their email, not just a name" />
        </div>
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-1.5 text-[12px] font-bold text-white">
          {saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : "Save join page"}
        </button>
      </div>

      {/* live preview of what a guest sees */}
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {session.joinBannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.joinBannerUrl} alt="" className="h-16 w-full object-cover" />
          ) : null}
          <div className="p-3">
            <div className="flex items-center gap-2">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Users className="h-4 w-4" /></span>}
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Training Room</p>
                <p className="text-[10px] font-bold">{headline || "You're invited to join"}</p>
              </div>
            </div>
            <p className="mt-2 text-[12px] font-extrabold leading-tight">{session.title}</p>
            {message ? <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{message}</p> : null}
            {session.joinCollectEmail ? (
              <><div className="mt-2 rounded border border-border bg-muted px-2 py-1 text-[9px] text-muted-foreground">Your name</div><div className="mt-1 rounded border border-border bg-muted px-2 py-1 text-[9px] text-muted-foreground">Your email</div></>
            ) : (
              <div className="mt-2 rounded border border-border bg-muted px-2 py-1 text-[9px] text-muted-foreground">Your name</div>
            )}
            <div className="mt-2 rounded-md bg-gradient-to-br from-brand-500 to-violet-600 py-1.5 text-center text-[9px] font-bold text-white">Join the room</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2.5 mt-6 flex items-center gap-2 text-[13px] font-bold first:mt-0">{children}</h3>
);

const Av = ({ name }: { name: string }) => (
  <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-[9.5px] font-black text-white">
    {name.slice(0, 2).toUpperCase()}
  </span>
);

function Kpi({ k, v, d, tone }: { k: string; v: string; d: string; tone?: "em" | "am" | "vi" }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3.5 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={cn("mt-0.5 text-[22px] font-extrabold tracking-tight", tone === "em" && "text-emerald-400", tone === "am" && "text-amber-400", tone === "vi" && "text-violet-400")}>{v}</div>
      <div className="truncate text-[10px] text-muted-foreground">{d}</div>
    </div>
  );
}

function Tg({ on, onClick, Icon, t, s }: { on: boolean; onClick: () => void; Icon: typeof Mic; t: string; s: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-3 text-left hover:border-brand-500/40">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-muted">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[11.5px] leading-tight">{t}</b>
        <span className="block text-[10px] leading-snug text-muted-foreground">{s}</span>
      </span>
      <span className={cn("relative ms-auto h-[19px] w-[34px] shrink-0 rounded-full transition", on ? "bg-brand-500/90" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all", on ? "left-[17px] bg-white" : "left-0.5 bg-muted-foreground")} />
      </span>
    </button>
  );
}

function Ia({ Icon, title, onClick, on, danger, tone }: { Icon: typeof Mic; title: string; onClick: () => void; on?: boolean; danger?: boolean; tone?: "em" | "te" | "vi" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "grid h-[26px] w-[26px] place-items-center rounded-md border border-border text-muted-foreground transition",
        on && tone === "em" && "border-emerald-500/40 bg-emerald-500/16 text-emerald-400",
        on && tone === "te" && "border-cyan-500/42 bg-cyan-500/16 text-cyan-400",
        on && tone === "vi" && "border-brand-500/45 bg-brand-500/18 text-brand-400",
        danger ? "hover:border-rose-500 hover:text-rose-400" : "hover:border-brand-500 hover:text-brand-400",
      )}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function Btn({ Icon, children, onClick }: { Icon: typeof Mic; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-brand-500">
      <Icon className="h-3 w-3" /> {children}
    </button>
  );
}
