import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { exportVideoProject } from "@/lib/video-editor/export-pipeline";
import type {
  TimelineClip,
  TimelineTrack,
  ExportSettings,
} from "@/lib/video-editor/types";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const {
      tracks,
      clips,
      settings,
      projectName,
    } = body as {
      tracks: TimelineTrack[];
      clips: Record<string, TimelineClip>;
      settings: ExportSettings;
      projectName: string;
    };

    if (!tracks?.length || !Object.keys(clips || {}).length) {
      return new Response(
        JSON.stringify({ error: "Nothing to export" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check and deduct credits
    const creditCost = await getDynamicCreditCost("AI_VIDEO_STUDIO");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!user || user.aiCredits < creditCost) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
          required: creditCost,
          available: user?.aiCredits || 0,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { aiCredits: { decrement: creditCost } },
    });

    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const result = await exportVideoProject(
            { tracks, clips, settings, projectName: projectName || "Untitled" },
            (status, progress) => {
              send({ status, progress });
            }
          );

          send({
            status: "complete",
            progress: 100,
            url: result.videoUrl,
            duration: result.durationSeconds,
            fileSize: result.fileSizeBytes,
          });
        } catch (err: unknown) {
          send({
            status: "error",
            error: err instanceof Error ? err.message : "Export failed",
          });
        } finally {
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
  } catch (error: unknown) {
    console.error("[video-editor/export] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Export failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
