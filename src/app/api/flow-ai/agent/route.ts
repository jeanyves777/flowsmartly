import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runFlowAgent } from "@/lib/ai/flow-agent/agent-loop";
import { awaitConfirmation } from "@/lib/ai/flow-agent/job-state";
import { ai, HAIKU_MODEL } from "@/lib/ai/client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { saveToMediaLibrary } from "@/lib/ai/flow-agent/save-media";
import { loadImageAsVisionBase64 } from "@/lib/ai/flow-agent/load-image-buffer";
import { recordAiMemory } from "@/lib/ai-memory";
import { nanoid } from "nanoid";

/**
 * Tools that are pure lookups / introspection — an agent turn that only
 * called these did nothing worth remembering. We auto-capture a memory
 * highlight only when the agent took a real ACTION (created/scheduled/
 * generated something) so cross-conversation memory stays signal, not noise.
 */
const INTROSPECTION_TOOLS = new Set<string>([
  "who_am_i",
  "list_my_features",
  "search_features",
  "get_brand_identity",
  "list_scheduled_posts",
  "get_calendar",
  "list_campaigns",
  "list_automations",
  "get_credits_history",
  "list_voices",
  "list_connected_socials",
  "recall",
  "read_image",
  "analyze_url",
  "propose_plan",
  "remember",
]);
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
    /** Serialized focused-view canvas state — exposes/feeds the update_canvas tool. */
    canvasContext?: string;
    /** Which focused surface the user is on (Brand, Sell, …) + a little state. */
    surfaceContext?: string;
    // `dataUrl` = a base64 upload from the device file picker.
    // `url`     = an already-hosted image the user picked from their media
    //             library (no re-upload needed — fetched server-side for vision).
    attachments?: Array<{ dataUrl?: string; url?: string; name?: string }>;
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

  // Split incoming attachments into device base64 uploads vs already-hosted
  // media-library picks. Cap at 4 total. Both feed Claude vision; only base64
  // uploads need an S3 upload (library picks are already hosted).
  const base64Items: Array<{ mediaType: string; dataBase64: string }> = [];
  const libraryUrls: string[] = [];
  if (Array.isArray(body.attachments)) {
    for (const a of body.attachments.slice(0, 4)) {
      if (typeof a?.dataUrl === "string") {
        const m = a.dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
        if (!m) continue;
        const dataBase64 = m[2];
        // ~5 MB raw → ~6.7 MB base64
        if (dataBase64.length > 7_000_000) continue;
        base64Items.push({ mediaType: m[1] === "image/jpg" ? "image/jpeg" : m[1], dataBase64 });
      } else if (typeof a?.url === "string" && /^https?:\/\//.test(a.url)) {
        libraryUrls.push(a.url);
      }
    }
  }

  // Vision blocks fed to the model + the hosted URLs the agent can reuse in
  // tools (mediaUrl / referenceImageUrls). Kept as two parallel arrays — the
  // agent loop reads `attachments` for vision and `attachmentUrls` for usage.
  const attachments: Array<{ mediaType: string; dataBase64: string }> = [];
  const attachmentUrls: string[] = [];

  // Device uploads: store to S3 + the media library so they persist + show in
  // /media, and the agent gets a real URL. Vision still gets the base64.
  for (const item of base64Items) {
    attachments.push({ mediaType: item.mediaType, dataBase64: item.dataBase64 });
    try {
      const ext = item.mediaType.includes("png") ? "png" : item.mediaType.includes("webp") ? "webp" : item.mediaType.includes("gif") ? "gif" : "jpg";
      const buf = Buffer.from(item.dataBase64, "base64");
      const key = `flow-ai/${session.userId}/upload-${nanoid(8)}.${ext}`;
      const url = await uploadToS3(key, buf, item.mediaType);
      attachmentUrls.push(url);
      await saveToMediaLibrary({
        userId: session.userId,
        url,
        type: "image",
        mimeType: item.mediaType,
        size: buf.length,
        tags: ["flow-ai", "upload"],
      }).catch(() => {});
    } catch (e) {
      console.error("[flow-ai/agent] attachment upload failed (vision still works):", e);
    }
  }

  // Media-library picks: already hosted — just expose the URL to the agent and
  // fetch it server-side into base64 so the model can SEE it too. No re-save.
  for (const url of libraryUrls.slice(0, Math.max(0, 4 - attachments.length))) {
    attachmentUrls.push(url);
    const vision = await loadImageAsVisionBase64(url);
    if (vision) attachments.push({ mediaType: vision.mediaType, dataBase64: vision.base64 });
  }

  // A message OR at least one attachment is required.
  if (!message && attachments.length === 0 && attachmentUrls.length === 0) {
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
  const imageCount = Math.max(attachments.length, attachmentUrls.length);
  const persistedContent = message || (imageCount > 0 ? `[sent ${imageCount} image${imageCount > 1 ? "s" : ""}]` : "");
  const userMsg = await prisma.aIMessage.create({
    data: {
      conversationId,
      role: "user",
      content: persistedContent,
      // Surface the uploaded image in the thread (renders in the user
      // bubble + survives reload).
      mediaType: attachmentUrls.length > 0 ? "image" : null,
      mediaUrl: attachmentUrls[0] ?? null,
    },
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
    // mediaType/mediaUrl are required so the agent retains awareness of
    // images shared on earlier turns — without them a follow-up turn (or a
    // post-reload rebuild) forgets the image existed (see agent-loop image
    // re-injection).
    select: { role: true, content: true, metadata: true, mediaType: true, mediaUrl: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { plan: true },
  });
  const plan = user?.plan ?? "STARTER";

  // Live background-task status for this conversation — so the agent
  // KNOWS what already finished and doesn't say "I'll let you know" about
  // a job that's already done.
  const recentTaskRows = await prisma.agentTask.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, kind: true, status: true, output: true, error: true },
  });
  const recentTasks = recentTaskRows.map((t) => {
    let resultUrl: string | null = null;
    if (t.output) {
      try {
        const out = JSON.parse(t.output) as { url?: string };
        if (typeof out.url === "string") resultUrl = out.url;
      } catch {
        /* ignore */
      }
    }
    return {
      id: t.id,
      kind: t.kind,
      status: t.status,
      note: t.status === "failed" ? t.error?.slice(0, 120) ?? undefined : undefined,
      resultUrl,
    };
  });

  // Recent plan proposals in THIS conversation + their status — so the agent
  // KNOWS what it already proposed and whether the user confirmed/canceled,
  // and doesn't re-propose or act confused after a cancel. Pairs with the
  // chronological cards now persisted in message metadata.
  const recentProposalRows = await prisma.agentPlanProposal.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, summary: true, status: true, totalCreditCost: true },
  });
  const recentProposals = recentProposalRows.map((p) => ({
    id: p.id,
    summary: p.summary,
    status: p.status,
    totalCreditCost: p.totalCreditCost,
  }));

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
      // SSE keep-alive — a comment ping every 15s so the client can tell a LIVE
      // (but quiet) turn from a dead/half-open socket or a worker killed mid-turn.
      // Paired with the client's 60s idle timeout in consumeAgentStream. Comments
      // (": …") carry no `data:` event, so the client just resets its idle timer.
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const ping = () => { if (closed) return; try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch { /* already closed */ } };

      // Open the stream with a start event so the client can hide
      // its "connecting…" spinner immediately.
      send({ type: "start", conversationId, messageId: assistantMsg.id });
      heartbeat = setInterval(ping, 15_000);

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
      // Ordered block structure for the turn — so a reloaded chat renders
      // chronologically (text → chip → text → card) instead of flat text.
      // Each tool/proposal/task block references a row by id; text blocks
      // carry their own segment. Persisted to AIMessage.metadata.blocks.
      type Block =
        | { type: "text"; text: string }
        | { type: "tool" | "proposal" | "task"; id: string }
        | { type: "templates"; requestId: string; templates: unknown[] }
        | { type: "question"; requestId: string; question: string; options: unknown[]; allowOther?: boolean };
      const blocks: Block[] = [];
      const pushCardBlock = (type: "tool" | "proposal" | "task", id: string) => {
        if (!blocks.some((b) => b.type === type && (b as { id?: string }).id === id)) blocks.push({ type, id });
      };

      // Wrap emit so we can sniff certain events for persistence.
      const emit = (event: AgentEvent) => {
        if (event.type === "text_delta") {
          assembledText += event.text;
          const last = blocks[blocks.length - 1];
          if (last && last.type === "text") last.text += event.text;
          else blocks.push({ type: "text", text: event.text });
        } else if (event.type === "tool_call_start") {
          pushCardBlock("tool", event.id);
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
          pushCardBlock("tool", event.id); // belt-and-braces if start was missed
        } else if (event.type === "plan_proposal") {
          planProposalIds.push(event.id);
          pushCardBlock("proposal", event.id);
        } else if (event.type === "task_started") {
          taskIds.push(event.taskId);
          pushCardBlock("task", event.taskId);
        } else if (event.type === "template_options") {
          // Self-contained so a reloaded chat re-renders the picker from metadata.
          if (!blocks.some((b) => b.type === "templates" && (b as { requestId?: string }).requestId === event.requestId)) {
            blocks.push({ type: "templates", requestId: event.requestId, templates: event.templates });
          }
        } else if (event.type === "question_options") {
          if (!blocks.some((b) => b.type === "question" && (b as { requestId?: string }).requestId === event.requestId)) {
            blocks.push({ type: "question", requestId: event.requestId, question: event.question, options: event.options, allowOther: event.allowOther });
          }
        }
        send(event);
      };

      try {
        const result = await runFlowAgent({
          userId: session.userId,
          isAdmin: !!session.adminId,
          superMode: (body as { superMode?: boolean }).superMode === true,
          canvasContext: typeof body.canvasContext === "string" ? body.canvasContext.slice(0, 2000) : undefined,
          surfaceContext: typeof body.surfaceContext === "string" ? body.surfaceContext.slice(0, 1500) : undefined,
          plan,
          conversationId,
          messageId: assistantMsg.id,
          userMessage: message || "(see attached image)",
          attachments,
          attachmentUrls,
          history: history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            metadata: m.metadata,
            mediaType: m.mediaType,
            mediaUrl: m.mediaUrl,
          })),
          clientNow: body.clientNow,
          timezone: body.timezone,
          recentTasks,
          recentProposals,
          abortSignal: abortController.signal,
          emit,
          awaitConfirmation: (planId) => awaitConfirmation(planId, conversationId),
        });

        // Persist the final assistant message. `blocks` preserves the
        // chronological order of text + tool/proposal/task cards so a
        // reloaded chat reconstructs the exact flow.
        const metadata = {
          toolCalls: toolCallSummaries,
          planProposals: planProposalIds,
          taskRefs: taskIds,
          blocks,
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

        // Auto-capture a cross-conversation memory highlight when the agent
        // took a REAL action this turn (not just lookups). This builds the
        // user's data-awareness layer automatically — so even if the agent
        // didn't explicitly call `remember`, future turns/conversations know
        // what was done here. Fire-and-forget; never blocks the stream.
        const actionTools = toolCallSummaries.filter(
          (t) => t.ok && !INTROSPECTION_TOOLS.has(t.name),
        );
        if (actionTools.length > 0 || taskIds.length > 0) {
          const did = Array.from(new Set(actionTools.map((t) => t.name))).join(", ");
          const ask = (message || "(image-led request)").replace(/\s+/g, " ").slice(0, 140);
          recordAiMemory({
            userId: session.userId,
            kind: "chat-highlight",
            summary: `Asked: "${ask}"${did ? ` → did: ${did}` : taskIds.length ? " → started a background job" : ""}`,
            content: { conversationId, tools: did, taskCount: taskIds.length },
            referenceType: "AIConversation",
            referenceId: conversationId,
          });
        }

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
        if (heartbeat) clearInterval(heartbeat);
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
