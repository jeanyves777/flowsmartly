# V5 public cutover — production checklist

Everything in the repo is prepared. This file is what a human executes, in
order. **Nothing in here has been run.**

Related: [`ROUTE-OWNERSHIP.md`](ROUTE-OWNERSHIP.md) ·
[`nginx-flowsmartly-v5.conf`](nginx-flowsmartly-v5.conf) ·
[`nginx-legacy-v4.conf`](nginx-legacy-v4.conf) ·
[`../scripts/deploy-v5-public.sh`](../scripts/deploy-v5-public.sh) ·
[`../scripts/precheck-v5-routes.mjs`](../scripts/precheck-v5-routes.mjs) ·
[`nginx-upstream-v4.conf`](nginx-upstream-v4.conf)

## The target box

| | |
| --- | --- |
| host | `flowsmartly.com` — `187.77.29.88`, root SSH |
| plan | Hostinger KVM 4 — 4 vCPU, 16 GB RAM, 200 GB disk |
| OS | **Ubuntu 24.04 LTS** — nginx under systemd, vhosts in `/etc/nginx/sites-available` |
| disk | 43 GB used of 200 GB — **157 GB free** |
| backups | **WEEKLY** automatic snapshots, 2 held |
| firewall | **0 rules configured** |
| DNS | Hostinger API/panel — the subdomain is ours to create |

Two consequences worth stating up front:

- **Disk is not a constraint.** An export is tens of MB against 157 GB free, so
  `KEEP_RELEASES=5` is about how far back you can flip without a rebuild, not
  about space. Never overwrite a release directory to save disk.
- **The automatic backup is not the cutover fallback.** It runs weekly, so the
  newest one can be up to **seven days stale**. Gate
  `PRE_CUTOVER_SNAPSHOT_GREEN` exists because of that.
- **The firewall has no rules**, so it is not currently constraining anything.
  The legacy vhost is a second `server_name` on the same ports 80/443 that are
  already serving. **No firewall change is needed for the second vhost** — do
  not add one "just in case" on cutover day.

---

## 0. The env-var decision — read this first

**Do not change `NEXT_PUBLIC_APP_URL`. Leave it at `https://flowsmartly.com`.**

The cutover instruction called for repointing it at the legacy host. The audit
says that would break production, and that it is unnecessary.

`NEXT_PUBLIC_APP_URL` is read in **87 files / 97 occurrences** and serves two
incompatible jobs:

| Use | Files | If repointed at legacy |
| --- | --- | --- |
| OAuth `redirect_uri` construction | **26** | **Breaks.** The URI would no longer match what is registered at Meta, Google, LinkedIn, Pinterest, TikTok, X, YouTube, Google Business, WhatsApp — every provider rejects a `redirect_uri` it does not have on file. Fixing it means re-registering all 26, several behind multi-day app review |
| Human links in email (verify, reset, invitations) | ~10 | Would work |

One variable cannot satisfy both. It does not have to:

- keeping it at `https://flowsmartly.com` keeps all 26 OAuth flows valid,
  because the apex still proxies `/api/*` to V4;
- the human links it builds — `/verify-email?token=`, `/reset-password?token=`,
  `/teams/invite/<token>` — all land on paths the apex **301s to
  `legacy.flowsmartly.com` with the full query string preserved**. They keep
  working, at the cost of one redirect hop.

So the exact env change list for this cutover is: **no changes.** Revisit only
when the apex stops proxying `/api/*` to V4.

`scripts/precheck-v5-routes.mjs` asserts that this section still says so, and
that no Nginx config in `deploy/` names the variable on a line that does not
forbid changing it. The earlier wording — "mentions it at all" — was both
wrong about the gate (it only ever inspected the single file passed to
`--conf`, the apex vhost, which never had the problem) and the wrong rule:
`deploy/nginx-legacy-v4.conf` deliberately keeps the original
"set it to the legacy host" instruction, inverted into a warning, so that the
reasoning behind the ban travels with the file an operator actually reads
first. The gate scans every `deploy/*.conf` plus whatever `--conf` points at,
and goes red if any of them names the variable without that prohibition.

