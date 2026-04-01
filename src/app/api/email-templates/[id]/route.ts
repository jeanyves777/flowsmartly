import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { renderEmailHtml } from "@/lib/marketing/email-renderer";
import type { EmailSection, EmailBrand } from "@/lib/marketing/email-renderer";

/**
 * GET /api/email-templates/:id — Get a single template
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const template = await prisma.emailTemplate.findFirst({
    where: {
      id,
      OR: [{ userId: session.userId }, { isDefault: true }],
    },
  });

  if (!template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: template });
}

/**
 * PATCH /api/email-templates/:id — Update a template
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const existing = await prisma.emailTemplate.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.subject !== undefined) updates.subject = body.subject;
    if (body.preheader !== undefined) updates.preheader = body.preheader;
    if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);

    // If sections are updated, re-render HTML
    if (body.sections !== undefined) {
      const parsedSections: EmailSection[] = typeof body.sections === "string" ? JSON.parse(body.sections) : body.sections;
      updates.sections = JSON.stringify(parsedSections);
      updates.content = parsedSections.map((s) => s.content).filter(Boolean).join("\n\n");

      // Get brand for re-rendering
      let brand: Partial<EmailBrand> | undefined;
      const bkId = body.brandKitId || existing.brandKitId;
      if (bkId) {
        const brandKit = await prisma.brandKit.findUnique({ where: { id: bkId } });
        if (brandKit) {
          brand = {
            name: brandKit.name,
            logo: brandKit.logo || undefined,
            colors: (() => { try { const c = JSON.parse(brandKit.colors); return c.primary ? c : undefined; } catch { return undefined; } })(),
            fonts: (() => { try { const f = JSON.parse(brandKit.fonts); return f.heading ? f : undefined; } catch { return undefined; } })(),
            website: brandKit.website || undefined,
            email: brandKit.email || undefined,
            phone: brandKit.phone || undefined,
            address: brandKit.address || undefined,
            socials: (() => { try { return JSON.parse(brandKit.handles); } catch { return undefined; } })(),
          };
        }
      }
      updates.contentHtml = renderEmailHtml(parsedSections, brand);
    }

    if (body.brandKitId !== undefined) updates.brandKitId = body.brandKitId || null;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error("Update email template error:", error);
    return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 });
  }
}

/**
 * DELETE /api/email-templates/:id — Delete a template
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.emailTemplate.findFirst({
    where: { id, userId: session.userId, isDefault: false }, // Can't delete system defaults
  });
  if (!existing) return NextResponse.json({ success: false, error: "Template not found or cannot be deleted" }, { status: 404 });

  await prisma.emailTemplate.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
