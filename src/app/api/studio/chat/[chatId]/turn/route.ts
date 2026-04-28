import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runChatTurn, type ChatState, type ChatTurn, type CardSpec } from "@/lib/ai/studio-chat-agent";

/**
 * POST /api/studio/chat/[chatId]/turn — submit a user turn, run the
 * agent loop, persist user + agent turns, return the agent's reply +
 * any cards it emitted + dispatch envelopes the frontend should kick off.
 *
 * Phase 1: synchronous (no SSE yet). Single round-trip per user message.
 * The agent loop is bounded to ~6 iterations and tools that dispatch to
 * worker endpoints just enqueue requests — the frontend fires them in
 * parallel after the response lands so the chat feels responsive.
 *
 * Body: { content: string, attachments?: Array<{ kind, url, mime?, templateId? }> }
 * Returns: {
 *   success: true,
 *   userTurn: ChatTurn,
 *   agentTurn: ChatTurn,
 *   dispatched: Array<{ kind, status, ... }>,
 *   state: ChatState,
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    const { chatId } = await params;

    const chat = await prisma.designChat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true, title: true, state: true, status: true },
    });
    if (!chat) {
      return NextResponse.json({ success: false, error: { message: "Chat not found" } }, { status: 404 });
    }
    if (chat.userId !== session.userId) {
      return NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
    }

    const body = (await req.json()) as {
      content?: string;
      attachments?: ChatTurn["attachments"];
    };
    const userText = (body.content || "").trim();
    if (!userText && !body.attachments?.length) {
      return NextResponse.json(
        { success: false, error: { message: "Empty turn — provide content or attachments" } },
        { status: 400 },
      );
    }

    // Persist the user's turn FIRST so it's durable even if the agent
    // loop fails downstream.
    const userTurn = await prisma.designChatTurn.create({
      data: {
        chatId,
        role: "user",
        content: userText.slice(0, 4000),
        attachments: body.attachments?.length ? JSON.stringify(body.attachments) : null,
      },
    });

    // Auto-title the chat from the first user message if it's still
    // the default "New chat".
    if (chat.title === "New chat" && userText) {
      await prisma.designChat.update({
        where: { id: chatId },
        data: { title: userText.slice(0, 80) },
      });
    }

    // Load prior turns (chronological) for the agent's context window.
    const priorTurns = await prisma.designChatTurn.findMany({
      where: { chatId, id: { not: userTurn.id } },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, cards: true, attachments: true },
    });

    const history: ChatTurn[] = priorTurns.map((t) => ({
      role: (t.role as "user" | "agent"),
      content: t.content,
      cards: t.cards ? (JSON.parse(t.cards) as CardSpec[]) : undefined,
      attachments: t.attachments ? JSON.parse(t.attachments) : undefined,
    }));

    let state: ChatState = {};
    try {
      state = JSON.parse(chat.state || "{}") as ChatState;
    } catch { /* keep empty */ }

    // Run the agent.
    const result = await runChatTurn({
      history,
      userMessage: userText,
      attachments: body.attachments,
      state,
      userId: session.userId,
    });

    // Merge state.
    const newState: ChatState = { ...state, ...result.stateUpdate };

    // Persist the agent's turn.
    const agentTurn = await prisma.designChatTurn.create({
      data: {
        chatId,
        role: "agent",
        content: result.text || "",
        cards: result.cards.length ? JSON.stringify(result.cards) : null,
        toolCalls: result.toolCalls.length ? JSON.stringify(result.toolCalls) : null,
        branchId: newState.currentBranchId ?? null,
      },
    });

    // Update chat state + bump updatedAt.
    await prisma.designChat.update({
      where: { id: chatId },
      data: { state: JSON.stringify(newState) },
    });

    // Light usage log — same shape as other AI features.
    await prisma.aIUsage.create({
      data: {
        userId: session.userId,
        adminId: session.adminId ?? null,
        feature: "studio_chat_turn",
        model: "claude-opus-4-7",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        // Rough — adaptive thinking + tool calls ≈ ~5-10c per chat turn.
        costCents: Math.max(1, Math.round((result.usage.inputTokens / 1000) * 0.5 + (result.usage.outputTokens / 1000) * 2.5)),
      },
    });

    return NextResponse.json({
      success: true,
      userTurn: {
        id: userTurn.id,
        role: "user",
        content: userTurn.content,
        attachments: body.attachments ?? [],
        createdAt: userTurn.createdAt.toISOString(),
      },
      agentTurn: {
        id: agentTurn.id,
        role: "agent",
        content: agentTurn.content,
        cards: result.cards,
        branchId: agentTurn.branchId,
        createdAt: agentTurn.createdAt.toISOString(),
      },
      dispatched: result.dispatched,
      state: newState,
      iterations: result.iterations,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chat turn failed";
    console.error("[StudioChat] turn error:", err);
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 },
    );
  }
}
