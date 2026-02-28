import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { extractAudioFromVideo } from "@/lib/video-editor/audio-detach";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    const result = await extractAudioFromVideo(videoUrl);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("[video-editor/extract-audio] Error:", error);

    const message = error instanceof Error ? error.message : "Audio extraction failed";

    // Not an error if video has no audio stream
    if (message.includes("no audio stream")) {
      return NextResponse.json({
        success: true,
        data: { audioUrl: null, audioDuration: 0 },
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
