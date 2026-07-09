import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getAgentModel } from "@/lib/ai/agent-model";
import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import type { CreditCostKey } from "@/lib/credits/costs";
import { ensureToolsRegistered, flowAgentTools, type FlowAgentTool } from "./registry";
import { buildAgentSystemPrompt } from "./system-prompt";
import { nextSeqForConversation } from "./conversation-seq";
import { loadImageAsVisionBase64 } from "./load-image-buffer";
import type {
  AgentEvent,
  ToolContext,
  ToolResult,
} from "./tool-context";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Friendly one-line action name for the auto-confirm card the loop shows when a
 *  mutating tool is called without a prior propose_plan. */
function friendlyActionLabel(toolName: string): string {
  const LABELS: Record<string, string> = {
    create_branded_design: "Create your design",
    generate_image: "Generate the image",
    edit_image: "Edit the image",
    export_image: "Export the image",
    generate_video: "Generate the video",
    create_avatar_video: "Create the avatar video",
    create_presentation: "Create the presentation",
    create_visual_deck: "Create your visual deck",
    schedule_social_post: "Schedule the post",
    create_email_campaign: "Create the email campaign",
    send_email_campaign: "Send the email campaign",
    send_test_email_campaign: "Send a test email",
    create_automation: "Create the automation",
    update_automation: "Update the automation",
    create_content_campaign: "Create the content campaign",
    improve_content_campaign: "Improve the content campaign",
    deep_enrich_lead: "Get deeper lead details",
    create_proposal: "Create the proposal",
    create_pitch: "Create the pitch",
    send_proposal: "Send the proposal",
    build_website: "Build the website",
    build_store: "Build the store",
    start_story_ad_campaign: "Create the story-ad movie",
    configure_whatsapp_agent: "Set up the WhatsApp assistant",
    update_brand_identity: "Save your brand kit",
  };
  return LABELS[toolName] ?? `Run ${toolName.replace(/_/g, " ")}`;
}

/**
 * Flow-AI streaming agent loop.
 *
 * Wraps Anthropic's `messages.stream` with FlowSmartly's tool registry,
 * credit charging, audit logging, and a confirm-before-mutate protocol.
 *
 * Emits SSE-friendly AgentEvents — the API route forwards them straight to
 * the client. The loop NEVER throws past its boundary: any error becomes
 * an `error` event so the chat never silently dies (see
 * feedback-no-stuck-ai-chat).
 *
 * Key contract with tools:
 *  - Tool handlers return `ToolResult` (ok | structured error). They
 *    never throw. If they do throw, we wrap into an internal error result
 *    so the LLM still sees something it can respond to.
 *  - Mutating tools (mutating=true) require a confirmed plan_proposal —
 *    when the agent calls a mutating tool without one, we return a
 *    `validation_failed` result asking it to propose_plan first. This is
 *    a soft nudge, not a hard refusal — the LLM reads the error and tries
 *    again the right way.
 *  - The loop charges credits BEFORE running the handler. Out-of-credits
 *    returns `{ ok: false, error_code: "insufficient_credits" }` to the
 *    LLM so it can propose a top-up.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Model: pulled from the database (admin-editable via SystemSetting), defaulting
// to the CHEAPEST model (Haiku). Standing project rule — never Opus/Sonnet.
// See getAgentModel(). Budgets kept conservative for cost.
const MAX_ITERATIONS = 8;
const MAX_TOKENS = 2048;

export interface AgentRunInput {
  userId: string;
  isAdmin: boolean;
  /** User opted into premium "Super" mode — premium model + AGENT_MESSAGE_SUPER surcharge. */
  superMode?: boolean;
  plan: string;
  conversationId: string;
  /** Assistant message row id this turn writes into. */
  messageId: string;
  /** User's freshly-saved message — already persisted by the caller. */
  userMessage: string;
  /** Optional image attachments — fed to Claude vision on the triggering turn. */
  attachments?: Array<{ mediaType: string; dataBase64: string }>;
  /** S3 URLs of the uploaded attachments — the agent can pass these as media to tools. */
  attachmentUrls?: string[];
  /** Prior turns to seed Claude's context. Most recent last. */
  history: Array<{
    role: "user" | "assistant";
    content: string;
    metadata?: string | null;
    /** Persisted media on the turn (e.g. an image the user uploaded earlier). */
    mediaType?: string | null;
    mediaUrl?: string | null;
  }>;
  /** Client-supplied wall clock + tz so "Monday at 4pm" resolves correctly. */
  clientNow?: string;
  timezone?: string;
  /** Live background-task status for this conversation (agent awareness). */
  recentTasks?: Array<{ id: string; kind: string; status: string; note?: string; resultUrl?: string | null }>;
  /** Plans proposed earlier in this conversation + status (cancel/confirm awareness). */
  recentProposals?: Array<{ summary: string; status: string; totalCreditCost: number }>;
  /**
   * When set, a design canvas is open in the focused view. Its serialized state
   * is injected into the system prompt and the `update_canvas` tool is exposed
   * so the agent can edit the on-screen design. Absent on other surfaces.
   */
  canvasContext?: string;
  /**
   * A human description of WHICH focused surface the user is on (Brand, Sell,
   * Publish, …) plus a little of its state. Injected into the system prompt so
   * the agent interprets the message in-context and acts on the right surface
   * instead of asking generic questions. Unlike `canvasContext`, this does NOT
   * expose update_canvas (that's design-only).
   */
  surfaceContext?: string;
  /** Aborts the loop when the client disconnects. */
  abortSignal: AbortSignal;
  /** Emit SSE event back to the client. */
  emit: (event: AgentEvent) => void;
  /**
   * Wait for the user to respond to a propose_plan card. Returns true on
   * Confirm, false on Cancel. The API layer wires this to a shared event
   * bus (see /api/flow-ai/agent/confirm). For now, a default no-op rejects
   * after a timeout so the chat never hangs.
   */
  awaitConfirmation: (planId: string) => Promise<boolean>;
}

