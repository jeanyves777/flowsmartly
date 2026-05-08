import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

type SearchResult = {
  id: string;
  kind: "profile" | "feed_post" | "campaign" | "contact" | "strategy" | "task";
  title: string;
  subtitle: string;
  href: string;
};

function truncate(value: string | null | undefined, max = 92) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Untitled";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function campaignHref(type: string, id: string) {
  const key = type.toLowerCase();
  if (key === "email") return `/email-marketing/${id}`;
  if (key === "sms") return `/sms-marketing/${id}`;
  return `/campaigns/${id}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (query.length < 2) {
      return NextResponse.json({ success: true, data: { results: [] } });
    }

    const [users, posts, campaigns, contacts, strategies, tasks] = await Promise.all([
      prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query } },
            { username: { contains: query } },
            { email: { contains: query } },
          ],
        },
        select: { id: true, name: true, username: true },
        take: 5,
        orderBy: { name: "asc" },
      }),
      prisma.post.findMany({
        where: {
          deletedAt: null,
          status: "PUBLISHED",
          caption: { contains: query },
          OR: [
            { userId: session.userId },
            { user: { username: "flowsmartly" } },
          ],
        },
        select: { id: true, caption: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.campaign.findMany({
        where: {
          userId: session.userId,
          OR: [
            { name: { contains: query } },
            { subject: { contains: query } },
            { content: { contains: query } },
          ],
        },
        select: { id: true, name: true, type: true, status: true },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contact.findMany({
        where: {
          userId: session.userId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            { company: { contains: query } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.marketingStrategy.findMany({
        where: {
          userId: session.userId,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        },
        select: { id: true, name: true, status: true },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.strategyTask.findMany({
        where: {
          strategy: { userId: session.userId },
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { category: { contains: query } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          strategy: { select: { name: true } },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const results: SearchResult[] = [
      ...users.map((user) => ({
        id: `profile-${user.id}`,
        kind: "profile" as const,
        title: user.name,
        subtitle: `@${user.username}`,
        href: `/profile/${user.username}`,
      })),
      ...posts.map((post) => ({
        id: `post-${post.id}`,
        kind: "feed_post" as const,
        title: truncate(post.caption, 90),
        subtitle: "Feed post",
        href: `/feed?post=${post.id}`,
      })),
      ...campaigns.map((campaign) => ({
        id: `campaign-${campaign.id}`,
        kind: "campaign" as const,
        title: campaign.name,
        subtitle: `${campaign.type.toUpperCase()} campaign / ${campaign.status.toLowerCase()}`,
        href: campaignHref(campaign.type, campaign.id),
      })),
      ...contacts.map((contact) => {
        const name = truncate(`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.company || contact.email || contact.phone, 80);
        return {
          id: `contact-${contact.id}`,
          kind: "contact" as const,
          title: name,
          subtitle: contact.email || contact.phone || "Contact",
          href: `/contacts?search=${encodeURIComponent(query)}`,
        };
      }),
      ...strategies.map((strategy) => ({
        id: `strategy-${strategy.id}`,
        kind: "strategy" as const,
        title: strategy.name,
        subtitle: `Strategy / ${strategy.status.toLowerCase()}`,
        href: `/content/strategy/plans/${strategy.id}`,
      })),
      ...tasks.map((task) => ({
        id: `task-${task.id}`,
        kind: "task" as const,
        title: task.title,
        subtitle: `${task.strategy.name} / ${task.status.toLowerCase()}`,
        href: `/content/strategy?task=${task.id}`,
      })),
    ].slice(0, 20);

    return NextResponse.json({ success: true, data: { results } });
  } catch (error) {
    console.error("Global search error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to search" } },
      { status: 500 }
    );
  }
}
