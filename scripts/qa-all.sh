#!/usr/bin/env bash
# Full visual-system verification against a fresh production export.
#
# Everything here reads the BUILT export through a real browser. A token
# declaration, a style object, or a passing type-check is not evidence that a
# visitor sees the right thing - this session has already had three audits
# report confident wrong answers, and each time the fix was to measure the
# rendered DOM instead of the source.
#
#   bash scripts/qa-all.sh [--skip-build]
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
PORT=8093
FAIL=0

step() { printf '\n=== %s ===\n' "$1"; }
mark() { if [ "$1" -eq 0 ]; then echo "  PASS  $2"; else echo "  FAIL  $2"; FAIL=1; fi; }

if [ "${1:-}" != "--skip-build" ]; then
  step "type check"
  ( cd apps/v5 && ./node_modules/.bin/tsc --noEmit )
  mark $? "tsc --noEmit"

  step "production export"
  ( cd apps/v5 && NODE_OPTIONS=--max-old-space-size=8192 npm run build:web >/tmp/qa-build.log 2>&1 )
  mark $? "npm run build:web"

  step "agent readiness"
  ( cd apps/v5 && node scripts/agent-readiness.js --strict >/tmp/qa-ready.log 2>&1 )
  mark $? "agent-readiness --strict  $(grep -oE '[0-9]+/100' /tmp/qa-ready.log | tail -1)"
fi

echo "  html pages: $(find apps/v5/dist -name '*.html' | wc -l)"

pkill -f qa-serve >/dev/null 2>&1
sleep 1
node scripts/qa-serve.mjs apps/v5/dist "$PORT" >/tmp/qa-serve.log 2>&1 &
SERVER=$!
sleep 3
curl -s -o /dev/null -w '  server: %{http_code}\n' "http://127.0.0.1:$PORT/" --max-time 10

step "contrast gate self-test"
node scripts/qa-selftest-contrast.mjs 2>&1 | tail -5
mark ${PIPESTATUS[0]} "the gate can still fail"

step "typography, contrast, overflow"
for W in 390 768 1440; do
  node scripts/qa-typography-audit.mjs --width "$W" --shots "./qa-shots/$W" 2>&1 \
    | grep -E '^  (load|font|contrast|overflow) |NOT SCORED|TOTAL' | sed "s/^/  ${W}px /"
  mark ${PIPESTATUS[0]} "typography @ ${W}px"
done

step "responsive recomposition"
node scripts/qa-recomposition-audit.mjs 2>&1 | grep -v '^    diag' | tail -12
mark ${PIPESTATUS[0]} "no stacked-only sections"

step "accessibility"
node scripts/qa-a11y-audit.mjs 2>&1 | tail -8
mark ${PIPESTATUS[0]} "axe-core + structural"
node scripts/qa-a11y-assertions.mjs 2>&1 | tail -12
mark ${PIPESTATUS[0]} "a11y regression assertions"

step "mobile navigation"
node scripts/qa-mobile-menu.mjs --shots ./qa-shots/menu 2>&1 | tail -18
mark ${PIPESTATUS[0]} "mobile menu"

kill $SERVER 2>/dev/null
pkill -f qa-serve >/dev/null 2>&1

printf '\n=== result ===\n'
if [ "$FAIL" -eq 0 ]; then echo "  all gates green"; else echo "  one or more gates FAILED - see above"; fi
echo "  screenshots: qa-shots/{390,768,1440,menu}"
exit "$FAIL"
