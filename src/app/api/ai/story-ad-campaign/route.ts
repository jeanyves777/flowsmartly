import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createCampaignRecord,
  listCampaigns,
  totalCreditsForCampaign,
} from "@/lib/story-ad-campaign";
import {
  emptyCampaignState,
  type CampaignAspectRatio,
  type CampaignClipLength,
  type CampaignDurationSeconds,
  type CampaignProvider,
  type CampaignStyle,
} from "@/lib/story-ad-campaign/types";

const ALLOWED_STYLES: CampaignStyle[] = ["3d", "cinematic", "narrated"];
const ALLOWED_PROVIDERS: CampaignProvider[] = ["veo3", "xai"];
const ALLOWED_ASPECTS: CampaignAspectRatio[] = ["9:16", "1:1", "16:9"];
const ALLOWED_CLIP_LENGTHS: CampaignClipLength[] = [8, 10, 12, 15];
const ALLOWED_DURATIONS: CampaignDurationSeconds[] = [60, 90, 120, 150, 180, 240, 300, 420, 600];
const ALLOWED_NARRATED_SUB_STYLES: ("3d" | "cinematic")[] = ["3d", "cinematic"];

function pick<T>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const base = emptyCampaignState();
  const state = {
    ...base,
    style: pick(body.style, ALLOWED_STYLES, "cinematic"),
    brief: String(body.brief || "").trim().slice(0, 1200),
    goal: String(body.goal || base.goal).trim().slice(0, 400),
    destinationUrl: String(body.destinationUrl || "").trim().slice(0, 240),
    aspectRatio: pick(body.aspectRatio, ALLOWED_ASPECTS, base.aspectRatio),
    durationSeconds: pick(body.durationSeconds, ALLOWED_DURATIONS, base.durationSeconds),
    clipLength: pick(body.clipLength, ALLOWED_CLIP_LENGTHS, base.clipLength),
    platforms: Array.isArray(body.platforms)
      ? (body.platforms as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 6)
      : base.platforms,
    provider: pick(body.provider, ALLOWED_PROVIDERS, base.provider),
    narratedSubStyle: pick(body.narratedSubStyle, ALLOWED_NARRATED_SUB_STYLES, "cinematic" as const),
    phase: "CHARACTERS" as const,
  };

  if (state.brief.length < 12) {
    return NextResponse.json(
      { success: false, error: { message: "Tell us what to advertise in the campaign brief." } },
      { status: 400 },
    );
  }

  const creditsBudget = totalCreditsForCampaign(state.durationSeconds, state.clipLength);

  const job = await createCampaignRecord({
    userId: session.userId,
    state,
    creditsBudget,
  });

  return NextResponse.json({
    success: true,
    data: {
      campaignId: job.id,
      creditsBudget,
    },
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const items = await listCampaigns(session.userId, 24);
  return NextResponse.json({ success: true, data: { campaigns: items } });
}
