# FlowSmartly — working agreements

## UI changes MUST be visually validated (always)
Never consider UI work "done" without a visual check. For any UI change:
1. **Mock first.** Build a self-contained, interactive HTML mockup (or a screenshot)
   and share it for review *before/while* building. The live app cannot be
   screenshotted from the cloud session (no DB, no browser), so the mockup is how we
   align on the look. Design mockups live in `design/`.
2. **Port to React** once the look is approved; CI type-checks it.
3. **Confirm in the real app** with a screenshot from a dev server / deploy before
   calling it done. The user is the "eyes" when the cloud session can't render it.

## Deploy & CI — merged ≠ deployed ≠ verified
- **The deploy is PULL-based.** A VPS cron runs `scripts/poll-deploy.sh` every minute;
  when `origin/main` advances it runs `scripts/deploy-vps.sh` locally (fetch →
  hard-reset → Prisma patch + `db push` → `next build` → `pm2 reload` → `/flow-ai`
  health check). GitHub never SSHes in. **Nothing fires on push** —
  `.github/workflows/deploy.yml` is `workflow_dispatch` only, a manual fallback.
- **Merging is not deploying.** Budget ~1 min of poll latency **plus a 7–13 min
  `next build`**. Measured 2026-08-11: merged 15:13:27 UTC, live 15:26:25 UTC.
  Never report a fix as shipped on the strength of a merge.
- **Verify on production before calling it done:**
  1. `curl -s https://flowsmartly.com/api/version` → `sha` must equal the merge
     commit **and** `deploy.state` must be `ok`. `failed`/`stuck` means production is
     still serving the previous build.
  2. Then probe the behaviour. For a route change, hit it with a **deliberately
     nonexistent slug**: old code resolves it against the DB and 404s, new code
     returns its constant response. That separates "deployed" from "looks right".
- **A failed deploy retries 3× with backoff (0 / 5 / 15 min), then stops at `stuck`.**
  It never loops, and it is never silent — log line, `DEPLOY_STATUS`, `/api/version`,
  and one email if `DEPLOY_ALERT_EMAIL` is set in `.env`. Recover without inventing a
  commit: `ssh root@flowsmartly.com /opt/flowsmartly/scripts/poll-deploy.sh --force`
  (`--status` prints current state). Log: `/var/log/flowsmartly-deploy.log`.
- **`prisma db push` runs on every deploy.** Additive diffs auto-apply; a diff that
  would DROP a column or table **aborts the deploy on purpose**. Read
  `docs/deploy-prisma-drift.md` before removing anything from `schema.prisma`.
- Every PR runs a type-check gate (`.github/workflows/ci.yml`) — keep PRs green.
- A branded maintenance page (`public/maintenance.html`) is served by Nginx when the
  app upstream is down; the deploy refreshes it each run.
- Develop on the assigned feature branch and open **draft** PRs.

## Video-ad consistency pipeline (story-ad-campaign)
- Characters are anchored by a multi-angle **turnaround sheet** (`characterSheetUrl`),
  derived from the first image / uploaded photo via identity-preserving image-to-image,
  and fed into Veo Quality `referenceImages` for cross-shot consistency. The clean
  portrait is kept for the Veo-Lite first-frame path.
