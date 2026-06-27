# FlowSmartly — Agent-First Restructure Plan

**Status:** committed direction (2026-06-26). North star = **agent-first hybrid**.
**No customers yet → no time pressure → build the foundations properly.**

---

## 1. Why (the problem, grounded)

A codebase scan found the platform is a feature-rich suite pretending to be one screen:

- **~23 user-facing feature domains**, **~15–23 top-level nav sections**.
- **177 Prisma models**, **610 API route files**.
- Modularity score ~4.5/10 — cleanly *clustered* by domain but tightly coupled on `User` + Credits + a single Prisma schema.

This is the real "users get lost" problem. But two assets make an agent-first pivot high-leverage rather than a rebuild:

- **Flow-AI is already ~75% of a Cursor/Claude-style agent.** Production Anthropic tool-use loop, **~44 real platform tools**, confirm-before-mutate plan cards, credit metering, cross-conversation memory, native web search, streaming SSE, and **rich inline cards already rendering in chat** (live task progress, inline image/video/audio + lightbox, template/choice pickers), with reconnect/replay resilience.
- **"Render a flow inside chat" already exists.** The chat is an ordered, typed, persisted block stream. The richer canvases (ad-builder node graph, video-studio pipeline, design-layout `JSON→canvas` renderer) are reusable blueprints.

## 2. The decision

| Option | Verdict |
|---|---|
| **Agent-first hybrid** ✅ | Agent is the front door (fixes "lost"); 23 areas become ~7 agent-summonable workspaces; backend modularizes behind the tool layer. Builds on the 75%-done agent. |
| Multi-app suite | Rejected — separate URLs/landings *fragment* UX further and throw away the orchestration layer. |
| Nav-only reorg | Rejected — too shallow, doesn't deliver the agent vision. |

**Reframe that unlocks it:** the two original ideas aren't either/or. Vision B (agent) is the *front door*; Vision A (separate apps) is the *organizing principle behind the agent* (workspaces), and backend modularization comes mostly **for free** because every agent tool already *is* a clean capability boundary.

## 3. Target architecture (layers)

1. **Shell** — the post-login home becomes the Flow-AI chat surface (promoted from the `/flow-ai` overlay). Default action = "tell the agent"; a persistent **workspace rail** offers focused entry points.
2. **Workspaces (~7)** — each is both a standalone focused UI *and* an agent-renderable inline canvas block, over the same underlying state.
3. **Agent core** — the existing `runFlowAgent` loop, upgraded: higher model tier for complex turns, larger token/iteration budget, visible thinking trace, full tool set.
4. **Canvas / artifact system** — new keyed `update_block` mutation channel + a block-renderer registry → live editable artifacts in chat.
5. **Capability / tool layer** — every platform action is a tool; this doubles as the modularization seam.
6. **Platform core** — User/auth, Credits, Brand, DB, S3, Notifications (shared; contracts tightened over time).

## 4. Workspace taxonomy (collapse 23 → ~7)

| Workspace | Folds in (current domains) |
|---|---|
| **Create** | Design studio, logo generator, video studio, cartoon maker, media library, branded image |
| **Publish** | Social accounts, posts, feed, scheduling, content calendar |
| **Grow** | Content automation/strategy, email, SMS, WhatsApp, ads/ad-builder, story-ad campaigns |
| **Sell** | Store builder, products, orders, customers, delivery, storefronts, pricing |
| **Web** | Website builder, landing pages, domains |
| **Outreach** | Contacts/lists, ListSmartly (reviews/local SEO), pitch board/proposals, follow-ups, surveys/forms, events |
| **Business** | Brand kit, analytics, credits/billing, teams, referrals/earnings, settings, agent marketplace, admin |

Rule: **no feature is lost** — every existing page stays reachable *inside* a workspace.

## 5. Workstreams

