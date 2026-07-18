# Training Room media server (SFU) — deploy

The media server for `/home/training`.

- **§0 Interim** — a container on the app VPS. Switches video on today.
- **§1+ Proper** — its own box, once there is one.

---

## §0. INTERIM — a container on the app VPS

Measured on the app box (2026-07-17): **15G RAM · 12G available · 4 cores · load
0.09**, Docker 29.2.1 already installed. One worker sits comfortably alongside
everything else — an earlier worry that the box was RAM-tight was simply wrong.
The deploy stops `supertonic-tts`/`whisper-stt` as a precaution for the 8G-heap
`next build`, not because memory is actually scarce.

**Fine for:** testing, demos, small internal rooms.
**Not fine for:** real classes. Bandwidth is the ceiling and it's shared with the
site. Move to §1 before customers are in a room.

```bash
# on the app box, in /opt/flowsmartly (once this is on main)
openssl rand -hex 32                        # the secret — used in BOTH places below

cat > infra/sfu/.env <<EOF
TRAINING_SFU_SECRET=<paste it>
SFU_ANNOUNCED_IP=$(curl -s ifconfig.me)     # the box's PUBLIC IPv4
EOF

docker compose -f docker-compose.sfu.yml up -d --build   # ~3 min: builds the C++ worker
curl -s localhost:4443/health                            # {"ok":true,...}
```

Open the media ports — **both**, because Hostinger's cloud firewall filters
independently of ufw, and opening only one looks exactly like a broken NAT:

```bash
ufw allow 40000:40999/udp && ufw allow 40000:40999/tcp
```

**Signalling reuses the existing nginx + certificate.** Same box means no new
subdomain and no new cert — just a path. Add to the existing `server {}` in
`/etc/nginx/sites-available/flowsmartly`, **above** `location / {`:

```nginx
location /rtc {
    proxy_pass         http://127.0.0.1:4443;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_read_timeout 3600s;   # a call outlives the default 60s idle timeout
}
```

```bash
nginx -t && systemctl reload nginx
```

Point the app at itself, in `/opt/flowsmartly/.env`:

```ini
TRAINING_SFU_URL=https://flowsmartly.com
TRAINING_SFU_SECRET=<the SAME secret>
```

`pm2 reload flowsmartly`. Video is on.

> Only signalling passes through nginx. Media is UDP straight to the ports above
> and never touches it.

**Moving to the real box later:** stand it up per §1, change `TRAINING_SFU_URL` to
the new host, `pm2 reload flowsmartly`, then `docker compose -f
docker-compose.sfu.yml down` here. No code change.

**Rolling back:** unset the two env vars and reload. Video switches off; every
room keeps working as a whiteboard session.

---

## §1. Why a second box (the proper setup)

- Media relay is CPU + bandwidth hungry, and on the shared box that bandwidth
  competes with the site itself. A call degrading whenever someone deploys or
  renders a video is not acceptable for a paid class.
- It needs a **raw UDP port range**. nginx cannot proxy UDP, so this can't hide
  behind the existing web proxy.
- Browsers connect to it **directly**, so media never crosses the app box and
  never eats its bandwidth.

**Size:** start at 2 vCPU / 4 GB. Rough capacity: a 12-person 720p room is
~1.5–2 Mbps per receiving participant. Bandwidth, not CPU, is the first ceiling —
check the provider's transfer cap before the core count.

## 1. Prerequisites (Ubuntu 22.04+)

mediasoup builds a native C++ worker on install:

```bash
apt update && apt install -y python3 python3-pip build-essential net-tools
npm i -g pm2
```

> Node 18+. This does **not** run on Windows — mediasoup's worker is Linux/macOS only.

## 2. Install

```bash
mkdir -p /opt/flowsmartly-sfu && cd /opt/flowsmartly-sfu
# copy infra/sfu/{package.json,server.js} here (rsync, or clone the repo and point at infra/sfu)
npm install --omit=dev   # compiles the mediasoup worker — takes a few minutes
```

