import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/studio/chat — create a new chat session.
 * GET  /api/studio/chat — list current user's chats (sidebar).
 *
 * See docs/superpowers/specs/2026-04-26-studio-create-chat-design.md
 */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  let body: { initialPrompt?: string; title?: string } = {};
  try {
    body = await req.json();
  } catch { /* empty body OK */ }

  const chat = await prisma.designChat.create({
    data: {
      userId: session.userId,
      title: body.title?.trim() || "New chat",
      state: "{}",
      status: "active",
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });

  // If the caller passed an initialPrompt, seed the first user turn so
  // the chat page opens with the message already typed-in / submitted.
  // The frontend fires the agent turn endpoint immediately on mount.
  if (typeof body.initialPrompt === "string" && body.initialPrompt.trim()) {
    await prisma.designChatTurn.create({
      data: {
        chatId: chat.id,
        role: "user",
        content: body.initialPrompt.trim().slice(0, 4000),
      },
    });
  }

  return NextResponse.json({
    success: true,
    chat: { id: chat.id, title: chat.title, createdAt: chat.createdAt.toISOString(), updatedAt: chat.updatedAt.toISOString() },
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") === "archived" ? "archived" : "active";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);

  const chats = await prisma.designChat.findMany({
    where: { userId: session.userId, status },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { designs: true, turns: true } },
    },
  });

  return NextResponse.json({
    success: true,
    chats: chats.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      designCount: c._count.designs,
      turnCount: c._count.turns,
    })),
  });
}
