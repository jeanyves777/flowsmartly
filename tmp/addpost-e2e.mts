import fs from "node:fs";
for (const l of fs.readFileSync("d:/Flowsmartly/flowsmartly/.env", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { prisma } = await import("../src/lib/db/client");
const { addCampaignPost } = await import("../src/lib/ai/flow-agent/tools/add-campaign-post");

const campaign = await prisma.contentCampaign.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, userId: true } });
if (!campaign) { console.log("no campaign in dev DB"); process.exit(0); }
console.log("target campaign:", campaign.name, campaign.id);
const before = await prisma.post.count({ where: { contentAutomation: { campaignId: campaign.id } } });

const ctx: any = { userId: campaign.userId, isAdmin: false, conversationId: null, messageId: null, emit: (e: any) => console.log("emit:", JSON.stringify(e.patch || e.type)) };
const res = await addCampaignPost.handler({ campaignId: campaign.id, caption: "Late-night wins add up. Let your AI handle the busywork while you rest.\n\n#AIGrowth #NightShift", mediaPrompt: "On-brand social image: calm dark workspace, glowing agent UI." }, ctx);
console.log("result:", JSON.stringify(res, null, 2));

if (res.ok && res.data?.postId) {
  const p = await prisma.post.findUnique({ where: { id: res.data.postId }, select: { status: true, mediaType: true, mediaUrl: true, mediaMeta: true, scheduledAt: true, caption: true } });
  console.log("created post:", { status: p?.status, mediaType: p?.mediaType, mediaUrl: p?.mediaUrl, mediaMeta: p?.mediaMeta, scheduledAt: p?.scheduledAt?.toISOString() });
  const after = await prisma.post.count({ where: { contentAutomation: { campaignId: campaign.id } } });
  console.log(`posts ${before} -> ${after}. mediaUrl should be NULL (plan-only), mediaType 'planned_image', status 'DRAFT'.`);
  // clean up the test post
  await prisma.post.delete({ where: { id: res.data.postId } });
  console.log("cleaned up test post");
}
process.exit(0);
