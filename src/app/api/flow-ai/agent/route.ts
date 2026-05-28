import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runFlowAgent } from "@/lib/ai/flow-agent/agent-loop";
import { awaitConfirmation } from "@/lib/ai/flow-agent/job-state";
import { ai, HAIKU_MODEL } from "@/lib/ai/client";
import type { AgentEvent } from "@/lib/ai/flow-agent/tool-context";

/**
 * Generate a short title for a brand-new conversation from the first
 * user message. Fire-and-forget — failures leave the default
 * "New Conversation" rather than blocking anything.
 */
async function autoTitleConversation(conversationId: string, seed: string): Promise<void> {
  try {
    const raw = await ai.generate(
      `Summarize this into a 3-6 word conversation title. No quotes, no trailing punctuation, Title Case:\n\n"${seed.slice(0, 400)}"`,
      { model: HAIKU_MODEL, maxTokens: 24, temperature: 0.3, systemPrompt: "You write concise chat titles. Output only the title." },
    );
    const title = raw.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/[.!?]+$/, "").slice(0, 60);
    if (title) {
      await prisma.aIConversation.update({ where: { id: conversationId }, data: { title } });
    }
  } catch {
    /* keep default title */
  }
}

/**
 * POST /api/flow-ai/agent — SSE-streaming Flow-AI agent endpoint.
 *
 * Body: { conversationId?: string, message: string, timezone?: string, clientNow?: string }
 *
 * Streams Server-Sent Events of shape `data: <json>\n\n`. Event payloads
 * are AgentEvent (see tool-context.ts) — the frontend dispatches each by
 * `type` to render text deltas, tool-call cards, plan-proposal cards,
 * task progress, credit charges, and errors.
 *
 * Per feedback-no-stuck-ai-chat: this route NEVER 4xx/5xx after the
 * stream opens. Errors arrive as `error` events; the stream always emits
 * a final `done` event. The ONLY pre-stream gate is authentication.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — plenty for tool loops with media generation

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    conversationId?: string;
    message?: string;
    timezone?: string;
    clientNow?: string;
    attachments?: Array<{ dataUrl?: string; name?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";

  // Parse image attachments (base64 data URLs from the composer's file
  // picker). Cap at 4 images, 5 MB each, to keep the model request sane.
  const attachments: Array<{ mediaType: string; dataBase64: string }> = [];
  if (Array.isArray(body.attachments)) {
    for (const a of body.attachments.slice(0, 4)) {
      if (typeof a?.dataUrl !== "string") continue;
      const m = a.dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
      if (!m) continue;
      const dataBase64 = m[2];
      // ~5 MB raw → ~6.7 MB base64
      if (dataBase64.length > 7_000_000) continue;
      attachments.push({ mediaType: m[1] === "image/jpg" ? "image/jpeg" : m[1], dataBase64 });
    }
  }

  // A message OR at least one attachment is required.
  if (!message && attachments.length === 0) {
    return new Response(JSON.stringify({ error: "message or an attachment is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get or create the conversation. We do this BEFORE the stream opens
  // so any DB error surfaces as a regular HTTP error the client can
  // handle, not as an SSE failure.
  let conversationId: string;
  let isNewConversation = false;
  const existingConv = body.conversationId
    ? await prisma.aIConversation.findFirst({
        where: { id: body.conversationId, userId: session.userId },
        select: { id: true },
      })
    : null;
  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    // No id, OR a stale client-cached id that no longer exists for this
    // user (deleted conversation, different account, DB reset between
    // deploys). NEVER 404 here — a stale cache must not block the chat
    // (see feedback-no-stuck-ai-chat). Just start a fresh conversation;
    // the client adopts the new id from the `start` event.
    const created = await prisma.aIConversation.create({
      data: { userId: session.userId },
      select: { id: true },
    });
    conversationId = created.id;
    isNewConversation = true;
  }

  // Persist the user turn immediately so it survives a client disconnect.
  // Note: attachment images aren't persisted to the message row (they're
  // transient vision input); a marker keeps the thread readable on reload.
  const persistedContent = message || (attachments.length > 0 ? `[sent ${attachments.length} image${attachments.length > 1 ? "s" : ""}]` : "");
  const userMsg = await prisma.aIMessage.create({
    data: { conversationId, role: "user", content: persistedContent },
    select: { id: true },
  });

  // Pre-create the assistant message row so tool-call audit rows have a
  // valid foreign key. We'll update content + metadata after the loop.
  const assistantMsg = await prisma.aIMessage.create({
    data: { conversationId, role: "assistant", content: "" },
    select: { id: true },
  });

  // Pull the most recent ~20 turns so the model has context.
  const history = await prisma.aIMessage.findMany({
    where: { conversationId, id: { not: assistantMsg.id } },
    orderBy: { createdAt: "asc" },
    take: 40,
    select: { role: true, content: true, metadata: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { plan: true },
  });
  const plan = user?.plan ?? "STARTER";

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort(), { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* controller already closed */
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

      // Open the stream with a start event so the client can hide
      // its "connecting…" spinner immediately.
      send({ type: "start", conversationId, messageId: assistantMsg.id });

      // Track text + metadata we'll persist to the assistant message row.
      let assembledText = "";
      const toolCallSummaries: Array<{
        id: string;
        name: string;
        ok: boolean;
        errorCode?: string;
        creditCost: number;
      }> = [];
      const planProposalIds: string[] = [];
      const taskIds: string[] = [];

      // Wrap emit so we can sniff certain events for persistence.
      const emit = (event: AgentEvent) => {
        if (event.type === "text_delta") {
          assembledText += event.text;
        } else if (event.type === "tool_call_result") {
          const okFlag =
            typeof event.output === "object" &&
            event.output !== null &&
            "ok" in event.output &&
            (event.output as { ok?: unknown }).ok === true;
          toolCallSummaries.push({
            id: event.id,
            name: event.name,
            ok: okFlag,
            errorCode: event.errorCode,
            creditCost: event.creditCost,
          });
        } else if (event.type === "plan_proposal") {
          planProposalIds.push(event.id);
        } else if (event.type === "task_started") {
          taskIds.push(event.taskId);
        }
        send(event);
      };

      try {
        const result = await runFlowAgent({
          userId: session.userId,
          isAdmin: !!session.adminId,
          plan,
          conversationId,
          messageId: assistantMsg.id,
          userMessage: message || "(see attached image)",
          attachments,
          history: history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            metadata: m.metadata,
          })),
          clientNow: body.clientNow,
          timezone: body.timezone,
          abortSignal: abortController.signal,
          emit,
          awaitConfirmation: (planId) => awaitConfirmation(planId, conversationId),
        });

        // Persist the final assistant message.
        const metadata = {
          toolCalls: toolCallSummaries,
          planProposals: planProposalIds,
          taskRefs: taskIds,
          tokensUsed: result.tokensUsed,
          creditsUsed: result.creditsUsed,
        };
        await prisma.aIMessage.update({
          where: { id: assistantMsg.id },
          data: {
            content: result.finalText || assembledText,
            tokensUsed: result.tokensUsed,
            metadata: JSON.stringify(metadata),
          },
        });
        await prisma.aIConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Auto-title a brand-new conversation from the first user message
        // (or its attachments). Fire-and-forget so it never delays the
        // stream close. Without this every conversation reads
        // "New Conversation" and they all look merged in the sidebar.
        if (isNewConversation) {
          const titleSeed = message || "Shared an image";
          autoTitleConversation(conversationId, titleSeed).catch(() => {});
        }

        send({
          type: "done",
          tokensUsed: result.tokensUsed,
          creditsUsed: result.creditsUsed,
          iterations: result.iterations,
        });
      } catch (e) {
        // Belt-and-braces: agent-loop already converts everything to
        // events, but if anything escapes (DB outage, etc.), surface it
        // as an error event so the stream still closes cleanly.
        const msg = e instanceof Error ? e.message : "Agent failed";
        console.error("[flow-ai/agent] Stream failure:", e);
        send({ type: "error", message: msg, recoverable: false });
        send({ type: "done", tokensUsed: 0, creditsUsed: 0, iterations: 0 });
      } finally {
        close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: don't buffer SSE
    },
  });
}
