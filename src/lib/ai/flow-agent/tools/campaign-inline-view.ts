import { prisma } from "@/lib/db/client";
import { campaignTimelineView } from "@/lib/agent-views/templates";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtWhen(d: Date | null): string {
  if (!d) return "unscheduled";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} - ${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtPlatforms(raw: string | null): string {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) && a.length ? a.map((p: string) => String(p)).join(" - ") : "feed";
  } catch {
    return "feed";
  }
}

export async function buildCampaignInlineView(input: {
  userId: string;
  campaignId?: string | null;
  postIdForRequest?: string;
}) {
  if (!input.campaignId) return undefined;
  const campaign = await prisma.contentCampaign.findFirst({
    where: { id: input.campaignId, userId: input.userId },
    select: {
      id: true,
      name: true,
      status: true,
      automations: {
        select: {
          posts: {
            select: { id: true, caption: true, platforms: true, mediaUrl: true, mediaType: true, status: true, scheduledAt: true },
          },
        },
      },
    },
  });
  if (!campaign) return undefined;
  const posts = campaign.automations
    .flatMap((automation) => automation.posts)
    .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0))
    .map((item) => ({
      id: item.id,
      when: fmtWhen(item.scheduledAt),
      platforms: fmtPlatforms(item.platforms),
      caption: item.caption || "",
      status: item.status,
      hasMedia: !!item.mediaUrl,
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
    }));
  return {
    requestId: `campaign-view-${campaign.id}${input.postIdForRequest ? `-media-${input.postIdForRequest}` : ""}`,
    spec: campaignTimelineView({ campaignId: campaign.id, name: campaign.name, status: campaign.status, posts }),
  };
}
