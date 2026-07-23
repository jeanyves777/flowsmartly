# Training Room recording bot — deploy

Runs on the **media box** (same host as `infra/sfu` is fine). It renders each room in a
real Chrome inside a virtual X display and screen-records it (video + audio) with ffmpeg,
then uploads a **Full-HD H.264 `.mp4`** (YouTube-ready) to S3 and registers the URL with the app.

The bot opens the room with `?rec=1` (and joins as a hidden `isRecorder` seat), so the app
renders a **clean, full-bleed stage** — slides / whiteboard / AI presenter / captions only, no
rail, roster, controls or REC overlay — which is what gets captured.

Until this box exists and the app has `TRAINING_RECORDER_URL` set, recording is a **no-op**
— the app degrades gracefully (see `src/lib/training/recorder.ts`).

## 1. System packages

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser ffmpeg xvfb pulseaudio dbus-x11 fonts-liberation
# Puppeteer can also download its own Chrome; if you use the apt chromium, set CHROME_PATH.
```

Run a headless PulseAudio with a **null sink** whose monitor ffmpeg captures. On a root/headless
box, DON'T rely on `XDG_RUNTIME_DIR` (root has no logind runtime dir, so the socket goes somewhere
clients can't find and ffmpeg fails with `pulse … No such process`). Instead bind PA to a **fixed
socket** and point everything at it with `PULSE_SERVER`. Keep PA under pm2 via a wrapper — this is
what's running in prod (`infra/recorder/pulse.sh`, untracked on the box):

```sh
#!/bin/sh
# infra/recorder/pulse.sh — pm2 keeps this alive as "rec-pulse"
rm -f /tmp/pulse-rec.sock 2>/dev/null
exec /usr/bin/pulseaudio -n --exit-idle-time=-1 --disallow-exit \
  --load="module-native-protocol-unix socket=/tmp/pulse-rec.sock auth-anonymous=1" \
  --load="module-null-sink sink_name=rec sink_properties=device.description=rec" \
  --log-target=stderr
```

```bash
pm2 start infra/recorder/pulse.sh --name rec-pulse && pm2 save
# then set PULSE_SERVER=unix:/tmp/pulse-rec.sock  and  PULSE_SOURCE=rec.monitor in the env below
# verify:  PULSE_SERVER=unix:/tmp/pulse-rec.sock pactl list short sources | grep rec.monitor
```

Chrome + ffmpeg reach that PA through `PULSE_SERVER` in the recorder's env; Chrome's tab audio
tab audio there automatically.

## 2. Install + env

```bash
cd infra/recorder && npm install --omit=dev
```

`.env` (or pm2 env):

```
TRAINING_RECORDER_SECRET=<same secret you also add to the APP env>
APP_URL=https://flowsmartly.com
RECORDER_PORT=4600
CHROME_PATH=                                  # omit to use puppeteer's bundled Chrome (recommended on Ubuntu 24.04 — apt chromium is a snap)
PULSE_SERVER=unix:/tmp/pulse-rec.sock         # the fixed PA socket from pulse.sh above
PULSE_SOURCE=rec.monitor
RECORDER_WIDTH=1920          # Full HD. Bump to 2560x1440 on a strong box for "super HD".
RECORDER_HEIGHT=1080
RECORDER_FPS=30
RECORDER_PRESET=veryfast     # x264 realtime preset; ultrafast on a weak box, fast on a strong one
RECORDER_CRF=20              # 18–23: lower = higher quality + bigger file
RECORDER_ABITRATE=192k

# S3 — the SAME bucket the app uses (training/ is public)
S3_BUCKET=<bucket>
S3_PUBLIC_URL=https://<cdn-or-s3-public-host>
S3_ENDPOINT=<only for S3-compatible, e.g. R2/Spaces>
S3_REGION=auto
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
```

## 3. Run under pm2

```bash
pm2 start server.js --name flowsmartly-recorder
pm2 save
curl -s localhost:4600/health   # {"ok":true,"jobs":0}
```

## 4. Turn it on in the APP env (`/opt/flowsmartly/.env`)

```
TRAINING_RECORDER_URL=http://<media-box-private-ip>:4600
TRAINING_RECORDER_SECRET=<same secret as above>
```

Then reload the app (`pm2 reload flowsmartly`). Now when a host presses **Start recording**,
the app POSTs `/start` here; **Stop** POSTs `/stop` → upload → the session shows a **Watch**
button in its Sessions library.

## 5. Smoke test

- **Pipeline self-test (no live room):** Admin → **Training Recordings** → **Run self-test**, or
  `curl -X POST localhost:4600/selftest -H "x-recorder-secret: $SECRET"`. It records a ~7s test
  clip (video + a 440 Hz tone) → S3 and returns the URL; `ffprobe` it to confirm h264 1080p + aac.
- **Full E2E:** start a live room with the AI presenter, **Start recording**; `pm2 logs
  flowsmartly-recorder` shows `recording <id> → /tmp/…`; present a couple slides, **Stop** (or End
  the room). Logs show `saved <id> → https://…` and the session gains **Watch/Download** in the
  Training Library.

### Notes / gotchas
- The bot joins as a hidden `isRecorder` participant — filtered from the roster/tiles/count
  and **never billed** (see the meter in `stream/route.ts`).
- One Chrome + ffmpeg per concurrent recording; size the box accordingly (≈**2 vCPU** for
  1080p30 H.264 `veryfast` + ~500 MB per stream). On a weaker box set `RECORDER_PRESET=ultrafast`
  (or drop to 720p) and cap concurrency.
- Output is **fragmented MP4** (`+frag_keyframe+empty_moov`): a valid, YouTube-uploadable file
  even if the bot is killed mid-record (raw MP4 would corrupt). H.264 High + `yuv420p` + AAC 48k
  stereo — plays everywhere and needs no re-encode for YouTube.
- If audio is silent, the null-sink/monitor routing is wrong — verify `pactl list sinks`
  and that Chrome runs under the same PulseAudio user.