## 3. Configure

`/opt/flowsmartly-sfu/.env`:

```ini
SFU_PORT=4443
# MUST equal TRAINING_SFU_SECRET on the app box — this is what stops forged tokens
TRAINING_SFU_SECRET=<a long random string>
# The PUBLIC IP browsers send media to. Wrong value = the call connects and then
# nobody can hear anything. The server refuses to start without it, on purpose.
SFU_ANNOUNCED_IP=<this box's public IPv4>
SFU_RTC_MIN_PORT=40000
SFU_RTC_MAX_PORT=40999
SFU_WORKERS=2
```

Generate the secret with `openssl rand -hex 32`.

## 4. Firewall — the step everyone forgets

```bash
ufw allow 4443/tcp           # signalling (WSS via nginx, below)
ufw allow 40000:40999/udp    # RTP — the actual media
ufw allow 40000:40999/tcp    # TCP fallback for UDP-blocked networks
ufw allow 3478/udp && ufw allow 3478/tcp   # coturn, see §6
```

Open the same range in the provider's cloud firewall — Hostinger's panel filters
independently of `ufw`, so opening only one of the two looks identical to a
broken NAT.

## 5. TLS + run

The browser page is HTTPS, so the signalling socket must be `wss://` — a mixed
`ws://` is blocked outright. Terminate TLS with nginx on this box:

```nginx
server {
  listen 443 ssl;
  server_name sfu.flowsmartly.com;
  ssl_certificate     /etc/letsencrypt/live/sfu.flowsmartly.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/sfu.flowsmartly.com/privkey.pem;

  location /rtc {
    proxy_pass         http://127.0.0.1:4443;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_read_timeout 3600s;   # a call outlives the default 60s idle timeout
  }
  location /health { proxy_pass http://127.0.0.1:4443; }
}
```

Only the **signalling** goes through nginx. The media itself is UDP straight to
the ports above and never touches nginx.

```bash
cd /opt/flowsmartly-sfu
pm2 start server.js --name flowsmartly-sfu --update-env
pm2 save
curl -s localhost:4443/health    # {"ok":true,"rooms":0,"workers":2}
```

## 6. coturn (TURN) — not optional

Roughly 10–20% of participants sit behind symmetric NAT and **cannot** connect
peer-to-UDP without a relay. Without TURN those people join and silently see
nothing, which reads as "the product is broken".

```bash
apt install -y coturn
```

`/etc/turnserver.conf`:

```ini
listening-port=3478
fingerprint
lt-cred-mech
user=flowsmartly:<a long random password>
realm=flowsmartly.com
external-ip=<this box's public IPv4>
min-port=49000
max-port=49999
```

```bash
systemctl enable coturn && systemctl start coturn
ufw allow 49000:49999/udp
```

Then add the TURN server to the transport ICE config in `server.js`
(`iceServers`) once the credentials exist.

## 7. Point the app at it

On the **app** box, in `/opt/flowsmartly/.env`:

```ini
TRAINING_SFU_URL=https://sfu.flowsmartly.com
TRAINING_SFU_SECRET=<the SAME secret as §3>
```

`pm2 reload flowsmartly`. That's the entire wiring — `lib/training/sfu.ts` reads
exactly these two variables.

**Until they're set, video is simply off and every room still works** as a
whiteboard/doc session. That's deliberate: the studio can ship and be used before
this box exists.

## Verify

1. `curl https://sfu.flowsmartly.com/health` → `{"ok":true,...}`
2. Open `/home/training`, start a session, click the camera. The roster tile
   should show your face.
3. Second browser, different network (phone on 4G — that's the NAT case), join by
   link. Each should see the other.
4. `pm2 logs flowsmartly-sfu` — a room create/close line per session.

**If video connects but nobody can hear or see anything**, it's almost always
`SFU_ANNOUNCED_IP` pointing at a private address, or the UDP range closed in the
cloud firewall. Check those two before anything else.
