import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/business-plans/[id] — fetch a single plan.
 * Parses sections + brandSnapshot JSON strings back into objects so the
 * viewer doesn't have to.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;
  const plan = await prisma.businessPlan.findFirst({
    where: { id, userId: session.userId },
  });

  if (!plan) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }

  let sections: unknown = [];
  let brandSnapshot: unknown = {};
  try { sections = JSON.parse(plan.sections); } catch {}
  try { brandSnapshot = JSON.parse(plan.brandSnapshot); } catch {}

  return NextResponse.json({
    success: true,
    plan: {
      id: plan.id,
      name: plan.name,
      industry: plan.industry,
      stage: plan.stage,
      goals: plan.goals,
      targetAudience: plan.targetAudience,
      fundingNeeded: plan.fundingNeeded,
      coverColor: plan.coverColor,
      status: plan.status,
      publicToken: plan.publicToken,
      generationCount: plan.generationCount,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      sections,
      brandSnapshot,
    },
  });
}

/**
 * PATCH /api/business-plans/[id] — inline edits. FREE — only touches the
 * DB, no AI call. Accepts a partial update: { name?, sections?, status? }.
 * Sections is sent as an array; we stringify before writing.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: {
    name?: string;
    sections?: string;
    status?: string;
    coverColor?: string;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (Array.isArray(body.sections)) data.sections = JSON.stringify(body.sections);
  if (typeof body.status === "string" && ["draft", "published"].includes(body.status)) {
    data.status = body.status;
  }
  if (typeof body.coverColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(body.coverColor)) {
    data.coverColor = body.coverColor;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: { message: "Nothing to update" } }, { status: 400 });
  }

  const result = await prisma.businessPlan.updateMany({
    where: { id, userId: session.userId },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/business-plans/[id] — hard delete. Owner only.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.businessPlan.deleteMany({
    where: { id, userId: session.userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
