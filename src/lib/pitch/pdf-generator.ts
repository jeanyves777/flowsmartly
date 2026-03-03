import type { PitchContent } from "./generator";
import type { ResearchData } from "./researcher";
import { computeDigitalScore, scoreHexColor } from "./scorer";

interface BrandInfo {
  name: string;
  primaryColor?: string;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw a horizontal score bar at position (x, y)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawScoreBar(doc: any, x: number, y: number, w: number, h: number, score: number, color: string) {
  const rgb = hexToRgb(color);
  // Track (gray background)
  doc.setFillColor(235, 237, 242);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  // Fill
  const fillW = Math.max(h, (score / 100) * w); // at least a dot
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.roundedRect(x, y, fillW, h, h / 2, h / 2, "F");
}

// Draw a score badge (rounded square) with big number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawScoreBadge(doc: any, x: number, y: number, size: number, score: number) {
  const color = scoreHexColor(score);
  const rgb = hexToRgb(color);
  const bgRgb = hexToRgb(color + "22"); // light tint — approximate with desaturated

  // Light background
  doc.setFillColor(rgb.r + Math.round((255 - rgb.r) * 0.85), rgb.g + Math.round((255 - rgb.g) * 0.85), rgb.b + Math.round((255 - rgb.b) * 0.85));
  doc.roundedRect(x, y, size, size, 4, 4, "F");

  // Colored border
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(1.5);
  doc.roundedRect(x, y, size, size, 4, 4, "S");

  // Score number
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(String(score), x + size / 2, y + size / 2 - 2, { align: "center" });

  // "/100" label
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("/100", x + size / 2, y + size / 2 + 6, { align: "center" });
}

