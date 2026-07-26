import { prisma } from "@/lib/db/client";
import { generatePitchPDF, generateServiceProposalPDF } from "@/lib/pitch/pdf-generator";
import { renderProposalHtml, renderProposalEmailHtml } from "@/lib/pitch/proposal-html";
import { renderHtmlToPdf } from "@/lib/utils/html-renderer";
import { sendEmail } from "@/lib/email/core";
import { createTransporter, sendViaMailgunApi } from "@/lib/email/marketing-sender";
import { getPresignedUrl, presignAllUrls } from "@/lib/utils/s3-client";
import type { PitchContent } from "@/lib/pitch/generator";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import type { ResearchData } from "@/lib/pitch/researcher";

/**
 * Shared proposal delivery — one code path used by BOTH the /api/pitch/[id]/send
 * route and the send_proposal agent tool, so the agent and the UI send the exact
 * same branded PDF (rendered from the SAME HTML as the Pitch Studio) via the same
 * email pipeline. [[agent-operates-account-full-crud]]
 */

function isServiceProposal(content: PitchContent | ServiceProposalContent): content is ServiceProposalContent {
  return (content as ServiceProposalContent).documentType === "service_proposal";
}

const SERVICE_PROPOSAL_BUILDER_TYPES = new Set([
  "visual-sales-deck",
  "professional-services",
  "process-framework",
] as const);

function cleanProposalBuilderType(value: unknown): ServiceProposalContent["builderType"] | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  if (SERVICE_PROPOSAL_BUILDER_TYPES.has(raw as NonNullable<ServiceProposalContent["builderType"]>)) {
    return raw as NonNullable<ServiceProposalContent["builderType"]>;
  }
  return undefined;
}

