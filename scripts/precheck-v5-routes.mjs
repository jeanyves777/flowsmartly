#!/usr/bin/env node
/**
 * precheck-v5-routes.mjs — the cutover's route gate.
 *
 *   node scripts/precheck-v5-routes.mjs [--dist <dir>] [--conf <file>]
 *                                       [--skip-export] [--skip-conf] [--json]
 *
 * Two artifacts have to agree before flowsmartly.com can be flipped to V5: the
 * export on disk, and the Nginx config that serves it. Either one can be
 * perfectly valid on its own while the pair is broken — a route that exports
 * but is claimed by no `location` 404s, and a `location` for a route the export
 * dropped 404s just as hard. This gate checks the pair.
 *
 * WHY IT DOES NOT JUST GREP THE CONFIG
 * ------------------------------------
 * A grep for "reset-password" passes on a config that redirects it to the wrong
 * host, drops the query string, or has the rule shadowed by an earlier regex.
 * So the config is parsed into location blocks and nginx's own resolution order
 * is emulated (exact -> ^~ prefix -> regex in source order -> longest prefix).
 * Every assertion below is then "this URL resolves to this behaviour", which is
 * the thing that actually matters, and it fails when the property is removed
 * rather than when a word is removed.
 *
 * WHY IT DOES NOT JUST WALK dist/
 * -------------------------------
 * `expo export` exits 0 having silently dropped a route. So the expected route
 * set is derived from sources the export cannot influence: the route files
 * under apps/v5/src/app, the blog index JSON, and the contract routes named in
 * deploy/ROUTE-OWNERSHIP.md. dist/ is the thing under test, never the source of
 * the expectation.
 *
 * THE CURRENT PUBLIC-STATIC OWNERSHIP (--public-static)
 * -----------------------------------------------------
 *   node scripts/precheck-v5-routes.mjs --public-static --dist <dir>
 *        --conf <`nginx -T` output> --marketing-root <dir> --portal-root <dir>
 *
 * The default mode checks deploy/nginx-flowsmartly-v5.conf, the cutover-era
 * config: /register funnelled to /early-access, a V4 upstream behind the apex.
 * That is no longer what serves flowsmartly.com. Today the apex serves this
 * export as static files from the `current` link, and /login, /register and
 * /flowagent (the FlowAgent app, behind sign-in) as static files of the V5
 * portal, from the portal's own root. The export still has a /flowagent page,
 * reached only by in-app navigation. This mode checks
 * exactly that, against the configuration Nginx loaded, and is what the publish
 * script runs for deploy and rollback alike:
 *   - the export half is unchanged and always runs;
 *   - exactly one apex server block listens on 443, with no include inside it
 *     and nothing at server level (return, rewrite, if) that this emulation
 *     would not see — otherwise the view would be a guess, so it fails;
 *   - every route of this export resolves, in that server, to a static location
 *     whose root is the marketing root, i.e. the link the publish flips; a
 *     try_files that ends in a named location (/_expo/, shared with the portal)
 *     counts when its own root is the marketing root and the named location is
 *     itself static or a 4xx — a fallback that proxies does not;
 *   - /login, /register and /flowagent resolve to a static location whose root
 *     is the portal root — not this export, not a proxy, not a redirect.
 * The roots are operator values, passed at run time and never printed, so no
 * host path of the portal is written into this repository. No skip flag is
 * accepted in this mode, and there is no fallback to the repo config.
 *
 * Exit code is 0 only if every check passes.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ */
/* args                                                                */
/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DIST = resolve(REPO, opt('--dist', join('apps', 'v5', 'dist')));
const CONF = resolve(REPO, opt('--conf', join('deploy', 'nginx-flowsmartly-v5.conf')));
const APP_SRC = join(REPO, 'apps', 'v5', 'src', 'app');
const POST_INDEX = join(REPO, 'apps', 'v5', 'src', 'content', 'posts.index.json');
const CHECKLIST = join(REPO, 'deploy', 'CUTOVER-CHECKLIST.md');
const UPSTREAM_CONF = join(REPO, 'deploy', 'nginx-upstream-v4.conf');
const DEPLOY_DIR = join(REPO, 'deploy');

const SKIP_EXPORT = flag('--skip-export');
const SKIP_CONF = flag('--skip-conf');
const AS_JSON = flag('--json');
const PUBLIC_STATIC = flag('--public-static');
const MARKETING_ROOT = opt('--marketing-root', '');
const PORTAL_ROOT = opt('--portal-root', '');

