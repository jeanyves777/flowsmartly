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

export interface RemoteStream {
  participantId: string;
  stream: MediaStream;
  source: "cam" | "screen";
  kind: "audio" | "video";
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
      setState((s) => {
        s.localCam?.getTracks().forEach((t) => t.stop());
        return { ...s, camOn: false, localCam: null };
      });
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      await publish("cam", stream.getVideoTracks()[0]);
      setState((s) => ({ ...s, camOn: true, localCam: stream }));
      return null;
    } catch {
      return "We couldn't reach your camera — check the browser's permission.";
    }
  }, [publish, unpublish]);

  const toggleMic = useCallback(async (): Promise<string | null> => {
    if (producers.current.has("mic")) {
      await unpublish("mic");
      setState((s) => ({ ...s, micOn: false }));
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await publish("mic", stream.getAudioTracks()[0]);
      setState((s) => ({ ...s, micOn: true }));
      return null;
    } catch {
      return "We couldn't reach your microphone — check the browser's permission.";
    }
  }, [publish, unpublish]);

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

  return { ...state, toggleCam, toggleMic, toggleScreen };
}