---

## 1. The gates

The flip is authorised when every gate below is GREEN. Each names exactly how it
is proved and exactly what blocks the flip. A gate that cannot be *run* is not
green — it is unknown, and unknown blocks.

Gates 1–3 are ordered and slow to reverse. Run them days ahead, not on the day.

### `DNS_SUBDOMAIN_GREEN`

`legacy.flowsmartly.com` resolves to `187.77.29.88` from resolvers we do not
control.

**How it is proved**

```bash
dig +short legacy.flowsmartly.com @1.1.1.1
dig +short legacy.flowsmartly.com @8.8.8.8
# both must print 187.77.29.88
```

Checking with the local resolver is not proof — it may be answering from the
authoritative zone before the record has propagated anywhere else.

**What blocks the flip:** either resolver returning nothing, an old address, or
a CNAME chain that does not terminate at the VPS.

This is a separate gate from `NGINX_CONFIG_GREEN` on purpose. Its failure mode
is different (propagation, not syntax) and its reversal is far slower: a wrong
record can be cached by resolvers for the TTL regardless of how fast we correct
it. Set a **short TTL (300s) when creating the record** and raise it after
cutover, so a mistake costs minutes rather than a day.

> **HARD STOP — approval required at the point of execution.**
> Creating the subdomain and changing DNS is outward-facing and slow to reverse.
> We hold Hostinger API management for the zone, so this is our action to take
> and not an external dependency to wait on — but it is **not** pre-authorised
> by this document. Get the architect's explicit go-ahead immediately before
> making the change, and make it from the panel or API session that person
> approves. Nothing in this repo should ever perform it automatically, and no
> agent should go looking for Hostinger credentials to do it.

### `LEGACY_HOST_REACHABLE`

`https://legacy.flowsmartly.com` serves the V4 app over valid TLS **before the
apex changes at all**.

This is an action we perform, in this order. **The ordering is load-bearing: a
new subdomain serves nothing until it has a certificate**, and certbot cannot
issue one until DNS resolves to this box.

1. **Create the subdomain** in the Hostinger DNS zone: `A` record
   `legacy` → `187.77.29.88`, TTL 300. Add `AAAA` only if the box has a routable
   IPv6 address and the apex already publishes one — a published `AAAA` that
   does not answer is an outage for IPv6-first clients.
2. **Wait for propagation** — gate `DNS_SUBDOMAIN_GREEN` above must be green
   first. Certbot's HTTP-01 challenge resolves the name from Let's Encrypt's
   own resolvers, so "it works on the box" is not sufficient.
3. **Install the shared upstream first**, then the vhost so the challenge can
   be answered. Copy `deploy/nginx-upstream-v4.conf` to
   `/etc/nginx/conf.d/upstream-v4.conf` — without it `upstream v4_app` is
   undefined and `nginx -t` fails. Then copy
   `deploy/nginx-legacy-v4.conf` into `/etc/nginx/sites-available/`, symlink it
   into `sites-enabled/`, and comment out the `listen 443 ssl` server block for
   now — it references a certificate that does not exist yet and `nginx -t`
   will fail on it. Leave the port-80 block. `nginx -t && systemctl reload nginx`.
4. **Issue the certificate:** `certbot --nginx -d legacy.flowsmartly.com`.
5. **Restore the 443 block** with the certificate paths certbot created, then
   `nginx -t && systemctl reload nginx`.
6. **Confirm reachability** (below).

**How it is proved**

```bash
curl -sSI https://legacy.flowsmartly.com/login | head -1        # HTTP/2 200
curl -sS  https://legacy.flowsmartly.com/robots.txt              # Disallow: /
curl -sSI https://legacy.flowsmartly.com/ | grep -i x-robots-tag # noindex, nofollow
openssl s_client -connect legacy.flowsmartly.com:443 \
  -servername legacy.flowsmartly.com </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -subject
```

Then sign in, by hand, with a real account.

