import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { recordAiMemory, loadUserContext, renderContextForPrompt } from "@/lib/ai-memory";

const VISION_MODEL = process.env.FLOWCREATIVE_VISION_MODEL || "claude-haiku-4-5";
const VISION_MAX_BYTES = 4_800_000;

const primaryAnthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const backupAnthropic = process.env.ANTHROPIC_BACKUP_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY })
  : null;

interface AnalysisShape {
  description: string;
  subject: string;
  mood: string;
  dominantColors: string[];
  textVisible: string | null;
  brandFitNotes: string | null;
  suggestedUses: string[];
}

async function loadImageBuffer(mediaUrl: string): Promise<{ buffer: Buffer; mediaType: string }> {
  if (mediaUrl.startsWith("data:")) {
    const m = mediaUrl.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid data URI");
    return { buffer: Buffer.from(m[2], "base64"), mediaType: m[1] };
  }
  if (!/^https?:\/\//.test(mediaUrl)) throw new Error("URL must be http(s) or data:");
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!mediaType.startsWith("image/")) throw new Error(`Not an image: ${mediaType}`);
  return { buffer, mediaType };
}

async function shrinkForVision(
  buffer: Buffer,
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  let working = buffer;
  if (working.length > VISION_MAX_BYTES) {
    working = await sharp(buffer)
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } else {
    working = await sharp(buffer)
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  }
  return { base64: working.toString("base64"), mediaType: "image/jpeg" };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      mediaUrl?: string;
      base64?: string;
      mimeType?: string;
      userNote?: string;
    };

    let imageBuffer: Buffer;
    if (body.base64) {
      imageBuffer = Buffer.from(body.base64, "base64");
    } else if (body.mediaUrl) {
      const loaded = await loadImageBuffer(body.mediaUrl);
      imageBuffer = loaded.buffer;
    } else {
      return NextResponse.json(
        { success: false, error: { message: "Provide mediaUrl or base64" } },
        { status: 400 },
      );
    }

    if (!primaryAnthropic && !backupAnthropic) {
      return NextResponse.json(
        { success: false, error: { message: "Vision provider not configured" } },
        { status: 503 },
      );
    }

    // Credit gate BEFORE the AI call — vision is paid.
    const costKey = "AI_CAPTION"; // cheap-tier cost, vision analysis ≈ caption
    const creditCost = await getDynamicCreditCost(costKey);
    const balance = await creditService.getBalance(session.userId);
    if (balance < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Not enough credits — this analysis needs ${creditCost} credits, you have ${balance}.`,
            required: creditCost,
            balance,
          },
        },
        { status: 402 },
      );
    }

    const shrunk = await shrinkForVision(imageBuffer);

    // Pull user brand context so the analysis is brand-aware.
    const ctx = await loadUserContext(session.userId, { recentLimit: 4 });
    const brandPrelude = renderContextForPrompt(ctx);

    const userNote = (body.userNote || "").slice(0, 400).trim();
    const prompt = `Analyze this image for a social media / marketing context. Return STRICT JSON only — no preamble, no markdown fences, no commentary outside the JSON.

JSON shape:
{
  "description": "1-2 sentence factual description of what is visible",
  "subject": "the main subject in 2-5 words",
  "mood": "the emotional tone in 1-3 words (e.g. 'warm and reflective', 'energetic')",
  "dominantColors": ["plain English color names — e.g. 'navy blue', 'warm gold'"],
  "textVisible": "any text rendered in the image, or null if none",
  "brandFitNotes": "1 sentence on how well this image fits the user's brand context — or null if no brand context",
  "suggestedUses": ["2-4 short suggestions for how to use this image"]
}

${brandPrelude ? `${brandPrelude}\n\n` : ""}${userNote ? `User's note: ${userNote}\n\n` : ""}Analyze and return the JSON.`;

    const clients = [primaryAnthropic, backupAnthropic].filter(Boolean) as Anthropic[];
    let analysis: AnalysisShape | null = null;
    let lastError: unknown = null;
    for (const client of clients) {
      try {
        const response = await client.messages.create({
          model: VISION_MODEL as Parameters<typeof client.messages.create>[0]["model"],
          max_tokens: 1000,
          system:
            "You are a brand-aware visual analyst. Return strict JSON only — no markdown, no preamble, no trailing commentary.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: shrunk.mediaType, data: shrunk.base64 },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        });
        const text = response.content
          .map((c) => (c.type === "text" ? c.text : ""))
          .join("\n")
          .trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in response");
        analysis = JSON.parse(jsonMatch[0]) as AnalysisShape;
        if (analysis && analysis.description) break;
      } catch (err) {
        lastError = err;
        console.warn(
          "[flow-ai/analyze-media] vision call failed; trying next client:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (!analysis) {
      throw new Error(
        `Vision analysis failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      );
    }

    // Charge AFTER success.
    let balanceAfter: number | null = null;
    try {
      const deduction = await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditCost,
        description: "FlowAI media analysis",
        referenceType: "UserAiMemory",
        metadata: { feature: "flow-ai/analyze-media" },
      });
      balanceAfter = deduction.transaction?.balanceAfter ?? null;
    } catch (creditErr) {
      console.error("[flow-ai/analyze-media] credit deduction failed:", creditErr);
    }

    // Record into memory.
    recordAiMemory({
      userId: session.userId,
      kind: "media-analysis",
      summary: `${analysis.subject} — ${analysis.description.slice(0, 120)}`,
      content: { analysis, source: body.mediaUrl ? "url" : "upload", userNote },
      mediaUrl: body.mediaUrl ?? null,
      mediaType: "image",
    });

    // Suggest concrete next actions the UI can render as buttons.
    const nextActions = [
      { id: "use-in-post", label: "Use in a social post" },
      { id: "edit-image", label: "Edit / variation" },
      { id: "generate-caption", label: "Generate caption from this image" },
      { id: "save-only", label: "Save to memory only" },
    ];

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        nextActions,
        creditsCharged: creditCost,
        balanceAfter,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 },
    );
  }
}
