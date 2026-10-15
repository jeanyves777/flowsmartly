# Public keyboard-focus repair evidence

PR #544 source: 72edbd7a98632bc51794b2fee039fb87ef78bc28. Base #543: 58214b2b5cc6f1a4c1aff15bb68a100467ce10b4.

Only product change: the existing focus-visible rule covers RN-web link/tab/checkbox controls, native non-hidden inputs/textarea/select, existing tabbable controls and nested modal portals. Hover/press/reduced-motion selectors, disabled boundaries, route/auth behavior, layouts, Reveal and #545 QA files are unchanged. Rendered regression coverage is added to the existing export CI job; existing source assertions remain.

## Executed checks

- Fresh app-local install: 0. Local Puppeteer declared; no Python shim or root-app dependency installation.
- Baseline build:web from 3037d5f04e7ec2900788c8ab827987f1a60b2e5e: 0. Natural-Tab fixture fails with 1px UA outline for role=link, expected 3px solid. Baseline screenshot/observations/log retained.
- First fix passes 72 route samples but exposes nested modal portal coverage: real compact-nav Theme button retains 1px UA outline. Log and screenshot retained. Widening focus-only dialog scope fixes it.
- node --test scripts/public-control-feedback.test.mjs: 0, 2 passed.
- npm run qa:focus on 5e0acf73e91226371362470da2a1e44f338d90e5: 0, including actual build/export and browser proof. V5 npx tsc --noEmit: 0.
- Final commit changes only the browser driver's traversal/capture coverage. Final node scripts/test-public-focus.mjs run at the stated source: 0. All product/TypeScript source blobs are identical to the just-built/typechecked 5e0acf73 tree (git diff --quiet on apps/v5/src: 0). Exact-head CI rebuilds the final head.
- git diff --check: 0; generated content churn excluded.

## Rendered proof

72 real route cases: /, /pricing, /solutions/video-studio, /company/about, /company/contact, /platform/ai-studio, /solutions/domains, /platform/email-sms. Each at 390/768/1440 x 960 in light/grey/dark. Natural Tab traverses 28 stops on contact/studio and 12 elsewhere; aggregate assertions require real-page link/tab/checkbox roles, INPUT and TEXTAREA. Every visible keyboard-focused stop has 3px solid rgb(109,94,252) outline. Seven synthetic DOM types separately pin the selector boundary through natural Tab.

Also passed: fine-pointer hover and press, unchanged sibling geometry, native/ARIA-disabled no motion, native disabled Tab skip, reduced-motion no transform/transition, compact navigation's 30-Tab trap at 390/768, Escape and Close restoring trigger focus, and a separate touch/coarse-pointer browser without hover lift. No document/scroll-container overflow or console/runtime error in the final run. External requests blocked; no forms or provider actions submitted.

results.json records SHA, UTC, browser version and observations. Screenshots include actual controls and modal focus; representative captures were opened and inspected. These are viewport captures, not full-route images. No contrast or comprehensive accessibility audit is claimed. Independent Claude source/browser review and exact-head CI are separate gates. No merge/deploy, production/customer data, live migration or V4 action.

Recorded UTC: 2026-10-15T15:07:33.829193+00:00
