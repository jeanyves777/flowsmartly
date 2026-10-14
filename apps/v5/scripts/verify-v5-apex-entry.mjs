#!/usr/bin/env node
/**
 * Non-deploying V5 marketing/auth route contract check.
 *
 * Usage:
 *   node apps/v5/scripts/verify-v5-apex-entry.mjs \
 *     --source-repo /path/to/flowsmartly --source-sha <40-hex-sha> \
 *     --portal-manifest /path/to/RELEASE-MANIFEST.json \
 *     --nginx /path/to/flowsmartly-v5/deploy/nginx-apex-v5.conf \
 *     --marketing-export apps/v5/dist \
 *     --portal-export /path/to/flowsmartly-v5/apps/portal/dist
 *
 * It reads only the two built exports and the reviewed V5 apex config. It does
 * not contact a host, read credentials, mutate nginx, or deploy anything.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';

const opts = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!['--source-repo', '--source-sha', '--portal-manifest', '--nginx', '--marketing-export', '--portal-export'].includes(key) || !process.argv[i + 1]) {
    console.error('usage: verify-v5-apex-entry.mjs --source-repo <repo> --source-sha <sha> --portal-manifest <manifest> --nginx <config> --marketing-export <dist> --portal-export <dist>');
    process.exit(2);
  }
  opts[key] = process.argv[++i];
}
for (const key of ['--source-repo', '--source-sha', '--portal-manifest', '--nginx', '--marketing-export', '--portal-export']) {
  if (!opts[key]) {
    console.error(`missing ${key}`);
    process.exit(2);
  }
}

const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`PASS ${message}`);
const sourceRepo = resolve(opts['--source-repo']);
const expectedSourceSha = opts['--source-sha'];
const portalManifestPath = resolve(opts['--portal-manifest']);
const nginxPath = resolve(opts['--nginx']);
const marketingRoot = resolve(opts['--marketing-export']);
const portalRoot = resolve(opts['--portal-export']);
if (![sourceRepo, portalManifestPath, nginxPath, marketingRoot, portalRoot].every(existsSync)) {
  for (const [label, path] of [['marketing source repo', sourceRepo], ['V5 portal release manifest', portalManifestPath], ['nginx config', nginxPath], ['marketing export', marketingRoot], ['portal export', portalRoot]]) {
    if (!existsSync(path)) fail(`${label} is missing: ${path}`);
  }
  process.exit(1);
}

if (!/^[0-9a-f]{40}$/u.test(expectedSourceSha)) fail('--source-sha must be the full 40-character marketing source commit');
let actualSourceSha = '';
let sourceChanges = '';
try {
  actualSourceSha = execFileSync('git', ['-C', sourceRepo, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
  sourceChanges = execFileSync('git', ['-C', sourceRepo, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
} catch (error) {
  fail(`cannot read marketing source git identity: ${String(error)}`);
}
if (actualSourceSha !== expectedSourceSha) fail(`marketing source HEAD ${actualSourceSha} differs from expected ${expectedSourceSha}`);
else pass(`marketing source HEAD is ${actualSourceSha}`);
if (sourceChanges) fail('marketing source checkout has tracked modifications; build provenance is ambiguous');
else pass('marketing source checkout has no tracked modifications');

let portalManifest;
try {
  portalManifest = JSON.parse(readFileSync(portalManifestPath, 'utf8'));
} catch (error) {
  fail(`cannot read V5 portal release manifest: ${String(error)}`);
}
const portalSourceSha = portalManifest?.source?.sha;
if (!/^[0-9a-f]{40}$/u.test(portalSourceSha ?? '')) fail('V5 portal manifest does not name a full source.sha');
else pass(`V5 portal manifest names source SHA ${portalSourceSha}`);
const portalManifestDigest = portalManifest?.artifacts?.portal_artifact_digest;
if (!/^sha256:[0-9a-f]{64}$/u.test(portalManifestDigest ?? '')) fail('V5 portal manifest does not name a full portal_artifact_digest');
if (portalManifest?.artifacts?.measured_at_sha !== portalSourceSha) fail('V5 portal artifact measurement is not stamped at manifest source.sha');

// Resolve a generated static route as nginx's `$uri $uri.html $uri/index.html` does.
function staticRoute(root, pathname) {
  const route = pathname.replace(/^\/+/, '');
  for (const path of [join(root, route), join(root, `${route}.html`), join(root, route, 'index.html')]) {
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const rawConfig = readFileSync(nginxPath, 'utf8');
const activeConfig = rawConfig.replace(/(^|\n)\s*#.*(?=\n|$)/gu, '$1');
if (/\bproxy_pass\b|\bv4_app\b|legacy\.flowsmartly\.com/iu.test(activeConfig)) {
  fail('active V5 apex config contains a proxy or legacy V4 host/upstream');
} else {
  pass('active config contains no V4 proxy/upstream or legacy host');
}

function findLocation(expression) {
  const start = activeConfig.indexOf(expression);
  if (start < 0) return null;
  const open = activeConfig.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < activeConfig.length; i += 1) {
    if (activeConfig[i] === '{') depth += 1;
    if (activeConfig[i] === '}' && --depth === 0) return activeConfig.slice(open + 1, i);
  }
  return null;
}

if (!/\broot\s+\/var\/www\/flowsmartly-v5\/current\s*;/u.test(activeConfig)) {
  fail('V5 apex default root is not the V5 marketing export root');
} else {
  pass('V5 apex default root is the V5 marketing export');
}

const portalBlock = findLocation('location ~ ^/(accept-invitation|activity|approvals|auth|connections|flowagent|forgot|home|listsmartly|login|onboarding|register|reset|verify)(/|$)');
const marketingBlock = findLocation('location ~ ^/(product|pricing|early-access|flow-ai|solutions|platform|resources|company|legal|education)(/|$)');
if (!portalBlock || !/\broot\s+\/var\/www\/flowagent-portal\/current\s*;/u.test(portalBlock)) {
  fail('/login and /register no longer resolve to the V5 portal root in the apex config');
} else if (!/\btry_files\s+\$uri\s+\$uri\.html\s+\$uri\/index\.html\s+=404\s*;/u.test(portalBlock)) {
  fail('portal auth route no longer uses the expected static file lookup');
} else {
  pass('/login and /register resolve through the portal auth location and static lookup');
}
if (!marketingBlock || /\broot\s+\/var\/www\/flowagent-portal\/current\s*;/u.test(marketingBlock)) {
  fail('/early-access no longer resolves through the V5 marketing route location');
} else {
  pass('/early-access resolves through the V5 marketing route location');
}

const destinationsPath = join(sourceRepo, 'apps/v5/src/lib/destinations.ts');
const destinations = existsSync(destinationsPath) ? readFileSync(destinationsPath, 'utf8') : '';
if (!/goToLogin\(\):\s*void\s*\{\s*openV5Auth\('\/login'\)/u.test(destinations)) fail('marketing source does not map goToLogin to /login');
else pass('goToLogin maps to /login');
if (!/goToRegister\(\):\s*void\s*\{\s*openV5Auth\('\/register'\)/u.test(destinations)) fail('marketing source does not map goToRegister to /register');
else pass('goToRegister maps to /register');
if (/legacy\.flowsmartly\.com|LEGACY\s*=/iu.test(destinations)) fail('account destinations retain a V4 legacy authority');

const loginRoute = join(sourceRepo, 'apps/v5/src/app/login.tsx');
const earlyAccessRoute = join(sourceRepo, 'apps/v5/src/app/early-access.tsx');
if (!existsSync(loginRoute) || !/goToLogin\(\)/u.test(readFileSync(loginRoute, 'utf8'))) fail('marketing /login compatibility route does not forward to goToLogin');
else pass('marketing /login compatibility route forwards to V5 login');
if (!existsSync(earlyAccessRoute) || !/goToRegister\(\)/u.test(readFileSync(earlyAccessRoute, 'utf8'))) fail('marketing /early-access compatibility route does not forward to V5 registration');
else pass('marketing /early-access compatibility route forwards to V5 registration');

const sourceRoot = join(sourceRepo, 'apps/v5/src');
let accountCtaFiles = 0;
function checkCtaSource(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkCtaSource(path);
    else if (entry.isFile() && /\.(?:tsx|jsx)$/iu.test(entry.name)) {
      const source = readFileSync(path, 'utf8');
      if (/label\s*=\s*['"]Create account['"]/u.test(source)) {
        accountCtaFiles += 1;
        if (!/goToRegister/u.test(source)) fail(`Create account CTA lacks the V5 registration helper: ${relative(sourceRoot, path)}`);
      }
    }
  }
}
checkCtaSource(sourceRoot);
if (accountCtaFiles === 0) fail('no Create account CTA source was found');
else pass(`${accountCtaFiles} source file(s) with Create account CTAs reference goToRegister`);

for (const [root, route, label] of [
  [portalRoot, '/login', 'portal /login'],
  [portalRoot, '/register', 'portal /register'],
  [marketingRoot, '/early-access', 'marketing compatibility /early-access'],
]) {
  const path = staticRoute(root, route);
  if (!path) fail(`${label} has no exported static file under ${root}`);
  else pass(`${label} resolves to ${relative(root, path).split(sep).join('/')}`);
}

function treeDigest(root) {
  // Same flowsmartly.release-digest/3 format used by the V5 release manifest.
  const u32 = (value) => { const out = Buffer.alloc(4); out.writeUInt32BE(value); return out; };
  const u64 = (value) => { const out = Buffer.alloc(8); out.writeBigUInt64BE(BigInt(value)); return out; };
  const field = (value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    return Buffer.concat([u64(bytes.length), bytes]);
  };
  const hash = createHash('sha256').update(field('flowsmartly.release-digest/3'));
  let files = 0;
  let bytesTotal = 0;
  const record = (type, name, mode) => hash.update(Buffer.from(type, 'latin1')).update(field(name)).update(u32(mode & 0o7777));
  const visit = (directory, prefix) => {
    for (const entry of readdirSync(directory).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)) {
      const path = join(directory, entry);
      const info = lstatSync(path);
      const name = prefix ? `${prefix}/${entry}` : entry;
      if (info.isSymbolicLink()) throw new Error(`artifact contains a link: ${name}`);
      if (info.isDirectory()) {
        record('D', name, info.mode);
        visit(path, name);
      } else if (info.isFile()) {
        const content = readFileSync(path);
        record('F', name, info.mode).update(u64(content.length)).update(createHash('sha256').update(content).digest());
        files += 1;
        bytesTotal += content.length;
      } else {
        throw new Error(`unsupported artifact entry: ${name}`);
      }
    }
  };
  const rootInfo = lstatSync(root);
  if (!rootInfo.isDirectory()) throw new Error(`artifact is not a directory: ${root}`);
  record('D', '.', rootInfo.mode);
  visit(root, '');
  return { files, bytes: bytesTotal, digest: `sha256:${hash.digest('hex')}` };
}

const forbidden = /join(?: v5)? early access|legacy\.flowsmartly\.com/iu;
const artifactSummary = {};
for (const [root, label] of [[marketingRoot, 'marketing'], [portalRoot, 'portal']]) {
  for (const file of (() => {
    const found = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile() && /\.(?:html|js|json)$/iu.test(entry.name)) found.push(path);
      }
    };
    walk(root);
    return found;
  })()) {
    if (forbidden.test(readFileSync(file, 'utf8'))) fail(`${label} export contains a stale waitlist or V4-host reference: ${relative(root, file)}`);
  }
  const digest = treeDigest(root);
  artifactSummary[label] = digest;
  pass(`${label} artifact tree: ${digest.files} files, ${digest.bytes} bytes, ${digest.digest}`);
  if (label === 'portal' && digest.digest !== portalManifestDigest) fail(`portal export digest ${digest.digest} differs from manifest ${portalManifestDigest}`);
}

if (process.exitCode) {
  console.error('V5 apex entry check refused; no files or services were changed.');
} else {
  console.log(JSON.stringify({
    format: 'flowsmartly.v5-public-entry-proof/1',
    marketing_source_sha: actualSourceSha,
    portal_source_sha: portalSourceSha,
    nginx_config_sha256: createHash('sha256').update(readFileSync(nginxPath)).digest('hex'),
    artifacts: artifactSummary,
    verdict: 'PASS_LOCAL_ONLY',
    scope: 'read-only offline verification; no host was contacted and no deployment was performed',
  }, null, 2));
}
