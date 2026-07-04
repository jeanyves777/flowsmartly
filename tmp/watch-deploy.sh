#!/usr/bin/env bash
URL="https://flowsmartly.com/"
LOG="tmp/deploy-watch.log"; : > "$LOG"
css() { curl -s --max-time 15 "$URL" 2>/dev/null | grep -oE '/_next/static/css/[a-f0-9]+\.css' | sort -u | tr '\n' ',' ; }
BASE="$(css)"
echo "$(date -Is) baseline css: $BASE" | tee -a "$LOG"
for i in $(seq 1 34); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL" || echo 000)"
  now="$(css)"
  ts="$(date -Is)"
  if [ -n "$now" ] && [ "$now" != "$BASE" ]; then
    echo "$ts check#$i code=$code -> ✅ NEW BUILD LIVE (css changed to: $now)" | tee -a "$LOG"; exit 0
  fi
  echo "$ts check#$i code=$code css_unchanged" | tee -a "$LOG"
  sleep 45
done
echo "$(date -Is) TIMEOUT ~25min — css did not change (build slow or no CSS delta)" | tee -a "$LOG"; exit 2
