import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { subscribeToTask, type TaskProgressEvent } from "@/lib/ai/flow-agent/job-state";

/**
 * GET /api/flow-ai/tasks/[id]/stream — SSE catch-up + live progress for a
 * single AgentTask.
 *
 * On open we emit the current DB state as a synthetic event ("snapshot"),
 * THEN we subscribe to live events so anything that arrives next is sent
 * through. If the task is already completed/failed by the time the client
 * opens this stream, the snapshot has the final answer and we close.
 *
 * Use case: the phone-reopens-2-hours-later flow. Chat UI sees a
 * `task_started` event in message metadata; on mount it opens this
 * endpoint per active task. If the task finished while the app was
 * closed, the user instantly sees the result without waiting for a
 * round-trip.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: taskId } = await params;
  const task = await prisma.agentTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      userId: true,
      status: true,
      kind: true,
      output: true,
      error: true,
      resultRefType: true,
      resultRefId: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
  if (!task || task.userId !== session.userId) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* controller closed */
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // 1. Snapshot of current DB state.
      send({
        type: "snapshot",
        taskId: task.id,
        status: task.status,
        kind: task.kind,
        output: safeJson(task.output),
        error: task.error,
        resultRefType: task.resultRefType,
        resultRefId: task.resultRefId,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
      });

      // 2. If already final, close — no live updates coming.
      if (task.status === "completed" || task.status === "failed" || task.status === "canceled") {
        send({ type: "done" });
        close();
        return;
      }

      // 3. Subscribe to live progress events for this task.
      const unsubscribe = subscribeToTask(taskId, (event: TaskProgressEvent) => {
        send(event as unknown as Record<string, unknown>);
        if (event.type === "completed" || event.type === "failed") {
          send({ type: "done" });
          unsubscribe();
          close();
        }
      });

      req.signal.addEventListener(
        "abort",
        () => {
          unsubscribe();
          close();
        },
        { once: true },
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function safeJson(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
