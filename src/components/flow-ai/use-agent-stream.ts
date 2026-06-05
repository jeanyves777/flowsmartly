"use client";

import { useCallback } from "react";
import type {
  AgentToolCardData,
  AgentTaskCardData,
  PlanProposalCardData,
  PlanStepData,
  MessageBlock,
} from "./agent-cards";

/**
 * Shared Flow-AI agent SSE consumers.
 *
 * - `consumeAgentStream` — drains a POST `/api/flow-ai/agent` SSE body
 *   into typed handlers. Used by both `FlowAIShell` (full-screen) and
 *   `FlowAIWidget` (floating bubble) so SSE parsing stays in one place.
 *
 * - `subscribeToTaskStream` — opens `/api/flow-ai/tasks/[id]/stream` and
 *   forwards parsed events. Returns an AbortController for cleanup.
 *
 * - `useAgentSender` — small React hook that returns a typed POST helper
 *   so callers don't repeat the fetch boilerplate.
 *
 * Pure SSE plumbing. UI rendering lives in `agent-cards.tsx`; persistence
 * + rehydration is the caller's job.
 */

export interface AgentStreamHandlers {
  onStart?: (conversationId: string, messageId: string) => void;
  onText?: (delta: string) => void;
  onToolCallStart?: (call: AgentToolCardData) => void;
  onToolCallResult?: (call: AgentToolCardData) => void;
  onPlanProposal?: (proposal: PlanProposalCardData) => void;
  onTaskStarted?: (task: AgentTaskCardData) => void;
  onTaskProgress?: (taskId: string, progress: number | undefined, message: string | undefined) => void;
  onTaskCompleted?: (task: AgentTaskCardData) => void;
  onTaskFailed?: (taskId: string, error: string | undefined) => void;
  onError?: (message: string, recoverable: boolean) => void;
  onDone?: () => void;
}

export async function consumeAgentStream(
  body: ReadableStream<Uint8Array>,
  handlers: AgentStreamHandlers,
  abortSignal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (abortSignal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const line = evt.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        const type = payload.type as string;
        if (type === "start" && typeof payload.conversationId === "string" && typeof payload.messageId === "string") {
          handlers.onStart?.(payload.conversationId, payload.messageId);
        } else if (type === "text_delta" && typeof payload.text === "string") {
          handlers.onText?.(payload.text);
        } else if (type === "tool_call_start" && typeof payload.id === "string" && typeof payload.name === "string") {
          handlers.onToolCallStart?.({
            id: payload.id,
            name: payload.name,
            status: "running",
          });
        } else if (type === "tool_call_result" && typeof payload.id === "string") {
          const output = payload.output as { ok?: boolean } | undefined;
          const ok = output?.ok === true;
          handlers.onToolCallResult?.({
            id: payload.id,
            name: String(payload.name ?? "tool"),
            status: ok ? "ok" : "error",
            errorCode: typeof payload.errorCode === "string" ? payload.errorCode : undefined,
            creditCost: typeof payload.creditCost === "number" ? payload.creditCost : undefined,
            durationMs: typeof payload.durationMs === "number" ? payload.durationMs : undefined,
            output: payload.output,
          });
        } else if (type === "plan_proposal" && typeof payload.id === "string") {
          handlers.onPlanProposal?.({
            id: payload.id,
            summary: String(payload.summary ?? ""),
            steps: Array.isArray(payload.steps) ? (payload.steps as PlanStepData[]) : [],
            totalCreditCost: typeof payload.totalCreditCost === "number" ? payload.totalCreditCost : 0,
            status: "pending",
          });
        } else if (type === "task_started" && typeof payload.taskId === "string") {
          handlers.onTaskStarted?.({
            id: payload.taskId,
            kind: String(payload.kind ?? "task"),
            status: "running",
            summary: typeof payload.summary === "string" ? payload.summary : undefined,
          });
        } else if (type === "task_progress" && typeof payload.taskId === "string") {
          handlers.onTaskProgress?.(
            payload.taskId,
            typeof payload.progress === "number" ? payload.progress : undefined,
            typeof payload.message === "string" ? payload.message : undefined,
          );
        } else if (type === "task_completed" && typeof payload.taskId === "string") {
          handlers.onTaskCompleted?.({
            id: payload.taskId,
            kind: String(payload.kind ?? "task"),
            status: "completed",
            output: (payload.output as AgentTaskCardData["output"]) ?? null,
            resultRefType: typeof payload.resultRefType === "string" ? payload.resultRefType : null,
            resultRefId: typeof payload.resultRefId === "string" ? payload.resultRefId : null,
          });
        } else if (type === "task_failed" && typeof payload.taskId === "string") {
          handlers.onTaskFailed?.(
            payload.taskId,
            typeof payload.error === "string" ? payload.error : undefined,
          );
        } else if (type === "error" && typeof payload.message === "string") {
          handlers.onError?.(payload.message, payload.recoverable === true);
        } else if (type === "done") {
          handlers.onDone?.();
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

// ─── Per-task SSE (for catch-up on running tasks) ──────────────────────

export type TaskStreamEvent =
  | { type: "snapshot"; status: AgentTaskCardData["status"]; output: { url?: string } | null; error: string | null; resultRefType: string | null; resultRefId: string | null }
  | { type: "progress"; progress?: number; message?: string }
  | { type: "completed"; output?: { url?: string }; resultRefType?: string; resultRefId?: string; assistantMessage?: string; assistantMessageId?: string; assistantMediaUrl?: string; assistantMediaType?: string }
  | { type: "failed"; error?: string; assistantMessage?: string; assistantMessageId?: string }
  | { type: "done" };

export function subscribeToTaskStream(
  taskId: string,
  handler: (event: TaskStreamEvent) => void,
): AbortController {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(`/api/flow-ai/tasks/${taskId}/stream`, {
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            handler(JSON.parse(line.slice(6)) as TaskStreamEvent);
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.error("[FlowAI] task stream failed:", err);
      }
    }
  })();
  return controller;
}

// ─── Sender hook — small wrapper around POST /api/flow-ai/agent ────────

export interface AgentSendInput {
  message: string;
  conversationId: string | null;
  /**
   * Optional image attachments. `dataUrl` = a base64 upload from the device
   * file picker; `url` = an already-hosted image picked from the user's media
   * library (the server fetches it for vision — no re-upload).
   */
  attachments?: Array<{ dataUrl?: string; url?: string; name?: string }>;
}

export function useAgentSender() {
  return useCallback(async (input: AgentSendInput): Promise<Response> => {
    return fetch("/api/flow-ai/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        conversationId: input.conversationId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clientNow: new Date().toISOString(),
        attachments: input.attachments,
      }),
    });
  }, []);
}

