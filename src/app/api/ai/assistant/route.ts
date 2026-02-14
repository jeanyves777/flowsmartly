import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { buildAssistantPrompt } from "@/lib/ai/assistant-prompt";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const { conversationId, message } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
      });
    }

    // Check credits
    const cost = await getDynamicCreditCost("AI_CHAT_MESSAGE");
    if (session.user.aiCredits < cost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: cost }),
        { status: 402 }
      );
    }

    // Get or create conversation
    let convId = conversationId;
    let isNewConversation = false;

    if (convId) {
      // Verify ownership
      const conv = await prisma.aIConversation.findFirst({
        where: { id: convId, userId: session.userId },
      });
      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404 }
        );
      }
    } else {
      // Create new conversation
      const newConv = await prisma.aIConversation.create({
        data: { userId: session.userId },
      });
      convId = newConv.id;
      isNewConversation = true;
    }

    // Save the user message
    await prisma.aIMessage.create({
      data: {
        conversationId: convId,
        role: "user",
        content: message.trim(),
      },
    });

    // Load conversation history (last 20 messages for context)
    const history = await prisma.aIMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    // Build system prompt with brand context
    const systemPrompt = await buildAssistantPrompt(session.userId);

    // Build messages array for Claude
    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send conversation ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "start", conversationId: convId })}\n\n`
          )
        );

        let fullResponse = "";
        let tokenCount = 0;

        try {
          for await (const chunk of ai.streamConversation(messages, {
            systemPrompt,
            maxTokens: 2048,
            temperature: 0.7,
          })) {
            fullResponse += chunk;
            tokenCount += Math.ceil(chunk.length / 4);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`
              )
            );
          }

          // Save assistant message
          await prisma.aIMessage.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: fullResponse,
              tokensUsed: tokenCount,
            },
          });

          // Deduct credits
          const result = await creditService.deductCredits({
            userId: session.userId,
            amount: cost,
            type: "USAGE",
            description: "FlowAI chat message",
            referenceType: "ai_chat",
            referenceId: convId,
          });

          // Auto-generate title for new conversations
          if (isNewConversation) {
            generateTitle(convId, message.trim()).catch(() => {});
          }

          // Update conversation timestamp
          await prisma.aIConversation.update({
            where: { id: convId },
            data: { updatedAt: new Date() },
          });

          // Send done event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                tokensUsed: tokenCount,
                creditsUsed: cost,
                creditsRemaining: result.transaction?.balanceAfter ?? null,
              })}\n\n`
            )
          );
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "Failed to generate response" })}\n\n`
            )
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Assistant API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}

/**
 * Auto-generate a short title from the first user message
 */
async function generateTitle(conversationId: string, firstMessage: string) {
  try {
    const title = await ai.generate(
      `Summarize this user message into a very short title (3-6 words max, no quotes, no punctuation at end): "${firstMessage}"`,
      { maxTokens: 30, temperature: 0.3 }
    );
    const cleanTitle = title.trim().replace(/^["']|["']$/g, "").slice(0, 60);
    if (cleanTitle) {
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { title: cleanTitle },
      });
    }
  } catch {
    // Non-critical, ignore
  }
}
