#!/usr/bin/env bash
#
# deploy-v5-public.sh — publish the V5 public static site, run ON the VPS.
#
# The V5 site is a static export (`expo export -p web` -> apps/v5/dist). It has
# no server process, so a deploy is: build, publish to a new immutable release
# directory, flip one symlink, reload Nginx.
#
# Why releases and a symlink rather than building in place:
#   - rollback is a symlink flip, not a rebuild, so recovery is seconds and
#     cannot fail the way a rebuild can (a bad commit, a full disk, no network);
#   - the site is never half-written while a visitor is loading it;
#   - it is completely independent of the V4 deploy. A V5 problem never requires
#     touching the V4 app, and a V4 rollback never reverts the public site.
#
#   /var/www/flowsmartly-v5/
#     releases/<sha>/      an immutable export
#     current -> releases/<sha>
#
# Usage:
#   deploy-v5-public.sh deploy [<ref>]   build <ref> (default origin/main) + publish + activate
#   deploy-v5-public.sh rollback <sha>   re-point `current` at an existing release
#   deploy-v5-public.sh status           show active release, available releases, health
#   deploy-v5-public.sh list             list releases, newest first
#
# Safe to re-run. Never overwrites a release in place: deploying a sha that is
# already published republishes it to a fresh directory and swaps atomically.

set -Eeuo pipefail

# --- config ------------------------------------------------------------------
APP_DIR="${APP_DIR:-/opt/flowsmartly}"
V5_DIR="${V5_DIR:-${APP_DIR}/apps/v5}"
WEB_ROOT="${WEB_ROOT:-/var/www/flowsmartly-v5}"
RELEASES_DIR="${RELEASES_DIR:-${WEB_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${WEB_ROOT}/current}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-https://flowsmartly.com/}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true

log()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }

# --- the files a usable export must contain ----------------------------------
# Not a checksum — a check that the export is STRUCTURALLY complete. A build
# that silently drops a route still exits 0, and without this the symlink would
# be flipped onto a site missing pages.
REQUIRED_FILES=(
  "index.html"
  "robots.txt"
  "sitemap.xml"
  "llms.txt"
  "feed.xml"
  "product.html"
  "pricing.html"
  "flowagent.html"
  "login.html"
  "early-access.html"
  "legal/privacy.html"
  "company/contact.html"
)

REQUIRED_DIRS=(
  "_expo"
  "assets"
)

verify_export() {
  local dir="$1"
  local missing=0

  for f in "${REQUIRED_FILES[@]}"; do
    if [ ! -s "${dir}/${f}" ]; then
      warn "missing or empty: ${f}"
      missing=$((missing + 1))
    fi
  done

  for d in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "${dir}/${d}" ]; then
      warn "missing directory: ${d}"
      missing=$((missing + 1))
    fi
  done

  # An export that produced almost no pages is a broken build that still exited 0.
  local pages
  pages="$(find "${dir}" -name '*.html' -type f | wc -l)"
  if [ "${pages}" -lt 40 ]; then
    warn "only ${pages} HTML pages exported — expected 45+"
    missing=$((missing + 1))
  fi

  [ "${missing}" -eq 0 ] || die "export failed verification (${missing} problem(s)) — nothing was published"
  log "export verified: ${pages} pages"
}

cmd_deploy() {
  local ref="${1:-$DEPLOY_REF}"

  [ -d "${V5_DIR}" ] || die "V5 app not found at ${V5_DIR}"

  log "Fetching ${ref}"
  git -C "${APP_DIR}" fetch --prune origin
  git -C "${APP_DIR}" rev-parse --verify "${ref}" >/dev/null 2>&1 || die "unknown ref: ${ref}"

  local sha
  sha="$(git -C "${APP_DIR}" rev-parse --short "${ref}")"
  log "Building V5 at ${sha} — $(git -C "${APP_DIR}" log -1 --pretty=%s "${ref}")"

  # The V4 deploy hard-resets the tree; do not fight it here. This script builds
  # whatever the working tree currently holds, so run it AFTER deploy-vps.sh has
  # synced, or point APP_DIR at a checkout of its own.
  ( cd "${V5_DIR}" && npm install --legacy-peer-deps --no-audit --no-fund )
  ( cd "${V5_DIR}" && npm run build:web )

  [ -d "${V5_DIR}/dist" ] || die "build produced no dist/"
  verify_export "${V5_DIR}/dist"

  # A distinct directory per publish, so republishing the same sha never
  # overwrites the release a visitor is currently being served from.
  local stamp release
  stamp="$(date -u +%Y%m%d%H%M%S)"
  release="${RELEASES_DIR}/${sha}-${stamp}"

  log "Publishing to ${release}"
  mkdir -p "${release}"
  cp -a "${V5_DIR}/dist/." "${release}/"
  verify_export "${release}"

  activate "${release}"
  prune_releases
  health_check
}

