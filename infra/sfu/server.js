/**
 * FlowSmartly Training Room — media server (mediasoup SFU).
 *
 * Runs on its OWN box, not the web VPS: media relay is CPU/bandwidth hungry and
 * the app box is already RAM-tight (deploy-vps.sh stops supertonic-tts and
 * whisper-stt just to free memory for `next build`). It also needs a raw UDP
 * port range, which nginx cannot proxy. See DEPLOY.md.
 *
 * The web app never talks to this over HTTP — browsers connect directly, so
 * media never crosses the app box. Auth is a short-lived JWT the Next app mints
 * with the SAME shared secret (TRAINING_SFU_SECRET); we verify it here and trust
 * nothing else the client says.
 *
 * Protocol: one WebSocket per participant, JSON request/response with an `id`
 * for correlation, plus server-pushed events. Deliberately small — the room's
 * real state (roster, board, permissions) lives in Postgres and is streamed by
 * the app's own SSE; this process only moves packets.
 */
const os = require("os");
const http = require("http");
const { WebSocketServer } = require("ws");
const mediasoup = require("mediasoup");
const { jwtVerify } = require("jose");

const PORT = Number(process.env.SFU_PORT || 4443);
const SECRET = process.env.TRAINING_SFU_SECRET || "";
// The PUBLIC IP browsers should send media to. Wrong value here = the call
// connects and then nobody can hear anything, so fail loudly instead.
const ANNOUNCED_IP = process.env.SFU_ANNOUNCED_IP || "";
const RTC_MIN = Number(process.env.SFU_RTC_MIN_PORT || 40000);
const RTC_MAX = Number(process.env.SFU_RTC_MAX_PORT || 40999);
const NUM_WORKERS = Number(process.env.SFU_WORKERS || Math.min(4, os.cpus().length));

if (!SECRET) {
  console.error("[sfu] TRAINING_SFU_SECRET is not set — refusing to start (it would accept forged tokens).");
  process.exit(1);
}
if (!ANNOUNCED_IP) {
  console.error("[sfu] SFU_ANNOUNCED_IP is not set — refusing to start (media would be unroutable).");
  process.exit(1);
}

// Opus + VP8/H264. VP8 first: it's the widest-supported and simulcast-friendly.
const MEDIA_CODECS = [
  { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: { "x-google-start-bitrate": 1000 },
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
];

const workers = [];
let nextWorker = 0;

async function startWorkers() {
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: process.env.SFU_LOG_LEVEL || "warn",
      rtcMinPort: RTC_MIN,
      rtcMaxPort: RTC_MAX,
    });
    worker.on("died", () => {
      // A dead worker takes its rooms with it. Exiting lets pm2 restart us
      // clean rather than limping along serving broken rooms.
      console.error(`[sfu] worker ${worker.pid} died — exiting for a clean restart`);
      setTimeout(() => process.exit(1), 1000);
    });
    workers.push(worker);
  }
  console.log(`[sfu] ${workers.length} workers up · RTC ${RTC_MIN}-${RTC_MAX} · announcing ${ANNOUNCED_IP}`);
}
const pickWorker = () => workers[nextWorker++ % workers.length];

/** roomId -> { router, peers: Map<participantId, Peer> } */
const rooms = new Map();

async function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (room) return room;
  const router = await pickWorker().createRouter({ mediaCodecs: MEDIA_CODECS });
  room = { router, peers: new Map() };
  rooms.set(roomId, room);
  console.log(`[sfu] room ${roomId} created (${rooms.size} open)`);
  return room;
}

function closeRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.peers.size > 0) return;
  room.router.close();
  rooms.delete(roomId);
  console.log(`[sfu] room ${roomId} closed (${rooms.size} open)`);
}

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: "0.0.0.0", announcedIp: ANNOUNCED_IP }],
    enableUdp: true,
    enableTcp: true, // TCP fallback for networks that block UDP
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  });
  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

const send = (ws, msg) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
};
/** Push an event to everyone in the room except the originator. */
function broadcast(room, fromId, msg) {
  for (const [pid, peer] of room.peers) {
    if (pid === fromId) continue;
    send(peer.ws, msg);
  }
}

