"use client";

/**
 * Public join page for a Training Room link (flowsmartly.com/t/<token>).
 *
 * No account needed: a guest enters their name (and email if the host asks for
 * it), and we seat them + set a room-scoped guest cookie, then open the public
 * meeting view (/m/<id>). Invite-only rooms route to log in instead. The host
 * brands this page from the back office. [[training-studio]]
 */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Users, ArrowRight, CalendarClock } from "lucide-react";

interface Info {
  title: string;
  hostName: string;
  status: string;
  startsAt: string | null;
  inRoom: number;
  seats: number;
  role: string;
  waitingRoom: boolean;
  guestAllowed: boolean;
  collectEmail: boolean;
  headline: string | null;
  message: string | null;
  logoUrl: string | null;
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/ai/training/join/${token}`)
      .then((r) => r.json())
      .then((j) => (j.success ? setInfo(j.data) : setError(j.error?.message || "This link isn't valid")))
      .catch(() => setError("Couldn't load this invite"))
      .finally(() => setLoading(false));
    // best-effort: are they logged in? (drives whether we show the name field)
    fetch("/api/auth/me").then((r) => setLoggedIn(r.ok)).catch(() => setLoggedIn(false));
  }, [token]);

  const join = async () => {
    setError(null);
    // if they aren't logged in and the room takes guests, we need a name
    if (loggedIn === false && info?.guestAllowed) {
      if (!name.trim()) { setError("Please enter your name"); return; }
      if (info.collectEmail && (!email.trim() || !email.includes("@"))) { setError("Please enter a valid email"); return; }
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/ai/training/join/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const j = await res.json();
      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(`/t/${token}`)}`);
        return;
      }
      if (!j.success) { setError(j.error?.message || "Couldn't join"); return; }
      router.push(`/m/${j.data.sessionId}`);
    } catch {
      setError("Couldn't join — try again");
    } finally {
      setJoining(false);
    }
  };

  const askForDetails = loggedIn === false && info?.guestAllowed;

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-background to-muted/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          {info?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </span>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Training Room</p>
            <p className="text-[13px] font-bold">{info?.headline || "You're invited to join"}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Loading the invite…</div>
        ) : error && !info ? (
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
            {info.message ? <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{info.message}</p> : null}

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
                  <CalendarClock className="h-3.5 w-3.5" />
                  {info.startsAt ? `Starts ${new Date(info.startsAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Not started yet"}
                </span>
              )}
              {info.role === "COHOST" ? (
                <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 font-bold text-brand-400">Co-host</span>
              ) : null}
            </div>

            {askForDetails ? (
              <div className="mt-4 space-y-2.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500"
                />
                {info.collectEmail ? (
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Your email"
                    className="w-full rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500"
                  />
                ) : null}
              </div>
            ) : null}

            {info.waitingRoom && info.role !== "COHOST" ? (
              <p className="mt-3 text-[12px] text-muted-foreground">The host will let you in from the waiting room.</p>
            ) : null}

            {error ? <p className="mt-3 text-[12px] text-rose-400">{error}</p> : null}

            <button
              onClick={join}
              disabled={joining}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
            >
              {joining ? "Joining…" : <>Join the room <ArrowRight className="h-4 w-4" /></>}
            </button>
            {!askForDetails && loggedIn === false ? (
              <p className="mt-3 text-center text-[11.5px] text-muted-foreground">This room needs a FlowSmartly account — you'll be asked to sign in.</p>
            ) : (
              <p className="mt-3 text-center text-[11.5px] text-muted-foreground">No account needed to join.</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
