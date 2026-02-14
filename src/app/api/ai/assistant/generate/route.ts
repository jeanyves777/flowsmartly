import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { openaiClient } from "@/lib/ai/openai-client";
import { xaiClient } from "@/lib/ai/xai-client";
import { buildAssistantPrompt } from "@/lib/ai/assistant-prompt";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";

type GenerationMode = "auto" | "text" | "image" | "video";

const IMAGE_KEYWORDS = [
  "generate image", "create image", "make image", "draw", "create a picture",
  "make a picture", "generate a photo", "create a photo", "design a",
  "illustrate", "create an illustration", "generate art", "make a poster",
  "create a logo", "generate a banner", "make a flyer",
];

const VIDEO_KEYWORDS = [
  "generate video", "create video", "make video", "create a video",
  "generate a video", "make a clip", "animate", "create animation",
];

function detectMode(message: string): GenerationMode {
  const lower = message.toLowerCase();
  for (const kw of VIDEO_KEYWORDS) {
    if (lower.includes(kw)) return "video";
  }
  for (const kw of IMAGE_KEYWORDS) {
    if (lower.includes(kw)) return "image";
  }
  return "text";
}

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
      { maxTokens: 30, temperature: 0.3 }
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
    const { conversationId: reqConvId, message, mode: reqMode } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 });
    }

    const resolvedMode: GenerationMode =
      reqMode && reqMode !== "auto" ? reqMode : detectMode(message);

    // Determine credit cost
    const costKey =
      resolvedMode === "image"
        ? "AI_CHAT_IMAGE" as const
        : resolvedMode === "video"
          ? "AI_CHAT_VIDEO" as const
          : "AI_CHAT_MESSAGE" as const;

    const cost = await getDynamicCreditCost(costKey);
    if (session.user.aiCredits < cost) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: cost }),
        { status: 402 }
      );
    }

    const { id: convId, isNew } = await getOrCreateConversation(reqConvId || null, session.userId);

    // Save user message
    await prisma.aIMessage.create({
      data: { conversationId: convId, role: "user", content: message.trim() },
    });

    // ──────── IMAGE GENERATION ────────
    if (resolvedMode === "image") {
      try {
        // Use xAI Grok for fast, non-photorealistic images; fall back to OpenAI
        let base64: string | null = null;
        let imageFormat: { ext: string; mime: string } = { ext: "jpg", mime: "image/jpeg" };

        if (xaiClient.isAvailable()) {
          base64 = await xaiClient.generateImage(message.trim(), { aspectRatio: "1:1" });
        }

        if (!base64) {
          // Fallback to OpenAI gpt-image-1
          base64 = await openaiClient.generateImage(message.trim(), {
            size: "1024x1024",
            quality: "medium",
          });
          imageFormat = { ext: "png", mime: "image/png" };
        }

        if (!base64) throw new Error("Image generation returned no data");

        // Upload to S3
        const buffer = Buffer.from(base64, "base64");
        const s3Key = `ai-chat/${session.userId}/${nanoid(8)}.${imageFormat.ext}`;
        const mediaUrl = await uploadToS3(s3Key, buffer, imageFormat.mime);

        // Save assistant message with media
        const assistantMsg = await prisma.aIMessage.create({
          data: {
            conversationId: convId,
            role: "assistant",
            content: "Here's the image I generated for you:",
            mediaType: "image",
            mediaUrl,
          },
        });

        // Deduct credits
        const result = await creditService.deductCredits({
          userId: session.userId,
          amount: cost,
          type: "USAGE",
          description: "FlowAI image generation",
          referenceType: "ai_chat_image",
          referenceId: convId,
        });

        if (isNew) autoTitle(convId, message.trim()).catch(() => {});
        await prisma.aIConversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });

        return new Response(
          JSON.stringify({
            type: "media",
            mediaType: "image",
            mediaUrl,
            messageId: assistantMsg.id,
            conversationId: convId,
            creditsUsed: cost,
            creditsRemaining: result.transaction?.balanceAfter ?? null,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Image generation error:", error);
        // Save error message
        await prisma.aIMessage.create({
          data: {
            conversationId: convId,
            role: "assistant",
            content: "Sorry, I couldn't generate that image. Please try again with a different description.",
          },
        });
        return new Response(
          JSON.stringify({ error: "Image generation failed" }),
          { status: 500 }
        );
      }
    }

    // ──────── VIDEO GENERATION ────────
    if (resolvedMode === "video") {
      // Video generation is long-running. We'll use SSE to stream status updates.
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "start", conversationId: convId, mode: "video" })}\n\n`)
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Starting video generation..." })}\n\n`)
          );

          try {
            // Dynamically import sora client
            const { soraClient } = await import("@/lib/ai/sora-client");

            const os = await import("os");
            const tmpDir = os.tmpdir();
            const outputFilename = `flowai-${nanoid(8)}.mp4`;

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Generating video with Sora AI... This may take a few minutes." })}\n\n`)
            );

            const result = await soraClient.generateVideo(
              message.trim(),
              tmpDir,
              outputFilename,
              { model: "sora-2", seconds: "8", size: "1280x720" }
            );

            // Read file and upload to S3
            const fs = await import("fs");
            const videoBuffer = fs.readFileSync(result.localPath);
            const s3Key = `ai-chat/${session.userId}/${nanoid(8)}.mp4`;
            const mediaUrl = await uploadToS3(s3Key, videoBuffer, "video/mp4");

            // Clean up temp file
            fs.unlinkSync(result.localPath);

            // Save assistant message
            const assistantMsg = await prisma.aIMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: "Here's the video I generated for you:",
                mediaType: "video",
                mediaUrl,
              },
            });

            // Deduct credits
            const creditResult = await creditService.deductCredits({
              userId: session.userId,
              amount: cost,
              type: "USAGE",
              description: "FlowAI video generation",
              referenceType: "ai_chat_video",
              referenceId: convId,
            });

            if (isNew) autoTitle(convId, message.trim()).catch(() => {});
            await prisma.aIConversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "media",
                  mediaType: "video",
                  mediaUrl,
                  messageId: assistantMsg.id,
                  conversationId: convId,
                  creditsUsed: cost,
                  creditsRemaining: creditResult.transaction?.balanceAfter ?? null,
                })}\n\n`
              )
            );
          } catch (error) {
            console.error("Video generation error:", error);
            await prisma.aIMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: "Sorry, I couldn't generate that video. Please try again.",
              },
            });
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Video generation failed" })}\n\n`)
            );
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    // ──────── TEXT GENERATION (SSE streaming) ────────
    const history = await prisma.aIMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    const systemPrompt = await buildAssistantPrompt(session.userId);
    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "start", conversationId: convId, mode: "text" })}\n\n`)
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
          console.error("Stream error:", error);
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
    console.error("Generate API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