### WS1 — Agent as the new home
- Promote `src/components/flow-ai/flow-ai-shell.tsx` from overlay to the primary home route.
- Universal composer on the home: routes to the agent, which answers / renders a card / opens a workspace inline / deep-links.
- Migrate the 23-section nav into the 7-workspace IA (keep everything reachable).
- First-run onboarding: agent greets, reads brand kit (`who_am_i`, `get_brand_identity`), suggests first actions.
- Reposition the public marketing site around "your AI marketing team, in a chat."
- **Mobile-first (required):** a tailored mobile experience — drawer nav (not the desktop rail), compact topbar, full-width chat + composer, full-screen workspace panel. Not a shrunk desktop.
- **Everything AI-driven, nothing hardcoded:** time-aware greeting with the real first name; personalized starter suggestions generated from the brand kit (`/api/flow-ai/suggestions`, localized fallback only); the real Flow-AI agent loop (no scripted cards/proposals).
- **Multi-account (agents):** users who manage multiple businesses get a top **Agent Mode banner** + the brand chip as a **business-switcher dropdown**, wired to `/api/agent/clients` + `/api/agent/impersonate` (POST `{clientId}` to switch, DELETE to exit). Switching reloads `/home` in the new business's context.

### WS2 — Live in-chat editable canvas (artifacts)
The single missing primitive everywhere is **keyed in-place block mutation**. Tasks:
- Add `update_block` to the `AgentEvent` union (`src/lib/ai/flow-agent/tool-context.ts`), server block assembly (`src/app/api/flow-ai/agent/route.ts`), client parse (`src/components/flow-ai/use-agent-stream.ts`), and persistence (`AIMessage.metadata.blocks`). Blocks become **keyed + mutable**, not append-only.
- Refactor `MessageBlocks` (`agent-cards.tsx`) from hard-coded if/else into a **renderer registry** (`Record<blockType, Component>`).
- Add a structured response channel `POST /api/flow-ai/agent/respond {requestId, value}` (mirrors the existing `/confirm`) so canvas sub-elements report structured values instead of synthesized prose.
- Reuse the strongest existing renderers as canvas internals:
  - **Editable design canvas** ← `src/lib/ai/design-layout-types.ts` (`AIDesignLayout`) + `src/components/studio/utils/layout-to-canvas.ts` (typed union + single switch renderer + placeholder states).
  - **Pipeline flow** (ad / story-ad / **video-studio flow the user explicitly wants in-chat**) ← `src/components/ad-builder/use-ad-campaign.ts` state-as-source + per-asset status enums + optimistic-reconcile.
- Build 3 artifacts end-to-end as proofs: editable design canvas, ad/story-ad campaign flow, video-studio flow.

### WS3 — Fill capability gaps + upgrade the brain
- **Model upgrade:** Flow-AI runs on Haiku with `MAX_TOKENS=2048` / `MAX_ITERATIONS=8`. Route complex/multi-tool turns to Sonnet/Opus-class (Opus 4.8 / Sonnet 4.6), raise budgets, and emit the already-defined-but-unused `thinking` event for a visible reasoning trace. Tiered routing (cheap turns stay on Haiku).
- **Fill the ~11 advertised-but-unexecutable features** with real `FlowAgentTool`s: logo generator, voice studio, design studio (converges with WS2), background remover, business plan, analytics/reporting, SMS campaign, cartoon maker, content automation, lead magnets, lead finder.
- **Harden the plan/confirm state machine:** idempotency + dedup (duplicate confirm cards are a known bug), fewer confirmations for cheap/reversible actions, server-computed cost estimates (stop letting the LLM guess cost).
- Add a generic `open_workspace` / `navigate` tool (ties WS1 + WS2 together).

### WS4 — Legacy surface reskin (new-design integration)
Every pre-pivot route still wears the **old dashboard chrome** (legacy Header +
Sidebar, bespoke spinners, hardcoded colors). Bring each into the new design
**one route/area at a time** (reviewable per step) — no feature lost:
- **Consistency pass (default first, low-risk):** replace bespoke spinners
  (`AISpinner`, `FlowActionSpinner`, raw `animate-spin` / `Loader2`) with the
  shared **`FlowLoader`** ([[shared-loader-rule]]); normalize hardcoded colors to
  theme tokens so **light / grey / dark** all work; align cards, spacing, and the
  brand mark to the agent-home aesthetic.
