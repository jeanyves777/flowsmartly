#!/usr/bin/env node
/**
 * Focused check: `precheck-v5-routes.mjs --public-static` passes the apex as it is served today,
 * and fails, for the stated reason, on each way that ownership can be wrong.
 *
 * The fixtures are `nginx -T`-shaped dumps written here, with invented roots: the publish script
 * feeds the gate the real `nginx -T` output on the host, and no host value belongs in this repo.
 * The ALLOW fixture has the shape the gate must accept: several apex-named server blocks, one of which
 * listens on 443, no include inside it, /login and /register in a regex location rooted at the
 * portal (with /flowagent, the portal's FlowAgent app), /early-access in a regex location of the
 * marketing export, and /_expo/ as measured (#184 6240257505): `^~ /_expo/` under the portal root,
 * `try_files $uri @marketing_assets`, that named location under the marketing root as `$uri =404`.
 * It also carries a quoted
 * brace and a commented brace, so the parser has to tell structure from text.
 *
 * Usage: node scripts/qa-precheck-public-static.mjs --dist apps/v5/dist
 * Exit 0 only when every arm behaves as stated.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'precheck-v5-routes.mjs');
const i = process.argv.indexOf('--dist');
const DIST = resolve(i > 0 ? process.argv[i + 1] : join(HERE, '..', 'apps', 'v5', 'dist'));

const MKT = '/srv/example/marketing/current';
const PORTAL = '/srv/example/portal/current';
const TF = 'try_files $uri $uri.html $uri/index.html =404;';

const ALLOW = `# configuration file /etc/nginx/nginx.conf:
user www-data;
events { worker_connections 768; }
http {
    log_format edge escape=json '{"t":"$time_iso8601","u":"$request_uri"}';
    include /etc/nginx/mime.types;
    include /etc/nginx/sites-enabled/*;
}

# configuration file /etc/nginx/mime.types:
types { text/html html; application/javascript js; }

# configuration file /etc/nginx/sites-enabled/apex:
server {
    listen 80;
    server_name flowsmartly.com www.flowsmartly.com;
    return 301 https://flowsmartly.com$request_uri;
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name flowsmartly.com;
    ssl_certificate /etc/ssl/example.pem; # a brace in a comment: {
    root ${MKT};
    #PORTAL_LOCATION
    location ~ ^/(login|register|flowagent)/?$ {
        root ${PORTAL};
        ${TF}
    }
    #EARLY_ACCESS_LOCATION
    location ~ ^/early-access/?$ {
        ${TF}
    }
    location ^~ /_expo/ { root ${PORTAL}; try_files $uri @marketing_assets; }
    location @marketing_assets {
        root ${MKT};
        try_files $uri =404;
    }
    location = /flow-ai { return 301 /flowagent; }
    location / {
        ${TF}
    }
    #SERVER_EXTRA
}
server {
    listen 127.0.0.1:8081;
    server_name flowsmartly.com;
    location / { return 404; }
}
`;

const PORTAL_LOC = /location ~ \^\/\(login\|register\|flowagent\)\/\?\$ \{[\s\S]*?\n {4}\}/;
const NAMED_LOC = /location @marketing_assets \{[\s\S]*?\n {4}\}/;
const EXPO_LOC = `location ^~ /_expo/ { root ${PORTAL}; try_files $uri @marketing_assets; }`;
const EARLY_LOC = /location ~ \^\/early-access\/\?\$ \{[\s\S]*?\n {4}\}/;
const MAIN_SERVER = /server \{\n {4}listen 443[\s\S]*?#SERVER_EXTRA\n\}/;

const work = mkdtempSync(join(tmpdir(), 'precheck-public-static-'));
let n = 0;
const gate = (dump, extra = {}) => {
  const conf = join(work, `dump-${(n += 1)}.conf`);
  writeFileSync(conf, dump);
  const args = [GATE, '--public-static', '--json', '--dist', extra.dist ?? DIST, '--conf', conf,
    '--marketing-root', MKT, '--portal-root', PORTAL, ...(extra.args ?? [])].filter((a) => a !== null);
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  let details = [];
  try {
    details = JSON.parse(r.stdout).results.filter((x) => !x.ok);
  } catch {
    /* refusals print no JSON */
  }
  return { status: r.status, failed: details.map((x) => x.name), details, stderr: r.stderr };
};

