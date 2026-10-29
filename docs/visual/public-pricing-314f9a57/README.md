# Public pricing render proof — PR #546 @ 314f9a57ae3243c3ace64a8a4a814c544cc26dc5

VERDICT: READY

Built 2026-10-29 (UTC) from detached worktrees of the exact candidate `314f9a57` (branch `completion/billing-public-offers`; head has **not** moved) and the served baseline `3e158d0d` (`ship/public-site-20261017`). Node **v22.22.0** (meets the 22.18+ native type-stripping requirement of `scripts/agent-assets.js`).
Previous proof: `docs/visual/public-pricing-3fa336bc/` (NOT READY). Diff 3fa336bc → 314f9a57: `scripts/agent-assets.js`, `src/app/solutions/custom-automation.tsx`, `src/components/public/v5-footer.tsx`, `docs/billing-offers-20261028.md`. `src/app/pricing.tsx` and `src/content/` are byte-identical to 3fa336bc, so /pricing is the same source as the previous proof's passing rows.
No payments, checkout or provider calls were made. No source changed, nothing merged or deployed.

Served `apps/v5/dist` with `python -m http.server`, Playwright Chromium, reducedMotion=reduce, cookie banner rejected (`sweep.js`, extended from the previous proof with /solutions/custom-automation and FAQ JSON-LD capture). Screenshots: `<page>-<width>-<theme>-<view>.jpg`; raw numbers in `measurements.json`. As before, the site offers only light and dark — a stored `grey` is rewritten to dark (theme toggle reads "Theme: dark"), so `*-grey-*` renders as dark.

## Build (`npm ci && npm run qa:web` in apps/v5)
| tree | npm ci | qa:web exit | guard output |
|---|---|---|---|
| candidate 314f9a57 | 0 | **1** | `FAIL  No page is accidentally noindex` → `/early-access, /login`; `1 GUARD FAILURE(S)`; score 100/100 |
| baseline 3e158d0d | 0 | **1** | identical: `FAIL  No page is accidentally noindex` → `/early-access, /login`; `1 GUARD FAILURE(S)`; score 100/100 |

The full readiness/guard sections (`qa-web-314f9a57.txt`, `qa-web-3e158d0d.txt`) are byte-identical (`diff` empty). `git diff 3e158d0d 314f9a57 -- apps/v5/src/app/early-access.tsx apps/v5/src/app/login.tsx apps/v5/scripts/agent-readiness.js` is empty.
**This is an inherited limitation of the live site, not a regression, and is not counted against the candidate.** Because the guard fails, `mirror-routes.js` never runs inside `qa:web` on either tree; run on its own it exits 0 on the candidate (`mirror: 48 routes also served as <route>/index.html`). Candidate export: 232 files, 41 MB, `index.html` sha256 aa79905017d99aca…, entry `entry-457cace56eb302a7a1741e78ed497eee.js`.

## Export scan (candidate dist: every HTML, JSON-LD, llms.txt, sitemap, robots, ai.txt, feed, manifest, JS bundle)
| check | result |
|---|---|
| `Starter`, `Pro` (plan), `4,000 credits`, `highPrice":"50"`, `$50/month`, `500/1,500 credits monthly` (old wording) | **0 hits** (control: the same grep hits index.html, pricing.html, product.html, llms.txt, custom-automation.html on 3e158d0d) |
| other `$50` / `4,000` | only unrelated illustrative copy, also on baseline: "$50–100/hr" agency rate (/solutions/agent-marketplace) and "4,000 customer notes" social demo post (/platform/social) |
| llms-full.txt | not produced by either tree (nothing to scan) |
| SoftwareApplication JSON-LD (index, pricing, product + mirrors) | lowPrice 0, **highPrice 120**, offerCount 3: Free (Pay as you go) $0 / Personal $20, 500 / Business $120, 1500 |
| llms.txt ## Pricing | "Free (Pay as you go): $0/month, 0 included credits… Personal: $20/month, 500… $192/year… Business: $120/month, 1500… $1152/year…" |
| /pricing | Free / $20 (500/mo) / $120 (1,500/mo); yearly $16 & $96 /mo, $192 & $1,152 billed yearly, Save 20% |
| homepage shelf | Free / $20 · 500 / $120 · 1,500; note "Personal $192/year · Business $1,152/year" |
| /solutions/custom-automation strip | Free (Pay as you go) / Personal $20 / Business $120 / Custom |
| FAQPage JSON-LD | 6 Q&A, unchanged source since previous proof, matches visible copy |

## Render checks (6 widths × light/grey/dark; 54 captures, 0 console/page errors, 0 horizontal overflow)
| check | result |
|---|---|
| (b) homepage shelf CTA bottoms side by side | **PASS** — Δ ≤ 1px at 1024 (749/748/749), 1280 (730/729/730), 1536 & 1920 (736/735/736), all themes. Previously 5–26px. |
| no tablet 2+1 | **PASS** — 390 and 768 stack 1+1+1 (full-width cards), 3-up from 1024. `home-768-*-pricing-shelf.jpg` |
| /pricing card CTA bottoms | PASS — Δ ≤ 1px monthly and yearly at every width; stacked at 390/768 |
| yearly toggle | PASS — $16/$96, $192/$1,152 billed yearly, $X/mo equivalent, 500/1,500 each month kept, compare table 0/500/1,500 |
| CTAs | PASS — plan "Create account" navigates to `/register`; nav Log in / Create account present |
| clipping | shelf detector flags the price lines (numberOfLines line-height, same false positive as previous proof); glyphs render fully on inspection |

## Inherited observation (not a regression, not counted)
/solutions/custom-automation at 1280/1536/1920: the strip's four cells are 101px wide, so the "Custom AI Automation" card wraps mid-word ("Automatio|n", "Custo|m"). `strip-vs-baseline/` shows 3e158d0d renders the identical geometry (101×159 / 101×183, same line counts) — it is live today and outside this PR. Worth a follow-up.

## Previous failures
- (a) stale catalogue in SoftwareApplication JSON-LD / llms.txt / custom-automation — **FIXED**
- (b) homepage shelf CTA baselines 5–26px off, 2+1 at 768 — **FIXED**
- (c) qa:web noindex guard /early-access, /login — **INHERITED** (identical on 3e158d0d), not counted

VERDICT: READY