if (SKIP_EXPORT && SKIP_CONF) {
  console.error('precheck: --skip-export and --skip-conf together check nothing');
  process.exit(2);
}
if (PUBLIC_STATIC) {
  const refuse = (why) => {
    console.error(`precheck: --public-static ${why}`);
    process.exit(2);
  };
  if (SKIP_EXPORT || SKIP_CONF) refuse('checks the export and the served config together; it skips neither');
  if (!opt('--conf', '')) refuse('needs --conf <the `nginx -T` output>; it never falls back to the repo config');
  if (!MARKETING_ROOT || !PORTAL_ROOT) refuse('needs --marketing-root and --portal-root, the roots the apex serves');
}

/* ------------------------------------------------------------------ */
/* results                                                             */
/* ------------------------------------------------------------------ */

const results = [];
let failures = 0;

function check(group, name, ok, detail) {
  results.push({ group, name, ok: Boolean(ok), detail: detail ?? '' });
  if (!ok) failures += 1;
}

/* ------------------------------------------------------------------ */
/* the contract                                                        */
/* ------------------------------------------------------------------ */

/**
 * Routes the cutover contract names explicitly (deploy/ROUTE-OWNERSHIP.md).
 * Hardcoded on purpose: they are the promise, not an observation, so they must
 * not be derived from anything that can drift with the code.
 */
const CONTRACT_ROUTES = [
  '/',
  '/product',
  '/pricing',
  '/flowagent',
  '/flow-ai',
  '/login',
  '/early-access',
];

/** Sections that must each resolve at least one page. */
const CONTRACT_SECTIONS = [
  '/solutions',
  '/platform',
  '/resources',
  '/company',
  '/legal',
  '/education',
];

/** Single files served from the export root. */
const CONTRACT_FILES = ['robots.txt', 'sitemap.xml', 'llms.txt', 'ai.txt', 'feed.xml'];

/** Directories the export must contain. */
const CONTRACT_DIRS = ['_expo', 'assets'];

/* ------------------------------------------------------------------ */
/* expected routes, derived from sources the export cannot influence   */
/* ------------------------------------------------------------------ */

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/** Route files under apps/v5/src/app -> the URLs expo-router publishes. */
function routesFromSource() {
  if (!existsSync(APP_SRC)) return null;
  const routes = new Set();
  for (const rel of walk(APP_SRC)) {
    if (!rel.endsWith('.tsx')) continue;
    const name = rel.slice(0, -'.tsx'.length);
    const leaf = name.split('/').pop();
    // Layouts render nothing of their own; +not-found is the 404 target and is
    // served internally, never as a URL; dynamic segments are expanded from
    // their own data source below.
    if (leaf === '_layout' || leaf.startsWith('+')) continue;
    if (name.includes('[')) continue;
    routes.add(name === 'index' ? '/' : `/${name.replace(/\/index$/, '')}`);
  }
  return [...routes].sort();
}

/** Blog slugs, from the same index generateStaticParams() reads. */
function routesFromBlogIndex() {
  if (!existsSync(POST_INDEX)) return [];
  const raw = JSON.parse(readFileSync(POST_INDEX, 'utf8'));
  const posts = Array.isArray(raw) ? raw : (raw.posts ?? []);
  return posts.filter((p) => p && p.slug).map((p) => `/resources/blog/${p.slug}`);
}

/* ------------------------------------------------------------------ */
/* export resolution — the same candidate order as try_files           */
/* ------------------------------------------------------------------ */

/**
 * `try_files $uri $uri.html $uri/index.html`, and the identical order in
 * scripts/qa-serve.mjs. Kept in one function so the deploy, local QA and this
 * gate can never disagree about what "the route resolves" means.
 */
