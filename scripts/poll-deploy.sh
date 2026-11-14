#!/usr/bin/env bash
#
# poll-deploy.sh — VPS-side PULL deploy. Run from cron (~every minute). When
# origin/main advances past the currently-checked-out commit, it runs
# scripts/deploy-vps.sh locally.
#
# Why this exists: the old GitHub Actions SSH deploy intermittently failed with
# "dial tcp :22: i/o timeout" because the VPS dropped some GitHub runner IPs
# (fail2ban/firewall). A pull model is entirely VPS-initiated — GitHub never
# connects to this box — so no runner IP can ever be blocked. Trade-off: deploys
# land within ~1 minute of a push instead of instantly.
#
# Install (one-time, on the VPS):
#   chmod +x /opt/flowsmartly/scripts/poll-deploy.sh
#   ( crontab -l 2>/dev/null; echo "* * * * * /opt/flowsmartly/scripts/poll-deploy.sh" ) | crontab -
#   # log: tail -f /var/log/flowsmartly-deploy.log
#
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/flowsmartly}"
BRANCH="${BRANCH:-main}"
LOG="${POLL_LOG:-/var/log/flowsmartly-deploy.log}"

# Cron runs with a minimal environment — make git/node/npm/pm2 reachable.
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true

# Single instance — a deploy takes minutes; if one is already running, skip this tick.
exec 9>"/tmp/flowsmartly-poll-deploy.lock"
flock -n 9 || exit 0

cd "$APP_DIR" || { echo "$(date -Is) poll: APP_DIR $APP_DIR missing" >>"$LOG"; exit 0; }

# Outbound fetch only (VPS → GitHub) — this already works; it's the inbound SSH
# that was being blocked.
git fetch --quiet --prune origin "$BRANCH" 2>>"$LOG" || { echo "$(date -Is) poll: fetch failed" >>"$LOG"; exit 0; }

LOCAL="$(git rev-parse HEAD 2>/dev/null || echo none)"
REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"

# deploy-vps.sh does `git reset --hard origin/main` first, so after any deploy
# (success OR failure) HEAD == origin/main. That means each commit is attempted
# exactly once — no retry storm on a bad build; push a fix to try again.
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "$(date -Is) poll: deploying $REMOTE (was $LOCAL)" >>"$LOG"
if DEPLOY_REF="origin/$BRANCH" "$APP_DIR/scripts/deploy-vps.sh" >>"$LOG" 2>&1; then
  echo "$(date -Is) poll: deploy OK -> $REMOTE" >>"$LOG"
else
  rc=$?
  echo "$(date -Is) poll: deploy FAILED (exit $rc) for $REMOTE — push a fix to retry" >>"$LOG"
fi
