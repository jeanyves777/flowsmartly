import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/core";
import { sendSMS, formatPhoneNumber } from "@/lib/twilio";
import { generatePitchPDF, generateServiceProposalPDF } from "@/lib/pitch/pdf-generator";
import { isServiceProposalContent } from "@/lib/pitch/proposal-detail-helpers";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";

/**
 * Real send adapters for the outreach-sequence engine — one email / one SMS per
 * due step. Kept out of the engine so the engine stays a thin state machine and
 * these can be reused/tested. Each returns { ok, error? } and NEVER throws; the
 * engine decides advance-vs-retry from `ok`. Credits are deducted on success.
 */

/** Minimal brand for the PDF generator (its BrandInfo isn't exported). */
type PdfBrand = { name: string; primaryColor: string; secondaryColor?: string; accentColor?: string; logo?: string; logoAspectRatio?: number };

function bodyToHtml(body: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#1a1a2e;max-width:600px">${paras}</div>`;
}

/** Build the attached proposal PDF for a step's pitchId (or null on failure). */
async function pitchPdf(pitchId: string, userId: string): Promise<{ filename: string; content: Buffer } | null> {
  try {
    const p = await prisma.pitch.findFirst({ where: { id: pitchId, userId }, select: { pitchContent: true, research: true, businessName: true } });
    if (!p) return null;
    let content: Record<string, unknown> = {}; try { content = JSON.parse(p.pitchContent || "{}"); } catch { /* ignore */ }
    let research: Record<string, unknown> = {}; try { research = JSON.parse(p.research || "{}"); } catch { /* ignore */ }
    const bs = (content.brandSnapshot || {}) as Record<string, unknown>;
    const colors = (bs.colors || {}) as Record<string, string>;
    const brand: PdfBrand = { name: (bs.name as string) || (content.preparedBy as string) || "FlowSmartly", primaryColor: colors.primary || "#2563eb", secondaryColor: colors.secondary, accentColor: colors.accent };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = isServiceProposalContent(content) ? await generateServiceProposalPDF(content as any, brand as any) : await generatePitchPDF(content as any, research as any, p.businessName, brand as any);
    if (!buffer) return null;
    return { filename: `${(p.businessName || "proposal").replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`, content: buffer };
  } catch { return null; }
}

/** Send one outreach email (with the attached proposal PDF when the step has one). */
export async function deliverSequenceEmail(opts: { userId: string; to: string; subject: string; body: string; pitchId?: string }): Promise<{ ok: boolean; error?: string }> {
  const to = opts.to?.trim();
  if (!to) return { ok: false, error: "no email" };
  const cfg = await prisma.marketingConfig.findUnique({ where: { userId: opts.userId }, select: { defaultFromEmail: true } }).catch(() => null);
  const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } }).catch(() => null);
  const replyTo = cfg?.defaultFromEmail || user?.email || undefined;

  const attachments = [] as Array<{ filename: string; content: Buffer; contentType: string }>;
  if (opts.pitchId) { const pdf = await pitchPdf(opts.pitchId, opts.userId); if (pdf) attachments.push({ ...pdf, contentType: "application/pdf" }); }

  const res = await sendEmail({ to, subject: opts.subject || "Following up", html: bodyToHtml(opts.body || ""), text: opts.body || undefined, replyTo, attachments: attachments.length ? attachments : undefined });
  if (res.success) {
    const cost = await getDynamicCreditCost("EMAIL_SEND").catch(() => 0);
    if (cost > 0) await creditService.deductCredits({ userId: opts.userId, type: TRANSACTION_TYPES.USAGE, amount: cost, description: "Outreach automation: email sent", referenceType: "sequence_email" }).catch(() => {});
  }
  return { ok: !!res.success, error: res.error };
}

/** Send one outreach SMS from the user's Twilio number. */
export async function deliverSequenceSms(opts: { userId: string; to: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  const to = opts.to?.trim();
  if (!to) return { ok: false, error: "no phone" };
  const cfg = await prisma.marketingConfig.findUnique({ where: { userId: opts.userId }, select: { smsPhoneNumber: true } }).catch(() => null);
  if (!cfg?.smsPhoneNumber) return { ok: false, error: "no sms number" };
  const body = (opts.body || "").trim();
  const withOptOut = /\bstop\b/i.test(body) ? body : `${body}\n\nReply STOP to opt out.`;
  const res = await sendSMS({ from: cfg.smsPhoneNumber, to: formatPhoneNumber(to), body: withOptOut });
  if (res.success) {
    const cost = await getDynamicCreditCost("SMS_SEND").catch(() => 0);
    if (cost > 0) await creditService.deductCredits({ userId: opts.userId, type: TRANSACTION_TYPES.USAGE, amount: cost, description: "Outreach automation: SMS sent", referenceType: "sequence_sms" }).catch(() => {});
  }
  return { ok: !!res.success, error: res.error };
}
