import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { generatePitchPDF, generateServiceProposalPDF } from "@/lib/pitch/pdf-generator";
import { sendPitchEmail } from "@/lib/email";
import { createTransporter, sendViaMailgunApi } from "@/lib/email/marketing-sender";
import { getPresignedUrl, sanitizeUrlsForStorage } from "@/lib/utils/s3-client";
import type { PitchContent } from "@/lib/pitch/generator";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import { ensureFullProposalSections } from "@/lib/pitch/proposal-full-agent";
import type { ResearchData } from "@/lib/pitch/researcher";

function isServiceProposal(content: PitchContent | ServiceProposalContent): content is ServiceProposalContent {
  return (content as ServiceProposalContent).documentType === "service_proposal";
}

function isManagedLogoReference(src: string) {
  if (!src) return false;
  if (src.includes("/api/image-proxy?url=")) return true;
  if (src.includes("amazonaws.com/")) return true;
  if (src.includes("flowsmartly-media")) return true;
  return /^[a-zA-Z0-9_-]+\/.+\.[a-zA-Z0-9]+(?:\?.*)?$/.test(src);
}

async function fetchLogoBuffer(src: string): Promise<Buffer> {
  const candidates: string[] = [];

  if (isManagedLogoReference(src)) {
    try {
      candidates.push(await getPresignedUrl(src));
    } catch {
      // Fall back to direct fetch/local handling below.
    }
  }

  if (src.startsWith("http")) candidates.push(src);

  for (const url of candidates) {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.toLowerCase().startsWith("image/")) {
      return Buffer.from(await response.arrayBuffer());
    }
  }

  if (src.startsWith("/api/image-proxy?url=") || /^[a-zA-Z0-9_-]+\/.+\.[a-zA-Z0-9]+(?:\?.*)?$/.test(src)) {
    const response = await fetch(await getPresignedUrl(src));
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`Logo fetch failed: ${response.status} ${contentType || "unknown content type"}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  return readFile(join(process.cwd(), "public", src));
}

function proposalToPitchEmail(proposal: ServiceProposalContent): PitchContent {
  return {
    subject: proposal.subject,
    headline: proposal.title,
    personalizedHook: proposal.executiveSummary,
    keyFindings: proposal.benefits.slice(0, 3),
    hiddenFindingsCount: Math.max(0, proposal.benefits.length - 3),
    opportunityParagraph: proposal.clientNeed,
    solutionBullets: proposal.deliverables.slice(0, 3).map((item) => `${item.title}: ${item.description}`),
    impactParagraph: proposal.proofPoints.map((point) => `${point.metric} ${point.label}`).join(". "),
    ctaText: "Review the Proposal",
    ctaSubtext: "The full proposal is attached as a PDF.",
    closingLine: proposal.nextSteps[0] || "We look forward to discussing the next step.",
  };
}

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
    let pitchContent: PitchContent | ServiceProposalContent;
    let research: ResearchData;
    try {
      pitchContent = JSON.parse(pitch.pitchContent || "{}") as PitchContent | ServiceProposalContent;
      research = JSON.parse(pitch.research || "{}") as ResearchData;
    } catch {
      return NextResponse.json({ success: false, error: { message: "Pitch content is corrupted" } }, { status: 500 });
    }

    // Get brand kit + user + marketing config in parallel
    const [brandKit, user, marketingConfig] = await Promise.all([
      prisma.brandKit.findFirst({
        where: { userId: session.userId },
        select: { name: true, colors: true, logo: true, iconLogo: true, website: true },
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

    const brandColors = JSON.parse(brandKit?.colors || "{}") as { primary?: string; secondary?: string; accent?: string };

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
        } else {
          buffer = await fetchLogoBuffer(src);
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
      accentColor: brandColors.accent,
      logo: logoBase64,
      logoAspectRatio,
    };
    let proposalContent: ServiceProposalContent | null = null;
    let emailPitchContent: PitchContent;
    if (isServiceProposal(pitchContent)) {
      proposalContent = await ensureFullProposalSections(pitchContent);
      if (JSON.stringify(proposalContent) !== JSON.stringify(pitchContent)) {
        await prisma.pitch.update({
          where: { id },
          data: { pitchContent: JSON.stringify(sanitizeUrlsForStorage(proposalContent)) },
        });
      }
      emailPitchContent = proposalToPitchEmail(proposalContent);
    } else {
      emailPitchContent = pitchContent;
    }

    // Generate PDF
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = proposalContent
        ? await generateServiceProposalPDF(proposalContent, brand)
        : await generatePitchPDF(emailPitchContent, research, pitch.businessName, brand);
    } catch (pdfErr) {
      console.error("[send pitch] PDF generation failed:", pdfErr);
      if (proposalContent) {
        return NextResponse.json({ success: false, error: { message: "Proposal PDF generation failed. Please try again." } }, { status: 500 });
      }
      // Continue without PDF and still send the HTML email.
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

    const sendWithFallbackSmtp = async () => {
      // Fall back to FlowSmartly's SMTP
      await sendPitchEmail({
        to: toEmail,
        recipientName: toName || undefined,
        businessName: pitch.businessName,
        pitch: emailPitchContent,
        research,
        pdfBuffer,
        senderName: fromName,
        replyTo: replyToAddr,
        customMessage: message || undefined,
        brandPrimaryColor: brand.primaryColor,
        brandWebsite: brandKit?.website || undefined,
      });
    };

    if (canUseUserEmail) {
      try {
        // Build pitch email HTML then send via user's provider
        const { buildPitchEmailHtml } = await import("@/lib/email");
        const html = buildPitchEmailHtml({
          recipientName: toName || undefined,
          businessName: pitch.businessName,
          pitch: emailPitchContent,
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
            emailPitchContent.subject,
            html,
            undefined,
            attachments,
          );
        } else {
          const transporter = createTransporter(marketingConfig.emailProvider, emailCfg);
          await transporter.sendMail({
            from: `${fromName} <${fromEmail}>`,
            to: toEmail,
            subject: emailPitchContent.subject,
            html,
            replyTo: replyToAddr,
            attachments: attachments.map(a => ({ filename: a.filename, content: a.content })),
          });
        }
      } catch (providerError) {
        console.warn("[send pitch] User email provider failed; falling back to FlowSmartly SMTP:", providerError);
        await sendWithFallbackSmtp();
      }
    } else {
      await sendWithFallbackSmtp();
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
