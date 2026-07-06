import { NextRequest, NextResponse } from "next/server";
import { getPortfolioBySlug } from "@/lib/portfolio/portfolio-editor";
import { requestVisitorCode } from "@/lib/portfolio/verification";

// POST /api/pf/[slug]/request-code — public. Issues + emails a 6-digit code
// for a gated portfolio. No auth: the visitor is a member of the public.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const p = await getPortfolioBySlug(slug);
    if (!p || p.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent");

    const r = await requestVisitorCode({
      portfolio: { id: p.id, userId: p.userId, name: p.name, slug: p.slug },
      email: body.email,
      ip,
      userAgent: ua,
    });
    if (!r.ok) return NextResponse.json({ error: r.error || "Could not send a code." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
