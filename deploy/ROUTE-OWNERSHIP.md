# Route ownership — flowsmartly.com after the V5 public cutover

The definitive table. If a path is not in it, it is **unowned** and returns V5's
404 page: `deploy/nginx-flowsmartly-v5.conf` deliberately has no catch-all
fallthrough to V4, so a route can never start working by accident.

Configs: [`nginx-flowsmartly-v5.conf`](nginx-flowsmartly-v5.conf) (apex),
[`nginx-legacy-v4.conf`](nginx-legacy-v4.conf) (legacy host),
[`nginx-upstream-v4.conf`](nginx-upstream-v4.conf) (shared `upstream v4_app` and
the `limit_req` zones — a separate file so a rollback of the apex cannot take the
legacy host down with it).

Every row below is asserted by [`../scripts/precheck-v5-routes.mjs`](../scripts/precheck-v5-routes.mjs),
which parses the config and emulates Nginx's own resolution order rather than
grepping for strings. A row that stops being true fails CI.

## Owners

| Owner | Meaning |
| --- | --- |
| `V5_STATIC` | Served from the V5 export at `/var/www/flowsmartly-v5/current` |
| `V5_API` | The `/api/v1/*` namespace — V5's contract, whatever implements it |
| `V4_API` | V4's unversioned `/api/*` — registered webhooks, OAuth callbacks, cron |
| `V4_LEGACY_PUBLIC_CONTENT` | Customer-generated public pages, proxied on the apex so published links keep working |
| `REDIRECT_V5` | 301/302 to a V5 route on the apex |
| `REDIRECT_LEGACY` | 301 to `legacy.flowsmartly.com`, full path + query preserved |
| `V4_LEGACY_APP` | The authenticated V4 application, on the legacy host only |

## flowsmartly.com

| Path | Owner | Handler | Redirect | Preserve query | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | `V5_STATIC` | `index.html` | — | — | |
| `/product` | `V5_STATIC` | `product.html` | — | — | |
| `/pricing` | `V5_STATIC` | `pricing.html` | — | — | Replaces V4's `/pricing` |
| `/flowagent` | `V5_STATIC` | `flowagent.html` | — | — | |
| `/flow-ai` | `REDIRECT_V5` | **301** | `/flowagent` | yes | A real server 301, which `apps/v5/scripts/agent-assets.js` asks for by name — the export's `flow-ai/index.html` stub carries `rel=canonical` but cannot consolidate ranking signals. The stub still serves `/flow-ai/`. Free on the apex only because V4's authenticated `/flow-ai` moved to the legacy host. **The V4 deploy health check is unaffected**: `scripts/deploy-vps.sh` checks `127.0.0.1:3000/flow-ai`, straight to the upstream, bypassing Nginx |
| `<any V5 route>.html` | `REDIRECT_V5` | **301** | the clean URL | yes | `expo export` writes `flowagent.html`; serving it at that URL makes expo-router match nothing and render its not-found page **with a 200**. Scoped to the V5 namespace so customer-published `.html` URLs under `/sites/*` and `/store/*` are untouched. See `scripts/qa-serve.mjs` |
| `/login` | `V5_STATIC` | `login.html` | — | — | Transition page, **not** authentication |
| `/early-access` | `V5_STATIC` | `early-access.html` | — | — | Lead funnel |
| `/solutions/*` | `V5_STATIC` | export | — | — | 11 routes |
| `/platform/*` | `V5_STATIC` | export | — | — | 6 routes |
| `/resources/*` | `V5_STATIC` | export | — | — | Incl. `blog/[slug]` |
| `/company/*` | `V5_STATIC` | export | — | — | 8 routes |
| `/legal/*` | `V5_STATIC` | export | — | — | Canonical legal pages |
| `/education/*` | `V5_STATIC` | export | — | — | |
| `/robots.txt` `/sitemap.xml` `/llms.txt` `/ai.txt` `/feed.xml` | `V5_STATIC` | export | — | — | V5's own; V4's `robots.ts`/`sitemap.ts` go dormant |
| `/_expo/*` | `V5_STATIC` | export | — | — | Content-hashed, `immutable`, 1y |
| `/assets/*` | `V5_STATIC` | export | — | — | 30d |
| `/favicon.ico` | `V5_STATIC` | export | — | — | |
| `/api/v1/leads` | `V5_API` | V4 `:3000` **(TEMPORARY BRIDGE)** | — | — | The V5 public lead contract, implemented at `src/app/api/v1/leads/route.ts`. An exact-match `location` with its own rate limit — it is the only unauthenticated write surface on the apex. The V5 frontend knows only this path and this shape; retiring the bridge is one `proxy_pass` change plus a data migration, with **zero frontend change** |
| `/api/v1/*` | `V5_API` | V4 `:3000` **(temporary)** | — | — | V5 contract. One `proxy_pass` line moves it to the real V5 API |
| `/api/*` | `V4_API` | V4 `:3000` | — | — | **Unchanged on purpose** — 21 vendor-registered callbacks + 8 cron entries |
| `/p/*` `/store/*` `/sites/*` `/form/*` `/ad/*` `/m/*` `/t/*` `/ref/*` `/optin/*` `/survey/*` `/event/*` `/bp/*` `/pf/*` `/follow-up/*` `/ticket` | `V4_LEGACY_PUBLIC_CONTENT` | V4 `:3000` | — | yes (proxied) | Published in campaigns, QR codes and print. Must not move |
| `/marketing-compliance` `/ecommerce-terms` | `V4_LEGACY_PUBLIC_CONTENT` | V4 `:3000` | — | yes (proxied) | **No V5 counterpart exists.** Keep serving V4's copy rather than 404 a page carriers may cite |
| `/privacy` | `REDIRECT_V5` | 301 | `/legal/privacy` | yes | Cited in A2P 10DLC registration — update out of band |
| `/terms` | `REDIRECT_V5` | 301 | `/legal/terms` | yes | |
| `/sms-terms` | `REDIRECT_V5` | 301 | `/legal/sms-terms` | yes | Cited in carrier campaign registration |
| `/gdpr` | `REDIRECT_V5` | 301 | `/legal/gdpr` | yes | |
| `/register` `/signup` `/get-started` `/start` | `REDIRECT_V5` | **302** | `/early-access` | yes | 302, not 301: these become real V5 registration later and a cached 301 would outlive that. The query is preserved because these are the URLs paid and referral traffic lands on — dropping it destroys the `utm_*` attribution for exactly the visitors the funnel exists to measure |
| `/book-demo` | `REDIRECT_V5` | 301 | `/company/contact?topic=demo` | no | |
| `/reset-password` | `REDIRECT_LEGACY` | 301 | `legacy…/reset-password` | **yes — critical** | Live tokens in already-sent email |
| `/verify-email` | `REDIRECT_LEGACY` | 301 | `legacy…/verify-email` | **yes — critical** | Live tokens in already-sent email |
| `/forgot-password` | `REDIRECT_LEGACY` | 301 | `legacy…/forgot-password` | yes | |
| `/teams/*` | `REDIRECT_LEGACY` | 301 | `legacy…/teams/*` | **yes — critical** | `/teams/invite/[token]` — tokenised invitations already sent. Redirected rather than proxied so the session it creates is scoped to the legacy host |
| `/admin*` | `REDIRECT_LEGACY` | 301 | `legacy…/admin*` | yes | Admin portal + its own login |
| *anything else* | — | V5 404 | — | — | No fallthrough to V4, by design |

