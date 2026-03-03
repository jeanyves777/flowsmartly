import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generatePitchPDF } from "@/lib/pitch/pdf-generator";
import { sendPitchEmail } from "@/lib/email";
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

    // Get user's brand info for PDF
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: { name: true, colors: true, logo: true },
    });
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

    // Get sender name
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });

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

    // Send email (pass research so the email includes visual score bars)
    await sendPitchEmail({
      to: toEmail,
      recipientName: toName || undefined,
      businessName: pitch.businessName,
      pitch: pitchContent,
      research,
      pdfBuffer,
      senderName: user?.name || "FlowSmartly Team",
      replyTo: user?.email,
      customMessage: message || undefined,
    });

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
