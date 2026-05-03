import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  AdminPermission,
  getAdminSession,
  requirePermission,
} from "@/lib/admin/auth";

const statuses = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED", "ARCHIVED"] as const;
type DemoRequestStatus = (typeof statuses)[number];

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function serializeRequest(request: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  companySize: string | null;
  productInterest: string;
  preferredTime: string | null;
  timezone: string | null;
  message: string | null;
  source: string;
  status: string;
  adminNotes: string | null;
  contactedAt: Date | null;
  scheduledAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...request,
    productInterest: parseJsonArray(request.productInterest),
    contactedAt: request.contactedAt?.toISOString() || null,
    scheduledAt: request.scheduledAt?.toISOString() || null,
    closedAt: request.closedAt?.toISOString() || null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim().toUpperCase() || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ];
    }
    if (statuses.includes(status as DemoRequestStatus)) {
      where.status = status;
    }

    const [requests, total, stats] = await Promise.all([
      prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.demoRequest.count({ where }),
      Promise.all([
        prisma.demoRequest.count(),
        prisma.demoRequest.count({ where: { status: "NEW" } }),
        prisma.demoRequest.count({ where: { status: "CONTACTED" } }),
        prisma.demoRequest.count({ where: { status: "SCHEDULED" } }),
        prisma.demoRequest.count({ where: { status: "CLOSED" } }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        requests: requests.map(serializeRequest),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total: stats[0],
          new: stats[1],
          contacted: stats[2],
          scheduled: stats[3],
          closed: stats[4],
        },
      },
    });
  } catch (error) {
    console.error("Admin demo requests error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch demo requests" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
    const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : undefined;

    if (!id || !statuses.includes(status as DemoRequestStatus)) {
      return NextResponse.json(
        { success: false, error: { message: "A valid request and status are required" } },
        { status: 400 }
      );
    }

    const updateData: {
      status: DemoRequestStatus;
      adminNotes?: string | null;
      contactedAt?: Date;
      scheduledAt?: Date;
      closedAt?: Date;
    } = {
      status: status as DemoRequestStatus,
    };

    if (adminNotes !== undefined) updateData.adminNotes = adminNotes || null;
    if (status === "CONTACTED") updateData.contactedAt = new Date();
    if (status === "SCHEDULED") updateData.scheduledAt = new Date();
    if (status === "CLOSED") updateData.closedAt = new Date();

    const updated = await prisma.demoRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { request: serializeRequest(updated) },
    });
  } catch (error) {
    console.error("Update demo request error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update demo request" } },
      { status: 500 }
    );
  }
}
