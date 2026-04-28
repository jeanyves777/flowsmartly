# Studio Create Chat — Design Spec

**Date:** 2026-04-26
**Status:** Approved by user — implementation in progress
**Scope:** Phase 1 (Image + Video). Phase 2 = templates migration.

## Why

Replace the static Create modal at `/studio` (and the parallel templates search modal) with a single conversational front door — Claude orchestrates a chat that collects details and dispatches to the existing visual / layout / video / remix worker agents. After Phase 2, all design entry points (preset templates, search, recreate) route through the same chat with Claude as the control point.

UI brand-neutral: never says "Claude". User sees "FlowAI" / sparkles icon.

## Decisions (from brainstorm)

1. **Orchestration**: Tool-using Claude loop via existing `runWithTools()` framework (same pattern as `image-pipeline-agent.ts`).
2. **Scope v1**: Image + Video. Templates migration is Phase 2.
3. **Dispatch**: Auto-dispatch when agent has enough info → result lands in chat as image card with [Open in Canvas] [Regenerate] [Edit] actions. Modal stays open for iteration.
4. **Persistence**: B+C hybrid — `DesignChat` table; designs reference their producing chat; chat history sidebar lists all chats independently of /designs grid.
5. **Iteration**: Branched. Agent decides between cheap edit (`dispatch_remix`) and fresh generation (`dispatch_design`) based on how different the request is. Branches render as parallel cards in chat.
6. **Scaffolding**: Full-page overlay route `/studio/create/[chatId]` (Linear-style compose view — feels modal but is a real route, shareable URLs, sidebar real estate).
7. **Entry**: Smart default — chat input focused on open, agent infers Image vs Video from first message. Falls back to mode-picker card when ambiguous.
8. **Reference image flow**: Agent asks proactively when relevant. Paperclip on chat input lets users upload anytime. The reference picker is unified — one card with two sources: upload OR browse system templates inline.
9. **Templates absorbed**: Search modal becomes a panel inside the reference picker that lives in the chat. Phase 1 hooks templates as ONE optional tool (`request_reference` with `allowBrowse: true`), Phase 2 deletes the standalone modal.
10. **Phase 1 ↔ 2 bridge**: Phase 1 already pulls from `/api/studio/templates/generate` for the inline browse panel. Phase 2 just removes the legacy search modal.

## Architecture

### Data model

```prisma
model DesignChat {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(...)
  title       String   // auto-generated from first user message
  state       String   // JSON blob: collected fields (mode, prompt, size, brandColors, etc.)
  status      String   @default("active") // active | archived
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  turns       DesignChatTurn[]
  designs     Design[] // reverse relation — designs spawned from this chat
  @@index([userId, updatedAt])
}

model DesignChatTurn {
  id          String     @id @default(cuid())
  chatId      String
  chat        DesignChat @relation(...)
  role        String     // user | agent | system
  content     String     // free-form text
  cards       String?    // JSON: array of card specs the agent emitted
  attachments String?    // JSON: array of references (uploaded urls + library template ids)
  branchId    String?    // for branched iteration: which branch this turn belongs to
  createdAt   DateTime   @default(now())
  @@index([chatId, createdAt])
}

// Add to existing Design model:
model Design {
  // ... existing fields
  chatId      String?    // chat that produced this design
  chat        DesignChat? @relation(...)
  branchId    String?    // which branch within the chat
}
```

### Backend tools (Claude tool loop)

The agent's tool surface — kept minimal:

- `show_card({ type, payload })` — UI primitive. Card types: `mode_picker`, `size_picker`, `brand_toggle`, `social_handles`, `contact_info`, `confirm_summary`, `result`, `branch_compare`.
- `request_reference({ allowUpload: true, allowBrowse: true, suggestedQuery?: string })` — opens the unified reference picker. User uploads OR browses inline templates (calls existing `/api/studio/templates/generate`).
- `dispatch_design({ mode: "smart_layout" | "ai_image", fields })` — fires `/api/ai/design-layout` or `/api/ai/visual` with collected state.
- `dispatch_video({ fields })` — fires `/api/ai/video-studio/generate`.
- `dispatch_remix({ sourceImageUrl, customText, photos, useBrandColors, fromBranchId? })` — fires `/api/studio/templates/remix`. Used for "edit this exact image" iteration.
- `branch_variant({ fromTurnId, changeDescription })` — forks a new variant from an existing result; emits a parallel image card.
- `update_state({ patch })` — agent merges a partial state update into the chat's persisted `state` blob.

### API routes

