# Training Room recording bot — deploy

Runs on the **media box** (same host as `infra/sfu` is fine). It renders each room in a
real Chrome inside a virtual X display and screen-records it (video + audio) with ffmpeg,
then uploads the `.webm` to S3 and registers the URL with the app.

Until this box exists and the app has `TRAINING_RECORDER_URL` set, recording is a **no-op**
— the app degrades gracefully (see `src/lib/training/recorder.ts`).

## 1. System packages

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser ffmpeg xvfb pulseaudio dbus-x11 fonts-liberation
# Puppeteer can also download its own Chrome; if you use the apt chromium, set CHROME_PATH.
```

Start a user PulseAudio the ffmpeg `-f pulse` input can read (headless boxes have no audio
device, so use a **null sink** whose monitor we capture):

```bash
pulseaudio --start --exit-idle-time=-1
pactl load-module module-null-sink sink_name=rec sink_properties=device.description=rec
pactl set-default-sink rec
# then set PULSE_SOURCE=rec.monitor in the env below
```

Chrome must output to that sink — launching Chrome under the same PulseAudio user routes its
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
CHROME_PATH=/usr/bin/chromium-browser        # omit to use puppeteer's bundled Chrome
PULSE_SOURCE=rec.monitor
RECORDER_WIDTH=1280
RECORDER_HEIGHT=720
RECORDER_FPS=25

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

1. Start a live room with the AI presenter, press **Start recording**.
2. `pm2 logs flowsmartly-recorder` should show `recording <id> → /tmp/…`.
3. Present a couple of slides, then **Stop recording**.
4. Logs show `saved <id> → https://…`; the session's row in **Sessions** gains a **Watch**
   button that plays the slides + narration + tiles.

### Notes / gotchas
- The bot joins as a hidden `isRecorder` participant — filtered from the roster/tiles/count
  and **never billed** (see the meter in `stream/route.ts`).
- One Chrome + ffmpeg per concurrent recording; size the box accordingly (≈1 vCPU + ~400 MB
  per stream at 720p/VP8). Cap concurrency if needed.
- `libvpx` is CPU-heavy; switch `-c:v libvpx` → `-c:v libx264 -preset veryfast` + `.mp4`
  output if the box has spare CPU and you prefer MP4.
- If audio is silent, the null-sink/monitor routing is wrong — verify `pactl list sinks`
  and that Chrome runs under the same PulseAudio user.
