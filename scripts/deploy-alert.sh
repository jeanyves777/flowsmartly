#!/usr/bin/env bash
#
# deploy-alert.sh — best-effort PUSH notification that a deploy is stuck.
#
# Called by poll-deploy.sh exactly once per stuck commit. Sends mail straight over
# SMTP with curl rather than through the app, deliberately: the app is the thing
# whose deploy just failed, and an alert that depends on the deployed code is not
# an alert. Credentials come from /opt/flowsmartly/.env (already present for the
# product's transactional mail).
#
# Opt-in: set DEPLOY_ALERT_EMAIL=you@example.com in .env. Without it this exits 0
# and says so in the log, so "nobody was emailed" is itself visible rather than
# being mistaken for "nothing was wrong".
#
# Usage: deploy-alert.sh <targetSha> <deployedSha> <attempts> [failedStep]
# Never fails the caller — every path exits 0.
#
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/flowsmartly}"
TARGET_SHA="${1:-unknown}"
DEPLOYED_SHA="${2:-unknown}"
ATTEMPTS="${3:-?}"
FAILED_STEP="${4:-}"

envval() { grep -m1 "^$1=" "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | sed 's/^"//; s/"$//; s/\r$//'; }

TO="$(envval DEPLOY_ALERT_EMAIL)"
if [ -z "$TO" ]; then
  echo "deploy-alert: DEPLOY_ALERT_EMAIL not set in $APP_DIR/.env — no email sent (log + DEPLOY_STATUS + /api/version are the only signals)"
  exit 0
fi

HOST="$(envval SMTP_HOST)"
PORT="$(envval SMTP_PORT)"; PORT="${PORT:-587}"
USER="$(envval SMTP_USER)"
PASS="$(envval SMTP_PASSWORD)"; [ -z "$PASS" ] && PASS="$(envval SMTP_PASS)"
FROM="$(envval EMAIL_FROM)"; [ -z "$FROM" ] && FROM="$USER"

if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$PASS" ]; then
  echo "deploy-alert: SMTP not configured (need SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — no email sent"
  exit 0
fi

if [ "$PORT" = "465" ]; then URL="smtps://${HOST}:${PORT}"; else URL="smtp://${HOST}:${PORT}"; fi

SUBJECT="[FlowSmartly] DEPLOY STUCK — production is still on ${DEPLOYED_SHA:0:8}"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

{
  echo "From: FlowSmartly Deploy <${FROM}>"
  echo "To: ${TO}"
  echo "Subject: ${SUBJECT}"
  echo "Content-Type: text/plain; charset=utf-8"
  echo
  echo "A deploy failed ${ATTEMPTS} times and has stopped retrying."
  echo
  echo "  wanted (origin/main): ${TARGET_SHA}"
  echo "  actually serving:     ${DEPLOYED_SHA}"
  [ -n "$FAILED_STEP" ] && echo "  failed at step:       ${FAILED_STEP}"
  echo
  echo "Production is still running the previous build. Anything merged since"
  echo "${DEPLOYED_SHA:0:8} is NOT live, however green its PR looked."
  echo
  echo "Check:   ssh root@flowsmartly.com 'tail -100 /var/log/flowsmartly-deploy.log'"
  echo "Status:  curl -s https://flowsmartly.com/api/version"
  echo "Retry:   ssh root@flowsmartly.com '${APP_DIR}/scripts/poll-deploy.sh --force'"
  echo
  echo "Sent by ${APP_DIR}/scripts/deploy-alert.sh at $(date -Is)."
} > "$BODY_FILE"

if curl --silent --show-error --ssl-reqd --max-time 30 \
     --url "$URL" --user "${USER}:${PASS}" \
     --mail-from "$FROM" --mail-rcpt "$TO" \
     --upload-file "$BODY_FILE" 2>&1; then
  echo "deploy-alert: emailed ${TO}"
else
  echo "deploy-alert: SMTP send failed — the log line and DEPLOY_STATUS remain the signal"
fi
exit 0
