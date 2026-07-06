import { NextRequest, NextResponse } from "next/server";
import { getPortfolioBySlug } from "@/lib/portfolio/portfolio-editor";
import { verifyVisitorCode, accessCookieName } from "@/lib/portfolio/verification";

// POST /api/pf/[slug]/verify — public. Checks the code; on success sets an
// httpOnly access cookie and upserts the visitor as a Contact (lead capture).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const p = await getPortfolioBySlug(slug);
    if (!p || p.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const r = await verifyVisitorCode({
      portfolio: { id: p.id, userId: p.userId, name: p.name, slug: p.slug },
      email: body.email,
      code: body.code,
    });
    if (!r.ok || !r.visitorId) {
      return NextResponse.json({ error: r.error || "Verification failed." }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(accessCookieName(p.id), r.visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
