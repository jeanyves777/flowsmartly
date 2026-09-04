#!/usr/bin/env bash
#
# poll-deploy.sh — VPS-side PULL deploy. Run from cron (~every minute). When
# origin/main advances past the last SUCCESSFULLY DEPLOYED commit, it runs
# scripts/deploy-vps.sh locally.
#
# Why this exists: the old GitHub Actions SSH deploy intermittently failed with
# "dial tcp :22: i/o timeout" because the VPS dropped some GitHub runner IPs
# (fail2ban/firewall). A pull model is entirely VPS-initiated — GitHub never
# connects to this box — so no runner IP can ever be blocked. Trade-off: deploys
# land within ~1 minute of a push instead of instantly.
#
# --- RETRY SEMANTICS (the thing this script has to get right) ----------------
# deploy-vps.sh does `git reset --hard origin/main` BEFORE it builds, so after a
# FAILED deploy the local HEAD already equals origin/main. A poller that compares
# HEAD to origin/main therefore sees "nothing to do" and never retries — a failed
# deploy stalled silently until somebody happened to push a new commit. That was
# the defect: not slowness, but a deploy that quietly stopped happening.
#
# So we do NOT trust HEAD. State lives in $STATE_FILE:
#   DEPLOYED_SHA    last commit that completed deploy-vps.sh successfully
#   ATTEMPT_SHA     commit currently being attempted
#   ATTEMPTS        consecutive failed attempts for ATTEMPT_SHA
#   NEXT_ATTEMPT_AT epoch seconds — backoff gate
#   ALERTED_SHA     commit we have already alerted about (alert once, not hourly)
# A commit is deployed when REMOTE != DEPLOYED_SHA. A failure is retried up to
# MAX_ATTEMPTS times with backoff (0 / 5 / 15 min). After that the state goes to
# `stuck`: we stop building (no retry storm on a genuinely broken commit) and we
# say so — log line, DEPLOY_STATUS file, /api/version, one email.
#
# Recovery needs no dummy commit:
#   ./scripts/poll-deploy.sh --force     redeploy origin/main now, clearing backoff
#   ./scripts/poll-deploy.sh --status    print the current state and exit
#
# Install (one-time, on the VPS):
#   chmod +x /opt/flowsmartly/scripts/poll-deploy.sh /opt/flowsmartly/scripts/deploy-alert.sh
#   ( crontab -l 2>/dev/null; echo "* * * * * /opt/flowsmartly/scripts/poll-deploy.sh" ) | crontab -
#   cp deploy/logrotate-flowsmartly-deploy.conf /etc/logrotate.d/flowsmartly-deploy
#   # optional push alert: add DEPLOY_ALERT_EMAIL=you@example.com to /opt/flowsmartly/.env
#   # log: tail -f /var/log/flowsmartly-deploy.log
#
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/flowsmartly}"
BRANCH="${BRANCH:-main}"
LOG="${POLL_LOG:-/var/log/flowsmartly-deploy.log}"
STATE_FILE="${DEPLOY_STATE_FILE:-$APP_DIR/.deploy-state}"
STATUS_FILE="${DEPLOY_STATUS_FILE:-$APP_DIR/DEPLOY_STATUS}"
PHASE_FILE="${DEPLOY_PHASE_FILE:-$APP_DIR/.deploy-phase}"
MAX_ATTEMPTS="${DEPLOY_MAX_ATTEMPTS:-3}"
BACKOFF_1="${DEPLOY_BACKOFF_1:-300}"    # wait before attempt 2 — 5 min
BACKOFF_2="${DEPLOY_BACKOFF_2:-900}"    # wait before attempt 3 — 15 min

# Cron runs with a minimal environment — make git/node/npm/pm2 reachable.
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true

MODE="${1:-}"
case "$MODE" in
  --force|--status|"") ;;
  *) echo "usage: $0 [--force|--status]" >&2; exit 2 ;;
esac

