import { prisma } from "@/lib/db/client";
import { deliverSequenceWhatsApp, deliverSequenceEmail } from "@/lib/crm/send-adapters";

/**
 * SMS flow branch executor.
 *
 * When an SMS blast is built as a flow with an if/else CONDITION node (delivered
 * / clicked) feeding YES/NO branches into ACTION nodes, this fires the matching
 * branch action per recipient once their delivery outcome is known.
 *
 * It's decoupled from the live delivery webhook on purpose — a cron reads the
 * already-recorded CampaignSend outcomes and dispatches, marking each send
 * `branchProcessedAt` so it runs exactly once. Supported today: condition
 * `delivered` / `clicked` → action `whatsapp` / `email`. Waits, multi-step
 * chains, and tag/lead actions are a later iteration.
 */

interface FlowNode { id: string; type: string; channel?: string; actionText?: string; on?: string }
interface FlowLink { from: string; to: string; branch: "main" | "yes" | "no" }

function parseFlow(sectionsJson: string | null): { nodes: FlowNode[]; links: FlowLink[] } | null {
  if (!sectionsJson) return null;
  try {
    const j = JSON.parse(sectionsJson);
    if (Array.isArray(j?.nodes) && Array.isArray(j?.links)) return { nodes: j.nodes as FlowNode[], links: j.links as FlowLink[] };
  } catch {
    /* not a flow-shaped payload (e.g. email sections) */
  }
  return null;
}

export async function processCampaignBranches(campaign: { id: string; userId: string; sectionsJson: string | null }): Promise<{ processed: number; dispatched: number }> {
  const flow = parseFlow(campaign.sectionsJson);
  if (!flow) return { processed: 0, dispatched: 0 };

  const condition = flow.nodes.find((n) => n.type === "condition");
  if (!condition) return { processed: 0, dispatched: 0 };

  const branchTarget = (branch: "yes" | "no"): FlowNode | undefined => {
    const link = flow.links.find((l) => l.from === condition.id && l.branch === branch);
    return link ? flow.nodes.find((n) => n.id === link.to) : undefined;
  };
  const yesNode = branchTarget("yes");
  const noNode = branchTarget("no");
  if (!yesNode && !noNode) return { processed: 0, dispatched: 0 };

  const sends = await prisma.campaignSend.findMany({
    where: {
      campaignId: campaign.id,
      status: { in: ["DELIVERED", "FAILED", "UNDELIVERED"] },
      branchProcessedAt: null,
    },
    select: { id: true, status: true, clickedAt: true, contact: { select: { phone: true, email: true } } },
    take: 500,
  });

  let processed = 0;
  let dispatched = 0;
  for (const s of sends) {
    // Condition is met → YES branch; else → NO branch.
    const met = condition.on === "clicked" ? !!s.clickedAt : s.status === "DELIVERED";
    const target = met ? yesNode : noNode;
    if (target && target.type === "action") {
      const body = (target.actionText || "").trim();
      try {
        if (target.channel === "whatsapp" && s.contact.phone && body) {
          const r = await deliverSequenceWhatsApp({ userId: campaign.userId, to: s.contact.phone, body });
          if (r.ok) dispatched++;
        } else if (target.channel === "email" && s.contact.email && body) {
          const r = await deliverSequenceEmail({ userId: campaign.userId, to: s.contact.email, subject: "Following up", body });
          if (r.ok) dispatched++;
        }
        // "tag" / "lead" action channels: a later iteration.
      } catch (e) {
        console.error("[sms-flow-branches] dispatch failed for send", s.id, e);
      }
    }
    await prisma.campaignSend.update({ where: { id: s.id }, data: { branchProcessedAt: new Date() } }).catch(() => {});
    processed++;
  }
  return { processed, dispatched };
}
