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
#     releases/<utc-stamp>-<sha8>/  an immutable export, never written twice
#     current -> releases/<utc-stamp>-<sha8>
#
# Usage:
#   deploy-v5-public.sh deploy <commit>  build the full 40-hex <commit> + publish + activate
#   deploy-v5-public.sh rollback         flip back to the PREVIOUS release
#   deploy-v5-public.sh rollback <sha>   flip to a specific existing release
#   deploy-v5-public.sh status           active release, available releases, health
#   deploy-v5-public.sh list             releases, newest first
#
# What is built is exactly <commit>: a fresh clone in its own directory, checked
# out detached at <commit>, proven clean before the build and proven unchanged
# after it. It never builds the files of whatever checkout happens to sit in
# APP_DIR — that tree belongs to another deploy and holds other bytes.
#
# Safe to re-run. A release directory is NEVER overwritten: publishing a sha
# that is already published creates a fresh directory and swaps atomically, so
# the release a visitor is currently being served from is never written into.

set -Eeuo pipefail

# --- config ------------------------------------------------------------------
APP_DIR="${APP_DIR:-/opt/flowsmartly}"
# The repository the requested commit is fetched into and cloned from. Only its
# object store is used; its working tree is never built and never touched.
SOURCE_REPO="${SOURCE_REPO:-${APP_DIR}}"
# Each deploy builds in a fresh directory of its own under here, removed after.
BUILD_ROOT="${BUILD_ROOT:-/var/tmp/flowsmartly-v5-build}"
WEB_ROOT="${WEB_ROOT:-/var/www/flowsmartly-v5}"
RELEASES_DIR="${RELEASES_DIR:-${WEB_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${WEB_ROOT}/current}"
# Tracked files the build itself regenerates (apps/v5/scripts/build-content.js).
# After the build these, and only these, may differ from <commit>.
BUILD_GENERATED="apps/v5/src/content/changelog.generated.ts apps/v5/src/content/posts.generated.ts apps/v5/src/content/posts.index.json"
# An export is tens of MB and the box has ~157 GB free, so retention is not a
# disk question — it is a "how far back can we flip without a rebuild" question.
# Five is several days of deploys.
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTH_URL="${HEALTH_URL:-https://flowsmartly.com/}"
# The route gate. A deploy runs the gate of the commit it builds, so the expected
# route set comes from that commit's sources. A rollback runs this one: the gate
# that sits next to this script.
PRECHECK="${PRECHECK:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/precheck-v5-routes.mjs}"
# It is checked against `nginx -T`, the configuration Nginx actually loaded.
# There is no fallback to the repo copy in deploy/: that is the config someone
# once intended, not the one serving.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
# shellcheck disable=SC1090
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true

