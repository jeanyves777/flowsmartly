# V5 public entry verification

This is a read-only check for the marketing export and the V5 apex route contract. It does not contact a host, use credentials, alter nginx, touch DNS, or deploy. It verifies the supplied V5 nginx source, both local exports, the marketing source commit, and the V5 portal manifest.

## Local verification

Use a clean marketing checkout pinned to the full PR source SHA and the portal bytes from the V5 release candidate's `.release/portal`, paired with that candidate's generated `.release/RELEASE-MANIFEST.json`. Do not use `docs/release/RELEASE-MANIFEST.json` as a current measurement; it is the contract, not the generated release record. The script checks the portal directory against `artifacts.portal_artifact_digest` using the V5 `flowsmartly.release-digest/3` algorithm, and checks that the manifest's `artifacts.measured_at_sha` equals `source.sha`.

```bash
git -C "$MARKETING_REPO" checkout --detach "$MARKETING_SHA"
test -z "$(git -C "$MARKETING_REPO" status --porcelain --untracked-files=no)"

cd "$MARKETING_REPO/apps/v5"
npm ci
npm run check:account-entry
npm run build:web

node scripts/verify-v5-apex-entry.mjs \
  --source-repo "$MARKETING_REPO" \
  --source-sha "$MARKETING_SHA" \
  --portal-manifest "$V5_RELEASE_MANIFEST" \
  --nginx "$V5_REPO/deploy/nginx-apex-v5.conf" \
  --marketing-export "$MARKETING_REPO/apps/v5/dist" \
  --portal-export "$V5_RELEASE_ARTIFACT/.release/portal" > public-entry-proof.json
```

The check resolves `/login` and `/register` through the portal auth location and its `try_files` rule, resolves `/early-access` through the marketing location, and requires each route's exported HTML. It checks the fixed source helpers and that each `Create account` CTA file references `goToRegister`, rejects V4/waitlist references in browser assets, and prints both source SHAs, both export-tree SHA-256 digests, and the nginx file digest. The portal digest must equal the release manifest's portal digest. A pass is `PASS_LOCAL_ONLY`: it proves these supplied local bytes and config, not the bytes currently installed on a host.

The V5 portal source currently defines `(public)/login.tsx` and `(public)/register.tsx`; Expo Router exports these as direct portal routes. The apex config's auth regex sends both to `/var/www/flowagent-portal/current`, and its `$uri`, `$uri.html`, `$uri/index.html` lookup supports those exports. `/early-access` stays a marketing compatibility route; its client effect forwards to `/register` after hydration. The V5 nginx config deliberately does not serve the marketing `/login` page.

## Owner/operator evidence still required for beta

The marketing CI run `38649281885` passed at source `ddb366b39f686aa4b5846e94084cd9aa0cf3148f`, but it uploaded no build artifact. After this verification script is added, re-run CI at the new PR head. Before beta, the authorized operator must provide:

1. The exact V5 release candidate SHA and generated `.release/RELEASE-MANIFEST.json` (not the docs contract), plus digests of the marketing and portal export trees that match the copies selected for staging.
2. A read-only capture of active `nginx -T`, active vhost path and SHA-256, and `nginx -t`; confirm active `/login` and `/register` select the portal root and `/early-access` selects the marketing root. Compare the active vhost to the reviewed V5 config at the same release decision.
3. Browser evidence against the isolated V5 beta hostname or approved staging environment: directly load `/login` and `/register`; load `/early-access` and observe its post-hydration move to `/register`; click every visible `Create account` CTA (desktop/mobile header plus page CTAs) at 390, 768, and 1440 widths and confirm the final path is `/register`. Record status, final URL, and served artifact SHA for each. Do not submit credentials in this check.

No evidence here authorizes production deployment or V4 use. If the isolated host or exact candidate artifacts are unavailable, mark the route and artifact gates **BLOCKED**, and keep the beta held.
