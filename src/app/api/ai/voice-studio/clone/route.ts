import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { isElevenLabsEnabled, cloneVoice } from "@/lib/voice/elevenlabs-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3",
  "audio/webm", "audio/ogg", "audio/mp4",
];

/**
 * GET /api/ai/voice-studio/clone — Check if voice cloning is available
 *
 * Returns whether the ElevenLabs integration is configured and ready.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: { available: isElevenLabsEnabled() },
    });
  } catch (error) {
    console.error("[VoiceStudio] Clone availability check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check availability" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/voice-studio/clone — Clone a voice from an audio sample
 *
 * Accepts multipart form data with:
 *   - name: string (1-100 chars) — name for the cloned voice
 *   - file: File (audio/mpeg or audio/wav, max 25 MB) — voice sample
 *
 * Uploads the sample to S3, sends it to ElevenLabs for cloning,
 * and creates a VoiceProfile record.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if ElevenLabs is configured
    if (!isElevenLabsEnabled()) {
      return NextResponse.json(
        { error: "Voice cloning is not available. ElevenLabs is not configured." },
        { status: 503 }
      );
    }

    // Get credit cost
    const creditCost = await getDynamicCreditCost("AI_VOICE_CLONE");

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

    // Parse multipart form data
    const formData = await req.formData();
    const name = formData.get("name") as string | null;
    const file = formData.get("file") as File | null;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
      return NextResponse.json(
        { error: "Voice name must be between 1 and 100 characters" },
        { status: 400 }
      );
    }

    // Validate file
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const baseType = file.type.split(";")[0].trim();
    if (!ALLOWED_AUDIO_TYPES.includes(baseType)) {
      return NextResponse.json(
        { error: "File must be an audio file (MP3, WAV, WebM, or OGG)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be under 25 MB" },
        { status: 400 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload sample to S3
    const extMap: Record<string, string> = {
      "audio/mpeg": "mp3", "audio/mp3": "mp3",
      "audio/wav": "wav", "audio/x-wav": "wav",
      "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
    };
    const fileExt = extMap[baseType] || "mp3";
    const s3Key = `voice-clones/${session.userId}/${nanoid(8)}.${fileExt}`;
    const sampleUrl = await uploadToS3(s3Key, buffer, file.type);

    // Clone voice via ElevenLabs
    const result = await cloneVoice({
      name: name.trim(),
      description: `Cloned voice for ${name.trim()}`,
      audioBuffers: [{ buffer, filename: file.name || `sample.${fileExt}` }],
    });

    // Create VoiceProfile record
    const profile = await prisma.voiceProfile.create({
      data: {
        userId: session.userId,
        type: "cloned",
        name: name.trim(),
        elevenLabsVoiceId: result.voiceId,
        sampleUrl,
      },
    });

    // Deduct credits
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          amount: -creditCost,
          type: "USAGE",
          balanceAfter: (user?.aiCredits || 0) - creditCost,
          description: "AI voice cloning",
          referenceType: "ai_voice_clone",
          referenceId: profile.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        creditsRemaining: (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[VoiceStudio] Voice cloning error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice cloning failed" },
      { status: 500 }
    );
  }
}
