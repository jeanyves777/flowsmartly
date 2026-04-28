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
  /** Dispatched jobs (results pending or already complete). Frontend renders
   *  these as result cards in the chat. */
  dispatched: Array<{ kind: "design" | "video" | "remix"; designId?: string; imageUrl?: string; status: "pending" | "complete" | "failed"; error?: string }>;
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

# Your job

1. Classify the user's intent quickly: image (flyer / poster / social / ad / banner / signboard) or video (short-form, reels, TikTok). Use the smart_default — only show a mode picker if you genuinely can't tell.
2. Collect the minimum details needed: prompt/topic, target size, optional reference image, optional brand colors. Don't over-collect — most users just want the design.
3. When you have enough, call \`dispatch_design\` (image) or \`dispatch_video\` (video). Don't ask the user for confirmation unless the request was ambiguous; auto-dispatch is the norm.
4. After a result lands, support iteration: fresh generation, edits via remix, or branched variants for comparison.

# Tone

Conversational, warm, brief. No corporate fluff. No "I'd be happy to help…" preambles. Just respond like a designer friend on Slack.

# Tool usage

- Call \`show_card\` whenever a UI card would communicate faster than text (mode picker when ambiguous, brand toggle, size picker, etc.). Cards complement your text — they don't replace it.
- Call \`request_reference\` when a reference image would obviously help (any "personalize this" / "with my photo" / "like this design" request) but the user hasn't uploaded one yet. Set \`suggestedQuery\` so the inline browse panel pre-filters.
- Call \`update_state\` to persist any field you've collected. The caller hydrates this back next turn.
- Call \`dispatch_design\` or \`dispatch_video\` to actually generate. The result is shown to the user automatically — you don't need to also \`show_card({ type: "result" })\`.
- Call \`dispatch_remix\` for "edit / tweak this image" requests when the user has a recent result. \`fromBranchId\` defaults to current branch.
- Call \`branch_variant\` when the user wants to explore an alternative without losing the current result ("try a vibrant version", "show me a corporate take").

# When to ASK vs ASSUME

- Size: assume Instagram Square (1080×1080) for social, A4 for flyers, Story (1080×1920) for TikTok / reels — unless the user named a different platform/size. Don't ask.
- Brand colors: ask via brand_toggle card only if the user mentions their brand or a logo. Otherwise let the design agent pick.
- Style: never ask — the design agent picks based on the topic.
- Reference: only ask if the user mentioned a person/photo/logo/specific design they want to riff on.

# What you do NOT do

- Don't lecture. Don't list options that don't matter. Don't show summary confirmations unless the user asked.
- Don't render Markdown headings in your replies. Plain conversational text + cards.
- Don't generate the design yourself — always dispatch via tools.`;

// ─── Tool definitions (registry) ──────────────────────────────────────
function buildTools(opts: RunChatTurnOpts) {
  // Tools mutate these closures, then we read them back into the result.
  const cards: CardSpec[] = [];
  const dispatched: RunChatTurnResult["dispatched"] = [];
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
        // Phase 1 stub — real handler in routes/chat-dispatch.ts will
        // fetch from /api/ai/visual or /api/ai/design-layout. For now
        // we record the request so the route can fire it asynchronously
        // after the agent loop returns. This keeps Claude's loop fast
        // (single turn, no awaiting workers).
        const branchId = (input.branchId as string) || opts.state.currentBranchId || "main";
        dispatched.push({ kind: "design", status: "pending" });
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
        void input;
        dispatched.push({ kind: "video", status: "pending" });
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
        void input;
        dispatched.push({ kind: "remix", status: "pending" });
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
      const params: Record<string, unknown> = {
        model: "claude-opus-4-7",
        max_tokens: 4096,
        system: SYSTEM_PROMPT + stateLine,
        tools: toolDefs,
        messages: apiMessages as Anthropic.MessageParam[],
        thinking: { type: "adaptive" as const },
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