// ─── Plan confirmation helper ─────────────────────────────────────────

export async function respondToPlanProposal(
  conversationId: string,
  planId: string,
  confirmed: boolean,
): Promise<{ ok: boolean; status?: PlanProposalCardData["status"] }> {
  try {
    const res = await fetch("/api/flow-ai/agent/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, planId, confirmed }),
    });
    const json = await res.json();
    return { ok: !!json?.ok, status: json?.status };
  } catch (err) {
    console.error("[FlowAI] confirm failed:", err);
    return { ok: false };
  }
}

// ─── Ordered-block helpers — chronological turn rendering ─────────────

/** Append a streamed text delta to the running block list (mutates). */
export function blockAppendText(blocks: MessageBlock[], delta: string): void {
  const last = blocks[blocks.length - 1];
  if (last && last.type === "text") last.text += delta;
  else blocks.push({ type: "text", text: delta });
}

/** Push a tool/proposal/task block in arrival order, de-duplicated (mutates). */
export function blockPushCard(blocks: MessageBlock[], type: "tool" | "proposal" | "task", id: string): void {
  if (blocks.some((b) => b.type === type && (b as { id?: string }).id === id)) return;
  blocks.push({ type, id } as MessageBlock);
}

/** Parse the persisted ordered blocks from an AIMessage.metadata JSON string. */
export function parseMessageBlocks(metadata: string | null | undefined): MessageBlock[] | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as { blocks?: unknown };
    if (!Array.isArray(parsed.blocks)) return undefined;
    const blocks: MessageBlock[] = [];
    for (const b of parsed.blocks) {
      if (!b || typeof b !== "object") continue;
      const t = (b as { type?: string }).type;
      if (t === "text" && typeof (b as { text?: string }).text === "string") {
        blocks.push({ type: "text", text: (b as { text: string }).text });
      } else if ((t === "tool" || t === "proposal" || t === "task") && typeof (b as { id?: string }).id === "string") {
        blocks.push({ type: t, id: (b as { id: string }).id });
      }
    }
    return blocks.length ? blocks : undefined;
  } catch {
    return undefined;
  }
}

// ─── Restore helper — rebuild a saved conversation's CARDS ────────────

