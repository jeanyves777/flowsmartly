# First public news cutover: rollback custody

This is a procedure for the existing production operator. It performs no live change itself. A route-gate pass is not proof of legal, auth, publication or production health.

## What is actually known

- Public PR #547 records an in-place address fix based on `ade9fd74`: stored release `20261114T040032Z-ade9fd74-address`, with seven files patched to the Adams address. Its Git source fix is `2e92699903279da905c1f7338363602b6d9201ee`.
- The newer PR #548 serving receipt identifies `20261115T060924Z-97de5073`, built from `97de50737c6736b900e0eaba0bfe3a64db7d368b`. It passed 45/45 checks and HTTP 200 then. This is the latest recorded pre-news deployment, not a fresh observation of the VPS.
- Rebuilding that exact Git revision in scratch produces 51 indexed URLs and no news templates. Its matching gate with the pre-news backend config passes 45/45. The current gate with that same pair refuses the eight missing news templates (44/45). Consequently, the ordinary current-script rollback can refuse this first-cutover target even after static news routing is restored.
- The Git revision `97de5073` contains the old Pittsfield address. The actual stored release's bytes, any subsequent address patch and current auth deployment cannot be inspected from this environment. Do **not** assume its address/auth content is safe from its release name. Current news integration carries both the address and SMS/legal commits. No new public rollout receipt has been observed in COMMS.

## Preferred backout: retain the approved export, restore only prior routing

Before cutover, the existing operator records the current public release, portal root, `nginx -T` view and actual enabled configuration files, plus the new intended configuration. Keep these in operator custody, not in this repository. Preserve the previous immutable export and the precise source contract beside it. Verify the stored export retains the Adams address, required SMS/legal sections and any auth/CTA changes; do not rebuild or overwrite the stored artifact during backout.

If the problem is the new news proxy/binding, retain the newly approved marketing export and the current portal release. Restore the paired pre-cutover news/static routing from the captured configuration, preserving every unrelated legal/auth/portal rule. Validate nginx before reload. The current gate must still pass against the retained export and that loaded configuration; it accepts static news routing, and all current templates remain available. This avoids reverting approved address/legal/auth bytes merely to remove the new proxy. Externally verify the main site, legal pages, sign-in/register and news's honest current state. Static news may show unavailable data; this is not a publication success.

## If the marketing export itself must revert

1. Identify the explicit stored target from the real release inventory; do not use an unverified default “previous” target. Verify its byte identity and legal/address/auth content against the recorded approved baseline. If it lacks required fixes or current auth changes, **stop this export rollback**: retain the approved export/route-only backout or prepare a separately verified corrected pre-news artifact through the normal release process. A route check must not waive this preservation requirement.
2. Restore the target's paired pre-cutover routing in the existing operator lane, preserving current portal/auth ownership. The operator must validate its effective nginx configuration. The repository's historical config is a scratch fixture, not authority to replace the loaded production config.
3. Prepare an immutable source checkout matching the target's verified contract. For the recorded #548 target this is the full `97de50737c6736b900e0eaba0bfe3a64db7d368b` source, including `scripts/precheck-v5-routes.mjs`, `apps/v5/src/app` and generated content indexes. Copying just the gate beside new sources is insufficient: it derives routes relative to its own source root.
4. Run that pinned gate against the stored target and captured effective configuration using `--public-static --dist <stored-release> --conf <nginx-T-view> --marketing-root <current-link> --portal-root <current-portal-root>`. It must pass both export and configuration checks. Do not use skip flags, remove template checks, or pass the old gate against the new news proxy configuration.
5. Invoke the unchanged official script with its supported `PRECHECK` override and an **explicit** stored release name, under the same operator's deployment custody:

   ```sh
   PRECHECK=/absolute/path/to/pinned-previous-source/scripts/precheck-v5-routes.mjs \
   V5_PORTAL_ROOT=/absolute/current/portal/root \
   bash /absolute/path/to/current/scripts/deploy-v5-public.sh rollback VERIFIED_STORED_RELEASE_NAME
   ```

   The script captures `nginx -T` again, runs that gate, checks `nginx -t` before changing the symlink, activates the existing stored export and checks health. Keep the gate/source tree in place for the duration. This override selects a verified target contract; it does not skip preflight.
6. Verify actual external responses, legal/address/auth continuity, serving symlink and loaded configuration. Retain receipts. A successful scratch test or the script's root-page health response alone does not establish all these results.

## Regression rehearsal

Build the pinned historical source in a scratch directory, never the operator's active checkout. With the current export already built, run:

```sh
node scripts/qa-first-news-rollback.mjs \
  --previous-source /absolute/pinned-previous-source \
  --prior-conf /absolute/pre-news-config-fixture \
  --marketing-root /root/named/by/the/fixture \
  --portal-root /portal/root/named/by/the/fixture
```

The rehearsal runs the actual official rollback script and real gates/exports against throwaway release copies and symlinks. Only nginx, service reload and HTTP health are stand-ins. It proves current-contract refusal leaves the active link unchanged, the matching previous contract permits the explicit stored-target flip, and the current export also passes under prior static routing. It is not a live rollback or a claim that the production artifact has been inspected.

Executed evidence on 2026-11-19: source-reconstructed `97de5073`, pre-news backend config at `48ec63fb51e7d3246ed56e8e48ad0c448d6f8d70`, current marketing `074bdfa88709f69d4a0f5a4cdff5aba4b7b7ad11`; all three rehearsal arms passed. Actual stored-artifact custody and current production serving remain operator verification steps. No publication or schedule changes are part of this procedure.
