# Public site rebuild — agent-first, premium motion

**Decision:** Full rebuild around the one-agent story · Premium motion (Lenis + GSAP/ScrollTrigger, Lottie where it earns its place).

## 1. The positioning shift
| Legacy (today) | New (agent-first) |
| --- | --- |
| A *suite of separate tools* — FlowShop, ListSmartly, SMS Blaster, View‑to‑Earn, Agent Marketplace, Compliance. Mega‑menu sells products. | **One AI agent that runs your whole marketing.** You describe the outcome; the agent does the work across every surface and you only pay for what it produces (credits). |
| Static PNG illustrations, mount fade‑ups only. | Cinematic, scroll‑driven, *agentic* motion: a live "watch the agent work" sequence, animated workspace, aurora backdrops. |

The hero of the story is the **agent + the workspace surfaces** it operates: Create, Print, Publish, Grow, Sell, Web, Outreach, Leads, Business — all credit‑based.

## 2. New landing structure
1. **Header** — slimmed nav: Product · Solutions · Pricing · Resources. CTAs: *Start free* + *Watch it work*. Glassy, shrinks on scroll.
2. **Hero** — gradient headline, an **animated agent composer** that types a prompt and spins work into a workspace; aurora backdrop; email capture → `/register`.
3. **Proof strip** — logo/trust marquee.
4. **"Watch the agent work"** — the centerpiece: a GSAP‑pinned, scroll‑scrubbed sequence (Describe → Agent plans → Produces design/post/ad/store → Approve). This is the "highly animated agentic" moment.
5. **The surfaces** — interactive grid/orbit of the 9 surfaces with hover previews.
6. **How it works** — 3 steps (Describe → Agent does it → Approve & publish).
7. **Outcomes** — animated counters / before‑after.
8. **Pricing preview** — credit‑based ("pay for work, not seats"); pulls real costs, no hardcoded prices.
9. **Use cases / testimonials**.
10. **Final CTA** — large, animated.
11. **Footer** — restructured to the agent + surfaces.

## 3. Tech approach
- **Deps to add:** `lenis` (smooth scroll), `gsap` (+ ScrollTrigger). `lottie-react` only if a section needs it.
- **`PublicMotionProvider`** in `(public)` + root layout: Lenis instance, syncs `ScrollTrigger`, tears down on route change, **respects `prefers-reduced-motion`** (disables smooth scroll + scrubbed pins).
- **Motion primitives** in `src/components/marketing/motion/`: `Reveal`, `Parallax`, `Magnetic`, `AuroraBackdrop`, `Marquee`, `Counter`, `GradientText`, `TiltCard`. Built on framer‑motion `whileInView`; GSAP only for the pinned scrub.
- **Perf:** transform/opacity only, lazy‑load heavy sections, `content-visibility`, mobile falls back to lighter reveals.

## 4. Rollout (each phase: mock → port → screenshot‑validate → commit/push)
- **P0** — deps + Lenis provider + motion primitives + **this mockup approved**.
- **P1** — Header + Hero + Footer (the frame).
- **P2** — "Watch the agent work" pinned demo (centerpiece).
- **P3** — Surfaces grid + How it works.
- **P4** — Outcomes + credit pricing + use cases + final CTA.
- **P5** — Retire/redirect legacy product pages (flowshop, listsmartly‑details, view‑to‑earn, marketplace): rebuild as agent‑surface stories or 301 to the new sections; update nav + sitemap. Keep legal pages.

## 5. Guardrails
- New design only, no legacy reliance. Credit‑based messaging (never plan‑tier gating). Visually validated at every step. Reduced‑motion accessible. PRs stay green + draft.
