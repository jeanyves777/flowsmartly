# V5 public cutover — production checklist

Everything in the repo is prepared. This file is what a human executes, in
order. Nothing here has been run.

Related: [`ROUTE-OWNERSHIP.md`](ROUTE-OWNERSHIP.md) ·
[`nginx-flowsmartly-v5.conf`](nginx-flowsmartly-v5.conf) ·
[`nginx-legacy-v4.conf`](nginx-legacy-v4.conf) ·
[`../scripts/deploy-v5-public.sh`](../scripts/deploy-v5-public.sh)

---

## 0. The env-var decision — read this first

**Do not change `NEXT_PUBLIC_APP_URL`. Leave it at `https://flowsmartly.com`.**

The cutover instruction called for repointing it at the legacy host. The audit
says that would break production, and that it is unnecessary.

`NEXT_PUBLIC_APP_URL` is read in **87 files / 97 occurrences** and serves two
incompatible jobs:

| Use | Files | If repointed at legacy |
| --- | --- | --- |
| OAuth `redirect_uri` construction | **26** | **Breaks.** The URI would no longer match what is registered at Meta, Google, LinkedIn, Pinterest, TikTok, X, YouTube, Google Business, WhatsApp — every provider rejects a redirect_uri it does not have on file. Fixing it means re-registering all 26, several behind multi-day app review |
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

---

## 1. Before cutover day

- [ ] Merge the prepared branch; confirm CI is green, including the new
      **Web export (apps/v5)** job.
- [ ] DNS: `A`/`AAAA` record for `legacy.flowsmartly.com` → the VPS. Let it
      propagate before anything else.
- [ ] TLS: `certbot --nginx -d legacy.flowsmartly.com`.
- [ ] Confirm `legacy.flowsmartly.com` serves the V4 app over HTTPS **before**
      the apex changes. The legacy host must be working first — it is the
      fallback for existing customers during the flip.
- [ ] Copy the certificate lines from the current `flowsmartly.com` server block
      into `nginx-flowsmartly-v5.conf` (they are commented placeholders).
- [ ] Decide `limit_req_zone` placement: it must sit in `http{}`. If the config
      is included from inside `http{}`, keep it where it is; otherwise move that
      one line to `nginx.conf`.
- [ ] Prepare the customer email (section 5) — **do not send yet**.
- [ ] Brief support with the FAQ (section 6).

## 2. First V5 publish (safe — changes nothing public)

```bash
# On the VPS, after deploy-vps.sh has synced /opt/flowsmartly
/opt/flowsmartly/scripts/deploy-v5-public.sh deploy
/opt/flowsmartly/scripts/deploy-v5-public.sh status
```

- [ ] `status` shows an active release and lists it.
- [ ] `/var/www/flowsmartly-v5/current` resolves to a release directory.

The site is on disk but not yet served — nothing is routed to it until the
Nginx configs are installed.

## 3. The flip

- [ ] Snapshot the current config: `cp -a /etc/nginx/sites-available /root/nginx-backup-$(date +%F)`
- [ ] Install both configs into `sites-available` and symlink into
      `sites-enabled`. Remove the old `flowsmartly` server block — the new apex
      config replaces it in full.
- [ ] `nginx -t`
- [ ] `systemctl reload nginx`

## 4. Verify — run every one of these

Public V5:

- [ ] `/` `/product` `/pricing` `/flowagent` `/login` `/early-access` → 200
- [ ] `/legal/privacy` → 200, `/robots.txt` `/sitemap.xml` → 200
- [ ] `/flow-ai` → the redirect stub, lands on `/flowagent`
- [ ] An unowned path (`/nonsense`) → **404 from V5**, not a V4 page

V5 API:

- [ ] `POST /api/v1/leads` with a valid body → `201 {"lead":{"id":…}}`
- [ ] The same body again → `409` with code `duplicate`
- [ ] A body missing `email` → `400` with per-field messages
- [ ] The lead appears at `legacy.flowsmartly.com/admin/demo-requests` with
      source `v5-early-access`

V4 API preserved on the apex — **the highest-risk area**:

- [ ] `GET /api/social/facebook/callback` reaches V4 (any response from the app,
      not a 404 from Nginx)
- [ ] A Stripe webhook delivery succeeds (replay one from the Stripe dashboard)
- [ ] `curl -H "x-cron-secret: …" https://flowsmartly.com/api/cron/subscriptions`
      behaves as before
- [ ] Connect one social account end-to-end. This is the single best proof that
      the OAuth decision in section 0 held.

Legacy public content — **customer links**:

- [ ] A real `/store/<slug>` renders
- [ ] A real `/p/<slug>` renders
- [ ] A real `/form/<slug>` renders
- [ ] A real `/sites/<slug>` renders

Query-preserving auth redirects:

```bash
curl -sI "https://flowsmartly.com/reset-password?token=test123" | grep -i location
# expect: https://legacy.flowsmartly.com/reset-password?token=test123
curl -sI "https://flowsmartly.com/verify-email?token=abc&email=a%40b.com" | grep -i location
curl -sI "https://flowsmartly.com/teams/invite/tok999" | grep -i location
```

- [ ] All three preserve the **complete** path and query. A lost token is a
      customer locked out.

Registration and legal:

- [ ] `/register` `/signup` `/get-started` → **302** to `/early-access`
- [ ] `/privacy` `/terms` `/sms-terms` `/gdpr` → **301** to `/legal/*`

Legacy app:

- [ ] `legacy.flowsmartly.com/login` → sign in works
- [ ] `legacy.flowsmartly.com/flow-ai` and a few dashboard routes render
- [ ] `legacy.flowsmartly.com/robots.txt` → `Disallow: /`

## 5. Customer email — send only after section 4 passes

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

Three independent levers. Use the smallest one that fixes the problem.

**A V5 site problem** — bad content, broken page:

```bash
/opt/flowsmartly/scripts/deploy-v5-public.sh list
/opt/flowsmartly/scripts/deploy-v5-public.sh rollback <sha>
```

Seconds, and it touches nothing but a symlink.

**A routing problem** — something reaching the wrong backend:

```bash
cp -a /root/nginx-backup-<date>/* /etc/nginx/sites-available/
nginx -t && systemctl reload nginx
```

This restores V4 on the apex exactly as before. The V5 release directories are
left in place, so re-flipping forward is another `nginx -t && reload`.

**A V4 problem:** unchanged — `pm2` and `scripts/deploy-vps.sh` as always.

None of the three requires touching the database, and no rollback path needs
the other two.

## 8. After cutover

- [ ] Submit the V5 sitemap in Google Search Console; confirm
      `legacy.flowsmartly.com` is **not** indexed.
- [ ] Update the privacy/terms/SMS URLs held in A2P 10DLC and carrier campaign
      registrations to the `/legal/*` paths. The 301s cover the gap meanwhile.
- [ ] Decide what happens to `/surfaces/[key]` — currently 404 after cutover
      (see Known gaps in `ROUTE-OWNERSHIP.md`).
- [ ] Write V5 pages for `/marketing-compliance` and `/ecommerce-terms`, which
      are still proxied from V4.
- [ ] When the V5 API is deployed: implement the `/api/v1/leads` contract there,
      repoint one `proxy_pass`, migrate `DemoRequest where source LIKE 'v5-%'`,
      then delete `src/app/api/v1/` from the V4 repo.
