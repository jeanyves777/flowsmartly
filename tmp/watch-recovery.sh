#!/usr/bin/env bash
URL="https://flowsmartly.com/"
LOG="tmp/recovery-watch.log"
: > "$LOG"
echo "$(date -Is) watching $URL (main=c20ce5eb, PR#16)" | tee -a "$LOG"
for i in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$URL" || echo 000)"
  body="$(curl -s --max-time 12 "$URL" 2>/dev/null || echo '')"
  new=$(printf '%s' "$body" | grep -c 'Watch the agent work' 2>/dev/null || echo 0)
  maint=$(printf '%s' "$body" | grep -ci 'maintenance' 2>/dev/null || echo 0)
  bad=$(printf '%s' "$body" | grep -c '502 Bad Gateway' 2>/dev/null || echo 0)
  ts="$(date -Is)"
  if [ "$code" = "200" ] && [ "$new" -ge 1 ]; then
    echo "$ts check#$i code=$code -> ✅ NEW SYSTEM LIVE (new-landing marker found)" | tee -a "$LOG"
    exit 0
  fi
  if [ "$code" = "200" ]; then
    echo "$ts check#$i code=200 but new-marker=$new maint=$maint — 200 without new landing (old build?)" | tee -a "$LOG"
  elif [ "$maint" -ge 1 ]; then
    echo "$ts check#$i code=$code — branded MAINTENANCE page serving (app down, nginx fallback OK)" | tee -a "$LOG"
  else
    echo "$ts check#$i code=$code bad502=$bad — still down/deploying" | tee -a "$LOG"
  fi
  sleep 45
done
echo "$(date -Is) TIMEOUT after ~30min — not recovered to new system" | tee -a "$LOG"
exit 2
