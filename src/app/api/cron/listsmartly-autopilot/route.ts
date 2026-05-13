import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  prepareAutopilotQueue,
  processAutopilotTask,
  runNextAutopilotStep,
} from "@/lib/listsmartly/autopilot-agent";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  return provided === expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
      { status: 401 }
    );
  }

  try {
    const profiles = await prisma.listSmartlyProfile.findMany({
      where: {
        listSmartlyAutopilotEnabled: true,
        listSmartlyCreditStatus: "active",
      },
      select: { id: true, userId: true },
      take: 50,
    });

    let prepared = 0;
    let started = 0;
    let processed = 0;

    for (const profile of profiles) {
      const queue = await prepareAutopilotQueue(profile.userId);
      prepared += queue.created;

      const activeResult = await processAutopilotTask(profile.userId);
      if (activeResult.task) processed++;

      const activeTaskCount = await prisma.listSmartlyAutopilotTask.count({
        where: {
          profileId: profile.id,
          status: { in: ["needs_user", "in_progress"] },
        },
      });

      if (activeTaskCount === 0) {
        const next = await runNextAutopilotStep(profile.userId);
        if (next.task) {
          started++;
          if (next.status === "started" && next.task.id) {
            await processAutopilotTask(profile.userId, next.task.id);
            processed++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        profiles: profiles.length,
        prepared,
        processed,
        started,
      },
    });
  } catch (error) {
    console.error("ListSmartly autopilot cron error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to run ListSmartly autopilot" } },
      { status: 500 }
    );
  }
}