export interface AgentRunResult {
  finalText: string;
  iterations: number;
  tokensUsed: number;
  creditsUsed: number;
  toolsUsed: string[];
  proposedPlans: string[];
}

interface PendingPlan {
  id: string;
  confirmed: boolean | null;
}

export async function runFlowAgent(input: AgentRunInput): Promise<AgentRunResult> {
  await ensureToolsRegistered();

  const tools = flowAgentTools.forPlan(input.plan);
  // Gate the canvas-write tools by WHICH canvas is open (focused view). The
  // canvasContext is tagged: `[ADBUILDER]…` for the Ad builder, `[FOLLOWUP]…` for
  // Follow-ups, otherwise it's the design canvas. Each surface only sees its own
  // live-fill tool so the agent can't call one out of context.
  const cc = input.canvasContext || "";
  const isAdCanvas = cc.startsWith("[ADBUILDER]");
  const isFollowupCanvas = cc.startsWith("[FOLLOWUP]");
  const isStoryAdCanvas = cc.startsWith("[STORYAD]"); // the /home/video Video Studio canvas
  const isDesignCanvas = !!cc && !isAdCanvas && !isFollowupCanvas && !isStoryAdCanvas;
  const DESIGN_CANVAS_TOOLS = new Set(["update_canvas", "add_canvas_object", "add_design_page", "start_print_project", "place_design_on_product"]);
  const exposedTools = tools.filter((t) => {
    if (DESIGN_CANVAS_TOOLS.has(t.name)) return isDesignCanvas;
    if (t.name === "update_ad_canvas") return isAdCanvas;
    if (t.name === "update_followup_canvas") return isFollowupCanvas;
    // draft_story_ad_campaign only makes sense with the Video Studio canvas open to
    // receive the draft. Elsewhere, video creation uses start_story_ad_campaign.
    if (t.name === "draft_story_ad_campaign") return isStoryAdCanvas;
    return true;
  });
  const clientToolDefs = exposedTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));
  // Anthropic NATIVE server-side tools — Anthropic runs these server-side
  // and bakes results (with citations) into the assistant turn. We don't
  // dispatch a handler for them; we just iterate past their `server_tool_use`
  // + `web_search_tool_result` blocks. Always registered: the ANTHROPIC_API_KEY
  // gates the whole agent, so there's no extra cred to check.
  // max_uses caps searches PER TURN. 5 was too low for lead work (bulk enrich
  // needs ~1 search per lead, so it stalled after 5); 20 lets a typical batch
  // (e.g. enrich 20 leads) finish in one turn while still bounding runaway spend.
  const serverToolDefs: Anthropic.WebSearchTool20250305[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: 20 },
  ];
  // Join client tools + server tools into the single `tools` array the
  // Messages API expects. The discriminated `ToolUnion` covers both —
  // our plain JSON-Schema client tools satisfy the basic `Tool` arm.
  const toolDefs = [
    ...clientToolDefs,
    ...serverToolDefs,
  ] as unknown as Anthropic.ToolUnion[];
  const toolByName = new Map(tools.map((t) => [t.name, t] as const));

  // Track which plan_proposal IDs the user has confirmed in this turn —
  // a mutating tool that runs AFTER its plan was confirmed gets a pass on
  // the "must propose first" check. Resets per agent turn.
  const confirmedPlans = new Set<string>();

  let systemPrompt = await buildAgentSystemPrompt({
    userId: input.userId,
    clientNow: input.clientNow,
    timezone: input.timezone,
    recentTasks: input.recentTasks,
    recentProposals: input.recentProposals,
    userMessage: input.userMessage,
  });

  // Focused-view canvas: tell the model what's on screen + how to edit it live.
  if (isAdCanvas) {
    systemPrompt +=
      `\n\n## Active Ad builder canvas (focused view)\n${cc}\n\n` +
      "The user has the Ad builder canvas OPEN. When they ask you to build / generate / write / run the ad — or they hand you a description or a link — FILL THE CANVAS LIVE with `update_ad_canvas` so it appears on screen as you work: set the source (product/link/describe), write a strong, specific, on-brand HEADLINE + a punchy description + a fitting CTA (NEVER a placeholder), pick the goal/category and ONLY their ENABLED placements, and set a sensible budget. Do this FIRST (in one or a few update_ad_canvas calls), then reply in ONE short sentence. Ask a single follow-up only if you genuinely cannot proceed. When the user wants to LAUNCH, call propose_plan with the exact credit cost; on confirm, create & launch it (it goes to review → live and shows in their Library). It's FREE and instant — fill the canvas first, talk second.";
  } else if (isFollowupCanvas) {
    systemPrompt +=
      `\n\n## Active Follow-ups flow canvas (focused view)\n${cc}\n\n` +
      "The user has the Follow-ups flow canvas OPEN. When they ask you to build / generate / write the follow-up sequence, FILL THE CANVAS LIVE with `update_followup_canvas` so it appears on screen: set the audience mode and write the ordered, genuinely-good PERSONALIZED message steps (use {{first_name}} / {{company}} merge fields; set each step's channel, timing/waitDays and copy — never leave a step empty). Do this FIRST, then reply in ONE short sentence. Ask a single follow-up only if needed. When they want it live, call propose_plan; on confirm, create & schedule it. It's FREE and instant — fill the canvas first, talk second.";
  } else if (isStoryAdCanvas) {
    systemPrompt +=
      `\n\n## Active Video Studio canvas (focused view)\n${cc}\n\n` +
      "The user has the Video Studio (/home/video) canvas OPEN — a DRAFT-FIRST video-ad playground. When they ask you to make / plan / draft a video ad, call `draft_story_ad_campaign` (write the `brief` from their request; pick style cinematic/3d/narrated + durationSeconds 30/60/90). It DRAFTS the cast + a scene-by-scene script onto the canvas as review cards WITHOUT rendering — the user then reviews each node and generates the scene clips + final video on demand. Draft FIRST, then reply in ONE short sentence pointing them to the canvas to review + generate. Do NOT use start_story_ad_campaign here (that auto-renders elsewhere); the whole point of this surface is review-first. Only ask a single follow-up if you genuinely can't write the brief.";
  } else if (isDesignCanvas) {
    systemPrompt +=
      `\n\n## Active design canvas (focused view)\n${cc}\n\n` +
      "When the user asks to change the on-screen design — wording, accent color, size, or button — call `update_canvas` with ONLY the fields that change (a patch), using the allowed accent hexes and sizes above. Keep edits minimal and on-brand. After it runs, confirm what you changed in ONE short sentence. Do NOT call update_canvas unless the user actually wants a canvas change.\n" +
      "When the user asks to ADD or place something on the canvas — an object/element ('add a laptop', 'put my product in', 'add an illustration') or a new background ('give it a nicer background') — call `add_canvas_object` (type 'element' or 'background'), NOT create_branded_design. It generates just that piece and drops it onto the OPEN canvas, keeping the user's current text/layout/coordinates. For a background pass the `size` from the canvas context and keep the prompt consistent with the current design. Only use create_branded_design when the user explicitly wants the WHOLE design re-rendered as a new image — never assume that from an 'add X' request.\n" +
      "MULTI-PAGE / MULTI-SLIDE: this canvas supports multiple pages. When the user asks for a PRESENTATION, a deck, a carousel, or a multi-page design, build EACH page in turn: design the current page (update_canvas for the copy/accent/size, add_canvas_object for visuals), then call `add_design_page` to start the next slide, fill it, and repeat until you've built every page they asked for. Use a consistent style/accent across the set; pick a fitting size first (e.g. 1080×1080 for a carousel). Briefly say how many pages you built when done.\n" +
      "PRINT STUDIO: if the user wants something to PRINT — a flyer, poster, business card, table tent, bi-fold/tri-fold brochure, or postcard — FIRST call `start_print_project` with the right `format` to open the print canvas (it sets the print size + style and shows bleed/safe/fold guides), THEN design it with the SAME tools (update_canvas for copy/accent/print size, add_canvas_object for visuals, and `add_design_page` for multi-side/multi-panel pieces — card front/back, brochure panels). Keep important content inside the safe area and mind the fold lines. Use a consistent on-brand look across panels.\n" +
      "PRODUCT PRINTS (apparel / hi-vis vest / mug / tote): when a product mockup is open, put a design on it with `place_design_on_product`. FIRST generate the artwork with generate_image (a TRANSPARENT PNG for a logo/graphic so it sits cleanly on the garment), THEN call place_design_on_product with that artworkUrl plus the product, face (front/back) and placement (left-chest, full-front, full-back, wrap, badge, center). To print both sides, generate + place each side separately. You can also set the garment colour. The mockup is for visualisation; the user orders from it.";
  }

  // Surface awareness: the user opened a specific workspace (Brand, Sell, …).
  // Tell the model WHERE they are so it acts on that surface instead of replying
  // with a generic "what would you like to do?" menu.
  if (input.surfaceContext) {
    systemPrompt +=
      `\n\n## Where the user is right now (focused surface — IMPORTANT)\n${input.surfaceContext}\n` +
      "Interpret the user's message in THIS context. If what they say is relevant to this surface (e.g. they pasted business info while on the Brand surface, or named a product while on Sell), ACT on it here per the operate-the-account rules — infer the details, propose_plan, then call the matching tool. Do NOT respond with a generic capabilities menu or ask 'what would you like to do?' when the surface already tells you what they're working on.";
  }

  // Seed Claude with prior conversation. Skip the just-saved user message —
  // we pass it as the LAST user turn separately so it stays adjacent to
  // the assistant response.
  //
  // CRITICAL: annotate any prior user turn that carried an uploaded image
  // with its persisted URL. The base64 vision is only ever passed on the
  // upload turn — so after a follow-up turn (or a system reload / pm2 reload
  // that wipes the in-flight stream) the agent rebuilds context from
  // text-only history and FORGETS an image was ever shared, then asks the
  // user to re-upload it. The URL note restores that awareness at zero cost
  // and tells the agent how to act on the image again.
  let mostRecentImageUrl: string | null = null;
  const annotateImageTurn = (content: string, url: string): string =>
    `${content}\n\n[The user shared an image earlier in this conversation — URL: ${url}. It is still available: read it with read_image, edit it with edit_image, or pass it as referenceImageUrls for a branded design (keeps the real person/product). NEVER ask the user to re-send an image they already shared, and never swap in a different one.]`;

  const filteredHistory = input.history.filter((m) => m.content?.trim().length > 0);
  const priorMessages: Anthropic.MessageParam[] = filteredHistory.map((m, i) => {
    const isLast = i === filteredHistory.length - 1;
    const hasImage = m.role === "user" && m.mediaType === "image" && !!m.mediaUrl;
    if (hasImage) mostRecentImageUrl = m.mediaUrl as string;
    // Don't annotate the triggering turn — it's handled by the attachments
    // block (fresh upload) or the vision re-injection block (prior image)
    // below. Annotating it would also break the dedup check that follows.
    const content = hasImage && !isLast ? annotateImageTurn(m.content, m.mediaUrl as string) : m.content;
    return { role: m.role, content };
  });

  // The triggering user message is the final entry of priorMessages because
  // the caller persisted it before calling us. Confirm and remove tail if dup.
  if (priorMessages.length === 0 || priorMessages[priorMessages.length - 1].content !== input.userMessage) {
    priorMessages.push({ role: "user", content: input.userMessage });
  }

  // SDK 0.100 expanded `MessageParam.role` to include "system"; our local
  // shape stays "user" | "assistant" since we never emit a system role here.
  const messages: Array<{ role: "user" | "assistant"; content: any }> = priorMessages.map(
    (m) => ({ role: m.role as "user" | "assistant", content: m.content }),
  );

  // If the triggering turn carried image attachments, rebuild the LAST
  // user message as multimodal content blocks (text + images) so Claude
  // can see them. Anthropic accepts base64 image blocks alongside text.
  if (input.attachments && input.attachments.length > 0) {
    const lastUserIdx = messages.length - 1;
    if (lastUserIdx >= 0 && messages[lastUserIdx].role === "user") {
      // Tell the agent the URLs so it can USE the image (e.g. pass it as
      // mediaUrl to schedule_social_post) — not just look at it.
      const urlNote =
        input.attachmentUrls && input.attachmentUrls.length > 0
          ? `\n\n[The user uploaded ${input.attachmentUrls.length} image(s) — URL(s): ${input.attachmentUrls.join(", ")}. You MUST use these real images, never generate a stand-in. For a BRANDED DESIGN/flyer/card (create_branded_design), pass them as referenceImageUrls so the real person/product is kept (identity preserved). For a plain social post (schedule_social_post), pass as mediaUrl. Never invent a different face/photo when the user handed you one.]`
          : "";
      const textPart = { type: "text", text: `${input.userMessage}${urlNote}` };
      const imageParts = input.attachments.map((a) => ({
        type: "image",
        source: { type: "base64", media_type: a.mediaType, data: a.dataBase64 },
      }));
      messages[lastUserIdx] = { role: "user", content: [textPart, ...imageParts] };
    }
  } else if (mostRecentImageUrl) {
    // No fresh upload this turn, but the user shared an image earlier in the
    // conversation (before a follow-up turn or a system reload). Re-attach
    // the most recent one as ACTUAL vision so the agent can see it again and
    // act on it directly ("remove the duplicate logo", "fix the unreadable
    // white text") instead of asking the user to re-upload. Bounded to a
    // single image; fetch is best-effort and never throws — on failure the
    // text URL annotation above still keeps the agent aware of the image.
    const vision = await loadImageAsVisionBase64(mostRecentImageUrl);
    if (vision) {
      const lastUserIdx = messages.length - 1;
      if (lastUserIdx >= 0 && messages[lastUserIdx].role === "user") {
        const existing = messages[lastUserIdx].content;
        const textPart = {
          type: "text",
          text:
            typeof existing === "string"
              ? `${existing}\n\n[Re-attaching the image the user shared earlier (URL: ${mostRecentImageUrl}) so you can see it. Act on it directly — don't ask the user to re-upload. Use edit_image with this URL to modify it.]`
              : input.userMessage,
        };
        const imagePart = {
          type: "image",
          source: { type: "base64", media_type: vision.mediaType, data: vision.base64 },
        };
        messages[lastUserIdx] = { role: "user", content: [textPart, imagePart] };
      }
    }
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCreditsUsed = 0;
  const toolsUsed: string[] = [];
  const proposedPlans: string[] = [];
  let finalText = "";

  // ─── credit charging helper (no-throw) ─────────────────────────────
  async function chargeCredits(
    costKey: CreditCostKey,
    description: string,
    refType?: string,
    refId?: string,
  ): Promise<{ cost: number; balanceAfter: number | null; ok: boolean }> {
    try {
      const cost = await getDynamicCreditCost(costKey);
      if (cost === 0) return { cost: 0, balanceAfter: null, ok: true };
      // Admins bypass via the credit service's own logic? It doesn't —
      // so short-circuit here for admin sessions.
      if (input.isAdmin) {
        return { cost: 0, balanceAfter: null, ok: true };
      }
      const result = await creditService.deductCredits({
        userId: input.userId,
        amount: cost,
        type: "USAGE",
        description,
        referenceType: refType ?? "flow_ai_agent",
        referenceId: refId ?? input.conversationId,
      });
      totalCreditsUsed += cost;
      input.emit({
        type: "credits_charged",
        amount: cost,
        costKey,
        balanceAfter: result.transaction?.balanceAfter ?? null,
      });
      return {
        cost,
        balanceAfter: result.transaction?.balanceAfter ?? null,
        ok: true,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Credit charge failed";
      // Surface to client but don't kill the stream.
      input.emit({ type: "error", message: `Credit charge failed: ${msg}`, recoverable: true });
      return { cost: 0, balanceAfter: null, ok: false };
    }
  }

  // ─── tool runner ───────────────────────────────────────────────────
  async function runTool(
    tool: FlowAgentTool,
    rawInput: Record<string, unknown>,
    toolUseId: string,
  ): Promise<ToolResult> {
    const startMs = Date.now();

    // Mutating tools need a confirmed plan first (soft check — return an
    // error result, never refuse outright. The LLM reads it and calls
    // propose_plan, then retries).
    // Which confirmed plan authorizes this mutating run? Resolve robustly so a
    // confirmed action actually RUNS instead of being re-proposed (the source of
    // duplicate plan cards + stalls):
    //  1. the planId the model passed, if the user confirmed it this turn;
    //  2. the plan the user just confirmed this turn, if the (cheap) model forgot
    //     to echo the exact planId back into the tool call;
    //  3. a plan confirmed in a PRIOR turn / after this request's blocking window
    //     ended — it lives in the DB as status "confirmed" (not in this turn's set).
    let resolvedPlanId: string | null = null;
    if (tool.mutating) {
      const planId = typeof rawInput.planId === "string" ? rawInput.planId : null;
      if (planId && confirmedPlans.has(planId)) {
        resolvedPlanId = planId;
      } else if (!planId && confirmedPlans.size > 0) {
        const row = await prisma.agentPlanProposal.findFirst({
          where: {
            id: { in: Array.from(confirmedPlans) },
            userId: input.userId,
            conversationId: input.conversationId,
            status: "confirmed",
            steps: { contains: `"toolName":"${tool.name}"` },
          },
          orderBy: { seq: "desc" },
          select: { id: true },
        }).catch(() => null);
        resolvedPlanId = row?.id ?? null;
      } else {
        const row = await prisma.agentPlanProposal.findFirst({
          where: {
            userId: input.userId,
            conversationId: input.conversationId,
            status: "confirmed",
            ...(planId ? { id: planId } : { steps: { contains: `"toolName":"${tool.name}"` } }),
          },
          orderBy: { seq: "desc" },
          select: { id: true },
        }).catch(() => null);
        if (row) { resolvedPlanId = row.id; confirmedPlans.add(row.id); }
      }
      if (!resolvedPlanId) {
        // SMART AUTO-CONFIRM. The model called a mutating tool without first
        // calling propose_plan — cheap models routinely skip the protocol and
        // then loop on the old dead-end error ("requires a confirmed plan").
        // Instead of dead-ending, WE show the user a one-step Confirm card for
        // THIS exact action (with an accurate cost) and run it on Confirm. The
        // confirm-before-charge guarantee is fully preserved — nothing runs or
        // gets charged until the user taps Confirm.
        const est = tool.autoPlanCost ? await tool.autoPlanCost(rawInput).catch(() => null) : null;
        const credits = Math.max(0, Math.round(
          est?.credits ?? (await getDynamicCreditCost(tool.costKey).catch(() => 0)) ?? 0,
        ));
        const label = est?.label ?? friendlyActionLabel(tool.name);
        const step = { id: "s1", title: label, detail: est?.detail, toolName: tool.name, creditCost: credits || undefined };
        const existingAutoPlan = await prisma.agentPlanProposal.findFirst({
          where: {
            userId: input.userId,
            conversationId: input.conversationId,
            summary: label,
            status: { in: ["pending", "confirmed"] },
            steps: { contains: `"toolName":"${tool.name}"` },
            createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
          orderBy: { seq: "desc" },
          select: { id: true, status: true },
        }).catch(() => null);
        if (existingAutoPlan) {
          const confirmed = existingAutoPlan.status === "confirmed" ? true : await input.awaitConfirmation(existingAutoPlan.id);
          if (!confirmed) {
            const errResult: ToolResult = {
              ok: false,
              error_code: "user_canceled",
              message: `The user didn't confirm "${label}". Don't run it. Briefly ask what they'd like to change.`,
              recoverable: true,
            };
            await logToolCall(tool, rawInput, errResult, toolUseId, Date.now() - startMs, 0);
            return errResult;
          }
          resolvedPlanId = existingAutoPlan.id;
          confirmedPlans.add(existingAutoPlan.id);
        }
        if (!resolvedPlanId) {
        const autoPlanId = `plan_${randomUUID().slice(0, 12)}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        try {
          const seq = await nextSeqForConversation(input.conversationId);
          await prisma.agentPlanProposal.create({
            data: {
              id: autoPlanId,
              conversationId: input.conversationId,
              messageId: input.messageId,
              userId: input.userId,
              summary: label,
              steps: JSON.stringify([step]),
              totalCreditCost: credits,
              status: "pending",
              expiresAt,
              seq,
            },
          });
        } catch { /* non-fatal — awaitConfirmation still gates execution */ }
        proposedPlans.push(autoPlanId);
        input.emit({ type: "plan_proposal", id: autoPlanId, steps: [step], summary: label, totalCreditCost: credits });
        const confirmed = await input.awaitConfirmation(autoPlanId);
        try {
          const current = await prisma.agentPlanProposal.findUnique({ where: { id: autoPlanId }, select: { status: true } });
          if (!current || current.status === "pending") {
            await prisma.agentPlanProposal.update({
              where: { id: autoPlanId },
              data: { status: confirmed ? "confirmed" : "expired", resolvedAt: new Date() },
            });
          }
        } catch { /* ignore reconcile errors */ }
        if (!confirmed) {
          const errResult: ToolResult = {
            ok: false,
            error_code: "user_canceled",
            message: `The user didn't confirm "${label}". Don't run it. Briefly ask what they'd like to change, then re-propose once you know — a cancel means "let's adjust", never go silent.`,
            recoverable: true,
          };
          await logToolCall(tool, rawInput, errResult, toolUseId, Date.now() - startMs, 0);
          return errResult;
        }
        resolvedPlanId = autoPlanId;
        confirmedPlans.add(autoPlanId);
        }
      }
    }

    // Charge BEFORE running. If charging failed (e.g. insufficient credits),
    // return a structured error the LLM can negotiate with.
    let creditCost = 0;
    if (tool.costKey && (await getDynamicCreditCost(tool.costKey)) > 0) {
      const charge = await chargeCredits(
        tool.costKey,
        `Flow-AI tool: ${tool.name}`,
        "flow_ai_tool",
        input.conversationId,
      );
      if (!charge.ok) {
        const balanceAfter = charge.balanceAfter;
        const errResult: ToolResult = {
          ok: false,
          error_code: "insufficient_credits",
          message: `Not enough credits to run ${tool.name}. Offer to top them up right here — call buy_credits (they can pick a pack or a custom amount and pay on their saved card inline), or point them to /home/credits.`,
          recoverable: true,
          meta: { balanceAfter, costKey: tool.costKey },
        };
        await logToolCall(tool, rawInput, errResult, toolUseId, Date.now() - startMs, 0);
        return errResult;
      }
      creditCost = charge.cost;
    }

    // Build the per-call context.
    const ctx: ToolContext = {
      userId: input.userId,
      isAdmin: input.isAdmin,
      plan: input.plan,
      conversationId: input.conversationId,
      messageId: input.messageId,
      abortSignal: input.abortSignal,
      emit: input.emit,
      awaitConfirmation: async (planId: string) => {
        proposedPlans.push(planId);
        const confirmed = await input.awaitConfirmation(planId);
        if (confirmed) confirmedPlans.add(planId);
        return confirmed;
      },
    };

    // Now run the tool. We catch any unexpected throw so the chat never dies.
    let result: ToolResult;
    try {
      result = await tool.handler(rawInput, ctx);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[flow-agent] Tool ${tool.name} threw:`, e);
      result = {
        ok: false,
        error_code: "internal",
        message: `Tool ${tool.name} crashed: ${message}. Tell the user something went wrong and offer to try again.`,
        recoverable: true,
      };
    }

    const durationMs = Date.now() - startMs;
    await logToolCall(tool, rawInput, result, toolUseId, durationMs, creditCost);

    // A confirmed plan that actually RAN is marked "executed" so it is not
    // re-surfaced to the model (and re-run / double-charged) on a later turn.
    // Multi-step plans still work in-turn because the id stays in confirmedPlans.
    if (tool.mutating && resolvedPlanId && result.ok) {
      await prisma.agentPlanProposal.updateMany({
        where: { id: resolvedPlanId, status: "confirmed" },
        data: { status: "executed" },
      }).catch(() => {});
    }

    // Emit a tool_call_result event so the UI can update its card.
    input.emit({
      type: "tool_call_result",
      id: toolUseId,
      name: tool.name,
      output: result,
      durationMs,
      creditCost,
      errorCode: result.ok ? undefined : result.error_code,
    });

    return result;
  }

  async function logToolCall(
    tool: FlowAgentTool,
    rawInput: Record<string, unknown>,
    result: ToolResult,
    toolUseId: string,
    durationMs: number,
    creditCost: number,
  ): Promise<void> {
    try {
      // Stamp with a monotonic per-conversation seq so the replay
      // endpoint can return events in deterministic order on reconnect.
      const seq = await nextSeqForConversation(input.conversationId);
      await prisma.agentToolCall.create({
        data: {
          conversationId: input.conversationId,
          messageId: input.messageId,
          toolName: tool.name,
          input: JSON.stringify(rawInput).slice(0, 8000),
          output: JSON.stringify(result).slice(0, 16000),
          error: result.ok ? null : result.message.slice(0, 1000),
          errorCode: result.ok ? null : result.error_code,
          creditCost,
          durationMs,
          seq,
        },
      });
    } catch (e) {
      console.error("[flow-agent] Failed to log tool call:", e);
    }
  }

  // ─── per-turn credit charge (covers the LLM call itself) ───────────
  // Super mode uses the premium model and a higher per-turn surcharge.
  await chargeCredits(
    input.superMode ? "AGENT_MESSAGE_SUPER" : "AGENT_MESSAGE",
    input.superMode ? "Flow-AI agent: assistant turn (Super)" : "Flow-AI agent: assistant turn",
  );

  // Model is admin-editable in the DB; cheapest (Haiku) by default, premium when
  // the user requested Super mode. One model for the whole turn.
  const model = await getAgentModel(input.superMode === true);

  // ─── main loop ──────────────────────────────────────────────────────
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (input.abortSignal.aborted) {
      input.emit({ type: "error", message: "Conversation aborted by client", recoverable: false });
      break;
    }

    let response: Anthropic.Message;
    let streamedText = "";
    try {
      const stream = anthropic.messages.stream({
        model: model as Parameters<typeof anthropic.messages.stream>[0]["model"],
        max_tokens: MAX_TOKENS,
        temperature: 0.5,
        system: systemPrompt,
        tools: toolDefs,
        messages: messages as Anthropic.MessageParam[],
      });

      // Forward text deltas as they arrive so the UI feels responsive.
      for await (const event of stream) {
        if (input.abortSignal.aborted) break;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          streamedText += event.delta.text;
          input.emit({ type: "text_delta", text: event.delta.text });
        }
      }
      response = await stream.finalMessage();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Model call failed";
      console.error("[flow-agent] Stream error:", e);
      input.emit({ type: "error", message: msg, recoverable: false });
      break;
    }

    totalInputTokens += response.usage?.input_tokens ?? 0;
    totalOutputTokens += response.usage?.output_tokens ?? 0;

    // Capture latest text block (becomes finalText if loop ends here).
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      finalText = textBlock.text;
    } else if (streamedText) {
      finalText = streamedText;
    }

    // ─── NATIVE server-side tools (web_search_20250305) ────────────────
    // Anthropic already executed these — DO NOT route them through the
    // client tool dispatcher. Identify by `type === "server_tool_use"`,
    // not by `name` (a server_tool_use also has name: "web_search").
    // Charge per native search so we recover the $0.01 + token surcharge.
    const serverToolUses = response.content.filter(
      (b): b is Anthropic.ServerToolUseBlock => b.type === "server_tool_use",
    );
    for (const stu of serverToolUses) {
      const label = `${stu.name} (native)`;
      toolsUsed.push(label);
      // Surface to the UI so the user sees the search firing — emits both
      // start + result events back-to-back since Anthropic already ran it.
      const stInput = (stu as { input?: unknown }).input ?? {};
      input.emit({
        type: "tool_call_start",
        id: stu.id,
        name: label,
        input: stInput,
      });
      // Charge — admin sessions bypass inside chargeCredits.
      if (stu.name === "web_search") {
        await chargeCredits("AI_WEB_SEARCH", `Flow-AI native ${label}`, "flow_ai_tool", input.conversationId);
      }
      input.emit({
        type: "tool_call_result",
        id: stu.id,
        name: label,
        output: { ok: true, data: { native: true, name: stu.name } },
        durationMs: 0,
        creditCost: 0,
      });
    }

    // `pause_turn` means the model wants to keep going (typically more
    // native searches). Re-attach the assistant content verbatim and loop
    // — DO NOT push any tool_result; server-side results are already baked
    // into the assistant content.
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "end_turn") break;

    // Only CLIENT tool_use blocks need a handler. server_tool_use blocks
    // were just handled above.
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUseBlocks.length === 0) {
      // No client tool calls and not end_turn/pause_turn — could be a pure
      // server-tool turn that finished. Keep the assistant content and break
      // (the loop is exhausted for this turn's purpose).
      if (serverToolUses.length > 0) {
        messages.push({ role: "assistant", content: response.content });
      }
      break;
    }

    // Persist the assistant turn so the next iteration sees its tool_use blocks.
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const tu of toolUseBlocks) {
      toolsUsed.push(tu.name);
      input.emit({
        type: "tool_call_start",
        id: tu.id,
        name: tu.name,
        input: tu.input,
      });

      const tool = toolByName.get(tu.name);
      if (!tool) {
        const result: ToolResult = {
          ok: false,
          error_code: "not_found",
          message: `Unknown tool: ${tu.name}. Pick from the registered tools listed in your tool schema.`,
        };
        await logToolCall(
          { name: tu.name, costKey: "AGENT_TOOL_CALL_BASE" } as FlowAgentTool,
          tu.input as Record<string, unknown>,
          result,
          tu.id,
          0,
          0,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
          is_error: true,
        });
        input.emit({
          type: "tool_call_result",
          id: tu.id,
          name: tu.name,
          output: result,
          durationMs: 0,
          creditCost: 0,
          errorCode: result.ok ? undefined : result.error_code,
        });
        continue;
      }

      const result = await runTool(tool, tu.input as Record<string, unknown>, tu.id);

      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result).slice(0, 16000),
        is_error: !result.ok,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    finalText,
    iterations: MAX_ITERATIONS,
    tokensUsed: totalInputTokens + totalOutputTokens,
    creditsUsed: totalCreditsUsed,
    toolsUsed,
    proposedPlans,
  };
}
