import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { geminiText } from "@/lib/ai/gemini-text-client";
import { buildAssistantPrompt, buildAssistantRuntimePrompt } from "@/lib/ai/assistant-prompt";
import { creditService } from "@/lib/credits";
import {
  getDynamicCreditCost,
  checkCreditsForFeature,
  type CreditCostKey,
} from "@/lib/credits/costs";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { veoClient } from "@/lib/ai/veo-client";
import { uploadToS3 } from "@/lib/utils/s3-client";

/**
 * /api/ai/assistant/generate — FlowAI multi-modal chat.
 *
 * Modes:
 *  - text:  streams Gemini deltas as SSE (same as before).
 *  - image: generates a single image via image-router. Tier selects provider
 *           preference (premium → OpenAI first, standard → xAI first). Falls
 *           back through the router's chain on provider failure.
 *  - video: generates a short clip. Tier selects provider preference
 *           (premium → Google Veo, standard → xAI Grok). Sends periodic SSE
 *           status frames while the upstream job renders.
 *
 * Provider names never leak to the client — the wire format uses tier
 * (premium | standard) on the request and just mediaType / mediaUrl on
 * the response. See feedback_media_provider_labels memory.
 */

type Mode = "text" | "image" | "video";
type Tier = "standard" | "premium";

function normalizeMode(value: unknown): Mode {
  return value === "image" || value === "video" ? value : "text";
}

function normalizeTier(value: unknown): Tier {
  return value === "premium" ? "premium" : "standard";
}

function costKeyFor(mode: Mode): CreditCostKey {
  if (mode === "image") return "AI_CHAT_IMAGE";
  if (mode === "video") return "AI_CHAT_VIDEO";
  return "AI_CHAT_MESSAGE";
}

function descriptionFor(mode: Mode): string {
  if (mode === "image") return "FlowAI image generation";
  if (mode === "video") return "FlowAI video generation";
  return "FlowAI chat message";
}

async function getOrCreateConversation(
  conversationId: string | null,
  userId: string,
): Promise<{ id: string; isNew: boolean }> {
  if (conversationId) {
    const conv = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conv) throw new Error("Conversation not found");
    return { id: conv.id, isNew: false };
  }
  const newConv = await prisma.aIConversation.create({ data: { userId } });
  return { id: newConv.id, isNew: true };
}

async function autoTitle(conversationId: string, message: string) {
  try {
    const title = await geminiText.generate(
      `Summarize this user message into a very short title (3-6 words max, no quotes, no punctuation at end): "${message}"`,
      { maxTokens: 30, temperature: 0.3 },
    );
    const cleanTitle = title.trim().replace(/^["']|["']$/g, "").slice(0, 60);
    if (cleanTitle) {
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { title: cleanTitle },
      });
    }
  } catch {
    /* non-critical */
  }
}

