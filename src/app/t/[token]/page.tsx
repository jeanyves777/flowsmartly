"use client";

/**
 * Public join page for a Training Room link (flowsmartly.com/t/<token>).
 *
 * Resolves the invite, shows who's hosting, and lets the visitor in:
 *  - logged in  → join (idempotent) and open the room
 *  - not logged in → log in / sign up and come back to this same link
 * [[training-studio]]
 */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Users, ArrowRight, CalendarClock } from "lucide-react";

interface Info {
  title: string;
  hostName: string;
  status: string;
  inRoom: number;
  seats: number;
  role: string;
  waitingRoom: boolean;
  guestAllowed: boolean;
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/ai/training/join/${token}`)
      .then((r) => r.json())
      .then((j) => (j.success ? setInfo(j.data) : setError(j.error?.message || "This link isn't valid")))
      .catch(() => setError("Couldn't load this invite"))
      .finally(() => setLoading(false));
  }, [token]);

  const join = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/ai/training/join/${token}`, { method: "POST" });
      const j = await res.json();
      if (res.status === 401) {
        // send them to log in, then straight back to this link
        router.push(`/login?redirect=${encodeURIComponent(`/t/${token}`)}`);
        return;
      }
      if (!j.success) { setError(j.error?.message || "Couldn't join"); return; }
      // Attendees go to the PUBLIC meeting view — never the owner's studio.
      router.push(`/m/${j.data.sessionId}`);
    } catch {
      setError("Couldn't join — try again");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-background to-muted/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Training Room</p>
            <p className="text-[13px] font-bold">You&apos;re invited to join</p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Loading the invite…</div>
        ) : error ? (
          <>
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-400">{error}</p>
            <button onClick={() => router.push("/")} className="mt-4 w-full rounded-xl border border-border py-2.5 text-[13px] font-semibold hover:border-brand-500">
              Go to FlowSmartly
            </button>
          </>
        ) : info ? (
          <>
            <h1 className="text-[20px] font-extrabold leading-tight">{info.title}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Hosted by {info.hostName}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-semibold">
                <Users className="h-3.5 w-3.5" /> {info.inRoom} in the room
              </span>
              {info.status === "live" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-semibold text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> Not started yet
                </span>
              )}
              {info.role === "COHOST" ? (
                <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 font-bold text-brand-400">Co-host</span>
              ) : null}
            </div>

            {info.waitingRoom && info.role !== "COHOST" ? (
              <p className="mt-3 text-[12px] text-muted-foreground">The host will let you in from the waiting room.</p>
            ) : null}

            <button
              onClick={join}
              disabled={joining}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
            >
              {joining ? "Joining…" : <>Join the room <ArrowRight className="h-4 w-4" /></>}
            </button>
            <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
              You&apos;ll be asked to log in or create a free account if you haven&apos;t already.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
