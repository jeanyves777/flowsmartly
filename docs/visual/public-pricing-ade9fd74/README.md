# Public pricing delta proof — ade9fd745ec4f1793ab60eac2fa48a4b4c1dc6ec vs live 314f9a57

VERDICT: READY

Candidate `ade9fd745ec4f1793ab60eac2fa48a4b4c1dc6ec` (branch `completion/billing-public-offers`; head re-checked before commit, has **not** moved). Compared with live `314f9a57ae3243c3ace64a8a4a814c544cc26dc5` (proof: `../public-pricing-314f9a57/README.md`, READY).
Built 2026-10-29 (UTC) from detached worktrees of both SHAs. Node **v22.22.0**. Served each `apps/v5/dist` with `python3 -m http.server`; Playwright Chromium, reducedMotion=reduce, cookie banner rejected, theme set via `localStorage['v5:theme']` (theme toggle confirmed "Theme: light" / "Theme: dark" in every capture).
No payments, checkout or provider calls were made. Candidate source not changed; nothing merged or deployed.

## 1. Diff scope (`git diff 314f9a57 ade9fd74`)
`314f9a57` is a direct ancestor; one commit (`ade9fd7 fix(public): reserve readable width for custom automation label`).

```
 apps/v5/src/app/solutions/custom-automation.tsx | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
-    planTileCustom: { borderColor: t.violet, backgroundColor: softFill(t.violet, t) },
+    // Keep the long custom-service label on word boundaries; wrap the tile as a whole.
+    planTileCustom: { flexBasis: 156, minWidth: 156, borderColor: t.violet, backgroundColor: softFill(t.violet, t) },
```
**Nothing else changed in source.** `planTileCustom` is used only by the Custom AI Automation tile on /solutions/custom-automation.

Export-level confirmation (candidate dist vs live dist, entry-bundle hash normalised):
- JS entry bundle: the only change is `planTileCustom:{flexBasis:156,minWidth:156,…}`.
- `solutions/custom-automation.html` (+ `/index.html` mirror): two new atomic CSS rules (`.r-1pfygfr{flex-basis:156px}`, `.r-hif81j{min-width:156px}`) and the Custom tile's class list (drops `r-52odoo r-bcqeeo` = the 92px basis / 0 min-width from `planTile`, adds the two new rules).
- 21 other `/solutions/*` HTML files: only the same two CSS rules added to the shared route stylesheet; no element uses them (grep: class usage only in custom-automation). Inert.
- Every other HTML file: identical apart from the entry-bundle filename. No other file differs.

## 2. Build (`npm ci && npm run qa:web` in apps/v5)
| tree | npm ci | qa:web exit | guard output |
|---|---|---|---|
| candidate ade9fd74 | 0 | **1** | `FAIL  No page is accidentally noindex` → `/early-access, /login`; `1 GUARD FAILURE(S)`; score 100/100 |
| live 314f9a57 | 0 | **1** | identical |

`qa-web-ade9fd74.txt` and `qa-web-314f9a57.txt` (readiness + guard sections) are byte-identical. That is the only failure: the inherited guard, as expected. `mirror-routes.js` run on its own afterwards: exit 0, `48 routes also served as <route>/index.html`, 232 files (same as live). Live `index.html` sha256 aa79905017d99aca… matches the 314f9a57 proof; candidate `index.html` c79bf5c8ef9409b6… (differs only by entry hash `entry-1ac8086b4ed1380121cbdbf999569313.js`).

## 3. /solutions/custom-automation plan strip — 6 widths × light/dark (`strip.js`, `measurements.json`)
Per word: a DOM Range over each word of every text node in every tile; split = its client rects sit on >1 line. Also: word bbox outside its tile, overflow-hidden/line-clamp clipping, tile outside strip, document/scroller horizontal overflow, console/page errors. 21 words checked per capture.

| width | candidate ade9fd74 (light = dark) | live 314f9a57 (light = dark) |
|---|---|---|
| 390 | 3 tiles 101×116 + Custom 320×95 on row 2 · **0 split** | identical geometry · 0 split |
| 768 | 145×96 ×3 + Custom 209×96, 1 row · **0 split** | 161×117 ×4 · 0 split |
| 1024 | 205×96 ×3 + Custom 269×96, 1 row · **0 split** | 221×96 ×4 · 0 split |
| 1280 | 137×96 ×3 + Custom 430×96 on row 2 · **0 split** | 101×159 ×4 · **split: "Automation"** |
| 1536 | 137×97 ×3 + Custom 430×97 on row 2 · **0 split** | 101×183 ×4 · **split: "Automation", "Custom"** |
| 1920 | 137×97 ×3 + Custom 430×97 on row 2 · **0 split** | 101×183 ×4 · **split: "Automation", "Custom"** |

Candidate, all 12 captures: 0 words split, 0 words outside their tile, 0 clipped elements, document overflow 0, scroller overflow 0, strip inside its parent (right edge −21/−29px), 0 console/page errors. Every word sits on exactly one line (e.g. 1280: `Custom AI Automation | Custom | Scoped per project` all 1 line each).
The live control reproduces the reported mid-word breaks with the same method, so the check is sensitive to the defect. At 1280–1920 the candidate wraps the Custom tile as a whole onto a full-width second row; the other three tiles stay equal width. Visually checked: `custom-automation-<w>-<theme>-plan-strip.jpg` (viewport) and `…-plan-strip-zoom.png` (strip crop); live equivalents in `strip-vs-live-314f9a57/`.

## 4. Regression spot check on the candidate (`sweep.js`, `regression/`)
| check | candidate | live |
|---|---|---|
| homepage shelf CTA bottoms 1024 light | 749/748/749 (Δ1) | 749/748/749 |
| homepage shelf CTA bottoms 1280 light | 730/729/730 (Δ1) | 730/729/730 |
| /pricing CTA bottoms 1024 light, monthly / yearly | 1063/1062/1063 (Δ1) / same | same |
| /pricing CTA bottoms 1280 light, monthly / yearly | 1011/1010/1011 (Δ1) / same | same |
| horizontal overflow, console errors | 0, 0 | 0, 0 |
| plan CTA destination | `/register` | `/register` |

Old-catalogue grep over the whole candidate export (every HTML, JSON, txt, JS): `Starter` 0 · `Pro plan` 0 · `4,000 credits` 0 · `highPrice":"50"` / `highPrice": "50"` / `highPrice":50` 0 · `$50/month` 0 · `500/1,500 credits monthly` 0. **Zero hits.** All `highPrice` values are `"120"` (5 occurrences). Whole-word `Pro` occurs only in icon-library strings ("Guitar Pro", "Pro Tools", "New Japan Pro-Wrestling", `FontAwesome6Pro`), not plan copy.

## Result
- Diff touches only the Custom AI Automation tile — PASS
- qa:web: exit 1 on exactly the inherited noindex guard (/early-access, /login), nothing else — PASS (as expected)
- No word split, no overflow, nothing clipped at 390/768/1024/1280/1536/1920 light & dark — PASS (live had splits at 1280/1536/1920)
- /pricing and homepage shelf unchanged, CTA bottoms within 1px; old catalogue 0 hits — PASS

VERDICT: READY
