#!/usr/bin/env bash
URL="https://flowsmartly.com/api/version"
TARGET="8a08accb"
LOG="tmp/version-watch.log"; : > "$LOG"
echo "$(date -Is) polling $URL for sha $TARGET" | tee -a "$LOG"
for i in $(seq 1 34); do
  body="$(curl -s --max-time 15 "$URL" 2>/dev/null || echo '')"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL" 2>/dev/null || echo 000)"
  ts="$(date -Is)"
  if printf '%s' "$body" | grep -q "$TARGET"; then
    echo "$ts check#$i -> ✅ LIVE: $body" | tee -a "$LOG"; exit 0
  fi
  short="$(printf '%s' "$body" | grep -oE '"shortSha":"[^"]*"' || echo 'n/a')"
  echo "$ts check#$i code=$code shortSha=$short (want $TARGET)" | tee -a "$LOG"
  sleep 45
done
echo "$(date -Is) TIMEOUT ~25min — /api/version never reported $TARGET" | tee -a "$LOG"; exit 2
