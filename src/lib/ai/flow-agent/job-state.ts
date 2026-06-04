import { EventEmitter } from "events";
import { getRedisBus, channel } from "./redis-bus";

/**
 * Flow-AI job-state — event bus that bridges the things that happen
 * ACROSS HTTP requests (and, in prod, across PM2 workers):
 *
 *  • PLAN CONFIRMATIONS — the agent stream is mid-loop, blocked on
 *    awaitConfirmation(planId). Meanwhile the user clicks Confirm in the
 *    UI which POSTs `/api/flow-ai/agent/confirm` — possibly on a
 *    DIFFERENT worker. That handler calls resolveConfirmation(planId,
 *    true), which publishes over Redis so the worker holding the blocked
 *    promise wakes up.
 *
 *  • BACKGROUND TASKS — a tool kicks off a long-running job (image gen,
 *    video gen, CSV import) and emits progress over time. The original
 *    chat stream subscribes. Progress emitted on the worker running the
 *    job reaches a chat stream pinned to another worker via Redis.
 *
 * Transport: when REDIS_URL is set, events flow through Redis pub/sub
 * (see redis-bus.ts) so they cross process boundaries. When it's not
 * (dev box, single node), everything stays on the in-process
 * EventEmitter. The public API is identical either way — callers don't
 * know or care which transport is active.
 */

const CONFIRM_CHANNEL = channel("confirm");

// ─── PLAN CONFIRMATIONS ────────────────────────────────────────────────

interface PendingConfirmation {
  resolve: (confirmed: boolean) => void;
  timeout: NodeJS.Timeout;
  poll: NodeJS.Timeout;
  conversationId: string;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

/**
 * Default timeout — if the user walks away and never confirms or rejects,
 * release the agent loop after 10 minutes with a rejection. The chat then
 * tells them "you didn't confirm — let me know if you still want this."
 */
const CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * DB-poll backstop interval. The confirm route flips
 * AgentPlanProposal.status in the DB BEFORE it signals the loop, and the DB
 * is the source of truth. Polling it lets the loop resolve correctly within
 * a few seconds even when the in-process / Redis wake-up signal is missed —
 * multi-device confirm, a transient Redis hiccup, or worker churn — instead
 * of hanging to the 10-min timeout and wrongly telling the user they declined.
 */
const CONFIRMATION_POLL_MS = 5 * 1000;

// When Redis is enabled, every worker listens for confirm messages and
// resolves any LOCAL pending promise that matches. The worker that
// doesn't hold the promise simply no-ops. Set up the listener once.
let confirmListenerWired = false;
function ensureConfirmListener(): void {
  if (confirmListenerWired) return;
  const bus = getRedisBus();
  if (!bus) return; // in-process mode — resolveConfirmation handles it directly
  confirmListenerWired = true;
  bus.emitter.on(CONFIRM_CHANNEL, (payload: unknown) => {
    const msg = payload as { planId?: string; confirmed?: boolean; conversationId?: string } | null;
    if (!msg || typeof msg.planId !== "string") return;
    resolveLocalConfirmation(msg.planId, msg.confirmed === true, msg.conversationId ?? "");
  });
}

/**
 * Called by the agent loop (via ToolContext.awaitConfirmation) when a
 * propose_plan card is shown. Resolves when resolveConfirmation() fires
 * for this planId, or after CONFIRMATION_TIMEOUT_MS rejects.
 */
export function awaitConfirmation(
  planId: string,
  conversationId: string,
): Promise<boolean> {
  ensureConfirmListener();

  // If two stream attempts race for the same planId, kill the older one.
  const existing = pendingConfirmations.get(planId);
  if (existing) {
    clearTimeout(existing.timeout);
    clearInterval(existing.poll);
    existing.resolve(false);
    pendingConfirmations.delete(planId);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(poll);
      pendingConfirmations.delete(planId);
      resolve(confirmed);
    };

    const timeout = setTimeout(() => finish(false), CONFIRMATION_TIMEOUT_MS);

    // Backstop: read the source-of-truth row even if no wake-up signal
    // arrives. Resolves the loop within ~5s of a confirm/reject that the
    // event bus missed. Never throws — a transient DB error just retries
    // on the next tick; the 10-min timeout still guards the worst case.
    const poll = setInterval(() => {
      void prisma.agentPlanProposal
        .findUnique({ where: { id: planId }, select: { status: true } })
        .then((row) => {
          if (!row) return; // not persisted yet / unknown — keep waiting
          if (row.status === "confirmed") finish(true);
          else if (row.status === "rejected" || row.status === "expired") finish(false);
        })
        .catch(() => {
          /* transient DB error — keep waiting */
        });
    }, CONFIRMATION_POLL_MS);

    pendingConfirmations.set(planId, { resolve: finish, timeout, poll, conversationId });
  });
}

