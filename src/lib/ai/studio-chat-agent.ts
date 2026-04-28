import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Studio Create Chat — agent module.
 *
 * Single conversational front door for design generation. The agent
 * collects details across turns (mode, prompt, size, brand, references)
 * and dispatches to the existing worker endpoints (visual / layout /
 * video / remix). Branded as "FlowAI" — never references Claude.
 *
 * See: docs/superpowers/specs/2026-04-26-studio-create-chat-design.md
 *
 * Each call to runChatTurn() processes ONE user message:
 *   1. Build full conversation context from prior turns
 *   2. Run Claude with the chat-specific tool registry
 *   3. Tools execute server-side (state updates, card emissions, dispatches)
 *   4. Return: agent reply text + cards emitted + dispatched job IDs +
 *      mutated state. Caller persists everything to DesignChatTurn rows.
 */

// ─── Card spec types (must mirror frontend rendering) ─────────────────
export type CardSpec =
  | { type: "mode_picker"; options: Array<"image" | "video"> }
  | { type: "size_picker"; presets: Array<{ name: string; w: number; h: number }> }
  | { type: "reference_picker"; allowUpload: boolean; allowBrowse: boolean; suggestedQuery?: string }
  | { type: "brand_toggle"; brandName?: string; primary?: string; secondary?: string; accent?: string }
  | { type: "social_handles" }
  | { type: "contact_info" }
  | { type: "confirm_summary"; collected: Record<string, unknown> }
  | { type: "result"; designId: string; imageUrl: string; width: number; height: number; branchId: string }
  | { type: "branch_compare"; branchIds: string[] }
  | { type: "info"; title: string; body?: string };

// ─── Dispatch envelope (agent → route hand-off) ───────────────────────
// The agent's dispatch tools don't actually fire workers — they record
// these envelopes which the route reads and dispatches after the loop.
// This keeps the agent module pure (no HTTP) and lets the route forward
// session cookies, charge credits, and persist designs in one place.
export type DispatchEnvelope =
  | {
      kind: "design";
      args: {
        mode: "ai_image" | "smart_layout";
        prompt: string;
        width: number;
        height: number;
        category?: string;
        style?: string;
        ctaText?: string;
        referenceImageUrl?: string;
        useBrandColors?: boolean;
        branchId: string;
      };
      status: "pending" | "complete" | "failed";
      designId?: string;
      imageUrl?: string;
      width?: number;
      height?: number;
      error?: string;
    }
  | {
      kind: "video";
      args: {
        prompt: string;
        aspectRatio?: "9:16" | "16:9" | "1:1";
        durationSeconds?: number;
        voiceover?: boolean;
        referenceImageUrl?: string;
      };
      status: "pending" | "complete" | "failed";
      designId?: string;
      videoUrl?: string;
      error?: string;
    }
  | {
      kind: "remix";
      args: {
        sourceImageUrl: string;
        customText?: string;
        useBrandColors?: boolean;
        fromBranchId?: string;
      };
      status: "pending" | "complete" | "failed";
      designId?: string;
      imageUrl?: string;
      width?: number;
      height?: number;
      error?: string;
    };

// ─── Conversation context ─────────────────────────────────────────────
export interface ChatTurn {
  role: "user" | "agent";
  content: string;
  cards?: CardSpec[];
  attachments?: Array<{ kind: "upload" | "library"; url: string; mime?: string; templateId?: string }>;
}

export interface ChatState {
  mode?: "image" | "video";
  prompt?: string;
  category?: string;
  size?: { name?: string; width: number; height: number };
  style?: string;
  ctaText?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  useBrandColors?: boolean;
  showBrandName?: boolean;
  showSocialIcons?: boolean;
  socialHandles?: Record<string, string>;
  contactInfo?: Record<string, string>;
  references?: Array<{ kind: "upload" | "library"; url: string; templateId?: string }>;
  /** Branch the next dispatch belongs to. Default: "main". */
  currentBranchId?: string;
  /** Last result image URL — for remix-from-current iterations. */
  lastResultImageUrl?: string;
  lastResultDesignId?: string;
  lastResultBranchId?: string;
}

