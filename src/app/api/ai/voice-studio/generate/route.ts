import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateVoice } from "@/lib/voice/voice-engine";
import { generateWithClonedVoice } from "@/lib/voice/elevenlabs-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";

/**
 * POST /api/ai/voice-studio/generate — Generate TTS audio
 *
 * Generates voice audio from a script using either a standard voice or a cloned voice.
 * Returns a direct JSON response (TTS is fast, 2-5 seconds).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      script,
      gender,
      accent,
      style,
      speed = 1.0,
      voiceProfileId,
      useClonedVoice = false,
    } = body;

    // Validate script
    if (!script || typeof script !== "string" || script.length < 1 || script.length > 5000) {
      return NextResponse.json(
        { error: "Script must be between 1 and 5000 characters" },
        { status: 400 }
      );
    }

    // Get credit cost
    const creditCost = await getDynamicCreditCost("AI_VOICE_GENERATION");

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: creditCost,
          available: user?.aiCredits || 0,
        },
        { status: 402 }
      );
    }

    // Generate audio
    let buffer: Buffer;
    let durationMs: number;
    let openaiVoice: string | undefined;
    let isClonedVoice = false;

    if (useClonedVoice && voiceProfileId) {
      // Load voice profile and use cloned voice
      const profile = await prisma.voiceProfile.findFirst({
        where: { id: voiceProfileId, userId: session.userId },
      });

      if (!profile || !profile.elevenLabsVoiceId) {
        return NextResponse.json(
          { error: "Voice profile not found or missing cloned voice ID" },
          { status: 404 }
        );
      }

      buffer = await generateWithClonedVoice({
        text: script,
        voiceId: profile.elevenLabsVoiceId,
      });
      // Estimate duration from word count (~150 words/min)
      const wordCount = script.split(/\s+/).filter(Boolean).length;
      durationMs = Math.round(((wordCount / 150) * 60 * 1000) / speed);
      isClonedVoice = true;
    } else {
      // Use standard voice engine
      const result = await generateVoice({
        text: script,
        gender,
        accent,
        style,
        speed,
      });
      buffer = result.audioBuffer;
      durationMs = result.estimatedDurationMs;
    }

    // Upload to S3
    const s3Key = `ai-voice-studio/${session.userId}/${nanoid(8)}.mp3`;
    const audioUrl = await uploadToS3(s3Key, buffer, "audio/mpeg");

    // Create VoiceGeneration record
    const generation = await prisma.voiceGeneration.create({
      data: {
        userId: session.userId,
        status: "COMPLETED",
        audioUrl,
        durationMs,
        fileSizeBytes: buffer.length,
        script,
        gender: gender || null,
        accent: accent || null,
        style: style || null,
        openaiVoice: openaiVoice || null,
        speed,
        isClonedVoice,
        voiceProfileId: voiceProfileId || null,
        scriptSource: "manual",
      },
    });

    // Create MediaFile record
    await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: `voice-${nanoid(6)}.mp3`,
        originalName: `voice-${nanoid(6)}.mp3`,
        url: audioUrl,
        mimeType: "audio/mpeg",
        type: "audio",
        size: buffer.length,
      },
    });

    // Deduct credits
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      });

      // Create CreditTransaction
      await prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          amount: -creditCost,
          type: "USAGE",
          balanceAfter: (user?.aiCredits || 0) - creditCost,
          description: "AI voice generation",
          referenceType: "ai_voice_studio",
          referenceId: generation.id,
        },
      });
    }

    // Update voice profile lastUsedAt if provided
    if (voiceProfileId) {
      await prisma.voiceProfile.update({
        where: { id: voiceProfileId },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: {
        generationId: generation.id,
        audioUrl,
        durationMs,
        creditsUsed: creditCost,
        creditsRemaining: (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[VoiceStudio] Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice generation failed" },
      { status: 500 }
    );
  }
}
