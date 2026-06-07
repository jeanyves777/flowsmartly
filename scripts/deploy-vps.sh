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

log "Building (next build --no-lint)"
rm -f "$BUILD_OK"
npx next build --no-lint

# --- 6. BUILD_OK gate — never reload onto a missing/half build ----------------
[ -d "${APP_DIR}/.next" ] || { echo "FATAL: .next missing after build"; exit 1; }
date -u +"BUILD_OK %Y-%m-%dT%H:%M:%SZ $(git rev-parse --short HEAD)" >> "$BUILD_OK"
log "BUILD_OK written: $(tail -n1 "$BUILD_OK")"

# --- 7. zero-downtime reload --------------------------------------------------
log "pm2 reload ${PM2_APP} (graceful, zero-downtime)"
pm2 reload "${PM2_APP}"

# voice services restored by the EXIT trap; persist the process list
pm2 save >/dev/null 2>&1 || true

log "Deploy complete ✓"
