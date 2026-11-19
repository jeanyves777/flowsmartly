#!/usr/bin/env node
/** Scratch only: real rollback script + real gates/exports; host commands are stood in for. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const option = (name) => {
  const i = process.argv.indexOf(name);
  assert.ok(i >= 0 && process.argv[i + 1], `Required: ${name}`);
  return process.argv[i + 1];
};
const previous = resolve(option('--previous-source'));
const priorConfig = readFileSync(resolve(option('--prior-conf')), 'utf8');
const priorMarketing = option('--marketing-root');
const priorPortal = option('--portal-root');
const work = mkdtempSync(join(tmpdir(), 'first-news-rollback-'));
try {
  const web = join(work, 'www');
  const current = join(web, 'current');
  const portal = join(work, 'portal');
  const oldName = '20261115T060924Z-97de5073';
  const newName = '20261119T000000Z-074bdfa8';
  const oldRelease = join(web, 'releases', oldName);
  const newRelease = join(web, 'releases', newName);
  mkdirSync(join(web, 'releases'), { recursive: true });
  cpSync(join(previous, 'apps/v5/dist'), oldRelease, { recursive: true });
  cpSync(join(repo, 'apps/v5/dist'), newRelease, { recursive: true });
  symlinkSync(newRelease, current);
  const conf = join(work, 'prior.conf');
  writeFileSync(conf, priorConfig.replaceAll(priorMarketing, current).replaceAll(priorPortal, portal));
  const trace = join(work, 'host-command-trace');
  const bashEnv = join(work, 'stand-ins.sh');
  writeFileSync(bashEnv, `
nginx() {
  case "$1" in
    -T) cat "$QA_PRIOR_CONF" ;;
    -t) printf 'nginx-test\\n' >> "$QA_TRACE" ;;
    *) return 90 ;;
  esac
}
systemctl() { printf 'reload-stand-in\\n' >> "$QA_TRACE"; }
curl() { printf 200; } # synthetic health response; no network request
`);
  const run = (target, gate) => spawnSync('bash', [join(repo, 'scripts/deploy-v5-public.sh'), 'rollback', target], {
    encoding: 'utf8',
    env: { ...process.env, BASH_ENV: bashEnv, APP_DIR: previous, WEB_ROOT: web,
      RELEASES_DIR: join(web, 'releases'), CURRENT_LINK: current, BUILD_ROOT: join(work, 'build'),
      V5_PORTAL_ROOT: portal, PRECHECK: gate, QA_PRIOR_CONF: conf, QA_TRACE: trace,
      HEALTH_URL: 'https://example.invalid/scratch-health-stand-in' },
  });
  const currentGate = join(repo, 'scripts/precheck-v5-routes.mjs');
  const refused = run(oldName, currentGate);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout, /missing:.*\/news/);
  assert.equal(readlinkSync(current), newRelease);
  console.log('PASS current contract refuses the pre-news export before symlink activation');
  const matched = run(oldName, join(previous, 'scripts/precheck-v5-routes.mjs'));
  assert.equal(matched.status, 0, matched.stdout + matched.stderr);
  assert.equal(readlinkSync(current), oldRelease);
  console.log('PASS pinned previous contract + paired config permits explicit stored-release rollback in scratch');
  const retained = run(newName, currentGate);
  assert.equal(retained.status, 0, retained.stdout + retained.stderr);
  assert.equal(readlinkSync(current), newRelease);
  assert.equal(readFileSync(trace, 'utf8'), 'nginx-test\nreload-stand-in\nnginx-test\nreload-stand-in\n');
  console.log('PASS prior static routing accepts the current export, preserving its legal/address/auth bytes');
  console.log('Only scratch symlinks changed; nginx/reload/HTTP health were stand-ins, not production evidence.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