**What blocks the flip:** a TLS error, a certificate whose subject does not
cover the host, a 502, or a sign-in that fails.

**Why this gate is genuinely blocking and not a nicety:** the V5 export bakes
`https://legacy.flowsmartly.com/login` and `.../forgot-password` into the login
page at build time (`apps/v5/src/lib/destinations.ts`). Those are absolute URLs
in static HTML. If the legacy host is not serving valid TLS the moment the apex
flips, the only route an existing customer has back to their workspace is a
browser certificate warning.

### `PRE_CUTOVER_SNAPSHOT_GREEN`

A **manual** VPS snapshot exists, taken within the last hour, from before any
cutover change.

**How it is proved:** the Hostinger panel lists a snapshot whose timestamp is
after the last V4 deploy and before the first cutover change. Record its
timestamp and ID in the cutover log.

**What blocks the flip:** no manual snapshot, or the newest snapshot predates
the last V4 deploy.

**Do not rely on the automatic backups for this.** They run **weekly** and only
two are held, so the newest automatic snapshot can be up to seven days old —
restoring it would discard a week of production V4 data.

**Understand what a snapshot restore actually is before you plan to use one.**
It is **whole-machine**. Restoring rolls back V4's database and uploaded files
along with the Nginx config — every order, lead, message and generated asset
written since the snapshot is gone. That is why:

- the **symlink flip is the first-choice rollback** (seconds, touches nothing
  but a symlink),
- the **Nginx config restore is the second** (seconds, touches no data),
- and the **snapshot is the backstop of last resort**, for a machine-level
  failure the first two cannot address.

Never present the snapshot as the cutover's rollback plan. It is the thing you
have so that a catastrophe is survivable, not the thing you expect to use.

---

### `PUBLIC_EXPORT_GREEN`

The V5 export is structurally complete.

**How it is proved**

```bash
cd apps/v5 && npm run build:web && cd ../..
node scripts/precheck-v5-routes.mjs        # must exit 0
```

and the **Web export (apps/v5)** CI job is green on the exact merge commit being
deployed. The gate derives its expected route list from `apps/v5/src/app`, the
blog index JSON and the contract routes in `ROUTE-OWNERSHIP.md` — sources the
export cannot influence — so a route `expo export` silently dropped fails here
rather than 404ing in production.

**What blocks the flip:** a non-zero exit. In particular: a missing route, a
missing `robots.txt`/`sitemap.xml`/`llms.txt`/`ai.txt`/`feed.xml`, a missing
`_expo/` or `assets/`, an unexpanded `[slug].html` template, or fewer than 40
exported pages.

### `NGINX_CONFIG_GREEN`

The config **that is installed on the box** is valid and claims what it should.

**How it is proved**, on the VPS, after installing both vhosts:

```bash
nginx -t                                   # syntax + referenced files exist
node /opt/flowsmartly/scripts/precheck-v5-routes.mjs \
  --skip-export \
  --conf /etc/nginx/sites-available/flowsmartly-v5      # must exit 0
```

Point `--conf` at the **installed** file, not the repo copy. Verifying the repo
copy proves what we intended to serve, not what Nginx is serving; the whole
class of cutover bugs lives in that gap. (`deploy-v5-public.sh` does the same:
it prefers the installed vhost and warns loudly when it has to fall back.)

**What blocks the flip:** `nginx -t` non-zero, or any precheck failure. The
precheck emulates Nginx's own resolution order — exact, then `^~`, then regex in
source order — so it catches a correct-looking rule that an earlier regex
shadows, which `nginx -t` will happily accept.

Confirm the shared file is in place. `upstream v4_app` and both `limit_req_zone`
directives live in `/etc/nginx/conf.d/upstream-v4.conf`, not in either vhost.
They must be inside `http{}` — and, more importantly, the legacy vhost proxies
to the same upstream, so it must not be defined inside a config that rollback
lever 2 disables.

```bash
grep -c limit_req_zone /etc/nginx/conf.d/upstream-v4.conf   # 2
grep -rn 'upstream v4_app' /etc/nginx/sites-available/       # must print NOTHING
```

