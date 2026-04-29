import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runChatTurn, type ChatState, type ChatTurn, type CardSpec } from "@/lib/ai/studio-chat-agent";
import { dispatchAll } from "@/lib/ai/studio-chat-dispatcher";

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

    // Hydrate the user's BrandKit on every turn so the agent always
    // knows brand context (name, voice tone, colors). Without this the
    // agent asks "what's your church/ministry name?" even when a kit is
    // on file (user-reported bug). The kit is treated as READ-ONLY
    // context — re-loaded each turn so it stays fresh if the user
    // edits their kit between turns. Failure is non-fatal — agent just
    // doesn't get brand context.
    try {
      const kit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: {
          name: true,
          tagline: true,
          description: true,
          industry: true,
          niche: true,
          voiceTone: true,
          colors: true,
          email: true,
          phone: true,
          website: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          targetAudience: true,
          handles: true,
        },
      });
      if (kit) {
        let colors: { primary?: string; secondary?: string; accent?: string } = {};
        try {
          const parsed = JSON.parse(kit.colors || "{}");
          if (parsed && typeof parsed === "object") {
            colors = {
              primary: typeof parsed.primary === "string" ? parsed.primary : undefined,
              secondary: typeof parsed.secondary === "string" ? parsed.secondary : undefined,
              accent: typeof parsed.accent === "string" ? parsed.accent : undefined,
            };
          }
        } catch { /* ignore */ }
        let handles: Record<string, string> = {};
        try {
          const parsed = JSON.parse(kit.handles || "{}");
          if (parsed && typeof parsed === "object") {
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string" && v.trim()) handles[k] = v.trim();
            }
          }
        } catch { /* ignore */ }
        state = {
          ...state,
          brandKit: {
            name: kit.name || undefined,
            tagline: kit.tagline || undefined,
            description: kit.description || undefined,
            industry: kit.industry || undefined,
            niche: kit.niche || undefined,
            voiceTone: kit.voiceTone || undefined,
            email: kit.email || undefined,
            phone: kit.phone || undefined,
            website: kit.website || undefined,
            address: kit.address || undefined,
            city: kit.city || undefined,
            state: kit.state || undefined,
            zip: kit.zip || undefined,
            country: kit.country || undefined,
            targetAudience: kit.targetAudience || undefined,
            handles: Object.keys(handles).length ? handles : undefined,
            ...colors,
          },
        };
      }
    } catch { /* ignore — non-fatal */ }

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

    // Merge any attachments from this user turn into state.references
    // (deduped by URL). Without this, the agent sees the user message
    // text but state.references stays empty and the agent re-asks for
    // a reference on every subsequent turn. Bug-fix from prod report:
    // "it keep asking for media over and over after user select one
    // from the library preview".
    if (body.attachments?.length) {
      const existing = Array.isArray(newState.references) ? newState.references : [];
      const existingUrls = new Set(existing.map((r) => r.url));
      const fresh = body.attachments
        .filter((a) => !existingUrls.has(a.url))
        .map((a) => ({ kind: a.kind, url: a.url, templateId: a.templateId }));
      if (fresh.length > 0) {
        newState.references = [...existing, ...fresh];
      }
    }

    // Phase 1.5 — fire dispatched workers (image / video / remix) in
    // parallel. Each envelope is mutated in place with the result.
    // Forward the user's session cookie so the worker authenticates as
    // the same user that owns this chat.
    if (result.dispatched.length > 0) {
      // Internal worker fetches MUST go to the local Node port, not the
      // public HTTPS origin. Using req.nextUrl.origin (https://flowsmartly.com)
      // hairpins through nginx and trips a "wrong version number" SSL
      // error on the Node fetch — even though the URL is technically
      // valid. Calling localhost:PORT skips the loop and lets us
      // forward the user's session cookie cleanly.
      const port = process.env.PORT || "3000";
      const origin = `http://127.0.0.1:${port}`;
      const cookieHeader = req.headers.get("cookie");
      await dispatchAll(result.dispatched, { cookieHeader, chatId, origin });
      // Attach result cards inline so the frontend renders them
      // immediately without a second round-trip. Also stash the most
      // recent successful image URL into chat state so future "remix
      // this" turns can pick it up via state.lastResultImageUrl.
      for (const env of result.dispatched) {
        if (env.status === "complete") {
          if (env.kind === "design" || env.kind === "remix") {
            if (env.imageUrl) {
              newState.lastResultImageUrl = env.imageUrl;
              newState.lastResultDesignId = env.designId;
              newState.lastResultBranchId = env.kind === "design" ? env.args.branchId : env.args.fromBranchId;
              result.cards.push({
                type: "result",
                designId: env.designId ?? "",
                imageUrl: env.imageUrl,
                width: env.width ?? 1080,
                height: env.height ?? 1080,
                branchId: (env.kind === "design" ? env.args.branchId : env.args.fromBranchId) || newState.currentBranchId || "main",
                mode: env.kind === "design" ? env.args.mode : undefined,
              });
            }
          }
        } else if (env.status === "failed") {
          // Surface the failure inline as an info card + bake into the
          // agent text so the user knows what happened. Without this,
          // failed dispatches silently disappear and the user thinks
          // the chat is frozen.
          const label = env.kind === "design" ? "Design generation" : env.kind === "video" ? "Video generation" : "Remix";
          result.cards.push({
            type: "info",
            title: `${label} failed`,
            body: env.error || "Worker returned an error. Try again or simplify the request.",
          });
        }
      }
    }

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