## legacy.flowsmartly.com

| Path | Owner | Handler | Notes |
| --- | --- | --- | --- |
| `/robots.txt` | — | synthetic | `Disallow: /` — the legacy host must never compete with V5 for the brand's search results |
| `/*` | `V4_LEGACY_APP` | V4 `:3000` | Login, dashboard, all 42 authenticated segments, settings, billing, integrations. `X-Robots-Tag: noindex, nofollow` on every response |

## The two rules behind the split

**Content is proxied; sessions are redirected.** A V4 route that only *serves*
public content stays on the apex, because its URL is already published and
cannot be recalled. A V4 route that *creates a session* is redirected to the
legacy host, because V4 sets host-only cookies
([`session.ts:13-18`](../src/lib/auth/session.ts#L13-L18)) — proxying it on the
apex would issue a V4 session cookie for `flowsmartly.com` and destroy the
isolation the subdomain exists to create.

**Ownership is explicit, never inferred.** The apex has no `proxy_pass`
fallback. Adding a V4 route does not silently expose it on the V5 domain, and a
typo in a V5 route name 404s loudly instead of quietly reaching V4.

## Known gaps

- `/marketing-compliance` and `/ecommerce-terms` have **no V5 page**. They are
  proxied from V4 indefinitely until V5 versions are written.
- V4's `/surfaces/[key]` marketing pages are in V4's sitemap but have no V5
  equivalent and are **not** claimed above — they will 404 after cutover.
  Decide per page: write a V5 equivalent, redirect to the nearest V5 route, or
  accept the 404. Listed in [`src/app/sitemap.ts`](../src/app/sitemap.ts).
- `/help` appears in V4's sitemap but is an authenticated dashboard route. V5's
  public equivalent is `/resources/help-center`; a redirect is not wired because
  the old URL never served public content.
