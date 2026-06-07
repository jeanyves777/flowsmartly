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
# Safe to re-run. Never calls `pm2 restart` (hard kill) — only `pm2 reload`.

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
PREV_LOCK_HASH="$(git hash-object package-lock.json 2>/dev/null || echo none)"
log "Hard-reset working tree to ${DEPLOY_REF}"
git reset --hard "${DEPLOY_REF}"
NEW_LOCK_HASH="$(git hash-object package-lock.json 2>/dev/null || echo none)"
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

# --- 3. install deps only if the lockfile changed -----------------------------
if [ "$PREV_LOCK_HASH" != "$NEW_LOCK_HASH" ]; then
  log "package-lock.json changed — running npm install"
  npm install --no-audit --no-fund
else
  echo "Dependencies unchanged — skipping npm install"
fi

# --- 4. prisma client ---------------------------------------------------------
log "Generating Prisma client"
npx prisma generate

# --- 5. free RAM for the build, then build ------------------------------------
log "Stopping voice services to free RAM for the build"
# shellcheck disable=SC2086
pm2 stop ${VOICE_SERVICES} >/dev/null 2>&1 || true

log "Building (next build --no-lint, NODE_OPTIONS=${NODE_OPTIONS})"
rm -f "$BUILD_OK"
npx next build --no-lint

# --- 6. BUILD_OK gate — never reload onto a missing/half build ----------------
[ -d "${APP_DIR}/.next" ] || { echo "FATAL: .next missing after build"; exit 1; }
date -u +"BUILD_OK %Y-%m-%dT%H:%M:%SZ $(git rev-parse --short HEAD)" >> "$BUILD_OK"
log "BUILD_OK written: $(tail -n1 "$BUILD_OK")"

# --- 7. zero-downtime reload --------------------------------------------------
log "pm2 reload ${PM2_APP} (graceful, zero-downtime)"
pm2 reload "${PM2_APP}"

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

# voice services restored by the EXIT trap; persist the process list
pm2 save >/dev/null 2>&1 || true

log "Deploy complete ✓"
