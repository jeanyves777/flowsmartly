import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { checkCreditsAvailable, getDynamicCreditCost } from "@/lib/credits/costs";
import { generateMusicClip, isLyriaEnabled } from "@/lib/ai/lyria-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { getFilm } from "@/lib/video-director/store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;
    const film = await getFilm(id, session.userId);
    if (!film) return NextResponse.json({ success: false, error: { message: "Film not found" } }, { status: 404 });

    const body = await request.json().catch(() => null) as { prompt?: string } | null;
    const prompt = body?.prompt?.trim() || "";
    if (prompt.length < 3 || prompt.length > 1000) {
      return NextResponse.json({ success: false, error: { message: "Music prompt must be between 3 and 1000 characters." } }, { status: 400 });
    }
    if (!isLyriaEnabled()) {
      return NextResponse.json({ success: false, error: { message: "Music generation is not configured." } }, { status: 503 });
    }

    const creditCost = await getDynamicCreditCost("AI_STORY_CAMPAIGN_MUSIC_CLIP");
    const isAdmin = !!session.adminId;
    const blocked = await checkCreditsAvailable(session.userId, creditCost, false, isAdmin);
    if (blocked) return NextResponse.json({ success: false, error: { message: blocked.message, code: blocked.code }, creditCost }, { status: 402 });

    const result = await generateMusicClip({ prompt, model: "clip" });
    const extension = result.mimeType.includes("wav") ? "wav" : "mp3";
    const key = `director/${film.id}/composer-music-${nanoid(8)}.${extension}`;
    const url = await uploadToS3(key, result.audioBuffer, result.mimeType);

    await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: `film-music-${nanoid(6)}.${extension}`,
        originalName: `${film.title || "film"}-music.${extension}`,
        url,
        mimeType: result.mimeType,
        type: "audio",
        size: result.audioBuffer.length,
      },
    }).catch((error) => console.warn("[DirectorComposer] Could not add generated music to media library:", error));

    if (!isAdmin && creditCost > 0) {
      const charged = await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditCost,
        description: "Video Studio composer music generation",
        referenceType: "video_director_music",
        referenceId: film.id,
        metadata: { key, model: result.modelUsed },
      });
      if (!charged.success) throw new Error(charged.error || "Could not charge music generation credits");
    }

    return NextResponse.json({ success: true, data: { url, durationSec: 30, creditCost, model: result.modelUsed } });
  } catch (error) {
    console.error("[DirectorComposer] Music generation failed:", error);
    return NextResponse.json({ success: false, error: { message: error instanceof Error ? error.message : "Music generation failed" } }, { status: 500 });
  }
}