const server = http.createServer((req, res) => {
  // The only HTTP surface: a health check for the deploy + pm2.
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, workers: workers.length }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/rtc" });

wss.on("connection", (ws, req) => {
  let peer = null;
  let room = null;
  let roomId = null;

  // ---- auth: the token is the ONLY thing we trust ----
  //
  // NOTE the shape here. This handler is deliberately NOT async, and `ready` is
  // awaited INSIDE the listeners below rather than before attaching them.
  // Verifying a token and creating a router are both async, and `ws` does not
  // buffer messages for a listener attached later — so a client that sends on
  // 'open' (ours does) would beat the listener and have its first request
  // silently dropped. Attaching synchronously and awaiting per-message is what
  // makes the first getCapabilities reliable.
  const ready = (async () => {
    try {
      const url = new URL(req.url, "http://x");
      const token = url.searchParams.get("token");
      if (!token) throw new Error("no token");
      const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), {
        issuer: "flowsmartly",
        audience: "sfu",
      });
      roomId = String(payload.sessionId);
      room = await getRoom(roomId);
      peer = {
        id: String(payload.participantId),
        // The app decides who may share; we enforce what it decided. A client
        // that forges a screen produce gets refused here, not just in the UI.
        canShare: payload.canShare === true,
        ws,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      // A reconnect (or a second tab) replaces the old peer rather than duplicating it.
      const old = room.peers.get(peer.id);
      if (old) closePeer(room, old);
      room.peers.set(peer.id, peer);
      return true;
    } catch {
      send(ws, { type: "error", error: "Not allowed in this room" });
      ws.close(4401, "unauthorized");
      return false;
    }
  })();

  ws.on("message", async (raw) => {
    if (!(await ready)) return;
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const reply = (data) => send(ws, { id: msg.id, ...data });

    try {
      switch (msg.method) {
        case "getCapabilities":
          reply({ result: { rtpCapabilities: room.router.rtpCapabilities } });
          break;

        case "createTransport": {
          const { transport, params } = await createWebRtcTransport(room.router);
          peer.transports.set(transport.id, transport);
          transport.on("dtlsstatechange", (s) => {
            if (s === "closed") transport.close();
          });
          reply({ result: params });
          break;
        }

        case "connectTransport": {
          const t = peer.transports.get(msg.params.transportId);
          if (!t) throw new Error("no such transport");
          await t.connect({ dtlsParameters: msg.params.dtlsParameters });
          reply({ result: { ok: true } });
          break;
        }

        case "produce": {
          const t = peer.transports.get(msg.params.transportId);
          if (!t) throw new Error("no such transport");
          const source = msg.params.appData?.source;
          // Enforce the app's permission, not the client's claim.
          if (source === "screen" && !peer.canShare) {
            throw new Error("You can't share your screen in this room");
          }
          const producer = await t.produce({
            kind: msg.params.kind,
            rtpParameters: msg.params.rtpParameters,
            appData: { peerId: peer.id, source: source || "cam" },
          });
          peer.producers.set(producer.id, producer);
          producer.on("transportclose", () => {
            peer.producers.delete(producer.id);
          });
          reply({ result: { id: producer.id } });
          // tell everyone else there's something new to watch
          broadcast(room, peer.id, {
            type: "newProducer",
            producerId: producer.id,
            peerId: peer.id,
            kind: producer.kind,
            source: source || "cam",
          });
          break;
        }

        case "closeProducer": {
          const p = peer.producers.get(msg.params.producerId);
          if (p) {
            p.close();
            peer.producers.delete(p.id);
            broadcast(room, peer.id, { type: "producerClosed", producerId: p.id, peerId: peer.id });
          }
          reply({ result: { ok: true } });
          break;
        }

        case "consume": {
          const t = peer.transports.get(msg.params.transportId);
          if (!t) throw new Error("no such transport");
          if (!room.router.canConsume({ producerId: msg.params.producerId, rtpCapabilities: msg.params.rtpCapabilities })) {
            throw new Error("cannot consume");
          }
          const consumer = await t.consume({
            producerId: msg.params.producerId,
            rtpCapabilities: msg.params.rtpCapabilities,
            paused: true, // start paused; the client resumes once it's attached
          });
          peer.consumers.set(consumer.id, consumer);
          consumer.on("producerclose", () => {
            peer.consumers.delete(consumer.id);
            send(ws, { type: "consumerClosed", consumerId: consumer.id });
          });
          reply({
            result: {
              id: consumer.id,
              producerId: msg.params.producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
              peerId: consumer.appData?.peerId ?? undefined,
            },
          });
          break;
        }

        case "resume": {
          const c = peer.consumers.get(msg.params.consumerId);
          if (c) await c.resume();
          reply({ result: { ok: true } });
          break;
        }

        /** Everything already being produced — so a late joiner sees the room. */
        case "listProducers": {
          const out = [];
          for (const [pid, other] of room.peers) {
            if (pid === peer.id) continue;
            for (const prod of other.producers.values()) {
              out.push({ producerId: prod.id, peerId: pid, kind: prod.kind, source: prod.appData?.source ?? "cam" });
            }
          }
          reply({ result: { producers: out } });
          break;
        }

        default:
          reply({ error: "unknown method" });
      }
    } catch (e) {
      reply({ error: String(e.message || e) });
    }
  });

  ws.on("close", async () => {
    // Same reason as above: a socket can close before auth settles.
    if (!(await ready)) return;
    if (!peer || !room) return;
    closePeer(room, peer);
    broadcast(room, peer.id, { type: "peerClosed", peerId: peer.id });
    room.peers.delete(peer.id);
    if (roomId) closeRoomIfEmpty(roomId);
  });
});

function closePeer(room, peer) {
  for (const t of peer.transports.values()) {
    try {
      t.close();
    } catch { /* already gone */ }
  }
  peer.transports.clear();
  peer.producers.clear();
  peer.consumers.clear();
  try {
    if (peer.ws.readyState === 1) peer.ws.close();
  } catch { /* already gone */ }
}

startWorkers()
  .then(() => {
    server.listen(PORT, () => console.log(`[sfu] listening on :${PORT} (ws /rtc · GET /health)`));
  })
  .catch((e) => {
    console.error("[sfu] failed to start:", e);
    process.exit(1);
  });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[sfu] ${sig} — closing`);
    for (const w of workers) w.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
