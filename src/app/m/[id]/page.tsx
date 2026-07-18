"use client";

/**
 * Public meeting view (flowsmartly.com/m/<sessionId>).
 *
 * The ATTENDEE experience — deliberately separate from the owner's studio
 * (/home/training). No plan canvas, no back office, no agent shell: just the
 * live room. LiveRoom already hides every host-only control for non-hosts, so
 * mounting it here gives attendees exactly what they should see and nothing more.
 *
 * A waiting-room attendee sees a hold screen until the host admits them (the SSE
 * stream flips their state live). [[training-studio]]
 */
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, CalendarClock } from "lucide-react";
import { LiveRoom } from "@/components/agent-home/focused/training/live-room";
import { useRoom } from "@/components/agent-home/focused/training/use-room";

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const room = useRoom(id, { enabled: !!id });
  const { session, me } = room;

  // Belt-and-braces: if this viewer turns out to be the OWNER, send them to their
  // console instead of the attendee view.
  useEffect(() => {
    if (session && me && me.role === "HOST" && session.status !== "ended") {
      // owners run the room from the studio
      router.replace("/home/training?session=" + id);
    }
  }, [session?.id, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session || !me) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-500" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            {room.error ? room.error : "Connecting you to the room…"}
          </p>
          {room.error ? (
            <a href="/" className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-[12px] font-semibold hover:border-brand-500">
              Go to FlowSmartly
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  // Waiting room — held until a host admits (state flips over SSE).
  if (me.state === "WAITING") {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-b from-background to-muted/40 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </span>
          <h1 className="mt-3 text-[18px] font-bold">You&apos;re in the waiting room</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {session.title} — the host will let you in shortly.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting to be admitted
          </div>
        </div>
      </div>
    );
  }

  if (me.state === "REMOVED" || me.state === "DENIED" || session.status === "ended") {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
          <h1 className="text-[18px] font-bold">
            {session.status === "ended" ? "This session has ended" : "You've left this room"}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Thanks for joining {session.title}.</p>
          <a href="/" className="mt-4 inline-block rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-bold text-white">
            Go to FlowSmartly
          </a>
        </div>
      </div>
    );
  }

  // Admitted but the room isn't live yet — hold with the start time.
  if (session.status !== "live") {
    const starts = session.startsAt ? new Date(session.startsAt) : null;
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-b from-background to-muted/40 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </span>
          <h1 className="mt-3 text-[18px] font-bold">The session hasn&apos;t started yet</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{session.title}</p>
          {starts ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-[12px] font-semibold text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Starts {starts.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the host to start
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-muted-foreground">Keep this page open — it&apos;ll go live automatically.</p>
        </div>
      </div>
    );
  }

  // Admitted → the attendee live room (host-only controls auto-hidden inside).
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <LiveRoom
        session={session}
        me={me}
        cursors={room.cursors}
        connected={room.connected}
        onAdd={(i) => void room.addItem(i)}
        onRemove={(itemId) => void room.removeItem(itemId)}
        onUpdate={(i) => void room.updateItem(i)}
        onPing={room.ping}
        onUndo={() => {
          const mine = [...session.boardDoc.items].reverse().find((x) => x.by === me.id);
          if (mine) void room.removeItem(mine.id);
        }}
        onClear={() => void room.clearBoard()}
        act={async (a, p) => room.act(a, p)}
        patch={async (b) => room.patch(b)}
        onLeave={() => { window.location.href = "/"; }}
        onManage={() => { /* attendees have no back office */ }}
        onEnd={() => { /* attendees can't end the room */ }}
      />
    </div>
  );
}
