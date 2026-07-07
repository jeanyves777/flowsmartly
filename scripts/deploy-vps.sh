#!/usr/bin/env bash
#
# deploy-vps.sh — production deploy for flowsmartly, run ON the VPS.
#
# Replicates the manual deploy exactly:
#   fetch -> hard-reset to origin -> patch Prisma provider (sqlite -> postgresql)
#   -> prisma generate -> free RAM (stop voice svcs) -> next build --no-lint
#   -> BUILD_OK gate -> pm2 RELOAD (zero-downtime) -> restore voice svcs.
#
# Why hard-reset: the repo ships schema.prisma with provider="sqlite" (dev),
# and we patch it to "postgresql" in place on prod. That patch leaves the tree
# dirty, so `git pull` would conflict on every deploy. Hard-reset to origin
# gives a clean, reproducible checkout, then we re-apply the patch each time.
# Untracked/gitignored files (.env, .next, BUILD_OK, node_modules) are preserved.
#
# Safe to re-run. Uses `pm2 reload` (zero-downtime) when the app is ONLINE; only
# falls back to `pm2 restart`/`start` when the process is stopped/errored/missing,
# so a build that OOM-killed the app can never leave prod down with no recovery.

set -Eeuo pipefail

# --- config (override via env from the CI step if ever needed) ----------------
APP_DIR="${APP_DIR:-/opt/flowsmartly}"
PM2_APP="${PM2_APP:-flowsmartly}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"      # what to deploy
VOICE_SERVICES="${VOICE_SERVICES:-supertonic-tts whisper-stt}"
BUILD_OK="${APP_DIR}/BUILD_OK"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/flow-ai}"  # checked after reload
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"                     # attempts, ~2s apart
# Where Nginx serves the branded maintenance page from when the app upstream is down.
MAINT_DIR="${MAINT_DIR:-/var/www/flowsmartly-maintenance}"
# Bigger V8 heap for the build — this box has OOM'd `next build` at the default.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

# --- make node/npm/pm2/npx reachable in a non-interactive SSH shell -----------
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
command -v node >/dev/null 2>&1 || { echo "FATAL: node not on PATH"; exit 1; }
command -v pm2  >/dev/null 2>&1 || { echo "FATAL: pm2 not on PATH";  exit 1; }

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

cd "$APP_DIR"

# --- always bring voice services back, even if the build fails ----------------
voice_up() {
  log "Restoring voice services: ${VOICE_SERVICES}"
  # shellcheck disable=SC2086
  pm2 start ${VOICE_SERVICES} >/dev/null 2>&1 || true
}
trap voice_up EXIT

# --- 1. sync code to the target ref -------------------------------------------
log "Fetching ${DEPLOY_REF}"
git fetch --prune origin
# Sign BOTH the lockfile and .npmrc — an .npmrc change (e.g. legacy-peer-deps)
# also requires a reinstall, and skipping it left the tree missing deps.
dep_sig() { { git hash-object package-lock.json 2>/dev/null; [ -f .npmrc ] && git hash-object .npmrc 2>/dev/null; } | sha1sum | awk '{print $1}'; }
PREV_LOCK_HASH="$(dep_sig)"
log "Hard-reset working tree to ${DEPLOY_REF}"
git reset --hard "${DEPLOY_REF}"
NEW_LOCK_HASH="$(dep_sig)"
echo "Now at: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --- 1b. refresh the branded maintenance page Nginx falls back to when the app is
#         unreachable (crash / OOM during build / reload blip). Best-effort: a failure
#         here must never abort a deploy. Requires the one-time Nginx config in
#         deploy/nginx-maintenance.conf.
if [ -f "${APP_DIR}/public/maintenance.html" ]; then
  log "Refreshing maintenance page -> ${MAINT_DIR}"
  mkdir -p "${MAINT_DIR}" 2>/dev/null \
    && cp -f "${APP_DIR}/public/maintenance.html" "${MAINT_DIR}/maintenance.html" 2>/dev/null \
    || echo "WARN: could not install maintenance page to ${MAINT_DIR} (continuing)"
fi

