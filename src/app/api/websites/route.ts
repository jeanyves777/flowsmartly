import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name).substring(0, 50) || "my-website";
  const suffix = Math.random().toString(36).substring(2, 8);
  const slug = `${base}-${suffix}`;
  const existing = await prisma.website.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return `${base}-${suffix}${Math.random().toString(36).substring(2, 5)}`;
  return slug;
}

// GET /api/websites — List user's websites
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const websites = await prisma.website.findMany({
      where: { userId: session.userId, deletedAt: null },
      include: { pages: { select: { id: true, title: true, slug: true, isHomePage: true, sortOrder: true, status: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ websites });
  } catch (err) {
    console.error("GET /api/websites error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/websites — Create a new website
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check plan — free users need to upgrade for website hosting
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { plan: true, aiCredits: true, freeCredits: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const isFreePlan = user.plan === "STARTER" || user.plan === "FREE";
    const hasPurchasedCredits = user.aiCredits > (user.freeCredits || 0);

    if (isFreePlan && !hasPurchasedCredits) {
      return NextResponse.json({
        error: "Website hosting requires a paid plan or purchased credits. Upgrade your plan or buy credits to get started.",
        code: "PLAN_REQUIRED",
      }, { status: 403 });
    }

    // Limit: 1 website per account
    const existingCount = await prisma.website.count({ where: { userId: session.userId, deletedAt: null } });
    if (existingCount >= 1) {
      return NextResponse.json({
        error: "You can only have one website per account. Delete your existing site to create a new one.",
        code: "LIMIT_REACHED",
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, brandKitId, theme, navigation, settings } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const slug = await generateUniqueSlug(name);

    const website = await prisma.website.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        slug,
        brandKitId: brandKitId || null,
        theme: theme || "{}",
        navigation: navigation || "{}",
        settings: settings || "{}",
        pageCount: 1,
      },
    });

    // Create default home page
    await prisma.websitePage.create({
      data: {
        websiteId: website.id,
        title: "Home",
        slug: "",
        isHomePage: true,
        sortOrder: 0,
        blocks: "[]",
      },
    });

    return NextResponse.json({ website }, { status: 201 });
  } catch (err) {
    console.error("POST /api/websites error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