# Flip `current` atomically. `ln -sfn` to a temp name then `mv -T` is the only
# sequence that swaps a symlink without a window where it does not exist.
activate() {
  local release="$1"
  [ -d "${release}" ] || die "no such release: ${release}"

  log "Activating $(basename "${release}")"
  ln -sfn "${release}" "${CURRENT_LINK}.tmp"
  mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"

  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    log "Nginx reloaded"
  else
    nginx -t || true
    die "nginx config test failed — `current` was flipped but Nginx was NOT reloaded"
  fi
}

cmd_rollback() {
  local target="${1:-}"
  [ -n "${target}" ] || die "usage: $0 rollback <sha>"

  # Accept a bare sha and resolve it to the most recent release for that sha.
  local release
  if [ -d "${RELEASES_DIR}/${target}" ]; then
    release="${RELEASES_DIR}/${target}"
  else
    release="$(find "${RELEASES_DIR}" -maxdepth 1 -type d -name "${target}-*" | sort | tail -1)"
  fi

  [ -n "${release}" ] && [ -d "${release}" ] || die "no release found for '${target}' — run: $0 list"

  verify_export "${release}"
  activate "${release}"
  health_check
}

prune_releases() {
  local count
  count="$(find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d | wc -l)"
  [ "${count}" -gt "${KEEP_RELEASES}" ] || return 0

  local active
  active="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"

  log "Pruning old releases (keeping ${KEEP_RELEASES})"
  find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d | sort | head -n "-${KEEP_RELEASES}" | while read -r old; do
    # Never delete what is currently being served, whatever the sort says.
    if [ "$(readlink -f "${old}")" = "${active}" ]; then
      warn "skipping active release $(basename "${old}")"
      continue
    fi
    rm -rf "${old}"
    echo "  removed $(basename "${old}")"
  done
}

health_check() {
  log "Health check: ${HEALTH_URL}"
  local code
  for _ in $(seq 1 5); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${HEALTH_URL}" || echo 000)"
    if [ "${code}" = "200" ]; then
      echo "  200 OK"
      return 0
    fi
    sleep 2
  done
  warn "health check returned ${code} — the release is live; check Nginx and the upstream"
  return 1
}

cmd_status() {
  echo "web root:  ${WEB_ROOT}"
  if [ -L "${CURRENT_LINK}" ]; then
    echo "active:    $(basename "$(readlink -f "${CURRENT_LINK}")")"
  else
    echo "active:    (none — ${CURRENT_LINK} is not a symlink)"
  fi
  echo
  cmd_list
  echo
  health_check || true
}

cmd_list() {
  local active
  active="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
  echo "releases (newest first):"
  find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -r | while read -r r; do
    if [ "$(readlink -f "${r}")" = "${active}" ]; then
      echo "  * $(basename "${r}")  <- active"
    else
      echo "    $(basename "${r}")"
    fi
  done
}

mkdir -p "${RELEASES_DIR}"

case "${1:-}" in
  deploy)   shift; cmd_deploy "$@" ;;
  rollback) shift; cmd_rollback "$@" ;;
  status)   cmd_status ;;
  list)     cmd_list ;;
  *)
    cat <<USAGE
usage: $(basename "$0") <command>

  deploy [<ref>]    build <ref> (default ${DEPLOY_REF}), verify, publish, activate
  rollback <sha>    re-point current at an existing release and reload
  status            active release, available releases, health
  list              releases, newest first
USAGE
    exit 1
    ;;
esac