now()   { date +%s; }
stamp() { date -Is; }
say()   { echo "$(stamp) poll: $*" >>"$LOG"; }
json_str() { if [ -n "${1:-}" ]; then printf '"%s"' "$(printf '%s' "$1" | tr -d '"\\' | tr '\n' ' ')"; else printf 'null'; fi; }

cd "$APP_DIR" || { say "APP_DIR $APP_DIR missing"; exit 0; }

# --- state -------------------------------------------------------------------
DEPLOYED_SHA=none
ATTEMPT_SHA=none
ATTEMPTS=0
NEXT_ATTEMPT_AT=0
ALERTED_SHA=none
if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE" 2>/dev/null || true
fi

save_state() {
  {
    echo "DEPLOYED_SHA=${DEPLOYED_SHA}"
    echo "ATTEMPT_SHA=${ATTEMPT_SHA}"
    echo "ATTEMPTS=${ATTEMPTS}"
    echo "NEXT_ATTEMPT_AT=${NEXT_ATTEMPT_AT}"
    echo "ALERTED_SHA=${ALERTED_SHA}"
  } > "${STATE_FILE}.tmp" && mv -f "${STATE_FILE}.tmp" "$STATE_FILE"
}

# DEPLOY_STATUS — the operator-facing signal. Read by /api/version so a failed
# deploy is visible from OUTSIDE the box. That works precisely in the failure
# mode: deploy-vps.sh only reloads pm2 AFTER a successful build, so a failed
# deploy leaves the previous build serving — the app is up and answerable.
# state: ok | deploying | failed | stuck
write_status() {
  local state="$1" detail="${2:-}" next_iso=""
  if [ "${NEXT_ATTEMPT_AT:-0}" -gt 0 ] 2>/dev/null; then
    next_iso="$(date -Is -d "@${NEXT_ATTEMPT_AT}" 2>/dev/null || true)"
  fi
  printf '{"state":"%s","deployedSha":"%s","targetSha":"%s","attempts":%s,"maxAttempts":%s,"nextAttemptAt":%s,"failedStep":%s,"updatedAt":"%s"}\n' \
    "$state" "$DEPLOYED_SHA" "$ATTEMPT_SHA" "${ATTEMPTS:-0}" "$MAX_ATTEMPTS" \
    "$(json_str "$next_iso")" "$(json_str "$detail")" "$(stamp)" \
    > "${STATUS_FILE}.tmp" && mv -f "${STATUS_FILE}.tmp" "$STATUS_FILE"
}

# --- bootstrap: seed DEPLOYED_SHA from the last successful BUILD_OK -----------
# BUILD_OK is appended only after `next build` succeeds, so its last line is the
# best available evidence of what actually shipped on a box with no state file.
# If we can't resolve it we leave DEPLOYED_SHA=none, which triggers one deploy of
# current main — idempotent and self-healing.
if [ "$DEPLOYED_SHA" = "none" ] && [ -s "$APP_DIR/BUILD_OK" ]; then
  seed_short="$(awk 'END{print $NF}' "$APP_DIR/BUILD_OK" 2>/dev/null || true)"
  seed_full=""
  if [ -n "$seed_short" ]; then
    seed_full="$(git rev-parse --verify --quiet "${seed_short}^{commit}" 2>/dev/null || true)"
  fi
  if [ -n "$seed_full" ]; then
    DEPLOYED_SHA="$seed_full"
    say "state seeded from BUILD_OK -> ${DEPLOYED_SHA:0:8}"
  fi
fi

# --- one-shot: print state ----------------------------------------------------
if [ "$MODE" = "--status" ]; then
  if [ -f "$STATUS_FILE" ]; then cat "$STATUS_FILE"; else echo '{"state":"unknown"}'; fi
  exit 0
fi

# Single instance — a deploy takes minutes; if one is already running, skip this tick.
exec 9>"/tmp/flowsmartly-poll-deploy.lock"
if ! flock -n 9; then
  [ "$MODE" = "--force" ] && echo "a deploy is already running — not starting a second" >&2
  exit 0
fi

# Outbound fetch only (VPS → GitHub) — this already works; it's the inbound SSH
# that was being blocked.
if ! git fetch --quiet --prune origin "$BRANCH" 2>>"$LOG"; then
  say "fetch failed"
  exit 0
fi

REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"
if [ "$REMOTE" = none ]; then say "cannot resolve origin/$BRANCH"; exit 0; fi

# --- decide -------------------------------------------------------------------
if [ "$MODE" = "--force" ]; then
  say "FORCE redeploy requested for ${REMOTE:0:8} (clearing backoff/stuck state)"
  ATTEMPT_SHA="$REMOTE"; ATTEMPTS=0; NEXT_ATTEMPT_AT=0; ALERTED_SHA=none

elif [ "$DEPLOYED_SHA" = "$REMOTE" ]; then
  # Up to date. Refresh the status so a stale file is never mistaken for truth.
  ATTEMPT_SHA="$REMOTE"; ATTEMPTS=0; NEXT_ATTEMPT_AT=0
  save_state; write_status ok
  exit 0

elif [ "$ATTEMPT_SHA" = "$REMOTE" ] && [ "${ATTEMPTS:-0}" -ge "$MAX_ATTEMPTS" ]; then
  # Genuinely broken commit. Stop building; stay loud. No retry storm.
  phase="$(cat "$PHASE_FILE" 2>/dev/null || true)"
  write_status stuck "$phase"
  if [ "$ALERTED_SHA" != "$REMOTE" ]; then
    say "DEPLOY STUCK — ${REMOTE:0:8} failed ${ATTEMPTS}/${MAX_ATTEMPTS} attempts; production is still on ${DEPLOYED_SHA:0:8}. Fix the cause, then run: $APP_DIR/scripts/poll-deploy.sh --force"
    ALERTED_SHA="$REMOTE"; save_state
    "$APP_DIR/scripts/deploy-alert.sh" "$REMOTE" "$DEPLOYED_SHA" "$ATTEMPTS" "$phase" >>"$LOG" 2>&1 || true
  fi
  exit 0

elif [ "$ATTEMPT_SHA" = "$REMOTE" ] && [ "$(now)" -lt "${NEXT_ATTEMPT_AT:-0}" ]; then
  exit 0   # backing off — quiet on purpose; DEPLOY_STATUS already reads `failed`

elif [ "$ATTEMPT_SHA" != "$REMOTE" ]; then
  ATTEMPT_SHA="$REMOTE"; ATTEMPTS=0; NEXT_ATTEMPT_AT=0; ALERTED_SHA=none
fi

# --- deploy -------------------------------------------------------------------
ATTEMPTS=$((ATTEMPTS + 1))
save_state
write_status deploying
say "deploying ${REMOTE} (attempt ${ATTEMPTS}/${MAX_ATTEMPTS}, last good ${DEPLOYED_SHA:0:8})"
: > "$PHASE_FILE" 2>/dev/null || true

rc=0
DEPLOY_REF="origin/$BRANCH" "$APP_DIR/scripts/deploy-vps.sh" >>"$LOG" 2>&1 || rc=$?

if [ "$rc" -eq 0 ]; then
  DEPLOYED_SHA="$REMOTE"; ATTEMPTS=0; NEXT_ATTEMPT_AT=0; ALERTED_SHA=none
  save_state; write_status ok
  say "deploy OK -> $REMOTE"
  exit 0
fi

phase="$(cat "$PHASE_FILE" 2>/dev/null || true)"
if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
  NEXT_ATTEMPT_AT=0
  ALERTED_SHA="$REMOTE"
  save_state; write_status stuck "$phase"
  say "deploy FAILED (exit $rc) at [${phase:-unknown}] for ${REMOTE:0:8} — attempt ${ATTEMPTS}/${MAX_ATTEMPTS}, giving up"
  say "DEPLOY STUCK — production is still on ${DEPLOYED_SHA:0:8}. Fix the cause, then run: $APP_DIR/scripts/poll-deploy.sh --force"
  "$APP_DIR/scripts/deploy-alert.sh" "$REMOTE" "$DEPLOYED_SHA" "$ATTEMPTS" "$phase" >>"$LOG" 2>&1 || true
else
  wait_s="$BACKOFF_1"
  if [ "$ATTEMPTS" -ge 2 ]; then wait_s="$BACKOFF_2"; fi
  NEXT_ATTEMPT_AT=$(( $(now) + wait_s ))
  save_state; write_status failed "$phase"
  say "deploy FAILED (exit $rc) at [${phase:-unknown}] for ${REMOTE:0:8} — attempt ${ATTEMPTS}/${MAX_ATTEMPTS}, retrying in $((wait_s / 60))m"
fi
exit 0
