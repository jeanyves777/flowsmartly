# Video Studio QA repair evidence

Source: `cc9175d9f3be324a0fb5caf3811b040e56ab58d2` on PR #545; base `58214b2b5cc6f1a4c1aff15bb68a100467ce10b4` (#543). This is an evidence branch, not another source candidate.

## Executed locally on Windows / Node 24

- `npm.cmd ci --no-audit --no-fund` in apps/v5: exit 0 with the declared local Puppeteer dependency. No Python shim, root dependency installation, or mirrored route directories were used.
- `npm.cmd run qa:video-studio`: exit 0. Includes the static-server regression test, real export, browser interactions, 18 width/theme snapshots, a deliberate-overflow negative control and JavaScript-disabled preview visibility.
- `npx.cmd tsc --noEmit` in apps/v5: exit 0.
- `git diff --check`: passed; source worktree cleaned of generated line-ending churn before push.

The final tested tree was committed as the stated source SHA; only commit metadata changed after the run. All image files use local, existing registered artwork. Requests outside the local origin are blocked. No generation, provider execution, production data, deployment or V4 work was performed.

## What the browser command proves

Local gallery click/aria-pressed/expected image alt, no API/provider request from preview selection, natural Tab to Campaign with visible focus, Space activation, FAQ disclosure, reduced-motion heading and initial preview visibility, and no console/page errors. At 390/768/1024/1280/1536/1920 by 960px in light/grey/dark, document and actual scroll-container widths fit. A deliberately over-wide child is then rejected by the same detector, so excluding the non-scrolling centred main does not exempt real horizontal scrolling. The preview is visible in JavaScript-disabled static HTML.

The 18 PNGs are top-of-page viewport captures. The page scrolls inside a container, so Puppeteer's fullPage flag does not turn them into full-route captures. Cookie UI remains visible. Contact sheets and all captures were inspected, including the restored preview. Contrast ratios, full-route visual inspection, account submission, served production mapping, and a fresh independent source review are not claimed.

## Before / after proof

`before-hidden-preview-1536.png` shows the blank preview on `f5c844462db86911d20e1b11cd00357be5c8cf17` (the harness-only repair). Adding the initial-frame visibility assertion against that artifact exits 1: actual hidden, expected visible (`pr545-hidden-preview-before.txt`). The page's Reanimated entering prop had emitted visibility:hidden during static rendering. Reusing the SSR-visible Reveal primitive with the existing 180ms duration fixes it; final screenshots show the image and both reduced-motion/static visibility assertions pass. Other Reveal callers retain the original default duration.

Logs are normalized to UTF-8 for display. The local screenshot directory is configurable through V5_PUBLIC_QA_OUTPUT_DIR, defaulting to a directory under the OS temp directory. The local server binds 127.0.0.1 on an ephemeral port unless V5_PUBLIC_QA_PORT is provided.

Recorded UTC: 2026-10-15T13:36:35.828036+00:00
