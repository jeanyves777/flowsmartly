import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/websites/[id]/report-error
 *
 * Allows users to report a build error to admin.
 * Sends an email notification with the error details.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, name: true, slug: true, buildStatus: true, lastBuildError: true, lastBuildAt: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });

    const { message } = await req.json().catch(() => ({ message: "" }));

    const adminEmail = process.env.SMTP_FROM || "admin@flowsmartly.com";

    await sendEmail({
      to: adminEmail,
      subject: `[Website Builder] Build Error Report — ${website.name}`,
      html: `
        <h2>Website Build Error Report</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Website</td><td style="padding:8px;border-bottom:1px solid #eee;">${website.name} (${website.slug})</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Website ID</td><td style="padding:8px;border-bottom:1px solid #eee;">${website.id}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">User</td><td style="padding:8px;border-bottom:1px solid #eee;">${user?.name || "Unknown"} (${user?.email || "no email"})</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Build Status</td><td style="padding:8px;border-bottom:1px solid #eee;">${website.buildStatus}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Last Build</td><td style="padding:8px;border-bottom:1px solid #eee;">${website.lastBuildAt ? new Date(website.lastBuildAt).toISOString() : "N/A"}</td></tr>
          ${message ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">User Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message}</td></tr>` : ""}
        </table>
        ${website.lastBuildError ? `<h3 style="margin-top:20px;">Build Error</h3><pre style="background:#fef2f2;padding:16px;border-radius:8px;font-size:12px;overflow:auto;max-height:400px;white-space:pre-wrap;">${website.lastBuildError}</pre>` : ""}
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[ReportError]", err.message);
    return NextResponse.json({ error: "Failed to send report" }, { status: 500 });
  }
}