export interface RunChatTurnOpts {
  /** Prior turns in chronological order (oldest → newest). */
  history: ChatTurn[];
  /** The user's latest message text. */
  userMessage: string;
  /** Attachments uploaded with this turn (refs the user dropped in). */
  attachments?: ChatTurn["attachments"];
  /** Persisted state coming in. */
  state: ChatState;
  /** User context — used to scope dispatch handlers. */
  userId: string;
}

export interface RunChatTurnResult {
  /** Agent's free-text reply (last text block). */
  text: string;
  /** Cards the agent emitted via show_card. Frontend renders them inline. */
  cards: CardSpec[];
  /** Dispatched jobs (results pending or already complete). The route
   *  layer reads these envelopes after the agent loop returns and fires
   *  the appropriate worker endpoint, then enriches each envelope with
   *  the result. Frontend renders dispatched results as inline result
   *  cards in the chat. */
  dispatched: DispatchEnvelope[];
  /** Mutations to apply to the chat's persisted state blob. */
  stateUpdate: Partial<ChatState>;
  /** Tool call audit log for debugging / future replays. */
  toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
  /** Token usage for billing / observability. */
  usage: { inputTokens: number; outputTokens: number };
  /** Iterations the loop ran (debug). */
  iterations: number;
}

// ─── System prompt (brand-neutral; never names Claude) ────────────────
const SYSTEM_PROMPT = `You are FlowAI, the AI design assistant for FlowSmartly. You help users create flyers, posters, social media designs, ads, and short-form videos. You NEVER mention you're built on Claude or any specific model — you are FlowAI.

# CRITICAL — be honest about state

Your text reply MUST match what tools you actually called this turn:
- If you did NOT call dispatch_design / dispatch_video / dispatch_remix this turn, do NOT say "on it", "generating now", "starting", "kicking off", "I'll have it ready shortly", or anything implying work is in progress. Nothing is happening unless you call a dispatch tool.
- If you DID call a dispatch tool, you can say "generating now" — and the result card appears automatically; don't claim a specific image until it's there.
- If you ask the user a clarifying question, your reply is the QUESTION ONLY. Don't pretend you also kicked something off in the background.
- Match the user's energy. If the user says "hi" / "thanks" / something off-topic, respond to THAT — don't pivot back to talking about the design as if work is happening.

# Default behavior — AUTO-DISPATCH, don't over-collect

Most users just want the design. When they describe ANYTHING reasonable on the first turn (e.g. "Birthday flyer for a 50th party", "Instagram post for sneaker drop", "wedding save-the-date"), call dispatch_design IMMEDIATELY with sensible defaults. Don't drag them through a Q&A.

Sensible defaults you should fill in WITHOUT asking:
- Size: Instagram Square 1080×1080 for social, 1080×1350 portrait for flyers, 1080×1920 for stories/reels.
- Style: leave undefined — the design worker picks.
- Brand colors: skip unless the user mentioned their brand explicitly.
- Reference: skip unless the user mentioned a photo/person/specific design.
- Names / dates / venues: leave as placeholders — the user can edit them on canvas after the design lands.

You should ask BEFORE dispatching ONLY if:
- The mode is genuinely ambiguous between image and video (rare — most descriptions make it obvious).
- The user wrote 3 words or fewer with no topic ("flyer", "design something", "make me a thing").
- The user explicitly asked you to ask first.

# Iteration after a result lands

- Fresh generation in same vein → call dispatch_design again.
- "Tweak this" / "make it more X" / "change Y" → call dispatch_remix (cheaper, edits the existing image).
- "Show me a different version while keeping this one" → call branch_variant first, then dispatch.

# Tone

Conversational, warm, brief. No corporate fluff. No "I'd be happy to help…" preambles. Plain text — no Markdown headers. One short reply, not three paragraphs. Like a designer friend on Slack.

# Tools

- show_card — surface a UI card alongside your reply when it communicates faster than text. Use sparingly.
- request_reference — when a reference image would obviously help and the user hasn't dropped one in.
- update_state — persist any field you collected (mode, prompt, brand, etc.). Hydrated back next turn.
- dispatch_design / dispatch_video — fire the worker. ONLY claim "generating" when you call this.
- dispatch_remix — edit the most recent result.
- branch_variant — fork a parallel variant before dispatching another design.

# Things to NEVER do

- Don't claim work is happening when you didn't call a dispatch tool. This is the #1 failure mode.
- Don't ask three questions in one turn — pick the most blocking one.
- Don't lecture or summarize. The user wants the design, not a meeting.
- Don't render Markdown headers / bullet lists in conversational replies.
- Don't generate designs yourself — always dispatch via tools.`;

