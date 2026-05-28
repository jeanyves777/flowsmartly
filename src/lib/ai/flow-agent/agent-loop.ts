import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import type { CreditCostKey } from "@/lib/credits/costs";
import { ensureToolsRegistered, flowAgentTools, type FlowAgentTool } from "./registry";
import { buildAgentSystemPrompt } from "./system-prompt";
import { nextSeqForConversation } from "./conversation-seq";
import type {
  AgentEvent,
  ToolContext,
  ToolResult,
} from "./tool-context";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

const MAX_ITERATIONS = 8;
const MAX_TOKENS = 2048;

export interface AgentRunInput {
  userId: string;
  isAdmin: boolean;
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
  history: Array<{ role: "user" | "assistant"; content: string; metadata?: string | null }>;
  /** Client-supplied wall clock + tz so "Monday at 4pm" resolves correctly. */
  clientNow?: string;
  timezone?: string;
  /** Live background-task status for this conversation (agent awareness). */
  recentTasks?: Array<{ id: string; kind: string; status: string; note?: string; resultUrl?: string | null }>;
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
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));
  const toolByName = new Map(tools.map((t) => [t.name, t] as const));

  // Track which plan_proposal IDs the user has confirmed in this turn —
  // a mutating tool that runs AFTER its plan was confirmed gets a pass on
  // the "must propose first" check. Resets per agent turn.
  const confirmedPlans = new Set<string>();

  const systemPrompt = await buildAgentSystemPrompt({
    userId: input.userId,
    clientNow: input.clientNow,
    timezone: input.timezone,
    recentTasks: input.recentTasks,
  });

  // Seed Claude with prior conversation. Skip the just-saved user message —
  // we pass it as the LAST user turn separately so it stays adjacent to
  // the assistant response.
  const priorMessages: Anthropic.MessageParam[] = input.history
    .filter((m) => m.content?.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  // The triggering user message is the final entry of priorMessages because
  // the caller persisted it before calling us. Confirm and remove tail if dup.
  if (priorMessages.length === 0 || priorMessages[priorMessages.length - 1].content !== input.userMessage) {
    priorMessages.push({ role: "user", content: input.userMessage });
  }

  const messages: Array<{ role: "user" | "assistant"; content: any }> = priorMessages.map(
    (m) => ({ role: m.role, content: m.content }),
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
          ? `\n\n[The user uploaded ${input.attachmentUrls.length} image(s). To USE them in a post/design, pass the URL as mediaUrl: ${input.attachmentUrls.join(", ")}. If they want it posted, attach it — don't generate a new image.]`
          : "";
      const textPart = { type: "text", text: `${input.userMessage}${urlNote}` };
      const imageParts = input.attachments.map((a) => ({
        type: "image",
        source: { type: "base64", media_type: a.mediaType, data: a.dataBase64 },
      }));
      messages[lastUserIdx] = { role: "user", content: [textPart, ...imageParts] };
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
    if (tool.mutating) {
      const planId = typeof rawInput.planId === "string" ? rawInput.planId : null;
      if (!planId || !confirmedPlans.has(planId)) {
        const errResult: ToolResult = {
          ok: false,
          error_code: "validation_failed",
          message: `This tool requires a confirmed plan first. Call \`propose_plan\` with concrete steps + credit cost, wait for the user's confirmation, then call this tool again with planId set to the confirmed plan's id.`,
          recoverable: true,
        };
        await logToolCall(tool, rawInput, errResult, toolUseId, Date.now() - startMs, 0);
        return errResult;
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
          message: `Not enough credits to run ${tool.name}. Suggest the user top up at /credits.`,
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
  await chargeCredits("AGENT_MESSAGE", "Flow-AI agent: assistant turn");

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
        model: HAIKU_MODEL as Parameters<typeof anthropic.messages.stream>[0]["model"],
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

    if (response.stop_reason === "end_turn") break;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUseBlocks.length === 0) break;

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
