# Approved V5 public offers — source handoff, 2026-10-28

Owner scope: native coordination PR273 comment6471987014 and docs/architecture/BILLING-PLAN-POLICY.md in jeanyves777/flowsmartly-v5. Free/PAYG has zero included allocation. Personal USD20monthly/192yearly,500 included EACH MONTH. Business120monthly/1152yearly,1500 EACH MONTH. Yearly charges display explicitly, with16/96monthly equivalents and Save20%. Included resets monthly; purchased credits carry over. Existing paid contracts are not repriced by this public copy.

This patch targets ONLY apps/v5 in the separate flowsmartly public repository, based on explicit V5 public ref feat/public-auth-cta67b097843d39c63277be2be5dac6a851354daefe. Default main has no apps/v5 tree and is the legacy release path: DO NOT merge this into main or use its auto-deploy. Existing dirty shared checkout, Prisma, V4 runtime/auth/billing and deployment files are untouched. Claude must confirm the actual public serving source/artifact path before delivery.

Homepage and pricing now consume the same public materialization of native packages/contracts/src/billing-offers.ts. Source SHA25647a5b96d90b5d5211437f389f0641bf805ff0b7da702696fa4f06f058537e51d. Regenerate or compare with:

    node apps/v5/scripts/sync-billing-offers.mjs --source PATH_TO_NATIVE/packages/contracts/src/billing-offers.ts
    node apps/v5/scripts/sync-billing-offers.mjs --source PATH_TO_NATIVE/packages/contracts/src/billing-offers.ts --check

This copies public V5 facts only, with no cross-repo runtime import, credential/env/network read or provider ID. Shared presentation derives monthly/yearly charges and allowance captions. Removed contradictory Starter/Pro quotas, invented feature unlocks and ungoverned per-feature USD rates. FAQ no longer promises unsupported immediate plan switching/proration or annual bank transfer. The public balance diagram is explicitly illustrative. Registration CTAs are unchanged; viewing the annual toggle never enrolls or charges anyone.

## Available checks

- Read apps/v5/AGENTS.md and exact Expo57 versioned reference before edits.
- Native/public catalogue exact-byte comparison PASS. Deliberately changing the generated snapshot makes the guard fail; restoring exact bytes passes.
- Pure public data module strict noEmit typecheck PASS with TypeScript5.9.3; TSX transpile syntax checks and FAQ JSON shape PASS. These are NOT a full app semantic/typecheck or export.
- Pricing and footer createStyles definitions are byte-identical to the base; no tokens, layout styles, assets or dependencies changed. Existing source formatting preserved outside changed content. Changed whitespace PASS.

## Still required

Actual public source/delivery ref confirmation, full app typecheck/static export in REAL cloud, and inspection of served artifacts at390/768/1024/1280/1536/1920 in light/grey/dark per AGENTS.md. Check long Free/Personal labels, yearly charge wrapping, equal card baselines, FAQ JSON-LD agreement, overflow and existing CTA destinations. No visual acceptance, installed/deployed/served proof or signed-in/payment claim is made. Claude alone owns serialized deployment; this is a draft source packet. Owner signed-in post-deploy acceptance is separate from available agent source/visual checks.

## Confirmed public delivery venue and build handoff

Claude confirmed coordination6484775773: public ship/public-site-20261017 at3e158d0d8edbcbc2f494cc4ad1e03dccfc77d94e is the actual serving lineage. This branch now incorporates that source, preserving its account destinations, focus/icon/branding and public pages. Relative to that serving SHA, the final tree changes only the seven Billing public source/evidence files above; no root legacy or deploy-file delta. The earlier feature-ref ancestry is retained without importing its unrelated legacy tree differences into the delivery candidate.

From the isolated exact-SHA checkout in real cloud:

    cd apps/v5
    npm ci
    npx tsc --noEmit
    npm run qa:web

Use the committed apps/v5/package-lock.json. qa:web runs build:web (content compilation, expo export -p web, agent-assets and icons), strict agent-readiness and mirror-routes. Output is apps/v5/dist. Do not run the root legacy build. No build or deployment has been performed by this handoff.

Claude alone may publish the verified dist into a new timestamped /var/www/flowsmartly-v5/releases directory and cut over /var/www/flowsmartly-v5/current after exact-source cloud export/render acceptance. Portal delivery remains separate. Before cutover inspect homepage and pricing at all six approved widths across light/grey/dark, plus annual toggle, FAQ JSON-LD, CTA destinations and overflow. Record actual public artifact SHA and serving proof; no unrun checks are green.

## Cloud-proof corrections

Proof9161bbae for3fa336bc found stale SoftwareApplication/llms/custom-automation catalogue and homepage shelf baselines. agent-assets now reads the same generated public billing-offers.ts (Node22.18+ built-in type stripping; no private/env input), derives AggregateOffer maximum and descriptions, and generates llms plan text. Custom-automation derives its strip from PUBLIC_BILLING_PLANS. Homepage features grow to align CTA baselines; plans stack until three columns fit, preventing tablet2+1 orphan layout. New painted proof is still required.

Baseline attribution: serving3e158d0d contains the exact same early-access.tsx/login.tsx/agent-readiness.js bytes as this candidate. Both forward-only pages deliberately declare noIndex: retired early-access forwards to/register; login forwards to the portal sign-in document. No SEO behavior or guard changed. Cloud should reproduce qa:web at3e158d0d to confirm the same inherited noindex failure rather than assume the new Billing source caused it. Normal export/mirror/readiness evidence must retain that limitation explicitly.

Available delta checks: agent-assets syntax PASS; Node public TypeScript catalogue require PASS with correct Business12000minor value; whitespace PASS. Full exact-source export/metadata scan/render rerun remains Claude cloud work. No deploy/visual pass asserted.
