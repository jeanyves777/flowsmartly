import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { renderEmailHtml } from "@/lib/marketing/email-renderer";
import type { EmailSection, EmailBrand } from "@/lib/marketing/email-renderer";

/**
 * GET /api/email-templates — List templates (user's + system defaults)
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const source = searchParams.get("source");

  const where: Record<string, unknown> = {
    OR: [
      { userId: session.userId },
      { isDefault: true },
    ],
  };
  if (category && category !== "all") (where as Record<string, unknown>).category = category;
  if (source) (where as Record<string, unknown>).source = source;
  if (search) {
    (where as Record<string, unknown>).name = { contains: search, mode: "insensitive" };
  }

  const templates = await prisma.emailTemplate.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      subject: true,
      preheader: true,
      source: true,
      isDefault: true,
      usageCount: true,
      lastUsedAt: true,
      thumbnailUrl: true,
      tags: true,
      sections: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, data: templates });
}

/**
 * POST /api/email-templates — Create a new template
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, description, category, subject, preheader, sections, brandKitId, source, sourcePrompt, tags } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Template name is required" }, { status: 400 });
    }

    // Parse sections and render HTML
    const parsedSections: EmailSection[] = typeof sections === "string" ? JSON.parse(sections) : (sections || []);

    // Get brand data for rendering
    let brand: Partial<EmailBrand> | undefined;
    if (brandKitId) {
      const brandKit = await prisma.brandKit.findUnique({ where: { id: brandKitId } });
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

    const contentHtml = parsedSections.length > 0 ? renderEmailHtml(parsedSections, brand) : undefined;
    const plainText = parsedSections.map((s) => s.content).filter(Boolean).join("\n\n");

    const template = await prisma.emailTemplate.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        description: description || null,
        category: category || "custom",
        subject: subject || null,
        preheader: preheader || null,
        content: plainText,
        contentHtml,
        sections: JSON.stringify(parsedSections),
        brandKitId: brandKitId || null,
        source: source || "manual",
        sourcePrompt: sourcePrompt || null,
        tags: JSON.stringify(tags || []),
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error("Create email template error:", error);
    return NextResponse.json({ success: false, error: "Failed to create template" }, { status: 500 });
  }
}