### `ROUTE_MATRIX_GREEN`

Every row of `ROUTE-OWNERSHIP.md` behaves as the table says, against the live
host.

**How it is proved** — after the reload, from a machine that is not the VPS:

```bash
H=https://flowsmartly.com
probe() { printf '%-46s %s %s\n' "$1" \
  "$(curl -sS -o /dev/null -w '%{http_code}' "$H$1")" \
  "$(curl -sSI "$H$1" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')"; }

# V5 static — 200
for p in / /product /pricing /flowagent /login /early-access \
         /solutions/flowshop /platform/social /resources/blog \
         /company/contact /legal/privacy /education/ai-fluency \
         /robots.txt /sitemap.xml /llms.txt /ai.txt /feed.xml; do probe "$p"; done

# clean-URL canonicalisation — 301 to the extensionless form
for p in /flowagent.html /product.html /solutions/flowshop.html /index.html; do probe "$p"; done

# moved / redirected
for p in /flow-ai /privacy /terms /sms-terms /gdpr \
         /register /signup /get-started /book-demo; do probe "$p"; done

# unowned — must be 404 from V5, never a V4 page
probe /nonsense-route-that-should-not-exist
```

Then, by eye, the three that a status code cannot judge:

- `/flowagent.html` must land on `/flowagent` showing **the real page**. If it
  renders a 404-looking page with full site chrome, the clean-URL rule is not
  working — that is the trap documented in `scripts/qa-serve.mjs` and section 0
  of the apex config, and it is invisible to `curl`.
- `/nonsense…` must be **V5's** 404 design, not a V4 page.
- A real `/store/<slug>`, `/p/<slug>`, `/form/<slug>` and `/sites/<slug>` must
  each still render. These are printed on materials and embedded in QR codes.

**And the highest-risk family — V4's API on the apex:**

- [ ] `GET /api/social/facebook/callback` reaches V4 (any app response, not an
      Nginx 404)
- [ ] Replay a Stripe webhook from the Stripe dashboard — it succeeds
- [ ] `curl -H "x-cron-secret: …" https://flowsmartly.com/api/cron/subscriptions`
      behaves as before
- [ ] **Connect one social account end to end.** This is the single best proof
      that the decision in section 0 held.

**What blocks the flip:** any mismatch. A wrong status on a marketing page is
embarrassing; a wrong status under `/api/` is a broken payment or a broken OAuth
registration, and those block absolutely.

### `EARLY_ACCESS_GREEN`

The lead funnel that replaces registration actually captures a lead.

**How it is proved:** load `https://flowsmartly.com/early-access` in a browser,
submit the form with real values, and confirm all three:

1. the UI shows its success state,
2. the network tab shows `POST /api/v1/leads` → `201`,
3. the row appears at `legacy.flowsmartly.com/admin/demo-requests` with source
   `v5-early-access`.

Also submit with a deliberately invalid email and confirm the field-level error
renders rather than a generic banner.

**What blocks the flip:** the page 404s, the form cannot submit, or the lead
does not reach the admin surface. `/early-access` is the only conversion path
on the entire public site while registration is closed — a silent failure here
means the cutover looks perfect and captures nothing.

### `LOGIN_PAGE_GREEN`

`/login` is the transition page, and its way out actually works.

**How it is proved:** load `https://flowsmartly.com/login` and confirm:

- it returns 200 and renders the V5 transition page,
- the primary CTA points at `https://legacy.flowsmartly.com/login` and,
  **clicked**, reaches a working sign-in form over valid TLS,
- the "forgot password" link reaches
  `https://legacy.flowsmartly.com/forgot-password` over valid TLS,
- it does **not** present a V5 sign-in form. V5 auth does not exist; a form that
  cannot authenticate anyone is worse than an honest hand-off.

**What blocks the flip:** a 404, or either legacy link failing. Both are
absolute URLs baked into the static export at build time, so they cannot be
fixed by an Nginx rule after the fact — fixing them means a rebuild and
republish. This gate is why `LEGACY_HOST_REACHABLE` must be green first.