function resolveInDist(route) {
  const rel = route === '/' ? 'index.html' : route.slice(1);
  const candidates =
    route === '/'
      ? [join(DIST, 'index.html')]
      : [join(DIST, rel), `${join(DIST, rel)}.html`, join(DIST, rel, 'index.html')];
  for (const candidate of candidates) {
    try {
      const st = statSync(candidate);
      if (st.isFile() && st.size > 0) return candidate;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

function expectedRoutes() {
  const source = routesFromSource();
  const blog = routesFromBlogIndex();
  return { source, blog, expected: new Set([...CONTRACT_ROUTES, ...(source ?? []), ...blog]) };
}

function checkExport() {
  if (!existsSync(DIST)) {
    check('export', 'dist exists', false, `${DIST} not found — run \`npm run build:web\` in apps/v5`);
    return;
  }
  check('export', 'dist exists', true, DIST);

  const { source, blog, expected } = expectedRoutes();

  const missing = [];
  for (const route of [...expected].sort()) {
    if (!resolveInDist(route)) missing.push(route);
  }
  check(
    'export',
    `every expected route resolves (${expected.size} routes)`,
    missing.length === 0,
    missing.length
      ? `missing: ${missing.join(' ')}`
      : `contract ${CONTRACT_ROUTES.length}, source ${source ? source.length : 0}, blog ${blog.length}`,
  );

  // Without this the check above is vacuous on a checkout where the route files
  // moved: an empty expectation set passes trivially.
  check(
    'export',
    'the expectation came from source, not from dist',
    source !== null && source.length > 0,
    source === null ? `${APP_SRC} not found — the route check would have been vacuous` : `${source.length} route files`,
  );

  check('export', 'blog posts are enumerated', blog.length > 0, `${blog.length} slugs in posts.index.json`);

  for (const section of CONTRACT_SECTIONS) {
    const pages = [...expected].filter((r) => r === section || r.startsWith(`${section}/`));
    const resolved = pages.filter((r) => resolveInDist(r));
    check('export', `section ${section}/* has pages`, resolved.length > 0, `${resolved.length}/${pages.length} resolve`);
  }

  for (const file of CONTRACT_FILES) {
    let ok = false;
    try {
      const st = statSync(join(DIST, file));
      ok = st.isFile() && st.size > 0;
    } catch {
      ok = false;
    }
    check('export', `/${file}`, ok, ok ? '' : 'missing or empty');
  }

  for (const dir of CONTRACT_DIRS) {
    let ok = false;
    try {
      ok = statSync(join(DIST, dir)).isDirectory();
    } catch {
      ok = false;
    }
    check('export', `/${dir}/`, ok, ok ? '' : 'missing');
  }

  // /flow-ai is a redirect stub, not a page. Assert it points somewhere, so a
  // rename cannot strand it as a blank page that still passes an existence test.
  const stub = join(DIST, 'flow-ai', 'index.html');
  const stubOk = existsSync(stub) && readFileSync(stub, 'utf8').includes('/flowagent');
  check('export', '/flow-ai stub redirects to /flowagent', stubOk, stubOk ? '' : 'stub missing or does not name /flowagent');

  // An unexpanded dynamic template shipped as a real file is a page with full
  // site chrome and no content, reachable at a URL. apps/v5/scripts/agent-assets.js
  // removes these; if one survives, the export is wrong.
  const orphans = walk(DIST).filter((r) => r.endsWith('.html') && r.includes('['));
  check('export', 'no unexpanded [param] templates in dist', orphans.length === 0, orphans.join(' '));

  const pages = walk(DIST).filter((r) => r.endsWith('.html')).length;
  check('export', 'page count is plausible (>= 40)', pages >= 40, `${pages} HTML pages`);
}

/* ------------------------------------------------------------------ */
/* nginx config — parsed, then resolved the way nginx resolves         */
/* ------------------------------------------------------------------ */

/** Parse `location <spec> { <body> }` blocks, nesting-aware, comments stripped. */
function parseLocations(text) {
  const src = text
    .split(/\r?\n/)
    .map((line) => (/^\s*#/.test(line) ? '' : line))
    .join('\n');

  const out = [];
  const re = /\blocation\s+([^{]+?)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1].trim();
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    const body = src.slice(re.lastIndex, i - 1);

    let modifier = '';
    let pattern = spec;
    const parts = spec.split(/\s+/);
    if (['=', '~', '~*', '^~'].includes(parts[0])) {
      modifier = parts[0];
      pattern = parts.slice(1).join(' ');
    }
    pattern = pattern.replace(/^"|"$/g, '');
    out.push({ modifier, pattern, body, order: out.length });
  }
  return out;
}

/**
 * nginx's selection algorithm: an exact `=` match wins outright; otherwise the
 * longest matching prefix is remembered, and if that prefix was declared `^~`
 * the regexes are skipped; otherwise regexes are tried in source order and the
 * first match wins; only if none matches does the remembered prefix apply.
 */
function selectLocation(locations, path) {
  for (const loc of locations) {
    if (loc.modifier === '=' && loc.pattern === path) return loc;
  }

  let prefix = null;
  for (const loc of locations) {
    if (loc.modifier === '=' || loc.modifier.startsWith('~')) continue;
    if (loc.pattern.startsWith('@')) continue;
    if (path.startsWith(loc.pattern)) {
      if (!prefix || loc.pattern.length > prefix.pattern.length) prefix = loc;
    }
  }
  if (prefix && prefix.modifier === '^~') return prefix;

  for (const loc of locations) {
    if (!loc.modifier.startsWith('~')) continue;
    let re;
    try {
      re = new RegExp(loc.pattern, loc.modifier === '~*' ? 'i' : '');
    } catch {
      continue;
    }
    if (re.test(path)) return loc;
  }

  return prefix;
}

const RETURN_RE = /\breturn\s+(\d{3})\s*([^;]*);/;
const PROXY_RE = /\bproxy_pass\s+([^;]+);/;

function behaviourOf(loc) {
  if (!loc) return { kind: 'none' };
  const ret = RETURN_RE.exec(loc.body);
  if (ret) return { kind: 'return', status: Number(ret[1]), target: ret[2].trim(), loc };
  const proxy = PROXY_RE.exec(loc.body);
  if (proxy) return { kind: 'proxy', upstream: proxy[1].trim(), loc };
  if (/\btry_files\b/.test(loc.body)) return { kind: 'static', loc };
  return { kind: 'other', loc };
}

function checkConf() {
  if (!existsSync(CONF)) {
    check('nginx', 'config exists', false, `${CONF} not found`);
    return;
  }
  const text = readFileSync(CONF, 'utf8');
  const locations = parseLocations(text);
  check('nginx', 'config parses into location blocks', locations.length > 5, `${locations.length} blocks`);

  const at = (path) => behaviourOf(selectLocation(locations, path));

  /* -- 1. the V5 routes are actually claimed --------------------------- */
  for (const route of CONTRACT_ROUTES) {
    const b = at(route);
    // /flow-ai is claimed as a redirect to /flowagent, which is still a claim.
    const ok = b.kind === 'static' || (b.kind === 'return' && b.status >= 300 && b.status < 400);
    check('nginx', `${route} is claimed by a V5 rule`, ok, `${b.kind}${b.status ? ` ${b.status}` : ''}`);
  }
  for (const section of CONTRACT_SECTIONS) {
    const b = at(`${section}/anything`);
    check('nginx', `${section}/* is claimed`, b.kind === 'static', b.kind);
  }
  for (const file of CONTRACT_FILES) {
    const b = at(`/${file}`);
    check('nginx', `/${file} is claimed`, b.kind === 'static', b.kind);
  }
  const expo = at('/_expo/static/js/web/entry-abc123.js');
  check('nginx', '/_expo/* is claimed', expo.kind === 'static', expo.kind);

  /* -- 2. the clean-URL trap is closed --------------------------------- */
  // Serving /flowagent.html renders expo-router's not-found page with a 200
  // status. See section 0 of the config and the header of scripts/qa-serve.mjs.
  for (const bad of ['/flowagent.html', '/product.html', '/solutions/flowshop.html', '/index.html']) {
    const b = at(bad);
    const ok = b.kind === 'return' && b.status === 301;
    check('nginx', `${bad} is redirected, never served`, ok, ok ? `301 ${b.target}` : `${b.kind} ${b.status ?? ''}`);
  }
  const clean = at('/flowagent.html');
  check(
    'nginx',
    'the .html redirect targets the clean URL',
    clean.kind === 'return' && !/\.html/.test(clean.target ?? ''),
    clean.target ?? '',
  );
  // ...and it must not touch the customer-published V4 namespaces.
  for (const keep of ['/sites/acme/index.html', '/store/widget.html']) {
    const b = at(keep);
    check('nginx', `${keep} is left alone (customer-published URL)`, b.kind === 'proxy', b.kind);
  }

  /* -- 3. V4 callbacks, webhooks and cron survive on the apex ---------- */
  for (const path of [
    '/api/social/facebook/callback',
    '/api/webhooks/stripe',
    '/api/cron/subscriptions',
    '/api/twilio/sms',
  ]) {
    const b = at(path);
    check('nginx', `${path} still reaches V4`, b.kind === 'proxy', `${b.kind} ${b.upstream ?? ''}`);
  }

  /* -- 4. the V5 API namespace and the leads bridge -------------------- */
  const v1 = at('/api/v1/something');
  check('nginx', '/api/v1/* is a distinct namespace', v1.kind === 'proxy', v1.kind);

  const leads = at('/api/v1/leads');
  check('nginx', 'POST /api/v1/leads has an explicit rule', leads.kind === 'proxy', leads.kind);
  check(
    'nginx',
    '/api/v1/leads is matched exactly, not by the /api/ catch-all',
    Boolean(leads.loc) && leads.loc.modifier === '=' && leads.loc.pattern === '/api/v1/leads',
    leads.loc ? `${leads.loc.modifier} ${leads.loc.pattern}` : 'no match',
  );
  check(
    'nginx',
    'the leads bridge is marked TEMPORARY',
    /TEMPORARY BRIDGE[\s\S]{0,1600}\/api\/v1\/leads/.test(text),
    'a bridge nobody knows is a bridge never gets removed',
  );
  check(
    'nginx',
    'the leads rule does not rewrite the path to a legacy endpoint',
    Boolean(leads.loc) && !/\brewrite\b/.test(leads.loc.body),
    'a rewrite here would put the V4 path back into the V5 contract',
  );

  /* -- 5. query-preserving redirects to the legacy host ---------------- */
  // A dropped token is a customer locked out of their own account.
  for (const path of ['/reset-password', '/verify-email', '/forgot-password', '/teams/invite/abc123']) {
    const b = at(path);
    const ok =
      b.kind === 'return' &&
      b.status === 301 &&
      /legacy\.flowsmartly\.com/.test(b.target ?? '') &&
      /\$request_uri/.test(b.target ?? '');
    check(
      'nginx',
      `${path} -> legacy host with the query preserved`,
      ok,
      ok ? b.target : `${b.kind} ${b.status ?? ''} ${b.target ?? ''}`,
    );
  }

  /* -- 6. registration funnels into early access ----------------------- */
  for (const path of ['/register', '/signup', '/get-started']) {
    const b = at(path);
    const ok = b.kind === 'return' && b.status >= 300 && b.status < 400 && /\/early-access/.test(b.target ?? '');
    check('nginx', `${path} -> /early-access`, ok, ok ? `${b.status} ${b.target}` : `${b.kind} ${b.status ?? ''}`);
  }

  /* -- 7. nothing falls through to V4 by accident ---------------------- */
  const unowned = at('/nonsense-route-that-should-not-exist');
  check(
    'nginx',
    'an unclaimed path 404s instead of reaching V4',
    unowned.kind === 'return' && unowned.status === 404,
    `${unowned.kind} ${unowned.status ?? ''}`,
  );

  /* -- 8. the legacy host must survive a rollback of the apex ---------- */
  // `upstream v4_app` and the limit_req zones live in their own file, included
  // from http{}. If they migrate back into the apex vhost, then disabling that
  // vhost — which is exactly what rollback lever 2 does — leaves the LEGACY
  // vhost referencing an undefined upstream. `nginx -t` fails, the reload is
  // refused, and the legacy host goes down during the rollback. That host is
  // the only way an existing customer reaches their workspace at that moment.
  check(
    'nginx',
    'the apex vhost does not declare the shared V4 upstream',
    !/^\s*upstream\s+v4_app\s*\{/m.test(text),
    'it belongs in deploy/nginx-upstream-v4.conf so a rollback cannot take the legacy host with it',
  );
  if (existsSync(UPSTREAM_CONF)) {
    const up = readFileSync(UPSTREAM_CONF, 'utf8');
    check(
      'nginx',
      'the shared upstream file declares v4_app and both rate-limit zones',
      /^\s*upstream\s+v4_app\s*\{/m.test(up) &&
        /zone=v5_api:/.test(up) &&
        /zone=v5_leads:/.test(up),
      'every zone referenced by a limit_req in the vhost must be declared in http{}',
    );
  } else {
    check('nginx', 'deploy/nginx-upstream-v4.conf exists', false, 'the vhosts reference an upstream nothing declares');
  }

  // Anti-vacuity for the pair above: every zone the vhost uses must actually
  // be declared somewhere, or `nginx -t` fails at install time.
  {
    const used = [...text.matchAll(/limit_req\s+zone=([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const declaredIn = existsSync(UPSTREAM_CONF) ? readFileSync(UPSTREAM_CONF, 'utf8') : '';
    const undeclared = [...new Set(used)].filter((z) => !new RegExp(`zone=${z}:`).test(declaredIn));
    check(
      'nginx',
      'every limit_req zone the vhost uses is declared',
      undeclared.length === 0,
      undeclared.length ? `undeclared: ${undeclared.join(' ')}` : `${new Set(used).size} zone(s)`,
    );
  }

  /* -- 8. the hard constraint, guarded in the durable record ----------- */
  if (existsSync(CHECKLIST)) {
    const md = readFileSync(CHECKLIST, 'utf8');
    check(
      'nginx',
      'the checklist still forbids repointing NEXT_PUBLIC_APP_URL',
      /Do not change\s+`?NEXT_PUBLIC_APP_URL/i.test(md),
      '26 files build OAuth redirect_uri values from it',
    );
  }

  /* -- 9. no deploy config may instruct repointing the app URL -------- */
  // This used to be `!/NEXT_PUBLIC_APP_URL/.test(text)` — a broad claim ("the
  // config does not move the variable") tested against a narrow subject: only
  // the single file passed via --conf, i.e. the apex vhost, which never had
  // the problem. The file that DID carry the forbidden instruction was
  // deploy/nginx-legacy-v4.conf, in its own Prerequisites block, and nothing
  // ever read it. Both vhosts proxy the SAME single V4 process, so there is
  // one value of the variable, not one per host; and the operator installing
  // the legacy vhost works from that file BEFORE reaching section 0 of the
  // checklist, so a stale prerequisite there is the instruction they hit first.
  //
  // So: scan every deliverable config in deploy/, plus whatever --conf points
  // at (on the VPS that is the installed vhost, outside deploy/).
  //
  // A config may still NAME the variable — deleting the mention outright loses
  // the knowledge that someone once believed repointing was required, and the
  // next person re-adds it — but only on a line that explicitly forbids the
  // change. A mention without a prohibition is a violation.
  {
    const FORBIDS = /\b(?:do not|don't|never|must not|cannot|no changes)\b/i;
    const scanned = [
      ...(existsSync(DEPLOY_DIR)
        ? readdirSync(DEPLOY_DIR)
            .filter((f) => f.endsWith('.conf'))
            .map((f) => join(DEPLOY_DIR, f))
        : []),
      CONF,
    ].filter((f, i, a) => existsSync(f) && a.indexOf(f) === i);
    const offenders = [];
    for (const file of scanned) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/APP_URL/.test(line) && !FORBIDS.test(line)) {
            offenders.push(`${relative(REPO, file).split(sep).join('/')}:${i + 1}`);
          }
        });
    }
    check(
      'nginx',
      'no deploy config instructs anyone to move NEXT_PUBLIC_APP_URL',
      offenders.length === 0,
      offenders.length
        ? `named without a prohibition at ${offenders.join(', ')} — the apex keeps proxying /api/* precisely so that variable never has to change`
        : `${scanned.length} config file(s) scanned`,
    );

    /* -- 10. the config must load on the nginx that is actually installed - */
    // FOUND BY RUNNING `nginx -t` ON THE BOX, WHICH IS THE ONLY WAY IT COULD BE.
    // The apex vhost carried `http2 on;` - the standalone directive form added
    // in nginx 1.25.1. The VPS runs 1.24.0, where http2 is a `listen` parameter
    // and the bare directive is FATAL:
    //     [emerg] unknown directive "http2" in nginx-flowsmartly-v5.conf:45
    // Not a warning and not a degraded feature - the vhost does not load at
    // all, so installing this config and reloading at cutover takes the apex
    // down. Every other rule in this file can be emulated offline; a directive
    // that does not exist in the deployed binary cannot, which is exactly why
    // the checklist requires `nginx -t` on the target and not just this gate.
    const http2Offenders = [];
    for (const file of scanned) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/^\s*http[23]\s+(?:on|off)\s*;/.test(line)) {
            http2Offenders.push(`${relative(REPO, file).split(sep).join('/')}:${i + 1}`);
          }
        });
    }
    check(
      'nginx',
      'no config uses the nginx 1.25+ standalone http2 directive',
      http2Offenders.length === 0,
      http2Offenders.length
        ? `fatal on the installed nginx 1.24 at ${http2Offenders.join(', ')} - write it as "listen 443 ssl http2;"`
        : `${scanned.length} config file(s) scanned - http2 belongs on the listen line`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* --public-static: the loaded config, parsed by its structure          */
/* ------------------------------------------------------------------ */

/**
 * Routes the V5 portal serves on the apex; this export must not own them.
 * /flowagent is the portal's FlowAgent app (a signed-out visitor is sent to sign
 * in): measured on the loaded config and on the public site, 2026-10-17.
 */
const PORTAL_ROUTES = ['/login', '/register', '/flowagent'];

/**
 * Two same-length views of the config: `clean` has comments blanked, `masked`
 * also blanks the inside of quoted strings, so braces and semicolons in either
 * cannot be mistaken for structure. As in nginx's own tokenizer, `#` starts a
 * comment and a quote starts a string only at the start of a token.
 */
function maskConfig(text) {
  const clean = text.split('');
  const masked = text.split('');
  let quote = null;
  let comment = false;
  let tokenStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (comment) {
      if (c === '\n') {
        comment = false;
        tokenStart = true;
      } else {
        clean[i] = ' ';
        masked[i] = ' ';
      }
      continue;
    }
    if (quote) {
      if (c === '\\' && i + 1 < text.length) {
        masked[i] = ' ';
        masked[i + 1] = ' ';
        i += 1;
      } else if (c === quote) {
        quote = null;
        tokenStart = false;
      } else if (c !== '\n') {
        masked[i] = ' ';
      }
      continue;
    }
    if (tokenStart && c === '#') {
      comment = true;
      clean[i] = ' ';
      masked[i] = ' ';
      continue;
    }
    if (tokenStart && (c === '"' || c === "'")) {
      quote = c;
      continue;
    }
    tokenStart = /\s/.test(c) || c === ';' || c === '{' || c === '}';
  }
  return { clean: clean.join(''), masked: masked.join('') };
}

function tokens(s) {
  return [...s.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

/** Directives and blocks directly inside [start, end): { name, args, block, start, end }. */
function children(view, start, end) {
  const { clean, masked } = view;
  const out = [];
  let s = start;
  let i = start;
  while (i < end) {
    const c = masked[i];
    if (c === ';') {
      const t = tokens(clean.slice(s, i));
      if (t.length) out.push({ name: t[0], args: t.slice(1), block: false });
      s = i + 1;
    } else if (c === '{') {
      const t = tokens(clean.slice(s, i));
      let depth = 1;
      let j = i + 1;
      while (j < end && depth > 0) {
        if (masked[j] === '{') depth += 1;
        else if (masked[j] === '}') depth -= 1;
        j += 1;
      }
      if (depth !== 0) throw new Error(`unbalanced braces after "${t[0] ?? ''}"`);
      out.push({ name: t[0] ?? '', args: t.slice(1), block: true, start: i + 1, end: j - 1 });
      i = j;
      s = j;
      continue;
    } else if (c === '}') {
      throw new Error('a closing brace with no block open');
    }
    i += 1;
  }
  return out;
}

/** Every http `server { }` block: at the top of a file (an included site) or inside http { }. */
function serverBlocks(view) {
  const out = [];
  const walk = (start, end, parent) => {
    for (const k of children(view, start, end)) {
      if (!k.block) continue;
      if (k.name === 'server' && (parent === '' || parent === 'http')) out.push(k);
      else if (k.name === 'http') walk(k.start, k.end, 'http');
    }
  };
  walk(0, view.masked.length, '');
  return out;
}

function containsDirective(view, block, name) {
  return children(view, block.start, block.end).some(
    (k) => k.name === name || (k.block && containsDirective(view, k, name)),
  );
}

/** The location blocks directly inside a server, in the shape selectLocation reads. */
function serverLocations(view, server) {
  return children(view, server.start, server.end)
    .filter((k) => k.block && k.name === 'location')
    .map((k, order) => {
      let [modifier, pattern] = ['', k.args[0] ?? ''];
      if (['=', '~', '~*', '^~'].includes(k.args[0])) [modifier, pattern] = [k.args[0], k.args[1] ?? ''];
      else {
        const glued = /^(\^~|~\*|~|=)(.+)$/.exec(pattern);
        if (glued) [modifier, pattern] = [glued[1], glued[2]];
      }
      return { modifier, pattern, order, start: k.start, end: k.end };
    });
}

/**
 * How a location answers. Only the shapes this emulation can see through count
 * as static: a nested block (if, location), an alias, a rewrite, a return or any
 * *_pass make it something else, and the checks below fail rather than guess.
 *
 * A try_files whose last argument names a location (`try_files $uri @other`)
 * serves from this location's root first and hands only the misses on. It is
 * static, with `fallback` describing the named location, only when that named
 * location exists and is itself static or a 4xx — one level deep, never a
 * proxy. Anything else is reported as what it is.
 */
function servingOf(view, loc, serverRoot, locations, depth = 0) {
  if (!loc) return { kind: 'none' };
  const kids = children(view, loc.start, loc.end);
  const d = (n) => kids.find((k) => !k.block && k.name === n);
  if (kids.some((k) => k.block)) return { kind: 'nested block' };
  if (d('return')) {
    const [status, target = ''] = d('return').args;
    return { kind: `return ${status ?? ''}`.trim(), status: Number(status), target };
  }
  if (kids.some((k) => /_pass$/.test(k.name))) return { kind: 'proxy' };
  if (d('alias')) return { kind: 'alias' };
  if (d('rewrite')) return { kind: 'rewrite' };
  let fallback;
  const tf = d('try_files');
  const last = tf?.args.at(-1) ?? '';
  if (last.startsWith('@')) {
    if (depth > 0) return { kind: 'named fallback chain' };
    if (tf.args.length < 2) return { kind: 'named fallback only' };
    const named = locations.find((l) => l.modifier === '' && l.pattern === last);
    if (!named) return { kind: 'named fallback missing' };
    fallback = servingOf(view, named, serverRoot, locations, depth + 1);
    const usable = fallback.kind === 'static' || (fallback.status >= 400 && fallback.status < 500);
    if (!usable) return { kind: `named fallback to ${fallback.kind}` };
  }
  const root = d('root')?.args[0] ?? serverRoot;
  if (!root) return { kind: 'no root' };
  return { kind: 'static', root: root.replace(/\/+$/, ''), ...(fallback ? { fallback } : {}) };
}

function checkConfPublicStatic() {
  if (!existsSync(CONF)) {
    check('nginx', 'loaded config exists', false, `${CONF} not found`);
    return;
  }
  let view;
  let servers;
  try {
    view = maskConfig(readFileSync(CONF, 'utf8'));
    servers = serverBlocks(view);
  } catch (e) {
    check('nginx', 'loaded config parses', false, e.message);
    return;
  }
  check('nginx', 'loaded config parses', servers.length > 0, `${servers.length} server block(s)`);

  const directives = (s, n) => children(view, s.start, s.end).filter((k) => !k.block && k.name === n);
  const apex = servers.filter((s) => directives(s, 'server_name').some((d) => d.args.includes('flowsmartly.com')));
  const apex443 = apex.filter((s) => directives(s, 'listen').some((d) => /(^|:)443$/.test(d.args[0] ?? '')));
  check('nginx', 'exactly one apex server block listens on 443', apex443.length === 1,
    `${apex443.length} of ${apex.length} apex-named server block(s)`);
  if (apex443.length !== 1) return;
  const server = apex443[0];

  check('nginx', 'the apex 443 server has no include inside it', !containsDirective(view, server, 'include'),
    'an included file could hold a location this view would not see');
  const top = children(view, server.start, server.end);
  const serverLevel = top.filter((k) => ['return', 'rewrite', 'if'].includes(k.name)).map((k) => k.name);
  check('nginx', 'nothing at server level runs before location matching', serverLevel.length === 0,
    serverLevel.length ? `server-level ${[...new Set(serverLevel)].join(', ')}` : '');

  const locations = serverLocations(view, server);
  check('nginx', 'the apex 443 server has location blocks', locations.length > 0, `${locations.length} location(s)`);
  const serverRoot = directives(server, 'root')[0]?.args[0];
  const at = (path) => servingOf(view, selectLocation(locations, path), serverRoot, locations);

  const norm = (p) => p.replace(/\/+$/, '');
  const marketing = norm(MARKETING_ROOT);
  const portal = norm(PORTAL_ROOT);
  check('nginx', 'the marketing root and the portal root are two different roots', marketing !== portal, '');

  // Root values are operator-side: a detail says which root, never prints it.
  const rootName = (b) => (b.root === marketing ? 'marketing root' : b.root === portal ? 'portal root' : 'static, another root');
  const whose = (b) =>
    b.kind !== 'static' ? b.kind : `${rootName(b)}${b.fallback ? `, misses fall to ${whose(b.fallback)}` : ''}`;
  const fromMarketing = (path) => {
    const b = at(path);
    return { ok: b.kind === 'static' && b.root === marketing, detail: whose(b) };
  };

  /* -- a. the marketing routes are this export, from the flipped link --- */
  for (const route of ['/', '/early-access']) {
    const r = fromMarketing(route);
    check('nginx', `${route} is served from the marketing root`, r.ok, r.detail);
  }
  // /flow-ai is a redirect stub in the export; the apex may serve it, or answer
  // with the same redirect itself. Either is a claim; anything else is not.
  {
    const b = at('/flow-ai');
    const ok =
      (b.kind === 'static' && b.root === marketing) ||
      (b.status >= 300 && b.status < 400 && /\/flowagent\b/.test(b.target ?? ''));
    check('nginx', "/flow-ai is the export's stub or a redirect to /flowagent", ok, whose(b));
  }
  const { expected } = expectedRoutes();
  const exportRoutes = [...expected].filter((r) => !PORTAL_ROUTES.includes(r) && r !== '/flow-ai').sort();
  const wrong = exportRoutes.map((r) => [r, fromMarketing(r)]).filter(([, r]) => !r.ok);
  check('nginx', `every route of this export is served from the marketing root (${exportRoutes.length} routes)`,
    exportRoutes.length > 0 && wrong.length === 0,
    wrong.length ? wrong.map(([route, r]) => `${route}: ${r.detail}`).join('; ') : '');
  for (const section of CONTRACT_SECTIONS) {
    const r = fromMarketing(`${section}/anything`);
    check('nginx', `${section}/* is served from the marketing root`, r.ok, r.detail);
  }
  for (const file of CONTRACT_FILES) {
    const r = fromMarketing(`/${file}`);
    check('nginx', `/${file} is served from the marketing root`, r.ok, r.detail);
  }
  const expo = fromMarketing('/_expo/static/js/web/entry-abc123.js');
  check('nginx', '/_expo/* is served from the marketing root', expo.ok, expo.detail);

  /* -- b. sign-in and account creation are the V5 portal's -------------- */
  for (const route of PORTAL_ROUTES) {
    const b = at(route);
    check('nginx', `${route} is served by the V5 portal, not by this export`,
      b.kind === 'static' && b.root === portal, whose(b));
  }
}

/* ------------------------------------------------------------------ */
/* run                                                                 */
/* ------------------------------------------------------------------ */

if (!SKIP_EXPORT) checkExport();
if (!SKIP_CONF) (PUBLIC_STATIC ? checkConfPublicStatic : checkConf)();

if (AS_JSON) {
  console.log(JSON.stringify({ dist: DIST, conf: CONF, failures, results }, null, 2));
} else {
  let group = '';
  for (const r of results) {
    if (r.group !== group) {
      group = r.group;
      console.log(`\n${group === 'export' ? `export  ${DIST}` : `nginx   ${CONF}`}`);
    }
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
  }
  console.log(
    `\n${failures === 0 ? 'PASS' : 'FAIL'}: ${results.length - failures}/${results.length} checks passed` +
      (failures ? ` — ${failures} failure(s)` : ''),
  );
}

process.exit(failures === 0 ? 0 : 1);