// ─── Tool definitions (registry) ──────────────────────────────────────
function buildTools(opts: RunChatTurnOpts) {
  // Tools mutate these closures, then we read them back into the result.
  const cards: CardSpec[] = [];
  const dispatched: DispatchEnvelope[] = [];
  const stateUpdate: Partial<ChatState> = {};
  const toolCalls: RunChatTurnResult["toolCalls"] = [];

  const tools: Array<{
    name: string;
    description: string;
    input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
    handler: (input: Record<string, unknown>) => Promise<unknown>;
  }> = [
    {
      name: "update_state",
      description:
        "Persist any fields you've collected so far (mode, prompt, size, brandColors, etc.). The caller hydrates this state back into the chat between turns. Pass only the fields that changed — they're merged with prior state.",
      input_schema: {
        type: "object",
        properties: {
          patch: {
            type: "object",
            description: "Partial state object — fields to merge in. Keys: mode, prompt, category, size, style, ctaText, brandColors, useBrandColors, showBrandName, showSocialIcons, socialHandles, contactInfo, references, currentBranchId.",
          },
        },
        required: ["patch"],
      },
      handler: async (input) => {
        const patch = (input.patch || {}) as Partial<ChatState>;
        Object.assign(stateUpdate, patch);
        return { ok: true };
      },
    },
    {
      name: "show_card",
      description:
        "Emit a UI card to display alongside your reply. Use sparingly — only when a card communicates faster than text (mode_picker when ambiguous, brand_toggle when a brand kit is on file, size_picker when the user wants to override default size). Each call adds a card to the turn's emission list.",
      input_schema: {
        type: "object",
        properties: {
          card: {
            type: "object",
            description: "Card spec. type field discriminates the variant.",
          },
        },
        required: ["card"],
      },
      handler: async (input) => {
        const card = input.card as CardSpec;
        cards.push(card);
        return { ok: true };
      },
    },
    {
      name: "request_reference",
      description:
        "Open the unified reference picker — user can upload their own image OR browse the system template library inline. Use when a reference would obviously help. suggestedQuery pre-filters the library browse panel (e.g. 'birthday flyer'). Equivalent to show_card with type=reference_picker plus a slight UX hint.",
      input_schema: {
        type: "object",
        properties: {
          allowUpload: { type: "boolean", description: "default true" },
          allowBrowse: { type: "boolean", description: "default true" },
          suggestedQuery: { type: "string", description: "search query to pre-filter the library browse panel" },
        },
      },
      handler: async (input) => {
        cards.push({
          type: "reference_picker",
          allowUpload: input.allowUpload !== false,
          allowBrowse: input.allowBrowse !== false,
          suggestedQuery: typeof input.suggestedQuery === "string" ? input.suggestedQuery : undefined,
        });
        return { ok: true };
      },
    },
    {
      name: "dispatch_design",
      description:
        "Fire the image-design worker. Pass the collected state. mode='ai_image' uses the gpt-image-1 visual pipeline (flat polished output); mode='smart_layout' uses the Claude-driven layout pipeline (editable Fabric layers). Default to ai_image unless the user said 'editable' or 'I want to tweak the layers'. Returns design id + image url once the worker completes.",
      input_schema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["ai_image", "smart_layout"] },
          prompt: { type: "string" },
          width: { type: "number" },
          height: { type: "number" },
          category: { type: "string" },
          style: { type: "string" },
          ctaText: { type: "string" },
          referenceImageUrl: { type: "string" },
          useBrandColors: { type: "boolean" },
          branchId: { type: "string" },
        },
        required: ["mode", "prompt", "width", "height"],
      },
      handler: async (input) => {
        // Record the full args envelope. The route layer reads
        // dispatched[] after the agent loop and fires the worker
        // synchronously, attaching the result to the envelope before
        // returning to the frontend.
        const branchId = (input.branchId as string) || opts.state.currentBranchId || "main";
        const mode = (input.mode === "smart_layout" ? "smart_layout" : "ai_image") as "ai_image" | "smart_layout";
        dispatched.push({
          kind: "design",
          status: "pending",
          args: {
            mode,
            prompt: String(input.prompt || ""),
            width: typeof input.width === "number" ? input.width : 1080,
            height: typeof input.height === "number" ? input.height : 1080,
            category: typeof input.category === "string" ? input.category : undefined,
            style: typeof input.style === "string" ? input.style : undefined,
            ctaText: typeof input.ctaText === "string" ? input.ctaText : undefined,
            referenceImageUrl: typeof input.referenceImageUrl === "string" ? input.referenceImageUrl : undefined,
            useBrandColors: input.useBrandColors === true,
            branchId,
          },
        });
        stateUpdate.currentBranchId = branchId;
        return {
          ok: true,
          status: "queued",
          message: "Generation queued — result will appear in chat shortly.",
        };
      },
    },
    {
      name: "dispatch_video",
      description:
        "Fire the video-generation worker (existing /api/ai/video-studio/generate). Pass prompt, duration, aspect, voiceover toggle. Returns a job id; result polls in.",
      input_schema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          aspectRatio: { type: "string", enum: ["9:16", "16:9", "1:1"] },
          durationSeconds: { type: "number" },
          voiceover: { type: "boolean" },
          referenceImageUrl: { type: "string" },
        },
        required: ["prompt"],
      },
      handler: async (input) => {
        dispatched.push({
          kind: "video",
          status: "pending",
          args: {
            prompt: String(input.prompt || ""),
            aspectRatio: input.aspectRatio === "16:9" || input.aspectRatio === "1:1" ? input.aspectRatio : "9:16",
            durationSeconds: typeof input.durationSeconds === "number" ? input.durationSeconds : undefined,
            voiceover: input.voiceover === true,
            referenceImageUrl: typeof input.referenceImageUrl === "string" ? input.referenceImageUrl : undefined,
          },
        });
        return { ok: true, status: "queued" };
      },
    },
    {
      name: "dispatch_remix",
      description:
        "Iteration tool — call when the user wants to TWEAK an existing result (change colors, swap text, vibe shift). Uses the existing /api/studio/templates/remix endpoint (gpt-image-1 edit-multi + Claude editable text overlay). sourceImageUrl defaults to the most recent result. Cheaper than a fresh dispatch_design (30cr vs 60cr).",
      input_schema: {
        type: "object",
        properties: {
          sourceImageUrl: { type: "string", description: "Defaults to the most recent result image." },
          customText: { type: "string" },
          useBrandColors: { type: "boolean" },
          fromBranchId: { type: "string" },
        },
      },
      handler: async (input) => {
        const sourceImageUrl =
          (typeof input.sourceImageUrl === "string" && input.sourceImageUrl) ||
          opts.state.lastResultImageUrl ||
          "";
        if (!sourceImageUrl) {
          return { ok: false, error: "No source image — generate one first or pass sourceImageUrl explicitly." };
        }
        dispatched.push({
          kind: "remix",
          status: "pending",
          args: {
            sourceImageUrl,
            customText: typeof input.customText === "string" ? input.customText : undefined,
            useBrandColors: input.useBrandColors === true,
            fromBranchId: typeof input.fromBranchId === "string" ? input.fromBranchId : opts.state.currentBranchId,
          },
        });
        return { ok: true, status: "queued" };
      },
    },
    {
      name: "branch_variant",
      description:
        "Fork a new variant from an existing result so the user can compare side-by-side. Creates a new branchId, then call dispatch_design or dispatch_remix with that branchId. Use for 'show me a different style', 'try a vibrant version while keeping this one'.",
      input_schema: {
        type: "object",
        properties: {
          fromBranchId: { type: "string" },
          changeDescription: { type: "string" },
          newBranchName: { type: "string" },
        },
        required: ["changeDescription"],
      },
      handler: async (input) => {
        const newBranchId = `branch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        stateUpdate.currentBranchId = newBranchId;
        toolCalls.push({ name: "branch_variant", input, output: { branchId: newBranchId } });
        return { ok: true, branchId: newBranchId };
      },
    },
  ];

  return { tools, cards, dispatched, stateUpdate, toolCalls };
}

// ─── Main entry ───────────────────────────────────────────────────────
export async function runChatTurn(opts: RunChatTurnOpts): Promise<RunChatTurnResult> {
  const { history, userMessage, attachments, state, userId } = opts;
  void userId; // reserved for future per-user permission scoping

  const { tools, cards, dispatched, stateUpdate, toolCalls } = buildTools(opts);

  // Build the multi-turn message history Anthropic-style. We collapse
  // each prior turn into a role: user / assistant message. Card / tool
  // metadata is dropped here — the agent only sees the human-readable
  // text. Agent state is included in the system prompt as JSON.
  const stateLine = `\n\n# Current chat state (JSON):\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
  const refsLine = attachments?.length
    ? `\n\n[The user attached ${attachments.length} reference image${attachments.length > 1 ? "s" : ""} this turn — URLs available via the references field in state.]`
    : "";

  type ChatMsg = { role: "user" | "assistant"; content: string };
  const messages: ChatMsg[] = [];
  for (const turn of history) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.content,
    });
  }
  messages.push({ role: "user", content: userMessage + refsLine });

  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));
  const handlerByName = new Map(tools.map((t) => [t.name, t.handler]));

  const maxIterations = 6;
  let totalIn = 0;
  let totalOut = 0;
  let lastText = "";
  // Maintain Anthropic-shaped messages so we can append assistant turns
  // (with tool_use blocks) and the corresponding tool_result messages.
  const apiMessages: Array<{ role: "user" | "assistant"; content: unknown }> = messages.slice();

  let iter = 0;
  for (; iter < maxIterations; iter++) {
    let response: Anthropic.Message;
    try {
      // SPEED: Sonnet 4.6 for the conversational chat — ~3x faster than
      // Opus 4.7 for data-collection turns and totally adequate for tool
      // selection in this constrained surface (8 tools, structured args).
      // Adaptive thinking is intentionally OFF here — the worker agents
      // (visual/layout/video/remix) reason heavily on their own; the
      // chat agent is just a router. Keeping it lean keeps perceived
      // latency near-instant on "what size?" / "which brand?" turns.
      const params: Record<string, unknown> = {
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT + stateLine,
        tools: toolDefs,
        messages: apiMessages as Anthropic.MessageParam[],
      };
      response = (await anthropic.messages.create(
        params as unknown as Parameters<typeof anthropic.messages.create>[0],
      )) as Anthropic.Message;
    } catch (err) {
      throw err;
    }

    totalIn += response.usage.input_tokens;
    totalOut += response.usage.output_tokens;

    // Capture last text block (the agent's reply for this iteration).
    for (const block of response.content) {
      if (block.type === "text") {
        lastText = block.text;
      }
    }

    if (response.stop_reason !== "tool_use") {
      // Agent finished talking. Append its final assistant message and stop.
      apiMessages.push({ role: "assistant", content: response.content });
      break;
    }

    // Agent wants to call tools. Append the assistant message + run each
    // tool_use block, then append a tool_result message with all results.
    apiMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const handler = handlerByName.get(block.name);
      let outcome: unknown;
      try {
        outcome = handler
          ? await handler(block.input as Record<string, unknown>)
          : { error: `Unknown tool: ${block.name}` };
      } catch (e) {
        outcome = { error: e instanceof Error ? e.message : String(e) };
      }
      toolCalls.push({ name: block.name, input: block.input, output: outcome });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(outcome),
      });
    }

    apiMessages.push({ role: "user", content: toolResults });
  }

  return {
    text: lastText,
    cards,
    dispatched,
    stateUpdate,
    toolCalls,
    usage: { inputTokens: totalIn, outputTokens: totalOut },
    iterations: iter + 1,
  };
}
