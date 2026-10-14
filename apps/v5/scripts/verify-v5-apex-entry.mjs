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
 *     --portal-artifact /path/to/flowsmartly-v5/apps/portal/.production-artefact
 *
 * It reads only the two built exports and the reviewed V5 apex config. It does
 * not contact a host, read credentials, mutate nginx, or deploy anything.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';

const opts = {};
const marketingOnly = process.argv.includes('--marketing-only');
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (key === '--marketing-only') continue;
  if (!['--source-repo', '--source-sha', '--portal-manifest', '--nginx', '--marketing-export', '--portal-artifact'].includes(key) || !process.argv[i + 1]) {
    console.error('usage: verify-v5-apex-entry.mjs [--marketing-only] --source-repo <repo> --source-sha <40-hex-sha> --nginx <config> --marketing-export <dist> [--portal-manifest <manifest> --portal-artifact <apps/portal/.production-artefact>]');
    process.exit(2);
  }
  opts[key] = process.argv[++i];
}
const required = ['--source-repo', '--source-sha', '--nginx', '--marketing-export'];
if (!marketingOnly) required.push('--portal-manifest', '--portal-artifact');
for (const key of required) {
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
const portalManifestPath = opts['--portal-manifest'] ? resolve(opts['--portal-manifest']) : '';
const nginxPath = resolve(opts['--nginx']);
const marketingRoot = resolve(opts['--marketing-export']);
const portalRoot = opts['--portal-artifact'] ? resolve(opts['--portal-artifact']) : '';
const requiredPaths = [sourceRepo, nginxPath, marketingRoot, ...(marketingOnly ? [] : [portalManifestPath, portalRoot])];
if (!requiredPaths.every(existsSync)) {
  for (const [label, path] of [
    ['marketing source repo', sourceRepo],
    ['nginx config', nginxPath],
    ['marketing export', marketingRoot],
    ...(marketingOnly ? [] : [['V5 portal release manifest', portalManifestPath], ['V5 portal production artefact', portalRoot]]),
  ]) {
    if (!existsSync(path)) fail(`${label} is missing: ${path}`);
  }
  process.exit(1);
}

if (!/^[0-9a-f]{40}$/u.test(expectedSourceSha)) fail('--source-sha must be the full 40-character marketing source commit');
let actualSourceSha = '';
let sourceChanges = '';
try {
  actualSourceSha = execFileSync('git', ['-C', sourceRepo, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
  sourceChanges = execFileSync('git', ['-C', sourceRepo, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim();
} catch (error) {
  fail(`cannot read marketing source git identity: ${String(error)}`);
}
if (actualSourceSha !== expectedSourceSha) fail(`marketing source HEAD ${actualSourceSha} differs from expected ${expectedSourceSha}`);
else pass(`marketing source HEAD is ${actualSourceSha}`);
if (sourceChanges) fail('marketing source checkout has tracked or untracked changes; build provenance is ambiguous');
else pass('marketing source checkout is clean, including untracked files');

if (!marketingOnly) {
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
  if (portalManifest?.artifacts?.measured_from_clean_worktree !== true) fail('V5 portal artifact was not measured from a clean worktree');
  if (!marketingOnly && portalRoot.split(sep).slice(-3).join('/') !== 'apps/portal/.production-artefact') fail('portal artifact path must be the V5 builder output apps/portal/.production-artefact');
}

// Resolve a generated static route as nginx's `$uri $uri.html $uri/index.html` does.
function staticRoute(root, pathname) {
  const route = pathname.replace(/^\/+/, '');
  for (const path of [join(root, route), join(root, `${route}.html`), join(root, route, 'index.html')]) {
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const rawConfig = readFileSync(nginxPath, 'utf8');
const uncommentedConfig = rawConfig.replace(/(^|\n)\s*#.*(?=\n|$)/gu, '$1');
function serverBlocks(text) {
  const blocks = [];
  const starts = /\bserver\s*\{/gu;
  for (const match of text.matchAll(starts)) {
    const open = match.index + match[0].lastIndexOf('{');
    let depth = 0;
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(text.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return blocks;
}
const namedApexBlocks = serverBlocks(uncommentedConfig).filter((block) =>
  [...block.matchAll(/\bserver_name\s+([^;]+);/gu)].some((match) =>
    match[1].trim().split(/\s+/u).includes('flowsmartly.com'),
  ),
);
const httpBlocks = namedApexBlocks.filter((block) =>
  [...block.matchAll(/^\s*listen\s+([^;]+);/gmu)].some((match) =>
    /^(?:\[::\]:)?80(?:\s|$)/u.test(match[1].trim()) && !/\bssl\b/u.test(match[1]),
  ),
);
const httpsBlocks = namedApexBlocks.filter((block) =>
  [...block.matchAll(/^\s*listen\s+([^;]+);/gmu)].some((match) =>
    /^(?:\[::\]:)?443(?:\s|$)/u.test(match[1].trim()) && /\bssl\b/u.test(match[1]),
  ),
);
if (httpBlocks.length !== 1) fail(`expected one HTTP redirect block naming flowsmartly.com, found ${httpBlocks.length}`);
if (httpsBlocks.length !== 1) fail(`expected one canonical HTTPS block naming flowsmartly.com on port 443 with SSL, found ${httpsBlocks.length}`);
const httpBlock = httpBlocks.length === 1 ? httpBlocks[0] : '';
const activeConfig = httpsBlocks.length === 1 ? httpsBlocks[0] : '';
if (httpBlock && !/location\s+\/\s*\{[\s\S]*?return\s+301\s+https:\/\/flowsmartly\.com\$request_uri\s*;/u.test(httpBlock)) {
  fail('the HTTP flowsmartly.com block does not redirect apex requests to canonical HTTPS');
}
if (activeConfig && /^\s*return\b/mu.test(activeConfig)) {
  fail('the canonical HTTPS block has a server-level return that bypasses route handling');
}

if (/\bproxy_pass\b|\bv4_app\b|legacy\.flowsmartly\.com/iu.test(activeConfig)) {
  fail('active V5 apex config contains a proxy or legacy V4 host/upstream');
} else {
  pass('active config contains no V4 proxy/upstream or legacy host');
}

function blockBody(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

function locationRecords(config) {
  const records = [];
  const starts = /\blocation\s+(?:(=|~\*|~|\^~)\s+)?([^\s{]+)\s*\{/gu;
  for (const match of config.matchAll(starts)) {
    const open = match.index + match[0].lastIndexOf('{');
    const body = blockBody(config, open);
    if (body === null) continue;
    records.push({ modifier: match[1] ?? '', pattern: match[2], start: match.index, body });
  }
  return records;
}

function topLevelDirectives(block) {
  const top = [];
  let depth = 0;
  for (const line of block.split('\n')) {
    if (depth === 0) top.push(line);
    for (const char of line) {
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }
  }
  return top.join('\n');
}

function locationMatches(record, path) {
  if (record.modifier === '=') return record.pattern === path;
  if (record.modifier === '' || record.modifier === '^~') return path.startsWith(record.pattern);
  if (record.modifier === '~' || record.modifier === '~*') {
    try {
      return new RegExp(record.pattern, record.modifier === '~*' ? 'i' : '').test(path);
    } catch {
      return null;
    }
  }
  return false;
}

const locations = locationRecords(activeConfig);
const AUTH_PATTERN = '^/(accept-invitation|activity|approvals|auth|connections|flowagent|forgot|home|listsmartly|login|onboarding|register|reset|verify)(/|$)';
const MARKETING_PATTERN = '^/(product|pricing|early-access|flow-ai|solutions|platform|resources|company|legal|education)(/|$)';
const portalMatches = locations.filter((record) => record.modifier === '~' && record.pattern === AUTH_PATTERN);
const marketingMatches = locations.filter((record) => record.modifier === '~' && record.pattern === MARKETING_PATTERN);
const portalRecord = portalMatches.length === 1 ? portalMatches[0] : null;
const marketingRecord = marketingMatches.length === 1 ? marketingMatches[0] : null;

function checkEffectiveRoute(path, expectedRecord, label) {
  if (!expectedRecord) {
    fail(label + ' has no unique expected regex location in the flowsmartly.com server');
    return;
  }
  for (const record of locations) {
    if (record === expectedRecord) continue;
    const matches = locationMatches(record, path);
    if (matches === null) {
      fail(label + ' cannot safely parse competing nginx location pattern ' + record.pattern);
      continue;
    }
    if (!matches) continue;
    if (record.modifier === '=' || record.modifier === '^~' ||
        (record.modifier === '' && record.pattern !== '/') ||
        record.modifier === '~' || record.modifier === '~*') {
      fail((label + ' is shadowed by competing nginx location ' + record.modifier + ' ' + record.pattern).trim());
    }
  }
  if (!locationMatches(expectedRecord, path)) fail(label + ' does not match its pinned V5 location');
}

for (const route of ['/login', '/register']) checkEffectiveRoute(route, portalRecord, route);
checkEffectiveRoute('/early-access', marketingRecord, '/early-access');

function hasExpectedRoot(block, inheritedRoot, expectedRoot) {
  const roots = [...block.matchAll(/^\s*root\s+([^;]+);/gmu)].map((match) => match[1].trim());
  const aliases = [...block.matchAll(/^\s*alias\s+([^;]+);/gmu)];
  if (aliases.length > 0 || roots.length > 1) return false;
  const effective = roots.length === 1 ? roots[0] : inheritedRoot;
  return effective === expectedRoot;
}

const serverTop = topLevelDirectives(activeConfig);
const serverRoots = [...serverTop.matchAll(/^\s*root\s+([^;]+);/gmu)].map((match) => match[1].trim());
const marketingRoot = serverRoots.length === 1 ? serverRoots[0] : '';
if (marketingRoot !== '/var/www/flowsmartly-v5/current') {
  fail('canonical HTTPS server does not have exactly one V5 marketing default root');
} else {
  pass('canonical HTTPS server default root is the V5 marketing export');
}

if (!portalRecord || !hasExpectedRoot(portalRecord.body, '', '/var/www/flowagent-portal/current')) {
  fail('/login and /register no longer resolve through the V5 portal root');
} else if (/^\s*(?:rewrite|return|alias)\b/mu.test(portalRecord.body) ||
    !/^\s*try_files\s+\$uri\s+\$uri\.html\s+\$uri\/index\.html\s+=404\s*;/mu.test(portalRecord.body)) {
  fail('portal auth location has a redirect, alias, rewrite, or changed static lookup');
} else {
  pass('/login and /register resolve through the effective V5 portal auth location');
}

if (!marketingRecord || !hasExpectedRoot(marketingRecord.body, marketingRoot, '/var/www/flowsmartly-v5/current')) {
  fail('/early-access does not resolve through the effective V5 marketing root');
} else if (/^\s*(?:rewrite|return|alias)\b/mu.test(marketingRecord.body) ||
    !/^\s*try_files\s+\$uri\s+\$uri\.html\s+\$uri\/index\.html\s+=404\s*;/mu.test(marketingRecord.body)) {
  fail('/early-access location has a redirect, alias, rewrite, or changed static lookup');
} else {
  pass('/early-access resolves through the effective V5 marketing root and static lookup');
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
  // Byte-for-byte port of digestOf() in flowsmartly-v5/scripts/release-verify.mjs:
  // sorted file paths, NUL separators, and file bytes; no modes or directory records.
  const hash = createHash('sha256');
  let files = 0;
  let bytes = 0;
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const path = join(directory, entry.name);
      const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path, name);
      } else if (entry.isFile()) {
        const content = readFileSync(path);
        hash.update(name).update('\0').update(content).update('\0');
        files += 1;
        bytes += statSync(path).size;
      }
    }
  };
  walk(root, '');
  return { files, bytes, digest: `sha256:${hash.digest('hex')}` };
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
