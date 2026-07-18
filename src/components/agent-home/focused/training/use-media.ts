"use client";

/**
 * The camera/mic/screen half of the live room.
 *
 * Talks to our own SFU (infra/sfu) over a WebSocket, direct — media never
 * crosses the app VPS. mediasoup-client is loaded LAZILY so its bundle only
 * lands on people who actually open a room.
 *
 * Optional by design: when the room has no media server configured, this hook
 * reports `enabled: false` and does nothing. The room is still a working
 * whiteboard session, so nothing here may throw into the studio.
 * [[training-studio]]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Device, Transport, Producer, Consumer } from "mediasoup-client/types";
import { BackgroundCompositor, type BackgroundSpec } from "./background-compositor";

export interface RemoteStream {
  participantId: string;
  stream: MediaStream;
  source: "cam" | "screen";
  kind: "audio" | "video";
}

export interface DeviceOption {
  deviceId: string;
  label: string;
}

interface State {
  enabled: boolean;
  connected: boolean;
  /** why there's no video, in words worth showing a user */
  reason: string | null;
  camOn: boolean;
  micOn: boolean;
  screenOn: boolean;
  localCam: MediaStream | null;
  localScreen: MediaStream | null;
  remotes: RemoteStream[];
  /** the picker menus, à la Zoom */
  cameras: DeviceOption[];
  mics: DeviceOption[];
  speakers: DeviceOption[];
  camId: string | null;
  micId: string | null;
  spkId: string | null;
  /** a track died while we were away (tab backgrounded, device unplugged): the
   *  camera/mic silently stopped and the UI must SAY so, not pretend it's live. */
  needsAttention: boolean;
  /** the virtual background applied to the OUTGOING camera. */
  background: BackgroundSpec;
}

const INITIAL: State = {
  enabled: false,
  connected: false,
  reason: null,
  camOn: false,
  micOn: false,
  screenOn: false,
  localCam: null,
  localScreen: null,
  remotes: [],
  cameras: [],
  mics: [],
  speakers: [],
  camId: null,
  micId: null,
  spkId: null,
  needsAttention: false,
  background: { type: "none" },
};

