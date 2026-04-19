import { baseTemplate, sendEmail } from "./core";

type ResearchForEmail = {
  hasSSL?: boolean;
  hasMobileViewport?: boolean;
  hasAnalytics?: boolean;
  hasEmailCapture?: boolean;
  hasChatWidget?: boolean;
  hasBookingSystem?: boolean;
  hasEcommerce?: boolean;
  socialLinks?: string[];
  techStack?: string[];
  fetchError?: string;
  googlePlaces?: {
    rating?: number;
    reviewCount?: number;
    phone?: string;
    address?: string;
  };
};

function emailScoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function computeEmailScore(r: ResearchForEmail) {
  const gp = r.googlePlaces;
  const websiteScore = Math.round(([!!r.hasSSL, !!r.hasMobileViewport, !r.fetchError].filter(Boolean).length / 3) * 100);
  const analyticsScore = Math.round(([!!r.hasAnalytics, !!(r.techStack?.some(t => t.includes("Pixel") || t.includes("Hotjar")))].filter(Boolean).length / 2) * 100);
  const leadScore = Math.round(([!!r.hasEmailCapture, !!r.hasChatWidget, !!r.hasBookingSystem].filter(Boolean).length / 3) * 100);
  const reputationScore = gp ? Math.min(100, Math.round(((gp.rating ?? 0) / 5) * 50 + Math.min(30, ((gp.reviewCount ?? 0) / 100) * 30) + 20)) : 0;
  const socialScore = Math.min(100, Math.round((r.socialLinks?.length ?? 0) * 33));
  const overall = Math.round(websiteScore * 0.2 + analyticsScore * 0.15 + leadScore * 0.25 + reputationScore * 0.25 + socialScore * 0.15);

  return {
    overall,
    categories: [
      { name: "Website Health",    score: websiteScore },
      { name: "Analytics",         score: analyticsScore },
      { name: "Lead Generation",   score: leadScore },
      { name: "Online Reputation", score: reputationScore },
      { name: "Social Presence",   score: socialScore },
    ],
  };
}

interface PitchEmailContent {
  recipientName?: string;
  businessName: string;
  pitch: {
    subject: string;
    headline: string;
    personalizedHook: string;
    keyFindings: string[];
    hiddenFindingsCount?: number;
    opportunityParagraph: string;
    solutionBullets: string[];
    impactParagraph: string;
    ctaText: string;
    ctaSubtext: string;
    closingLine: string;
  };
  research?: ResearchForEmail;
  pdfBuffer?: Buffer;
  senderName: string;
  customMessage?: string;
  brandPrimaryColor?: string;
  brandWebsite?: string;
}