function restoreProposalBuilderType(proposal: ServiceProposalContent, research: ResearchData): ServiceProposalContent {
  const builderType =
    cleanProposalBuilderType(proposal.builderType) ||
    cleanProposalBuilderType((research as { builderType?: unknown }).builderType);
  return builderType && builderType !== proposal.builderType ? { ...proposal, builderType } : proposal;
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
    try { candidates.push(await getPresignedUrl(src)); } catch { /* fall through */ }
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

export interface DeliverProposalOpts {
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  /** Generate + return the PDF only, don't send an email. */
  pdfOnly?: boolean;
  /** Which proposal layout to render — matches the Studio's selected doc type
   *  (Proposal deck = text-forward, Visual deck = image-rich). Defaults to deck. */
  variant?: "deck" | "visual";
}

export type DeliverProposalCode = "not_found" | "not_ready" | "no_recipient" | "pdf_failed" | "error";

export interface DeliverProposalResult {
  ok: boolean;
  code?: DeliverProposalCode;
  error?: string;
  pdf?: Buffer;
  filename?: string;
  sentTo?: string;
  /** How the email actually went out (the user's own provider vs the shared fallback). */
  via?: "user" | "fallback";
}

/**
 * Build the branded proposal PDF (and, unless pdfOnly, email it to the
 * recipient with the PDF attached, then mark the pitch Sent). Returns a
 * structured result — never throws for the expected error cases.
 */
export async function deliverProposal(userId: string, pitchId: string, opts: DeliverProposalOpts): Promise<DeliverProposalResult> {
  const pitch = await prisma.pitch.findFirst({ where: { id: pitchId, userId } });
  if (!pitch) return { ok: false, code: "not_found", error: "Proposal not found." };
  if (pitch.status !== "READY" && pitch.status !== "SENT") {
    return { ok: false, code: "not_ready", error: "This document isn't ready yet — the agent is still building it." };
  }

  const toEmail = opts.pdfOnly ? "" : (opts.recipientEmail || pitch.recipientEmail || "").trim();
  if (!opts.pdfOnly && !toEmail) return { ok: false, code: "no_recipient", error: "A recipient email is required to send." };
  const toName = opts.recipientName || pitch.recipientName || "";

  let pitchContent: PitchContent | ServiceProposalContent;
  let research: ResearchData;
  try {
    pitchContent = JSON.parse(pitch.pitchContent || "{}") as PitchContent | ServiceProposalContent;
    research = JSON.parse(pitch.research || "{}") as ResearchData;
    pitchContent = await presignAllUrls(pitchContent);
  } catch {
    return { ok: false, code: "error", error: "Proposal content is corrupted." };
  }

  const [brandKit, user, marketingConfig] = await Promise.all([
    prisma.brandKit.findFirst({ where: { userId }, select: { name: true, colors: true, logo: true, iconLogo: true, website: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.marketingConfig.findFirst({
      where: { userId },
      select: { emailProvider: true, emailConfig: true, emailEnabled: true, defaultFromName: true, defaultFromEmail: true, defaultReplyTo: true },
    }),
  ]);

  const brandColors = JSON.parse(brandKit?.colors || "{}") as { primary?: string; secondary?: string; accent?: string };

  let logoBase64: string | undefined;
  let logoAspectRatio: number | undefined;
  if (brandKit?.logo) {
    try {
      const sharp = (await import("sharp")).default;
      let buffer: Buffer;
      const src = brandKit.logo;
      if (src.startsWith("data:")) buffer = Buffer.from(src.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
      else buffer = await fetchLogoBuffer(src);
      const meta = await sharp(buffer).metadata();
      const mime = (meta.format === "jpeg" || meta.format === "jpg") ? "image/jpeg" : meta.format === "webp" ? "image/webp" : "image/png";
      logoBase64 = `data:${mime};base64,${buffer.toString("base64")}`;
      logoAspectRatio = (meta.width || 100) / (meta.height || 100);
    } catch (e) {
      console.warn("[deliverProposal] Could not resolve brand logo:", e);
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
    proposalContent = restoreProposalBuilderType(pitchContent, research);
    emailPitchContent = proposalToPitchEmail(proposalContent);
  } else {
    emailPitchContent = pitchContent;
  }

  // Inline the proposal's cover/about/impact images as data URIs BEFORE rendering.
  // The PDF renderer loads HTML via Puppeteer setContent (origin about:blank), so a
  // remote/presigned/relative <img src> silently fails to load — that's the "all
  // images missing" bug. Embedding them (like the logo already is) makes the PDF
  // self-contained: no live fetch at render time, no presign expiry, no origin issue.
  const pc = proposalContent;
  if (pc?.visualAssets?.images?.length) {
    const images = await Promise.all(
      pc.visualAssets.images.map(async (im) => {
        const url = typeof im?.url === "string" ? im.url : "";
        if (!url || url.startsWith("data:")) return im;
        try {
          const sharp = (await import("sharp")).default;
          const raw = await fetchLogoBuffer(url);
          const meta = await sharp(raw).metadata();
          const fmt = meta.format === "jpeg" || meta.format === "jpg" ? "image/jpeg" : meta.format === "webp" ? "image/webp" : "image/png";
          const out = await sharp(raw).resize({ width: 1600, withoutEnlargement: true }).toBuffer();
          return { ...im, url: `data:${fmt};base64,${out.toString("base64")}` };
        } catch (e) {
          console.warn("[deliverProposal] Could not embed proposal image:", im?.kind, e);
          return im;
        }
      }),
    );
    proposalContent = { ...pc, visualAssets: { ...pc.visualAssets, images } };
  }

  // Build the PDF — proposals render from the SAME HTML the Studio shows.
  let pdfBuffer: Buffer | undefined;
  try {
    if (proposalContent) {
      try {
        const html = renderProposalHtml(proposalContent, { logoDataUri: brand.logo, brandName: brand.name, variant: opts.variant });
        pdfBuffer = await renderHtmlToPdf(html, { format: "A4" });
      } catch (htmlErr) {
        console.warn("[deliverProposal] HTML→PDF failed, falling back to jsPDF:", htmlErr);
        pdfBuffer = await generateServiceProposalPDF(proposalContent, brand);
      }
    } else {
      pdfBuffer = await generatePitchPDF(emailPitchContent, research, pitch.businessName, brand);
    }
  } catch (pdfErr) {
    console.error("[deliverProposal] PDF generation failed:", pdfErr);
    if (proposalContent) return { ok: false, code: "pdf_failed", error: "Proposal PDF generation failed. Please try again." };
  }

  const filename = `${pitch.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`;

  if (opts.pdfOnly) {
    if (!pdfBuffer) return { ok: false, code: "pdf_failed", error: "PDF generation failed." };
    return { ok: true, pdf: pdfBuffer, filename };
  }

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

  // Build the email body ONCE, and use it for every send path so the sent email
  // matches what the user sees. A service proposal uses the NEW Studio email
  // design (renderProposalEmailHtml); a legacy pitch keeps the old audit email.
  const emailSubject = emailPitchContent.subject || proposalContent?.title || "Your proposal";
  const ctaUrl = brandKit?.website || process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  let emailHtml: string;
  if (proposalContent) {
    emailHtml = renderProposalEmailHtml(proposalContent, {
      logoDataUri: brand.logo,
      brandName: brand.name,
      recipientName: toName || undefined,
      businessName: pitch.businessName,
      customMessage: opts.message || undefined,
      ctaUrl,
      hasPdf: !!pdfBuffer,
      pdfFilename: filename,
    });
  } else {
    const { buildPitchEmailHtml } = await import("@/lib/email");
    emailHtml = buildPitchEmailHtml({
      recipientName: toName || undefined,
      businessName: pitch.businessName,
      pitch: emailPitchContent,
      research,
      pdfBuffer,
      senderName: fromName,
      customMessage: opts.message || undefined,
      brandPrimaryColor: brand.primaryColor,
      brandWebsite: brandKit?.website || undefined,
    });
  }
  const attachments = pdfBuffer ? [{ filename, content: pdfBuffer, contentType: "application/pdf" as const }] : [];

  const sendWithFallbackSmtp = async () => {
    await sendEmail({ to: toEmail, subject: emailSubject, html: emailHtml, replyTo: replyToAddr, attachments: attachments.length ? attachments : undefined });
  };

  let via: "user" | "fallback" = "fallback";
  if (canUseUserEmail) {
    try {
      if (marketingConfig!.emailProvider === "MAILGUN") {
        await sendViaMailgunApi(emailCfg!, `${fromName} <${fromEmail}>`, toEmail, emailSubject, emailHtml, undefined, attachments);
      } else {
        const transporter = createTransporter(marketingConfig!.emailProvider, emailCfg!);
        await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to: toEmail, subject: emailSubject, html: emailHtml, replyTo: replyToAddr, attachments });
      }
      via = "user";
    } catch (providerError) {
      console.warn("[deliverProposal] User email provider failed; falling back to FlowSmartly SMTP:", providerError);
      await sendWithFallbackSmtp();
    }
  } else {
    await sendWithFallbackSmtp();
  }

  await prisma.pitch.update({
    where: { id: pitchId },
    data: { status: "SENT", sentAt: new Date(), recipientEmail: toEmail, recipientName: toName || null },
  });

  return { ok: true, sentTo: toEmail, filename, via };
}