async function buildBrandAwarePrompt(userId: string, message: string): Promise<string> {
  const brandKit = await prisma.brandKit
    .findFirst({ where: { userId, isDefault: true } })
    .then((kit) => kit ?? prisma.brandKit.findFirst({ where: { userId } }));
  const brandLine = brandKit
    ? `Brand: ${brandKit.name}${brandKit.description ? ` — ${brandKit.description}` : ""}.`
    : "";
  return [
    message.trim(),
    brandLine,
    "Composition: clean, scroll-stopping, suitable as a social post. No text overlays unless explicitly requested.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 });
    }
    const mode = normalizeMode(body?.mode);
    const tier = normalizeTier(body?.tier);
    const reqConvId: string | null = body?.conversationId ?? null;

    const costKey = costKeyFor(mode);
    const cost = await getDynamicCreditCost(costKey);
    const creditCheck = await checkCreditsForFeature(session.userId, costKey, !!session.adminId);
    if (creditCheck) {
      return new Response(
        JSON.stringify({ error: creditCheck.message, code: creditCheck.code, required: cost }),
        { status: 402 },
      );
    }

    const { id: convId, isNew } = await getOrCreateConversation(reqConvId, session.userId);

    await prisma.aIMessage.create({
      data: { conversationId: convId, role: "user", content: message },
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        const finish = (extra: Record<string, unknown> = {}) => {
          send({ type: "done", tokensUsed: 0, creditsUsed: cost, ...extra });
          controller.close();
        };

        send({ type: "start", conversationId: convId, mode, tier });

        try {
          if (mode === "text") {
            const history = await prisma.aIMessage.findMany({
              where: { conversationId: convId },
              orderBy: { createdAt: "asc" },
              take: 20,
              select: { role: true, content: true },
            });
            const baseSystem = await buildAssistantPrompt(session.userId);
            const systemPrompt = buildAssistantRuntimePrompt(
              `${baseSystem}\n\nIMPORTANT — you are FlowAI. You CAN generate images and short videos for the user via the mode selector in the UI (Image and Video tabs). When replying in text mode, focus on writing, strategy, ideas and copy. If the user asks you to render an image or video in text mode, briefly tell them to switch to the Image or Video tab and you'll generate it.`,
              message,
            );
            const messages = history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

            let fullResponse = "";
            let tokenCount = 0;
            for await (const chunk of geminiText.streamConversation(messages, {
              systemPrompt,
              maxTokens: 2048,
              temperature: 0.7,
            })) {
              fullResponse += chunk;
              tokenCount += Math.ceil(chunk.length / 4);
              send({ type: "delta", text: chunk });
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
              description: descriptionFor(mode),
              referenceType: "ai_chat",
              referenceId: convId,
            });

            if (isNew) autoTitle(convId, message).catch(() => {});
            await prisma.aIConversation.update({
              where: { id: convId },
              data: { updatedAt: new Date() },
            });

            finish({
              tokensUsed: tokenCount,
              creditsRemaining: creditResult.transaction?.balanceAfter ?? null,
            });
            return;
          }

          if (mode === "image") {
            send({ type: "status", message: "Composing your image…" });
            const enrichedPrompt = await buildBrandAwarePrompt(session.userId, message);
            // Premium → OpenAI first (best quality), Standard → xAI first
            // (faster, cheaper). Router falls back through providers on
            // failure so we never strand the user on a single provider.
            const preferred = tier === "premium" ? "openai" : "xai";
            const result = await generateImageXaiFirst(enrichedPrompt, 1024, 1024, {
              quality: tier === "premium" ? "high" : "medium",
              preferredProvider: preferred,
            });
            if (!result.base64) throw new Error("Image generator returned no image");

            send({ type: "status", message: "Uploading…" });
            const buffer = Buffer.from(result.base64, "base64");
            const ext = result.format === "png" ? "png" : "jpg";
            const key = `flow-ai/${session.userId}/${convId}-${Date.now()}.${ext}`;
            const url = await uploadToS3(key, buffer, `image/${result.format}`);

            const assistantContent =
              tier === "premium"
                ? "Here's your Premium image — ready to use."
                : "Here's your Standard image — generated for speed.";

            await prisma.aIMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: assistantContent,
                mediaType: "image",
                mediaUrl: url,
              },
            });

            const creditResult = await creditService.deductCredits({
              userId: session.userId,
              amount: cost,
              type: "USAGE",
              description: descriptionFor(mode),
              referenceType: "ai_chat",
              referenceId: convId,
            });

            if (isNew) autoTitle(convId, message).catch(() => {});
            await prisma.aIConversation.update({
              where: { id: convId },
              data: { updatedAt: new Date() },
            });

            send({
              type: "media",
              mediaType: "image",
              mediaUrl: url,
              content: assistantContent,
            });
            finish({
              creditsRemaining: creditResult.transaction?.balanceAfter ?? null,
              mediaType: "image",
              mediaUrl: url,
            });
            return;
          }

          // mode === "video"
          send({ type: "status", message: "Starting video render…" });

          // Premium → Google Veo (longer, native audio). Standard → xAI Grok
          // (faster, cheaper). If the preferred provider isn't configured we
          // fall back to the other so the user never sees a config error.
          const tryVeo = tier === "premium" && veoClient.isAvailable();
          const tryGrok = !tryVeo && grokVideoClient.isAvailable();
          if (!tryVeo && !tryGrok) {
            throw new Error("Video generation is not configured");
          }

          let videoBuffer: Buffer;
          let videoContentType = "video/mp4";
          if (tryVeo) {
            const veoResult = await veoClient.generateVideoBuffer(message, {
              durationSeconds: "8",
              resolution: "720p",
              aspectRatio: "16:9",
            });
            videoBuffer = veoResult.videoBuffer;
          } else {
            const grokResult = await grokVideoClient.generateVideo(message, {
              duration: 8,
              aspectRatio: "16:9",
              resolution: "720p",
              onStatus: (m) => send({ type: "status", message: m }),
            });
            videoBuffer = grokResult.videoBuffer;
          }

          send({ type: "status", message: "Uploading…" });
          const key = `flow-ai/${session.userId}/${convId}-${Date.now()}.mp4`;
          const url = await uploadToS3(key, videoBuffer, videoContentType);

          const assistantContent =
            tier === "premium"
              ? "Here's your Premium video clip."
              : "Here's your Standard video clip.";

          await prisma.aIMessage.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: assistantContent,
              mediaType: "video",
              mediaUrl: url,
            },
          });

          const creditResult = await creditService.deductCredits({
            userId: session.userId,
            amount: cost,
            type: "USAGE",
            description: descriptionFor(mode),
            referenceType: "ai_chat",
            referenceId: convId,
          });

          if (isNew) autoTitle(convId, message).catch(() => {});
          await prisma.aIConversation.update({
            where: { id: convId },
            data: { updatedAt: new Date() },
          });

          send({
            type: "media",
            mediaType: "video",
            mediaUrl: url,
            content: assistantContent,
          });
          finish({
            creditsRemaining: creditResult.transaction?.balanceAfter ?? null,
            mediaType: "video",
            mediaUrl: url,
          });
        } catch (error) {
          console.error("[FlowAI generate] stream error:", error);
          const msg = error instanceof Error ? error.message : "Failed to generate response";
          send({ type: "error", message: msg });
          controller.close();
        }
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
    console.error("[FlowAI generate] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