export async function generatePitchPDF(
  pitch: PitchContent,
  research: ResearchData,
  businessName: string,
  brand: BrandInfo
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;
  const primaryHex = brand.primaryColor || "#2563eb";
  const primary = hexToRgb(primaryHex);

  const score = computeDigitalScore(research);
  const gp = research.googlePlaces;

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1 — Header + Score Card + Findings
  // ══════════════════════════════════════════════════════════════════

  // ── Header bar ─────────────────────────────────────────────────────
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FLOWSMARTLY", margin, 13);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL PROPOSAL", pageW - margin, 13, { align: "right" });

  // ── Headline ─────────────────────────────────────────────────────
  let y = 30;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  const headLines = wrapText(pitch.headline || `A Growth Strategy Built for ${businessName}`, 58);
  for (const line of headLines) {
    doc.text(line, margin, y);
    y += 8;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Prepared for: ${businessName}  ·  ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y);
  y += 4;

  // Divider
  doc.setDrawColor(primary.r, primary.g, primary.b);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Digital Health Score Card ──────────────────────────────────────
  // Layout: badge (28x28) | label + main bar + 3 rows of category bars (2 cols)
  // Row heights: title(8) + top-pad(4) + badge area(28) + catRows(3×9=27) + bottom-pad(6) = 73
  const cardH = 76;
  doc.setFillColor(247, 249, 252);
  doc.roundedRect(margin, y, contentW, cardH, 4, 4, "F");
  doc.setDrawColor(220, 224, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, cardH, 4, 4, "S");

  // Card title
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("DIGITAL PRESENCE SCORE", margin + 5, y + 8);

  // Score badge (left side of card, smaller to leave room for cats)
  const badgeX = margin + 5;
  const badgeY = y + 13;
  const badgeSize = 28;
  drawScoreBadge(doc, badgeX, badgeY, badgeSize, score.overall);

  // Score label + benchmark text (right of badge)
  const labelX = badgeX + badgeSize + 6;
  const scoreRgb = hexToRgb(score.hexColor);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(scoreRgb.r, scoreRgb.g, scoreRgb.b);
  doc.text(`${score.label} Digital Presence`, labelX, badgeY + 7);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(`Industry avg: 52  ·  Top performers: 85`, labelX, badgeY + 14);

  // Main score bar
  const barW = contentW - (labelX - margin) - 5;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Overall", labelX, badgeY + 21);
  doc.setTextColor(scoreRgb.r, scoreRgb.g, scoreRgb.b);
  doc.setFont("helvetica", "bold");
  doc.text(String(score.overall), labelX + barW, badgeY + 21, { align: "right" });
  doc.setFont("helvetica", "normal");
  drawScoreBar(doc, labelX, badgeY + 22.5, barW, 3.5, score.overall, score.hexColor);

  // Benchmark marker at 85
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.4);
  const bmarkX = labelX + (85 / 100) * barW;
  doc.line(bmarkX, badgeY + 21.5, bmarkX, badgeY + 27);
  doc.setFontSize(5.5);
  doc.setTextColor(140, 140, 140);
  doc.text("85", bmarkX, badgeY + 30, { align: "center" });

  // Category bars: 2-column grid, 3 rows (5 cats: 2+2+1)
  const catStartY = badgeY + 33;
  const halfW = (barW - 6) / 2;
  const catRowH = 8.5;
  const catBarH = 3;

  score.categories.forEach((cat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = labelX + col * (halfW + 6);
    const cy = catStartY + row * catRowH;
    const catRgb = hexToRgb(cat.hexColor);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(cat.name, cx, cy);
    doc.setTextColor(catRgb.r, catRgb.g, catRgb.b);
    doc.setFont("helvetica", "bold");
    doc.text(String(cat.score), cx + halfW - 2, cy, { align: "right" });
    doc.setFont("helvetica", "normal");
    drawScoreBar(doc, cx, cy + 1.5, halfW - 4, catBarH, cat.score, cat.hexColor);
  });

  y += cardH + 8;

  // ── Google Business Data (if available) ────────────────────────────
  if (gp) {
    const gpCardH = 18;
    doc.setFillColor(255, 251, 235); // amber tint
    doc.roundedRect(margin, y, contentW, gpCardH, 3, 3, "F");
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, gpCardH, 3, 3, "S");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 80, 0);
    doc.text("GOOGLE BUSINESS PROFILE", margin + 4, y + 7);

    // Stars
    const starStr = gp.rating !== undefined ? `★ ${gp.rating}/5.0` : "No rating";
    doc.setTextColor(180, 120, 0);
    doc.text(starStr, margin + 4, y + 14);

    if (gp.reviewCount !== undefined) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 80, 0);
      doc.text(`(${gp.reviewCount} reviews)`, margin + 26, y + 14);
    }

    // Rating bar
    if (gp.rating !== undefined) {
      const ratingBarX = margin + 60;
      const ratingBarW = 60;
      drawScoreBar(doc, ratingBarX, y + 11, ratingBarW, 3.5, (gp.rating / 5) * 100,
        gp.rating >= 4.5 ? "#22c55e" : gp.rating >= 4.0 ? "#f59e0b" : "#ef4444");
      // Benchmark at 4.5
      const bx = ratingBarX + (4.5 / 5) * ratingBarW;
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.4);
      doc.line(bx, y + 10, bx, y + 16);
      doc.setFontSize(5.5);
      doc.setTextColor(130, 130, 130);
      doc.text("4.5★", bx, y + 18, { align: "center" });
    }

    if (gp.phone) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`📞 ${gp.phone}`, pageW - margin - 4, y + 7, { align: "right" });
    }
    if (gp.address) {
      const shortAddr = gp.address.length > 50 ? gp.address.slice(0, 48) + "…" : gp.address;
      doc.setFontSize(7);
      doc.text(shortAddr, pageW - margin - 4, y + 13, { align: "right" });
    }

    y += gpCardH + 7;
  }

  // ── Personalized Hook ───────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(`Dear ${businessName},`, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  const hookLines = doc.splitTextToSize(pitch.personalizedHook || "", contentW);
  doc.text(hookLines, margin, y);
  y += hookLines.length * 5 + 6;

  // ── What We Discovered ─────────────────────────────────────────────
  const findingsBgH = 8 + (pitch.keyFindings?.length || 0) * 9 + ((pitch.hiddenFindingsCount || 0) > 0 ? 9 : 0) + 4;
  if (y + findingsBgH > pageH - 40) {
    doc.addPage();
    y = 25;
  }

  doc.setFillColor(241, 245, 255);
  doc.roundedRect(margin, y, contentW, findingsBgH, 3, 3, "F");

  y += 6;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("WHAT WE DISCOVERED", margin + 5, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < (pitch.keyFindings?.length || 0); i++) {
    const f = pitch.keyFindings![i];
    // Numbered circle
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.circle(margin + 6, y - 1.5, 2.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text(String(i + 1), margin + 6, y - 0.5, { align: "center" });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    const fLines = doc.splitTextToSize(f, contentW - 16);
    doc.text(fLines, margin + 12, y);
    y += fLines.length * 5 + 2.5;
  }

  if ((pitch.hiddenFindingsCount || 0) > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`+ ${pitch.hiddenFindingsCount} more opportunities we'd love to discuss.`, margin + 5, y);
    y += 9;
  } else {
    y += 2;
  }

  // ── Opportunity ────────────────────────────────────────────────────
  y += 4;
  if (y > pageH - 50) { doc.addPage(); y = 25; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("THE OPPORTUNITY", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  const oppLines = doc.splitTextToSize(pitch.opportunityParagraph || "", contentW);
  doc.text(oppLines, margin, y);
  y += oppLines.length * 5 + 6;

  // ── How We Help ────────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 25; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("HOW FLOWSMARTLY CAN HELP", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const bullet of (pitch.solutionBullets || [])) {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.circle(margin + 2, y - 1.5, 1.3, "F");
    doc.setTextColor(40, 40, 40);
    const bLines = doc.splitTextToSize(bullet, contentW - 9);
    doc.text(bLines, margin + 6, y);
    y += bLines.length * 5 + 3;
  }

  // ── Expected Impact ────────────────────────────────────────────────
  y += 2;
  if (y > pageH - 55) { doc.addPage(); y = 25; }

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  const impactBlockH = 6 + doc.splitTextToSize(pitch.impactParagraph || "", contentW - 10).length * 5 + 4;
  doc.roundedRect(margin, y, contentW, impactBlockH, 3, 3, "FD");

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("EXPECTED IMPACT", margin + 5, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 80);
  const impLines = doc.splitTextToSize(pitch.impactParagraph || "", contentW - 10);
  doc.text(impLines, margin + 5, y);
  y += impLines.length * 5 + 6;

  // ── CTA Box ────────────────────────────────────────────────────────
  const ctaBoxH = 26;
  if (y + ctaBoxH > pageH - 22) { doc.addPage(); y = 25; }

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.roundedRect(margin, y, contentW, ctaBoxH, 4, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(pitch.ctaText || "Let's Talk About Your Growth", pageW / 2, y + 10, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(210, 220, 255);
  doc.text(pitch.ctaSubtext || "No commitment. Just a quick 20-minute conversation.", pageW / 2, y + 19, { align: "center" });

  y += ctaBoxH + 7;

  // ── Closing ────────────────────────────────────────────────────────
  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  const closeLines = doc.splitTextToSize(pitch.closingLine || "", contentW);
  doc.text(closeLines, margin, y);

  // ── Footer (every page) ─────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, pageH - 11, pageW, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("flowsmartly.com  ·  Powered by FlowSmartly AI", pageW / 2, pageH - 4, { align: "center" });
    if (totalPages > 1) {
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