### `API_V1_LEADS_GREEN`

The V5 API namespace behaves as its own contract, on the apex.

**How it is proved**

```bash
H=https://flowsmartly.com
B='{"kind":"early-access","name":"Gate Check","email":"gate-check@example.com"}'

curl -sS -X POST "$H/api/v1/leads" -H 'content-type: application/json' -d "$B" -w '\n%{http_code}\n'
# expect 201 {"lead":{"id":"…","status":"received"}}

curl -sS -X POST "$H/api/v1/leads" -H 'content-type: application/json' -d "$B" -w '\n%{http_code}\n'
# expect 409, code "duplicate"

curl -sS -X POST "$H/api/v1/leads" -H 'content-type: application/json' \
  -d '{"kind":"early-access","name":"x"}' -w '\n%{http_code}\n'
# expect 400 with per-field messages

for i in $(seq 1 12); do curl -sS -o /dev/null -w '%{http_code} ' -X POST "$H/api/v1/leads" \
  -H 'content-type: application/json' -d "$B"; done; echo
# expect 429 once the burst is spent — the public write surface is rate limited
```

**What blocks the flip:** anything other than those four behaviours. In
particular a `404` means the exact-match `location = /api/v1/leads` is not
installed and the request is being swallowed by the `/api/` catch-all.

**A standing note, not a gate:** `/api/v1/leads` is a **temporary bridge**. The
contract is V5's, but it is currently executed by the V4 process at
`src/app/api/v1/leads/route.ts`. The V5 frontend knows only the path and the
shape — it has never been told a legacy path — so retiring the bridge is one
`proxy_pass` change plus a data migration, with **zero frontend change**. Do not
"simplify" it by pointing the frontend at a V4 endpoint; that would convert a
one-line future change into a rebuild-and-republish.

### `QUERY_REDIRECTS_GREEN`

Tokenised links already sitting in customers' inboxes still work.

**How it is proved**

```bash
curl -sSI "https://flowsmartly.com/reset-password?token=test123" | grep -i '^location'
# expect: https://legacy.flowsmartly.com/reset-password?token=test123

curl -sSI "https://flowsmartly.com/verify-email?token=abc&email=a%40b.com" | grep -i '^location'
# expect the FULL query, both params, the %40 still encoded

curl -sSI "https://flowsmartly.com/teams/invite/tok999" | grep -i '^location'
# expect: https://legacy.flowsmartly.com/teams/invite/tok999

curl -sSI "https://flowsmartly.com/forgot-password" | grep -i '^location'
```

Then follow one of them all the way to a working page.

**What blocks the flip:** any redirect that drops the path or any part of the
query, or that lands anywhere other than the legacy host. **A dropped token is a
customer locked out of their own account**, with no way to tell us because the
password reset is the thing that is broken.

The rules use `$request_uri`, which is the original path *and* query. If anyone
"tidies" one of them to `$uri`, this gate fails — and
`precheck-v5-routes.mjs` fails too, which is the point of checking it in CI as
well as here.

### `ROLLBACK_GREEN`

Rollback is **rehearsed before it is needed**, not assumed.

**How it is proved** — on the VPS, before the flip, while nothing is public yet:

```bash
D=/opt/flowsmartly/scripts/deploy-v5-public.sh
$D deploy && $D deploy            # two releases from the same or different refs
$D list                           # newest first; note which is active
$D rollback                       # no argument = flip to the PREVIOUS release
$D status                         # active must now be the older one
$D rollback <newer-sha>           # roll forward again
$D status
```

**What blocks the flip:**

- `rollback` with no argument not selecting the previous release,
- `status` disagreeing with `list` about what is active,
- the route gate failing on a release that was published successfully — that
  means a release directory was corrupted after publication and rollback cannot
  be trusted.

Two properties this rehearsal exists to confirm, both of which have a wrong
implementation that looks right:

- **Release ordering is by timestamp, not by name.** A release is
  `<sha>-<UTC stamp>` and the sha is hex, so a plain lexical sort orders by
  commit hash. That would prune the wrong release and roll back to the wrong
  one. Confirm `list` is in genuine chronological order.
- **`rollback` refuses when it cannot tell what is active.** If `current` is not
  a symlink, "the previous release" has no meaning and the newest release —
  quite possibly the broken one you are escaping — would be chosen. The script
  fails loudly instead; do not "fix" that by making it guess.

Also confirm the other two levers exist before you need them:

- the Nginx config backup from step 3 below is on disk and readable,
- `PRE_CUTOVER_SNAPSHOT_GREEN` is green.

---

## 2. Before cutover day

- [ ] Merge the prepared branch; confirm CI is green, including **Type check**,
      **Type check (apps/v5)** and **Web export (apps/v5)**.
- [ ] `DNS_SUBDOMAIN_GREEN` — subdomain created (with approval), propagated.
- [ ] `LEGACY_HOST_REACHABLE` — vhost installed, certificate issued, sign-in
      confirmed by hand.
- [ ] Copy the certificate lines from the current `flowsmartly.com` server block
      into `nginx-flowsmartly-v5.conf` (they are commented placeholders).
- [ ] Confirm `limit_req_zone` placement for this box's Nginx layout.
- [ ] Prepare the customer email (section 5) — **do not send yet**.
- [ ] Brief support with the FAQ (section 6).

## 3. First V5 publish (safe — changes nothing public)

```bash
# On the VPS, after deploy-vps.sh has synced /opt/flowsmartly
/opt/flowsmartly/scripts/deploy-v5-public.sh deploy
/opt/flowsmartly/scripts/deploy-v5-public.sh status
```

- [ ] `status` shows an active release and lists it.
- [ ] `/var/www/flowsmartly-v5/current` resolves to a release directory.
- [ ] `PUBLIC_EXPORT_GREEN` — the deploy ran the route gate and it passed.
- [ ] `ROLLBACK_GREEN` — rehearse it now, while nothing is public.

The site is on disk but not yet served — nothing routes to it until the Nginx
configs are installed.

## 4. The flip

- [ ] `PRE_CUTOVER_SNAPSHOT_GREEN` — take the manual snapshot **now**, and
      record its ID and timestamp.
- [ ] Back up the current config:
      `cp -a /etc/nginx/sites-available /root/nginx-backup-$(date +%F-%H%M)`
- [ ] Confirm `/etc/nginx/conf.d/upstream-v4.conf` is installed (it should
      already be, from `LEGACY_HOST_REACHABLE` step 3).
- [ ] Install both vhosts into `sites-available` and symlink into
      `sites-enabled`. Remove the old `flowsmartly` server block — the new apex
      config replaces it in full.
- [ ] `NGINX_CONFIG_GREEN` — `nginx -t` **and** the precheck against the
      installed file.
- [ ] `systemctl reload nginx`
- [ ] `ROUTE_MATRIX_GREEN`
- [ ] `EARLY_ACCESS_GREEN`
- [ ] `LOGIN_PAGE_GREEN`
- [ ] `API_V1_LEADS_GREEN`
- [ ] `QUERY_REDIRECTS_GREEN`

## 5. Customer email — send only after every gate is green

**Subject:** Your FlowSmartly workspace is moving while V5 rolls out

> FlowSmartly V5 is being released gradually.
>
> Our new V5 experience is becoming the main FlowSmartly platform and website.
>
> While we complete your V5 rollout, your current workspace remains available at:
>
> **legacy.flowsmartly.com**
>
> Your existing data and services are unchanged and remain available there.
>
> **You will be asked to sign in again the first time you use the new address.**
> This is a one-time step — your account, data and subscription are not affected.
>
> We will notify you when your workspace is ready for the full V5 experience.
>
> **[Open my current workspace]** → https://legacy.flowsmartly.com/login

The sign-in sentence is not optional. V4 issues host-only cookies, so every
existing session ends at the moment of the flip. Customers who are not told
first will read it as being logged out of a broken product.

