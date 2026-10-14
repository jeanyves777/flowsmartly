# V5 public entry verification

This is a read-only local verification of the marketing source, the V5 portal production artifact, and the reviewed V5 apex nginx source. It does not contact a host, use credentials, alter nginx or DNS, or deploy.

## CI fixture test

From `apps/v5`, run:

```bash
npm run test:apex-entry
```

CI runs the same command after the marketing export. Its isolated fixtures exercise the verifier CLI, including a matching portal digest, digest mismatch, a manifest not measured from a clean worktree, an untracked marketing source file, and routes placed only in a different nginx server block. The digest fixture pins the byte sequence used by `jeanyves777/flowsmartly-v5/scripts/release-verify.mjs:digestOf` (sorted file path, NUL, file bytes, NUL).

These are fixture checks only. CI does not build or attest the V5 portal release candidate and does not prove the live host.

## Candidate-local verification

Use clean checkouts pinned to the exact marketing source SHA and V5 release candidate. The V5 builder is `scripts/build-portal-production.mjs`; its production output is `apps/portal/.production-artefact`. Pair those bytes with the generated V5 release manifest at `.release/RELEASE-MANIFEST.json`, measured from the same candidate. Do not use `docs/release/RELEASE-MANIFEST.json` as a current measurement; that is the contract.

```bash
git -C "$MARKETING_REPO" checkout --detach "$MARKETING_SHA"
test -z "$(git -C "$MARKETING_REPO" status --porcelain --untracked-files=all)"

cd "$MARKETING_REPO/apps/v5"
npm ci
npm run check:account-entry
npm run build:web
npm run test:apex-entry

node scripts/verify-v5-apex-entry.mjs \
  --source-repo "$MARKETING_REPO" \
  --source-sha "$MARKETING_SHA" \
  --portal-manifest "$V5_REPO/.release/RELEASE-MANIFEST.json" \
  --nginx "$V5_REPO/deploy/nginx-apex-v5.conf" \
  --marketing-export "$MARKETING_REPO/apps/v5/dist" \
  --portal-artifact "$V5_REPO/apps/portal/.production-artefact" > public-entry-proof.json
```

The verifier independently checks the marketing checkout's full HEAD and tracked/untracked cleanliness. It requires the portal manifest's `source.sha`, `artifacts.measured_at_sha`, and `artifacts.measured_from_clean_worktree: true`, then hashes the supplied `apps/portal/.production-artefact` using the release verifier's digest algorithm and compares it to `artifacts.portal_artifact_digest`. It also checks the `server_name flowsmartly.com` nginx block itself for the marketing root, portal auth location, and static lookup; another vhost cannot satisfy those checks. It checks the V5 marketing source helpers, CTA sources, exported `/early-access`, portal `/login` and `/register` files, and rejects V4/waitlist references in browser assets.

A successful output is `PASS_LOCAL_ONLY`: it proves the supplied source, manifest, artifact and config files, not what is installed on a host.

## Evidence still required before beta

1. The exact V5 candidate SHA, its generated `.release/RELEASE-MANIFEST.json`, and matching portal artifact digest from `apps/portal/.production-artefact`.
2. A read-only capture of active `nginx -T`, active vhost path and SHA-256, and `nginx -t`; confirm the active `flowsmartly.com` server routes `/login` and `/register` to the V5 portal root and `/early-access` to the V5 marketing root.
3. Browser evidence on the isolated V5 beta hostname or approved staging: direct `/login` and `/register`; `/early-access` after hydration; every visible Create account CTA at 390, 768 and 1440 widths. Record status, final URL and served artifact SHA. Do not submit credentials.

No evidence here authorizes production deployment or V4 use. If the exact candidate artifact or isolated host is unavailable, keep those route and artifact gates blocked and hold the beta.
