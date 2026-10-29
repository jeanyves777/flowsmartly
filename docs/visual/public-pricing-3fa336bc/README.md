# Public pricing render proof — PR #546 @ 3fa336bc81fd012ed08bafb4df7d1c61c58d0317

Built 2026-10-29 (UTC) from a detached checkout of the exact PR head (unchanged since the request). Base for the diff: served `3e158d0d`.
Served `apps/v5/dist` with `python -m http.server`, then ran Playwright Chromium with reducedMotion=reduce and the cookie banner rejected (`sweep.js`).
Screenshots are named `<page>-<width>-<theme>-<view>.jpg`. The site offers only **light** and **dark**: a stored `grey` is rewritten to dark (`MODES = ['light','dark']`), so the `*-grey-*` captures render as dark.

## Build
| step | exit | tail |
|---|---|---|
| npm ci | 0 | — |
| npx tsc --noEmit | 0 | — |
| npm run qa:web | **1** | export OK (51 pages, json-ld 51, llms.txt); agent-readiness 100/100 but `1 GUARD FAILURE(S)`: "No page is accidentally noindex — /early-access, /login". mirror-routes did not run under qa:web (exit 0 when I ran it on its own). |

dist: 41.6 MB, 232 files, entry `index.html` (sha256 b8edec65…cb595) → `_expo/…/entry-e2f15ff944f185d8ada68062e11e1785.js`.
Diff vs 3e158d0d: 7 files, all in apps/v5 (docs/billing-offers-20261028.md, scripts/sync-billing-offers.mjs, src/app/pricing.tsx, src/components/public/v5-footer.tsx, src/content/{billing-offers.ts,pricing-faq.json,public-billing-plans.ts}).

## Checks
| check | result | evidence |
|---|---|---|
| Plans Free (PAYG, $0) / Personal $20, 500/mo / Business $120, 1,500/mo | PASS | pricing-*-plans-monthly.jpg, home-*-pricing-shelf.jpg |
| Yearly: $192/yr and $1,152/yr, $16 and $96 per-month equivalents, Save 20%, wrapping OK | PASS (text present at all 36 captures, no overflow) | pricing-*-plans-yearly.jpg |
| 500/1,500 monthly allowance kept under yearly (cards and compare table) | PASS | pricing-*-plans-yearly.jpg, pricing-*-compare-yearly.jpg |
| No stale catalogue anywhere | **FAIL** | `SoftwareApplication` JSON-LD in dist/index.html, pricing.html and product.html lists Starter $0/500, Pro $20/1,500, Business $50/4,000 (highPrice 50); dist/llms.txt says "Starter is free (500 credits/month). Pro is $20/month (1,500 credits). Business is $50/month (4,000 credits)" (source: scripts/agent-assets.js:259,416). /solutions/custom-automation PLAN_STRIP shows Starter Free / Pro $20 / Business $50 (src/app/solutions/custom-automation.tsx:99). |
| Card baselines / no overflow — pricing page | PASS (button bottoms Δ≤1px, equal heights, no page h-scroll, all widths and themes) | pricing-*-plans-*.jpg |
| Card baselines — homepage pricing shelf | **FAIL** | CTA bottoms differ by 5–26px at ≥768 (26px at 1024: Free's "No monthly subscription charge" wraps and the card has no spacer, against AGENTS rule 10). At 768 the grid wraps 2+1, leaving Business alone on its row. home-1024-*-pricing-shelf.jpg, home-768-*-pricing-shelf.jpg |
| No text clipping | PASS (the detector flagged the shelf price lines because of numberOfLines line-height; the glyphs render in full when inspected visually) | home-*-pricing-shelf.jpg |
| FAQ JSON-LD valid and matches visible prices | PASS for FAQPage (6 Q&A, valid JSON, matches visible copy). The SoftwareApplication offers on the same page do **not** match (see stale row above). | dist/pricing.html |
| Account CTAs → V5 account routes | PASS (the plan CTA navigates to `/register`; nav has `/login`) | pricing-*-plans-monthly.jpg |
| Console/page errors | PASS (0) | — |

VERDICT: NOT READY
