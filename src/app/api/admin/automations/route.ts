import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

type AdminAutomationSource = "email" | "content";

function parseStringArray(raw: string | null | undefined) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function matchesType(item: { type: string; campaignType: string; source: AdminAutomationSource }, type: string) {
  if (!type) return true;
  const normalized = type.toUpperCase();
  if (normalized === "CONTENT") return item.source === "content";
  if (normalized === "EMAIL" || normalized === "SMS") return item.campaignType === normalized;
  return item.type === normalized;
}

// GET /api/admin/automations - List all user automations across email/SMS and strategy content flows
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const type = searchParams.get("type") || "";

    const [emailAutomations, contentAutomations, totalLogs] = await Promise.all([
      prisma.automation.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          contactList: { select: { id: true, name: true, totalCount: true, activeCount: true } },
          _count: { select: { logs: true } },
        },
      }),
      prisma.postAutomation.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.automationLog.count(),
    ]);

    const combined = [
      ...emailAutomations.map((a) => ({
        id: a.id,
        source: "email" as AdminAutomationSource,
        name: a.name,
        type: a.type,
        campaignType: a.campaignType,
        channelLabel: a.campaignType,
        enabled: a.enabled,
        totalSent: a.totalSent,
        lastTriggered: a.lastTriggered?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        user: a.user,
        logCount: a._count.logs,
        contactList: a.contactList,
      })),
      ...contentAutomations.map((a) => {
        const platforms = parseStringArray(a.platforms);
        return {
          id: a.id,
          source: "content" as AdminAutomationSource,
          name: a.name,
          type: a.type,
          campaignType: "CONTENT",
          channelLabel: platforms.length ? platforms.join(", ") : "Feed",
          enabled: a.enabled,
          totalSent: a.totalGenerated,
          lastTriggered: a.lastTriggered?.toISOString() || null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          user: a.user,
          logCount: 0,
          contactList: null,
        };
      }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const filtered = combined.filter((item) => {
      if (!matchesType(item, type)) return false;
      if (!search) return true;
      return [
        item.name,
        item.type,
        item.campaignType,
        item.channelLabel,
        item.user.name,
        item.user.email,
        item.contactList?.name || "",
      ].some((value) => value.toLowerCase().includes(search));
    });

    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      data: {
        automations: paginated,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
        stats: {
          total: combined.length,
          active: combined.filter((item) => item.enabled).length,
          totalSent: combined.reduce((sum, item) => sum + item.totalSent, 0),
          totalLogs,
        },
      },
    });
  } catch (error) {
    console.error("Admin automations error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch automations" } }, { status: 500 });
  }
}

// PATCH /api/admin/automations - Rename or cancel a user automation
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const source = body.source as AdminAutomationSource;
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
    const action = typeof body.action === "string" ? body.action : "";

    if (!id || !["email", "content"].includes(source)) {
      return NextResponse.json({ success: false, error: { message: "Automation id and source are required" } }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name) {
        return NextResponse.json({ success: false, error: { message: "Automation name cannot be empty" } }, { status: 400 });
      }
      updateData.name = name;
    }
    if (enabled !== undefined) updateData.enabled = enabled;
    if (action === "cancel") updateData.enabled = false;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: { message: "No automation changes supplied" } }, { status: 400 });
    }

    if (source === "email") {
      await prisma.automation.update({ where: { id }, data: updateData });
    } else {
      await prisma.postAutomation.update({ where: { id }, data: updateData });
    }

    return NextResponse.json({ success: true, data: { id, source, updated: true } });
  } catch (error) {
    console.error("Admin automation update error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update automation" } }, { status: 500 });
  }
}