const results = [];
const arm = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
// `why`, when given, must match that check's detail: the reason, not only the check that failed.
const denies = (name, dump, mustFail, why) => {
  const r = gate(dump);
  const hit = r.details.find((f) => mustFail.test(f.name) && (!why || why.test(f.detail)));
  arm(`DENY ${name}`, r.status === 1 && Boolean(hit),
    `exit ${r.status}; ${hit && why ? `${hit.name} — ${hit.detail}` : `failed: ${r.failed.join(' | ') || r.stderr.trim()}`}`);
};
const CHAIN = /^\/_expo\/\* is looked up under the portal root, then the marketing root/;

try {
  const ok = gate(ALLOW);
  arm('ALLOW the current apex shape passes', ok.status === 0 && ok.failed.length === 0,
    `exit ${ok.status}${ok.failed.length ? `; failed: ${ok.failed.join(' | ')}` : ''}`);

  denies('/login proxied somewhere', ALLOW.replace(PORTAL_LOC, 'location ~ ^/(login|register|flowagent)/?$ { proxy_pass http://127.0.0.1:9999; }'),
    /^\/login is served by the V5 portal/);
  denies('/register funnelled to /early-access (the cutover-era rule)',
    ALLOW.replace('#PORTAL_LOCATION', 'location = /register { return 302 /early-access; }'), /^\/register is served by the V5 portal/);
  denies('/login and /register served by this export', ALLOW.replace(`root ${PORTAL};`, ''), /^\/login is served by the V5 portal/);
  denies('/early-access proxied to an old app', ALLOW.replace(EARLY_LOC, 'location ~ ^/early-access/?$ { proxy_pass http://v4_app; }'),
    /^\/early-access is served from the marketing root/);
  denies('marketing served from a fixed release, not the flipped link',
    ALLOW.replace(`root ${MKT};`, 'root /srv/example/marketing/releases/20260101T000000Z-1a2b3c4d;'), /^\/ is served from the marketing root/);
  denies('a section claimed by nothing static', ALLOW.replace('#SERVER_EXTRA', 'location ^~ /solutions/ { return 404; }'),
    /^\/solutions\/\* is served from the marketing root/);
  denies('/flowagent served by this export', ALLOW.replace('(login|register|flowagent)/?$ {', '(login|register)/?$ {'),
    /^\/flowagent is served by the V5 portal/);
  // The measured asset chain (#184 6240257505 / 6240292328): portal first, then this export.
  // Wrong root at either step, the marketing lookup lost, an unexpected chain, a hidden proxy.
  denies('/_expo/ first lookup under the marketing root (order reversed)',
    ALLOW.replace(EXPO_LOC, `location ^~ /_expo/ { root ${MKT}; try_files $uri @marketing_assets; }`),
    CHAIN, /starts at marketing root, not the portal root/);
  denies('/_expo/ fallback rooted at the portal, not the marketing export',
    ALLOW.replace(NAMED_LOC, `location @marketing_assets {\n        root ${PORTAL};\n        try_files $uri =404;\n    }`),
    CHAIN, /@marketing_assets is rooted at portal root, not the marketing root/);
  denies('/_expo/ marketing lookup replaced by return 404', ALLOW.replace(NAMED_LOC, 'location @marketing_assets { return 404; }'),
    CHAIN, /marketing lookup is lost: @marketing_assets is return 404/);
  denies('/_expo/ with no marketing lookup at all',
    ALLOW.replace(EXPO_LOC, `location ^~ /_expo/ { root ${PORTAL}; try_files $uri =404; }`),
    CHAIN, /marketing lookup is lost: portal root with no named fallback/);
  denies('/_expo/ falls back to another named location',
    ALLOW.replace(EXPO_LOC, `location ^~ /_expo/ { root ${PORTAL}; try_files $uri @elsewhere; }\n    location @elsewhere { root ${MKT}; try_files $uri =404; }`),
    CHAIN, /try_files is not "\$uri @marketing_assets"/);
  denies('/_expo/ fallback hides a proxy', ALLOW.replace(NAMED_LOC, 'location @marketing_assets { proxy_pass http://127.0.0.1:9999; }'),
    CHAIN, /@marketing_assets is proxy/);
  denies('/_expo/ fallback named but missing', ALLOW.replace(NAMED_LOC, ''), CHAIN, /does not exist/);
  denies('a marketing route may not use the asset fallback',
    ALLOW.replace('location ~ ^/early-access/?$ {\n        try_files $uri $uri.html $uri/index.html =404;', 'location ~ ^/early-access/?$ {\n        try_files $uri $uri.html @marketing_assets;'),
    /^\/early-access is served from the marketing root/, /^named fallback$/);
  denies('two apex servers on 443', ALLOW.replace(MAIN_SERVER, (m) => `${m}\n${m}`), /^exactly one apex server block listens on 443/);
  denies('an include inside the apex 443 server', ALLOW.replace('#SERVER_EXTRA', 'include /etc/nginx/snippets/more.conf;'),
    /^the apex 443 server has no include/);
  denies('a server-level if the emulation cannot see through',
    ALLOW.replace('#SERVER_EXTRA', 'if ($http_x_probe) { return 403; }'), /^nothing at server level/);
  denies('unbalanced braces', ALLOW.replace('location / {', 'location / { {'), /^loaded config parses/);

  const empty = mkdtempSync(join(work, 'empty-dist-'));
  const ex = gate(ALLOW, { dist: empty });
  arm('DENY the export half still runs (empty dist)', ex.status === 1 && ex.failed.some((f) => /^every expected route resolves/.test(f)),
    `exit ${ex.status}; failed: ${ex.failed.slice(0, 2).join(' | ')}`);

  for (const [name, extra] of [
    ['--skip-conf', ['--skip-conf']],
    ['--skip-export', ['--skip-export']],
  ]) {
    const r = gate(ALLOW, { args: extra });
    arm(`REFUSE --public-static with ${name}`, r.status === 2 && /skips neither/.test(r.stderr), `exit ${r.status}`);
  }
  {
    const r = spawnSync(process.execPath, [GATE, '--public-static', '--dist', DIST, '--marketing-root', MKT, '--portal-root', PORTAL], { encoding: 'utf8' });
    arm('REFUSE --public-static without --conf (no repo fallback)', r.status === 2 && /never falls back/.test(r.stderr), `exit ${r.status}`);
  }
  {
    const conf = join(work, 'allow.conf');
    writeFileSync(conf, ALLOW);
    const r = spawnSync(process.execPath, [GATE, '--public-static', '--dist', DIST, '--conf', conf, '--marketing-root', MKT], { encoding: 'utf8' });
    arm('REFUSE --public-static without --portal-root', r.status === 2 && /--portal-root/.test(r.stderr), `exit ${r.status}`);
  }
  {
    const r = gate(ALLOW);
    const leaked = JSON.stringify(r).includes(PORTAL) || JSON.stringify(r).includes(MKT);
    const all = spawnSync(process.execPath, [GATE, '--public-static', '--dist', DIST, '--conf', join(work, 'allow.conf'),
      '--marketing-root', MKT, '--portal-root', PORTAL], { encoding: 'utf8' });
    arm('the roots are never printed', !leaked && !all.stdout.includes(PORTAL) && !all.stdout.includes(MKT), '');
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} arms behaved as stated`);
process.exit(failed === 0 ? 0 : 1);