/** Resolve a pending promise held by THIS worker. Returns whether one matched. */
function resolveLocalConfirmation(
  planId: string,
  confirmed: boolean,
  conversationId: string,
): boolean {
  const pending = pendingConfirmations.get(planId);
  if (!pending) return false;
  // Guard: confirmations from one conversation must not resolve another.
  if (conversationId && pending.conversationId !== conversationId) return false;
  clearTimeout(pending.timeout);
  pending.resolve(confirmed);
  pendingConfirmations.delete(planId);
  return true;
}

/**
 * Called by `/api/flow-ai/agent/confirm`. Resolves the pending
 * awaitConfirmation promise for this planId — locally if it lives on
 * this worker, and ALSO publishes over Redis so a promise blocked on a
 * different worker wakes up. Returns true if a LOCAL promise matched
 * (the publish reaches other workers asynchronously regardless).
 */
export function resolveConfirmation(
  planId: string,
  confirmed: boolean,
  conversationId: string,
): boolean {
  const localMatched = resolveLocalConfirmation(planId, confirmed, conversationId);
  // Fan out to other workers when Redis is enabled. Harmless if the
  // local worker already matched — other workers just won't have a
  // pending promise for this planId.
  const bus = getRedisBus();
  if (bus) {
    bus.publish(CONFIRM_CHANNEL, { planId, confirmed, conversationId });
  }
  return localMatched;
}

// ─── BACKGROUND TASK PROGRESS ──────────────────────────────────────────

export interface TaskProgressEvent {
  type: "progress" | "completed" | "failed";
  taskId: string;
  /** 0-100 for progress, or whatever the task wants to emit. */
  progress?: number;
  message?: string;
  output?: unknown;
  error?: string;
  resultRefType?: string;
  resultRefId?: string;
}

// Local delivery emitter. In Redis mode it is fed EXCLUSIVELY by the
// Redis subscriber (so events publish to Redis, come back via the
// subscriber, and get delivered once — consistent across all workers).
// In in-process mode publishTaskEvent emits to it directly.
const taskBus = new EventEmitter();
// Bump the cap — many concurrent agent runs may subscribe.
taskBus.setMaxListeners(500);

const TASK_ANY_CHANNEL = channel("task:any");

// Wire the Redis subscriber → local taskBus once. Every worker that
// imports this module starts listening, so a task progress event
// published on any worker is delivered to subscribers on every worker.
let taskListenerWired = false;
function ensureTaskListener(): void {
  if (taskListenerWired) return;
  const bus = getRedisBus();
  if (!bus) return; // in-process mode
  taskListenerWired = true;
  // Re-emit Redis messages onto the local bus using the same event
  // names subscribeToTask / subscribeToAllTasks listen on.
  bus.emitter.on(TASK_ANY_CHANNEL, (payload: unknown) => {
    const event = payload as TaskProgressEvent;
    if (event && typeof event.taskId === "string") {
      taskBus.emit(`task:${event.taskId}`, event);
      taskBus.emit("task:any", event);
    }
  });
}

