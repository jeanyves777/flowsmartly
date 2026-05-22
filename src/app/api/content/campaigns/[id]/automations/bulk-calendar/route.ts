import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { US_HOLIDAYS, getHolidayDate, getHolidayById } from "@/lib/marketing/holidays";
import { ai } from "@/lib/ai/client";

const AI_SYSTEM =
  "You are FlowSmartly's marketing copywriter. Output only the requested text — no preamble, no quotes, no markdown headings.";

interface BulkOffset {
  days: number;
  time: string;
}

const DEFAULT_OFFSETS: BulkOffset[] = [
  { days: -1, time: "09:00" },
  { days: 0, time: "09:00" },
];

const DEFAULT_PLATFORMS = ["instagram", "facebook"];

const AI_FILL_CONCURRENCY = 3;

async function fillForHoliday(
  holiday: { id: string; name: string; promptHint: string },
  brand: { name: string; description: string; voice: string },
): Promise<{ topic: string; copy: string; hashtags: string[] } | null> {
  try {
    const baseCtx = `Brand: ${brand.name}${brand.description ? ` — ${brand.description}` : ""}. Tone: ${brand.voice}. Holiday: ${holiday.name}. Hint: ${holiday.promptHint}.`;
    const [topic, copy, hashtagsRaw] = await Promise.all([
      ai.generate(
        `Write a 2-sentence post brief for ${holiday.name}. ${baseCtx} What should the post communicate?`,
        { maxTokens: 200, temperature: 0.8, systemPrompt: AI_SYSTEM },
      ),
      ai.generate(
        `Write a ready-to-post social caption (under 220 chars) about ${holiday.name} for ${brand.name}. ${baseCtx} Include a hook and clear CTA. No hashtags in this output. No quotes.`,
        { maxTokens: 400, temperature: 0.85, systemPrompt: AI_SYSTEM },
      ),
      ai.generate(
        `Suggest 6-10 relevant hashtags for a ${holiday.name} post for ${brand.name}. Output as comma-separated, no # prefix.`,
        { maxTokens: 120, temperature: 0.7, systemPrompt: AI_SYSTEM },
      ),
    ]);
    const hashtags = hashtagsRaw
      .replace(/^[#*\->\s]+/gm, "")
      .split(/[,\n]+/)
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 10);
    return {
      topic: topic.trim().replace(/^["'`\s]+|["'`\s]+$/g, ""),
      copy: copy.trim().replace(/^["'`\s]+|["'`\s]+$/g, ""),
      hashtags,
    };
  } catch {
    return null;
  }
}

async function runPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx]);
      }
    }),
  );
  return results;
}

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id: campaignId } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id: campaignId, userId: session.userId },
    select: {
      id: true,
      defaultTone: true,
      defaultPlatforms: true,
      mediaFolderId: true,
    },
  });
  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    holidayIds?: string[];
    offsets?: BulkOffset[];
    platforms?: string[];
    mediaMode?: string;
    tone?: string;
    aiFill?: boolean;
  };

  const holidayIds = Array.isArray(body.holidayIds)
    ? (body.holidayIds.filter((h) => typeof h === "string") as string[])
    : [];
  if (holidayIds.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: "Pick at least one calendar event" } },
      { status: 400 },
    );
  }

  // Resolve holidays + skip unknowns
  const holidays = holidayIds
    .map((id) => getHolidayById(id))
    .filter((h): h is (typeof US_HOLIDAYS)[number] => !!h);
  if (holidays.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: "No matching holidays" } },
      { status: 400 },
    );
  }

  const offsets =
    Array.isArray(body.offsets) && body.offsets.length > 0
      ? body.offsets
      : DEFAULT_OFFSETS;

  let defaultCampaignPlatforms: string[] = [];
  try {
    defaultCampaignPlatforms = JSON.parse(campaign.defaultPlatforms || "[]");
  } catch {
    defaultCampaignPlatforms = [];
  }
  const platforms =
    Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms
      : defaultCampaignPlatforms.length > 0
      ? defaultCampaignPlatforms
      : DEFAULT_PLATFORMS;

  const mediaMode = body.mediaMode || "AI_AT_POST_TIME";
  const tone = body.tone || campaign.defaultTone || "friendly";
  const aiFill = body.aiFill !== false; // default ON

  // Load brand context once (for AI fill)
  let brandName = "FlowSmartly";
  let brandDescription = "";
  let brandVoice = tone;
  if (aiFill) {
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({ where: { userId: session.userId } });
    }
    if (brandKit) {
      brandName = brandKit.name || brandName;
      brandDescription = brandKit.description ?? "";
      brandVoice = brandKit.voiceTone || tone;
    }
  }

  // Optionally AI-fill in parallel (pooled) BEFORE the DB inserts so failures don't poison the row.
  const fills = aiFill
    ? await runPool(
        holidays,
        (h) => fillForHoliday({ id: h.id, name: h.name, promptHint: h.promptHint }, {
          name: brandName,
          description: brandDescription,
          voice: brandVoice,
        }),
        AI_FILL_CONCURRENCY,
      )
    : holidays.map(() => null);

  const created: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (let i = 0; i < holidays.length; i++) {
    const h = holidays[i];
    const fill = fills[i];
    const year = new Date().getFullYear();
    const dt = getHolidayDate(h, year);
    const dateLabel = new Date(year, dt.month - 1, dt.day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    try {
      const automation = await prisma.contentAutomation.create({
        data: {
          userId: session.userId,
          campaignId,
          channel: "SOCIAL",
          name: `${h.icon} ${h.name}`,
          description: `Calendar event automation for ${h.name} (${dateLabel}).`,
          triggerType: "CALENDAR_EVENT",
          triggerConfig: "{}",
          calendarSourceType: "HOLIDAY",
          calendarSourceId: h.id,
          calendarSourceLabel: h.name,
          calendarOffsets: JSON.stringify(offsets),
          topic: fill?.topic || h.promptHint,
          aiPrompt: fill
            ? `Write a social post for ${h.name}. ${fill.topic}`
            : `Create a social post celebrating ${h.name}. ${h.promptHint}`,
          aiTone: tone,
          copy: fill?.copy || null,
          hashtags: JSON.stringify(fill?.hashtags ?? []),
          platforms: JSON.stringify(platforms),
          mediaMode,
          mediaFolderId: mediaMode === "FOLDER" ? campaign.mediaFolderId : null,
          aiMediaConfig:
            mediaMode === "AI_AT_POST_TIME"
              ? JSON.stringify({ type: "image", style: "natural" })
              : null,
          reviewStatus: "PENDING_REVIEW",
          enabled: true,
          status: "DRAFT",
        },
      });
      created.push(automation.id);
    } catch (err) {
      failed.push({
        id: h.id,
        reason: err instanceof Error ? err.message : "create_failed",
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: { created, failed, aiFill },
  });
}
