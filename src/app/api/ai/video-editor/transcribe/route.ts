import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  transcribeAudioForCaptions,
  segmentWords,
} from "@/lib/video-editor/caption-sync";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: "audioUrl is required" },
        { status: 400 }
      );
    }

    // Check and deduct credits
    const creditCost = await getDynamicCreditCost("AI_CAPTION");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!user || user.aiCredits < creditCost) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
          required: creditCost,
          available: user?.aiCredits || 0,
        },
        { status: 402 }
      );
    }

    // Download audio
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return NextResponse.json(
        { error: "Failed to download audio" },
        { status: 400 }
      );
    }

    const contentType = audioRes.headers.get("content-type") || "audio/mp3";
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // Transcribe with Whisper
    const words = await transcribeAudioForCaptions(audioBuffer, contentType);
    const segments = segmentWords(words);

    // Deduct credits
    await prisma.user.update({
      where: { id: session.userId },
      data: { aiCredits: { decrement: creditCost } },
    });

    return NextResponse.json({
      success: true,
      data: {
        words,
        segments,
        wordCount: words.length,
      },
    });
  } catch (error: unknown) {
    console.error("[video-editor/transcribe] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}
