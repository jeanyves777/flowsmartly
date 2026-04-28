import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { buildAssistantPrompt } from "@/lib/ai/assistant-prompt";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";

/**
 * /api/ai/assistant/generate — FlowAI text chat (Phase 2A redesign).
 *
 * STRIPPED of image/video generation paths. Visual creation moved to
 * Studio AI (/studio/create) — FlowAI is now a text-only writing /
 * thinking partner. The previous mode-detection + Sora + xAI/OpenAI
 * image branches and SSE-status video branch have been deleted; if the
 * user asks for an image FlowAI will recommend Studio AI in plain text.
 *
 * Streaming: SSE token-by-token for instant feel. The frontend (FlowAI
 * shell) consumes deltas as they arrive.
 *
 * Performance: uses Sonnet 4.6 (no adaptive thinking) for speed —
 * matches the studio chat agent perf profile from commit c9d51fd.
 * Final FlowAI page response should feel near-instant after first byte.
 */

async function getOrCreateConversation(
  conversationId: string | null,
  userId: string
): Promise<{ id: string; isNew: boolean }> {
  if (conversationId) {
    const conv = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conv) throw new Error("Conversation not found");
    return { id: conv.id, isNew: false };
  }
  const newConv = await prisma.aIConversation.create({
    data: { userId },
  });
  return { id: newConv.id, isNew: true };
}

async function autoTitle(conversationId: string, message: string) {
  try {
    const title = await ai.generate(
      `Summarize this user message into a very short title (3-6 words max, no quotes, no punctuation at end): "${message}"`,
      { maxTokens: 30, temperature: 0.3, model: "claude-sonnet-4-6" }
    );
    const cleanTitle = title.trim().replace(/^["']|["']$/g, "").slice(0, 60);
    if (cleanTitle) {
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { title: cleanTitle },
      });
    }
  } catch { /* non-critical */ }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const { conversationId: reqConvId, message } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 });
    }

    // FlowAI is text-only now — credit + cost gating uses AI_CHAT_MESSAGE.
    const cost = await getDynamicCreditCost("AI_CHAT_MESSAGE");
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_CHAT_MESSAGE", !!session.adminId);
    if (creditCheck) {
      return new Response(
        JSON.stringify({ error: creditCheck.message, code: creditCheck.code, required: cost }),
        { status: 402 }
      );
    }

    const { id: convId, isNew } = await getOrCreateConversation(reqConvId || null, session.userId);

    // Save the user message immediately so it's durable even if the
    // stream errors out.
    await prisma.aIMessage.create({
      data: { conversationId: convId, role: "user", content: message.trim() },
    });

    // Pull recent history for context (last 20 turns).
    const history = await prisma.aIMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    // System prompt is per-user (brand voice, business context). The
    // builder also tells the model FlowAI is text-only and that visual
    // creation lives in Studio AI — so user requests like "generate
    // an image of …" get a referral instead of a hallucinated answer.
    const baseSystem = await buildAssistantPrompt(session.userId);
    const systemPrompt = `${baseSystem}\n\nIMPORTANT — you are FlowAI, the text/writing/thinking assistant. Image and video creation live in Studio AI (a separate tool at /studio/create). If the user asks for an image, video, flyer, poster, or any visual design, briefly recommend they use Studio AI for that — do NOT pretend you can generate visuals. You are a text-only collaborator: brainstorming, copywriting, strategy, planning, summarization, analysis.`;

    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "start", conversationId: convId })}\n\n`)
        );

        let fullResponse = "";
        let tokenCount = 0;

        try {
          // Sonnet 4.6 + temperature 0.7 — fast, conversational, plenty
          // smart for chat. Opus headroom isn't paying for itself in a
          // text-only assistant surface.
          for await (const chunk of ai.streamConversation(messages, {
            systemPrompt,
            model: "claude-sonnet-4-6",
            maxTokens: 2048,
            temperature: 0.7,
          })) {
            fullResponse += chunk;
            tokenCount += Math.ceil(chunk.length / 4);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`)
            );
          }

          await prisma.aIMessage.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: fullResponse,
              tokensUsed: tokenCount,
            },
          });

          const creditResult = await creditService.deductCredits({
            userId: session.userId,
            amount: cost,
            type: "USAGE",
            description: "FlowAI chat message",
            referenceType: "ai_chat",
            referenceId: convId,
          });

          if (isNew) autoTitle(convId, message.trim()).catch(() => {});
          await prisma.aIConversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                tokensUsed: tokenCount,
                creditsUsed: cost,
                creditsRemaining: creditResult.transaction?.balanceAfter ?? null,
              })}\n\n`
            )
          );
        } catch (error) {
          console.error("[FlowAI stream] error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Failed to generate response" })}\n\n`)
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    console.error("[FlowAI generate] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
