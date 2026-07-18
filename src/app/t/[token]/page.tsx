"use client";

/**
 * Public pre-join setup for a Training Room link (flowsmartly.com/t/<token>).
 *
 * The invite link IS the grant — no account, no login. The whole setup happens
 * here BEFORE entry: a live self-preview, mic/camera controls with an audio-level
 * meter, background selection (blur / scene / brand / upload), device pickers, and
 * name + email. The chosen mic/camera/background carry into the room. The host
 * still admits from the waiting room. [[training-studio]]
 */
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Users, ArrowRight, Mic, MicOff, Video, VideoOff, Settings,
  Image as ImageIcon, Volume2, Monitor, Check, Upload, ShieldCheck, HelpCircle, Ban, Loader2,
} from "lucide-react";
import { BackgroundCompositor, type BackgroundSpec } from "@/components/agent-home/focused/training/background-compositor";

interface Info {
  title: string; hostName: string; status: string; startsAt: string | null;
  inRoom: number; seats: number; role: string; waitingRoom: boolean;
  guestAllowed: boolean; collectEmail: boolean;
  headline: string | null; message: string | null;
  logoUrl: string | null; bannerUrl: string | null; brandColors: string[];
}
interface Dev { deviceId: string; label: string }

const SCENES: { key: string; label: string; from: string; to: string }[] = [
  { key: "office", label: "Office", from: "#6b7280", to: "#374151" },
  { key: "slate", label: "Slate", from: "#334155", to: "#0f172a" },
  { key: "warm", label: "Warm", from: "#92400e", to: "#451a03" },
  { key: "cool", label: "Cool", from: "#0ea5e9", to: "#1e3a8a" },
];
const eq = (a: BackgroundSpec, b: BackgroundSpec) => JSON.stringify(a) === JSON.stringify(b);

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [tab, setTab] = useState<"bg" | "audio" | "devices">("bg");

  // ---- media (self-contained preview) ----
  const rawRef = useRef<MediaStream | null>(null);
  const compRef = useRef<BackgroundCompositor | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [level, setLevel] = useState(0);
  const [cams, setCams] = useState<Dev[]>([]);
  const [mics, setMics] = useState<Dev[]>([]);
  const [camId, setCamId] = useState<string | null>(null);
  const [micId, setMicId] = useState<string | null>(null);
  const [bg, setBg] = useState<BackgroundSpec>({ type: "none" });
  const [mediaErr, setMediaErr] = useState<string | null>(null);

  const brand = info && info.brandColors.length >= 2
    ? [info.brandColors[0], info.brandColors[1]]
    : info && info.brandColors.length === 1
      ? [info.brandColors[0], "#111827"]
      : ["#6366f1", "#7c3aed"];

  // Prefill from a previous visit + the saved background.
  useEffect(() => {
    try {
      setName(localStorage.getItem("tg-name") || "");
      setEmail(localStorage.getItem("tg-email") || "");
      const b = localStorage.getItem("tg-bg");
      if (b) setBg(JSON.parse(b) as BackgroundSpec);
    } catch {}
  }, []);

  // Load the invite.
  useEffect(() => {
    fetch(`/api/ai/training/join/${token}`)
      .then((r) => r.json())
      .then((j) => (j.success ? setInfo(j.data) : setLoadErr(j.error?.message || "This link isn't valid")))
      .catch(() => setLoadErr("Couldn't load this invite"))
      .finally(() => setLoading(false));
  }, [token]);

  // Put the preview stream on the <video> whenever it changes.
  const showStream = useCallback((s: MediaStream | null) => {
    if (videoRef.current && videoRef.current.srcObject !== s) videoRef.current.srcObject = s;
  }, []);

  // Apply a background to the preview (raw when off, composited otherwise).
  const applyBg = useCallback(async (spec: BackgroundSpec) => {
    setBg(spec);
    try { localStorage.setItem("tg-bg", JSON.stringify(spec)); } catch {}
    const raw = rawRef.current;
    if (!raw) return;
    if (spec.type === "none") {
      compRef.current?.stop();
      showStream(raw);
      return;
    }
    if (!compRef.current) compRef.current = new BackgroundCompositor();
    if (compRef.current.stream) {
      await compRef.current.setBackground(spec);
      showStream(compRef.current.stream);
    } else {
      const out = await compRef.current.start(raw, spec).catch(() => raw);
      showStream(out);
    }
  }, [showStream]);

  // Start the camera + mic and wire the level meter + device list.
  const startMedia = useCallback(async (camDevice?: string, micDevice?: string) => {
    setMediaErr(null);
    try {
      const raw = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, ...(camDevice ? { deviceId: { exact: camDevice } } : {}) },
        audio: micDevice ? { deviceId: { exact: micDevice } } : true,
      });
      rawRef.current?.getTracks().forEach((t) => t.stop());
      rawRef.current = raw;
      raw.getVideoTracks().forEach((t) => (t.enabled = camOn));
      raw.getAudioTracks().forEach((t) => (t.enabled = micOn));
      setCamId(raw.getVideoTracks()[0]?.getSettings().deviceId ?? null);
      setMicId(raw.getAudioTracks()[0]?.getSettings().deviceId ?? null);

      // audio level meter
      acRef.current?.close().catch(() => {});
      const ac = new AudioContext();
      acRef.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      ac.createMediaStreamSource(raw).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(rafRef.current);
      tick();

      // device list (labels only appear once permission is granted)
      const devs = await navigator.mediaDevices.enumerateDevices();
      setCams(devs.filter((d) => d.kind === "videoinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` })));
      setMics(devs.filter((d) => d.kind === "audioinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` })));

      await applyBg(bg);
    } catch {
      setMediaErr("We couldn't reach your camera or mic — check the browser's permission. You can still join.");
    }
  }, [applyBg, bg, camOn, micOn]);

  // Kick media off once the invite loads (and it isn't over).
  const started = useRef(false);
  useEffect(() => {
    if (!info || started.current) return;
    started.current = true;
    void startMedia();
    return () => {
      cancelAnimationFrame(rafRef.current);
      compRef.current?.stop();
      acRef.current?.close().catch(() => {});
      rawRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    rawRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };
  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    rawRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };
  const pickCam = (id: string) => { setCamId(id); void startMedia(id, micId ?? undefined); };
  const pickMic = (id: string) => { setMicId(id); void startMedia(camId ?? undefined, id); };

  const uploadRef = useRef<HTMLInputElement>(null);
  const onUpload = (file: File) => {
    const url = URL.createObjectURL(file); // local object URL — same-origin, no taint
    void applyBg({ type: "image", url });
  };

  const join = async () => {
    setErr(null);
    if (!name.trim()) { setErr("Please enter your name"); return; }
    if (!email.trim() || !email.includes("@")) { setErr("Please enter a valid email"); return; }
    setJoining(true);
    try {
      // carry the setup into the room
      try {
        localStorage.setItem("tg-want-cam", camOn ? "1" : "0");
        localStorage.setItem("tg-want-mic", micOn ? "1" : "0");
        if (remember) { localStorage.setItem("tg-name", name.trim()); localStorage.setItem("tg-email", email.trim()); }
        else { localStorage.removeItem("tg-name"); localStorage.removeItem("tg-email"); }
      } catch {}
      // stop the preview so we don't hold two camera handles
      cancelAnimationFrame(rafRef.current);
      compRef.current?.stop();
      rawRef.current?.getTracks().forEach((t) => t.stop());

      const res = await fetch(`/api/ai/training/join/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const j = await res.json();
      if (!j.success) { setErr(j.error?.message || "Couldn't join"); setJoining(false); return; }
      router.push(`/m/${j.data.sessionId}`);
    } catch {
      setErr("Couldn't join — try again");
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0e1a]">
        <div className="text-center text-slate-400"><Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-500" /><p className="mt-3 text-[13px]">Loading the invite…</p></div>
      </div>
    );
  }
  if (loadErr || !info) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0e1a] p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1526] p-7 text-center">
          <p className="text-[14px] text-rose-400">{loadErr || "This link isn't valid"}</p>
          <button onClick={() => router.push("/")} className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white hover:border-brand-500">Go to FlowSmartly</button>
        </div>
      </div>
    );
  }

  const live = info.status === "live";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-[#0b1120] to-[#0a0e1a] text-white">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2 font-extrabold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600"><GraduationCap className="h-4 w-4" /></span>
          FlowSmartly
        </div>
        <div className="flex items-center gap-4 text-[12.5px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Secure training room</span>
          <span className="inline-flex items-center gap-1.5"><HelpCircle className="h-4 w-4" /> Help</span>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-2">
        {/* ---- left: what you're joining ---- */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1526]">
          {info.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.bannerUrl} alt="" className="h-44 w-full object-cover" />
          ) : (
            <div className="relative h-44 w-full bg-gradient-to-br from-brand-600/30 to-violet-700/20">
              <div className="absolute inset-0 grid place-items-center">
                <span className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">Live training</span>
              </div>
            </div>
          )}
          <div className="p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2.5">
              {info.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
              ) : null}
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Training Room</span>
            </div>
            <h1 className="text-[26px] font-extrabold leading-tight">{info.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                {live ? <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> : null}
                <span className={live ? "font-bold text-emerald-400" : "text-slate-400"}>{live ? "Live now" : "Not started yet"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400"><Users className="h-4 w-4" /> {info.inRoom} in the room</span>
              <span className="text-slate-400">Hosted by {info.hostName}</span>
            </div>
            {info.message ? <p className="mt-4 text-[13.5px] leading-relaxed text-slate-300">{info.message}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {["Live demonstration", "Interactive whiteboard", "Q&A"].map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-slate-200">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ---- right: set up before you join ---- */}
        <div className="rounded-2xl border border-white/10 bg-[#0f1526] p-5 sm:p-6">
          <h2 className="text-[19px] font-extrabold">Set up before you join</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-400">Check your video, audio and background.</p>

          {/* preview */}
          <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full -scale-x-100 object-cover ${camOn ? "" : "hidden"}`} />
            {!camOn ? (
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-700 text-2xl font-black">{(name || "You").slice(0, 2).toUpperCase()}</span>
              </div>
            ) : null}
            {/* on-video controls */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-3">
              <button onClick={toggleMic} title={micOn ? "Mute" : "Unmute"} className={`grid h-11 w-11 place-items-center rounded-full border ${micOn ? "border-white/20 bg-white/10" : "border-rose-500/50 bg-rose-500/20 text-rose-300"}`}>
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              {/* live level meter */}
              <span className="flex h-11 items-center gap-[3px]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="w-[3px] rounded-full bg-emerald-400 transition-all" style={{ height: `${8 + (micOn && level > i / 5 ? 20 : 0) * (1 - i * 0.12)}px`, opacity: micOn && level > i / 5 ? 1 : 0.25 }} />
                ))}
              </span>
              <button onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"} className={`grid h-11 w-11 place-items-center rounded-full border ${camOn ? "border-brand-400/60 bg-brand-500/20 text-brand-200" : "border-rose-500/50 bg-rose-500/20 text-rose-300"}`}>
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
              <button onClick={() => setTab("devices")} title="Devices" className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10"><Settings className="h-5 w-5" /></button>
            </div>
          </div>
          {mediaErr ? <p className="mt-2 text-[11.5px] text-amber-400">{mediaErr}</p> : null}

          {/* tabs */}
          <div className="mt-4 flex gap-5 border-b border-white/10 text-[13px]">
            {([["bg", "Background", ImageIcon], ["audio", "Audio", Volume2], ["devices", "Devices", Monitor]] as [typeof tab, string, typeof ImageIcon][]).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2 font-semibold ${tab === k ? "border-brand-500 text-brand-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {/* tab: background */}
          {tab === "bg" ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              <BgTile on={bg.type === "none"} label="None" onClick={() => void applyBg({ type: "none" })}>
                <span className="grid h-full w-full place-items-center bg-[repeating-conic-gradient(#2a2a35_0_25%,#1b1b24_0_50%)] [background-size:14px_14px] text-slate-400"><Ban className="h-4 w-4" /></span>
              </BgTile>
              <BgTile on={bg.type === "blur"} label="Blur" onClick={() => void applyBg({ type: "blur" })}>
                <span className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-500 to-slate-800 text-[10px] font-bold text-white/70 [filter:blur(1px)]">blur</span>
              </BgTile>
              <BgTile on={eq(bg, { type: "gradient", from: SCENES[0].from, to: SCENES[0].to })} label="Office" grad={[SCENES[0].from, SCENES[0].to]} onClick={() => void applyBg({ type: "gradient", from: SCENES[0].from, to: SCENES[0].to })} />
              <BgTile on={eq(bg, { type: "gradient", from: brand[0], to: brand[1] })} label="Brand" grad={[brand[0], brand[1]]} onClick={() => void applyBg({ type: "gradient", from: brand[0], to: brand[1] })} />
              <button onClick={() => uploadRef.current?.click()} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-white/15 bg-white/5 text-slate-400 hover:border-brand-500 hover:text-white">
                <span className="flex flex-col items-center gap-1"><Upload className="h-4 w-4" /><span className="text-[10px] font-bold">Upload</span></span>
              </button>
              {SCENES.slice(1).map((s) => (
                <BgTile key={s.key} on={eq(bg, { type: "gradient", from: s.from, to: s.to })} label={s.label} grad={[s.from, s.to]} onClick={() => void applyBg({ type: "gradient", from: s.from, to: s.to })} />
              ))}
              <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
            </div>
          ) : null}

          {/* tab: audio */}
          {tab === "audio" ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Microphone</p>
              {mics.length === 0 ? <p className="text-[12px] text-slate-400">Allow mic access to choose a device.</p> : mics.map((d) => (
                <button key={d.deviceId} onClick={() => pickMic(d.deviceId)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-white/5">
                  <Check className={`h-4 w-4 shrink-0 text-brand-400 ${micId === d.deviceId ? "" : "invisible"}`} /> <span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* tab: devices (camera) */}
          {tab === "devices" ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Camera</p>
              {cams.length === 0 ? <p className="text-[12px] text-slate-400">Allow camera access to choose a device.</p> : cams.map((d) => (
                <button key={d.deviceId} onClick={() => pickCam(d.deviceId)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-white/5">
                  <Check className={`h-4 w-4 shrink-0 text-brand-400 ${camId === d.deviceId ? "" : "invisible"}`} /> <span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* name + email */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-300">Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-300">Email address</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500" />
            </label>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[12px] text-slate-300">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-brand-500" /> Remember my settings
          </label>

          {info.waitingRoom && info.role !== "COHOST" ? (
            <p className="mt-3 text-[12px] text-slate-400">The host will let you in from the waiting room.</p>
          ) : null}
          {err ? <p className="mt-2 text-[12.5px] text-rose-400">{err}</p> : null}

          <button onClick={join} disabled={joining} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-60">
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join training room <ArrowRight className="h-4 w-4" /></>}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">Your mic and camera settings can be changed anytime.</p>
        </div>
      </div>
    </div>
  );
}

function BgTile({ on, label, grad, onClick, children }: { on: boolean; label: string; grad?: string[]; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 ${on ? "border-brand-500" : "border-transparent"}`} style={grad ? { background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` } : undefined}>
      {children}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-left text-[10px] font-bold text-white">{label}</span>
      {on ? <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand-500"><Check className="h-3 w-3" /></span> : null}
    </button>
  );
}
