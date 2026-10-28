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