/** Build pitch email HTML without sending — used when routing via user's own email provider */
export function buildPitchEmailHtml(params: PitchEmailContent): string {
  const { recipientName, businessName, pitch, research, pdfBuffer, customMessage, brandPrimaryColor, brandWebsite } = params;
  const greeting = recipientName ? `Hi ${recipientName},` : `Hi there,`;
  const ctaUrl = brandWebsite || process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  const accentColor = brandPrimaryColor || "#2563eb";

  const scoreData = research ? computeEmailScore(research) : null;
  const overall = scoreData?.overall ?? 0;
  const scoreColor = emailScoreColor(overall);
  const gp = research?.googlePlaces;

  const scoreSection = scoreData ? buildPitchScoreSection(scoreData, overall, scoreColor, gp) : "";
  const findingsHtml = (pitch.keyFindings || []).map((f, i) =>
    `<tr><td style="padding:4px 0;vertical-align:top;"><span style="display:inline-block;background:${accentColor};color:#fff;border-radius:50%;width:18px;height:18px;text-align:center;font-size:10px;font-weight:700;line-height:18px;margin-right:8px;">${i + 1}</span></td><td style="padding:4px 0;font-size:13px;color:#374151;line-height:1.5;">${f}</td></tr>`
  ).join("");
  const hiddenNote = (pitch.hiddenFindingsCount || 0) > 0
    ? `<p style="font-size:11px;color:#9ca3af;font-style:italic;margin:8px 0 0;">+ ${pitch.hiddenFindingsCount} more opportunities we'd love to discuss.</p>`
    : "";
  const solutionHtml = (pitch.solutionBullets || []).map(b =>
    `<li style="font-size:13px;color:#374151;margin-bottom:6px;line-height:1.5;">${b}</li>`
  ).join("");
  const customMsgBlock = customMessage
    ? `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:6px;margin:0 0 16px;"><p style="margin:0;font-size:13px;color:#166534;">${customMessage}</p></div>`
    : "";

  const content = `
    <h2 style="font-size:20px;color:#1e293b;margin:0 0 4px;line-height:1.3;">${pitch.headline}</h2>
    <p style="color:#64748b;font-size:12px;margin:0 0 16px;">Prepared exclusively for <strong>${businessName}</strong></p>
    ${customMsgBlock}
    <p style="font-size:14px;color:#374151;margin:0 0 16px;line-height:1.6;">${greeting}<br/><br/>${pitch.personalizedHook}</p>
    ${scoreSection}
    <div style="background:#f1f5ff;border-radius:10px;padding:16px 18px;margin:0 0 16px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:2px;color:${accentColor};text-transform:uppercase;">What We Discovered</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">${findingsHtml}</table>
      ${hiddenNote}
    </div>
    <p style="font-size:13px;color:#374151;margin:0 0 16px;line-height:1.6;">${pitch.opportunityParagraph}</p>
    <ul style="padding-left:20px;margin:0 0 16px;">${solutionHtml}</ul>
    <p style="font-size:13px;color:#374151;margin:0 0 16px;line-height:1.6;">${pitch.impactParagraph}</p>
    <div style="background:linear-gradient(135deg,${accentColor},${accentColor}cc);border-radius:10px;padding:20px;text-align:center;margin:0 0 16px;">
      <a href="${ctaUrl}" style="display:inline-block;background:white;color:${accentColor};font-weight:700;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;margin-bottom:8px;">${pitch.ctaText}</a>
      <p style="color:#ffffff;opacity:.85;font-size:11px;margin:0;">${pitch.ctaSubtext}</p>
    </div>
    ${pdfBuffer ? `<p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">📎 Full analysis attached as PDF.</p>` : ""}
    <p style="font-size:13px;color:#374151;margin:16px 0 0;line-height:1.6;font-style:italic;">${pitch.closingLine}</p>
  `;

  return baseTemplate(content, pitch.personalizedHook.slice(0, 120));
}

function buildPitchScoreSection(
  scoreData: ReturnType<typeof computeEmailScore>,
  overall: number,
  scoreColor: string,
  gp: ResearchForEmail["googlePlaces"] | undefined
): string {
  const catBars = scoreData.categories.map(cat => {
    const pct = cat.score;
    const catColor = emailScoreColor(pct);
    return `
      <tr>
        <td style="padding:3px 0;font-size:11px;color:#6b7280;width:120px;">${cat.name}</td>
        <td style="padding:3px 0;">
          <div style="background:#e5e7eb;border-radius:3px;height:6px;width:100%;">
            <div style="background:${catColor};border-radius:3px;height:6px;width:${pct}%;"></div>
          </div>
        </td>
        <td style="padding:3px 0 3px 8px;font-size:11px;font-weight:700;color:${catColor};width:30px;">${pct}</td>
      </tr>`;
  }).join("");

  const gpBlock = gp ? `
    <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:12px 14px;margin-top:10px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#92400e;text-transform:uppercase;">Google Business Profile</p>
      ${gp.rating !== undefined ? `<p style="margin:0;font-size:13px;color:#78350f;"><strong>${gp.rating}/5.0</strong>${gp.reviewCount !== undefined ? ` (${gp.reviewCount} reviews)` : ""}</p>` : ""}
      ${gp.address ? `<p style="margin:2px 0 0;font-size:11px;color:#92400e;">${gp.address}</p>` : ""}
    </div>` : "";

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8faff;border:1px solid #dbeafe;border-radius:10px;margin:20px 0;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;color:#2563eb;text-transform:uppercase;">Digital Presence Score</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
          <tr>
            <td width="58" valign="middle">
              <div style="width:52px;height:52px;border-radius:8px;background:${scoreColor}22;border:2px solid ${scoreColor};text-align:center;padding-top:8px;">
                <span style="display:block;font-size:20px;font-weight:900;color:${scoreColor};line-height:1;">${overall}</span>
                <span style="display:block;font-size:9px;color:#9ca3af;line-height:1.2;">/100</span>
              </div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${scoreColor};">${overall >= 80 ? "Strong" : overall >= 60 ? "Moderate" : overall >= 40 ? "Weak" : "Poor"} Digital Presence</p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">${catBars}</table>
            </td>
          </tr>
        </table>
        ${gpBlock}
      </td></tr>
    </table>`;
}

export async function sendPitchEmail(params: PitchEmailContent & { to: string; replyTo?: string }) {
  const { to, replyTo, pdfBuffer, pitch } = params;
  const html = buildPitchEmailHtml(params);

  const attachments = pdfBuffer
    ? [{
        filename: `${params.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf" as const,
      }]
    : [];

  return sendEmail({
    to,
    subject: pitch.subject,
    html,
    replyTo,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}
