import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  isOpenAIVoiceCloningEnabled,
  createVoiceConsent,
  createClonedVoice as createOpenAIVoice,
} from "@/lib/voice/openai-voice-client";
import {
  isElevenLabsEnabled,
  cloneVoice as cloneElevenLabsVoice,
} from "@/lib/voice/elevenlabs-client";
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
 * Returns whether voice cloning is configured and which provider is active.
 * Prefers ElevenLabs (self-service) over OpenAI (requires sales approval).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const elevenLabsAvailable = isElevenLabsEnabled();
    const openaiAvailable = isOpenAIVoiceCloningEnabled();
    const available = elevenLabsAvailable || openaiAvailable;

    return NextResponse.json({
      success: true,
      data: {
        available,
        provider: elevenLabsAvailable ? "elevenlabs" : openaiAvailable ? "openai" : null,
      },
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
 * POST /api/ai/voice-studio/clone — Clone a voice
 *
 * ElevenLabs (preferred): just name + file (voice sample). Simple one-step.
 * OpenAI (fallback): name + consentRecording + file (two-step consent flow).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const useElevenLabs = isElevenLabsEnabled();
    const useOpenAI = !useElevenLabs && isOpenAIVoiceCloningEnabled();

    if (!useElevenLabs && !useOpenAI) {
      return NextResponse.json(
        { error: "Voice cloning is not available. No API key configured." },
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

    // Read file into buffer
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

    let voiceId: string;
    let consentId: string | null = null;
    let provider: "elevenlabs" | "openai";

    if (useElevenLabs) {
      // ── ElevenLabs: Simple one-step clone ──
      provider = "elevenlabs";
      const result = await cloneElevenLabsVoice({
        name: name.trim(),
        description: `Cloned voice for ${name.trim()}`,
        audioBuffers: [{ buffer: sampleBuffer, filename: `sample.${fileExt}` }],
      });
      voiceId = result.voiceId;
    } else {
      // ── OpenAI: Two-step consent + clone ──
      provider = "openai";
      const consentRecording = formData.get("consentRecording") as File | null;

      if (!consentRecording || !(consentRecording instanceof File)) {
        return NextResponse.json(
          { error: "Consent recording is required for OpenAI voice cloning." },
          { status: 400 }
        );
      }

      const consentType = consentRecording.type.split(";")[0].trim();
      if (!ALLOWED_AUDIO_TYPES.includes(consentType)) {
        return NextResponse.json(
          { error: "Consent recording must be an audio file" },
          { status: 400 }
        );
      }

      const consentBuffer = Buffer.from(await consentRecording.arrayBuffer());

      // Step 1: Create voice consent
      const consentResult = await createVoiceConsent({
        name: name.trim(),
        language: "en",
        recording: consentBuffer,
        mimeType: consentType,
      });
      consentId = consentResult.consentId;

      // Step 2: Create custom voice
      const voiceResult = await createOpenAIVoice({
        name: name.trim(),
        audioSample: sampleBuffer,
        consentId: consentResult.consentId,
        mimeType: baseType,
      });
      voiceId = voiceResult.voiceId;
    }

    // Create VoiceProfile record
    const profile = await prisma.voiceProfile.create({
      data: {
        userId: session.userId,
        type: "cloned",
        name: name.trim(),
        elevenLabsVoiceId: provider === "elevenlabs" ? voiceId : null,
        openaiVoiceId: provider === "openai" ? voiceId : null,
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
          description: `AI voice cloning (${provider})`,
          referenceType: "ai_voice_clone",
          referenceId: profile.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        provider,
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