export interface RestoredConversationCards {
  /** Tool-call chips keyed by the assistant messageId they belong to. */
  toolCallsByMsg: Map<string, AgentToolCardData[]>;
  proposalsByMsg: Map<string, PlanProposalCardData[]>;
  tasksByMsg: Map<string, AgentTaskCardData[]>;
  /** Tasks still pending/running — caller should open live streams for these. */
  liveTaskIds: string[];
}

/**
 * Fetch ALL persisted cards (tool-call chips + plan proposals + background
 * tasks) for a conversation and key them by messageId, so a RESTORED chat
 * renders the full flow — not just text. Uses `/replay?lastSeq=0`, which
 * already returns all three sources keyed by messageId. Without this, a
 * reloaded conversation loses its chips/cards and looks text-only.
 *
 * Never throws — returns empty maps on any failure.
 */
export async function fetchConversationCards(conversationId: string): Promise<RestoredConversationCards> {
  const empty: RestoredConversationCards = {
    toolCallsByMsg: new Map(),
    proposalsByMsg: new Map(),
    tasksByMsg: new Map(),
    liveTaskIds: [],
  };
  if (!conversationId) return empty;
  try {
    const res = await fetch(
      `/api/flow-ai/agent/replay?conversationId=${encodeURIComponent(conversationId)}&lastSeq=0&limit=500`,
    );
    const json = await res.json().catch(() => null);
    if (!json?.ok) return empty;

    const toolCallsByMsg = new Map<string, AgentToolCardData[]>();
    for (const t of (json.toolCalls ?? []) as Array<{
      id: string;
      messageId: string;
      toolName: string;
      output: unknown;
      errorCode: string | null;
      creditCost: number;
    }>) {
      if (!t.messageId) continue;
      const out = t.output as { ok?: boolean } | null;
      const isError = !!t.errorCode || (!!out && typeof out === "object" && out.ok === false);
      const card: AgentToolCardData = {
        id: t.id,
        name: t.toolName,
        status: isError ? "error" : "ok",
        errorCode: t.errorCode ?? undefined,
        creditCost: t.creditCost ?? 0,
        output: t.output,
      };
      const list = toolCallsByMsg.get(t.messageId) ?? [];
      list.push(card);
      toolCallsByMsg.set(t.messageId, list);
    }

    const proposalsByMsg = new Map<string, PlanProposalCardData[]>();
    for (const p of (json.proposals ?? []) as Array<{
      id: string;
      messageId: string;
      summary: string;
      steps: PlanStepData[];
      totalCreditCost: number;
      status: PlanProposalCardData["status"];
    }>) {
      if (!p.messageId) continue;
      const list = proposalsByMsg.get(p.messageId) ?? [];
      list.push({ id: p.id, summary: p.summary, steps: p.steps ?? [], totalCreditCost: p.totalCreditCost ?? 0, status: p.status });
      proposalsByMsg.set(p.messageId, list);
    }

    const tasksByMsg = new Map<string, AgentTaskCardData[]>();
    const liveTaskIds: string[] = [];
    for (const t of (json.tasks ?? []) as Array<{
      id: string;
      messageId: string | null;
      kind: string;
      status: AgentTaskCardData["status"];
      output: AgentTaskCardData["output"];
      error: string | null;
      resultRefType: string | null;
      resultRefId: string | null;
    }>) {
      if (!t.messageId) continue;
      const list = tasksByMsg.get(t.messageId) ?? [];
      list.push({ id: t.id, kind: t.kind, status: t.status, output: t.output, error: t.error, resultRefType: t.resultRefType, resultRefId: t.resultRefId });
      tasksByMsg.set(t.messageId, list);
      if (t.status === "pending" || t.status === "running") liveTaskIds.push(t.id);
    }

    return { toolCallsByMsg, proposalsByMsg, tasksByMsg, liveTaskIds };
  } catch {
    return empty;
  }
}

// ─── Reconnect helper — drives /replay on SSE drop ───────────────────

/**
 * One-shot replay fetch — drains `/api/flow-ai/agent/replay` and
 * dispatches each missed event into the same handlers the live SSE
 * stream uses. Returns the new high-water mark `lastSeq` the caller
 * should store for the next reconnect.
 *
 * Use case: client loses SSE on a flaky network. On reconnect (next
 * route change, manual refresh, or our own retry loop), call this with
 * the lastSeq seen so far. The handlers see the missed tool calls /
 * plan proposals / task transitions exactly as if the stream had
 * stayed connected — no UI gap.
 *
 * Tasks are emitted as `task_started` / `task_completed` / `task_failed`
 * synthetic events depending on their persisted status, so the existing
 * onTaskStarted / onTaskCompleted / onTaskFailed handlers work.
 *
 * Idempotent: callers should track which tool-call ids / plan ids /
 * task ids they've already applied and skip duplicates — the handlers
 * are designed to overwrite by id, so a duplicate is harmless.
 */
