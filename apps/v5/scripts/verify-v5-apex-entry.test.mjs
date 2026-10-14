import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, test } from 'node:test';

const SCRIPT = new URL('./verify-v5-apex-entry.mjs', import.meta.url);
const tempRoots = [];
const PORTAL_DIGEST = 'sha256:2886e31c96a62f88b356f6f7d29969dc1c13f1e7fe19e252a6c0d534baeb2e80';
const APEX = `server {
  listen 443 ssl;
  server_name flowsmartly.com;
  root /var/www/flowsmartly-v5/current;
  location ~ ^/(accept-invitation|activity|approvals|auth|connections|flowagent|forgot|home|listsmartly|login|onboarding|register|reset|verify)(/|$) {
    root /var/www/flowagent-portal/current;
    try_files $uri $uri.html $uri/index.html =404;
  }
  location ~ ^/(product|pricing|early-access|flow-ai|solutions|platform|resources|company|legal|education)(/|$) {
    root /var/www/flowsmartly-v5/current;
    try_files $uri $uri.html $uri/index.html =404;
  }
}
server {
  listen 80;
  server_name unrelated.example;
  proxy_pass http://historical;
}
`;

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function mkdirFor(path) {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
}

function put(root, path, text) {
  const full = join(root, path);
  mkdirFor(full);
  writeFileSync(full, text);
  return full;
}

// Independent fixture implementation of digestOf() in the authoritative
// flowsmartly-v5/scripts/release-verify.mjs.
function releaseVerifierDigest(root) {
  const hash = createHash('sha256');
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(dir, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, name);
      else if (entry.isFile()) {
        hash.update(name).update('\\0').update(readFileSync(full)).update('\\0');
      }
    }
  };
  walk(root);
  return `sha256:${hash.digest('hex')}`;
}

function fixture({ digest = PORTAL_DIGEST, clean = true, wrongHost = false, untracked = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'v5-apex-entry-'));
  tempRoots.push(root);
  const source = join(root, 'marketing-source');
  execFileSync('git', ['init', '--quiet', source]);
  execFileSync('git', ['-C', source, 'config', 'user.email', 'fixture@example.test']);
  execFileSync('git', ['-C', source, 'config', 'user.name', 'Fixture']);
  put(source, 'apps/v5/src/lib/destinations.ts', `
export function goToLogin(): void { openV5Auth('/login'); }
export function goToRegister(): void { openV5Auth('/register'); }
`);
  put(source, 'apps/v5/src/app/login.tsx', 'goToLogin();');
  put(source, 'apps/v5/src/app/early-access.tsx', 'goToRegister();');
  put(source, 'apps/v5/src/app/home.tsx', "label='Create account'; goToRegister();");
  execFileSync('git', ['-C', source, 'add', '-A']);
  execFileSync('git', ['-C', source, 'commit', '--quiet', '-m', 'fixture']);
  const sourceSha = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (untracked) put(source, 'apps/v5/src/untracked.tsx', 'untracked build input');

  const nginx = put(root, 'nginx-apex-v5.conf', wrongHost
    ? APEX.replace(/  location ~ \^\/(accept-invitation[\\s\\S]*?)\n  }\n  location ~ \^\/(product[\\s\\S]*?)\n  }/u, '')
    : APEX);
  const marketing = join(root, 'marketing-dist');
  put(marketing, 'early-access.html', '<html>register</html>');
  const portal = join(root, 'v5-release', 'apps', 'portal', '.production-artefact');
  put(portal, 'login.html', '<!doctype html>\nlogin\n');
  put(portal, 'register.html', 'register\n');
  const manifest = put(root, 'v5-release/.release/RELEASE-MANIFEST.json', JSON.stringify({
    source: { sha: sourceSha },
    artifacts: {
      portal_artifact_digest: digest,
      measured_at_sha: sourceSha,
      measured_from_clean_worktree: clean,
    },
  }));
  return { root, source, sourceSha, nginx, marketing, portal, manifest };
}

function run(input) {
  const result = spawnSync(process.execPath, [SCRIPT.pathname,
    '--source-repo', input.source,
    '--source-sha', input.sourceSha,
    '--portal-manifest', input.manifest,
    '--nginx', input.nginx,
    '--marketing-export', input.marketing,
    '--portal-artifact', input.portal,
  ], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test('release-verify digest fixture stays byte-for-byte pinned', () => {
  const input = fixture();
  assert.equal(releaseVerifierDigest(input.portal), PORTAL_DIGEST);
});

test('script accepts exact V5 production artefact, manifest, and apex routes', () => {
  const input = fixture();
  const result = run(input);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /PASS active config contains no V4 proxy/u);
  assert.match(result.output, /portal \/login resolves to login\.html/u);
  assert.match(result.output, /portal \/register resolves to register\.html/u);
  assert.match(result.output, /"verdict": "PASS_LOCAL_ONLY"/u);
});

test('script rejects a portal digest mismatch', () => {
  const result = run(fixture({ digest: `sha256:${'0'.repeat(64)}` }));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /portal export digest .* differs from manifest/u);
});

test('script rejects a manifest not measured from a clean worktree', () => {
  const result = run(fixture({ clean: false }));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /not measured from a clean worktree/u);
});

test('script rejects untracked marketing source files', () => {
  const result = run(fixture({ untracked: true }));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /tracked or untracked changes/u);
});

test('script rejects routes located only in another server block', () => {
  const input = fixture({ wrongHost: true });
  const config = readFileSync(input.nginx, 'utf8');
  writeFileSync(input.nginx, config.replace('server_name unrelated.example;', 'server_name flowsmartly.com;'));
  const result = run(input);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /portal root in the apex config/u);
});
