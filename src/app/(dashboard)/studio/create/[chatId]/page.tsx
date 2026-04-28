import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { StudioCreateChatShell } from "@/components/studio/create-chat/studio-create-chat-shell";

/**
 * Studio Create Chat — full-page overlay route.
 *
 * Phase 1 of the design-spec at
 * docs/superpowers/specs/2026-04-26-studio-create-chat-design.md
 *
 * Mounts the FlowAI conversational front door. The user lands here from
 * the existing /studio "Create" trigger, which first POSTs to
 * /api/studio/chat to mint a fresh chatId.
 */
export default async function StudioCreateChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/studio/create/${chatId}`)}`);

  const chat = await prisma.designChat.findUnique({
    where: { id: chatId },
    select: { id: true, userId: true, title: true, status: true },
  });
  if (!chat || chat.userId !== session.userId) notFound();

  return <StudioCreateChatShell chatId={chat.id} initialTitle={chat.title} />;
}
