#!/usr/bin/env bash
#
# deploy-v5-public.sh — publish the V5 public static site, run ON the VPS.
#
# Target: Ubuntu 24.04 LTS, nginx under systemd, /opt/flowsmartly checkout.
#
# The V5 site is a static export (`expo export -p web` -> apps/v5/dist). It has
# no server process, so a deploy is: build, verify, publish to a new immutable
# release directory, flip one symlink, reload Nginx.
#
# Why releases and a symlink rather than building in place:
#   - rollback is a symlink flip, not a rebuild, so recovery is seconds and
#     cannot fail the way a rebuild can (a bad commit, a full disk, no network);
#   - the site is never half-written while a visitor is loading it;
#   - it is completely independent of the V4 deploy. A V5 problem never requires
#     touching the V4 app, and a V4 rollback never reverts the public site.
#
#   /var/www/flowsmartly-v5/
#     releases/<sha>-<utc-stamp>/   an immutable export, never written twice
#     current -> releases/<sha>-<utc-stamp>
#
# Usage:
#   deploy-v5-public.sh deploy [<ref>]   build <ref> (default origin/main) + publish + activate
#   deploy-v5-public.sh rollback         flip back to the PREVIOUS release
#   deploy-v5-public.sh rollback <sha>   flip to a specific existing release
#   deploy-v5-public.sh status           active release, available releases, health
#   deploy-v5-public.sh list             releases, newest first
#
# Safe to re-run. A release directory is NEVER overwritten: publishing a sha
# that is already published creates a fresh directory and swaps atomically, so
# the release a visitor is currently being served from is never written into.

set -Eeuo pipefail

# --- config ------------------------------------------------------------------
APP_DIR="${APP_DIR:-/opt/flowsmartly}"
V5_DIR="${V5_DIR:-${APP_DIR}/apps/v5}"
WEB_ROOT="${WEB_ROOT:-/var/www/flowsmartly-v5}"
RELEASES_DIR="${RELEASES_DIR:-${WEB_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${WEB_ROOT}/current}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
# An export is tens of MB and the box has ~157 GB free, so retention is not a
# disk question — it is a "how far back can we flip without a rebuild" question.
# Five is several days of deploys.
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-https://flowsmartly.com/}"
# The route gate. Checked against the LIVE vhost when one is installed, so this
# also catches drift between the config in the repo and the one Nginx serves.
PRECHECK="${PRECHECK:-${APP_DIR}/scripts/precheck-v5-routes.mjs}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/flowsmartly-v5}"
NGINX_CONF_FALLBACK="${NGINX_CONF_FALLBACK:-${APP_DIR}/deploy/nginx-flowsmartly-v5.conf}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true