# --- 2. patch Prisma provider for prod (sqlite -> postgresql) ------------------
log "Patching Prisma provider -> postgresql"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
grep -q 'provider = "postgresql"' prisma/schema.prisma \
  || { echo "FATAL: Prisma provider patch did not apply"; exit 1; }

# --- 3. install deps -----------------------------------------------------------
# Install when the lockfile/.npmrc signature changed OR when node_modules was
# never fully provisioned for the CURRENT signature. The old gate keyed only off
# the git PREV-vs-NEW comparison, so a re-deploy of the same commit onto an
# incomplete node_modules (e.g. a prior install that failed / was skipped) would
# keep skipping install forever — which is exactly how the VPS ended up missing
# lenis/gsap. We stamp the signature into node_modules ONLY after a successful
# install; a missing/mismatched stamp means deps aren't actually present.
DEP_STAMP="${APP_DIR}/node_modules/.deploy-dep-sig"
INSTALLED_SIG="$( [ -f "$DEP_STAMP" ] && cat "$DEP_STAMP" 2>/dev/null || echo none )"
if [ "$PREV_LOCK_HASH" != "$NEW_LOCK_HASH" ] || [ "$INSTALLED_SIG" != "$NEW_LOCK_HASH" ]; then
  log "Installing deps (signature changed or node_modules not provisioned for ${NEW_LOCK_HASH})"
  npm install --no-audit --no-fund
  # Stamp AFTER a successful install so a failed/partial install never marks the
  # tree as provisioned (set -e already aborts the deploy if npm install fails).
  echo "$NEW_LOCK_HASH" > "$DEP_STAMP"
  log "Stamped node_modules as provisioned for ${NEW_LOCK_HASH}"
else
  echo "Dependencies unchanged & provisioned (${NEW_LOCK_HASH}) — skipping npm install"
fi

# --- 4. prisma: sync the DB schema, then generate the client ------------------
# db push makes the prod DB match schema.prisma — it ADDS any table/column that
# exists in code but not yet in prod (this is how features ship their schema;
# the deploy is the single place prod schema advances). It is ADDITIVE and does
# NOT drop data. Running non-interactively (SSH, no TTY), Prisma ABORTS the deploy
# if a change would be destructive instead of dropping data — so we deliberately
# do NOT pass --accept-data-loss; a destructive diff should fail loudly and be
# resolved by hand, never silently lose rows.
log "Syncing DB schema (prisma db push — additive)"
npx prisma db push --skip-generate
log "Generating Prisma client"
npx prisma generate

# --- 4b. yt-dlp for Reel Studio URL ingest (download links -> clips) ----------
# Standalone binary; non-fatal — if it fails, URL ingest degrades to FAILED and
# file UPLOADS still work. ffmpeg (already on the box) handles the merge.
if ! command -v yt-dlp >/dev/null 2>&1 && [ ! -x /usr/local/bin/yt-dlp ]; then
  log "Installing yt-dlp (Reel Studio URL ingest)"
  curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    || log "yt-dlp install failed — URL ingest will degrade (uploads still work)"
fi

# --- 5. free RAM for the build, then build ------------------------------------
log "Stopping voice services to free RAM for the build"
# shellcheck disable=SC2086
pm2 stop ${VOICE_SERVICES} >/dev/null 2>&1 || true

# Stamp the exact commit + build time into the bundle so /api/version can report
# what's live — makes a deploy verifiable from outside even when the change is
# behind auth and touches no public asset. NEXT_PUBLIC_* is inlined at build.
export NEXT_PUBLIC_BUILD_SHA="$(git rev-parse HEAD)"
export NEXT_PUBLIC_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Building (next build --no-lint, NODE_OPTIONS=${NODE_OPTIONS}) — SHA ${NEXT_PUBLIC_BUILD_SHA:0:8}"
rm -f "$BUILD_OK"
npx next build --no-lint

# --- 6. BUILD_OK gate — never reload onto a missing/half build ----------------
[ -d "${APP_DIR}/.next" ] || { echo "FATAL: .next missing after build"; exit 1; }
date -u +"BUILD_OK %Y-%m-%dT%H:%M:%SZ $(git rev-parse --short HEAD)" >> "$BUILD_OK"
log "BUILD_OK written: $(tail -n1 "$BUILD_OK")"

