import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/email-templates/:id/clone — Clone a template
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const original = await prisma.emailTemplate.findFirst({
    where: {
      id,
      OR: [{ userId: session.userId }, { isDefault: true }],
    },
  });

  if (!original) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });

  const clone = await prisma.emailTemplate.create({
    data: {
      userId: session.userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      subject: original.subject,
      preheader: original.preheader,
      content: original.content,
      contentHtml: original.contentHtml,
      sections: original.sections,
      brandKitId: original.brandKitId,
      source: "cloned",
      tags: original.tags,
    },
  });

  return NextResponse.json({ success: true, data: clone }, { status: 201 });
}