log()  { printf '\n\033[1;36m> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }

# --- release ordering ---------------------------------------------------------
# A release is named <sha>-<UTC stamp>. The sha is hex, so a plain lexical sort
# orders by COMMIT HASH, not by time — which prunes the wrong release and rolls
# back to the wrong one. Sort on the stamp field explicitly.
releases_newest_first() {
  find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d -printf '%f\n' 2>/dev/null \
    | sort -t- -k2,2 -r
}

releases_oldest_first() {
  find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d -printf '%f\n' 2>/dev/null \
    | sort -t- -k2,2
}

active_release_name() {
  [ -L "${CURRENT_LINK}" ] || return 0
  basename "$(readlink -f "${CURRENT_LINK}")"
}

# --- verification -------------------------------------------------------------
# Delegated to scripts/precheck-v5-routes.mjs, which is the single definition of
# "this export is complete and the config serves it". Keeping a second copy of
# the list here is how the two drift until one of them checks nothing.
#
# A missing gate is FATAL, never a skip. An export that cannot be verified is not
# published: `expo export` exits 0 having silently dropped a route, and that is
# precisely the failure this exists to catch.
verify_export() {
  local dir="$1"
  [ -f "${PRECHECK}" ] || die "route gate missing: ${PRECHECK} — refusing to publish an unverified export"

  local conf="${NGINX_CONF}"
  if [ ! -f "${conf}" ]; then
    conf="${NGINX_CONF_FALLBACK}"
    warn "no installed vhost at ${NGINX_CONF} — checking the repo copy ${conf} instead."
    warn "That verifies the config we INTEND to serve, not the one Nginx is serving."
    [ -f "${conf}" ] || die "no Nginx config to verify against"
  fi

  log "Route gate: ${dir} against ${conf}"
  node "${PRECHECK}" --dist "${dir}" --conf "${conf}" \
    || die "route gate failed — nothing was published and 'current' was not touched"
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

  # A distinct directory per publish. `mkdir` without -p on purpose: if the name
  # somehow already exists we must fail rather than write into a release that
  # may be the one currently being served.
  local stamp release
  stamp="$(date -u +%Y%m%d%H%M%S)"
  release="${RELEASES_DIR}/${sha}-${stamp}"
  [ -e "${release}" ] && die "release directory already exists: ${release}"

  log "Publishing to ${release}"
  mkdir "${release}" || die "could not create ${release}"
  cp -a "${V5_DIR}/dist/." "${release}/"
  # Verify the COPY, not only the source: a truncated copy (full disk, killed
  # process) is exactly the state that must never be activated.
  verify_export "${release}"

  activate "${release}"
  prune_releases
  health_check
}

# Flip `current` atomically. `ln -sfn` to a temp name then `mv -T` is the only
# sequence that swaps a symlink without a window in which it does not exist.
#
# Nginx is tested BEFORE the flip, not after. Testing afterwards leaves a failed
# run with `current` already moved and Nginx never reloaded — the worst of both.
activate() {
  local release="$1"
  [ -d "${release}" ] || die "no such release: ${release}"

  if ! nginx -t >/dev/null 2>&1; then
    nginx -t || true
    die "nginx config test failed — nothing was flipped"
  fi

  log "Activating $(basename "${release}")"
  ln -sfn "${release}" "${CURRENT_LINK}.tmp"
  mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"

  systemctl reload nginx
  log "Nginx reloaded"
}

cmd_rollback() {
  local target="${1:-}"
  local release=""
  local active name

  active="$(active_release_name)"

  if [ -z "${target}" ]; then
    # No argument: the previous release, i.e. the newest one that is not the
    # one currently active. This is the path someone takes at 2am.
    #
    # If we cannot tell WHICH release is active, "the previous one" has no
    # meaning and the newest release — quite possibly the broken one we are
    # trying to escape — would be chosen. Refuse instead of guessing.
    [ -n "${active}" ] || die "cannot determine the active release (${CURRENT_LINK} is not a symlink) — name one explicitly: $0 rollback <sha>"

    while read -r name; do
      [ -n "${name}" ] || continue
      if [ "${name}" != "${active}" ]; then release="${RELEASES_DIR}/${name}"; break; fi
    done < <(releases_newest_first)

    [ -n "${release}" ] || die "no previous release to roll back to — run: $0 list"
    log "Rolling back from '${active:-none}' to '$(basename "${release}")'"
  elif [ -d "${RELEASES_DIR}/${target}" ]; then
    release="${RELEASES_DIR}/${target}"
  else
    # A bare sha resolves to the most recent release built from it.
    name="$(releases_newest_first | grep -m1 -E "^${target}-" || true)"
    [ -n "${name}" ] || die "no release found for '${target}' — run: $0 list"
    release="${RELEASES_DIR}/${name}"
  fi

  [ -d "${release}" ] || die "no release found for '${target}' — run: $0 list"

  verify_export "${release}"
  activate "${release}"
  health_check
}

prune_releases() {
  local count active name
  count="$(releases_oldest_first | wc -l)"
  [ "${count}" -gt "${KEEP_RELEASES}" ] || return 0

  active="$(active_release_name)"

  log "Pruning old releases (keeping ${KEEP_RELEASES} of ${count})"
  releases_oldest_first | head -n "-${KEEP_RELEASES}" | while read -r name; do
    [ -n "${name}" ] || continue
    # Never delete what is currently being served, whatever the sort says.
    if [ "${name}" = "${active}" ]; then
      warn "skipping active release ${name}"
      continue
    fi
    rm -rf "${RELEASES_DIR:?}/${name}"
    echo "  removed ${name}"
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
  local active
  active="$(active_release_name)"
  echo "web root:  ${WEB_ROOT}"
  if [ -n "${active}" ]; then
    echo "active:    ${active}"
  else
    echo "active:    (none — ${CURRENT_LINK} is not a symlink)"
  fi
  echo "keeping:   ${KEEP_RELEASES} releases"
  echo
  cmd_list
  echo
  health_check || true
}

cmd_list() {
  local active name
  active="$(active_release_name)"
  echo "releases (newest first):"
  releases_newest_first | while read -r name; do
    [ -n "${name}" ] || continue
    if [ "${name}" = "${active}" ]; then
      echo "  * ${name}  <- active"
    else
      echo "    ${name}"
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
  rollback          flip back to the previous release and reload
  rollback <sha>    flip to a specific existing release and reload
  status            active release, available releases, health
  list              releases, newest first
USAGE
    exit 1
    ;;
esac