export function useMedia(sessionId: string | null, live: boolean) {
  const [state, setState] = useState<State>(INITIAL);

  const ws = useRef<WebSocket | null>(null);
  const device = useRef<Device | null>(null);
  const sendT = useRef<Transport | null>(null);
  const recvT = useRef<Transport | null>(null);
  const producers = useRef<Map<string, Producer>>(new Map()); // key: cam|mic|screen
  const consumers = useRef<Map<string, Consumer>>(new Map());
  const pending = useRef<Map<number, (v: { result?: unknown; error?: string }) => void>>(new Map());
  const reqId = useRef(0);
  const alive = useRef(false);

  /** One request over the signalling socket. Rejects on an SFU-side refusal. */
  const rpc = useCallback(<T,>(method: string, params?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const sock = ws.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return reject(new Error("not connected"));
      const id = ++reqId.current;
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error("timed out"));
      }, 15_000);
      pending.current.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result as T);
      });
      sock.send(JSON.stringify({ id, method, params }));
    });
  }, []);

  const consumeOne = useCallback(
    async (p: { producerId: string; peerId: string; source: "cam" | "screen" }) => {
      const dev = device.current;
      const t = recvT.current;
      if (!dev || !t) return;
      try {
        const res = await rpc<{ id: string; producerId: string; kind: "audio" | "video"; rtpParameters: unknown }>("consume", {
          transportId: t.id,
          producerId: p.producerId,
          rtpCapabilities: dev.rtpCapabilities,
        });
        const consumer = await t.consume({
          id: res.id,
          producerId: res.producerId,
          kind: res.kind,
          rtpParameters: res.rtpParameters as never,
        });
        consumers.current.set(consumer.id, consumer);
        await rpc("resume", { consumerId: consumer.id });

        const stream = new MediaStream([consumer.track]);
        setState((s) => ({
          ...s,
          remotes: [
            ...s.remotes.filter((r) => !(r.participantId === p.peerId && r.source === p.source && r.kind === res.kind)),
            { participantId: p.peerId, stream, source: p.source, kind: res.kind },
          ],
        }));
      } catch {
        /* one track failing must never take the room down */
      }
    },
    [rpc],
  );

  // ---------------------------------------------------------------- connect
  useEffect(() => {
    if (!sessionId || !live) return;
    alive.current = true;
    let sock: WebSocket | null = null;

    void (async () => {
      // 1) ask the app for a ticket — this also tells us if video exists at all
      let grant: { enabled: boolean; url?: string; token?: string; reason?: string };
      try {
        const j = await fetch(`/api/ai/training/${sessionId}/rtc`, { method: "POST" }).then((r) => r.json());
        grant = j?.data ?? { enabled: false };
      } catch {
        setState((s) => ({ ...s, enabled: false, reason: "Video isn't available right now." }));
        return;
      }
      if (!grant.enabled || !grant.url || !grant.token) {
        setState((s) => ({ ...s, enabled: false, reason: grant.reason ?? "Video isn't switched on for this room yet." }));
        return;
      }
      if (!alive.current) return;
      setState((s) => ({ ...s, enabled: true, reason: null }));

      // 2) open the socket to the media server, direct
      const base = grant.url.replace(/^http/, "ws").replace(/\/$/, "");
      sock = new WebSocket(`${base}/rtc?token=${encodeURIComponent(grant.token)}`);
      ws.current = sock;

      sock.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (typeof msg.id === "number") {
          const fn = pending.current.get(msg.id);
          if (fn) {
            pending.current.delete(msg.id);
            fn(msg as { result?: unknown; error?: string });
          }
          return;
        }
        switch (msg.type) {
          case "newProducer":
            void consumeOne({
              producerId: String(msg.producerId),
              peerId: String(msg.peerId),
              source: msg.source === "screen" ? "screen" : "cam",
            });
            break;
          case "producerClosed":
          case "peerClosed":
            setState((s) => ({
              ...s,
              remotes: s.remotes.filter((r) => (msg.peerId ? r.participantId !== msg.peerId : true)),
            }));
            break;
        }
      };

      sock.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
      };
      sock.onclose = () => {
        setState((s) => ({ ...s, connected: false, remotes: [] }));
      };

      await new Promise<void>((resolve) => {
        if (!sock) return resolve();
        sock.onopen = () => resolve();
      });
      if (!alive.current) return;

      // 3) build the device + transports
      try {
        const { Device: Dev } = await import("mediasoup-client");
        const { rtpCapabilities } = await rpc<{ rtpCapabilities: unknown }>("getCapabilities");
        const dev = new Dev();
        await dev.load({ routerRtpCapabilities: rtpCapabilities as never });
        device.current = dev;

        const mkTransport = async (direction: "send" | "recv") => {
          const params = await rpc<{ id: string; iceParameters: unknown; iceCandidates: unknown; dtlsParameters: unknown }>("createTransport", { direction });
          const t =
            direction === "send"
              ? dev.createSendTransport(params as never)
              : dev.createRecvTransport(params as never);
          t.on("connect", ({ dtlsParameters }, ok, fail) => {
            rpc("connectTransport", { transportId: t.id, dtlsParameters }).then(() => ok(), fail);
          });
          if (direction === "send") {
            t.on("produce", ({ kind, rtpParameters, appData }, ok, fail) => {
              rpc<{ id: string }>("produce", { transportId: t.id, kind, rtpParameters, appData })
                .then((r) => ok({ id: r.id }))
                .catch(fail);
            });
          }
          return t;
        };

        sendT.current = await mkTransport("send");
        recvT.current = await mkTransport("recv");
        setState((s) => ({ ...s, connected: true }));

        // 4) pick up whatever is already flowing — a late joiner must see the room
        const { producers: existing } = await rpc<{ producers: { producerId: string; peerId: string; source: string }[] }>("listProducers");
        for (const p of existing) {
          await consumeOne({ producerId: p.producerId, peerId: p.peerId, source: p.source === "screen" ? "screen" : "cam" });
        }
      } catch {
        setState((s) => ({ ...s, connected: false, reason: "Couldn't connect to video — the room still works." }));
      }
    })();

    return () => {
      alive.current = false;
      producers.current.forEach((p) => p.close());
      producers.current.clear();
      consumers.current.forEach((c) => c.close());
      consumers.current.clear();
      sendT.current?.close();
      recvT.current?.close();
      sendT.current = null;
      recvT.current = null;
      device.current = null;
      sock?.close();
      ws.current = null;
      setState(INITIAL);
    };
  }, [sessionId, live, rpc, consumeOne]);

  // -------------------------------------------------------------- devices
  // The selected ids live in refs so the toggle callbacks read the latest
  // without being torn down and rebuilt on every pick.
  const camId = useRef<string | null>(null);
  const micId = useRef<string | null>(null);
  const spkId = useRef<string | null>(null);
  const wanted = useRef({ cam: false, mic: false }); // what the user last chose — drives resume

  // Virtual background: the raw camera feeds a compositor; the composited canvas
  // track is what we PUBLISH. Kept in refs so device swaps + reconnects reuse it.
  const compositor = useRef<BackgroundCompositor | null>(null);
  const rawCam = useRef<MediaStream | null>(null);
  const bgSpec = useRef<BackgroundSpec>({ type: "none" });

  /** Given a fresh RAW camera stream, return the stream to publish/preview —
   *  raw when the background is off, otherwise the composited canvas stream. */
  const composeCam = useCallback(async (raw: MediaStream): Promise<MediaStream> => {
    if (bgSpec.current.type === "none") return raw;
    if (!compositor.current) compositor.current = new BackgroundCompositor();
    else compositor.current.stop(); // a new raw stream needs a fresh loop
    try {
      return await compositor.current.start(raw, bgSpec.current);
    } catch {
      return raw; // segmentation unavailable — send the plain camera
    }
  }, []);

  // Remember the last-chosen background across sessions; tear the compositor down
  // when the hook unmounts.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tg-bg");
      if (saved) {
        const spec = JSON.parse(saved) as BackgroundSpec;
        bgSpec.current = spec;
        setState((s) => ({ ...s, background: spec }));
      }
    } catch {}
    return () => {
      compositor.current?.stop();
      compositor.current = null;
      rawCam.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const pick = (kind: MediaDeviceKind, fallback: string) =>
        list
          .filter((d) => d.kind === kind)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
      setState((s) => ({
        ...s,
        cameras: pick("videoinput", "Camera"),
        mics: pick("audioinput", "Microphone"),
        speakers: pick("audiooutput", "Speaker"),
      }));
    } catch {
      /* enumeration is best-effort — labels only fill in after a permission grant */
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    md.addEventListener("devicechange", refreshDevices);
    // Coming back to a backgrounded tab: labels may have changed, and a track
    // the OS stopped will already have fired `ended` (handled per-track below).
    const onVisible = () => { if (document.visibilityState === "visible") void refreshDevices(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      md.removeEventListener("devicechange", refreshDevices);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshDevices]);

  /** A track the OS killed (backgrounded tab, unplugged device) must flip the
   *  flag OFF and raise `needsAttention`, so the room can never claim a dead
   *  camera is live. */
  const watchTrack = useCallback((key: "cam" | "mic", track: MediaStreamTrack) => {
    track.onended = () => {
      producers.current.get(key)?.close();
      producers.current.delete(key);
      setState((s) => ({
        ...s,
        ...(key === "cam" ? { camOn: false, localCam: null } : { micOn: false }),
        needsAttention: true,
      }));
    };
  }, []);

  // ------------------------------------------------------------------ produce
  const publish = useCallback(
    async (key: "cam" | "mic" | "screen", track: MediaStreamTrack) => {
      const t = sendT.current;
      if (!t) throw new Error("no transport");
      const producer = await t.produce({ track, appData: { source: key === "screen" ? "screen" : "cam" } });
      producers.current.set(key, producer);
      return producer;
    },
    [],
  );

  const unpublish = useCallback(
    async (key: "cam" | "mic" | "screen") => {
      const p = producers.current.get(key);
      if (!p) return;
      p.close();
      producers.current.delete(key);
      await rpc("closeProducer", { producerId: p.id }).catch(() => {});
    },
    [rpc],
  );

  const toggleCam = useCallback(async (): Promise<string | null> => {
    if (producers.current.has("cam")) {
      await unpublish("cam");
      wanted.current.cam = false;
      compositor.current?.stop();
      rawCam.current?.getTracks().forEach((t) => t.stop());
      rawCam.current = null;
      setState((s) => {
        s.localCam?.getTracks().forEach((t) => t.stop());
        return { ...s, camOn: false, localCam: null };
      });
      return null;
    }
    try {
      const video: MediaTrackConstraints = { width: 640, height: 480 };
      if (camId.current) video.deviceId = { exact: camId.current };
      const raw = await navigator.mediaDevices.getUserMedia({ video });
      rawCam.current = raw;
      watchTrack("cam", raw.getVideoTracks()[0]); // watch the RAW track — that's what the OS kills
      const preview = await composeCam(raw); // raw, or the composited canvas stream
      await publish("cam", preview.getVideoTracks()[0]);
      wanted.current.cam = true;
      setState((s) => ({ ...s, camOn: true, localCam: preview, needsAttention: false }));
      void refreshDevices(); // labels fill in now that we have permission
      return null;
    } catch {
      return "We couldn't reach your camera — check the browser's permission.";
    }
  }, [publish, unpublish, watchTrack, refreshDevices, composeCam]);

  const toggleMic = useCallback(async (): Promise<string | null> => {
    if (producers.current.has("mic")) {
      await unpublish("mic");
      wanted.current.mic = false;
      setState((s) => ({ ...s, micOn: false }));
      return null;
    }
    try {
      const audio: MediaTrackConstraints = {};
      if (micId.current) audio.deviceId = { exact: micId.current };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: Object.keys(audio).length ? audio : true });
      const track = stream.getAudioTracks()[0];
      watchTrack("mic", track);
      await publish("mic", track);
      wanted.current.mic = true;
      setState((s) => ({ ...s, micOn: true, needsAttention: false }));
      void refreshDevices();
      return null;
    } catch {
      return "We couldn't reach your microphone — check the browser's permission.";
    }
  }, [publish, unpublish, watchTrack, refreshDevices]);

  /** Swap the live camera/mic without renegotiating — mediasoup replaceTrack. */
  const pickCamera = useCallback(async (id: string) => {
    camId.current = id;
    setState((s) => ({ ...s, camId: id }));
    const prod = producers.current.get("cam");
    if (!prod) return;
    try {
      const raw = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, width: 640, height: 480 } });
      watchTrack("cam", raw.getVideoTracks()[0]);
      rawCam.current?.getTracks().forEach((t) => t.stop());
      rawCam.current = raw;
      const preview = await composeCam(raw); // re-run through the compositor if a bg is on
      await prod.replaceTrack({ track: preview.getVideoTracks()[0] });
      setState((s) => {
        if (s.localCam !== raw && s.localCam !== preview) s.localCam?.getTracks().forEach((t) => t.stop());
        return { ...s, localCam: preview };
      });
    } catch {
      /* keep the current camera if the new one won't open */
    }
  }, [watchTrack, composeCam]);

  /** Apply a virtual background to the OUTGOING camera. Takes effect live if the
   *  camera is on, otherwise it's remembered for the next time it turns on. */
  const setBackground = useCallback(async (spec: BackgroundSpec) => {
    bgSpec.current = spec;
    setState((s) => ({ ...s, background: spec }));
    try { localStorage.setItem("tg-bg", JSON.stringify(spec)); } catch {}

    const prod = producers.current.get("cam");
    const raw = rawCam.current;
    if (!prod || !raw) return; // will apply when the camera next turns on

    if (spec.type === "none") {
      compositor.current?.stop();
      const track = raw.getVideoTracks()[0];
      await prod.replaceTrack({ track });
      setState((s) => ({ ...s, localCam: raw }));
      return;
    }
    // already compositing → just swap the background; else start the pipeline
    if (compositor.current?.stream) {
      await compositor.current.setBackground(spec);
      return;
    }
    const preview = await composeCam(raw);
    await prod.replaceTrack({ track: preview.getVideoTracks()[0] });
    setState((s) => ({ ...s, localCam: preview }));
  }, [composeCam]);

  const pickMic = useCallback(async (id: string) => {
    micId.current = id;
    setState((s) => ({ ...s, micId: id }));
    const prod = producers.current.get("mic");
    if (!prod) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id } } });
      const track = stream.getAudioTracks()[0];
      watchTrack("mic", track);
      await prod.replaceTrack({ track });
    } catch {
      /* keep the current mic */
    }
  }, [watchTrack]);

  /** Speaker selection is applied on the audio elements (setSinkId). */
  const pickSpeaker = useCallback((id: string) => {
    spkId.current = id;
    setState((s) => ({ ...s, spkId: id }));
  }, []);

  /** Turn the camera/mic back on after a leave-and-return killed the tracks. */
  const resume = useCallback(async () => {
    setState((s) => ({ ...s, needsAttention: false }));
    if (wanted.current.mic && !producers.current.has("mic")) await toggleMic();
    if (wanted.current.cam && !producers.current.has("cam")) await toggleCam();
  }, [toggleCam, toggleMic]);

  const dismissAttention = useCallback(() => setState((s) => ({ ...s, needsAttention: false })), []);

  const toggleScreen = useCallback(async (): Promise<string | null> => {
    if (producers.current.has("screen")) {
      await unpublish("screen");
      setState((s) => {
        s.localScreen?.getTracks().forEach((t) => t.stop());
        return { ...s, screenOn: false, localScreen: null };
      });
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      await publish("screen", track);
      // the browser's own "Stop sharing" bar must put the stage back too
      track.onended = () => {
        void unpublish("screen");
        setState((s) => ({ ...s, screenOn: false, localScreen: null }));
      };
      setState((s) => ({ ...s, screenOn: true, localScreen: stream }));
      return null;
    } catch (e) {
      // the SFU refuses a screen produce when the app hasn't granted it
      const m = String((e as Error)?.message || "");
      if (/share your screen/i.test(m)) return m;
      return null; // they just cancelled the picker — not an error worth shouting about
    }
  }, [publish, unpublish]);

  return { ...state, toggleCam, toggleMic, toggleScreen, pickCamera, pickMic, pickSpeaker, setBackground, resume, dismissAttention };
}