/**
 * Background-task runner publishes progress. In Redis mode the event
 * goes out over Redis and comes back via the subscriber (single
 * delivery path across all workers). In in-process mode it emits
 * directly to the local bus.
 */
export function publishTaskEvent(event: TaskProgressEvent): void {
  const bus = getRedisBus();
  if (bus) {
    ensureTaskListener();
    // Publish to the global channel only — the subscriber fans out to
    // both the per-task and the "any" local listeners. Publishing to a
    // single channel keeps it simple and avoids double delivery.
    bus.publish(TASK_ANY_CHANNEL, event);
    return;
  }
  // In-process fallback.
  taskBus.emit(`task:${event.taskId}`, event);
  taskBus.emit("task:any", event);
}

/**
 * Subscribe to events for a specific taskId. Returns an unsubscribe fn.
 */
export function subscribeToTask(
  taskId: string,
  handler: (event: TaskProgressEvent) => void,
): () => void {
  ensureTaskListener();
  taskBus.on(`task:${taskId}`, handler);
  return () => taskBus.off(`task:${taskId}`, handler);
}

/**
 * Subscribe to ALL task events (used by the notification dispatcher to
 * fire a Notification row + email/SMS when any task completes).
 */
export function subscribeToAllTasks(
  handler: (event: TaskProgressEvent) => void,
): () => void {
  ensureTaskListener();
  taskBus.on("task:any", handler);
  return () => taskBus.off("task:any", handler);
}

// ─── TASK-RUNNER UTILITIES ─────────────────────────────────────────────
// Thin helpers used by tool handlers that want to spawn a background job.
// The actual long-running work runs via `setImmediate(...)` so the tool
// can return immediately with the task id while the work continues. The
// agent loop sees the task id and tells the user "I'll notify you when
// it's done", then the loop ends. The user is free to leave the chat.

import { prisma } from "@/lib/db/client";

export interface SpawnBackgroundTaskInput {
  userId: string;
  conversationId: string;
  messageId: string;
  kind: string;
  input: Record<string, unknown>;
  creditCost?: number;
  /** Async worker. Receives the task id and should publish progress events. */
  worker: (taskId: string) => Promise<{
    output?: unknown;
    resultRefType?: string;
    resultRefId?: string;
  }>;
}

/**
 * Create an AgentTask row + run the worker in the background. Returns
 * the task id synchronously so the tool can return it to the agent.
 *
 * Worker exceptions are caught — they mark the task failed and publish a
 * `failed` event so the chat stream can render an error card without
 * crashing the conversation.
 */
export async function spawnBackgroundTask(
  input: SpawnBackgroundTaskInput,
): Promise<string> {
  const task = await prisma.agentTask.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      kind: input.kind,
      status: "pending",
      input: JSON.stringify(input.input).slice(0, 16000),
      creditCost: input.creditCost ?? 0,
    },
  });

  // Run worker on next tick so the caller's response goes out first.
  setImmediate(async () => {
    try {
      await prisma.agentTask.update({
        where: { id: task.id },
        data: { status: "running", startedAt: new Date() },
      });

      const result = await input.worker(task.id);

      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: "completed",
          output: result.output ? JSON.stringify(result.output).slice(0, 32000) : null,
          resultRefType: result.resultRefType ?? null,
          resultRefId: result.resultRefId ?? null,
          completedAt: new Date(),
        },
      });

      publishTaskEvent({
        type: "completed",
        taskId: task.id,
        output: result.output,
        resultRefType: result.resultRefType,
        resultRefId: result.resultRefId,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[flow-agent] Background task ${task.id} failed:`, e);
      try {
        await prisma.agentTask.update({
          where: { id: task.id },
          data: {
            status: "failed",
            error: errMsg.slice(0, 1000),
            completedAt: new Date(),
          },
        });
      } catch {
        /* swallow secondary failure */
      }
      publishTaskEvent({ type: "failed", taskId: task.id, error: errMsg });
    }
  });

  return task.id;
}
