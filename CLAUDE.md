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

## Deploy & CI
- Merge to `main` auto-deploys to the VPS: GitHub Actions → SSH → `scripts/deploy-vps.sh`
  (fetch → Prisma patch → `next build` → zero-downtime `pm2 reload` → `/flow-ai` health check).
- Every PR runs a type-check gate (`.github/workflows/ci.yml`) — keep PRs green.
- A branded maintenance page (`public/maintenance.html`) is served by Nginx when the
  app upstream is down; the deploy refreshes it each run.
- Develop on the assigned feature branch and open **draft** PRs.

## Video-ad consistency pipeline (story-ad-campaign)
- Characters are anchored by a multi-angle **turnaround sheet** (`characterSheetUrl`),
  derived from the first image / uploaded photo via identity-preserving image-to-image,
  and fed into Veo Quality `referenceImages` for cross-shot consistency. The clean
  portrait is kept for the Veo-Lite first-frame path.
