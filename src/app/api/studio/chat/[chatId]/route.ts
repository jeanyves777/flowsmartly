import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import type { CardSpec } from "@/lib/ai/studio-chat-agent";

/**
 * GET    /api/studio/chat/[chatId] — fetch chat metadata + full turn history (resume).
 * PATCH  /api/studio/chat/[chatId] — rename or change status.
 * DELETE /api/studio/chat/[chatId] — soft delete (status=archived).
 */

async function authorize(chatId: string, userId: string) {
  const chat = await prisma.designChat.findUnique({
    where: { id: chatId },
    select: { id: true, userId: true, title: true, state: true, status: true, createdAt: true, updatedAt: true },
  });
  if (!chat) return null;
  if (chat.userId !== userId) return null;
  return chat;
}

function parseCards(cards: string | null): CardSpec[] {
  if (!cards) return [];
  try {
    const parsed = JSON.parse(cards);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAttachments(attachments: string | null) {
  if (!attachments) return [];
  try {
    const parsed = JSON.parse(attachments);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { chatId } = await params;
  const chat = await authorize(chatId, session.userId);
  if (!chat) {
    return NextResponse.json({ success: false, error: { message: "Chat not found" } }, { status: 404 });
  }

  const turns = await prisma.designChatTurn.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      cards: true,
      attachments: true,
      branchId: true,
      createdAt: true,
    },
  });

  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(chat.state || "{}");
  } catch { /* keep empty */ }

  let naturalAgentReplySeen = false;
  const responseTurns = turns.map((t) => {
    const cards = parseCards(t.cards);
    const visibleCards = cards.filter((card) => naturalAgentReplySeen || card.type !== "confirm_summary");
    if (t.role === "agent" && t.content.trim().length > 0 && cards.length === 0) {
      naturalAgentReplySeen = true;
    }
    return {
      id: t.id,
      role: t.role,
      content: t.content,
      cards: visibleCards,
      attachments: parseAttachments(t.attachments),
      branchId: t.branchId,
      createdAt: t.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    success: true,
    chat: {
      id: chat.id,
      title: chat.title,
      state,
      status: chat.status,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
    },
    turns: responseTurns,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { chatId } = await params;
  const chat = await authorize(chatId, session.userId);
  if (!chat) {
    return NextResponse.json({ success: false, error: { message: "Chat not found" } }, { status: 404 });
  }
  const body = (await req.json()) as { title?: string; status?: "active" | "archived" };

  const updated = await prisma.designChat.update({
    where: { id: chatId },
    data: {
      ...(typeof body.title === "string" ? { title: body.title.trim().slice(0, 200) } : {}),
      ...(body.status === "active" || body.status === "archived" ? { status: body.status } : {}),
    },
    select: { id: true, title: true, status: true },
  });
  return NextResponse.json({ success: true, chat: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { chatId } = await params;
  const chat = await authorize(chatId, session.userId);
  if (!chat) {
    return NextResponse.json({ success: false, error: { message: "Chat not found" } }, { status: 404 });
  }
  await prisma.designChat.update({ where: { id: chatId }, data: { status: "archived" } });
  return NextResponse.json({ success: true });
}
