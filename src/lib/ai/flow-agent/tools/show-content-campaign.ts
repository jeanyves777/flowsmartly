import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";
import { campaignTimelineView } from "@/lib/agent-views/templates";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtWhen(d: Date | null): string {
  if (!d) return "unscheduled";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${h}:${String(m).padStart(2, "0")} ${ampm}`;
}
function fmtPlatforms(raw: string | null): string {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) && a.length ? a.map((p: string) => String(p)).join(" · ") : "feed";
  } catch {
    return "feed";
  }
}

/**
 * show_content_campaign — render a content campaign as an INTERACTIVE card in the
 * chat: each post with its date, channels, caption + per-post actions (rewrite /
 * image / reschedule / remove) and a tweak input, plus approve/improve/open. The
 * user reviews and edits the whole campaign without leaving the conversation;
 * every action comes back to you to act on. [[agent-authored-views]]
 */
export const showContentCampaign: FlowAgentTool = {
  name: "show_content_campaign",
  description:
    "Render a CONTENT CAMPAIGN (Campaign Studio) as an interactive card inline in the chat — every post shown with its date, channels and caption, plus per-post buttons (✨ Rewrite, 🖼 image, 🕓 Reschedule, 🗑 Remove) and a tweak input, and footer actions (Approve all, Improve, Open studio). Use this right after you create/improve a campaign, or when the user asks to see/review/edit a campaign, so they can review and tweak it in the chat. When a post action comes back, use the matching tool (regenerate_post_image, update_post, delete_post, improve_content_campaign, write_compose_post) on that postId/campaignId. Pass campaignId.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "The ContentCampaign id to display." },
    },
    required: ["campaignId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    const campaignId = typeof input.campaignId === "string" ? input.campaignId.trim() : "";
    if (!campaignId) return { ok: false, error_code: "missing_input", message: "campaignId is required." };
    const campaign = await prisma.contentCampaign.findFirst({
      where: { id: campaignId, userId: ctx.userId },
      select: {
        id: true, name: true, status: true,
        automations: { select: { posts: { select: { id: true, caption: true, platforms: true, mediaUrl: true, status: true, scheduledAt: true } } } },
      },
    });
    if (!campaign) return { ok: false, error_code: "not_found", message: `No content campaign "${campaignId}". Use list_content_campaigns to find it.` };

    const posts = campaign.automations
      .flatMap((a) => a.posts)
      .sort((p, q) => (p.scheduledAt?.getTime() ?? 0) - (q.scheduledAt?.getTime() ?? 0))
      .map((p) => ({
        id: p.id,
        when: fmtWhen(p.scheduledAt),
        platforms: fmtPlatforms(p.platforms),
        caption: p.caption || "",
        status: p.status,
        hasMedia: !!p.mediaUrl,
      }));

    if (posts.length === 0) {
      return { ok: true, data: { campaignId, posts: 0, userMessage: `"${campaign.name}" has no posts yet — add some with add_campaign_post, then show it again.` } };
    }

    ctx.emit({ type: "agent_view", requestId: campaign.id, spec: campaignTimelineView({ campaignId: campaign.id, name: campaign.name, status: campaign.status, posts }) });

    return {
      ok: true,
      data: {
        campaignId,
        posts: posts.length,
        userMessage: `Rendered the "${campaign.name}" campaign as an interactive card in the chat (${posts.length} posts, each with Rewrite / image / Reschedule / Remove + a tweak input). STOP and wait — when the user acts on a post, use the matching tool (regenerate_post_image / update_post / delete_post / improve_content_campaign / write_compose_post) on that id. Do NOT re-list the posts as text.`,
      },
    };
  },
};
