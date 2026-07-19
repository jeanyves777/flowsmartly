"use client";

/**
 * Training Studio — live rooms: video, whiteboard, docs, illustration.
 *
 * Three surfaces on one shell, same split the Video Director uses: the PLAN is a
 * node canvas (brief → room → segments → go live → invite), the LIVE session is a
 * stage, and the BACK OFFICE is the host's control panel.
 *
 * Data: GET/POST /api/ai/training, GET/PATCH/DELETE …/[id], …/[id]/segments,
 * …/[id]/participants, …/[id]/board, …/[id]/live, …/[id]/invites, …/[id]/materials.
 * The room streams over …/[id]/stream (SSE). [[training-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, FolderOpen, Sparkles, Radio, LayoutGrid, SlidersHorizontal, Users, Presentation } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { FlowLoader } from "@/components/shared/flow-loader";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { PlanCanvas } from "./training/plan-canvas";
import { LiveRoom } from "./training/live-room";
import { BackOffice } from "./training/back-office";
import { DeckBuilder } from "./training/deck-builder";
import { BriefSheet, type BriefDraft } from "./training/brief-sheet";
import { useRoom } from "./training/use-room";
import type { SegmentKind, TrainingSessionDTO } from "@/lib/training/types";

type Mode = "plan" | "live" | "office" | "deck";

interface SessionRow {
  id: string;
  title: string;
  status: string;
  plannedMins: number;
  seats: number;
  startedAt: string | null;
}

export function FocusedTraining({ refreshKey }: { refreshKey?: number }) {
  const { toast } = useToast();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("plan");
  const [briefOpen, setBriefOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState<{ total: number; room: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);

  const room = useRoom(sessionId, { enabled: !!sessionId });
  const session = room.session;

  const fail = useCallback((msg: string | null) => {
    if (msg) toast({ title: msg, variant: "destructive" });
    return !msg;
  }, [toast]);

  // ---- load: the newest room, else open the brief to start one ----
  const loadList = useCallback(async () => {
    try {
      const j = await fetch("/api/ai/training").then((r) => r.json());
      const list: SessionRow[] = j?.data?.sessions ?? [];
      setRows(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadList();
      if (!alive) return;
      // The studio is the OWNER's console (plan + back office). `loadList` only
      // returns rooms this user owns, so a ?session that isn't in it belongs to
      // someone else — never open it here. Attendees use the public meeting view
      // (/t/<token>), not this playground. This is the access-control boundary.
      const wanted = new URLSearchParams(window.location.search).get("session");
      const owned = wanted && list.some((r) => r.id === wanted);
      if (wanted && !owned) {
        // not your room — bounce to the public join/meeting page for it
        window.location.replace(`/m/${wanted}`);
        return;
      }
      if (owned) {
        setSessionId(wanted);
        setMode("live");
        window.history.replaceState({}, "", "/home/training");
      } else if (list[0]) {
        setSessionId(list[0].id);
      } else {
        setBriefOpen(true);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadList]);

  // Agent live-bridge: when the agent builds a room, surface it here.
  useEffect(() => {
    if (!refreshKey) return;
    void (async () => {
      const list = await loadList();
      if (list[0] && list[0].id !== sessionId) { setSessionId(list[0].id); setBriefOpen(false); }
    })();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the room: if it goes live while we're planning, move to the stage.
  useEffect(() => {
    if (session?.status === "live" && mode === "plan") setMode("live");
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- estimate (drives the Go-live node + the office KPI) ----
  useEffect(() => {
    if (!session) return;
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/ai/training/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seats: session.seats,
            plannedMins: session.plannedMins,
            recording: session.recording,
            transcript: session.transcript,
          }),
        }).then((x) => x.json());
        if (alive && r?.success) setEstimate({ total: r.data.total, room: r.data.room });
      } catch { /* the estimate is a nicety */ }
    })();
    return () => { alive = false; };
  }, [session?.seats, session?.plannedMins, session?.recording, session?.transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions ----
  const build = async (d: BriefDraft) => {
    setBusy(true);
    try {
      const j = await fetch("/api/ai/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, startsAt: d.startsAt || null }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't build the room", variant: "destructive" }); return; }
      const built = j.data.session as TrainingSessionDTO;
      setSessionId(built.id);
      setBriefOpen(false);
      setMode("plan");
      await loadList();
      toast({ title: `Room built — ${built.segments.length} segments on the canvas` });
    } catch {
      toast({ title: "Couldn't build the room", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const segAct = async (method: "POST" | "PATCH" | "DELETE", body?: unknown, qs = "") => {
    if (!sessionId) return;
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/segments${qs}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "That didn't work", variant: "destructive" }); return; }
      if (j.data?.session) room.setSession(j.data.session as TrainingSessionDTO);
    } catch {
      toast({ title: "That didn't work", variant: "destructive" });
    }
  };

  const goLive = async () => {
    if (!sessionId || !session) return;
    if (session.status === "live") { setMode("live"); return; }
    setBusy(true);
    try {
      const j = await fetch(`/api/ai/training/${sessionId}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't start the session", variant: "destructive" }); return; }
      if (j.data?.session) room.setSession(j.data.session as TrainingSessionDTO);
      emitCreditsUpdate();
      setMode("live");
    } finally {
      setBusy(false);
    }
  };

  const endLive = async () => {
    if (!sessionId) return;
    const j = await fetch(`/api/ai/training/${sessionId}/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    }).then((r) => r.json()).catch(() => null);
    if (!j?.success) { toast({ title: j?.error?.message || "Couldn't end the session", variant: "destructive" }); return; }
    if (j.data?.session) room.setSession(j.data.session as TrainingSessionDTO);
    emitCreditsUpdate();
    setMode("plan");
    await loadList();
    toast({ title: "Session ended — the recording and notes are processing" });
  };

  const undo = () => {
    if (!session || !room.me) return;
    const mine = [...session.boardDoc.items].reverse().find((i) => i.by === room.me!.id);
    if (!mine) { toast({ title: "Nothing of yours to undo" }); return; }
    void room.removeItem(mine.id);
  };

  const invite = async () => {
    if (!sessionId) return;
    const link = session?.invites.find((i) => i.isActive && !i.email);
    if (link) {
      await navigator.clipboard?.writeText(`${window.location.origin}/t/${link.token}`).catch(() => {});
      toast({ title: "Join link copied — anyone with it can join" });
      return;
    }
    const j = await fetch(`/api/ai/training/${sessionId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "TRAINEE", label: "Join link" }),
    }).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data?.session) {
      room.setSession(j.data.session as TrainingSessionDTO);
      toast({ title: "Join link created" });
    }
  };

  // Add a material: browser → S3 (presigned PUT) → attach to the room. Same
  // path media/upload-url uses everywhere else; the bytes never touch our box.
  const onPickMaterial = () => {
    if (!sessionId) { toast({ title: "Build a room first" }); return; }
    fileRef.current?.click();
  };
  const onMaterialChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a failure
    if (!file || !sessionId) return;
    setUploading(true);
    try {
      // Multipart to our own route → it uploads to S3 server-side. (The presigned
      // browser-PUT path 403s on this bucket, so we don't use it.)
      const form = new FormData();
      form.append("file", file);
      const j = await fetch(`/api/ai/training/${sessionId}/materials`, {
        method: "POST",
        body: form,
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't add that file", variant: "destructive" }); return; }
      if (j.data?.session) room.setSession(j.data.session as TrainingSessionDTO);
      toast({ title: `${file.name} added — push it to the board any time` });
    } catch {
      toast({ title: "Upload failed — try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };


  // ---- header (portaled into the FocusedView's single header row) ----
  const header = headerSlot
    ? createPortal(
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex shrink-0 gap-0.5 rounded-xl border border-border bg-card p-0.5">
            {([
              ["plan", "Plan", LayoutGrid],
              ["deck", "Build", Presentation],
              ["live", "Live room", Radio],
              ["office", "Back office", SlidersHorizontal],
            ] as [Mode, string, typeof Radio][]).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={!session}
                title={label}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] font-bold transition disabled:opacity-40 max-md:min-w-[38px]",
                  mode === m ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative inline-flex">
                  <Icon className="h-3.5 w-3.5" />
                  {m === "live" && session?.status === "live" ? (
                    <span className="absolute -right-1 -top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                  ) : null}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          {session ? <SessionMeta session={session} /> : null}
          <button onClick={() => setListOpen(true)} title="Sessions" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-[12px] font-semibold hover:border-brand-500 max-md:min-w-[38px]">
            <FolderOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sessions</span>
          </button>
          <button onClick={() => setBriefOpen(true)} title="New session" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-2.5 py-2 text-[12px] font-semibold text-white max-md:min-w-[38px]">
            <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New session</span>
          </button>
        </div>,
        headerSlot,
      )
    : null;

  if (loading) {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <FlowLoader label="Opening your training rooms…" />
      </div>
    );
  }

  return (
    // relative + h-full — like every other studio. An `absolute inset-0` root
    // escapes the FocusedView canvas cell and covers the chat; this keeps the
    // surface (and the brief sheet inside it) inside the workspace column.
    <div className="relative h-full w-full overflow-hidden">
      {header}

      {sessionId && !session ? (
        // A room IS selected, its state just hasn't landed yet. Never flash the
        // "no rooms" empty state at someone who has rooms.
        <div className="absolute inset-0 grid place-items-center">
          <FlowLoader label="Opening the room…" />
        </div>
      ) : !session ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-[420px] text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600">
              <GraduationCap className="h-6 w-6 text-white" />
            </span>
            <h2 className="mt-3 text-[18px] font-bold">Run a training room</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Everyone on video, a shared whiteboard, your deck and docs on the board — and you draw on top of all of it.
            </p>
            <button onClick={() => setBriefOpen(true)} className="mt-4 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-5 py-3 text-[14px] font-extrabold text-white">
              Build a room
            </button>
          </div>
        </div>
      ) : mode === "plan" ? (
        <PlanCanvas
          session={session}
          estimate={estimate}
          busy={busy}
          onEditBrief={() => setBriefOpen(true)}
          onAddMaterial={onPickMaterial}
          onAddSegment={(k: SegmentKind) => void segAct("POST", { kind: k })}
          onRemoveSegment={(id) => void segAct("DELETE", undefined, `?segmentId=${id}`)}
          onPatchSegments={(segs) => void segAct("PATCH", { segments: segs })}
          onGoLive={goLive}
          onManage={() => setMode("office")}
          onInvite={invite}
        />
      ) : mode === "live" && session.status === "ended" ? (
        // An ended room isn't live — never render it as if it were.
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-[380px] text-center">
            <h2 className="text-[17px] font-bold">This session has ended</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Everyone was returned to the waiting room and the link is closed. Start a new session to run it again.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => setMode("plan")} className="rounded-lg border border-border px-4 py-2 text-[12.5px] font-semibold hover:border-brand-500">Back to the plan</button>
              <button onClick={() => setBriefOpen(true)} className="rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12.5px] font-bold text-white">New session</button>
            </div>
          </div>
        </div>
      ) : mode === "live" ? (
        room.me ? (
          <LiveRoom
            session={session}
            me={room.me}
            cursors={room.cursors}
            liveStrokes={room.liveStrokes}
            liveItems={room.liveItems}
            connected={room.connected}
            onAdd={(i) => void room.addItem(i)}
            onRemove={(id) => void room.removeItem(id)}
            onUpdate={(i) => void room.updateItem(i)}
            onPing={room.ping}
            onLiveStroke={room.streamStroke}
            onLiveItem={room.streamItem}
            onUndo={undo}
            onClear={() => void room.clearBoard()}
            act={async (a, p) => { const e = await room.act(a, p); fail(e); return e; }}
            patch={async (b) => { const e = await room.patch(b); fail(e); return e; }}
            messages={room.messages}
            sendMessage={room.sendMessage}
            onLeave={() => setMode("plan")}
            onManage={() => setMode("office")}
            onEnd={endLive}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <FlowLoader label="Joining the room…" />
          </div>
        )
      ) : mode === "deck" ? (
        <DeckBuilder
          session={session}
          sessionId={sessionId!}
          onSession={(s) => room.setSession(s)}
          onPresent={(matId) => void room.patch({ stageSource: "slides", stageKey: matId, stagePage: 1, stageStep: 1 }).then(() => setMode("live"))}
          onExit={() => setMode(session.status === "live" ? "live" : "plan")}
        />
      ) : (
        <BackOffice
          session={session}
          me={room.me}
          estimate={estimate}
          act={async (a, p) => { const e = await room.act(a, p); fail(e); return e; }}
          patch={async (b) => { const e = await room.patch(b); fail(e); return e; }}
          onSession={(s) => room.setSession(s)}
          onAddMaterial={onPickMaterial}
          onBuildDeck={() => setMode("deck")}
          uploading={uploading}
          onPushMaterial={(id) => {
            const m = session.materials.find((x) => x.id === id);
            const isDeck = m?.kind === "slides";
            void room.patch({ stageSource: isDeck ? "slides" : "doc", stageKey: id, stagePage: 1, stageStep: isDeck ? 1 : 0 }).then(() => setMode("live"));
          }}
          onEnd={endLive}
        />
      )}

      {/* hidden picker for Add material — images, video, or a PDF/deck */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf"
        className="hidden"
        onChange={onMaterialChosen}
      />

      <BriefSheet open={briefOpen} busy={busy} onClose={() => setBriefOpen(false)} onBuild={build} />

      {listOpen ? (
        <>
          <div className="absolute inset-0 z-[49] bg-black/55" onClick={() => setListOpen(false)} />
          <div className="absolute inset-y-0 end-0 z-50 flex w-[360px] flex-col border-s border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-[13px] font-bold">
              <Users className="h-3.5 w-3.5" /> Your sessions
              <button onClick={() => setListOpen(false)} className="ms-auto text-[12px] font-normal text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {rows.length === 0 ? (
                <p className="p-4 text-center text-[12px] text-muted-foreground">No sessions yet.</p>
              ) : (
                rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSessionId(r.id); setListOpen(false); setMode("plan"); }}
                    className={cn(
                      "mb-1.5 flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                      r.id === sessionId ? "border-brand-500 bg-brand-500/[0.06]" : "border-border hover:border-brand-500/50",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                      <GraduationCap className="h-4 w-4 text-brand-400" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[12px]">{r.title}</b>
                      <span className="text-[10px] text-muted-foreground">{r.plannedMins} min · {r.seats} seats</span>
                    </span>
                    <span className={cn(
                      "shrink-0 rounded-full px-1.5 py-px text-[9px] font-extrabold",
                      r.status === "live" ? "bg-rose-500 text-white" : r.status === "ended" ? "bg-muted text-muted-foreground" : "bg-brand-500/15 text-brand-400",
                    )}>
                      {r.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Room meta for the header. When the session is LIVE it shows a ticking elapsed
 *  clock (from startedAt); otherwise the planned agenda length (`~37 min`). The
 *  old label read a planned duration as if it were the session's age. */
function SessionMeta({ session }: { session: TrainingSessionDTO }) {
  const inRoom = session.participants.filter((p) => p.state === "ADMITTED").length;
  const live = session.status === "live" && !!session.startedAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [live]);

  const elapsedMs = live ? Math.max(0, now - new Date(session.startedAt as string).getTime()) : 0;
  const mm = Math.floor(elapsedMs / 60000);
  const ss = Math.floor((elapsedMs % 60000) / 1000);
  const timePart = live
    ? `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")} live`
    : `~${session.plannedMins} min`;
  const peoplePart = session.status === "live" ? `${inRoom} in the room` : `${session.seats} seats`;

  return (
    <span className="hidden text-[11.5px] tabular-nums text-muted-foreground lg:inline">
      {session.segments.length} segments · {timePart} · {peoplePart}
    </span>
  );
}
