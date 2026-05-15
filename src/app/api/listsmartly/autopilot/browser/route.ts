import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  controlListSmartlyAgentBrowser,
  getListSmartlyAgentBrowserView,
  type ListSmartlyAgentBrowserControl,
} from "@/lib/listsmartly/claude-browser-agent";
import {
  processAutopilotTask,
  resumeAutopilotTaskAfterBrowserControl,
} from "@/lib/listsmartly/autopilot-agent";

async function assertTaskAccess(userId: string, taskId: string) {
  const profile = await prisma.listSmartlyProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return null;

  return prisma.listSmartlyAutopilotTask.findFirst({
    where: {
      id: taskId,
      profileId: profile.id,
      status: { in: ["in_progress", "needs_user"] },
    },
    select: { id: true },
  });
}

function normalizeControl(body: Record<string, unknown>): ListSmartlyAgentBrowserControl | null {
  const action = String(body.action || "");
  if (action === "click") {
    return {
      action,
      x: Number(body.x || 0),
      y: Number(body.y || 0),
    };
  }
  if (action === "move") {
    return {
      action,
      x: Number(body.x || 0),
      y: Number(body.y || 0),
    };
  }
  if (action === "mouse_down") {
    return {
      action,
      x: Number(body.x || 0),
      y: Number(body.y || 0),
    };
  }
  if (action === "mouse_up") {
    return {
      action,
      x: body.x === undefined ? undefined : Number(body.x || 0),
      y: body.y === undefined ? undefined : Number(body.y || 0),
    };
  }
  if (action === "press_hold") {
    return {
      action,
      x: body.x === undefined ? undefined : Number(body.x || 0),
      y: body.y === undefined ? undefined : Number(body.y || 0),
      durationMs: Number(body.durationMs || 18000),
    };
  }
  if (action === "type") {
    return {
      action,
      text: String(body.text || ""),
    };
  }
  if (action === "key") {
    return {
      action,
      key: String(body.key || ""),
    };
  }
  if (action === "scroll") {
    return {
      action,
      deltaY: Number(body.deltaY || 0),
    };
  }
  if (action === "refresh") return { action };
  return null;
}

function createBrowserViewStream(taskId: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let sending = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
          if (interval) clearInterval(interval);
        }
      };

      const sendView = async () => {
        if (closed || sending) return;
        sending = true;
        try {
          const view = await getListSmartlyAgentBrowserView(taskId);
          enqueue("view", view);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to stream live browser";
          enqueue("stream_error", { message });
        } finally {
          sending = false;
        }
      };

      void sendView();
      interval = setInterval(() => void sendView(), 1200);
      signal.addEventListener("abort", () => {
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Stream may already be closed by the client.
        }
      });
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const taskId = request.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ success: false, error: { message: "Task id is required" } }, { status: 400 });
    }

    const task = await assertTaskAccess(session.userId, taskId);
    if (!task) {
      return NextResponse.json({ success: false, error: { message: "Live browser task not found" } }, { status: 404 });
    }

    if (request.nextUrl.searchParams.get("stream") === "1") {
      return new Response(createBrowserViewStream(taskId, request.signal), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const view = await getListSmartlyAgentBrowserView(taskId);
    return NextResponse.json({ success: true, data: view });
  } catch (error) {
    console.error("Get ListSmartly live browser error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load live browser" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const taskId = String(body.taskId || "");
    if (!taskId) {
      return NextResponse.json({ success: false, error: { message: "Task id is required" } }, { status: 400 });
    }

    const task = await assertTaskAccess(session.userId, taskId);
    if (!task) {
      return NextResponse.json({ success: false, error: { message: "Live browser task not found" } }, { status: 404 });
    }

    const control = normalizeControl(body);
    if (!control) {
      return NextResponse.json({ success: false, error: { message: "Unsupported browser control" } }, { status: 400 });
    }

    const view = await controlListSmartlyAgentBrowser(taskId, control);
    if (control.action !== "mouse_down" && control.action !== "move") {
      const resume = await resumeAutopilotTaskAfterBrowserControl(session.userId, taskId).catch((error) => {
        console.error("Resume ListSmartly agent after browser control error:", error);
        return null;
      });
      if (resume?.resumed && resume.task?.id) {
        void processAutopilotTask(session.userId, resume.task.id).catch((error) => {
          console.error("Background ListSmartly autopilot resume failed:", error);
        });
      }
    }
    return NextResponse.json({ success: true, data: view });
  } catch (error) {
    console.error("Control ListSmartly live browser error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to control live browser" } }, { status: 500 });
  }
}
