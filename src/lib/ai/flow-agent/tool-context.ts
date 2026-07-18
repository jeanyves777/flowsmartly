import type { CreditCostKey } from "@/lib/credits/costs";
import type { ViewSpec } from "@/lib/agent-views/spec";

/**
 * Per-request context handed to every tool handler.
 *
 * Tools should NEVER reach into the request/session directly — everything
 * they need (userId, plan, isAdmin, conversationId, abort signal, event
 * emitter, accumulator for tool-call audit rows) lives here.
 *
 * The `emit` callback lets a tool stream live progress back to the SSE
 * channel BEFORE it returns its final result. Used by long-running tools
 * (image gen, video gen, large list scans) so the user sees activity.
 *
 * The `awaitConfirmation` callback is the bridge for `propose_plan`: the
 * tool emits a plan_proposal event and the agent loop pauses until the
 * frontend sends back a confirmation event over the same SSE channel —
 * implemented in agent-loop.ts.
 */

/** A design template offered to the user as a clickable chat card. */
export interface TemplateOptionData {
  id: string;
  name: string;
  industry?: string | null;
  thumbnailUrl?: string | null;
}

/** One clickable answer in a question card. */
export interface QuestionOptionData {
  label: string;
  sublabel?: string | null;
}

export type AgentEvent =
  | { type: "start"; conversationId: string; messageId: string }
  | { type: "thinking"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; id: string; name: string; input?: unknown }
  | { type: "tool_call_result"; id: string; name: string; output: unknown; durationMs: number; creditCost: number; errorCode?: string }
  | { type: "plan_proposal"; id: string; steps: PlanStep[]; summary: string; totalCreditCost: number }
  | { type: "task_started"; taskId: string; kind: string; summary: string }
  | { type: "task_progress"; taskId: string; progress: number; message: string; script?: unknown; scenes?: unknown }
  | { type: "task_completed"; taskId: string; resultRefType?: string; resultRefId?: string; output?: unknown }
  | { type: "task_failed"; taskId: string; error: string }
  | { type: "template_options"; requestId: string; templates: TemplateOptionData[] }
  | { type: "question_options"; requestId: string; question: string; options: QuestionOptionData[]; allowOther?: boolean }
  | { type: "canvas_update"; patch: Record<string, unknown> }
  | { type: "agent_view"; requestId: string; spec: ViewSpec }
  | { type: "credits_charged"; amount: number; costKey: CreditCostKey; balanceAfter: number | null }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "done"; tokensUsed: number; creditsUsed: number; iterations: number };

export interface PlanStep {
  id: string;
  title: string;
  detail?: string;
  toolName?: string; // hint to the user what's about to happen
  creditCost?: number;
}

/**
 * Result of a tool handler. Tools NEVER throw — they always resolve with
 * either `ok: true` or a structured failure the agent can negotiate with.
 * See feedback-no-stuck-ai-chat memory.
 */
export type ToolResult<T = unknown> =
  | { ok: true; data: T; resultRefType?: string; resultRefId?: string }
  | { ok: false; error_code: ToolErrorCode; message: string; recoverable?: boolean; meta?: Record<string, unknown> };

export type ToolErrorCode =
  | "insufficient_credits"
  | "no_payment_method"
  | "plan_required"
  | "missing_input"
  | "not_found"
  | "permission_denied"
  | "validation_failed"
  | "rate_limited"
  | "upstream_failed"
  | "missing_brand_kit"
  | "user_canceled"
  | "internal";

export interface ToolContext {
  userId: string;
  isAdmin: boolean;
  /** User's current plan (STARTER | PRO | BUSINESS | ENTERPRISE). */
  plan: string;
  conversationId: string;
  /** The current assistant AIMessage row id. Tool-call audit rows hang off it. */
  messageId: string;
  /** Abort signal — tools should cooperate when the client disconnects. */
  abortSignal: AbortSignal;
  /** Emit an SSE event back to the client mid-tool. */
  emit: (event: AgentEvent) => void;
  /**
   * Pause the agent loop and wait for the user to confirm/reject a plan.
   * Returns `true` if the user clicked Confirm, `false` if they rejected.
   * Implemented by the agent loop — uses a deferred promise keyed by plan id.
   */
  awaitConfirmation: (planId: string) => Promise<boolean>;
}
