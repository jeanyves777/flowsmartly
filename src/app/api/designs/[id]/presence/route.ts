import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkDesignAccess, checkShareTokenAccess } from "@/lib/designs/access";
import {
  addPresence,
  removePresence,
  getPresence,
  broadcastToDesign,
  updatePresenceHeartbeat,
} from "@/lib/designs/presence";
import type { PresenceEntry } from "@/lib/designs/presence";

export const dynamic = "force-dynamic";

// GET /api/designs/[id]/presence — SSE stream for real-time presence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: designId } = await params;

  // Auth: check session or share token
  const session = await getSession();
  const shareToken = request.nextUrl.searchParams.get("share");

  let userId: string;
  let userName: string;
  let avatarUrl: string | null = null;
  let role: "OWNER" | "EDITOR" | "VIEWER" = "VIEWER";

  if (session) {
    userId = session.userId;
    userName = session.user.name || session.user.email || "Anonymous";
    avatarUrl = session.user.avatarUrl || null;

    const access = await checkDesignAccess(designId, userId);
    if (access.allowed && access.role) {
      role = access.role;
    } else if (shareToken) {
      const shareAccess = await checkShareTokenAccess(shareToken);
      if (!shareAccess || shareAccess.designId !== designId) {
        return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
      }
      role = shareAccess.permission === "EDIT" ? "EDITOR" : "VIEWER";
    } else {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }
  } else if (shareToken) {
    const shareAccess = await checkShareTokenAccess(shareToken);
    if (!shareAccess || shareAccess.designId !== designId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }
    userId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    userName = "Anonymous Viewer";
    role = shareAccess.permission === "EDIT" ? "EDITOR" : "VIEWER";
  } else {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const sessionKey = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const encoder = new TextEncoder();

  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Register presence
      const entry: PresenceEntry = {
        userId,
        userName,
        avatarUrl,
        role,
        cursor: null,
        selectedObjectId: null,
        lastSeen: Date.now(),
        controller,
      };
      addPresence(designId, sessionKey, entry);

      // Send initial presence state
      const currentUsers = getPresence(designId);
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "presence:init",
            users: currentUsers,
            sessionKey,
            myRole: role,
          })}\n\n`
        )
      );

      // Broadcast join to others
      broadcastToDesign(
        designId,
        "presence:join",
        { user: { userId, userName, avatarUrl, role, cursor: null, selectedObjectId: null } },
        sessionKey
      );

      // Heartbeat every 15 seconds
      heartbeatInterval = setInterval(() => {
        try {
          updatePresenceHeartbeat(designId, sessionKey);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`));
        } catch {
          // Stream closed
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15_000);
    },

    cancel() {
      // Client disconnected
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      removePresence(designId, sessionKey);

      // Broadcast leave
      broadcastToDesign(designId, "presence:leave", { userId }, sessionKey);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx: disable buffering for SSE
    },
  });
}