Do not describe V4 as deprecated or broken. It is continuity during a rollout.

## 6. Support FAQ

**"What happened to my FlowSmartly account?"**
Nothing. Your account, data and subscription are unchanged. While we roll out
FlowSmartly V5, your current workspace lives at legacy.flowsmartly.com. Sign in
there as normal.

**"Why was I signed out?"**
The workspace moved to its own address, and sign-ins do not carry across
addresses. Signing in once at legacy.flowsmartly.com is all that is needed.

**"Can I get the new version?"**
V5 is opening in batches. We will contact you when your workspace is ready.

**"My store/landing page link — does it still work?"**
Yes. Every published link keeps its existing address and needs no changes.

## 7. Rollback

Four levers, in order of preference. **Use the smallest one that fixes the
problem** — each one down the list costs more and takes back more than the last.

**1. A V5 site problem** — bad content, a broken page:

```bash
/opt/flowsmartly/scripts/deploy-v5-public.sh list
/opt/flowsmartly/scripts/deploy-v5-public.sh rollback          # previous release
/opt/flowsmartly/scripts/deploy-v5-public.sh rollback <sha>    # a specific one
```

Seconds. Touches nothing but a symlink. No data implications at all.

**2. A routing problem** — something reaching the wrong backend:

```bash
# Disable the new apex vhost and restore the old one. Copying the backup over
# sites-available is NOT enough by itself — the sites-enabled symlink still
# points at the new file, so it has to be removed explicitly.
rm -f /etc/nginx/sites-enabled/flowsmartly-v5
cp -a /root/nginx-backup-<stamp>/flowsmartly /etc/nginx/sites-available/
ln -sfn /etc/nginx/sites-available/flowsmartly /etc/nginx/sites-enabled/flowsmartly
nginx -t && systemctl reload nginx
```

Seconds. Restores V4 on the apex exactly as before. The V5 release directories
are left in place, so re-flipping forward is another `nginx -t && reload`. No
data implications.

**Leave `/etc/nginx/conf.d/upstream-v4.conf` and the legacy vhost alone.** That
is exactly why the upstream is a separate file: the legacy host keeps serving
right through this, and it is where the customers are.

**3. A V4 application problem:** unchanged — `pm2` and `scripts/deploy-vps.sh`
as always.

**4. A machine-level failure only** — restore the manual snapshot from
`PRE_CUTOVER_SNAPSHOT_GREEN`.

> **Read this before choosing lever 4.** A snapshot restore is **whole-machine**.
> It rolls back V4's database and uploaded files as well as the config, so every
> order, lead, message and generated asset written since the snapshot is
> destroyed. It is the backstop for a catastrophe the first three levers cannot
> reach — not a routing fix. If levers 1 and 2 can address the symptom, they are
> the correct answer even when the snapshot feels more thorough.

Levers 1, 2 and 3 are independent: none requires the others, and none touches
the database.

## 8. After cutover

- [ ] Raise the `legacy` DNS record TTL from 300s back to the zone default.
- [ ] Submit the V5 sitemap in Google Search Console; confirm
      `legacy.flowsmartly.com` is **not** indexed.
- [ ] Update the privacy/terms/SMS URLs held in A2P 10DLC and carrier campaign
      registrations to the `/legal/*` paths. The 301s cover the gap meanwhile.
- [ ] Decide what happens to `/surfaces/[key]` — currently 404 after cutover
      (see Known gaps in `ROUTE-OWNERSHIP.md`).
- [ ] Write V5 pages for `/marketing-compliance` and `/ecommerce-terms`, which
      are still proxied from V4.
- [ ] Consider raising the Hostinger backup schedule above weekly now that the
      apex, the legacy host and the static site all live on one box.
- [ ] When the V5 API is deployed: implement the `/api/v1/leads` contract there,
      repoint one `proxy_pass`, migrate `DemoRequest where source LIKE 'v5-%'`,
      then delete `src/app/api/v1/` from the V4 repo.
