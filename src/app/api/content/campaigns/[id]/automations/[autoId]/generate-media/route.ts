import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generateAutomationMedia } from "@/lib/content/automation-media-generator";

interface Params {
  params: Promise<{ id: string; autoId: string }>;
}

/**
 * Pre-generate media on demand from the campaign item editor. Thin wrapper
 * around the shared generateAutomationMedia helper — this route persists
 * the result on the automation row (mediaUrl + mediaMode=UPLOAD + config).
 * The same helper is also called by the scheduler at fire time for
 * mediaMode=AI_AT_POST_TIME automations (which do NOT persist on the row).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id: campaignId, autoId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    tier?: string;
    appliesTo?: string;
    style?: string;
    aspect?: string;
  };
  const tier: "premium" | "standard" =
    body.tier === "premium" ? "premium" : "standard";
  const style: "realistic" | "3d" = body.style === "3d" ? "3d" : "realistic";
  const aspect: "square" | "portrait" | "landscape" =
    body.aspect === "portrait" || body.aspect === "landscape"
      ? body.aspect
      : "square";
  const appliesTo =
    typeof body.appliesTo === "string" && /^(all|\d{4})$/.test(body.appliesTo)
      ? body.appliesTo
      : "all";

  // Ownership + lock-after-first-post check.
  const automation = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId, userId: session.userId },
    select: { id: true, firstPostCreatedAt: true, aiMediaConfig: true },
  });
  if (!automation) {
    return NextResponse.json(
      { success: false, error: { message: "Item not found" } },
      { status: 404 },
    );
  }
  if (automation.firstPostCreatedAt) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Media is locked once posts have been scheduled" },
      },
      { status: 400 },
    );
  }

  try {
    const result = await generateAutomationMedia({
      userId: session.userId,
      automationId: autoId,
      tier,
      style,
      aspect,
      appliesTo,
      keyTag: "campaigns",
    });

    // Persist the URL on the automation row so the editor shows it and the
    // scheduler reuses it (mediaMode flips to UPLOAD). Merge aiMediaConfig.
    const existingConfig = (() => {
      try {
        return JSON.parse(automation.aiMediaConfig ?? "{}") as Record<
          string,
          unknown
        >;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();
    const mergedConfig = {
      ...existingConfig,
      type: existingConfig.type ?? "image",
      style: result.style,
      tier: result.tier,
      appliesTo: result.appliesTo,
      aspect: result.aspect,
    };

    const updated = await prisma.contentAutomation.update({
      where: { id: autoId },
      data: {
        mediaUrl: result.url,
        mediaMode: "UPLOAD",
        aiMediaConfig: JSON.stringify(mergedConfig),
      },
      select: { id: true, mediaUrl: true, mediaMode: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        automation: updated,
        url: result.url,
        tier: result.tier,
        creditsCharged: result.creditCost,
        balanceAfter: result.balanceAfter,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string; required?: number; balance?: number };
    if (e.code === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: e.message,
            required: e.required,
            balance: e.balance,
          },
        },
        { status: 402 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          message: e instanceof Error ? e.message : "Image generation failed",
        },
      },
      { status: 500 },
    );
  }
}
