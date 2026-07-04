# feat: agent-first Phase 0 — workspace surfaces, design/print/ad studios & agent-first public site

## Agent-first Phase 0

Builds out the agent-first workspace (Create/Print/Publish/Grow/Sell/Web/Outreach/Leads/Business),
the design & print studios, the ad-builder / follow-ups playgrounds, and a full
rebuild of the **public marketing site** around the one-agent story.

### Public site rebuild (latest)
- **Motion runtime:** Lenis smooth-scroll + GSAP/ScrollTrigger provider + reusable, reduced-motion-safe primitives.
- **Agent-first landing:** branded hero with a streaming loader producing **Design → Video → Website**; proof marquee; a **self-playing app-UI replica** ("watch the agent work") with the real logo + FlowLoader; realistic surface grid; why-different; **video showcase**; realistic personas; social proof; outcomes; **credit-based pricing** (no hardcoded prices); CTA.
- **Surface deep-dives** at `/surfaces/[key]` (9 static pages) with realistic imagery + **live Grok video** on Create/Grow/Publish/Sell; legacy product URLs (`/flowshop`, `/marketplace`, …) **301'd** to their surface.
- Theme-aware (light/grey/dark), header/footer restructured, sitemap updated.

### AI asset tooling (reusable dev scripts)
- `scripts/gen-marketing-images.ts` — Imagen 4 (photoreal) + Nano Banana (graphic layouts) → webp.
- `scripts/gen-marketing-video.ts` — xAI **Grok** (`grok-imagine-video`) → mp4.

### Earlier in the branch
Design Studio (elements/shapes/icons/QR/tables, undo-redo, media library, style library),
Print Studio (paper formats + product mockups + isolation), Ad-builder & Follow-ups playgrounds, Store CTA credit-gating.

All commits type-checked; public-site work screenshot-validated across themes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
