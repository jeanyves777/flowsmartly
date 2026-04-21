import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/core";

/**
 * POST /api/business-plans/[id]/share — mint a public share token (idempotent)
 * and optionally email the share link to a recipient. If the plan already
 * has a publicToken we reuse it so existing shared links keep working.
 *
 * Body: { email?: string, message?: string }
 *  - If email is present we send the share link there.
 *  - If omitted we just return the shareUrl for the UI to show a Copy button.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const toEmail = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const plan = await prisma.businessPlan.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, name: true, publicToken: true },
  });
  if (!plan) {
    return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  }

  let token = plan.publicToken;
  if (!token) {
    token = randomBytes(16).toString("hex");
    await prisma.businessPlan.update({
      where: { id: plan.id },
      data: { publicToken: token },
    });
  }

  const origin =
    req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
  const shareUrl = `${origin}/bp/${token}`;

  let emailed = false;
  if (toEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    const result = await sendEmail({
      to: toEmail,
      subject: `${plan.name} — Business Plan`,
      html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;color:#0f172a;">${escapeHtml(plan.name)}</h2>
  <p style="color:#475569;line-height:1.5;">Someone shared a business plan with you on FlowSmartly.</p>
  ${message ? `<blockquote style="border-left:3px solid #6366f1;padding:8px 16px;background:#f1f5f9;color:#334155;margin:16px 0;">${escapeHtml(message)}</blockquote>` : ""}
  <p style="margin:24px 0;">
    <a href="${shareUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open the plan</a>
  </p>
  <p style="color:#94a3b8;font-size:12px;">Or copy this link: ${shareUrl}</p>
</div>`,
    });
    emailed = result.success;
  }

  return NextResponse.json({ success: true, shareUrl, emailed });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