- `POST /api/studio/chat` — create new chat session, return `{ chatId }`. Optional body: `{ initialPrompt }` to seed first user message.
- `GET  /api/studio/chat` — list user's chats for sidebar (paginated, sorted by updatedAt desc).
- `GET  /api/studio/chat/[chatId]` — fetch chat metadata + turn history (for resume).
- `POST /api/studio/chat/[chatId]/turn` — submit user turn (text + optional attachments). Server appends turn → runs Claude tool loop → streams agent response (text + cards + dispatched-job updates) via SSE. Returns when stream closes.
- `DELETE /api/studio/chat/[chatId]` — archive (soft delete).
- `PATCH /api/studio/chat/[chatId]` — rename.

### Frontend route

- `/studio/create/[chatId]` — Next.js page (server component shell + client chat). Full-screen overlay UI. Layout:
  - Left rail (collapsible): list of past chats, "+ New chat" button.
  - Main: chat thread (message bubbles + cards + image results + branches as horizontal scroll within a turn).
  - Bottom: chat input with paperclip / image upload, send button, credit badge.
  - Top right: close button (returns to /studio).
- The existing "Create" button trigger from /studio creates a new chat (`POST /api/studio/chat`) and routes to `/studio/create/{newId}`.

### Agent system prompt outline

```
You are FlowAI's design assistant. The user wants to create a design (image or video). Your job is to:
1. Classify the user's intent (image vs video).
2. Collect the minimum details needed to dispatch a worker — prompt, size, optional reference, optional brand toggle, optional CTA.
3. When you have enough, dispatch using the appropriate tool.
4. After a result lands, support iteration — fresh generation, edits, or branched variants.

NEVER mention you're Claude or any model. You are FlowAI.
[+ behavior rules: when to ask for reference, when to confirm vs auto-dispatch, etc.]
```

## Card spec types (UI side)

Each card is a typed JSON blob the agent emits via `show_card`:

```ts
type Card =
  | { type: "mode_picker"; options: ("image" | "video")[] }
  | { type: "size_picker"; presets: Array<{ name: string; w: number; h: number }> }
  | { type: "reference_picker"; allowUpload: boolean; allowBrowse: boolean; suggestedQuery?: string }
  | { type: "brand_toggle"; brandKitColors: object }
  | { type: "social_handles" }
  | { type: "contact_info" }
  | { type: "confirm_summary"; collected: object }
  | { type: "result"; designId: string; imageUrl: string; branchId: string }
  | { type: "branch_compare"; branchIds: string[] };
```

## Phasing within Phase 1 (build order)

1. **Schema** — DesignChat + ChatTurn + Design.chatId. `prisma db push`.
2. **Backend agent skeleton** — empty tool loop, all tools stub-returning, but the SSE stream wired up.
3. **API routes** — create / list / read / turn endpoints (stub agent).
4. **Frontend route** — `/studio/create/[chatId]` shell, message list, input box. No cards yet — text-only chat.
5. **Card library** — render-side card components for each type.
6. **Wire `dispatch_design` → existing `/api/ai/visual`** — first end-to-end image generation through chat.
7. **Wire `request_reference` + inline browse** — pulls from existing `/api/studio/templates/generate`.
8. **Wire `dispatch_video`**.
9. **Wire `dispatch_remix` for iteration**.
10. **Wire `branch_variant` for branched UI**.
11. **Sidebar** — chat history list.
12. **Reroute** — old Create modal button → new chat. Old templates search modal kept alive but lower-priority.
13. **Type-check, build, deploy.**

## Out of scope for Phase 1

- Templates search modal removal (Phase 2).
- Migrating preset templates browse to chat-only entry.
- Mobile-specific tuning of the chat layout (desktop-first ship).
- Video iteration / branched video (videos always fresh-dispatch; no remix in v1).
- Voice input.
- Public / shared chat URLs (chats are private to the user; URLs work but require login).

## Risks

- **Scope creep**: 13-step build order is large. Phase 1 PR will be 2000+ lines.
- **Tool-loop cost**: Every turn runs Claude. Need to budget — adaptive thinking + tool calls ≈ $0.05-0.15/turn. 10-turn chat = ~$1. Fits in current credit margin if we charge ~10cr/turn for chat overhead OR roll it into the dispatch costs.
- **SSE streaming complexity**: Need server-sent events for live tool-call updates. Next.js App Router supports it but error handling is fiddly.
- **Existing modal users disrupted**: New chat is a meaningful UX shift. Suggest soft launch: chat is the default, "old way" link still available behind a feature flag.
