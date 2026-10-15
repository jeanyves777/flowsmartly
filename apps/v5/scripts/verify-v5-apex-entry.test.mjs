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
const V5_APEX_CONFIG_GIT_BLOB = '6896ea6336e692be3743396a3d21b33e4b4e51ed';
const APEX = `server {
  listen 80;
  listen [::]:80;
  server_name flowsmartly.com www.flowsmartly.com;
  location / {
    return 301 https://flowsmartly.com$request_uri;
  }
}
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name flowsmartly.com;
  root /var/www/flowsmartly-v5/current;
  location ~ ^/(accept-invitation|activity|approvals|auth|connections|flowagent|forgot|home|listsmartly|login|onboarding|register|reset|verify)(/|$) {
    root /var/www/flowagent-portal/current;
    try_files $uri $uri.html $uri/index.html =404;
  }
  location ~ ^/(product|pricing|early-access|flow-ai|solutions|platform|resources|company|legal|education)(/|$) {
    try_files $uri $uri.html $uri/index.html =404;
  }
}
server {
  listen 443 ssl;
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
        hash.update(name).update('\0').update(readFileSync(full)).update('\0');
      }
    }
  };
  walk(root);
  return `sha256:${hash.digest('hex')}`;
}

function fixture({ digest = PORTAL_DIGEST, clean = true, wrongHost = false, untracked = false, nginxText = null } = {}) {
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

  const configText = nginxText ?? (wrongHost
    ? APEX.replace('server_name flowsmartly.com;\n  root', 'server_name marketing.example;\n  root') +
      '\nserver { listen 443 ssl; server_name flowsmartly.com; }\n'
    : APEX);
  const nginx = put(root, 'nginx-apex-v5.conf', configText);
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

test('script rejects exact, prefix, ^~, and competing regex auth overrides', () => {
  const overrides = [
    '  location = /login { root /var/www/flowsmartly-v5/current; }\n',
    '  location /register { root /var/www/flowsmartly-v5/current; }\n',
    '  location ^~ /login { root /var/www/flowsmartly-v5/current; }\n',
    '  location ~ ^/login$ { root /var/www/flowsmartly-v5/current; }\n',
    '  location ~ "^/login$" { root /var/www/flowsmartly-v5/current; }\n',
    '  location "/register" { root /var/www/flowsmartly-v5/current; }\n',
  ];
  for (const override of overrides) {
    const config = APEX.replace('  location ~ ^/(accept-invitation', override + '  location ~ ^/(accept-invitation');
    const result = run(fixture({ nginxText: config }));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /shadowed by competing nginx location/u);
  }
});

function editMarketingBlock(edit) {
  const start = APEX.indexOf('  location ~ ^/(product');
  const end = APEX.indexOf('\n  }', start) + 4;
  assert.ok(start >= 0 && end > start);
  const block = APEX.slice(start, end);
  return APEX.slice(0, start) + edit(block) + APEX.slice(end);
}

test('script rejects early-access exact shadowing, alias, wrong root, and rewrite', () => {
  function editMarketingBlock(edit) {
    const start = APEX.indexOf('  location ~ ^/(product');
    const end = APEX.indexOf('\n  }', start) + 4;
    assert.ok(start >= 0 && end > start);
    const block = APEX.slice(start, end);
    return APEX.slice(0, start) + edit(block) + APEX.slice(end);
  }
  const variants = [
    APEX.replace('  location ~ ^/(product', '  location = /early-access { alias /tmp/not-marketing; }\n  location ~ ^/(product'),
    editMarketingBlock((block) => block.replace('    try_files', '    alias /tmp/not-marketing;\n    try_files')),
    editMarketingBlock((block) => block.replace('    try_files', '    root /tmp/not-marketing;\n    try_files')),
    editMarketingBlock((block) => block.replace('    try_files', '    rewrite ^ /register permanent;\n    try_files')),
  ];
  const expected = [
    /shadowed by competing nginx location/u,
    /early-access does not resolve through the effective V5 marketing root/u,
    /early-access does not resolve through the effective V5 marketing root/u,
    /early-access location has a redirect, alias, rewrite/u,
  ];
  for (let i = 0; i < variants.length; i += 1) {
    const result = run(fixture({ nginxText: variants[i] }));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, expected[i]);
  }
});
test('script selects the canonical HTTPS block beside the HTTP redirect block', () => {
  const result = run(fixture());
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /canonical HTTPS server default root/u);
});
test('pinned V5 nginx fixture matches the authoritative source blob and routes', () => {
  const path = new URL('./fixtures/nginx-apex-v5.conf', import.meta.url);
  const bytes = readFileSync(path);
  const blobSha = createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
  assert.equal(blobSha, V5_APEX_CONFIG_GIT_BLOB, 'refresh requires reviewed upstream blob SHA');

  const result = run(fixture({ nginxText: bytes.toString('utf8') }));
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /canonical HTTPS server default root/u);
});

if (process.env.V5_APEX_CONFIG) {
  test('checked-in authoritative V5 apex config selects the expected routes', () => {
    const config = readFileSync(process.env.V5_APEX_CONFIG, 'utf8');
    const result = run(fixture({ nginxText: config }));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /canonical HTTPS server default root/u);
  });
}

if (process.env.V5_MARKETING_REPO && process.env.V5_MARKETING_EXPORT && process.env.V5_APEX_CONFIG) {
  test('CI emits a source-bound digest receipt for the built marketing export', () => {
    const source = process.env.V5_MARKETING_REPO;
    const sourceSha = execFileSync('git', ['-C', source, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
    const result = spawnSync(process.execPath, [SCRIPT.pathname,
      '--marketing-only',
      '--source-repo', source,
      '--source-sha', sourceSha,
      '--nginx', process.env.V5_APEX_CONFIG,
      '--marketing-export', process.env.V5_MARKETING_EXPORT,
    ], { encoding: 'utf8' });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    assert.match(output, new RegExp('"marketing_source_sha": "' + sourceSha + '"', 'u'));
    assert.match(output, /"marketing": \{[\s\S]*"digest": "sha256:[0-9a-f]{64}"/u);
    assert.match(output, /"verdict": "PASS_MARKETING_ONLY"/u);

    const receiptStart = output.lastIndexOf('\n{');
    assert.notEqual(receiptStart, -1, 'verifier emitted no JSON receipt');
    const receiptText = output.slice(receiptStart + 1).trim();
    const receipt = JSON.parse(receiptText);
    assert.equal(receipt.marketing_source_sha, sourceSha);
    assert.match(receipt.nginx_config_sha256, /^[0-9a-f]{64}$/u);
    assert.match(receipt.artifacts.marketing.digest, /^sha256:[0-9a-f]{64}$/u);
    if (process.env.V5_RECEIPT_OUT) {
      writeFileSync(process.env.V5_RECEIPT_OUT, JSON.stringify(receipt, null, 2) + '\n');
    }
  });
}
test('script rejects a portal digest mismatch', () => {
  const result = run(fixture({ digest: `sha256:${'0'.repeat(64)}` }));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /portal export digest .* differs from manifest/u);
});

test('script rejects stale V4 host references in exported CSS assets', () => {
  const input = fixture();
  put(input.marketing, 'assets/theme.css', 'body { background-image: url("https://legacy.flowsmartly.com/login"); }');
  const result = run(input);
  assert.equal(result.status, 1, result.output);
  assert.match(
    result.output,
    /marketing export contains a stale waitlist or V4-host reference: assets\\/theme\\.css/u,
  );
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
  const result = run(input);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /no longer resolve through the V5 portal root/u);
});