# --- 7. bring the app up ------------------------------------------------------
# Prefer `pm2 reload` (zero-downtime) when the app is ONLINE. But if the process
# was stopped or errored — e.g. OOM-killed while a previous build ran with voice
# services down — `pm2 reload` does not reliably START it, which is how a failed
# build turned into a hard 502 outage with nothing bringing the app back. So:
# reload if online, else restart (start a stopped/errored process), else start.
app_status="$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s).find(x=>x.name===process.argv[1]);process.stdout.write(p?(p.pm2_env&&p.pm2_env.status||""):"missing")}catch(e){process.stdout.write("unknown")}})' "${PM2_APP}" 2>/dev/null || echo unknown)"
log "pm2 ${PM2_APP} status before deploy: ${app_status:-unknown}"
if [ "$app_status" = "online" ]; then
  log "pm2 reload ${PM2_APP} (graceful, zero-downtime)"
  pm2 reload "${PM2_APP}" || pm2 restart "${PM2_APP}"
else
  # stopped / errored / missing / unknown — force it online.
  log "pm2 ${PM2_APP} not online (${app_status:-unknown}) — restarting to bring it up"
  pm2 restart "${PM2_APP}" || pm2 start "${PM2_APP}" || {
    echo "WARN: pm2 restart/start by name failed — attempting to launch fresh"
    pm2 start npm --name "${PM2_APP}" -- start
  }
fi

# --- 8. health check — fail the deploy (red CI -> GitHub email) on a bad boot -
log "Health check: ${HEALTH_URL}"
healthy=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo 000)"
  if [ "$code" = "200" ]; then
    echo "  attempt ${i}: ${code} ✓"; healthy=true; break
  fi
  echo "  attempt ${i}: ${code} — retrying in 2s…"; sleep 2
done
if [ "$healthy" != true ]; then
  echo "FATAL: ${HEALTH_URL} never returned 200 after ${HEALTH_RETRIES} attempts."
  echo "Recent pm2 logs for ${PM2_APP}:"
  pm2 logs "${PM2_APP}" --lines 30 --nostream 2>/dev/null || true
  exit 1
fi

# --- 9. schedule the background-task recovery cron (idempotent) ---------------
# A render whose in-process worker was SIGKILL'd by THIS very reload is recovered
# (resumed from the provider handle) or failed+refunded by /api/cron/recover-tasks.
# Without a schedule those cards hang on the new "generating" loader forever. Each
# healthy deploy (re)installs a crontab line hitting it every 3 min with the
# CRON_SECRET from .env. Idempotent (drops any prior tagged line first) and
# best-effort (never aborts the deploy). Tag: flowsmartly-recover-tasks.
if command -v crontab >/dev/null 2>&1 && [ -f "${APP_DIR}/.env" ]; then
  CRON_SECRET_VAL="$(grep -E '^CRON_SECRET=' "${APP_DIR}/.env" 2>/dev/null | head -n1 | sed -E 's/^CRON_SECRET=//; s/^["'"'"']//; s/["'"'"']$//' || true)"
  if [ -n "${CRON_SECRET_VAL}" ]; then
    RECOVER_LINE="*/3 * * * * curl -fsS -m 30 -H 'x-cron-secret: ${CRON_SECRET_VAL}' 'http://127.0.0.1:3000/api/cron/recover-tasks' >/dev/null 2>&1 # flowsmartly-recover-tasks"
    if ( crontab -l 2>/dev/null | grep -v 'flowsmartly-recover-tasks'; echo "${RECOVER_LINE}" ) | crontab - 2>/dev/null; then
      log "Scheduled recover-tasks cron (*/3 min)"
    else
      echo "WARN: could not install recover-tasks crontab (continuing)"
    fi
  else
    echo "WARN: CRON_SECRET not found in ${APP_DIR}/.env — skipping recover-tasks cron install"
  fi
else
  echo "WARN: crontab unavailable — skipping recover-tasks cron install"
fi

# voice services restored by the EXIT trap; persist the process list
pm2 save >/dev/null 2>&1 || true

log "Deploy complete ✓"