log()  { printf '\n\033[1;36m> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }

# --- release ordering ---------------------------------------------------------
# A release is named <UTC stamp>-<sha8> (20260101T000000Z-1a2b3c4d), the naming
# the live releases already use. Earlier runs of this script wrote
# <sha>-<14-digit stamp>, and both may sit side by side, so neither a plain
# lexical sort nor a sort on one dash-separated field orders a mixed set: the
# sha is hex, and sorting on it orders by COMMIT HASH, not by time — which
# prunes the wrong release and rolls back to the wrong one. Each name is keyed
# by the stamp it carries, in whichever form.
#
# A name in neither form has no time, so it is left out: it is never pruned and
# never chosen by a no-argument rollback. `rollback <name>` can still select it.
releases_keyed() {
  local name
  find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d -printf '%f\n' 2>/dev/null \
    | while read -r name; do
        if [[ "${name}" =~ ^([0-9]{8})T([0-9]{6})Z-[0-9a-f]{7,40}$ ]]; then
          printf '%s%s %s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${name}"
        elif [[ "${name}" =~ ^[0-9a-f]{7,40}-([0-9]{14})$ ]]; then
          printf '%s %s\n' "${BASH_REMATCH[1]}" "${name}"
        fi
      done
}

releases_newest_first() { releases_keyed | sort -k1,1r -k2,2r | cut -d' ' -f2; }
releases_oldest_first() { releases_keyed | sort -k1,1 -k2,2 | cut -d' ' -f2; }

# The commit a release was built from, as its name records it (8+ hex).
release_sha() {
  local name="$1"
  if [[ "${name}" =~ ^[0-9]{8}T[0-9]{6}Z-([0-9a-f]{7,40})$ ]]; then echo "${BASH_REMATCH[1]}"
  elif [[ "${name}" =~ ^([0-9a-f]{7,40})-[0-9]{14}$ ]]; then echo "${BASH_REMATCH[1]}"
  fi
}

active_release_name() {
  [ -L "${CURRENT_LINK}" ] || return 0
  basename "$(readlink -f "${CURRENT_LINK}")"
}

# --- scratch space --------------------------------------------------------------
# One private directory per run: the clean checkout and the captured Nginx view
# live here, and it is removed on exit whatever the outcome.
WORK_DIR=""
cleanup_work_dir() {
  if [ -n "${WORK_DIR}" ] && [ -d "${WORK_DIR}" ]; then rm -rf "${WORK_DIR}"; fi
}
make_work_dir() {
  [ -z "${WORK_DIR}" ] || return 0
  mkdir -p "${BUILD_ROOT}" || die "could not create ${BUILD_ROOT}"
  WORK_DIR="$(umask 077 && mktemp -d "${BUILD_ROOT}/run.XXXXXX")" || die "could not create a work directory under ${BUILD_ROOT}"
  [ -d "${WORK_DIR}" ] || die "could not create a work directory under ${BUILD_ROOT}"
  trap cleanup_work_dir EXIT
}

# --- verification -------------------------------------------------------------
# Delegated to scripts/precheck-v5-routes.mjs, which is the single definition of
# "this export is complete and the config serves it". Keeping a second copy of
# the list here is how the two drift until one of them checks nothing.
#
# A missing gate is FATAL, never a skip. An export that cannot be verified is not
# published: `expo export` exits 0 having silently dropped a route, and that is
# precisely the failure this exists to catch.
#
# The gate runs in its --public-static mode against `nginx -T`: the effective
# configuration Nginx itself loaded, all files, rather than one file path that
# may not be the one enabled. It proves the export is complete, that the apex
# serves the marketing routes from the `current` link this script flips, and
# that /login and /register are served by the V5 portal and not by this export.
#
# The portal's root is an operator value and is never written into this
# repository: export V5_PORTAL_ROOT, as the installed vhost names it, before
# running. The marketing root has no setting of its own: it is CURRENT_LINK,
# because the link `activate` flips is the one Nginx must be serving.
verify_export() {
  local dir="$1" gate="$2"
  [ -f "${gate}" ] || die "route gate missing: ${gate} — refusing to publish an unverified export"
  [ -n "${V5_PORTAL_ROOT:-}" ] \
    || die "V5_PORTAL_ROOT is not set — the gate must know the V5 portal's root to prove /login and /register are served from it"

  make_work_dir
  local view="${WORK_DIR}/nginx-T.conf"
  if ! nginx -T >"${view}" 2>"${view}.err"; then
    cat "${view}.err" >&2 || true
    die "nginx -T failed — no loaded configuration to verify against; nothing was published"
  fi
  [ -s "${view}" ] || die "nginx -T printed no configuration — nothing to verify against"

  log "Route gate: ${dir} against the loaded Nginx configuration"
  node "${gate}" --public-static --dist "${dir}" --conf "${view}" \
      --marketing-root "${CURRENT_LINK}" --portal-root "${V5_PORTAL_ROOT}" \
    || die "route gate failed — nothing was published and 'current' was not touched"
}

# The checkout must be exactly <commit>: HEAD equal to it, and no file differing
# from it except, after the build, the files the build is known to regenerate.
# Every observation is captured and checked; a git command that fails is a
# refusal, never an empty answer read as "clean".
source_identity() {
  local src="$1" want="$2" when="$3" allowed="$4"
  local head status line path extra=""
  head="$(git -C "${src}" rev-parse --verify --quiet HEAD)" || die "cannot read HEAD of the build checkout ${when}"
  [ "${head}" = "${want}" ] || die "build checkout HEAD is ${head}, not ${want} (${when}) — nothing was published"
  status="$(git -C "${src}" status --porcelain=v1 --untracked-files=all --ignore-submodules=none)" \
    || die "cannot read the status of the build checkout ${when}"
  while IFS= read -r line; do
    [ -n "${line}" ] || continue
    path="${line:3}"
    if [ "${line:0:3}" = " M " ] && [[ " ${allowed} " == *" ${path} "* ]]; then continue; fi
    extra="${extra} ${line}"
  done <<<"${status}"
  [ -z "${extra}" ] || die "build checkout differs from ${want} ${when}:${extra} — nothing was published"
}

cmd_deploy() {
  local want="${1:-}"
  [[ "${want}" =~ ^[0-9a-f]{40}$ ]] \
    || die "deploy needs the full 40-character commit to publish, e.g. $0 deploy \$(git rev-parse origin/main) — a branch or a short sha names no fixed bytes"
  git -C "${SOURCE_REPO}" rev-parse --git-dir >/dev/null 2>&1 || die "no git repository at ${SOURCE_REPO}"

  log "Fetching origin into ${SOURCE_REPO}"
  git -C "${SOURCE_REPO}" fetch --prune --quiet origin || die "git fetch failed in ${SOURCE_REPO}"
  git -C "${SOURCE_REPO}" cat-file -e "${want}^{commit}" 2>/dev/null \
    || die "commit ${want} is not in ${SOURCE_REPO} after fetching origin"

  make_work_dir
  local src="${WORK_DIR}/src"
  log "Clean checkout of ${want}"
  git clone --quiet --no-checkout "${SOURCE_REPO}" "${src}" || die "could not clone ${SOURCE_REPO}"
  git -C "${src}" -c advice.detachedHead=false checkout --quiet --detach "${want}" \
    || die "could not check out ${want}"
  source_identity "${src}" "${want}" "before the build" ""
  log "Building V5 at ${want} — $(git -C "${src}" log -1 --pretty=%s "${want}")"

  # `npm ci`, not `npm install`: it installs exactly the committed lockfile and
  # never rewrites it, so the dependencies are part of <commit> too.
  ( cd "${src}/apps/v5" && npm ci --legacy-peer-deps --no-audit --no-fund ) || die "npm ci failed"
  ( cd "${src}/apps/v5" && npm run build:web ) || die "build failed"
  [ -d "${src}/apps/v5/dist" ] || die "build produced no dist/"

  # Re-proven after the build and before anything is published.
  source_identity "${src}" "${want}" "after the build" "${BUILD_GENERATED}"
  verify_export "${src}/apps/v5/dist" "${src}/scripts/precheck-v5-routes.mjs"

  # A distinct directory per publish. `mkdir` without -p on purpose: if the name
  # somehow already exists we must fail rather than write into a release that
  # may be the one currently being served.
  local stamp release
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  release="${RELEASES_DIR}/${stamp}-${want:0:8}"
  [ -e "${release}" ] && die "release directory already exists: ${release}"

  log "Publishing to ${release}"
  mkdir "${release}" || die "could not create ${release}"
  cp -a "${src}/apps/v5/dist/." "${release}/" || die "copy into ${release} failed — 'current' was not touched"
  # Public files, whoever runs this: `cp -a` keeps the build's modes, which come
  # from the caller's umask, and a 077 caller made the first publish of
  # 11b2a88f a 404 (#184 6240557858). Directories 755, files 644.
  chmod -R u=rwX,go=rX "${release}" || die "could not make ${release} readable — 'current' was not touched"
  # Verify the COPY, not only the source: a truncated copy (full disk, killed
  # process) is exactly the state that must never be activated.
  verify_export "${release}" "${src}/scripts/precheck-v5-routes.mjs"

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
  elif [[ "${target}" != */* && "${target}" != .* ]] && [ -d "${RELEASES_DIR}/${target}" ]; then
    release="${RELEASES_DIR}/${target}"
  else
    # A bare sha resolves to the most recent release built from it, in either
    # naming. The release name may carry 8 hex and the argument 40, or the
    # reverse: they match when one is a prefix of the other.
    [[ "${target}" =~ ^[0-9a-f]{7,40}$ ]] || die "no release named '${target}', and it is not a sha — run: $0 list"
    local rsha
    while read -r name; do
      [ -n "${name}" ] || continue
      rsha="$(release_sha "${name}")"
      if [[ "${rsha}" == "${target}"* || "${target}" == "${rsha}"* ]]; then release="${RELEASES_DIR}/${name}"; break; fi
    done < <(releases_newest_first)
    [ -n "${release}" ] || die "no release found for '${target}' — run: $0 list"
  fi

  [ -d "${release}" ] || die "no release found for '${target}' — run: $0 list"

  verify_export "${release}" "${PRECHECK}"
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

  deploy <commit>   build the full 40-hex <commit> in a clean checkout, verify, publish, activate
  rollback          flip back to the previous release and reload
  rollback <sha>    flip to a specific existing release and reload
  status            active release, available releases, health
  list              releases, newest first
USAGE
    exit 1
    ;;
esac
