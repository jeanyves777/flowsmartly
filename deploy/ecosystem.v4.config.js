/**
 * Repository-owned PM2 configuration for the V4 application.
 * ==========================================================
 *
 * WHY THIS FILE EXISTS. Every pm2 process on this box was created with an ad-hoc
 * `pm2 start` and survives only because `pm2 save` wrote /root/.pm2/dump.pm2.
 * That dump is machine state, not source: nothing in the repository says which
 * port the app listens on, which directory it runs from, or that a second
 * instance exists at all. A reboot replays whatever the dump happened to hold
 * the last time someone remembered to save it.
 *
 * The cutover makes that worse, because there are now TWO app processes - the
 * live one and the staged release the upstream can be switched to - and the
 * difference between them is a port number that lived nowhere but a shell
 * history.
 *
 * PORTS ARE THE CONTRACT.
 *   3000  flowsmartly          the release nginx currently proxies to
 *   3001  flowsmartly-staged   the candidate, verified before any traffic moves
 *
 * `upstream v4_app` in deploy/nginx-upstream-v4.conf names exactly one of them.
 * Switching releases is a one-line change to that upstream plus a reload - never
 * a restart of the application - and rolling back is the same edit reversed,
 * because the previous process is still running and still listening.
 *
 * fork mode, not cluster, and deliberately: Next.js standalone holds in-process
 * state that does not survive being spread across workers here, and `pm2 reload`
 * on a fork-mode process is a stop/start with dropped requests - which is
 * precisely why the upstream switch exists instead.
 *
 * Usage (each release directory is immutable; cwd is what selects the release):
 *   pm2 start deploy/ecosystem.v4.config.js --only flowsmartly-staged
 *   pm2 save                      # persist so `pm2 resurrect` restores it on boot
 *
 * Verify boot survival without rebooting:
 *   pm2 save && pm2 resurrect && pm2 list
 */

const path = require('path');

// The release this file is executed from. Each immutable release directory
// carries its own copy, so cwd is self-describing rather than hardcoded.
const RELEASE_DIR = path.resolve(__dirname, '..');

/** One shape, two ports - so the staged process cannot drift from the live one. */
function app(name, port) {
  return {
    name,
    cwd: RELEASE_DIR,
    script: 'npm',
    args: 'start',
    exec_mode: 'fork',
    instances: 1,
    // The port is the ONLY difference, and it is stated here rather than being
    // inherited from whatever the invoking shell happened to export.
    env: { NODE_ENV: 'production', PORT: String(port) },
    max_memory_restart: '1500M',
    autorestart: true,
    // A crash loop should be visible, not silently retried forever.
    max_restarts: 10,
    min_uptime: '30s',
    restart_delay: 2000,
    merge_logs: true,
    time: true,
  };
}

module.exports = {
  apps: [
    app('flowsmartly', 3000),
    app('flowsmartly-staged', 3001),
  ],
};
