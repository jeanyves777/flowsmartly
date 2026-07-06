import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readPortfolio } from "@/lib/portfolio/portfolio-editor";

// GET /api/portfolios — the current user's portfolio (one per account) or null.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const portfolio = await readPortfolio(session.userId);
    return NextResponse.json({ portfolio });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