- **Shell hosting (progressive):** render the route inside the new **rail +
  topbar** so it lives in the agent-first frame, with the agent reachable beside it.
- **Order:** shared dashboard chrome (sidebar/header) → **Business** (settings,
  brand, analytics, billing) → the remaining workspaces' pages.
- Rule (unchanged): no feature lost; each page stays reachable inside its workspace.
- **Hard rule ([[new-design-no-legacy]]):** the new design NEVER links to a legacy route. Every legacy surface is reinvented in the new style under the new design's **own route namespace** (rooted at `/home`); CTAs/menus open a new-design surface or drive the agent — never `/brand`, `/settings`, `/content/strategy`, etc. Legacy may still be edited as needed during the transition, but users in the new UI are never sent there.

## 6. Sequencing (each phase shippable)

- **Phase 0 — Mockups & contracts (next).** Interactive HTML mockups in `design/`: agent home + workspace rail, and the in-chat editable canvas (design artifact + a pipeline flow). Lock the 7-workspace IA and the `update_block` + `respond` contracts. *(CLAUDE.md: mock before building.)*
- **Phase 1 — Agent home + IA (WS1)** + the model upgrade & thinking trace (small, helps everything). Ships the "lost users" fix.
- **Phase 2 — Canvas primitive + first artifacts (WS2 core).**
- **Phase 3 — Capability completion (WS3):** dead-ends → real tools, confirm/plan hardening, `open_workspace`.
- **Phase 3.5 — Legacy surface reskin (WS4):** migrate old routes to the new design system **one at a time**, consistency-pass first (shared `FlowLoader` + theme tokens + brand), then progressively host inside the agent shell. Runs alongside Phase 3/4; start with the shared dashboard chrome.
- **Phase 4 — Backend modularization behind tools** (ongoing, low urgency): extract Admin + Billing first (cheap, isolated), then formalize per-domain tool/repository contracts.

## 7. Risks / open decisions
- **Cost:** Opus/Sonnet on every turn is pricey → tiered routing. (No customers now → start generous, optimize later.)
- **Confirm-gate brittleness** must be fixed before the agent carries primary traffic.
- **No feature loss** during IA migration — audit every current route into a workspace.
- **Backend split is deliberately deferred** — low user-facing ROI vs. the UX pivot; a full microservice/DB-federation split is 12–16 weeks and not warranted yet.

## 8. Status & next
- **Phase 0** (mockups) ✅ · **Phase 1** (agent home + IA, mobile, multi-account, AI-driven) ✅ · **Phase 2 core** (focused-view split + editable Design Studio + `update_canvas` agent→canvas binding + deep-linkable conversation history) ✅.
- **Next:** continue Phase 2 artifacts (ad/story-ad + video-studio flows) **and** begin **WS4 legacy reskin one route at a time** — start with the shared dashboard chrome (Sidebar/Header), then Business (settings first). Each step ships + is reviewed before the next.

## Key files (anchors)
- Shell / UI: `src/components/flow-ai/{flow-ai-shell,use-agent-stream,agent-cards}.tsx`
- Agent loop / tools: `src/lib/ai/flow-agent/{agent-loop,registry,system-prompt,feature-catalog}.ts`, `src/lib/ai/flow-agent/tools/*`
- Event/block vocabulary: `src/lib/ai/flow-agent/tool-context.ts`
- Transport / reconnect: `src/app/api/flow-ai/agent/route.ts`, `src/app/api/flow-ai/tasks/[id]/stream/route.ts`
- Structured-UI renderer: `src/lib/ai/design-layout-types.ts`, `src/components/studio/utils/layout-to-canvas.ts`
- State-as-source blueprint: `src/components/ad-builder/use-ad-campaign.ts`, `src/lib/story-ad-campaign/types.ts`
- Step-flow graph engine (mockup): `design/studio-node-canvas-mockup.html`