export interface ReplayResult {
  lastSeq: number;
  counts: { toolCalls: number; proposals: number; tasks: number };
}

export async function replayMissedEvents(
  conversationId: string,
  lastSeq: number,
  handlers: AgentStreamHandlers,
): Promise<ReplayResult> {
  const res = await fetch(
    `/api/flow-ai/agent/replay?conversationId=${encodeURIComponent(conversationId)}&lastSeq=${lastSeq}`,
  );
  if (!res.ok) {
    return { lastSeq, counts: { toolCalls: 0, proposals: 0, tasks: 0 } };
  }
  const data = (await res.json()) as {
    ok: boolean;
    lastSeq: number;
    counts: { toolCalls: number; proposals: number; tasks: number };
    toolCalls: Array<{
      id: string;
      toolName: string;
      output: { ok?: boolean } | null;
      errorCode: string | null;
      creditCost: number;
      durationMs: number;
    }>;
    proposals: Array<{
      id: string;
      summary: string;
      steps: PlanStepData[];
      totalCreditCost: number;
      status: PlanProposalCardData["status"];
    }>;
    tasks: Array<{
      id: string;
      kind: string;
      status: AgentTaskCardData["status"];
      output: { url?: string; tier?: string } | null;
      error: string | null;
      resultRefType: string | null;
      resultRefId: string | null;
    }>;
  };
  if (!data?.ok) {
    return { lastSeq, counts: { toolCalls: 0, proposals: 0, tasks: 0 } };
  }

  for (const t of data.toolCalls) {
    const ok = t.output?.ok === true;
    handlers.onToolCallResult?.({
      id: t.id,
      name: t.toolName,
      status: ok ? "ok" : "error",
      errorCode: t.errorCode ?? undefined,
      creditCost: t.creditCost,
      durationMs: t.durationMs,
      output: t.output,
    });
  }
  for (const p of data.proposals) {
    handlers.onPlanProposal?.({
      id: p.id,
      summary: p.summary,
      steps: Array.isArray(p.steps) ? p.steps : [],
      totalCreditCost: p.totalCreditCost,
      status: p.status,
    });
  }
  for (const t of data.tasks) {
    const baseTask: AgentTaskCardData = {
      id: t.id,
      kind: t.kind,
      status: t.status,
      output: t.output,
      error: t.error,
      resultRefType: t.resultRefType,
      resultRefId: t.resultRefId,
    };
    if (t.status === "completed") {
      handlers.onTaskCompleted?.(baseTask);
    } else if (t.status === "failed" || t.status === "canceled") {
      handlers.onTaskFailed?.(t.id, t.error ?? undefined);
    } else {
      handlers.onTaskStarted?.(baseTask);
    }
  }

  return { lastSeq: data.lastSeq, counts: data.counts };
}

/**
 * Resumable agent send — POST + consume + on network error, replay
 * missed events for the current conversation. Returns the new lastSeq.
 *
 * Wraps `consumeAgentStream` with a try/catch that drives `replayMissedEvents`
 * on connection drops. The handlers see a continuous event stream; the
 * user sees the chat heal itself when the network comes back.
 *
 * For the "open the app two hours later" flow, callers should call
 * `replayMissedEvents` once on conversation mount BEFORE this — that
 * picks up anything that finished in the background — and then this
 * function handles drops mid-turn.
 */
export async function consumeAgentStreamWithReplay(
  body: ReadableStream<Uint8Array>,
  conversationId: string,
  handlers: AgentStreamHandlers,
  options: { lastSeq?: number; abortSignal?: AbortSignal } = {},
): Promise<{ lastSeq: number }> {
  let lastSeq = options.lastSeq ?? 0;
  try {
    await consumeAgentStream(body, handlers, options.abortSignal);
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { lastSeq };
    }
    console.warn("[FlowAI] live stream dropped — replaying missed events:", err);
    try {
      const replay = await replayMissedEvents(conversationId, lastSeq, handlers);
      lastSeq = replay.lastSeq;
    } catch (replayErr) {
      console.error("[FlowAI] replay also failed:", replayErr);
      handlers.onError?.(
        "Connection lost — we'll sync once you send your next message.",
        true,
      );
    }
  }
  return { lastSeq };
}
