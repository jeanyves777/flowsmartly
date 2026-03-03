import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generatePitchPDF } from "@/lib/pitch/pdf-generator";
import { sendPitchEmail } from "@/lib/email";
import { sendMarketingEmail, createTransporter, sendViaMailgunApi } from "@/lib/email/marketing-sender";
import type { PitchContent } from "@/lib/pitch/generator";
import type { ResearchData } from "@/lib/pitch/researcher";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { recipientEmail, recipientName, message, pdfOnly } = body;

    const pitch = await prisma.pitch.findFirst({
      where: { id, userId: session.userId },
    });

    if (!pitch) {
      return NextResponse.json({ success: false, error: { message: "Pitch not found" } }, { status: 404 });
    }

    if (pitch.status !== "READY" && pitch.status !== "SENT") {
      return NextResponse.json(
        { success: false, error: { message: "Pitch is not ready yet. Please wait for the AI to finish." } },
        { status: 400 }
      );
    }

    const toEmail = pdfOnly ? "" : (recipientEmail || pitch.recipientEmail || "").trim();
    if (!pdfOnly && !toEmail) {
      return NextResponse.json({ success: false, error: { message: "Recipient email is required" } }, { status: 400 });
    }

    const toName = recipientName || pitch.recipientName || "";

    // Parse pitch content and research
    let pitchContent: PitchContent;
    let research: ResearchData;
    try {
      pitchContent = JSON.parse(pitch.pitchContent || "{}") as PitchContent;
      research = JSON.parse(pitch.research || "{}") as ResearchData;
    } catch {
      return NextResponse.json({ success: false, error: { message: "Pitch content is corrupted" } }, { status: 500 });
    }

    // Get brand kit + user + marketing config in parallel
    const [brandKit, user, marketingConfig] = await Promise.all([
      prisma.brandKit.findFirst({
        where: { userId: session.userId },
        select: { name: true, colors: true, logo: true, website: true },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      }),
      prisma.marketingConfig.findFirst({
        where: { userId: session.userId },
        select: {
          emailProvider: true,
          emailConfig: true,
          emailEnabled: true,
          defaultFromName: true,
          defaultFromEmail: true,
          defaultReplyTo: true,
        },
      }),
    ]);

    const brandColors = JSON.parse(brandKit?.colors || "{}") as { primary?: string; secondary?: string };

    // Resolve brand logo to base64 + detect aspect ratio
    let logoBase64: string | undefined;
    let logoAspectRatio: number | undefined;
    if (brandKit?.logo) {
      try {
        const sharp = (await import("sharp")).default;
        let buffer: Buffer;
        const src = brandKit.logo;
        if (src.startsWith("data:")) {
          buffer = Buffer.from(src.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
        } else if (src.startsWith("http")) {
          const r = await fetch(src);
          buffer = Buffer.from(await r.arrayBuffer());
        } else {
          const { readFile } = await import("fs/promises");
          const { join } = await import("path");
          buffer = await readFile(join(process.cwd(), "public", src));
        }
        const meta = await sharp(buffer).metadata();
        const w = meta.width || 100;
        const h = meta.height || 100;
        const mime = (meta.format === "jpeg" || meta.format === "jpg") ? "image/jpeg"
          : meta.format === "webp" ? "image/webp" : "image/png";
        logoBase64 = `data:${mime};base64,${buffer.toString("base64")}`;
        logoAspectRatio = w / h;
      } catch (e) {
        console.warn("[pitch pdf] Could not resolve brand logo:", e);
      }
    }

    const brand = {
      name: brandKit?.name || "FlowSmartly",
      primaryColor: brandColors.primary || "#2563eb",
      secondaryColor: brandColors.secondary,
      logo: logoBase64,
      logoAspectRatio,
    };

    // Generate PDF
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generatePitchPDF(pitchContent, research, pitch.businessName, brand);
    } catch (pdfErr) {
      console.error("[send pitch] PDF generation failed:", pdfErr);
      // Continue without PDF — still send the HTML email
    }

    // PDF-only mode: return the PDF as a binary download
    if (pdfOnly) {
      if (!pdfBuffer) {
        return NextResponse.json({ success: false, error: { message: "PDF generation failed" } }, { status: 500 });
      }
      const filename = `${pitch.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`;
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // Determine sender: use user's configured marketing email, fall back to FlowSmartly SMTP
    const emailCfg = marketingConfig?.emailConfig as Record<string, unknown> | null | undefined;
    const canUseUserEmail =
      marketingConfig?.emailEnabled &&
      marketingConfig?.emailProvider &&
      marketingConfig.emailProvider !== "NONE" &&
      emailCfg &&
      Object.keys(emailCfg).length > 0;

    const fromName = marketingConfig?.defaultFromName || brandKit?.name || user?.name || "FlowSmartly Team";
    const fromEmail = marketingConfig?.defaultFromEmail || user?.email || "info@flowsmartly.com";
    const replyToAddr = marketingConfig?.defaultReplyTo || user?.email;

    if (canUseUserEmail) {
      // Build pitch email HTML then send via user's provider
      const { buildPitchEmailHtml } = await import("@/lib/email");
      const html = buildPitchEmailHtml({
        recipientName: toName || undefined,
        businessName: pitch.businessName,
        pitch: pitchContent,
        research,
        pdfBuffer,
        senderName: fromName,
        customMessage: message || undefined,
        brandPrimaryColor: brand.primaryColor,
        brandWebsite: brandKit?.website || undefined,
      });

      const attachments = pdfBuffer
        ? [{ filename: `${pitch.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`, content: pdfBuffer }]
        : [];

      // Mailgun uses HTTP API; everything else uses nodemailer
      if (marketingConfig.emailProvider === "MAILGUN") {
        await sendViaMailgunApi(
          emailCfg,
          `${fromName} <${fromEmail}>`,
          toEmail,
          pitchContent.subject,
          html,
          undefined
        );
      } else {
        const transporter = createTransporter(marketingConfig.emailProvider, emailCfg);
        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: toEmail,
          subject: pitchContent.subject,
          html,
          replyTo: replyToAddr,
          attachments: attachments.map(a => ({ filename: a.filename, content: a.content })),
        });
      }
    } else {
      // Fall back to FlowSmartly's SMTP
      await sendPitchEmail({
        to: toEmail,
        recipientName: toName || undefined,
        businessName: pitch.businessName,
        pitch: pitchContent,
        research,
        pdfBuffer,
        senderName: fromName,
        replyTo: replyToAddr,
        customMessage: message || undefined,
        brandPrimaryColor: brand.primaryColor,
        brandWebsite: brandKit?.website || undefined,
      });
    }

    // Update pitch status
    await prisma.pitch.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        recipientEmail: toEmail,
        recipientName: toName || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { sentTo: toEmail, sentAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Send pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to send pitch" } }, { status: 500 });
  }
}
