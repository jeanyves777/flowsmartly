import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  isOpenAIVoiceCloningEnabled,
  createVoiceConsent,
  createClonedVoice,
} from "@/lib/voice/openai-voice-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3",
  "audio/webm", "audio/ogg", "audio/mp4", "audio/flac", "audio/aac",
];

/**
 * GET /api/ai/voice-studio/clone — Check if voice cloning is available
 *
 * Returns whether OpenAI voice cloning is configured and ready.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: { available: isOpenAIVoiceCloningEnabled() },
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
 * POST /api/ai/voice-studio/clone — Clone a voice via OpenAI Custom Voices
 *
 * Two-step process requiring:
 *   - consentRecording: File — the voice actor reading the consent phrase
 *   - file: File (max 25 MB, ≤30s) — the voice sample
 *   - name: string (1-100 chars) — name for the cloned voice
 *
 * Creates a consent record, then creates the custom voice, and stores
 * the openaiVoiceId + openaiConsentId in the VoiceProfile.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OpenAI voice cloning is configured
    if (!isOpenAIVoiceCloningEnabled()) {
      return NextResponse.json(
        { error: "Voice cloning is not available. OpenAI API key is not configured." },
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
    const consentRecording = formData.get("consentRecording") as File | null;
    const file = formData.get("file") as File | null;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
      return NextResponse.json(
        { error: "Voice name must be between 1 and 100 characters" },
        { status: 400 }
      );
    }

    // Validate consent recording
    if (!consentRecording || !(consentRecording instanceof File)) {
      return NextResponse.json(
        { error: "Consent recording is required. Please record yourself reading the consent phrase." },
        { status: 400 }
      );
    }

    const consentType = consentRecording.type.split(";")[0].trim();
    if (!ALLOWED_AUDIO_TYPES.includes(consentType)) {
      return NextResponse.json(
        { error: "Consent recording must be an audio file (MP3, WAV, WebM, OGG, AAC, or FLAC)" },
        { status: 400 }
      );
    }

    // Validate voice sample file
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Voice sample audio file is required" },
        { status: 400 }
      );
    }

    const baseType = file.type.split(";")[0].trim();
    if (!ALLOWED_AUDIO_TYPES.includes(baseType)) {
      return NextResponse.json(
        { error: "File must be an audio file (MP3, WAV, WebM, OGG, AAC, or FLAC)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be under 25 MB" },
        { status: 400 }
      );
    }

    // Read both files into buffers
    const consentBuffer = Buffer.from(await consentRecording.arrayBuffer());
    const sampleBuffer = Buffer.from(await file.arrayBuffer());

    // Upload sample to S3 for storage
    const extMap: Record<string, string> = {
      "audio/mpeg": "mp3", "audio/mp3": "mp3",
      "audio/wav": "wav", "audio/x-wav": "wav",
      "audio/webm": "webm", "audio/ogg": "ogg",
      "audio/mp4": "mp4", "audio/flac": "flac", "audio/aac": "aac",
    };
    const fileExt = extMap[baseType] || "mp3";
    const s3Key = `voice-clones/${session.userId}/${nanoid(8)}.${fileExt}`;
    const sampleUrl = await uploadToS3(s3Key, sampleBuffer, file.type);

    // Step 1: Create voice consent via OpenAI
    const { consentId } = await createVoiceConsent({
      name: name.trim(),
      language: "en",
      recording: consentBuffer,
      mimeType: consentType,
    });

    // Step 2: Create custom voice via OpenAI
    const { voiceId } = await createClonedVoice({
      name: name.trim(),
      audioSample: sampleBuffer,
      consentId,
      mimeType: baseType,
    });

    // Create VoiceProfile record
    const profile = await prisma.voiceProfile.create({
      data: {
        userId: session.userId,
        type: "cloned",
        name: name.trim(),
        openaiVoiceId: voiceId,
        openaiConsentId: consentId,
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
